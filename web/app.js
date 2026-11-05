import {
  createPublicClient, createWalletClient, custom, http, getAddress, isAddress,
} from "https://esm.sh/viem@2.21.0";
import { sepolia } from "https://esm.sh/viem@2.21.0/chains";
import { GAME_ABI } from "./abi.js";
import { GAME_ADDRESS, RPC_URL, API_BASE, EXPLORER } from "./config.js";

const MOODS = [
  { emoji: "💤", name: "Snooze", range: "0" },
  { emoji: "🐾", name: "Potter", range: "1–99" },
  { emoji: "🏃", name: "Jog", range: "100–299" },
  { emoji: "⚡", name: "Zoomies", range: "300+" },
];
const HISTORY = 12;
const PENDING_SCAN = 144;

const $ = (id) => document.getElementById(id);
const qsGame = new URLSearchParams(location.search).get("game");
const game = isAddress(qsGame ?? "") ? getAddress(qsGame) : (isAddress(GAME_ADDRESS) ? getAddress(GAME_ADDRESS) : null);

// ?rpc= is for local testing against an anvil fork.
const qsRpc = new URLSearchParams(location.search).get("rpc");
const pub = createPublicClient({ chain: sepolia, transport: http(qsRpc || RPC_URL), batch: { multicall: true } });
const read = (functionName, args = []) => pub.readContract({ address: game, abi: GAME_ABI, functionName, args });

const state = {
  account: null, wallet: null,
  genesis: 0n, duration: 600n, current: 0n, settled: 0n,
  target: 0n, mood: null,
  squeeks: new Map(), // id(bigint) -> { ok: bool, level }
  selected: new Set(),
};

function setStatus(html, cls = "") { $("txStatus").innerHTML = `<span class="${cls}">${html}</span>`; }
const txLink = (h) => `<a target="_blank" rel="noopener" href="${EXPLORER}/tx/${h}">${h.slice(0, 10)}…</a>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------- live wheel (API, display only) ----------
async function pollLive() {
  try {
    const r = await fetch(`${API_BASE}/v1/status`, { headers: { accept: "application/json" } });
    const s = await r.json();
    const m = s.measurement ?? {};
    if (m.freshness !== "online") {
      $("liveStatus").textContent = "Unknown";
      $("liveRpm").textContent = `feed ${m.freshness ?? "unavailable"}`;
    } else {
      const spinning = m.coreStatus && m.coreStatus !== "IDLE";
      $("liveStatus").textContent = spinning ? "🏃 Spinning" : "💤 Idle";
      $("liveRpm").textContent = `${((m.rpmMilli ?? 0) / 1000).toFixed(1)} rpm · ${((m.speedMmPerSecond ?? 0) / 1000).toFixed(2)} m/s`;
    }
  } catch { $("liveStatus").textContent = "Unknown"; $("liveRpm").textContent = "API unreachable"; }
}

// ---------- rounds ----------
function nowRound() {
  const t = BigInt(Math.floor(Date.now() / 1000));
  return t < state.genesis ? 0n : (t - state.genesis) / state.duration + 1n;
}

function tickCountdown() {
  const cur = nowRound();
  if (cur !== state.current) { state.current = cur; if (state.target <= cur) state.target = cur + 1n; renderTabs(); refreshRound(); }
  const nextStart = Number(state.genesis + cur * state.duration);
  const left = Math.max(0, nextStart - Math.floor(Date.now() / 1000));
  $("curRound").textContent = cur.toString();
  $("countdown").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

function renderTabs() {
  const el = $("roundTabs"); el.innerHTML = "";
  for (let i = 1n; i <= 6n; i++) {
    const r = state.current + i;
    const b = document.createElement("button");
    b.textContent = i === 1n ? `#${r} (next)` : `#${r}`;
    b.className = r === state.target ? "on" : "";
    b.onclick = () => { state.target = r; renderTabs(); refreshRound(); };
    el.append(b);
  }
}

async function refreshRound() {
  const round = await read("getRound", [state.target]);
  const counts = round.counts.map(Number);
  const total = Number(round.total);
  const el = $("moods"); el.innerHTML = "";
  MOODS.forEach((m, i) => {
    const b = document.createElement("button");
    // If you join this mood, your call is counted too.
    const mult = ((total + 1) / (counts[i] + 1)).toFixed(2);
    b.innerHTML = `<span class="emoji">${m.emoji}</span><b>${m.name}</b><span class="small muted">${m.range} work</span><span class="small">${counts[i]} calls</span><span class="mult">×${mult} if right</span>`;
    b.className = state.mood === i ? "on" : "";
    b.onclick = () => { state.mood = i; refreshRound(); updatePredictBtn(); };
    el.append(b);
  });
  await refreshMyPicks();
}

async function refreshMyPicks() {
  const ids = [...state.squeeks.keys()];
  if (!ids.length) return;
  const picks = await read("getPicks", [state.target, ids]);
  ids.forEach((id, i) => {
    const chip = document.querySelector(`[data-id="${id}"] .pick`);
    if (chip) chip.textContent = picks[i].moodPlusOne ? ` ${MOODS[picks[i].moodPlusOne - 1].emoji}` : "";
  });
}

// ---------- wallet + squeeks ----------
async function connect() {
  if (!window.ethereum) { setStatus("No injected wallet found. Install MetaMask or Rabby.", "lose"); return; }
  const wallet = createWalletClient({ chain: sepolia, transport: custom(window.ethereum) });
  const [account] = await wallet.requestAddresses();
  try { await wallet.switchChain({ id: sepolia.id }); } catch {
    try { await wallet.addChain({ chain: sepolia }); } catch { /* user declined */ }
  }
  state.wallet = wallet; state.account = getAddress(account);
  $("connect").textContent = `${account.slice(0, 6)}…${account.slice(-4)}`;
  window.ethereum.on?.("accountsChanged", () => location.reload());
  window.ethereum.on?.("chainChanged", () => location.reload());
  await loadSqueeks();
}

async function loadSqueeks() {
  // The API only suggests which Squeeks to check; eligibility is read from the contract.
  const ids = [];
  try {
    let cursor = null;
    do {
      const q = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : {}) });
      const page = await (await fetch(`${API_BASE}/v1/accounts/${state.account}?${q}`)).json();
      if (page.status !== "available") break;
      page.tokens.forEach((t) => ids.push(BigInt(t.tokenId)));
      cursor = page.nextCursor;
    } while (cursor);
  } catch { /* fall back to manual IDs */ }
  for (const id of ids) await addSqueek(id, false);
  renderSqueeks();
  refreshMyPicks(); refreshHistory();
}

async function addSqueek(id, render = true) {
  if (id < 1n || id > 9999n || state.squeeks.has(id)) return;
  const ok = state.account ? await read("canPlay", [state.account, id]) : false;
  state.squeeks.set(id, { ok });
  if (ok) state.selected.add(id);
  if (render) { renderSqueeks(); refreshMyPicks(); refreshHistory(); }
}

function renderSqueeks() {
  const el = $("mySqueeks"); el.innerHTML = ""; el.classList.remove("muted");
  if (!state.squeeks.size) { el.classList.add("muted"); el.textContent = "No Squeeks found for this wallet. Add an ID manually if you hold one."; }
  for (const [id, s] of state.squeeks) {
    const c = document.createElement("span");
    c.dataset.id = id.toString();
    c.className = `chip ${!s.ok ? "bad" : state.selected.has(id) ? "on" : ""}`;
    c.innerHTML = `#${id}<span class="pick"></span>`;
    c.title = s.ok ? "Click to toggle" : "Not held by this wallet (wallet or staked)";
    if (s.ok) c.onclick = () => { state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id); renderSqueeks(); refreshMyPicks(); updatePredictBtn(); };
    el.append(c);
  }
  updatePredictBtn();
}

function updatePredictBtn() {
  $("predict").disabled = !(game && state.account && state.mood !== null && state.selected.size);
  $("predict").textContent = state.mood === null ? "Pick a mood" :
    `Call ${MOODS[state.mood].emoji} ${MOODS[state.mood].name} for round #${state.target} with ${state.selected.size} Squeek(s)`;
}

async function send(functionName, args, label) {
  try {
    setStatus(`Simulating ${label}…`);
    const { request } = await pub.simulateContract({ address: game, abi: GAME_ABI, functionName, args, account: state.account });
    setStatus("Confirm in your wallet…");
    const hash = await state.wallet.writeContract(request);
    setStatus(`Sent ${txLink(hash)} · waiting…`);
    const rc = await pub.waitForTransactionReceipt({ hash });
    setStatus(rc.status === "success" ? `✅ ${label} confirmed ${txLink(hash)}` : `Reverted ${txLink(hash)}`, rc.status === "success" ? "win" : "lose");
    return rc.status === "success";
  } catch (e) {
    setStatus(esc(e.shortMessage ?? e.message), "lose");
    return false;
  }
}

async function predict() {
  const ids = [...state.selected];
  if (await send("predict", [ids, state.target, state.mood], "Call")) refreshRound();
}

// ---------- history + scoring ----------
async function refreshHistory() {
  const tb = $("history"); tb.innerHTML = "";
  const mine = [...state.squeeks.entries()].filter(([, s]) => s.ok).map(([id]) => id);
  const pending = [];
  const from = state.settled > BigInt(PENDING_SCAN) ? state.settled - BigInt(PENDING_SCAN) + 1n : 1n;
  const rounds = [];
  for (let r = state.settled; r >= from; r--) rounds.push(r);
  const books = await Promise.all(rounds.map((r) => read("getRound", [r])));
  const picks = mine.length ? await Promise.all(rounds.map((r) => read("getPicks", [r, mine]))) : rounds.map(() => []);

  rounds.forEach((r, i) => {
    const b = books[i];
    const my = picks[i].map((p, j) => ({ id: mine[j], p })).filter((x) => x.p.moodPlusOne);
    const unscored = my.filter((x) => !x.p.scored).map((x) => x.id);
    if (unscored.length) pending.push({ round: r, ids: unscored });
    if (i >= HISTORY && !my.length) return;
    const tr = document.createElement("tr");
    const outcome = b.resolved ? `${MOODS[b.outcome].emoji} ${MOODS[b.outcome].name}` : `<button class="ghost settle" data-round="${r}">Settle</button>`;
    const mineHtml = my.map((x) => {
      const m = x.p.moodPlusOne - 1;
      const cls = !b.resolved ? "" : m === b.outcome ? "win" : "lose";
      return `<span class="${cls}">#${x.id}${MOODS[m].emoji}</span>`;
    }).join(" ");
    tr.innerHTML = `<td>#${r}</td><td>${b.resolved ? b.work : "?"}</td><td>${outcome}</td><td>${b.total}</td><td>${mineHtml}</td>`;
    tb.append(tr);
  });
  tb.querySelectorAll(".settle").forEach((btn) => {
    btn.disabled = !state.account;
    btn.title = state.account ? "Read this round's work from SqueekCore" : "Connect a wallet to settle";
    btn.onclick = async () => { if (await send("resolve", [BigInt(btn.dataset.round)], `Settle round #${btn.dataset.round}`)) refreshHistory(); };
  });
  state.pending = pending;
  $("scoreAll").disabled = !(state.account && pending.length);
  $("scoreAll").textContent = pending.length ? `Score my pending calls (${pending.length} round${pending.length > 1 ? "s" : ""})` : "No pending calls";
}

async function scoreAll() {
  // One transaction per round; each resolves the round first if nobody has.
  for (const { round, ids } of state.pending ?? []) {
    if (!(await send("score", [round, ids], `Score round #${round}`))) break;
  }
  refreshHistory(); refreshBoard();
}

async function refreshBoard() {
  const [ids] = await read("leaderboard");
  const el = $("board");
  if (!ids.length) { el.textContent = "No points yet — be the first seer on the board."; return; }
  el.innerHTML = ""; el.classList.remove("muted");
  const uris = await Promise.all(ids.map((id) => read("badgeURI", [id])));
  uris.forEach((u) => {
    try {
      const json = JSON.parse(atob(u.split(",")[1]));
      // Only ever render the badge as an <img>, never inline its SVG.
      if (typeof json.image === "string" && json.image.startsWith("data:image/svg+xml;base64,")) {
        const img = new Image(); img.src = json.image; img.alt = json.name; el.append(img);
      }
    } catch { /* skip malformed */ }
  });
}

async function refreshChain() {
  const [settled] = await Promise.all([
    pub.readContract({ address: await read("core"), abi: [{ type: "function", name: "state", stateMutability: "view", inputs: [], outputs: [{ type: "tuple", components: [{ name: "settledThroughRound", type: "uint64" }, { name: "cumulativeWork", type: "uint64" }, { name: "cumulativeBlockUnits", type: "uint96" }, { name: "blockHeight", type: "uint64" }, { name: "blockProgress", type: "uint96" }, { name: "workPerThousandBlocks", type: "uint32" }, { name: "authorizationNonce", type: "uint256" }, { name: "paused", type: "bool" }] }] }], functionName: "state" }).then((s) => s.settledThroughRound),
  ]);
  const changed = settled !== state.settled;
  state.settled = settled;
  $("settled").textContent = settled.toString();
  if (changed) { refreshHistory(); refreshBoard(); }
}

// ---------- boot ----------
async function boot() {
  pollLive(); setInterval(pollLive, 5000);
  if (!game) {
    setStatus("Game contract not configured. Set GAME_ADDRESS in web/config.js or open with ?game=0x…", "lose");
    $("connect").disabled = true;
    return;
  }
  $("gameLink").innerHTML = `Contract <a target="_blank" rel="noopener" href="${EXPLORER}/address/${game}">${game.slice(0, 10)}…</a>`;
  [state.genesis, state.duration] = await Promise.all([read("genesisTimestamp"), read("roundDuration")]);
  state.current = nowRound(); state.target = state.current + 1n;
  renderTabs(); tickCountdown(); setInterval(tickCountdown, 1000);
  await refreshChain(); setInterval(refreshChain, 30000);
  refreshRound(); setInterval(refreshRound, 20000);
  $("connect").onclick = connect;
  $("predict").onclick = predict;
  $("scoreAll").onclick = scoreAll;
  $("addId").onclick = () => { const v = $("manualId").value; if (v) addSqueek(BigInt(v)); $("manualId").value = ""; };
}
boot().catch((e) => setStatus(esc(e.shortMessage ?? e.message), "lose"));
