import {
  createPublicClient, createWalletClient, custom, http, getAddress, isAddress,
} from "https://esm.sh/viem@2.21.0";
import { sepolia } from "https://esm.sh/viem@2.21.0/chains";
import { GAME_ABI } from "./abi.js";
import { GAME_ADDRESS, RPC_URL, API_BASE, EXPLORER } from "./config.js";

const REIGNS_SHOWN = 15;
const params = new URLSearchParams(location.search);
const qsGame = params.get("game");
const game = isAddress(qsGame ?? "") ? getAddress(qsGame) : (isAddress(GAME_ADDRESS) ? getAddress(GAME_ADDRESS) : null);
// ?rpc= is for local testing against an anvil fork.
const pub = createPublicClient({ chain: sepolia, transport: http(params.get("rpc") || RPC_URL), batch: { multicall: true } });
const read = (functionName, args = []) => pub.readContract({ address: game, abi: GAME_ABI, functionName, args });
const CORE_STATE_ABI = [{
  type: "function", name: "state", stateMutability: "view", inputs: [],
  outputs: [{ type: "tuple", components: [
    { name: "settledThroughRound", type: "uint64" }, { name: "cumulativeWork", type: "uint64" },
    { name: "cumulativeBlockUnits", type: "uint96" }, { name: "blockHeight", type: "uint64" },
    { name: "blockProgress", type: "uint96" }, { name: "workPerThousandBlocks", type: "uint32" },
    { name: "authorizationNonce", type: "uint256" }, { name: "paused", type: "bool" }] }],
}];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const txLink = (h) => `<a target="_blank" rel="noopener" href="${EXPLORER}/tx/${h}">${h.slice(0, 10)}…</a>`;
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const setStatus = (html, cls = "") => { $("txStatus").innerHTML = `<span class="${cls}">${html}</span>`; };

const state = {
  account: null, wallet: null, core: null,
  genesis: 0n, duration: 600n, settled: 0n,
  king: null, // { id, reign }
  squeeks: new Map(), // id -> { ok, restUntil }
  selected: null,
  creditable: [],
};

const nowSec = () => BigInt(Math.floor(Date.now() / 1000));
const nowRound = () => (nowSec() < state.genesis ? 0n : (nowSec() - state.genesis) / state.duration + 1n);
const roundStart = (r) => state.genesis + (r - 1n) * state.duration;

// Badges are only ever rendered as <img>, never as inline SVG markup.
function badgeImg(uri) {
  try {
    const json = JSON.parse(atob(uri.split(",")[1]));
    if (typeof json.image !== "string" || !json.image.startsWith("data:image/svg+xml;base64,")) return null;
    const img = new Image(); img.src = json.image; img.alt = String(json.name ?? "badge");
    return img;
  } catch { return null; }
}

// ---------- live wheel (API, display only) ----------
async function pollLive() {
  try {
    const s = await (await fetch(`${API_BASE}/v1/status`, { headers: { accept: "application/json" } })).json();
    const m = s.measurement ?? {};
    if (m.freshness !== "online") {
      $("liveStatus").textContent = "Unknown";
      $("liveRpm").textContent = `feed ${m.freshness ?? "unavailable"}`;
      return;
    }
    const spinning = m.coreStatus && m.coreStatus !== "IDLE";
    $("liveStatus").textContent = spinning ? "🏃 Running" : "💤 Idle";
    $("liveRpm").textContent = `${((m.rpmMilli ?? 0) / 1000).toFixed(1)} rpm · ${((m.speedMmPerSecond ?? 0) / 1000).toFixed(2)} m/s`;
  } catch { $("liveStatus").textContent = "Unknown"; $("liveRpm").textContent = "API unreachable"; }
}

// ---------- the hill ----------
function tick() {
  const cur = nowRound();
  $("curRound").textContent = cur.toString();
  $("countdown").textContent = mmss(Number(roundStart(cur + 1n) - nowSec()));
  const el = $("shield");
  if (!state.king) { el.className = "shield open"; el.textContent = "The Seed is unclaimed. Take it!"; return; }
  const until = state.king.reign.shieldUntilRound;
  if (cur >= until) {
    el.className = "shield open"; el.textContent = "🔓 Open: anyone can seize now";
  } else {
    el.className = "shield locked";
    el.textContent = `🛡️ Shielded until round ${until} (${mmss(Number(roundStart(until) - nowSec()))})`;
  }
  updateSeizeBtn();
}

async function refreshKing() {
  const n = await read("reignCount");
  if (n === 0n) { state.king = null; $("kingName").textContent = "Nobody yet"; $("kingMeta").textContent = ""; $("kingBadge").innerHTML = ""; return; }
  const id = n - 1n;
  const reign = await read("reign", [id]);
  state.king = { id, reign };
  const [s, uri] = await Promise.all([read("squeek", [reign.tokenId]), read("badgeURI", [reign.tokenId])]);
  $("kingName").textContent = `Squeek #${reign.tokenId}`;
  $("kingMeta").innerHTML = `Level ${reign.level} · held by ${short(reign.seizer)} · reigning since round ${reign.startRound}<br>`
    + `This reign: <b>${reign.work}</b> pts credited (through round ${reign.creditedThrough}) · lifetime ${s.points} pts`;
  const img = badgeImg(uri);
  $("kingBadge").replaceChildren(...(img ? [img] : []));
}

// ---------- wallet + squeeks ----------
async function connect() {
  if (!window.ethereum) { setStatus("No injected wallet found. Install MetaMask or Rabby.", "lose"); return; }
  const wallet = createWalletClient({ chain: sepolia, transport: custom(window.ethereum) });
  const [account] = await wallet.requestAddresses();
  try { await wallet.switchChain({ id: sepolia.id }); } catch {
    try { await wallet.addChain({ chain: sepolia }); } catch { /* declined */ }
  }
  state.wallet = wallet; state.account = getAddress(account);
  $("connect").textContent = short(account);
  window.ethereum.on?.("accountsChanged", () => location.reload());
  window.ethereum.on?.("chainChanged", () => location.reload());
  await loadSqueeks();
}

async function loadSqueeks() {
  // The API only suggests IDs; eligibility is always read from the contract.
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
  } catch { /* manual IDs still work */ }
  await Promise.all(ids.map((id) => addSqueek(id, false)));
  renderSqueeks();
}

async function addSqueek(id, render = true) {
  if (id < 1n || id > 9999n || state.squeeks.has(id)) return;
  const [ok, s] = await Promise.all([
    state.account ? read("canPlay", [state.account, id]) : false,
    read("squeek", [id]),
  ]);
  state.squeeks.set(id, { ok, restUntil: s.restUntilRound, points: s.points });
  if (render) renderSqueeks();
}

async function refreshSqueekStats() {
  const ids = [...state.squeeks.keys()];
  const stats = await Promise.all(ids.map((id) => read("squeek", [id])));
  ids.forEach((id, i) => Object.assign(state.squeeks.get(id), { restUntil: stats[i].restUntilRound, points: stats[i].points }));
  renderSqueeks();
}

function renderSqueeks() {
  const el = $("mySqueeks"); el.replaceChildren(); el.classList.remove("muted");
  if (!state.squeeks.size) { el.classList.add("muted"); el.textContent = "No Squeeks found for this wallet. Add an ID if you hold one."; }
  const cur = nowRound();
  const sorted = [...state.squeeks.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [id, s] of sorted) {
    const c = document.createElement("span");
    const isKing = state.king && state.king.reign.tokenId === id;
    const resting = cur < s.restUntil;
    const usable = s.ok && !resting && !isKing;
    c.className = `chip ${!usable ? "bad" : state.selected === id ? "on" : ""}`;
    const tag = !s.ok ? "not yours" : isKing ? "👑 king" : resting ? `resting → r${s.restUntil}` : `${s.points} pts`;
    c.innerHTML = `#${id}<span class="tag">${esc(tag)}</span>`;
    if (usable) c.onclick = () => { state.selected = state.selected === id ? null : id; renderSqueeks(); };
    el.append(c);
  }
  updateSeizeBtn();
}

function kingIsMine() {
  if (!state.king || !state.account) return false;
  if (state.king.reign.seizer === state.account) return true;
  const mine = state.squeeks.get(state.king.reign.tokenId);
  return Boolean(mine?.ok);
}

function updateSeizeBtn() {
  const b = $("seize");
  const shielded = state.king && nowRound() < state.king.reign.shieldUntilRound;
  let label = `Seize the Seed with #${state.selected}`;
  let ok = Boolean(game && state.account && state.selected);
  if (!state.account) { label = "Connect a wallet"; ok = false; }
  else if (kingIsMine()) { label = "You hold the Seed 👑"; ok = false; }
  else if (!state.selected) { label = "Pick a Squeek"; ok = false; }
  else if (shielded) { label = `Shielded until round ${state.king.reign.shieldUntilRound}`; ok = false; }
  b.textContent = label; b.disabled = !ok;
}

async function send(functionName, args, label) {
  try {
    setStatus(`Simulating ${esc(label)}…`);
    const { request } = await pub.simulateContract({ address: game, abi: GAME_ABI, functionName, args, account: state.account });
    setStatus("Confirm in your wallet…");
    const hash = await state.wallet.writeContract(request);
    setStatus(`Sent ${txLink(hash)} · waiting…`);
    const rc = await pub.waitForTransactionReceipt({ hash });
    const good = rc.status === "success";
    setStatus(good ? `✅ ${esc(label)} confirmed ${txLink(hash)}` : `Reverted ${txLink(hash)}`, good ? "win" : "lose");
    return good;
  } catch (e) {
    setStatus(esc(e.shortMessage ?? e.message), "lose");
    return false;
  }
}

async function seize() {
  const id = state.selected;
  if (await send("seize", [id], `Seize with #${id}`)) {
    state.selected = null;
    await refreshAll();
  }
}

// ---------- reigns + board ----------
async function refreshReigns() {
  const [ids, list] = await read("recentReigns", [BigInt(REIGNS_SHOWN)]);
  const flags = await Promise.all(ids.map((id) => read("creditable", [id])));
  state.creditable = ids.filter((_, i) => flags[i]);
  const tb = $("reigns"); tb.replaceChildren();
  list.forEach((r, i) => {
    const tr = document.createElement("tr");
    const end = r.endRound === 0n ? "now" : r.endRound.toString();
    const pending = r.endRound === 0n ? r.creditedThrough < nowRound() : r.creditedThrough < r.endRound;
    tr.innerHTML = `<td>${ids[i]}</td><td>#${r.tokenId} <span class="muted small">L${r.level}</span>${r.endRound === 0n ? " 👑" : ""}</td>`
      + `<td>${r.startRound}–${end}</td><td>${r.work}${pending ? '<span class="muted small"> +?</span>' : ""}</td><td></td>`;
    if (flags[i]) {
      const b = document.createElement("button");
      b.className = "ghost settle"; b.textContent = "Credit";
      b.disabled = !state.account;
      b.onclick = async () => { if (await send("credit", [ids[i]], `Credit reign ${ids[i]}`)) refreshAll(); };
      tr.lastChild.append(b);
    }
    tb.append(tr);
  });
  const btn = $("creditAll");
  btn.disabled = !(state.account && state.creditable.length);
  btn.textContent = state.creditable.length ? `Credit all certified work (${state.creditable.length})` : "Nothing to credit";
}

async function creditAll() {
  if (await send("creditMany", [state.creditable], "Credit reigns")) refreshAll();
}

async function refreshBoard() {
  const [ids] = await read("leaderboard");
  const el = $("board");
  if (!ids.length) { el.classList.add("muted"); el.textContent = "No points yet. The first king writes the first line."; return; }
  el.classList.remove("muted");
  const uris = await Promise.all(ids.map((id) => read("badgeURI", [id])));
  el.replaceChildren(...uris.map(badgeImg).filter(Boolean));
}

async function refreshSettled() {
  const s = await pub.readContract({ address: state.core, abi: CORE_STATE_ABI, functionName: "state" });
  state.settled = s.settledThroughRound;
  $("settled").textContent = state.settled.toString();
}

async function refreshAll() {
  await Promise.all([refreshSettled(), refreshKing()]);
  await Promise.all([refreshReigns(), refreshBoard(), refreshSqueekStats()]);
}

// ---------- boot ----------
async function boot() {
  pollLive(); setInterval(pollLive, 5000);
  if (!game) {
    setStatus("Game contract not configured. Set GAME_ADDRESS in web/config.js or open with ?game=0x…", "lose");
    $("connect").disabled = true;
    return;
  }
  $("gameLink").innerHTML = `Contract <a target="_blank" rel="noopener" href="${EXPLORER}/address/${game}">${short(game)}</a>`;
  [state.genesis, state.duration, state.core] = await Promise.all([read("genesisTimestamp"), read("roundDuration"), read("core")]);
  await refreshAll();
  tick(); setInterval(tick, 1000);
  setInterval(refreshAll, 30000);
  $("connect").onclick = connect;
  $("seize").onclick = seize;
  $("creditAll").onclick = creditAll;
  $("addId").onclick = () => { const v = $("manualId").value; if (v) addSqueek(BigInt(v)); $("manualId").value = ""; };
}
boot().catch((e) => setStatus(esc(e.shortMessage ?? e.message), "lose"));
