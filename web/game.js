import {
  W, H, FLOORS, MAX_TAPE, ACT, MOOD, MOOD_INFO, ENEMY, ITEM, START_X, START_Y,
  newRun, step, isOver, score, playerStats,
} from "./engine.js";
import { TILE, loadAtlas, recolor, rampFromSvg, drawFrame } from "./sprites.js";
import { sfx, toggleMute, isMuted } from "./audio.js";
import * as chain from "./chain.js";
import { EXPLORER } from "./config.js";

// ------------------------------------------------------------------ setup

const SCALE = 3;
const HUD = 16; // low-res pixels above the world
const LO_W = W * TILE;
const LO_H = H * TILE + HUD;
const DEMO_SEED = 0x5eed2026;

const $ = (id) => document.getElementById(id);
const screen = $("screen");
const g = screen.getContext("2d");
const lo = document.createElement("canvas");
lo.width = LO_W; lo.height = LO_H;
const l = lo.getContext("2d");
g.imageSmoothingEnabled = false;
l.imageSmoothingEnabled = false;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const txLink = (h) => `<a target="_blank" rel="noopener" href="${EXPLORER}/tx/${h}">${h.slice(0, 10)}…</a>`;
const hexTape = (tape) => `0x${tape.map((b) => b.toString(16).padStart(2, "0")).join("")}`;
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const hash2 = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

const app = {
  atlas: null, hero: null, titleImg: null,
  mode: "title", // title | play | end | replay
  run: null, practice: true,
  ex: null, exId: null, exOpen: false,
  nft: null,
  squeeks: new Map(), // id -> { level, ok, art, ramp, attempts }
  token: null,
  // presentation
  heroPos: { x: START_X * TILE, y: START_Y * TILE }, lunge: { x: 0, y: 0 }, facingLeft: false,
  enemyPos: [], enemyFlash: [], explored: new Uint8Array(W * H),
  fx: [], texts: [], shake: 0, flash: 0, fade: 0, banner: null,
  lastInput: 0, queued: null, replay: null,
};

// ------------------------------------------------------------- rendering

function visRadius() { return app.run?.mood === MOOD.SNOOZE ? 3.2 : 4.6; }

function resetPresentation() {
  const s = app.run;
  app.heroPos = { x: s.px * TILE, y: s.py * TILE };
  app.enemyPos = s.enemies.map((e) => ({ x: e.x * TILE, y: e.y * TILE }));
  app.enemyFlash = s.enemies.map(() => 0);
  app.explored = new Uint8Array(W * H);
  updateExplored();
}

function updateExplored() {
  const s = app.run;
  const r = visRadius();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x - s.px) ** 2 + (y - s.py) ** 2 <= r * r) app.explored[y * W + x] = 1;
  }
}

function tileName(s, x, y) {
  const open = (cx, cy) => cx >= 0 && cy >= 0 && cx < W && cy < H && s.open[cy * W + cx];
  if (open(x, y)) {
    if (x === s.stairs.x && y === s.stairs.y) return s.floor === FLOORS ? null : "stairs";
    const h = hash2(x + s.floor * 31, y) % 10;
    return `floor_${h < 6 ? 0 : h - 6}`;
  }
  return open(x, y + 1) ? `wall_face_${hash2(x, y + s.floor) % 2}` : "wall_top";
}

function drawWorld(t) {
  const s = app.run;
  const A = app.atlas;
  l.fillStyle = "#0b0a0f";
  l.fillRect(0, 0, LO_W, LO_H);
  const frame = Math.floor(t / 420) % 2;
  const r = visRadius();
  const oy = HUD;

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!app.explored[y * W + x]) continue;
    const name = tileName(s, x, y);
    if (name) drawFrame(l, A, name, x * TILE, oy + y * TILE);
    else {
      drawFrame(l, A, "floor_0", x * TILE, oy + y * TILE);
      drawFrame(l, A, `exit_${frame}`, x * TILE, oy + y * TILE);
    }
  }
  const visible = (x, y) => (x - s.px) ** 2 + (y - s.py) ** 2 <= r * r;

  for (const it of s.items) {
    if (it.taken || !visible(it.x, it.y)) continue;
    const bob = Math.round(Math.sin(t / 260 + it.x) * 1);
    drawFrame(l, A, it.kind === ITEM.SEED ? "seed" : "cheese", it.x * TILE, oy + it.y * TILE + bob);
  }
  s.enemies.forEach((e, i) => {
    const p = app.enemyPos[i];
    if (!e.alive || !p || !visible(e.x, e.y)) return;
    const flash = app.enemyFlash[i] > 0 && Math.floor(t / 60) % 2 === 0;
    const flip = p.x > app.heroPos.x;
    drawFrame(l, A, `${ENEMY[e.type].name}_${frame}`, p.x, oy + p.y, { flip, alpha: flash ? 0.35 : 1 });
    if (e.hp < ENEMY[e.type].hp) {
      l.fillStyle = "#2a0f14"; l.fillRect(p.x + 3, oy + p.y - 2, 10, 2);
      l.fillStyle = "#ff5a6a"; l.fillRect(p.x + 3, oy + p.y - 2, Math.ceil(10 * e.hp / ENEMY[e.type].hp), 2);
    }
  });

  if (app.mode === "end" && s.dead) {
    drawFrame(l, A, "grave", app.heroPos.x, oy + app.heroPos.y);
  } else {
    const hname = `hero_${frame}`;
    drawFrame(l, A, hname, app.heroPos.x + app.lunge.x, oy + app.heroPos.y + app.lunge.y,
      { flip: app.facingLeft, src: app.hero?.[hname] });
  }

  for (const f of app.fx) {
    const name = f.kind === "hit" ? `hit_${Math.min(2, Math.floor(f.t / 70))}` : `sparkle_${Math.floor(f.t / 90) % 2}`;
    drawFrame(l, A, name, f.x, oy + f.y - (f.kind === "sparkle" ? f.t / 30 : 0));
  }

  // Torch light: a soft radial falloff around the delver, plus memory fog on explored tiles.
  const cx = app.heroPos.x + 8;
  const cy = oy + app.heroPos.y + 8;
  const flick = Math.sin(t / 90) * 1.5 + Math.sin(t / 37) * 0.8;
  const rad = r * TILE + flick;
  const grd = l.createRadialGradient(cx, cy, rad * 0.25, cx, cy, rad + 10);
  grd.addColorStop(0, "rgba(255,190,90,0.07)");
  grd.addColorStop(0.7, "rgba(10,8,14,0.15)");
  grd.addColorStop(1, "rgba(10,8,14,0.78)");
  l.fillStyle = grd;
  l.fillRect(0, oy, LO_W, LO_H - oy);
  l.fillStyle = "#0b0a0f";
  l.fillRect(0, 0, LO_W, HUD);
}

function drawHud() {
  const s = app.run;
  const A = app.atlas;
  // Icons are drawn on the low-res layer so they scale crisply with the world.
  const hearts = Math.ceil(s.maxHp / 2);
  for (let i = 0; i < hearts; i++) {
    const v = s.hp - i * 2;
    const n = v >= 2 ? "heart_full" : v === 1 ? "heart_half" : "heart_empty";
    drawFrame(l, A, n, 4 + i * 9 - (i >= 7 ? 7 * 9 : 0), i >= 7 ? 8 : 0 + 4 - (hearts > 7 ? 3 : 0));
  }
  drawFrame(l, A, "icon_sword", 72, 4);
  drawFrame(l, A, "icon_seed", 104, 4);
  drawFrame(l, A, "icon_floor", 148, 4);
  drawFrame(l, A, "icon_skull", 182, 4);
}

function hudText() {
  const s = app.run;
  g.font = '15px "Press Start 2P", monospace';
  g.textBaseline = "top";
  g.fillStyle = "#f3e6c8";
  g.fillText(`${s.atk}`, 84 * SCALE, 4 * SCALE);
  g.fillStyle = "#F5C451";
  g.fillText(`${s.gold}`, 116 * SCALE, 4 * SCALE);
  g.fillStyle = "#f3e6c8";
  g.fillText(`B${s.floor}`, 160 * SCALE, 4 * SCALE);
  g.fillText(`${s.kills}`, 194 * SCALE, 4 * SCALE);
  g.fillStyle = s.tape.length > MAX_TAPE - 60 ? "#ff7a7a" : "#8f86a3";
  g.font = '10px "Press Start 2P", monospace';
  g.fillText(`${s.tape.length}/${MAX_TAPE}`, 206 * SCALE, 5 * SCALE);
}

function drawTexts() {
  g.font = '12px "Press Start 2P", monospace';
  g.textAlign = "center";
  for (const tx of app.texts) {
    const a = Math.max(0, 1 - tx.t / 900);
    g.globalAlpha = a;
    const x = (tx.x + 8) * SCALE;
    const y = (HUD + tx.y - tx.t / 40) * SCALE;
    g.fillStyle = "#000";
    g.fillText(tx.text, x + 2, y + 2);
    g.fillStyle = tx.color;
    g.fillText(tx.text, x, y);
  }
  g.globalAlpha = 1;
  g.textAlign = "left";
}

function drawBanner() {
  if (!app.banner) return;
  const a = Math.min(1, app.banner.t < 300 ? app.banner.t / 300 : (app.banner.life - app.banner.t) / 300);
  g.globalAlpha = Math.max(0, a);
  g.fillStyle = "rgba(11,10,15,0.75)";
  g.fillRect(0, 230, screen.width, 90);
  g.textAlign = "center";
  g.fillStyle = "#F5C451";
  g.font = '28px "Press Start 2P", monospace';
  g.fillText(app.banner.text, screen.width / 2, 246);
  g.fillStyle = "#f3e6c8";
  g.font = '12px "Press Start 2P", monospace';
  g.fillText(app.banner.sub ?? "", screen.width / 2, 290);
  g.textAlign = "left";
  g.globalAlpha = 1;
}

function drawTitle(t) {
  l.fillStyle = "#0b0a0f";
  l.fillRect(0, 0, LO_W, LO_H);
  if (app.titleImg) l.drawImage(app.titleImg, 0, 40);
  // Little parade of the burrow's residents.
  const frame = Math.floor(t / 420) % 2;
  const names = ["hero", "beetle", "snake", "cat"];
  names.forEach((n, i) => {
    const x = 52 + i * 36;
    const y = 150 + Math.round(Math.sin(t / 300 + i) * 1.5);
    drawFrame(l, app.atlas, `${n}_${frame}`, x, y, { src: n === "hero" ? app.hero?.[`hero_${frame}`] : null });
  });
  g.drawImage(lo, 0, 0, screen.width, screen.height);
  g.textAlign = "center";
  g.font = '40px "Press Start 2P", monospace';
  g.fillStyle = "#3a2a14";
  g.fillText("SQUEEK DELVE", screen.width / 2 + 4, 44);
  g.fillStyle = "#F5C451";
  g.fillText("SQUEEK DELVE", screen.width / 2, 40);
  g.font = '11px "Press Start 2P", monospace';
  g.fillStyle = "#f3e6c8";
  g.fillText("A holder-only roguelike. Verified onchain.", screen.width / 2, 100);
  if (Math.floor(t / 600) % 2 === 0) {
    g.fillStyle = "#F5C451";
    g.fillText(app.token ? `PRESS ENTER TO DELVE WITH SQUEEK #${app.token}` : "PRESS ENTER FOR A PRACTICE RUN", screen.width / 2, 540);
  }
  g.textAlign = "left";
}

let last = performance.now();
function frame(t) {
  const dt = Math.min(50, t - last);
  last = t;
  if (app.mode === "title" || !app.run) {
    drawTitle(t);
    requestAnimationFrame(frame);
    return;
  }
  const k = Math.min(1, dt * 0.018);
  app.heroPos.x += (app.run.px * TILE - app.heroPos.x) * k;
  app.heroPos.y += (app.run.py * TILE - app.heroPos.y) * k;
  app.lunge.x *= 0.75; app.lunge.y *= 0.75;
  app.run.enemies.forEach((e, i) => {
    const p = app.enemyPos[i];
    if (!p) return;
    p.x += (e.x * TILE - p.x) * k;
    p.y += (e.y * TILE - p.y) * k;
    app.enemyFlash[i] = Math.max(0, app.enemyFlash[i] - dt);
  });
  app.fx = app.fx.filter((f) => (f.t += dt) < (f.kind === "hit" ? 210 : 500));
  app.texts = app.texts.filter((x) => (x.t += dt) < 900);
  if (app.banner && (app.banner.t += dt) > app.banner.life) app.banner = null;
  app.shake = Math.max(0, app.shake - dt);
  app.flash = Math.max(0, app.flash - dt);
  app.fade = Math.max(0, app.fade - dt);

  drawWorld(t);
  drawHud();
  const sx = app.shake ? (Math.random() - 0.5) * app.shake / 25 : 0;
  const sy = app.shake ? (Math.random() - 0.5) * app.shake / 25 : 0;
  g.fillStyle = "#0b0a0f";
  g.fillRect(0, 0, screen.width, screen.height);
  g.drawImage(lo, 0, 0, LO_W, HUD, 0, 0, LO_W * SCALE, HUD * SCALE);
  g.drawImage(lo, 0, HUD, LO_W, LO_H - HUD, Math.round(sx), HUD * SCALE + Math.round(sy), LO_W * SCALE, (LO_H - HUD) * SCALE);
  hudText();
  drawTexts();
  if (app.flash) { g.fillStyle = `rgba(200,30,40,${app.flash / 600})`; g.fillRect(0, 0, screen.width, screen.height); }
  if (app.fade) { g.fillStyle = `rgba(11,10,15,${Math.min(1, app.fade / 300)})`; g.fillRect(0, 0, screen.width, screen.height); }
  drawBanner();
  if (app.mode === "replay") {
    g.fillStyle = "rgba(11,10,15,0.7)"; g.fillRect(0, screen.height - 34, screen.width, 34);
    g.font = '11px "Press Start 2P", monospace'; g.fillStyle = "#F5C451";
    g.fillText(`REPLAY · SQUEEK #${app.replay.tokenId} · L${app.replay.level} · ESC TO EXIT`, 12, screen.height - 22);
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ play

function applyEvents(ev) {
  const s = app.run;
  for (const e of ev) {
    switch (e.t) {
      case "face": if (e.dir === 1) app.facingLeft = false; if (e.dir === 3) app.facingLeft = true; break;
      case "move": sfx("step"); break;
      case "bump": sfx("bump"); break;
      case "attack":
        sfx("attack");
        app.lunge = { x: (e.x - s.px) * 6, y: (e.y - s.py) * 6 };
        app.fx.push({ kind: "hit", x: e.x * TILE, y: e.y * TILE, t: 0 });
        app.enemyFlash[e.i] = 300;
        app.texts.push({ text: `-${e.dmg}`, x: e.x * TILE, y: e.y * TILE, color: "#ffffff", t: 0 });
        break;
      case "kill":
        sfx("kill");
        app.texts.push({ text: `+${e.value}`, x: e.x * TILE, y: e.y * TILE - 8, color: "#9be27a", t: 0 });
        break;
      case "seed":
        sfx("seed");
        app.fx.push({ kind: "sparkle", x: e.x * TILE, y: e.y * TILE, t: 0 });
        app.texts.push({ text: `+${e.value}`, x: e.x * TILE, y: e.y * TILE, color: "#F5C451", t: 0 });
        break;
      case "heal":
        sfx("heal");
        app.texts.push({ text: `+${e.value}HP`, x: e.x * TILE, y: e.y * TILE, color: "#ff9db0", t: 0 });
        break;
      case "hurt":
        sfx("hurt");
        app.shake = 220; app.flash = 260;
        app.fx.push({ kind: "hit", x: s.px * TILE, y: s.py * TILE, t: 0 });
        app.texts.push({ text: `-${e.dmg}`, x: s.px * TILE, y: s.py * TILE, color: "#ff5a6a", t: 0 });
        break;
      case "descend":
        sfx("descend");
        app.fade = 450;
        resetPresentation();
        app.banner = { text: `FLOOR ${e.floor}`, sub: e.floor === FLOORS ? "The golden wheel waits below…" : "Deeper into the burrow", t: 0, life: 1500 };
        break;
      case "win": sfx("win"); break;
      case "die": sfx("die"); app.shake = 400; break;
      case "flee": sfx("flee"); break;
      default: break;
    }
  }
  updateExplored();
}

function doAction(a) {
  if (!app.run || isOver(app.run)) return;
  const ev = step(app.run, a);
  applyEvents(ev);
  if (isOver(app.run)) setTimeout(() => endRun(), app.mode === "replay" ? 1200 : 700);
}

function startRun() {
  const seed = app.ex ? app.ex.seed : DEMO_SEED;
  const mood = app.ex ? app.ex.mood : MOOD.POTTER;
  const sq = app.token ? app.squeeks.get(app.token) : null;
  const level = sq?.level ?? 1;
  app.practice = !(sq?.ok && app.exOpen);
  app.run = newRun(seed, level, mood);
  app.mode = "play";
  app.facingLeft = false;
  resetPresentation();
  hideOverlay();
  const mi = MOOD_INFO[mood];
  app.banner = { text: "FLOOR 1", sub: `${mi.name.toUpperCase()} BURROW${app.practice ? " · PRACTICE" : ""}`, t: 0, life: 1700 };
  sfx("descend");
  screen.focus();
}

// ---------------------------------------------------------------- input

const KEYS = {
  ArrowUp: ACT.UP, KeyW: ACT.UP, ArrowRight: ACT.RIGHT, KeyD: ACT.RIGHT,
  ArrowDown: ACT.DOWN, KeyS: ACT.DOWN, ArrowLeft: ACT.LEFT, KeyA: ACT.LEFT,
  Space: ACT.WAIT, Period: ACT.WAIT, KeyQ: ACT.FLEE,
};

function input(a) {
  if (app.mode !== "play") return;
  if (a === ACT.FLEE && !confirm("Leave the burrow now and keep all your seeds?")) return;
  const now = performance.now();
  if (now - app.lastInput < 105) { app.queued = a; return; }
  app.lastInput = now;
  doAction(a);
}
setInterval(() => {
  if (app.queued !== null && performance.now() - app.lastInput >= 105) {
    const a = app.queued; app.queued = null; app.lastInput = performance.now(); doAction(a);
  }
}, 20);

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (app.mode === "title" && e.code === "Enter") { e.preventDefault(); startRun(); return; }
  if (app.mode === "replay" && e.code === "Escape") { stopReplay(); return; }
  const a = KEYS[e.code];
  if (a !== undefined && app.mode === "play") { e.preventDefault(); input(a); }
});
document.querySelectorAll("[data-act]").forEach((b) => {
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); input(Number(b.dataset.act)); });
});

// -------------------------------------------------------------- overlays

function showOverlay(html) { $("overlay").innerHTML = html; $("overlay").classList.remove("hidden"); }
function hideOverlay() { $("overlay").classList.add("hidden"); }

function endRun() {
  if (app.mode === "replay") { stopReplay(); return; }
  app.mode = "end";
  const s = app.run;
  const sc = score(s);
  const title = s.won ? "VICTORY!" : s.dead ? "YOU FELL" : "ESCAPED";
  const sub = s.won ? "You reached the golden wheel." : s.dead ? "Half your seeds were lost in the dark." : "You climbed out with every seed.";
  const sq = app.token ? app.squeeks.get(app.token) : null;
  const left = sq ? 3 - (sq.attempts ?? 0) : 0;
  if (!app.practice) saveLocalBest(s, sc);
  showOverlay(`
    <div class="modal">
      <h2 class="${s.won ? "gold" : s.dead ? "red" : ""}">${title}</h2>
      <p class="muted">${sub}</p>
      <div class="stats">
        <div><span>SCORE</span><b class="gold">${sc}</b></div>
        <div><span>FLOOR</span><b>${s.floor}/${FLOORS}</b></div>
        <div><span>SEEDS</span><b>${s.gold}</b></div>
        <div><span>KILLS</span><b>${s.kills}</b></div>
        <div><span>TURNS</span><b>${s.turn}</b></div>
      </div>
      ${app.practice ? `<p class="muted small">Practice run: ${chain.gameAddress ? (app.exOpen ? "pick one of your Squeeks to submit runs." : "no open expedition right now.") : "game contract not configured."}</p>` : `
        <div class="row">
          <button class="px-btn" id="verifyBtn">VERIFY ONCHAIN</button>
          <button class="px-btn gold" id="submitBtn" ${left <= 0 ? "disabled" : ""}>SUBMIT RUN (${left}/3 LEFT)</button>
        </div>
        <div id="runStatus" class="small"></div>`}
      <div class="row">
        <button class="px-btn" id="againBtn">DELVE AGAIN</button>
        <button class="px-btn" id="menuBtn">MENU</button>
      </div>
    </div>`);
  $("againBtn").onclick = () => { sfx("ui"); startRun(); };
  $("menuBtn").onclick = () => { sfx("ui"); app.mode = "title"; app.run = null; hideOverlay(); };
  if (!app.practice) {
    $("verifyBtn").onclick = () => verifyRun(s, sc);
    $("submitBtn").onclick = () => submitRun(s);
  }
}

async function verifyRun(s, sc) {
  const st = $("runStatus");
  st.textContent = "Replaying your run inside the contract…";
  try {
    const r = await chain.read("simulate", [app.ex.seed, s.level, s.mood, hexTape(s.tape)]);
    const ok = Number(r.score) === sc;
    st.innerHTML = ok
      ? `<span class="good">✔ Contract replay agrees: ${r.score} points, floor ${r.floor}, ${r.kills} kills.</span>`
      : `<span class="red">✘ Contract says ${r.score}; the game says ${sc}. Please report this.</span>`;
  } catch (e) { st.innerHTML = `<span class="red">${esc(e.shortMessage ?? e.message)}</span>`; }
}

async function submitRun(s) {
  const st = $("runStatus");
  try {
    const { hash } = await chain.write("submitRun", [app.token, hexTape(s.tape)], (m, h) => {
      st.innerHTML = h ? `${esc(m)} ${txLink(h)}` : esc(m);
    });
    st.innerHTML = `<span class="good">✔ Run recorded onchain ${txLink(hash)}</span>`;
    $("submitBtn").disabled = true;
    await refreshSqueek(app.token);
    await refreshBoard();
  } catch (e) { st.innerHTML = `<span class="red">${esc(e.shortMessage ?? e.message)}</span>`; }
}

// Best practice run per expedition and Squeek, so a player can submit their best later.
const bestKey = () => `delve.best.${chain.gameAddress}.${app.exId}.${app.token}`;
function saveLocalBest(s, sc) {
  const prev = JSON.parse(localStorage.getItem(bestKey()) ?? "null");
  if (!prev || sc > prev.score) localStorage.setItem(bestKey(), JSON.stringify({ score: sc, tape: s.tape, level: s.level }));
  renderDelver();
}

// ---------------------------------------------------------------- replay

async function startReplay(tokenId) {
  if (app.mode === "play" && app.run && !isOver(app.run) && !confirm("Abandon your current run to watch a replay?")) return;
  try {
    setPanelStatus(`Loading replay for #${tokenId}…`);
    const best = await chain.bestTape(BigInt(app.exId), tokenId);
    if (!best) throw new Error("No run found in the logs.");
    const tape = Array.from(Buffer_from(best.tape));
    app.run = newRun(app.ex.seed, best.level, app.ex.mood);
    app.mode = "replay";
    app.replay = { tokenId, level: best.level, tape, i: 0 };
    hideOverlay();
    resetPresentation();
    setPanelStatus("");
    app.replay.timer = setInterval(() => {
      if (!app.replay || app.replay.i >= tape.length || isOver(app.run)) {
        clearInterval(app.replay?.timer);
        if (app.run && !isOver(app.run)) setTimeout(stopReplay, 1200);
        return;
      }
      doAction(tape[app.replay.i++]);
    }, 170);
  } catch (e) { setPanelStatus(esc(e.shortMessage ?? e.message), true); }
}
function stopReplay() {
  clearInterval(app.replay?.timer);
  app.replay = null;
  app.mode = "title";
  app.run = null;
}
function Buffer_from(hex) {
  const h = hex.slice(2);
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// ------------------------------------------------------------ side panels

function setPanelStatus(html, bad = false) { $("panelStatus").innerHTML = html ? `<span class="${bad ? "red" : ""}">${html}</span>` : ""; }

async function refreshExpedition() {
  if (!chain.gameAddress) {
    $("expBody").innerHTML = `<p class="muted small">Game contract not configured. Practice runs use a demo burrow.</p>`;
    $("expTitle").textContent = "EXPEDITION";
    return;
  }
  const [exists, open, id, ex] = await chain.read("current");
  app.exOpen = open;
  if (exists) { app.ex = ex; app.exId = id; } else { app.ex = null; app.exId = null; }
  renderExpedition();
}

function renderExpedition() {
  const ex = app.ex;
  $("expTitle").textContent = ex ? `EXPEDITION #${app.exId}` : "EXPEDITION";
  if (!ex) {
    $("expBody").innerHTML = `<p class="muted small">No expedition yet. Anyone can open the first one.</p>${openBtn()}`;
  } else {
    const mi = MOOD_INFO[ex.mood];
    const left = Number(ex.endsAt) - Date.now() / 1000;
    $("expBody").innerHTML = `
      <div class="mood"><span class="emoji">${mi.emoji}</span><div><b>${mi.name.toUpperCase()} BURROW</b><div class="small muted">${mi.text}</div></div></div>
      <div class="kv"><span>Hamster work</span><b>${ex.work} in rounds ${Number(ex.seedRound) - 6}–${ex.seedRound}</b></div>
      <div class="kv"><span>Runs submitted</span><b>${ex.runs}</b></div>
      <div class="kv"><span>${app.exOpen ? "Closes in" : "Status"}</span><b id="exClock">${app.exOpen ? mmss(left) : "ended"}</b></div>
      ${app.exOpen ? "" : openBtn()}`;
  }
  const b = $("openExp");
  if (b) b.onclick = openExpedition;
}

const openBtn = () => `<button id="openExp" class="px-btn gold wide" ${chain.account ? "" : "disabled"}>${chain.account ? "OPEN NEXT EXPEDITION" : "CONNECT TO OPEN"}</button>`;

async function openExpedition() {
  try {
    await chain.write("openExpedition", [], (m) => setPanelStatus(esc(m)));
    setPanelStatus("Expedition opened! The burrow has shifted.");
    await refreshExpedition();
    await Promise.all([...app.squeeks.keys()].map(refreshSqueek));
    await refreshBoard();
  } catch (e) { setPanelStatus(esc(e.shortMessage ?? e.message), true); }
}

async function refreshBoard() {
  const el = $("board");
  if (!chain.gameAddress || app.exId === null) { el.innerHTML = `<p class="muted small">No runs yet.</p>`; return; }
  const [ids, bests] = await chain.read("leaderboard", [app.exId]);
  if (!ids.length) { el.innerHTML = `<p class="muted small">No runs yet. The first delver sets the bar.</p>`; return; }
  el.innerHTML = ids.map((id, i) => {
    const b = bests[i];
    const mark = b.won ? "🏆" : `B${b.floor}`;
    return `<div class="brow ${app.token === id ? "me" : ""}"><span class="rank">${i + 1}</span><span>#${id} <i>L${b.level}</i></span><span>${mark}</span><b>${b.score}</b><button class="px-btn tiny" data-replay="${id}">▶</button></div>`;
  }).join("");
  el.querySelectorAll("[data-replay]").forEach((b) => { b.onclick = () => startReplay(BigInt(b.dataset.replay)); });
}

async function connect() {
  try {
    await chain.connectWallet();
    $("connect").textContent = short(chain.account);
    renderExpedition();
    setPanelStatus("Looking for your Squeeks…");
    const ids = await chain.suggestedSqueeks(chain.account);
    await Promise.all(ids.map((id) => addSqueek(id)));
    setPanelStatus(ids.length ? "" : "No Squeeks found. Add a token ID if you hold one.");
    const first = [...app.squeeks.entries()].find(([, s]) => s.ok);
    if (first) await selectSqueek(first[0]);
    renderDelver();
  } catch (e) { setPanelStatus(esc(e.shortMessage ?? e.message), true); }
}

async function addSqueek(id) {
  if (id < 1n || id > 9999n || app.squeeks.has(id)) return;
  const [ok, level] = await Promise.all([chain.read("canPlay", [chain.account, id]), chain.read("levelOf", [id])]);
  app.squeeks.set(id, { ok, level });
  await refreshSqueek(id);
}

async function refreshSqueek(id) {
  const sq = app.squeeks.get(id);
  if (!sq) return;
  const [rec, attempts] = await Promise.all([
    chain.read("record", [id]),
    app.exId !== null ? chain.read("attemptsUsed", [app.exId, id]) : 0,
  ]);
  Object.assign(sq, { rec, attempts: Number(attempts) });
  renderDelver();
}

async function selectSqueek(id) {
  const sq = app.squeeks.get(id);
  if (!sq?.ok) return;
  app.token = id;
  if (!sq.art && app.nft) {
    sq.art = await chain.squeekArt(app.nft, id);
    sq.ramp = sq.art ? rampFromSvg(sq.art.svg) : null;
  }
  app.hero = recolor(app.atlas, ["hero_0", "hero_1"], sq.ramp);
  renderDelver();
  refreshBoard();
}

function renderDelver() {
  const el = $("delver");
  if (!chain.account) {
    el.innerHTML = `<p class="muted small">Connect a wallet that holds a Squeek (in your wallet or staked). Your Squeek becomes your delver: its colors, its level, its record.</p>`;
    return;
  }
  const sq = app.token ? app.squeeks.get(app.token) : null;
  const chips = [...app.squeeks.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([id, s]) =>
    `<button class="chip ${app.token === id ? "on" : ""}" data-sq="${id}" ${s.ok ? "" : "disabled title=\"Not held by this wallet\""}>#${id} <i>L${s.level}</i></button>`).join("");
  let card = "";
  if (sq) {
    const st = playerStats(sq.level);
    const local = JSON.parse(localStorage.getItem(bestKey()) ?? "null");
    card = `
      <div class="delver">
        <div class="portrait">${sq.art ? `<img alt="Squeek #${app.token}" src="${sq.art.image}">` : ""}</div>
        <div>
          <b>SQUEEK #${app.token}</b>
          <div class="small">Level ${sq.level} · ${st.maxHp} HP · ${st.atk} ATK</div>
          <div class="small muted">Runs ${sq.rec?.runs ?? 0} · Wins ${sq.rec?.victories ?? 0} · Crowns ${sq.rec?.crowns ?? 0} · Best ${sq.rec?.bestScore ?? 0}</div>
          <div class="small ${app.exOpen ? "" : "muted"}">${app.exOpen ? `Submissions left: ${3 - (sq.attempts ?? 0)}/3` : "No open expedition"}</div>
        </div>
      </div>
      ${local && app.exOpen ? `<div class="kv small"><span>Best unsubmitted run</span><b>${local.score} <button class="px-btn tiny" id="submitLocal">SUBMIT</button></b></div>` : ""}`;
  }
  el.innerHTML = `${card}<div class="chips">${chips}</div>
    <div class="row"><input id="manualId" type="number" min="1" max="9999" placeholder="Token ID"><button class="px-btn tiny" id="addId">ADD</button></div>`;
  el.querySelectorAll("[data-sq]").forEach((b) => { b.onclick = () => { sfx("ui"); selectSqueek(BigInt(b.dataset.sq)); }; });
  $("addId").onclick = async () => { const v = $("manualId").value; if (v) { await addSqueek(BigInt(v)); renderDelver(); } };
  const sl = $("submitLocal");
  if (sl) sl.onclick = submitLocalBest;
}

async function submitLocalBest() {
  const local = JSON.parse(localStorage.getItem(bestKey()) ?? "null");
  if (!local) return;
  try {
    const { hash } = await chain.write("submitRun", [app.token, hexTape(local.tape)], (m) => setPanelStatus(esc(m)));
    setPanelStatus(`✔ Best run recorded ${txLink(hash)}`);
    localStorage.removeItem(bestKey());
    await refreshSqueek(app.token);
    await refreshBoard();
  } catch (e) { setPanelStatus(esc(e.shortMessage ?? e.message), true); }
}

async function pollWheel() {
  const w = await chain.liveWheel();
  $("wheel").textContent = !w.known ? "wheel: unknown" : w.spinning ? `wheel: running ${w.rpm.toFixed(1)} rpm` : "wheel: hamster resting";
}

// ------------------------------------------------------------------ boot

async function boot() {
  $("connect").onclick = connect;
  $("mute").textContent = isMuted() ? "♪ OFF" : "♪ ON";
  $("mute").onclick = () => { $("mute").textContent = toggleMute() ? "♪ OFF" : "♪ ON"; };
  $("startBtn").onclick = () => { sfx("ui"); startRun(); };
  await document.fonts.load('12px "Press Start 2P"').catch(() => {});
  app.atlas = await loadAtlas();
  app.titleImg = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = "./assets/title.png"; });
  app.hero = recolor(app.atlas, ["hero_0", "hero_1"], null);
  requestAnimationFrame(frame);
  renderDelver();
  pollWheel(); setInterval(pollWheel, 6000);
  if (chain.gameAddress) {
    $("gameLink").innerHTML = `Contract <a target="_blank" rel="noopener" href="${EXPLORER}/address/${chain.gameAddress}">${short(chain.gameAddress)}</a>`;
    app.nft = await chain.read("nft");
  }
  await refreshExpedition();
  await refreshBoard();
  setInterval(() => {
    const c = $("exClock");
    if (c && app.ex && app.exOpen) {
      const left = Number(app.ex.endsAt) - Date.now() / 1000;
      if (left <= 0) refreshExpedition(); else c.textContent = mmss(left);
    }
  }, 1000);
  setInterval(() => { refreshExpedition().then(refreshBoard).catch(() => {}); }, 30000);
}
boot().catch((e) => setPanelStatus(esc(e.shortMessage ?? e.message), true));
