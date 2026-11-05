// Generates test/fixtures/parity.json: runs played by the JS engine (web/engine.js), which the
// Forge test replays through DelveEngine.sol and must match exactly.
// Usage: node tools/parity.mjs
import { writeFileSync } from "node:fs";
import {
  W, H, FLOORS, MAX_TAPE, ACT, newRun, step, isOver, simulate, genFloor,
} from "../web/engine.js";

let s0 = 0x5eed1234;
const rand = () => ((s0 = (Math.imul(s0, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

// Greedy test bot: attack adjacent enemies, else walk (BFS) to the nearest seed/cheese, else stairs.
function botTape(seed, level, mood, noise, fleeAt) {
  const s = newRun(seed, level, mood);
  while (!isOver(s) && s.tape.length < MAX_TAPE) {
    if (s.hp <= fleeAt && rand() < 0.5) { step(s, ACT.FLEE); break; }
    if (rand() < noise) { step(s, Math.floor(rand() * 5)); continue; }
    let act = -1;
    for (let d = 0; d < 4 && act < 0; d++) {
      if (s.enemies.some((e) => e.alive && e.x === s.px + DX[d] && e.y === s.py + DY[d])) act = d;
    }
    if (act < 0) {
      const goals = new Set(s.items.filter((i) => !i.taken).map((i) => i.y * W + i.x));
      if (!goals.size) goals.add(s.stairs.y * W + s.stairs.x);
      const prev = new Int16Array(W * H).fill(-1);
      const start = s.py * W + s.px;
      prev[start] = start;
      const q = [start];
      let found = -1;
      while (q.length && found < 0) {
        const c = q.shift();
        for (let d = 0; d < 4; d++) {
          const n = c + DY[d] * W + DX[d];
          if (prev[n] !== -1 || !s.open[n]) continue;
          if (s.enemies.some((e) => e.alive && e.y * W + e.x === n)) continue;
          prev[n] = c;
          if (goals.has(n)) { found = n; break; }
          q.push(n);
        }
      }
      if (found >= 0) {
        let c = found;
        while (prev[c] !== start) c = prev[c];
        const diff = c - start;
        act = diff === -W ? 0 : diff === 1 ? 1 : diff === W ? 2 : 3;
      } else act = ACT.WAIT;
    }
    step(s, act);
  }
  return s.tape;
}

const cases = [];
for (let i = 0; i < 160; i++) {
  const seed = Math.floor(rand() * 2 ** 32) >>> 0;
  const level = 1 + Math.floor(rand() * 10);
  const mood = Math.floor(rand() * 4);
  let tape;
  if (i % 4 === 3) {
    tape = Array.from({ length: 1 + Math.floor(rand() * 200) }, () => Math.floor(rand() * 7));
  } else {
    tape = botTape(seed, level, mood, i % 4 === 0 ? 0 : 0.15, i % 4 === 2 ? 4 : -1);
  }
  const r = simulate(seed, level, mood, tape);
  cases.push({
    seed, level, mood, tape: "0x" + Buffer.from(tape).toString("hex"),
    score: r.score, floor: r.floor, kills: r.kills, gold: r.gold, hp: r.hp, turns: r.turns,
    won: r.won, dead: r.dead,
  });
}

const layouts = [];
for (let i = 0; i < 40; i++) {
  const seed = Math.floor(rand() * 2 ** 32) >>> 0;
  const floor = 1 + (i % FLOORS);
  const mood = i % 4;
  const f = genFloor(seed, floor, mood);
  let open = 0n;
  f.open.forEach((v, idx) => { if (v) open |= 1n << BigInt(idx); });
  layouts.push({
    seed, floor, mood, open: open.toString(), sx: f.stairs.x, sy: f.stairs.y,
    enemies: f.enemies.flatMap((e) => [e.type, e.x, e.y]),
    items: f.items.flatMap((it) => [it.kind, it.x, it.y]),
  });
}

writeFileSync(new URL("../test/fixtures/parity.json", import.meta.url), JSON.stringify({ cases, layouts }, null, 1));
const won = cases.filter((c) => c.won).length;
const dead = cases.filter((c) => c.dead).length;
const deep = cases.filter((c) => c.floor >= 3).length;
console.log(`cases=${cases.length} won=${won} dead=${dead} floor>=3=${deep} maxTurns=${Math.max(...cases.map((c) => c.turns))} layouts=${layouts.length}`);
