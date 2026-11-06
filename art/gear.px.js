// Squeek Delve: equipment overlays drawn over the hero, plus surface loot (sheet "gear").
// Rebuild: node <pxl>/bin/pxl.js build art/gear.px.js
// The game draws hero frame f, then eq_arm_N_f, then eq_wpn_N_f, all 16x16 at the same origin.
// Overlays never use the hero fur hexes (#E8B07A #C98A54 #8A5A34): the game recolors those.
pal({
  k: "#14101C",
  K: "#2A1E25", D: "#3E2C29", f: "#5C4131", F: "#745439", l: "#96704C", L: "#BC9864",   // earth / wood
  s: "#5E5A6A", S: "#8F8C99",                                     // stone / iron
  r: "#8C2E3A", R: "#D2483E", n: "#F08AA0",                       // red / pink
  o: "#A8642A", y: "#F5C451", Y: "#FFF0A8", w: "#FFFFFF",         // gold, light, white
  c: "#F7E3C3",                                                   // cream / bone light
  b: "#232A5C", B: "#2F6B9A", t: "#45B5AE", T: "#9EF0DC",         // deep blue -> teal crystal
  g: "#1F4A3A", G: "#3C8A44", v: "#86C452", V: "#D2E27A",         // greens
  a: "#E07B39", A: "#9C4628",                                     // orange / rust
  E: "#4A1E1F",                                                   // scorched red-black
  m: "#191828", M: "#2A2840", p: "#3B3958", P: "#504D74", x: "#6E6C9A",   // slate
  C: "#7E4FD0", N: "#C9A2FF",                                     // violet
  O: "#7D6F66",                                                   // gray-brown
  "3": "#C9B99A", "4": "#8C7D66",                                 // bone shade, bone dark
  q: "#E4F8FF", Q: "#86CDEB",                                     // frost white, ice blue
  I: "#C6CAD8",                                                   // polished silver
  U: "#1A0F2A", W: "#3A1E5C", X: "#F1E4FF",                       // void black, void violet, void glow
  Z: "#FF9A3C",                                                   // hot ember
  // new for this sheet
  "2": "#C0607A",                                                 // paw pad shade
  "1": "#E0304E",                                                 // ruby
  "6": "#5C1A45", "8": "#A8327A", "9": "#E070B8",                 // berry dark, berry, berry light
  "0": "#15111D",                                                 // weapon outline marker (becomes k or is erased)
  // hero fur: ONLY for the preview hero below, never in exported art
  H: "#E8B07A", h: "#C98A54", u: "#8A5A34",
})
ramps("kKDfFlL", "kbBtT", "kgGvV", "E2rR1n", "oyYw", "sSIw", "Aa", "mMpPx", "UWCNX", "434c", "bBQq", "689")

// ------------------------------------------------------------------ hero (copied from delve.px.js, previews only)
const HERO = `
  ........uu....
  .......unu....
  ....hhhhhhh...
  ..hHHHHHHHHh..
  .rRRRRRRRRRRh.
  rRhHHHHHHwkHh.
  r.hHHHHHHkkHHh
  .FFhHHHHHHHccn
  FllFhHHHHHcccc
  FllFuhhHHcccc.
  FFFFuhhhccccc.
  .FFuuhhhcccc..
  ..uuuuhhccc...
  ...nn....nn...`
const HR = HERO.trim().split("\n").map((r) => r.trim())
anim("_hero", { w: 14, h: 14, fps: 3, outline: "k" },
  frame(HERO),
  frame((c) => { c.grid(0, 1, HR.slice(0, 12).join("\n")); c.grid(0, 13, HR[13]) }))
// Is (x, y) inside the hero body (not its outline) in frame f? Output coords, 16x16.
const heroIn = (f, x, y) => {
  const gx = x - 1, gy = y - 1
  const row = f ? (gy === 13 ? HR[13] : gy >= 1 && gy <= 12 ? HR[gy - 1] : null) : HR[gy]
  return !!row && gx >= 0 && gx < 14 && row[gx] !== "."
}
// Anchors (frame 0; frame 1 is everything +1 y): eye (10..11, 6..7), nose (14, 8),
// front paw (12..13, 10..11), head top row 3 (x 5..11), ears (9..10, 0..2), backpack (1..4, 8..12).
const FACE = [[10, 6], [11, 6], [10, 7], [11, 7], [14, 8]]
const protectFace = (f) => (c) => { for (const [x, y] of FACE) c.px(x, y + f, "_") }

// ------------------------------------------------------------------ weapons
// Each weapon (with the paw gripping it) is drawn in frame-0 output coords in a part outlined
// with the "0" marker. The marker turns into ink, except next to the eye and on the nose, where
// it is dropped so the 1px shaft never smears the face.
const OUT0 = 0x15111dff
const faceZone = (f, x, y) => heroIn(f, x, y) && ((x <= 12 && y - f >= 5 && y - f <= 8) || (x === 14 && y - f === 8))
const PAW = [px(12, 10, "n"), px(13, 10, "n"), px(12, 11, "2"), px(13, 11, "2")]
const weapon = (i, ...items) => {
  sprite(`_w${i}`, { w: 16, h: 16, outline: "0" }, ...items, ...PAW)
  for (const f of [0, 1])
    sprite(`eq_wpn_${i}_${f}`, { w: 16, h: 16 },
      stamp(`_w${i}`, -1, f - 1),
      (c) => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
          if (c.get(x, y) >>> 0 === OUT0) c.px(x, y, faceZone(f, x, y) ? "_" : "k")
      })
}
const spark = (x, y, c1 = "y", c2 = "Y") => [px(x, y, c2), px(x - 1, y, c1), px(x + 1, y, c1), px(x, y - 1, c1), px(x, y + 1, c1)]

weapon(0,   // Twig with a leaf
  vline(13, 2, 11, "F"), px(13, 4, "l"), px(13, 7, "l"), px(14, 1, "F"),
  grid(10, 1, `
    .vv
    vvG
    .Gg`), px(14, 4, "v"))
weapon(1,   // Thorn Dagger: a broad red thorn blade on a thread-wrapped grip
  grid(13, 2, `
    .n
    Rn
    RR
    rR
    rr`), px(13, 7, "r"),
  px(13, 8, "c"), px(13, 9, "L"), px(13, 12, "D"))
weapon(2,   // Pencil Spear: graphite tip, sharpened wood, long yellow body, eraser
  px(13, 1, "s"), px(13, 2, "L"), px(14, 2, "l"),
  vline(13, 3, 7, "Y"), vline(14, 3, 5, "o"), px(13, 8, "y"), px(13, 9, "S"),
  px(13, 12, "n"))
weapon(3,   // Acorn Hammer
  vline(13, 4, 9, "F"), px(13, 6, "l"),
  rect(12, 1, 3, 3, "a"), px(12, 1, "Y"), px(14, 3, "A"), px(13, 3, "A"), px(14, 2, "A"),
  rect(10, 1, 2, 3, "F"), px(10, 1, "f"), px(11, 2, "f"), px(10, 3, "f"), px(9, 2, "f"))
weapon(4,   // Golden Fork
  vline(13, 4, 9, "y"), px(13, 5, "Y"), px(13, 12, "o"),
  hline(11, 4, 5, "y"), vline(11, 1, 3, "Y"), vline(13, 1, 3, "y"), vline(15, 1, 3, "o"), px(12, 4, "Y"),
  px(11, 1, "w"))
weapon(5,   // Bone Club: knobbly femur head
  vline(13, 4, 9, "c"), px(13, 6, "3"), px(13, 8, "3"),
  grid(12, 1, `
    c.c
    ccc
    w33
    .3.`))
weapon(6,   // Bramble Whip: wrapped grip, then a thorny vine that curls at the top
  vline(13, 9, 4, "l"), px(13, 12, "F"),
  vline(13, 4, 5, "G"), px(13, 6, "v"),
  px(14, 3, "G"), px(14, 2, "G"), px(13, 1, "G"), px(12, 1, "G"), px(11, 2, "g"), px(11, 3, "g"), px(12, 3, "v"),
  px(12, 5, "R"), px(15, 2, "R"))
weapon(7,   // Crystal Shard: faceted cyan blade on an iron guard
  vline(13, 1, 8, "t"), vline(14, 2, 4, "B"), px(13, 1, "w"), px(13, 2, "T"), px(13, 3, "T"),
  hline(12, 9, 3, "S"), px(12, 9, "I"),
  vline(13, 10, 3, "B"), px(13, 12, "S"))
weapon(8,   // Mushroom Staff: teal glowing cap
  vline(13, 4, 9, "F"), px(13, 6, "l"), px(13, 8, "l"),
  grid(11, 1, `
    .TTt.
    TwTtB
    ggggg`),
  glow("Twq", { r: 2, strength: 0.45, bands: 2 }))
weapon(9,   // Frost Needle: icy rapier, curled cup guard
  vline(13, 1, 8, "q"), px(13, 1, "w"), px(13, 4, "w"), px(13, 7, "Q"),
  px(12, 9, "Q"), px(14, 9, "Q"), px(13, 9, "B"), px(12, 8, "Q"),
  vline(13, 10, 3, "b"), px(13, 12, "Q"),
  ...spark(11, 3, "Q", "w"))
weapon(10,   // Ember Blade: short broad glowing sword
  px(13, 1, "Y"), vline(13, 2, 6, "Y"), vline(14, 2, 6, "a"), px(14, 2, "y"), px(13, 7, "y"), px(14, 7, "A"),
  hline(12, 8, 3, "M"), px(12, 8, "p"),
  vline(13, 9, 4, "E"), px(13, 12, "M"),
  px(11, 2, "Z"), px(15, 1, "a"),
  glow("Yy", { r: 2, strength: 0.45, bands: 2 }))
weapon(11,   // Rune Pick: slate head with violet runes
  vline(13, 3, 10, "F"), px(13, 6, "l"),
  hline(11, 1, 4, "x"), hline(10, 2, 6, "p"), px(10, 3, "M"), px(15, 3, "M"), px(10, 2, "M"),
  px(11, 2, "N"), px(14, 2, "X"),
  glow("NX", { r: 2, strength: 0.6, bands: 2 }))
weapon(12,   // Moonsickle: silver crescent curling over a dark grip
  vline(13, 6, 7, "M"), px(13, 8, "p"),
  px(13, 5, "S"), px(12, 4, "I"), px(11, 3, "I"), px(11, 2, "I"), px(12, 1, "w"), px(13, 1, "I"), px(14, 2, "S"),
  px(12, 3, "S"), px(12, 2, "w"))
weapon(13,   // Comet Lance: white-gold, long, comet tail
  px(13, 1, "w"), px(13, 2, "w"), hline(12, 3, 3, "Y"), px(14, 3, "y"), hline(12, 4, 3, "y"), px(14, 4, "o"),
  vline(13, 5, 8, "y"), px(13, 5, "Y"), px(13, 12, "o"),
  px(11, 2, "Q"), px(10, 2, "q"), px(11, 1, "q"), px(15, 1, "q"),
  glow("wY", { r: 2, strength: 0.5, bands: 2 }))
weapon(14,   // Void Fang: hooked black-violet fang
  vline(13, 9, 4, "W"), hline(12, 9, 3, "U"), px(13, 12, "C"),
  vline(13, 3, 6, "U"), vline(14, 3, 3, "N"), px(13, 2, "W"), px(12, 1, "N"), px(11, 1, "X"),
  glow("NX", { r: 2, strength: 0.6, bands: 2 }))
weapon(15,   // Wheel of Fate: tiny golden wheel on a handle
  vline(13, 6, 7, "o"), px(13, 7, "Y"),
  ring(13, 3, 2, "y"), px(13, 3, "w"), px(13, 2, "o"), px(13, 4, "o"), px(12, 3, "o"), px(14, 3, "o"), px(11, 2, "Y"),
  px(10, 1, "Y"),
  glow("yYw", { r: 2, strength: 0.4, bands: 2 }))

// ------------------------------------------------------------------ armor
// Drawn in frame-0 output coords, outlined; frame 1 sinks with the bob and loses the row the
// hero drops for its feet. The eyes and nose are always punched back out.
const armor = (i, ...items) => {
  sprite(`_a${i}`, { w: 16, h: 16, outline: "k" }, ...items)
  for (const f of [0, 1])
    sprite(`eq_arm_${i}_${f}`, { w: 16, h: 16 },
      clip([0, 0, 16, 14], stamp(`_a${i}`, -1, f - 1)),
      protectFace(f))
}
armor(1,   // Walnut Helm
  clip([0, 0, 16, 5], ellipse(8, 5, 5, 4, "l")),
  hline(3, 4, 11, "F"), vline(8, 1, 3, "L"), px(9, 2, "F"), px(9, 3, "F"),
  px(5, 3, "F"), px(6, 2, "F"), px(11, 2, "F"), px(12, 3, "F"), px(5, 2, "L"))
armor(2,   // Thimble Mail: silver thimble helmet with a rolled rim
  (c) => {
    for (let y = 1; y <= 4; y++) {
      const hw = [0, 2, 3, 4, 5][y]
      c.hline(8 - hw, y, 2 * hw + 1, "S")
      for (let x = 8 - hw + 1; x < 8 + hw; x++) if ((x + y) % 2 === 0) c.px(x, y, "s")
      c.px(8 - hw, y, "w")
    }
  },
  hline(3, 4, 11, "I"), px(3, 4, "w"), px(13, 4, "S"))
armor(3,   // Chestnut Plate: spiky husk on the chest with a glossy nut
  ellipse(8, 10, 4, 2, "G"), clip((x, y) => x + y >= 20, ellipse(8, 10, 4, 2, "g")),
  ellipse(8, 10, 2, 1, "A"), px(7, 10, "a"), px(8, 9, "a"),
  px(5, 8, "v"), px(11, 8, "v"), px(3, 10, "v"), px(13, 10, "g"), px(5, 12, "g"), px(11, 12, "g"), px(8, 8, "v"))
armor(4,   // Beetle Shell on the back
  ellipse(4, 9, 3, 4, "B"), clip((x) => x <= 3, ellipse(4, 9, 3, 4, "t")),
  clip((x, y) => y >= 11, ellipse(4, 9, 3, 4, "b")),
  px(3, 6, "T"), px(2, 7, "T"), vline(5, 6, 7, "b"))
armor(5,   // Pinecone Guard: overlapping scales on the chest
  ellipse(8, 10, 4, 3, "f"),
  (c) => {
    for (let row = 0; row < 3; row++)
      for (let x = 5 + (row % 2); x <= 12; x += 2) if (c.is(x, 8 + row * 2, "*")) { c.px(x, 8 + row * 2, "L"); c.px(x, 9 + row * 2, "F") }
  },
  px(8, 7, "G"))
armor(6,   // Bark Mail: a bark wrap around the body
  rect(3, 9, 11, 4, "F"), hline(3, 9, 11, "l"), hline(3, 12, 11, "D"),
  (c) => { for (const x of [4, 7, 10, 13]) c.vline(x, 10, 2, "f") },
  px(8, 10, "v"), px(9, 10, "G"), px(9, 11, "v"))
armor(7,   // Crystal Vest: cyan crystal plates with shoulder spikes
  rect(4, 9, 10, 4, "t"), hline(4, 9, 10, "T"), recolor({ t: "B" }, (x, y) => y >= 11 && x >= 9),
  vline(7, 10, 3, "B"), vline(10, 10, 3, "B"), px(5, 10, "w"),
  px(3, 6, "T"), px(3, 7, "t"), px(4, 7, "B"), px(2, 5, "w"), px(5, 8, "T"))
armor(8,   // Frost Cloak: pale blue hood and cape with an icicle hem
  clip([0, 0, 16, 5], ellipse(8, 5, 5, 3, "Q")), px(5, 3, "q"), px(6, 2, "q"),
  poly([1, 5, 5, 5, 4, 13, 0, 13], "Q"), clip((x) => x <= 1, poly([1, 5, 5, 5, 4, 13, 0, 13], "q")),
  (c) => { for (let x = 0; x <= 4; x += 2) c.px(x, 12, "w") },
  px(12, 9, "y"), px(12, 8, "Y"))
armor(9,   // Magma Plate: black rock plate with glowing seams, and a pauldron
  rect(3, 9, 11, 4, "M"), hline(3, 9, 11, "p"),
  ellipse(4, 7, 3, 2, "p"), px(3, 6, "P"), px(2, 7, "P"),
  line(6, 10, 8, 12, "a"), line(8, 10, 11, 11, "Z"), px(8, 10, "y"), px(12, 12, "R"), px(5, 8, "a"),
  glow("yZa", { r: 2, strength: 0.5, bands: 2 }))
armor(10,   // Rune Aegis: rune helm and a round rune shield on the back
  clip([0, 0, 16, 5], ellipse(8, 5, 5, 4, "p")), clip((x, y) => x + y < 10, ellipse(8, 5, 5, 4, "x")),
  hline(3, 4, 11, "I"), px(3, 4, "w"), px(8, 2, "N"), px(8, 1, "X"), px(6, 3, "N"), px(10, 3, "N"),
  circ(4, 9, 4, "I"), circ(4, 9, 3, "M"), clip((x, y) => x + y < 13, circ(4, 9, 3, "p")),
  px(4, 9, "S"), px(4, 7, "N"), px(2, 9, "N"), px(6, 9, "X"), px(4, 11, "N"), px(2, 6, "w"),
  glow("NX", { r: 2, strength: 0.6, bands: 2 }))
armor(11,   // Starweave: night-blue hooded cloak shot with stars
  clip([0, 0, 16, 5], ellipse(8, 5, 5, 3, "W")), px(6, 2, "N"),
  poly([1, 5, 6, 5, 5, 13, 0, 13], "b"), clip((x) => x <= 1, poly([1, 5, 6, 5, 5, 13, 0, 13], "W")),
  px(2, 8, "Y"), px(4, 11, "w"), px(3, 6, "y"), px(9, 3, "w"), px(11, 4, "Y"),
  px(12, 9, "y"), px(12, 8, "Y"),
  glow("Yw", { r: 2, strength: 0.5, bands: 2 }))

// ------------------------------------------------------------------ surface loot (14x14 + outline = 16x16)
const L14 = { w: 14, h: 14, outline: "k" }
sprite("_peb", { outline: "k" }, `
  .SS.
  SIsS
  Sss.`)
sprite("_pebs", { outline: "k" }, `
  SI.
  ss.`)
sprite("pebblepile", { w: 16, h: 16 },
  stamp("_peb", 1, 9), stamp("_peb", 8, 9, { flip: "x" }), stamp("_peb", 4, 6, { swap: { s: "O" } }), stamp("_pebs", 11, 11), stamp("_pebs", 6, 11))
sprite("gem", { ...L14, mx: true },
  hline(4, 5, 3, "R"), hline(3, 6, 4, "1"), hline(2, 7, 5, "1"),
  hline(2, 8, 5, "r"), hline(3, 9, 4, "r"), hline(4, 10, 3, "r"), hline(5, 11, 2, "E"), px(6, 12, "E"),
  px(4, 6, "n"), px(3, 7, "n"), px(5, 5, "w"))
sprite("_berry", { outline: "k" }, `
  .98.
  9w88
  8886
  .66.`)
sprite("_bleaf", { outline: "k" }, `
  ..vv
  .vvG
  gGG.
  g...`)
sprite("berry", { w: 16, h: 16 },
  stamp("_bleaf", 7, 2), stamp("_berry", 7, 6), stamp("_berry", 2, 8), stamp("_berry", 6, 9))
sprite("shroom", L14,
  rect(6, 9, 3, 4, "c"), vline(8, 9, 4, "3"), hline(5, 12, 5, "3"),
  clip([0, 0, 14, 9], ellipse(7, 9, 5, 4, "R")), clip((x, y) => x + y > 15, clip([0, 0, 14, 9], ellipse(7, 9, 5, 4, "r"))),
  hline(3, 8, 9, "r"), px(4, 6, "w"), px(7, 6, "w"), px(8, 7, "w"), px(10, 7, "w"), px(6, 5, "n"))
sprite("xporb", L14,
  circ(7, 9, 4, "B"), clip((x, y) => x + y < 14, circ(7, 9, 4, "t")), clip((x, y) => x + y > 19, circ(7, 9, 4, "b")),
  circ(6, 8, 1, "T"), px(5, 7, "w"), px(9, 11, "Q"),
  px(1, 4, "T"), px(12, 3, "q"),
  glow("Tw", { r: 3, strength: 0.4, bands: 2 }))
sprite("icon_gem", { w: 6, h: 6, outline: "k", mx: true },
  hline(1, 0, 2, "R"), hline(0, 1, 3, "1"), hline(0, 2, 3, "r"), hline(1, 3, 2, "r"), px(2, 4, "E"), px(1, 1, "n"), px(2, 0, "w"))

// ------------------------------------------------------------------ alignment previews (not in the sheet)
const pair = (x, y, wpn, arm) => [0, 1].map((f) => (c) => {
  c.stamp("_hero", x + f * 17, y, { frame: f })
  if (arm) c.stamp(`eq_arm_${arm}_${f}`, x + f * 17, y)
  if (wpn !== null) c.stamp(`eq_wpn_${wpn}_${f}`, x + f * 17, y)
})
for (let g = 0; g < 4; g++)
  scene(`preview_combo_w${g}`, { w: 76, h: 36, bg: "f" },
    ...[0, 1, 2, 3].map((j) => pair((j % 2) * 38, Math.floor(j / 2) * 18, g * 4 + j, 0)).flat())
for (let g = 0; g < 3; g++)
  scene(`preview_combo_a${g}`, { w: 76, h: 36, bg: "f" },
    ...[0, 1, 2, 3].filter((j) => g * 4 + j < 11).map((j) => pair((j % 2) * 38, Math.floor(j / 2) * 18, null, g * 4 + j + 1)).flat())
scene("preview_combo_mix", { w: 76, h: 36, bg: "f" },
  ...pair(0, 0, 0, 1), ...pair(38, 0, 7, 4), ...pair(0, 18, 10, 9), ...pair(38, 18, 15, 11))

scene("preview_loot", { w: 6 * 18, h: 18, bg: "f" },
  ...["pebblepile", "gem", "berry", "shroom", "xporb"].map((n, i) => stamp(n, 1 + i * 18, 1)), stamp("icon_gem", 92, 5))

sheet("gear", ["eq_wpn_*", "eq_arm_*", "pebblepile", "gem", "berry", "shroom", "xporb", "icon_gem"], { pad: 1 })
