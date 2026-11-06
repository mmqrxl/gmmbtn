// Generates test/fixtures/parity.json: runs played by the JS engine (web/engine.js), which the
// Forge test replays through DelveRules.sol and must match exactly.
// Usage: node tools/parity.mjs
import { writeFileSync } from "node:fs";
import { W, FLOORS, simulate, genFloor } from "../web/engine.js";
import { playBot } from "./bot.mjs";

let s0 = 0x5eed1234;
const rand = () => ((s0 = (Math.imul(s0, 1664525) + 1013904223) >>> 0) / 2 ** 32);

const cases = [];
for (let i = 0; i < 200; i++) {
  const seed = Math.floor(rand() * 2 ** 32) >>> 0;
  const level = 1 + Math.floor(rand() * 10);
  const mood = Math.floor(rand() * 4);
  let tape;
  if (i % 5 === 4) {
    // random junk, including out-of-range action bytes
    tape = Array.from({ length: 1 + Math.floor(rand() * 300) }, () => Math.floor(rand() * 16));
  } else {
    const opts = { useSling: i % 5 !== 1, noise: i % 5 === 2 ? 0.1 : 0, rand, fleeBelow: i % 5 === 3 ? 5 : 0 };
    tape = playBot(seed, level, mood, opts).tape;
  }
  const r = simulate(seed, level, mood, tape);
  cases.push({ seed, level, mood, tape: "0x" + Buffer.from(tape).toString("hex"), ...r });
}

const layouts = [];
for (let i = 0; i < 48; i++) {
  const seed = Math.floor(rand() * 2 ** 32) >>> 0;
  const floor = 1 + (i % FLOORS);
  const mood = i % 4;
  const f = genFloor(seed, floor, mood);
  let open = 0n;
  f.open.forEach((v, idx) => { if (v) open |= 1n << BigInt(idx); });
  layouts.push({
    seed, floor, mood, open: open.toString(), style: f.style,
    pos: [f.start.x, f.start.y, f.stairs.x, f.stairs.y],
    enemies: f.enemies.flatMap((e) => [e.kind, e.x, e.y, e.hp, e.atk]),
    items: f.items.flatMap((it) => [it.kind, it.x, it.y]),
  });
}

writeFileSync(new URL("../test/fixtures/parity.json", import.meta.url), JSON.stringify({ cases, layouts }, null, 1));
const count = (f) => cases.filter(f).length;
console.log(`cases=${cases.length} won=${count((c) => c.won)} dead=${count((c) => c.dead)} floor>=4=${count((c) => c.floor >= 4)} `
  + `gear>0=${count((c) => c.weapon + c.armor + c.sling > 0)} maxTurns=${Math.max(...cases.map((c) => c.turns))} `
  + `styles=${[0, 1, 2].map((st) => layouts.filter((l) => l.style === st).length).join("/")} W=${W}`);
