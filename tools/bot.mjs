// A simple greedy test bot for balance checks and parity fixtures. Not used by the game.
import {
  W, H, FLOORS, MAX_TAPE, ACT, ITEM, SLINGS, newRun, step, isOver, isOpen, bossAlive,
} from "../web/engine.js";

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

function bfsStep(s, goals, throughEnemies = false) {
  const prev = new Int16Array(W * H).fill(-1);
  const start = s.py * W + s.px;
  prev[start] = start;
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    for (let d = 0; d < 4; d++) {
      const x = (c % W) + DX[d];
      const y = Math.floor(c / W) + DY[d];
      const n = y * W + x;
      if (!isOpen(s, x, y) || prev[n] !== -1) continue;
      if (!throughEnemies && s.enemies.some((e) => e.alive && e.x === x && e.y === y) && !goals.has(n)) continue;
      prev[n] = c;
      if (goals.has(n)) {
        let k = n;
        while (prev[k] !== start) k = prev[k];
        const diff = k - start;
        return diff === -W ? 0 : diff === 1 ? 1 : diff === W ? 2 : 3;
      }
      q.push(n);
    }
  }
  return -1;
}

export function botAction(s, { useSling = true, noise = 0, rand = Math.random } = {}) {
  if (noise && rand() < noise) return Math.floor(rand() * 10);
  for (let d = 0; d < 4; d++) {
    if (s.enemies.some((e) => e.alive && e.x === s.px + DX[d] && e.y === s.py + DY[d])) return d;
  }
  if (useSling && s.pebbles > 0) {
    const range = SLINGS[s.sling].range;
    for (let d = 0; d < 4; d++) {
      for (let k = 1; k <= range; k++) {
        const x = s.px + DX[d] * k;
        const y = s.py + DY[d] * k;
        if (!isOpen(s, x, y)) break;
        if (s.enemies.some((e) => e.alive && e.x === x && e.y === y)) {
          if (k > 1) return ACT.FIRE_UP + d;
          break;
        }
      }
    }
  }
  const want = (kinds) => new Set(s.items.filter((i) => !i.taken && kinds.includes(i.kind)).map((i) => i.y * W + i.x));
  if (s.hp * 2 < s.maxHp) {
    const a = bfsStep(s, want([ITEM.CHEESE]));
    if (a >= 0) return a;
  }
  let a = bfsStep(s, want([ITEM.CHEST, ITEM.SEED, ITEM.CHEESE]));
  if (a >= 0) return a;
  if (s.floor === FLOORS && bossAlive(s)) {
    const boss = s.enemies.find((e) => e.alive && e.kind === 4);
    a = bfsStep(s, new Set([boss.y * W + boss.x]));
    if (a >= 0) return a;
  }
  const stairs = new Set([s.stairs.y * W + s.stairs.x]);
  a = bfsStep(s, stairs);
  if (a < 0) a = bfsStep(s, stairs, true); // an enemy blocks the way: fight through it
  return a >= 0 ? a : ACT.WAIT;
}

export function playBot(seed, level, mood, opts = {}) {
  const s = newRun(seed, level, mood);
  while (!isOver(s) && s.tape.length < MAX_TAPE) {
    if (opts.fleeBelow && s.hp <= opts.fleeBelow && s.floor >= 3) { step(s, ACT.FLEE); break; }
    step(s, botAction(s, opts));
  }
  return s;
}
