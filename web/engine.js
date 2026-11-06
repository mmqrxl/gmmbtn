// Squeek Delve rules engine. Deterministic and integer-only.
// src/DelveRules.sol re-implements these rules exactly to verify submitted runs onchain;
// any change here must be mirrored there (tools/parity.mjs + test/DelveParity.t.sol check it).

export const W = 17;
export const H = 13;
export const FLOORS = 6;
export const MAX_TAPE = 1000;
export const MAX_ENEMIES = 10;
export const MAX_ITEMS = 16;
const CAVE_TARGET = 85;
const MIXED_EXTRA = 25;
const CARVE_CAP = 4000;
const PLACE_TRIES = 100;

export const ACT = {
  UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3, WAIT: 4, FLEE: 5,
  FIRE_UP: 6, FIRE_RIGHT: 7, FIRE_DOWN: 8, FIRE_LEFT: 9,
};
export const MOOD = { SNOOZE: 0, POTTER: 1, JOG: 2, ZOOMIES: 3 };
export const MOOD_INFO = [
  { name: "Snooze", emoji: "💤", text: "The hamster slept. The burrow is dark and enemies are drowsy (they act every other turn)." },
  { name: "Potter", emoji: "🐾", text: "A few laps. A normal burrow." },
  { name: "Jog", emoji: "🏃", text: "Proper running. Seeds +2 and an extra chest on every floor." },
  { name: "Zoomies", emoji: "⚡", text: "Full sprint! One extra enemy per floor, but every seed is worth double." },
];
export const STYLE = { CAVE: 0, ROOMS: 1, MIXED: 2 };
export const ITEM = { SEED: 0, CHEESE: 1, CHEST: 2 };
export const ENEMY = [
  { name: "beetle", hp: 2, atk: 1, sight: 4, value: 3, drop: 10 },
  { name: "snake", hp: 4, atk: 2, sight: 5, value: 6, drop: 15 },
  { name: "rat", hp: 2, atk: 1, sight: 6, value: 5, drop: 15 }, // moves two steps a turn
  { name: "mole", hp: 7, atk: 2, sight: 3, value: 10, drop: 35 }, // acts every other turn
  { name: "cat", hp: 14, atk: 3, sight: 8, value: 30, drop: 0 }, // the boss on the last floor
];
export const CAT = 4;
export const RAT = 2;
export const MOLE = 3;

export const WEAPONS = [
  { name: "Twig", atk: 1, pierce: false },
  { name: "Thorn Dagger", atk: 2, pierce: false },
  { name: "Pencil Spear", atk: 2, pierce: true },
  { name: "Acorn Hammer", atk: 3, pierce: false },
  { name: "Golden Fork", atk: 4, pierce: true },
];
export const ARMORS = [
  { name: "Bare fur", def: 0 },
  { name: "Walnut Helm", def: 1 },
  { name: "Thimble Mail", def: 2 },
  { name: "Chestnut Plate", def: 3 },
];
export const SLINGS = [
  { name: "Pebble Toss", dmg: 1, range: 4 },
  { name: "Rubber Sling", dmg: 2, range: 5 },
  { name: "Pea Shooter", dmg: 3, range: 6 },
];
const START_PEBBLES = 5;
const START_CRIT = 5;
const MAX_CRIT = 50;

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** One xorshift32 step on a uint32 held in a JS number. */
function xs(x) {
  x = (x ^ (x << 13)) >>> 0;
  x = (x ^ (x >>> 17)) >>> 0;
  return (x ^ (x << 5)) >>> 0;
}
function rng(seed) {
  let x = seed >>> 0 || 1;
  return () => (x = xs(x));
}

export const moodForWork = (work) => (work >= 300 ? 3 : work >= 100 ? 2 : work >= 1 ? 1 : 0);
export const biomeOf = (floor) => (floor <= 2 ? 0 : floor <= 4 ? 1 : 2);
export const playerStats = (level) => {
  const l = Math.min(10, Math.max(1, level));
  return { maxHp: 10 + 2 * l, atk: 1 + Math.floor(l / 3) };
};
export function seedValue(floor, mood) {
  let v = 3 + floor;
  if (mood === MOOD.JOG) v += 2;
  if (mood === MOOD.ZOOMIES) v *= 2;
  return v;
}
function poolKind(floor, r) {
  if (floor === 1) return r % 3 === 2 ? RAT : 0;
  if (floor === 2) return r % 3;
  if (floor <= 4) return r % 4;
  if (floor === 5) { const m = r % 4; return m === 0 ? 1 : m === 1 ? 2 : 3; }
  return 1 + (r % 3);
}
const enemyHp = (kind, floor) => ENEMY[kind].hp + (kind === CAT ? 0 : Math.floor((floor - 1) / 2));
const enemyAtk = (kind, floor) => ENEMY[kind].atk + (kind === CAT ? 0 : Math.floor((floor - 1) / 3));
const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

// ------------------------------------------------------------- generation

export function genFloor(seed, floor, mood) {
  const next = rng((seed ^ Math.imul(floor, 0x9e3779b9)) >>> 0);
  const open = new Uint8Array(W * H);
  let count = 0;
  const carve = (x, y) => { if (!open[y * W + x]) { open[y * W + x] = 1; count++; } };
  const walk = (x, y, target) => {
    for (let i = 0; i < CARVE_CAP && count < target; i++) {
      const d = next() % 4;
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 1 || nx > W - 2 || ny < 1 || ny > H - 2) continue;
      x = nx;
      y = ny;
      carve(x, y);
    }
  };

  const style = floor === FLOORS ? STYLE.ROOMS : next() % 3;
  let startX;
  let startY;
  if (style === STYLE.CAVE) {
    startX = 2 + (next() % (W - 4));
    startY = 2 + (next() % (H - 4));
    carve(startX, startY);
    walk(startX, startY, CAVE_TARGET);
  } else {
    const nRooms = style === STYLE.ROOMS ? 4 + (next() % 3) : 3 + (next() % 2);
    let px = 0;
    let py = 0;
    for (let k = 0; k < nRooms; k++) {
      const rw = 3 + (next() % 3);
      const rh = 3 + (next() % 2);
      const rx = 1 + (next() % (W - 1 - rw));
      const ry = 1 + (next() % (H - 1 - rh));
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) carve(x, y);
      const cx = rx + Math.floor(rw / 2);
      const cy = ry + Math.floor(rh / 2);
      if (k === 0) {
        startX = cx;
        startY = cy;
      } else {
        const hFirst = next() % 2 === 0;
        let x = px;
        let y = py;
        if (hFirst) {
          while (x !== cx) { x += Math.sign(cx - x); carve(x, y); }
          while (y !== cy) { y += Math.sign(cy - y); carve(x, y); }
        } else {
          while (y !== cy) { y += Math.sign(cy - y); carve(x, y); }
          while (x !== cx) { x += Math.sign(cx - x); carve(x, y); }
        }
      }
      px = cx;
      py = cy;
    }
    if (style === STYLE.MIXED) walk(px, py, count + MIXED_EXTRA);
  }

  let sx = startX;
  let sy = startY;
  let best = 0;
  for (let cy = 1; cy <= H - 2; cy++) {
    for (let cx = 1; cx <= W - 2; cx++) {
      const dd = dist(cx, cy, startX, startY);
      if (open[cy * W + cx] && dd > best) { best = dd; sx = cx; sy = cy; }
    }
  }

  const enemies = [];
  const items = [];
  const taken = (cx, cy) => (cx === startX && cy === startY) || (cx === sx && cy === sy)
    || enemies.some((e) => e.x === cx && e.y === cy) || items.some((it) => it.x === cx && it.y === cy);
  const place = (minDist) => {
    for (let t = 0; t < PLACE_TRIES; t++) {
      const cx = 1 + (next() % (W - 2));
      const cy = 1 + (next() % (H - 2));
      if (open[cy * W + cx] && !taken(cx, cy) && dist(cx, cy, startX, startY) >= minDist) return [cx, cy];
    }
    return null;
  };

  const nEnemies = Math.min(MAX_ENEMIES, 2 + floor + (mood === MOOD.ZOOMIES ? 1 : 0));
  for (let k = 0; k < nEnemies; k++) {
    const r = next();
    const kind = floor === FLOORS && k === 0 ? CAT : poolKind(floor, r);
    const p = place(3);
    if (p) enemies.push({ kind, x: p[0], y: p[1], hp: enemyHp(kind, floor), atk: enemyAtk(kind, floor), alive: true });
  }
  const addItems = (kind, n, minDist) => {
    for (let k = 0; k < n; k++) {
      const p = place(minDist);
      if (p) items.push({ kind, x: p[0], y: p[1], taken: false });
    }
  };
  addItems(ITEM.SEED, 3 + (next() % 3), 1);
  addItems(ITEM.CHEESE, 1 + (floor >= 3 ? next() % 2 : 0), 1);
  addItems(ITEM.CHEST, 1 + (next() % 2) + (mood === MOOD.JOG ? 1 : 0), 2);

  return { style, open, start: { x: startX, y: startY }, stairs: { x: sx, y: sy }, enemies, items };
}

// ------------------------------------------------------------------ play

export function newRun(seed, level, mood) {
  const { maxHp, atk } = playerStats(level);
  const s = {
    seed: seed >>> 0, level, mood, maxHp, baseAtk: atk, hp: maxHp,
    weapon: 0, armor: 0, sling: 0, pebbles: START_PEBBLES, crit: START_CRIT, luck: 0,
    floor: 1, px: 0, py: 0, gold: 0, kills: 0, killScore: 0, turn: 0,
    dead: false, won: false, fled: false, tape: [],
    rng: (seed ^ 0x85ebca6b) >>> 0 || 1,
  };
  enterFloor(s, 1);
  return s;
}

function enterFloor(s, floor) {
  s.floor = floor;
  Object.assign(s, genFloor(s.seed, floor, s.mood));
  s.px = s.start.x;
  s.py = s.start.y;
}

const roll = (s) => (s.rng = xs(s.rng));
export const isOver = (s) => s.dead || s.won || s.fled;
export const isOpen = (s, x, y) => x >= 0 && y >= 0 && x < W && y < H && s.open[y * W + x] === 1;
const enemyAt = (s, x, y) => s.enemies.findIndex((e) => e.alive && e.x === x && e.y === y);
export const bossAlive = (s) => s.floor === FLOORS && s.enemies.some((e) => e.kind === CAT && e.alive);
export const playerAtk = (s) => s.baseAtk + WEAPONS[s.weapon].atk;

function hit(s, i, dmg, ev, crit) {
  const e = s.enemies[i];
  e.hp -= dmg;
  ev.push({ t: "hit", i, x: e.x, y: e.y, dmg, crit });
  if (e.hp > 0) return;
  e.alive = false;
  s.kills++;
  s.killScore += ENEMY[e.kind].value;
  ev.push({ t: "kill", i, x: e.x, y: e.y, value: ENEMY[e.kind].value, kind: e.kind });
  const r = roll(s);
  if (r % 100 < ENEMY[e.kind].drop && s.items.length < MAX_ITEMS
    && !s.items.some((it) => !it.taken && it.x === e.x && it.y === e.y)) {
    const kind = roll(s) % 2 === 0 ? ITEM.CHEST : ITEM.CHEESE;
    s.items.push({ kind, x: e.x, y: e.y, taken: false });
    ev.push({ t: "drop", x: e.x, y: e.y, kind });
  }
}

function openChest(s, ev) {
  const cat = roll(s) % 10;
  const gear = (slot, list, spread) => {
    const t = Math.min(list.length - 1, 1 + (roll(s) % (1 + Math.floor(s.floor / spread))));
    if (t > s[slot]) {
      s[slot] = t;
      ev.push({ t: "loot", slot, tier: t, name: list[t].name });
    } else {
      s.gold += 4 * t;
      ev.push({ t: "salvage", slot, tier: t, name: list[t].name, value: 4 * t });
    }
  };
  if (cat <= 1) gear("weapon", WEAPONS, 2);
  else if (cat <= 3) gear("armor", ARMORS, 3);
  else if (cat === 4) gear("sling", SLINGS, 3);
  else if (cat === 5) { s.pebbles += 4; ev.push({ t: "loot", slot: "pouch", name: "Pebble Pouch" }); }
  else if (cat === 6) { s.maxHp += 3; s.hp += 3; ev.push({ t: "loot", slot: "vitamin", name: "Vitamin" }); }
  else if (cat === 7) { s.crit = Math.min(MAX_CRIT, s.crit + 10); ev.push({ t: "loot", slot: "clover", name: "Four-leaf Clover" }); }
  else if (cat === 8) { s.luck += 1; ev.push({ t: "loot", slot: "whisker", name: "Lucky Whisker" }); }
  else { s.hp = s.maxHp; ev.push({ t: "loot", slot: "bigcheese", name: "Big Cheese" }); }
}

function pickup(s, x, y, ev) {
  const it = s.items.find((i) => !i.taken && i.x === x && i.y === y);
  if (!it) return;
  it.taken = true;
  if (it.kind === ITEM.SEED) {
    const v = seedValue(s.floor, s.mood) + s.luck;
    s.gold += v;
    ev.push({ t: "seed", x, y, value: v });
  } else if (it.kind === ITEM.CHEESE) {
    const before = s.hp;
    s.hp = Math.min(s.maxHp, s.hp + 5);
    ev.push({ t: "heal", x, y, value: s.hp - before });
  } else {
    ev.push({ t: "chest", x, y });
    openChest(s, ev);
  }
}

function stepToward(s, i, ev) {
  const e = s.enemies[i];
  const dx = s.px - e.x;
  const dy = s.py - e.y;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const tries = Math.abs(dx) >= Math.abs(dy) ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]];
  for (const [mx, my] of tries) {
    if (mx === 0 && my === 0) continue;
    const nx = e.x + mx;
    const ny = e.y + my;
    if (isOpen(s, nx, ny) && !(nx === s.px && ny === s.py) && enemyAt(s, nx, ny) < 0) {
      ev.push({ t: "emove", i, fx: e.x, fy: e.y, x: nx, y: ny });
      e.x = nx;
      e.y = ny;
      return;
    }
  }
}

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
    if (!isOpen(s, tx, ty)) {
      ev.push({ t: "bump", x: tx, y: ty });
    } else {
      const ei = enemyAt(s, tx, ty);
      if (ei >= 0) {
        let dmg = playerAtk(s);
        const crit = roll(s) % 100 < s.crit;
        if (crit) dmg *= 2;
        ev.push({ t: "attack", x: tx, y: ty });
        hit(s, ei, dmg, ev, crit);
        if (WEAPONS[s.weapon].pierce) {
          const bx = tx + DX[action];
          const by = ty + DY[action];
          if (isOpen(s, bx, by)) {
            const bj = enemyAt(s, bx, by);
            if (bj >= 0) hit(s, bj, dmg, ev, crit);
          }
        }
      } else {
        ev.push({ t: "move", fx: s.px, fy: s.py, x: tx, y: ty });
        s.px = tx;
        s.py = ty;
        pickup(s, tx, ty, ev);
        if (tx === s.stairs.x && ty === s.stairs.y) {
          if (s.floor === FLOORS) {
            if (!bossAlive(s)) {
              s.won = true;
              ev.push({ t: "win" });
              return ev;
            }
            ev.push({ t: "locked" });
          } else {
            const heal = Math.floor(s.maxHp / 4);
            s.hp = Math.min(s.maxHp, s.hp + heal);
            enterFloor(s, s.floor + 1);
            ev.push({ t: "descend", floor: s.floor, heal });
            return ev;
          }
        }
      }
    }
  } else if (action >= ACT.FIRE_UP && action <= ACT.FIRE_LEFT) {
    const d = action - ACT.FIRE_UP;
    ev.push({ t: "face", dir: d });
    if (s.pebbles > 0) {
      s.pebbles--;
      const sl = SLINGS[s.sling];
      let ex = s.px;
      let ey = s.py;
      let target = -1;
      for (let k = 1; k <= sl.range; k++) {
        const x = s.px + DX[d] * k;
        const y = s.py + DY[d] * k;
        if (!isOpen(s, x, y)) break;
        ex = x;
        ey = y;
        target = enemyAt(s, x, y);
        if (target >= 0) break;
      }
      ev.push({ t: "shot", fx: s.px, fy: s.py, x: ex, y: ey });
      if (target >= 0) hit(s, target, sl.dmg, ev, false);
    } else {
      ev.push({ t: "empty" });
    }
  }

  if (s.mood === MOOD.SNOOZE && s.turn % 2 === 1) return ev;
  const def = ARMORS[s.armor].def;
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (!e.alive) continue;
    if (e.kind === MOLE && s.turn % 2 === 1) continue;
    const d = dist(e.x, e.y, s.px, s.py);
    if (d === 1) {
      const dmg = Math.max(1, e.atk - def);
      s.hp -= dmg;
      ev.push({ t: "hurt", i, dmg, x: e.x, y: e.y });
      if (s.hp <= 0) {
        s.hp = 0;
        s.dead = true;
        ev.push({ t: "die" });
        return ev;
      }
    } else if (d <= ENEMY[e.kind].sight) {
      stepToward(s, i, ev);
      if (e.kind === RAT && dist(e.x, e.y, s.px, s.py) > 1) stepToward(s, i, ev);
    }
  }
  return ev;
}

export function score(s) {
  const gold = s.dead ? Math.floor(s.gold / 2) : s.gold;
  return gold + s.killScore + 25 * (s.floor - 1) + (s.won ? 150 + 5 * s.hp : 0);
}

/** Replay a full tape. A tape that ends early counts as fleeing with the loot. */
export function simulate(seed, level, mood, tape) {
  const s = newRun(seed, level, mood);
  for (const a of tape) {
    if (isOver(s)) break;
    step(s, a);
  }
  return {
    score: score(s), floor: s.floor, kills: s.kills, gold: s.gold, hp: s.hp, turns: s.turn,
    won: s.won, dead: s.dead, weapon: s.weapon, armor: s.armor, sling: s.sling,
  };
}
