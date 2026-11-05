// Squeek Delve rules engine. Deterministic and integer-only.
// SqueekDelve.sol re-implements these rules exactly to verify submitted runs onchain;
// any change here must be mirrored there (test/parity checks this).

export const W = 15;
export const H = 11;
export const FLOORS = 5;
export const MAX_TAPE = 600;
export const MAX_ENEMIES = 8;
export const MAX_ITEMS = 6;
export const START_X = 7;
export const START_Y = 5;
const CARVE_TARGET = 72;
const CARVE_CAP = 3000;
const PLACE_TRIES = 100;

export const ACT = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3, WAIT: 4, FLEE: 5 };
export const MOOD = { SNOOZE: 0, POTTER: 1, JOG: 2, ZOOMIES: 3 };
export const MOOD_INFO = [
  { name: "Snooze", emoji: "💤", text: "The hamster slept. Burrow is dark; enemies are drowsy and act every other turn." },
  { name: "Potter", emoji: "🐾", text: "A few laps. A normal burrow." },
  { name: "Jog", emoji: "🏃", text: "Proper running. Seeds are worth +2." },
  { name: "Zoomies", emoji: "⚡", text: "Full sprint! One extra enemy per floor, seeds worth double." },
];
export const ITEM = { SEED: 0, CHEESE: 1 };
export const ENEMY = [
  { name: "beetle", hp: 2, atk: 1, sight: 4, value: 3 },
  { name: "snake", hp: 3, atk: 2, sight: 5, value: 5 },
  { name: "cat", hp: 6, atk: 3, sight: 6, value: 12 },
];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** xorshift32; state is a uint32 held in a JS number. */
function rng(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >>> 17)) >>> 0;
    x = (x ^ (x << 5)) >>> 0;
    return x;
  };
}

export const moodForWork = (work) => (work >= 300 ? 3 : work >= 100 ? 2 : work >= 1 ? 1 : 0);
export const playerStats = (level) => {
  const l = Math.min(10, Math.max(1, level));
  return { maxHp: 6 + 2 * l, atk: 1 + Math.floor(l / 3) };
};
export function seedValue(floor, mood) {
  let v = 3 + floor;
  if (mood === MOOD.JOG) v += 2;
  if (mood === MOOD.ZOOMIES) v *= 2;
  return v;
}

const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

export function genFloor(seed, floor, mood) {
  const next = rng((seed ^ Math.imul(floor, 0x9e3779b9)) >>> 0);
  const open = new Uint8Array(W * H);
  let x = START_X;
  let y = START_Y;
  open[y * W + x] = 1;
  let count = 1;
  for (let i = 0; i < CARVE_CAP && count < CARVE_TARGET; i++) {
    const d = next() % 4;
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (nx < 1 || nx > W - 2 || ny < 1 || ny > H - 2) continue;
    x = nx;
    y = ny;
    if (!open[y * W + x]) {
      open[y * W + x] = 1;
      count++;
    }
  }

  let sx = START_X;
  let sy = START_Y;
  let best = 0;
  for (let cy = 1; cy <= H - 2; cy++) {
    for (let cx = 1; cx <= W - 2; cx++) {
      const dd = dist(cx, cy, START_X, START_Y);
      if (open[cy * W + cx] && dd > best) {
        best = dd;
        sx = cx;
        sy = cy;
      }
    }
  }

  const enemies = [];
  const items = [];
  const taken = (cx, cy) =>
    (cx === START_X && cy === START_Y) || (cx === sx && cy === sy)
    || enemies.some((e) => e.x === cx && e.y === cy) || items.some((it) => it.x === cx && it.y === cy);
  const place = (minDist) => {
    for (let t = 0; t < PLACE_TRIES; t++) {
      const cx = 1 + (next() % (W - 2));
      const cy = 1 + (next() % (H - 2));
      if (open[cy * W + cx] && !taken(cx, cy) && dist(cx, cy, START_X, START_Y) >= minDist) return [cx, cy];
    }
    return null;
  };

  const nEnemies = Math.min(MAX_ENEMIES, 1 + floor + (mood === MOOD.ZOOMIES ? 1 : 0));
  const range = floor >= 4 ? 3 : floor >= 2 ? 2 : 1;
  for (let k = 0; k < nEnemies; k++) {
    let type = next() % range;
    if (floor === FLOORS && k === 0) type = 2;
    const p = place(3);
    if (p) enemies.push({ type, x: p[0], y: p[1], hp: ENEMY[type].hp, alive: true });
  }
  const nSeeds = 3 + (next() % 3);
  for (let k = 0; k < nSeeds; k++) {
    const p = place(1);
    if (p) items.push({ kind: ITEM.SEED, x: p[0], y: p[1], taken: false });
  }
  const p = place(1);
  if (p) items.push({ kind: ITEM.CHEESE, x: p[0], y: p[1], taken: false });

  return { open, stairs: { x: sx, y: sy }, enemies, items };
}

export function newRun(seed, level, mood) {
  const { maxHp, atk } = playerStats(level);
  const s = {
    seed: seed >>> 0, level, mood, maxHp, atk, hp: maxHp,
    floor: 1, px: START_X, py: START_Y, gold: 0, kills: 0, killScore: 0, turn: 0,
    dead: false, won: false, fled: false, tape: [],
  };
  Object.assign(s, genFloor(s.seed, 1, mood));
  return s;
}

export const isOver = (s) => s.dead || s.won || s.fled;
const enemyAt = (s, x, y) => s.enemies.findIndex((e) => e.alive && e.x === x && e.y === y);

/** Apply one action. Mutates `s`; returns animation events (display only). */
export function step(s, action) {
  const ev = [];
  if (isOver(s) || s.tape.length >= MAX_TAPE) return ev;
  s.tape.push(action);
  s.turn++;
  if (action === ACT.FLEE) {
    s.fled = true;
    ev.push({ t: "flee" });
    return ev;
  }
  if (action <= 3) {
    const tx = s.px + DX[action];
    const ty = s.py + DY[action];
    ev.push({ t: "face", dir: action });
    if (s.open[ty * W + tx]) {
      const ei = enemyAt(s, tx, ty);
      if (ei >= 0) {
        const e = s.enemies[ei];
        e.hp -= s.atk;
        ev.push({ t: "attack", i: ei, x: tx, y: ty, dmg: s.atk });
        if (e.hp <= 0) {
          e.alive = false;
          s.kills++;
          s.killScore += ENEMY[e.type].value;
          ev.push({ t: "kill", i: ei, x: tx, y: ty, value: ENEMY[e.type].value });
        }
      } else {
        ev.push({ t: "move", fx: s.px, fy: s.py, x: tx, y: ty });
        s.px = tx;
        s.py = ty;
        const it = s.items.find((i) => !i.taken && i.x === tx && i.y === ty);
        if (it) {
          it.taken = true;
          if (it.kind === ITEM.SEED) {
            const v = seedValue(s.floor, s.mood);
            s.gold += v;
            ev.push({ t: "seed", x: tx, y: ty, value: v });
          } else {
            const before = s.hp;
            s.hp = Math.min(s.maxHp, s.hp + 4);
            ev.push({ t: "heal", x: tx, y: ty, value: s.hp - before });
          }
        }
        if (tx === s.stairs.x && ty === s.stairs.y) {
          if (s.floor === FLOORS) {
            s.won = true;
            ev.push({ t: "win" });
            return ev;
          }
          s.floor++;
          Object.assign(s, genFloor(s.seed, s.floor, s.mood));
          s.px = START_X;
          s.py = START_Y;
          ev.push({ t: "descend", floor: s.floor });
          return ev;
        }
      }
    } else {
      ev.push({ t: "bump", x: tx, y: ty });
    }
  }
  // Drowsy enemies in a Snooze burrow only act on even turns.
  if (s.mood === MOOD.SNOOZE && s.turn % 2 === 1) return ev;
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (!e.alive) continue;
    const info = ENEMY[e.type];
    const d = dist(e.x, e.y, s.px, s.py);
    if (d === 1) {
      s.hp -= info.atk;
      ev.push({ t: "hurt", i, dmg: info.atk, x: e.x, y: e.y });
      if (s.hp <= 0) {
        s.hp = 0;
        s.dead = true;
        ev.push({ t: "die" });
        return ev;
      }
    } else if (d <= info.sight) {
      const dx = s.px - e.x;
      const dy = s.py - e.y;
      const sx = Math.sign(dx);
      const sy = Math.sign(dy);
      const tries = Math.abs(dx) >= Math.abs(dy) ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]];
      for (const [mx, my] of tries) {
        if (mx === 0 && my === 0) continue;
        const nx = e.x + mx;
        const ny = e.y + my;
        if (s.open[ny * W + nx] && !(nx === s.px && ny === s.py) && enemyAt(s, nx, ny) < 0) {
          ev.push({ t: "emove", i, fx: e.x, fy: e.y, x: nx, y: ny });
          e.x = nx;
          e.y = ny;
          break;
        }
      }
    }
  }
  return ev;
}

export function score(s) {
  const gold = s.dead ? Math.floor(s.gold / 2) : s.gold;
  return gold + s.killScore + 20 * (s.floor - 1) + (s.won ? 100 + 5 * s.hp : 0);
}

/** Replay a full tape. A tape that ends early counts as fleeing with the loot. */
export function simulate(seed, level, mood, tape) {
  const s = newRun(seed, level, mood);
  for (const a of tape) {
    if (isOver(s)) break;
    step(s, a);
  }
  return {
    score: score(s), floor: s.floor, kills: s.kills, gold: s.gold, hp: s.hp,
    turns: s.turn, won: s.won, dead: s.dead,
  };
}
