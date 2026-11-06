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
})
ramps("kKDfFlL", "sSIw", "rRn", "oyY", "mMpPx")

const T14 = { w: 14, h: 14, outline: "k" }   // 14x14 + outline = 16x16

// ------------------------------------------------------------------ spike plate
// A square plate seen in 3/4: lit top (y 4..11) and a 2px front face. Five holes: three at the
// back, two at the front sitting in the gaps, so sprung spikes never hide each other.
const HOLES = [[2, 6], [6, 6], [10, 6], [4, 9], [8, 9]]
sprite("_plate", { w: 14, h: 14 },
  rect(0, 4, 14, 8, "p"),
  hline(0, 4, 14, "x"), vline(0, 4, 8, "P"), px(0, 4, "S"),
  vline(13, 5, 7, "M"), hline(1, 11, 13, "M"),
  hline(0, 12, 14, "M"), hline(0, 13, 14, "m"),
  px(0, 12, "p"), px(1, 5, "x"), px(12, 10, "m"))
// a steel spike rising from the hole at (x, y): 1px tip, then lit left / dark right column
const spike = (x, y, h, lit, dark) => (c) => {
  for (let i = 0; i < h - 1; i++) { c.px(x, y - i, lit); c.px(x + 1, y - i, dark) }
  c.px(x + 1, y - h + 2, "k")
  c.px(x, y - h + 1, "w")
  c.px(x, y, dark); c.px(x + 1, y, "k")   // base sinks into the hole's shadow
  c.px(x, y + 1, "k"); c.px(x + 1, y + 1, "k")
}
sprite("trap_spike_0", T14,
  stamp("_plate", 0, 0),
  ...HOLES.map(([x, y]) => grid(x, y, "kk\nSk")))
sprite("trap_spike_1", T14,
  stamp("_plate", 0, 0),
  ...HOLES.slice(0, 3).map(([x, y]) => spike(x, y, 7, "S", "s")),
  ...HOLES.slice(3).map(([x, y]) => spike(x, y, 8, "I", "s")))

// ------------------------------------------------------------------ acorn mine
// An acorn-shaped bomb sunk in churned soil: scaly cap, glossy nut, a fuse stem with a red light.
sprite("_mine", { w: 14, h: 14 }, `
  ..............
  ..............
  .......s......
  ....DfFfD.....
  ...DfDfDfDD...
  ..DfDfDDfDKD..
  ..KDKDDKDKKK..
  ...LLlllFFf...
  ..lLwlllFFff..
  ..lLlllFFFff..
  ..llFFFFFfff..
  .DfFDfFDDfDK..
  ..KDKDDKDKK...`)
sprite("trap_mine_0", T14, stamp("_mine", 0, 0), grid(6, 0, "rr\nrr"), px(6, 0, "R"))
sprite("trap_mine_1", T14, stamp("_mine", 0, 0), grid(6, 0, "nR\nRR"), px(6, 0, "w"),
  glow("wn", { r: 2, strength: 0.45, bands: 2 }))

// ------------------------------------------------------------------ silk snare
// Open: a flat loop of sticky silk lying on the ground, a knot on the right and a tail to a pin.
sprite("trap_snare_0", T14,
  ellipse(6, 8, 5, 3, "S", true),
  clip([0, 0, 7, 9], ellipse(6, 8, 5, 3, "I", true)),
  px(2, 7, "w"), px(4, 5, "w"),
  grid(10, 6, `
    wI.
    IIS
    .SS`),
  line(12, 9, 13, 12, "S"), px(13, 12, "s"),
  px(3, 12, "I"))   // a stray sticky strand
// Shut: the same loop cinched small and jerked off the ground, its tail pulled taut to the pin.
sprite("trap_snare_1", T14,
  hline(3, 10, 7, "m"), hline(4, 11, 5, "m"),   // ground shadow under the raised loop
  line(11, 7, 13, 12, "S"), px(13, 12, "s"),
  ellipse(6, 6, 3, 2, "S", true), clip([0, 0, 6, 6], ellipse(6, 6, 3, 2, "I", true)),
  grid(9, 4, `
    wI.
    IIS
    .SS`),
  px(4, 4, "w"),
  px(1, 2, "I"), px(2, 1, "w"), px(6, 1, "w"), px(10, 1, "I"))   // flicked silk bits: it just snapped

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
  ..w...
  w.IS.w
  I.IS.I
  SSSSSS
  ssssss
  MMMMMM`)

sheet("traps", ["trap_spike_0", "trap_spike_1", "trap_mine_0", "trap_mine_1", "trap_snare_0", "trap_snare_1",
  "stun_0", "stun_1", "icon_trap"], { pad: 1 })

// ------------------------------------------------------------------ test scene (not in the sheet)
// Every trap frame on each biome's floor color, light floors and dark floors.
const FLOORS = ["#5C4131", "#73302A", "#3B3958", "#2A2942", "#A9C6DE", "#2B2527", "#8A846F", "#141128"]
const FR = ["trap_spike_0", "trap_spike_1", "trap_mine_0", "trap_mine_1", "trap_snare_0", "trap_snare_1", "stun_0", "stun_1", "icon_trap"]
scene("traps_test", { w: FR.length * 18 + 2, h: FLOORS.length * 18 + 2, bg: "#000000" },
  ...FLOORS.flatMap((col, r) => FR.flatMap((n, i) => [
    rect(2 + i * 18, 2 + r * 18, 16, 16, col),
    stamp(n, 2 + i * 18 + (n === "icon_trap" ? 4 : 0), 2 + r * 18 + (n === "icon_trap" ? 4 : 0)),
  ])))
