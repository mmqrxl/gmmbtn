// Generates test/fixtures/parity.json from the JS engine (web/engine.js). The Forge tests replay
// every case through DelveRules.sol, checkpoint by checkpoint, and require identical results.
// Usage: node tools/parity.mjs   (needs Foundry's `cast` for the integration seed)
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  FLOORS, ACT, newRun, step, isOver, genFloor, fromProgress, progressOf, score, PROGRESS_FIELDS,
} from "../web/engine.js";
import { botAction } from "./bot.mjs";

let s0 = 0x5eed1234;
const rand = () => ((s0 = (Math.imul(s0, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const hex = (a) => "0x" + Buffer.from(a).toString("hex");
const MAX_CHUNK = 1500;

/** Plays from state `s` with the bot until over or `maxTurns`, then flees so the tape ends cleanly. */
function play(s, opts, maxTurns) {
  const cuts = [];
  while (!isOver(s) && s.tape.length < maxTurns) {
    step(s, opts.junk ? Math.floor(rand() * 16) : botAction(s, { ...opts, rand }));
    if (s.boundary) cuts.push(s.tape.length);
  }
  if (!isOver(s)) {
    step(s, ACT.FLEE);
    cuts.push(s.tape.length);
  }
  // Group whole floors into chunks of at most MAX_CHUNK actions (a long floor may be a chunk alone).
  const chunks = [];
  let from = 0;
  let prev = 0;
  for (const c of cuts) {
    if (c - from > MAX_CHUNK && prev > from) {
      chunks.push(s.tape.slice(from, prev));
      from = prev;
    }
    prev = c;
  }
  chunks.push(s.tape.slice(from, prev));
  return chunks.map(hex);
}

const out = (s) => ({ final: Object.fromEntries(PROGRESS_FIELDS.map((k) => [k, typeof s[k] === "boolean" ? s[k] : String(s[k])])), score: score(s) });

const cases = [];
// Fresh runs from floor 1 with different bots, moods and levels.
for (let i = 0; i < 36; i++) {
  const seed = Math.floor(rand() * 2 ** 32) >>> 0;
  const level = 1 + Math.floor(rand() * 10);
  const mood = i % 4;
  const s = newRun(seed, level, mood);
  const opts = { useSling: i % 3 !== 1, noise: i % 3 === 2 ? 0.08 : 0, junk: i % 9 === 8 };
  const chunks = play(s, opts, 2500);
  cases.push({ seed, mood, level, start: null, chunks, ...out(s) });
}
// Deep checkpoints: strong delvers dropped onto deep floors, to cover big maps, late monsters,
// bosses (including the Cat Emperor on floor 200) and top-tier loot.
const deepFloors = [37, 50, 79, 100, 123, 150, 160, 188, 199, 200];
for (let i = 0; i < deepFloors.length * 2; i++) {
  const floor = deepFloors[i % deepFloors.length];
  const seed = Math.floor(rand() * 2 ** 32) >>> 0;
  const mood = i % 4;
  const strong = i % 2 === 0;
  const start = {
    ...progressOf(newRun(seed, 10, mood)),
    floor, maxHp: strong ? 900 : 250, hp: strong ? 900 : 250, atk: strong ? 70 : 25, def: strong ? 12 : 4,
    weapon: (i * 7) % 16, armor: (i * 5) % 12, sling: (i * 3) % 8, pebbles: 30, crit: 25, luck: 3,
    goldPct: 40, leech: 2, regen: 4, dodge: 10, vision: 1, xp: 0, lvl: 30, turn: 1000,
  };
  const s = fromProgress(seed, mood, start);
  const chunks = play(s, {}, 1800);
  cases.push({ seed, mood, level: 10, start: Object.fromEntries(Object.entries(start).map(([k, v]) => [k, typeof v === "boolean" ? v : String(v)])), chunks, ...out(s) });
}

const layouts = [];
for (let i = 0; i < 60; i++) {
  const seed = Math.floor(rand() * 2 ** 32) >>> 0;
  const floor = i < 20 ? 1 + i : 1 + Math.floor(rand() * FLOORS);
  const mood = i % 4;
  const f = genFloor(seed, floor, mood);
  const words = new Array(Math.ceil((f.w * f.h) / 256)).fill(0n);
  f.open.forEach((v, idx) => { if (v) words[idx >> 8] |= 1n << BigInt(idx & 255); });
  layouts.push({
    seed, floor, mood, open: words.map(String), style: f.style,
    geo: [f.w, f.h, f.start.x, f.start.y, f.stairs.x, f.stairs.y],
    enemies: f.enemies.flatMap((e) => [e.kind, e.x, e.y, e.hp, e.atk]),
    items: f.items.flatMap((it) => [it.kind, it.x, it.y]),
  });
}

// Integration run for test/SqueekDelve.t.sol: the seed SqueekDelve.startRun derives when
// prevrandao = 0xbeef, blockhash(n-1) = 0xcafe, runId 0, tokenId 2, player = 0xA11CE.
const enc = execSync(`cast abi-encode "f(uint256,bytes32,uint256,uint256,address)" 0xbeef 0x${"cafe".padStart(64, "0")} 0 2 0x${"a11ce".padStart(40, "0")}`).toString().trim();
const iseed = Number(BigInt(execSync(`cast keccak ${enc}`).toString().trim()) & 0xffffffffn);
const is = newRun(iseed, 9, 1);
const ichunks = play(is, {}, 3000);
const integration = { seed: iseed, level: 9, mood: 1, chunks: ichunks, ...out(is) };

writeFileSync(new URL("../test/fixtures/parity.json", import.meta.url), JSON.stringify({ cases, layouts, integration }));
const deepest = Math.max(...cases.map((c) => +c.final.floor));
console.log(`cases=${cases.length} chunks=${cases.reduce((a, c) => a + c.chunks.length, 0)} dead=${cases.filter((c) => c.final.dead).length} `
  + `won=${cases.filter((c) => c.final.won).length} deepest=${deepest} layouts=${layouts.length} integration floor ${is.floor} score ${score(is)} chunks ${ichunks.length}`);
