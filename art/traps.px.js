// Squeek Delve: floor traps and the stun effect (sheet "traps").
// Rebuild: node <pxl>/bin/pxl.js build art/traps.px.js, then copy out/traps.png + traps.json to web/assets/.
// Same rules as delve.px.js: ink outline, light from the top-left. Transparent frames drawn over any
// of the eight biome floors, so every trap keeps a full ink rim to read on light and dark ground.
// Never use the hero fur hexes #E8B07A / #C98A54 / #8A5A34 here: the game recolors them at runtime.

// Shared colors copied from delve.px.js / items.px.js / biomes.px.js (same keys, same hexes).
pal({
  k: "#14101C",
  K: "#2A1E25", D: "#3E2C29", f: "#5C4131", F: "#745439", l: "#96704C", L: "#BC9864",   // earth / acorn
  s: "#5E5A6A", S: "#8F8C99", I: "#C6CAD8", w: "#FFFFFF",         // iron -> polished silver
  r: "#8C2E3A", R: "#D2483E", n: "#F08AA0",                       // red light
  o: "#A8642A", y: "#F5C451", Y: "#FFF0A8",                       // gold stars
  m: "#191828", M: "#2A2840", p: "#3B3958", P: "#504D74", x: "#6E6C9A",   // slate
  h: "#0A081266",                                                 // soft contact shadow
})
ramps("kKDfFlL", "sSIw", "rRn", "oyY", "mMpPx")

const T14 = { w: 14, h: 14, outline: "k" }   // 14x14 + outline = 16x16

// ------------------------------------------------------------------ spike plate
// A square plate seen in 3/4: lit top (y 4..11) and a 2px front face, six holes in two rows.
const HOLES = [[2, 6], [6, 6], [10, 6], [2, 9], [6, 9], [10, 9]]
sprite("_plate", { w: 14, h: 14 },
  rect(0, 4, 14, 8, "s"),
  hline(0, 4, 14, "S"), vline(0, 4, 8, "S"),
  vline(13, 5, 7, "p"), hline(1, 11, 13, "p"),
  hline(0, 12, 14, "M"), hline(0, 13, 14, "m"),
  px(0, 12, "p"))
// a steel spike rising from the hole at (x, y): lit left column, shaded right, white tip
const spike = (x, y, h) => (c) => {
  c.px(x, y + 1, "k"); c.px(x + 1, y + 1, "k")
  for (let i = 0; i < h; i++) { c.px(x, y - i, "I"); c.px(x + 1, y - i, "S") }
  c.px(x + 1, y - h + 1, "k"); c.px(x, y - h + 1, "w"); c.px(x, y - h + 2, "I")
  c.px(x + 1, y - h + 2, "s")
}
sprite("trap_spike_0", T14,
  stamp("_plate", 0, 0),
  ...HOLES.map(([x, y]) => grid(x, y, "kk\nkS")))
sprite("trap_spike_1", T14,
  stamp("_plate", 0, 0),
  ...HOLES.map(([x, y]) => grid(x, y, "kk\nkk")),
  ...HOLES.map(([x, y]) => spike(x, y, 6)))

// ------------------------------------------------------------------ acorn mine
// An acorn-shaped bomb sunk in a ring of churned soil, a short fuse with a red light on top.
sprite("_mine", { w: 14, h: 14 },
  ellipse(7, 11, 6, 2, "h"),
  // nut body (buried below y 11)
  ellipse(7, 8, 4, 4, "F"),
  clip([0, 0, 7, 9], ellipse(7, 8, 4, 4, "l")), px(5, 7, "L"), px(4, 8, "L"),
  clip((x, y) => x > 8 && y > 7, ellipse(7, 8, 4, 4, "f")),
  // cap
  ellipse(7, 5, 5, 2, "D"),
  hline(3, 4, 7, "f"), px(4, 5, "F"), px(6, 5, "f"), px(8, 5, "f"), px(10, 5, "K"), px(9, 6, "K"), px(5, 6, "K"),
  // churned soil lip hiding the bottom of the nut
  hline(1, 11, 12, "D"), hline(2, 12, 10, "K"), px(1, 11, "f"), px(3, 11, "F"), px(4, 10, "f"), px(10, 10, "f"), px(11, 11, "F"),
  // fuse stem + light
  vline(7, 1, 2, "s"), px(7, 2, "S"))
sprite("trap_mine_0", T14, stamp("_mine", 0, 0), px(7, 0, "r"), px(6, 0, "r"))
sprite("trap_mine_1", T14, stamp("_mine", 0, 0), px(7, 0, "n"), px(6, 0, "R"),
  glow("n", { r: 3, strength: 0.6, bands: 2 }))

// ------------------------------------------------------------------ silk snare
// Open: a flat loop of sticky silk with a knot on the right and a tail to a pin.
sprite("trap_snare_0", T14,
  ellipse(6, 8, 5, 3, "h"),
  ellipse(6, 8, 5, 3, "S", true),
  clip([0, 0, 14, 8], ellipse(6, 8, 5, 3, "I", true)),
  px(2, 6, "w"), px(4, 5, "w"),
  // knot + tail
  grid(10, 6, `
    wI.
    ISS
    .S.`),
  line(12, 8, 13, 11, "S"),
  // stray sticky threads
  px(3, 10, "I"), px(6, 12, "S"))
// Shut: cinched up into a tight raised loop, cords pulled taut from the ground.
sprite("trap_snare_1", T14,
  ellipse(7, 12, 4, 1, "h"),
  line(4, 12, 6, 7, "S"), line(10, 12, 8, 7, "S"),
  ellipse(7, 5, 3, 3, "I", true), clip([0, 5, 14, 9], ellipse(7, 5, 3, 3, "S", true)),
  px(5, 3, "w"), px(6, 2, "w"),
  grid(6, 7, `
    wI.
    ISS`))

// ------------------------------------------------------------------ stun stars
// Three stars orbiting a flat ellipse over the head; front stars big, back ones small.
const star = (x, y, big) => big
  ? [px(x, y, "Y"), px(x - 1, y, "y"), px(x + 1, y, "y"), px(x, y - 1, "y"), px(x, y + 1, "o")]
  : [px(x, y, "y")]
const orbit = (rot) => {
  const out = []
  for (let i = 0; i < 3; i++) {
    const t = rot + (i * 2 * Math.PI) / 3
    const x = Math.round(6.5 + 5 * Math.cos(t)), y = Math.round(2 + 1.2 * Math.sin(t))
    out.push(...star(x, y, Math.sin(t) > -0.3))
  }
  return out
}
sprite("stun_0", T14, ...orbit(Math.PI / 6))
sprite("stun_1", T14, ...orbit(Math.PI / 6 + Math.PI / 3))

// ------------------------------------------------------------------ HUD icon (6x6 + outline = 8x8)
sprite("icon_trap", { w: 6, h: 6, outline: "k" }, `
  .I..I.
  .S..S.
  SIssIs
  SssSss
  pppppp
  MMMMMM`)

sheet("traps", ["trap_spike_0", "trap_spike_1", "trap_mine_0", "trap_mine_1", "trap_snare_0", "trap_snare_1",
  "stun_0", "stun_1", "icon_trap"], { pad: 1 })

// ------------------------------------------------------------------ test scene (not in the sheet)
// Every trap frame on each biome's floor color, light floors and dark floors.
const FLOORS = ["#5C4131", "#73302A", "#3B3958", "#2A2942", "#A9C6DE", "#2B2527", "#8A846F", "#141128"]
const FR = ["trap_spike_0", "trap_spike_1", "trap_mine_0", "trap_mine_1", "trap_snare_0", "trap_snare_1", "stun_0", "stun_1", "icon_trap"]
scene("_traps_test", { w: FR.length * 18 + 2, h: FLOORS.length * 18 + 2, bg: "#000000" },
  ...FLOORS.flatMap((col, r) => FR.flatMap((n, i) => [
    rect(2 + i * 18, 2 + r * 18, 16, 16, col),
    stamp(n, 2 + i * 18 + (n === "icon_trap" ? 4 : 0), 2 + r * 18 + (n === "icon_trap" ? 4 : 0)),
  ])))
