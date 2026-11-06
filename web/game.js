import {
  W, H, FLOORS, MAX_TAPE, ACT, MOOD, MOOD_INFO, ENEMY, ITEM, STYLE, WEAPONS, ARMORS, SLINGS, CAT,
  newRun, step, isOver, isOpen, score, playerStats, playerAtk, biomeOf, enemyMaxHp,
} from "./engine.js";
import { TILE, loadAtlas, recolor, rampFromSvg, drawFrame } from "./sprites.js";
import { sfx, toggleMute, isMuted } from "./audio.js";
import * as chain from "./chain.js";
import { EXPLORER } from "./config.js";

// ------------------------------------------------------------------ setup

const SCALE = 3;
const TOP = 16; // low-res HUD rows above and below the world
const BOTTOM = 16;
const LO_W = W * TILE;
const LO_H = H * TILE + TOP + BOTTOM;
const BIOMES = ["TOPSOIL", "ROOTCLAY", "CRYSTAL DEEP"];
const STYLES = ["CAVERN", "BURROW ROOMS", "WARREN"];
const SLOT_ICON = { weapon: "wpn_", armor: "arm_", sling: "sl_" };
const STEP_MS = 105;

const $ = (id) => document.getElementById(id);
const screen = $("screen");
screen.width = LO_W * SCALE;
screen.height = LO_H * SCALE;
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
const hexToBytes = (hex) => Array.from({ length: (hex.length - 2) / 2 }, (_, i) => parseInt(hex.slice(2 + i * 2, 4 + i * 2), 16));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const hash2 = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

const app = {
  atlas: null, hero: null, titleImg: null,
  mode: "title", // title | play | end | replay
  run: null, ranked: null, // ranked = { runId, seed, level, mood, tokenId, exId }
  ex: null, exId: null, exOpen: false,
  nft: null,
  squeeks: new Map(), // id -> { level, ok, art, ramp, rec, started }
  token: null,
  heroPos: { x: 0, y: 0 }, lunge: { x: 0, y: 0 }, facingLeft: false,
  enemyPos: [], enemyFlash: [], explored: new Uint8Array(W * H),
  fx: [], texts: [], toasts: [], shake: 0, flash: 0, fade: 0, banner: null,
  lastInput: 0, queued: null, replay: null, aim: false,
};

// ------------------------------------------------------------ local runs

// Ranked runs in progress are saved locally after every move, so a refresh can resume them.
const runKey = (runId) => `delve.run.${chain.gameAddress}.${runId}`;
function saveRanked() {
  if (!app.ranked || !app.run) return;
  localStorage.setItem(runKey(app.ranked.runId), JSON.stringify({ ...app.ranked, runId: String(app.ranked.runId), tokenId: String(app.ranked.tokenId), exId: String(app.ranked.exId), tape: app.run.tape }));
}
function localRuns() {
  const out = [];
  const prefix = `delve.run.${chain.gameAddress}.`;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k.startsWith(prefix)) continue;
    try {
      const r = JSON.parse(localStorage.getItem(k));
      out.push({ ...r, runId: BigInt(r.runId), tokenId: BigInt(r.tokenId), exId: BigInt(r.exId) });
    } catch { localStorage.removeItem(k); }
  }
  return out;
}

// ------------------------------------------------------------- rendering

const visRadius = () => (app.run?.mood === MOOD.SNOOZE ? 3.6 : 5.6);

function resetPresentation() {
  const s = app.run;
  app.heroPos = { x: s.px * TILE, y: s.py * TILE };
  app.enemyPos = s.enemies.map((e) => ({ x: e.x * TILE, y: e.y * TILE }));
  app.enemyFlash = s.enemies.map(() => 0);
  app.explored = new Uint8Array(W * H);
  app.fx = [];
  updateExplored();
}

function syncEnemies() {
  // Enemy drops can't add enemies, but a new floor replaces the list.
  while (app.enemyPos.length < app.run.enemies.length) {
    const e = app.run.enemies[app.enemyPos.length];
    app.enemyPos.push({ x: e.x * TILE, y: e.y * TILE });
    app.enemyFlash.push(0);
  }
}

function updateExplored() {
  const s = app.run;
  const r = visRadius();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x - s.px) ** 2 + (y - s.py) ** 2 <= r * r) app.explored[y * W + x] = 1;
  }
}

function tileName(s, x, y) {
  const b = `b${biomeOf(s.floor)}_`;
  if (isOpen(s, x, y)) {
    if (x === s.stairs.x && y === s.stairs.y) return s.floor === FLOORS ? null : `${b}stairs`;
    const h = hash2(x + s.floor * 31, y);
    const room = s.style !== STYLE.CAVE && isOpen(s, x - 1, y) && isOpen(s, x + 1, y) && isOpen(s, x, y - 1) && isOpen(s, x, y + 1);
    if (room) return `${b}room_${h % 2}`;
    const v = h % 10;
    return `${b}floor_${v < 6 ? 0 : v - 6}`;
  }
  return isOpen(s, x, y + 1) ? `${b}wall_face_${hash2(x, y + s.floor) % 2}` : `${b}wall_top`;
}

function drawWorld(t) {
  const s = app.run;
  const A = app.atlas;
  l.fillStyle = "#0b0a0f";
  l.fillRect(0, 0, LO_W, LO_H);
  const frame = Math.floor(t / 420) % 2;
  const r = visRadius();
  const oy = TOP;

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!app.explored[y * W + x]) continue;
    const name = tileName(s, x, y);
    if (name) drawFrame(l, A, name, x * TILE, oy + y * TILE);
    else drawFrame(l, A, `exit_${frame}`, x * TILE, oy + y * TILE);
  }
  const visible = (x, y) => (x - s.px) ** 2 + (y - s.py) ** 2 <= r * r;

  for (const it of s.items) {
    if (it.taken || !visible(it.x, it.y)) continue;
    const bob = it.kind === ITEM.CHEST ? 0 : Math.round(Math.sin(t / 260 + it.x) * 1);
    const name = it.kind === ITEM.SEED ? "seed" : it.kind === ITEM.CHEESE ? "cheese" : "chest";
    drawFrame(l, A, name, it.x * TILE, oy + it.y * TILE + bob);
  }
  syncEnemies();
  s.enemies.forEach((e, i) => {
    const p = app.enemyPos[i];
    if (!e.alive || !visible(e.x, e.y)) return;
    const flash = app.enemyFlash[i] > 0 && Math.floor(t / 60) % 2 === 0;
    const flip = p.x > app.heroPos.x;
    drawFrame(l, A, `${ENEMY[e.kind].name}_${frame}`, p.x, oy + p.y, { flip, alpha: flash ? 0.35 : 1 });
    const max = enemyMaxHp(e.kind, s.floor);
    if (e.hp < max) {
      l.fillStyle = "#2a0f14"; l.fillRect(p.x + 2, oy + p.y - 2, 12, 2);
      l.fillStyle = e.kind === CAT ? "#F5C451" : "#ff5a6a"; l.fillRect(p.x + 2, oy + p.y - 2, Math.ceil(12 * e.hp / max), 2);
    }
  });

  if (app.mode === "end" && s.dead) {
    drawFrame(l, A, "grave", app.heroPos.x, oy + app.heroPos.y);
  } else {
    const hname = `hero_${frame}`;
    drawFrame(l, A, hname, app.heroPos.x + app.lunge.x, oy + app.heroPos.y + app.lunge.y, { flip: app.facingLeft, src: app.hero?.[hname] });
  }

  for (const f of app.fx) {
    if (f.kind === "hit") drawFrame(l, A, `hit_${Math.min(2, Math.floor(f.t / 70))}`, f.x, oy + f.y);
    else if (f.kind === "sparkle") drawFrame(l, A, `sparkle_${Math.floor(f.t / 90) % 2}`, f.x, oy + f.y - f.t / 30);
    else if (f.kind === "chest") drawFrame(l, A, "chest_open", f.x, oy + f.y, { alpha: Math.max(0, 1 - f.t / 600) });
    else if (f.kind === "shot") {
      const k = Math.min(1, f.t / 140);
      drawFrame(l, A, "pebble", f.fx + (f.x - f.fx) * k, oy + f.fy + (f.y - f.fy) * k);
    }
  }

  // Torch light around the delver; explored-but-unseen tiles stay dimmed.
  const cx = app.heroPos.x + 8;
  const cy = oy + app.heroPos.y + 8;
  const flick = Math.sin(t / 90) * 1.5 + Math.sin(t / 37) * 0.8;
  const rad = r * TILE + flick;
  const grd = l.createRadialGradient(cx, cy, rad * 0.25, cx, cy, rad + 10);
  grd.addColorStop(0, "rgba(255,190,90,0.07)");
  grd.addColorStop(0.7, "rgba(10,8,14,0.15)");
  grd.addColorStop(1, "rgba(10,8,14,0.8)");
  l.fillStyle = grd;
  l.fillRect(0, oy, LO_W, H * TILE);
  l.fillStyle = "#0b0a0f";
  l.fillRect(0, 0, LO_W, TOP);
  l.fillRect(0, TOP + H * TILE, LO_W, BOTTOM);
}

function drawHudIcons() {
  const s = app.run;
  const A = app.atlas;
  const hearts = Math.ceil(s.maxHp / 2);
  const perRow = 10;
  const rows = Math.ceil(hearts / perRow);
  for (let i = 0; i < hearts; i++) {
    const v = s.hp - i * 2;
    const n = v >= 2 ? "heart_full" : v === 1 ? "heart_half" : "heart_empty";
    drawFrame(l, A, n, 3 + (i % perRow) * 9, rows === 1 ? 4 : Math.floor(i / perRow) * 8);
  }
  drawFrame(l, A, "icon_seed", 160, 4);
  drawFrame(l, A, "icon_floor", 204, 4);
  drawFrame(l, A, "icon_skull", 238, 4);
  const by = TOP + H * TILE;
  drawFrame(l, A, `wpn_${s.weapon}`, 2, by);
  drawFrame(l, A, `arm_${s.armor}`, 62, by);
  drawFrame(l, A, `sl_${s.sling}`, 118, by);
  drawFrame(l, A, "icon_crit", 178, by + 4);
  drawFrame(l, A, "icon_luck", 214, by + 4);
}

function hudText() {
  const s = app.run;
  const T = (txt, x, y, color = "#f3e6c8", size = 14) => {
    g.font = `${size}px "Press Start 2P", monospace`;
    g.fillStyle = color;
    g.fillText(txt, x * SCALE, y * SCALE);
  };
  g.textBaseline = "top";
  T(`${s.gold}`, 170, 4, "#F5C451");
  T(`B${s.floor}`, 214, 4);
  T(`${s.kills}`, 248, 4);
  const by = TOP + H * TILE + 5;
  T(`${playerAtk(s)}`, 20, by, WEAPONS[s.weapon].pierce ? "#9be27a" : "#f3e6c8");
  T(`${ARMORS[s.armor].def}`, 80, by, "#9fc6ff");
  T(`${s.pebbles}`, 136, by, s.pebbles ? "#f3e6c8" : "#ff7a7a");
  T(`${s.crit}%`, 188, by, "#ffe08a", 11);
  T(`+${s.luck}`, 224, by, "#d7d0ff", 11);
  T(`${s.tape.length}/${MAX_TAPE}`, 244, by + 1, s.tape.length > MAX_TAPE - 100 ? "#ff7a7a" : "#5f5873", 8);
  if (app.aim) T("AIM", 236, TOP + 3, "#ffe08a", 12);
}

function drawTexts() {
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  for (const tx of app.texts) {
    g.font = `${tx.big ? 16 : 12}px "Press Start 2P", monospace`;
    g.globalAlpha = Math.max(0, 1 - tx.t / 900);
    const x = (tx.x + 8) * SCALE;
    const y = (TOP + tx.y - tx.t / 40) * SCALE;
    g.fillStyle = "#000";
    g.fillText(tx.text, x + 2, y + 2);
    g.fillStyle = tx.color;
    g.fillText(tx.text, x, y);
  }
  g.globalAlpha = 1;
  g.textAlign = "left";
  // Loot toasts stack in the lower left of the world.
  let y = (TOP + H * TILE) * SCALE - 12;
  for (const t of app.toasts.slice(-3).reverse()) {
    const a = Math.min(1, t.t < 200 ? t.t / 200 : (t.life - t.t) / 300);
    g.globalAlpha = Math.max(0, a);
    g.font = '12px "Press Start 2P", monospace';
    const tw = g.measureText(t.text).width;
    g.fillStyle = "rgba(11,10,15,0.85)";
    g.fillRect(10, y - 58, tw + 76, 54);
    g.strokeStyle = t.color; g.lineWidth = 3; g.strokeRect(10, y - 58, tw + 76, 54);
    if (t.icon && app.atlas.frames[t.icon]) {
      const f = app.atlas.frames[t.icon].frame;
      g.drawImage(app.atlas.img, f.x, f.y, f.w, f.h, 18, y - 55, 48, 48);
    }
    g.fillStyle = t.color;
    g.fillText(t.text, 70, y - 38);
    g.fillStyle = "#c9bfa6";
    g.font = '9px "Press Start 2P", monospace';
    g.fillText(t.sub ?? "", 70, y - 20);
    y -= 62;
  }
  g.globalAlpha = 1;
}

function drawBanner() {
  if (!app.banner) return;
  const b = app.banner;
  const a = Math.min(1, b.t < 300 ? b.t / 300 : (b.life - b.t) / 300);
  g.globalAlpha = Math.max(0, a);
  g.fillStyle = "rgba(11,10,15,0.78)";
  g.fillRect(0, 250, screen.width, 96);
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillStyle = "#F5C451";
  g.font = '30px "Press Start 2P", monospace';
  g.fillText(b.text, screen.width / 2, 296);
  g.fillStyle = "#f3e6c8";
  g.font = '12px "Press Start 2P", monospace';
  g.fillText(b.sub ?? "", screen.width / 2, 328);
  g.textAlign = "left";
  g.globalAlpha = 1;
}

function drawTitle(t) {
  l.fillStyle = "#0b0a0f";
  l.fillRect(0, 0, LO_W, LO_H);
  if (app.titleImg) l.drawImage(app.titleImg, (LO_W - app.titleImg.width) / 2, 48);
  const frame = Math.floor(t / 420) % 2;
  ["hero", "beetle", "rat", "snake", "mole", "cat"].forEach((n, i) => {
    const x = 40 + i * 34;
    const y = 166 + Math.round(Math.sin(t / 300 + i) * 1.5);
    drawFrame(l, app.atlas, `${n}_${frame}`, x, y, { src: n === "hero" ? app.hero?.[`hero_${frame}`] : null });
  });
  ["wpn_4", "arm_3", "sl_2", "chest", "clover", "bigcheese"].forEach((n, i) => {
    drawFrame(l, app.atlas, n, 40 + i * 34, 196 + Math.round(Math.sin(t / 250 + i * 2) * 1));
  });
  g.drawImage(lo, 0, 0, screen.width, screen.height);
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = '44px "Press Start 2P", monospace';
  g.fillStyle = "#3a2a14";
  g.fillText("SQUEEK DELVE", screen.width / 2 + 4, 74);
  g.fillStyle = "#F5C451";
  g.fillText("SQUEEK DELVE", screen.width / 2, 70);
  g.font = '12px "Press Start 2P", monospace';
  g.fillStyle = "#f3e6c8";
  g.fillText("A holder-only roguelike. Every run verified onchain.", screen.width / 2, 116);
  if (Math.floor(t / 600) % 2 === 0) {
    g.fillStyle = "#F5C451";
    g.fillText("ENTER: PRACTICE RUN  ·  R: RANKED RUN", screen.width / 2, 680);
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
  syncEnemies();
  app.run.enemies.forEach((e, i) => {
    const p = app.enemyPos[i];
    p.x += (e.x * TILE - p.x) * k;
    p.y += (e.y * TILE - p.y) * k;
    app.enemyFlash[i] = Math.max(0, app.enemyFlash[i] - dt);
  });
  const life = { hit: 210, sparkle: 500, chest: 600, shot: 160 };
  app.fx = app.fx.filter((f) => (f.t += dt) < life[f.kind]);
  app.texts = app.texts.filter((x) => (x.t += dt) < 900);
  app.toasts = app.toasts.filter((x) => (x.t += dt) < x.life);
  if (app.banner && (app.banner.t += dt) > app.banner.life) app.banner = null;
  app.shake = Math.max(0, app.shake - dt);
  app.flash = Math.max(0, app.flash - dt);
  app.fade = Math.max(0, app.fade - dt);

  drawWorld(t);
  drawHudIcons();
  const sx = app.shake ? (Math.random() - 0.5) * app.shake / 25 : 0;
  const sy = app.shake ? (Math.random() - 0.5) * app.shake / 25 : 0;
  g.fillStyle = "#0b0a0f";
  g.fillRect(0, 0, screen.width, screen.height);
  g.drawImage(lo, 0, 0, LO_W, TOP, 0, 0, LO_W * SCALE, TOP * SCALE);
  g.drawImage(lo, 0, TOP + H * TILE, LO_W, BOTTOM, 0, (TOP + H * TILE) * SCALE, LO_W * SCALE, BOTTOM * SCALE);
  g.drawImage(lo, 0, TOP, LO_W, H * TILE, Math.round(sx), TOP * SCALE + Math.round(sy), LO_W * SCALE, H * TILE * SCALE);
  hudText();
  drawTexts();
  if (app.flash) { g.fillStyle = `rgba(200,30,40,${app.flash / 600})`; g.fillRect(0, 0, screen.width, screen.height); }
  if (app.fade) { g.fillStyle = `rgba(11,10,15,${Math.min(1, app.fade / 300)})`; g.fillRect(0, 0, screen.width, screen.height); }
  drawBanner();
  if (app.mode === "replay") {
    g.fillStyle = "rgba(11,10,15,0.75)"; g.fillRect(0, screen.height - 92, screen.width, 40);
    g.font = '12px "Press Start 2P", monospace'; g.fillStyle = "#F5C451"; g.textBaseline = "top";
    g.fillText(`REPLAY · SQUEEK #${app.replay.tokenId} · RUN ${app.replay.runId} · ESC TO EXIT`, 14, screen.height - 80);
  } else if (app.ranked && app.mode === "play") {
    g.font = '9px "Press Start 2P", monospace'; g.fillStyle = "#F5C451"; g.textBaseline = "top";
    g.fillText(`RANKED RUN ${app.ranked.runId}`, 10, (TOP + 2) * SCALE);
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ play

function toast(icon, text, sub, color = "#F5C451") { app.toasts.push({ icon, text, sub, color, t: 0, life: 2600 }); }

const LOOT_SUB = {
  weapon: (s) => `ATK ${playerAtk(s)}${WEAPONS[s.weapon].pierce ? " · PIERCES 2 FOES" : ""}`,
  armor: (s) => `DEF ${ARMORS[s.armor].def}: enemy hits -${ARMORS[s.armor].def}`,
  sling: (s) => `SHOT ${SLINGS[s.sling].dmg} DMG · RANGE ${SLINGS[s.sling].range}`,
  pouch: (s) => `+4 PEBBLES (${s.pebbles})`,
  vitamin: (s) => `MAX HP +3 (${s.maxHp})`,
  clover: (s) => `CRIT CHANCE ${s.crit}%`,
  whisker: (s) => `EVERY SEED +${s.luck}`,
  bigcheese: () => "FULLY HEALED",
};

function applyEvents(ev, quiet = false) {
  const s = app.run;
  for (const e of ev) {
    switch (e.t) {
      case "face": if (e.dir === 1) app.facingLeft = false; if (e.dir === 3) app.facingLeft = true; break;
      case "move": if (!quiet) sfx("step"); break;
      case "bump": if (!quiet) sfx("bump"); break;
      case "attack":
        sfx("attack");
        app.lunge = { x: (e.x - s.px) * 6, y: (e.y - s.py) * 6 };
        break;
      case "shot":
        sfx("shoot");
        app.fx.push({ kind: "shot", fx: e.fx * TILE, fy: e.fy * TILE, x: e.x * TILE, y: e.y * TILE, t: 0 });
        break;
      case "empty":
        sfx("bump");
        app.texts.push({ text: "NO PEBBLES", x: s.px * TILE, y: s.py * TILE - 4, color: "#ff7a7a", t: 0 });
        break;
      case "hit":
        app.fx.push({ kind: "hit", x: e.x * TILE, y: e.y * TILE, t: 0 });
        app.enemyFlash[e.i] = 300;
        app.texts.push({ text: e.crit ? `CRIT ${e.dmg}!` : `-${e.dmg}`, x: e.x * TILE, y: e.y * TILE, color: e.crit ? "#ffe08a" : "#ffffff", t: 0, big: e.crit });
        if (e.crit) app.shake = 120;
        break;
      case "kill":
        sfx("kill");
        app.texts.push({ text: `+${e.value}`, x: e.x * TILE, y: e.y * TILE - 10, color: "#9be27a", t: 0 });
        if (e.kind === CAT) { app.banner = { text: "TABBY DEFEATED!", sub: "The golden wheel is free. Run to it!", t: 0, life: 2200 }; sfx("win"); }
        break;
      case "drop":
        app.fx.push({ kind: "sparkle", x: e.x * TILE, y: e.y * TILE, t: 0 });
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
      case "chest":
        sfx("chest");
        app.fx.push({ kind: "chest", x: e.x * TILE, y: e.y * TILE, t: 0 });
        break;
      case "loot": {
        sfx("loot");
        const icon = SLOT_ICON[e.slot] ? `${SLOT_ICON[e.slot]}${e.tier}` : e.slot;
        toast(icon, e.name.toUpperCase(), LOOT_SUB[e.slot](s));
        break;
      }
      case "salvage":
        sfx("seed");
        toast(`${SLOT_ICON[e.slot]}${e.tier}`, `${e.name.toUpperCase()}`, `NOT BETTER · SALVAGED FOR ${e.value} SEEDS`, "#a89f8a");
        break;
      case "hurt":
        sfx("hurt");
        app.shake = 220; app.flash = 260;
        app.fx.push({ kind: "hit", x: s.px * TILE, y: s.py * TILE, t: 0 });
        app.texts.push({ text: `-${e.dmg}`, x: s.px * TILE, y: s.py * TILE, color: "#ff5a6a", t: 0 });
        break;
      case "locked":
        sfx("bump");
        toast("cat_0", "THE WHEEL WON'T SPIN", "DEFEAT THE TABBY FIRST", "#ff9db0");
        break;
      case "descend":
        sfx("descend");
        app.fade = 450;
        resetPresentation();
        floorBanner();
        if (e.heal) app.texts.push({ text: `REST +${e.heal}HP`, x: s.px * TILE, y: s.py * TILE - 8, color: "#ff9db0", t: 0 });
        break;
      case "win": sfx("win"); break;
      case "die": sfx("die"); app.shake = 400; break;
      case "flee": sfx("flee"); break;
      default: break;
    }
  }
  updateExplored();
}

function floorBanner() {
  const s = app.run;
  const last = s.floor === FLOORS;
  app.banner = {
    text: last ? "FINAL FLOOR" : `FLOOR ${s.floor}`,
    sub: last ? "THE TABBY GUARDS THE GOLDEN WHEEL" : `${BIOMES[biomeOf(s.floor)]} · ${STYLES[s.style]}`,
    t: 0, life: 1700,
  };
}

function doAction(a) {
  if (!app.run || isOver(app.run)) return;
  const ev = step(app.run, a);
  applyEvents(ev);
  if (app.ranked && app.mode === "play") saveRanked();
  if (isOver(app.run)) setTimeout(() => endRun(), app.mode === "replay" ? 1200 : 700);
}

function beginRun(seed, level, mood, ranked = null) {
  app.run = newRun(seed, level, mood);
  app.ranked = ranked;
  app.mode = "play";
  app.facingLeft = false;
  app.toasts = [];
  app.texts = [];
  resetPresentation();
  hideOverlay();
  floorBanner();
  app.banner.sub = `${MOOD_INFO[mood].name.toUpperCase()} BURROW · ${ranked ? `RANKED RUN ${ranked.runId}` : "PRACTICE"}`;
  sfx("descend");
  screen.focus();
}

function startPractice() {
  const sq = app.token ? app.squeeks.get(app.token) : null;
  const mood = app.ex ? app.ex.mood : MOOD.POTTER;
  beginRun(randomSeed(), sq?.level ?? 1, mood, null);
}

async function startRanked() {
  const sq = app.token ? app.squeeks.get(app.token) : null;
  if (!chain.account) { setPanelStatus("Connect a wallet first.", true); return; }
  if (!sq?.ok) { setPanelStatus("Pick one of your Squeeks first.", true); return; }
  if (!app.exOpen) { setPanelStatus("No open expedition. Open one in the Expedition panel.", true); return; }
  try {
    const { events } = await chain.write("startRun", [app.token], (m, h) => setPanelStatus(h ? `${esc(m)} ${txLink(h)}` : esc(m)));
    const started = events.find((e) => e.eventName === "RunStarted");
    if (!started) throw new Error("RunStarted event not found in the receipt.");
    const { runId, seed, level, expeditionId, tokenId } = started.args;
    setPanelStatus(`Ranked run ${runId} started. A fresh burrow was drawn onchain.`);
    const ranked = { runId, seed: Number(seed), level: Number(level), mood: app.ex.mood, tokenId, exId: expeditionId };
    beginRun(ranked.seed, ranked.level, ranked.mood, ranked);
    saveRanked();
    refreshSqueek(app.token);
  } catch (e) { setPanelStatus(esc(e.shortMessage ?? e.message), true); }
}

function resumeRanked(r) {
  app.run = newRun(r.seed, r.level, r.mood);
  for (const a of r.tape) step(app.run, a);
  app.ranked = { runId: r.runId, seed: r.seed, level: r.level, mood: r.mood, tokenId: r.tokenId, exId: r.exId };
  app.mode = "play";
  app.toasts = [];
  resetPresentation();
  hideOverlay();
  app.banner = { text: "RESUMED", sub: `RANKED RUN ${r.runId} · FLOOR ${app.run.floor}`, t: 0, life: 1500 };
  if (isOver(app.run)) endRun();
  screen.focus();
}

// ---------------------------------------------------------------- input

const MOVE_KEYS = {
  ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3,
};
const FIRE_KEYS = { KeyI: 0, KeyL: 1, KeyK: 2, KeyJ: 3 };

function input(a) {
  if (app.mode !== "play") return;
  if (a === ACT.FLEE && !confirm("Leave the burrow now and keep all your seeds?")) return;
  const now = performance.now();
  if (now - app.lastInput < STEP_MS) { app.queued = a; return; }
  app.lastInput = now;
  doAction(a);
}
setInterval(() => {
  if (app.queued !== null && performance.now() - app.lastInput >= STEP_MS) {
    const a = app.queued; app.queued = null; app.lastInput = performance.now(); doAction(a);
  }
}, 20);

function setAim(on) {
  app.aim = on;
  $("aimBtn").classList.toggle("on", on);
  document.querySelector(".pad").classList.toggle("aiming", on);
}

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (app.mode === "title" || app.mode === "end") {
    if (e.code === "Enter") { e.preventDefault(); startPractice(); return; }
    if (e.code === "KeyR") { e.preventDefault(); startRanked(); return; }
  }
  if (app.mode === "replay" && e.code === "Escape") { stopReplay(); return; }
  if (app.mode !== "play") return;
  if (e.code === "KeyF") { e.preventDefault(); setAim(!app.aim); return; }
  if (e.code in FIRE_KEYS) { e.preventDefault(); input(ACT.FIRE_UP + FIRE_KEYS[e.code]); return; }
  if (e.code in MOVE_KEYS) {
    e.preventDefault();
    const d = MOVE_KEYS[e.code];
    const fire = e.shiftKey || app.aim;
    if (app.aim) setAim(false);
    input(fire ? ACT.FIRE_UP + d : d);
    return;
  }
  if (e.code === "Space" || e.code === "Period") { e.preventDefault(); input(ACT.WAIT); return; }
  if (e.code === "KeyQ") { e.preventDefault(); input(ACT.FLEE); }
});
document.querySelectorAll("[data-dir]").forEach((b) => {
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const d = Number(b.dataset.dir);
    const fire = app.aim;
    if (fire) setAim(false);
    input(fire ? ACT.FIRE_UP + d : d);
  });
});
document.querySelectorAll("[data-act]").forEach((b) => {
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); input(Number(b.dataset.act)); });
});
$("aimBtn").addEventListener("pointerdown", (e) => { e.preventDefault(); if (app.mode === "play") setAim(!app.aim); });

// -------------------------------------------------------------- overlays

function showOverlay(html) { $("overlay").innerHTML = html; $("overlay").classList.remove("hidden"); }
function hideOverlay() { $("overlay").classList.add("hidden"); }

function gearRow(s) {
  const icon = (name) => { const f = app.atlas.frames[name]?.frame; return f ? `<span class="ico" style="--x:${f.x};--y:${f.y}" title="${esc(name)}"></span>` : ""; };
  return `<div class="gear">${icon(`wpn_${s.weapon}`)}<span>${WEAPONS[s.weapon].name}</span>${icon(`arm_${s.armor}`)}<span>${ARMORS[s.armor].name}</span>${icon(`sl_${s.sling}`)}<span>${SLINGS[s.sling].name}</span></div>`;
}

function endRun() {
  if (app.mode === "replay") { stopReplay(); return; }
  app.mode = "end";
  setAim(false);
  const s = app.run;
  const sc = score(s);
  const title = s.won ? "VICTORY!" : s.dead ? "YOU FELL" : "ESCAPED";
  const sub = s.won ? "You spun the golden wheel." : s.dead ? `Floor ${s.floor}: half your seeds were lost in the dark.` : "You climbed out with every seed.";
  const r = app.ranked;
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
      ${gearRow(s)}
      ${r ? `
        <p class="small">Ranked run ${r.runId} · Squeek #${r.tokenId}</p>
        <div class="row">
          <button class="px-btn" id="verifyBtn">VERIFY ONCHAIN</button>
          <button class="px-btn gold" id="submitBtn">SUBMIT SCORE</button>
        </div>
        <div id="runStatus" class="small"></div>` : `<p class="muted small">Practice run on a random burrow. Ranked runs draw their burrow onchain and count for the leaderboard.</p>`}
      <div class="row">
        <button class="px-btn" id="againBtn">PRACTICE AGAIN</button>
        <button class="px-btn ${r ? "" : "gold"}" id="rankedBtn">RANKED RUN</button>
        <button class="px-btn" id="menuBtn">MENU</button>
      </div>
    </div>`);
  $("againBtn").onclick = () => { sfx("ui"); startPractice(); };
  $("rankedBtn").onclick = () => { sfx("ui"); startRanked(); };
  $("menuBtn").onclick = () => { sfx("ui"); app.mode = "title"; app.run = null; app.ranked = null; hideOverlay(); };
  if (r) {
    $("verifyBtn").onclick = () => verifyRun(r, s, sc);
    $("submitBtn").onclick = () => submitRun(r, s);
  }
}

async function verifyRun(r, s, sc) {
  const st = $("runStatus");
  st.textContent = "Replaying your run inside the contract…";
  try {
    const res = await chain.rules("simulate", [r.seed, r.level, r.mood, hexTape(s.tape)]);
    const ok = Number(res.score) === sc;
    st.innerHTML = ok
      ? `<span class="good">✔ The contract agrees: ${res.score} points, floor ${res.floor}, ${res.kills} kills.</span>`
      : `<span class="red">✘ The contract says ${res.score}; the game says ${sc}. Please report this.</span>`;
  } catch (e) { st.innerHTML = `<span class="red">${esc(e.shortMessage ?? e.message)}</span>`; }
}

async function submitRun(r, s) {
  const st = $("runStatus");
  try {
    const { hash } = await chain.write("submitRun", [r.runId, hexTape(s.tape)], (m, h) => {
      st.innerHTML = h ? `${esc(m)} ${txLink(h)}` : esc(m);
    });
    st.innerHTML = `<span class="good">✔ Score recorded onchain ${txLink(hash)}</span>`;
    $("submitBtn").disabled = true;
    $("submitBtn").textContent = "SUBMITTED";
    localStorage.removeItem(runKey(r.runId));
    await refreshSqueek(r.tokenId);
    await refreshBoard();
    renderDelver();
  } catch (e) { st.innerHTML = `<span class="red">${esc(e.shortMessage ?? e.message)}</span>`; }
}

// ---------------------------------------------------------------- replay

async function startReplay(runId, tokenId) {
  if (app.mode === "play" && app.run && !isOver(app.run) && !confirm("Abandon your current run to watch a replay?")) return;
  try {
    setPanelStatus(`Loading replay of run ${runId}…`);
    const [info, tapeHex] = await Promise.all([chain.read("run", [runId]), chain.runTape(runId)]);
    if (!tapeHex) throw new Error("Run tape not found in recent logs.");
    const ex = await chain.read("expedition", [info.expeditionId]);
    const tape = hexToBytes(tapeHex);
    app.run = newRun(info.seed, info.level, ex.mood);
    app.ranked = null;
    app.mode = "replay";
    app.replay = { tokenId, runId, tape, i: 0 };
    app.toasts = [];
    hideOverlay();
    resetPresentation();
    floorBanner();
    setPanelStatus("");
    app.replay.timer = setInterval(() => {
      if (!app.replay || app.replay.i >= tape.length || isOver(app.run)) {
        clearInterval(app.replay?.timer);
        if (app.run && !isOver(app.run)) setTimeout(stopReplay, 1500);
        return;
      }
      doAction(tape[app.replay.i++]);
    }, 160);
  } catch (e) { setPanelStatus(esc(e.shortMessage ?? e.message), true); }
}
function stopReplay() {
  clearInterval(app.replay?.timer);
  app.replay = null;
  app.mode = "title";
  app.run = null;
}

// ------------------------------------------------------------ side panels

function setPanelStatus(html, bad = false) { $("panelStatus").innerHTML = html ? `<span class="${bad ? "red" : ""}">${html}</span>` : ""; }

async function refreshExpedition() {
  if (!chain.gameAddress) {
    $("expBody").innerHTML = `<p class="muted small">Game contract not configured. Practice runs still work.</p>`;
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
      <div class="kv"><span>Hamster work</span><b>${ex.work} in rounds ${Math.max(0, Number(ex.seedRound) - 6)}–${ex.seedRound}</b></div>
      <div class="kv"><span>Ranked runs</span><b>${ex.runs}</b></div>
      <div class="kv"><span>${app.exOpen ? "New runs close in" : "Status"}</span><b id="exClock">${app.exOpen ? mmss(left) : "ended"}</b></div>
      ${app.exOpen ? "" : openBtn()}`;
  }
  const b = $("openExp");
  if (b) b.onclick = openExpedition;
}

const openBtn = () => `<button id="openExp" class="px-btn gold wide" ${chain.account ? "" : "disabled"}>${chain.account ? "OPEN NEXT EXPEDITION" : "CONNECT TO OPEN"}</button>`;

async function openExpedition() {
  try {
    await chain.write("openExpedition", [], (m) => setPanelStatus(esc(m)));
    setPanelStatus("Expedition opened! Read the hamster's mood above.");
    await refreshExpedition();
    await Promise.all([...app.squeeks.keys()].map(refreshSqueek));
    await refreshBoard();
  } catch (e) { setPanelStatus(esc(e.shortMessage ?? e.message), true); }
}

async function refreshBoard() {
  const el = $("board");
  if (!chain.gameAddress || app.exId === null) { el.innerHTML = `<p class="muted small">No runs yet.</p>`; return; }
  const [ids, bests] = await chain.read("leaderboard", [app.exId]);
  if (!ids.length) { el.innerHTML = `<p class="muted small">No ranked runs yet. The first delver sets the bar.</p>`; return; }
  const icon = (name) => { const f = app.atlas.frames[name]?.frame; return f ? `<span class="ico sm" style="--x:${f.x};--y:${f.y}"></span>` : ""; };
  el.innerHTML = ids.map((id, i) => {
    const b = bests[i];
    const mark = b.won ? "🏆" : `B${b.floor}`;
    return `<div class="brow ${app.token === id ? "me" : ""}"><span class="rank">${i + 1}</span><span>#${id} <i>L${b.level}</i></span><span class="gearmini">${icon(`wpn_${b.weapon}`)}${icon(`arm_${b.armor}`)}</span><span>${mark}</span><b>${b.score}</b><button class="px-btn tiny" data-replay="${b.runId}" data-token="${id}" title="Watch replay">▶</button></div>`;
  }).join("");
  el.querySelectorAll("[data-replay]").forEach((b) => { b.onclick = () => startReplay(BigInt(b.dataset.replay), BigInt(b.dataset.token)); });
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
  const [rec, started] = await Promise.all([
    chain.read("record", [id]),
    app.exId !== null ? chain.read("runsStarted", [app.exId, id]) : 0,
  ]);
  Object.assign(sq, { rec, started: Number(started) });
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

async function pendingRuns() {
  if (!chain.gameAddress || !chain.account) return [];
  const out = [];
  for (const r of localRuns()) {
    try {
      const info = await chain.read("run", [r.runId]);
      if (info.submitted || info.player !== chain.account) { localStorage.removeItem(runKey(r.runId)); continue; }
      const ex = await chain.read("expedition", [info.expeditionId]);
      if (Date.now() / 1000 >= Number(ex.endsAt) + 1800) { localStorage.removeItem(runKey(r.runId)); continue; }
      out.push(r);
    } catch { /* keep it; maybe a transient RPC error */ }
  }
  return out;
}

async function renderDelver() {
  const el = $("delver");
  if (!chain.account) {
    el.innerHTML = `<p class="muted small">Connect a wallet that holds a Squeek (in your wallet or staked). Your Squeek becomes your delver: its colors, its level, its record. You can practice without one.</p>`;
    return;
  }
  const sq = app.token ? app.squeeks.get(app.token) : null;
  const chips = [...app.squeeks.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([id, s]) =>
    `<button class="chip ${app.token === id ? "on" : ""}" data-sq="${id}" ${s.ok ? "" : "disabled title=\"Not held by this wallet\""}>#${id} <i>L${s.level}</i></button>`).join("");
  let card = "";
  if (sq) {
    const st = playerStats(sq.level);
    const left = 3 - (sq.started ?? 0);
    card = `
      <div class="delver">
        <div class="portrait">${sq.art ? `<img alt="Squeek #${app.token}" src="${sq.art.image}">` : ""}</div>
        <div>
          <b>SQUEEK #${app.token}</b>
          <div class="small">Level ${sq.level} · ${st.maxHp} HP · ${st.atk + WEAPONS[0].atk} ATK</div>
          <div class="small muted">Runs ${sq.rec?.runs ?? 0} · Wins ${sq.rec?.victories ?? 0} · Crowns ${sq.rec?.crowns ?? 0} · Best ${sq.rec?.bestScore ?? 0}</div>
        </div>
      </div>
      <button class="px-btn gold wide" id="rankedSide" ${app.exOpen && left > 0 ? "" : "disabled"}>${app.exOpen ? `RANKED RUN (${left}/3 LEFT)` : "NO OPEN EXPEDITION"}</button>`;
  }
  el.innerHTML = `${card}<div id="pending"></div><div class="chips">${chips}</div>
    <div class="row"><input id="manualId" type="number" min="1" max="9999" placeholder="Token ID"><button class="px-btn tiny" id="addId">ADD</button></div>`;
  el.querySelectorAll("[data-sq]").forEach((b) => { b.onclick = () => { sfx("ui"); selectSqueek(BigInt(b.dataset.sq)); }; });
  $("addId").onclick = async () => { const v = $("manualId").value; if (v) { await addSqueek(BigInt(v)); renderDelver(); } };
  const rs = $("rankedSide");
  if (rs) rs.onclick = () => { sfx("ui"); startRanked(); };
  const pend = await pendingRuns();
  const pel = $("pending");
  if (pel && pend.length) {
    pel.innerHTML = pend.map((r) => `<div class="kv small"><span>Unfinished ranked run ${r.runId} (#${r.tokenId})</span><b><button class="px-btn tiny" data-resume="${r.runId}">RESUME</button></b></div>`).join("");
    pel.querySelectorAll("[data-resume]").forEach((b) => {
      b.onclick = () => resumeRanked(pend.find((r) => String(r.runId) === b.dataset.resume));
    });
  }
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
  $("practiceBtn").onclick = () => { sfx("ui"); startPractice(); };
  $("rankedBtn").onclick = () => { sfx("ui"); startRanked(); };
  await document.fonts.load('12px "Press Start 2P"').catch(() => {});
  app.atlas = await loadAtlas();
  document.documentElement.style.setProperty("--atlas", `url("${new URL("./assets/sprites.png", location.href)}")`);
  document.documentElement.style.setProperty("--atlas-w", app.atlas.img.width);
  document.documentElement.style.setProperty("--atlas-h", app.atlas.img.height);
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
  setInterval(() => { if (app.mode !== "play") refreshExpedition().then(refreshBoard).catch(() => {}); }, 30000);
}
boot().catch((e) => setPanelStatus(esc(e.shortMessage ?? e.message), true));
