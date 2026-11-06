// Squeek Delve: deeper-floor loot, charms, chests, fx and projectiles (sheet "items").
// Rebuild: node <pxl>/bin/pxl.js build art/items.px.js
// Same rules as delve.px.js: ink outline, light from the top-left, hue-shifted ramps.
// Tiers climb in preciousness: bone/wood/stone -> metal -> crystal/ember/frost -> rune/void/star (glow).
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
  O: "#7D6F66",                                                   // gray-brown smoke
  // new for this sheet
  "3": "#C9B99A", "4": "#8C7D66",                                 // bone shade, bone dark
  q: "#E4F8FF", Q: "#86CDEB",                                     // frost white, ice blue
  I: "#C6CAD8",                                                   // polished silver
  U: "#1A0F2A", W: "#3A1E5C", X: "#F1E4FF",                       // void black, void violet, void glow
  Z: "#FF9A3C",                                                   // hot ember
  "5": "#FF6B6B",                                                 // seal glow red
  "7": "#FFE27AA0",                                               // translucent gold (wheel spirit)
})
ramps("kKDfFlL", "kbBtT", "kgGvV", "rRn", "oyYw", "sSIw", "Aa", "mMpPx", "UWCNX", "434c", "bBQq")

const L14 = { w: 14, h: 14, outline: "k" }
const S6 = { w: 6, h: 6, outline: "k" }
// stick(x, y, len, keys): a 45-degree tube rising to the right from (x, y), one column per key.
const stick = (x, y, len, keys) => (c) => { for (let i = 0; i < len; i++) [...keys].forEach((k, j) => k !== "." && c.px(x + i + j, y - i, k)) }
// 4-point sparkle
const spark = (x, y, c1 = "y", c2 = "Y") => [px(x, y, c2), px(x - 1, y, c1), px(x + 1, y, c1), px(x, y - 1, c1), px(x, y + 1, c1)]
// star / burst polygon
const burst = (cx, cy, rIn, rOut, n, c, rot = 0) => {
  const pts = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? rIn : rOut, t = rot + (Math.PI * i) / n
    pts.push(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)))
  }
  return poly(pts, c)
}

// ------------------------------------------------------------------ weapons (14x14 + outline = 16x16)
sprite("wpn_5", L14,   // Bone Club: a femur, knobbly at both ends, heavy at the top
  stick(3, 11, 7, "c34"),
  circ(10, 2, 2, "c"), circ(12, 5, 2, "3"), circ(11, 3, 2, "c"), px(13, 6, "4"), px(12, 7, "4"), px(13, 5, "4"),
  px(10, 1, "w"), px(9, 2, "w"),
  circ(2, 10, 1, "c"), circ(3, 12, 1, "3"), px(1, 13, "4"), px(4, 13, "4"),
  px(6, 8, "4"), px(5, 9, "w"))
sprite("wpn_6", L14,   // Bramble Whip: wrapped grip, then a thorny vine that curls at the end
  stick(1, 13, 3, "lF"), px(2, 12, "L"),
  line(4, 10, 6, 7, "G"), line(6, 7, 6, 4, "G"), line(6, 4, 8, 2, "G"), line(8, 2, 11, 1, "G"),
  line(11, 1, 13, 3, "G"), line(13, 3, 13, 6, "g"), line(13, 6, 11, 7, "g"), line(11, 7, 10, 5, "g"), px(10, 4, "G"),
  px(5, 8, "v"), px(5, 5, "v"), px(7, 2, "v"), px(9, 1, "v"),
  // thorns
  px(7, 8, "R"), px(4, 6, "R"), px(7, 5, "R"), px(8, 0, "R"), px(12, 0, "R"), px(9, 3, "r"), px(12, 8, "r"), px(11, 4, "R"))
sprite("wpn_7", L14,   // Crystal Shard: a faceted cyan blade on an iron guard
  poly([5, 7, 7, 9, 14, 0], "t"),
  clip((x, y) => x + y < 13, poly([5, 7, 7, 9, 14, 0], "T")),
  line(7, 6, 12, 1, "w"), px(9, 7, "B"), px(10, 6, "B"), px(11, 5, "B"),
  line(3, 7, 7, 11, "S"), px(3, 7, "I"), px(4, 8, "I"), px(7, 11, "s"),
  stick(1, 12, 3, "BM"), px(0, 13, "S"))
sprite("wpn_8", L14,   // Mushroom Staff: a twisted staff topped by a glowing teal cap
  stick(1, 13, 8, "lF"), px(3, 11, "L"), px(5, 9, "L"), px(7, 7, "D"),
  vline(9, 5, 3, "c"), vline(10, 5, 2, "3"),
  clip([0, 0, 14, 5], ellipse(9, 5, 5, 4, "t")), hline(4, 5, 11, "g"), hline(5, 4, 9, "B"),
  clip([0, 0, 9, 3], ellipse(9, 5, 4, 3, "T")),
  px(7, 2, "w"), px(11, 2, "T"), px(12, 3, "T"), px(9, 1, "T"), px(6, 3, "q"),
  glow("Tw", { where: [3, 0, 11, 5], r: 3, strength: 0.45, bands: 2 }))
sprite("wpn_9", L14,   // Frost Needle: a long icy rapier with a curled cup guard
  stick(5, 8, 9, "qQ"), px(13, 0, "w"), px(6, 7, "w"),
  ring(4, 9, 2, "Q"), px(2, 9, "q"), px(3, 8, "q"), px(4, 7, "q"), px(6, 9, "B"), px(5, 11, "B"),
  stick(1, 12, 2, "bB"), px(0, 13, "Q"),
  ...spark(10, 7, "Q", "w"))
sprite("wpn_10", L14,   // Ember Blade: a short broad sword glowing from the forge
  stick(5, 9, 7, "YyaA"), px(12, 1, "Y"), px(13, 0, "y"), px(13, 1, "a"),
  line(3, 7, 7, 11, "M"), px(3, 7, "p"), px(4, 8, "p"),
  stick(1, 12, 3, "rE"), px(0, 13, "M"),
  px(10, 7, "Z"), px(12, 5, "a"), px(6, 3, "Z"), px(8, 1, "a"),
  glow("Yy", { where: [5, 0, 9, 10], r: 3, strength: 0.45, bands: 2 }))
sprite("wpn_11", L14,   // Rune Pick: a slate pickaxe head carved with glowing violet runes
  stick(1, 13, 9, "lF"), px(4, 10, "L"), px(7, 7, "L"),
  (c) => {
    for (let a = -100; a <= 10; a += 2) {
      const t = (a * Math.PI) / 180
      c.px(Math.round(3 + 9 * Math.cos(t)), Math.round(10 + 9 * Math.sin(t)), "x")
      c.px(Math.round(3 + 8 * Math.cos(t)), Math.round(10 + 8 * Math.sin(t)), "p")
      c.px(Math.round(3 + 7 * Math.cos(t)), Math.round(10 + 7 * Math.sin(t)), "M")
    }
  },
  px(5, 2, "N"), px(8, 3, "N"), px(9, 4, "X"), px(10, 6, "N"), px(12, 9, "N"),
  glow("NX", { r: 2, strength: 0.5, bands: 2 }))
sprite("wpn_12", L14,   // Moonsickle: a silver crescent on a short dark grip
  circ(8, 6, 6, "I"), circ(10, 4, 5, "_"),
  clip((x, y) => x + y > 15, circ(8, 6, 6, "S")), clip((x, y) => x + y > 17, circ(8, 6, 6, "s")),
  px(2, 5, "w"), px(3, 3, "w"), px(4, 9, "w"), px(5, 1, "w"),
  stick(1, 13, 4, "Mm"), px(3, 11, "p"), px(5, 9, "S"), px(6, 9, "s"),
  ...spark(12, 9, "S", "w"))
sprite("wpn_13", L14,   // Comet Lance: a white-gold lance whose tip trails a comet tail
  stick(1, 12, 5, "yo"), px(0, 13, "o"),
  poly([4, 6, 8, 10, 13, 1], "y"), clip((x, y) => x + y < 14, poly([4, 6, 8, 10, 13, 1], "Y")),
  line(6, 7, 11, 2, "w"), line(4, 6, 8, 10, "o"),
  circ(12, 1, 1, "w"), px(13, 0, "w"),
  line(9, 1, 3, 1, "Q"), line(8, 0, 5, 0, "q"), line(13, 4, 13, 8, "Q"), line(12, 5, 12, 6, "q"),
  glow("wY", { where: [9, 0, 5, 4], r: 3, strength: 0.5, bands: 2 }))
sprite("wpn_14", L14,   // Void Fang: a curved black-violet fang with a violet edge
  poly([4, 8, 7, 11, 12, 6, 13, 0, 10, 3], "W"),
  clip((x, y) => x + y > 15, poly([4, 8, 7, 11, 12, 6, 13, 0, 10, 3], "U")),
  line(5, 8, 10, 3, "C"), line(10, 3, 13, 0, "N"), px(6, 7, "N"), px(12, 1, "X"),
  line(2, 8, 6, 12, "C"), px(2, 8, "N"),
  stick(1, 12, 2, "WU"), px(0, 13, "C"),
  px(10, 9, "N"), px(13, 5, "C"),
  glow("NX", { r: 3, strength: 0.5, bands: 2 }))
sprite("_wheel15", L14,   // Wheel of Fate: a golden hamster wheel on a jeweled handle
  stick(1, 12, 5, "Yo"), px(0, 13, "R"), px(1, 13, "r"),
  circ(9, 5, 5, "o"), circ(9, 5, 4, "_"), ring(9, 5, 4, "y"),
  clip((x, y) => x + y < 13, ring(9, 5, 5, "Y")),
  line(5, 5, 13, 5, "o"), line(9, 1, 9, 9, "o"), line(6, 2, 12, 8, "y"), line(12, 2, 6, 8, "y"),
  circ(9, 5, 1, "Y"), px(9, 5, "w"), px(6, 1, "w"))
sprite("wpn_15", { w: 16, h: 16 },
  stamp("_wheel15", 0, 0),
  ...spark(2, 3, "y", "w"), ...spark(14, 13, "o", "Y"), px(15, 3, "Y"), px(8, 15, "y"), px(4, 8, "Y"),
  glow("Yw", { where: [4, 0, 12, 12], r: 3, strength: 0.4, bands: 2 }))

// ------------------------------------------------------------------ armor
sprite("_torso", { mx: true }, `
  .aaa...
  aaaab..
  aaaaab.
  .aaaaaa
  .aaaaaa
  .aaaaaa
  .aaaaaa
  .aaaaaa
  .aaaaaa
  .aaaaaa
  ..aaaaa`)
sprite("arm_4", L14,   // Beetle Shell: glossy blue-green wing cases
  ellipse(7, 8, 6, 5, "B"), clip([0, 0, 7, 14], ellipse(7, 8, 6, 5, "t")),
  clip((x, y) => x + y > 17, ellipse(7, 8, 6, 5, "b")),
  ellipse(7, 2, 3, 2, "b"), px(6, 1, "B"), px(5, 2, "t"),
  vline(7, 3, 11, "k"),
  px(3, 5, "T"), px(4, 5, "T"), px(2, 6, "T"), px(9, 5, "t"), px(10, 5, "T"),
  px(3, 9, "B"), px(10, 10, "B"))
sprite("arm_5", L14,   // Pinecone Guard: rows of overlapping scales
  ellipse(7, 7, 5, 6, "f"),
  (c) => {
    for (let row = 0; row < 5; row++)
      for (let i = 0; i < 4; i++) {
        const x = 2 + i * 3 + (row % 2 ? 1 : 0) - (row % 2 && i === 3 ? 9 : 0), y = 2 + row * 2.5 | 0
        if (!c.is(x + 1, y + 1, "*")) continue
        c.px(x, y, "L"); c.px(x + 1, y, "l"); c.px(x, y + 1, "F"); c.px(x + 1, y + 1, "F"); c.px(x + 2, y + 1, "D")
      }
  },
  px(7, 0, "G"), px(6, 0, "v"), px(8, 1, "g"))
sprite("arm_6", L14,   // Bark Mail: a bark tunic with grooves and a patch of moss
  stamp("_torso", 0, 2, { swap: { a: "F", b: "D" } }),
  (c) => { for (const x of [2, 5, 8, 11]) for (let y = 4; y < 13; y++) if ((y + x) % 4 && c.is(x, y, "F")) c.px(x, y, "f") },
  vline(1, 4, 8, "l"), px(2, 2, "l"), px(3, 2, "L"), hline(2, 12, 10, "D"),
  px(9, 9, "v"), px(10, 9, "G"), px(10, 10, "v"), px(4, 6, "G"))
sprite("arm_7", L14,   // Crystal Vest: a tunic of cyan crystal plates with shoulder spikes
  stamp("_torso", 0, 3, { swap: { a: "t", b: "B" } }),
  clip((x, y) => x + y > 17, rect(0, 0, 14, 14, ".")), recolor({ t: "B" }, (x, y) => x > 9 || y > 11),
  line(1, 6, 1, 12, "T"), line(4, 7, 4, 12, "B"), line(9, 7, 9, 12, "B"),
  px(2, 4, "T"), px(3, 4, "w"), px(6, 9, "T"), px(7, 10, "w"),
  grid(1, 0, `
    T......
    Tt.....
    tB.....`), grid(11, 0, `
    ..B
    .tB
    tB.`))
sprite("arm_8", L14,   // Frost Cloak: a hooded ice-blue cloak with an icicle hem
  ellipse(7, 3, 3, 3, "Q"), ellipse(7, 4, 2, 2, "b"),
  poly([3, 4, 11, 4, 14, 12, 0, 12], "Q"),
  clip((x, y) => x < 5, poly([3, 4, 11, 4, 14, 12, 0, 12], "q")),
  clip((x, y) => x > 9, poly([3, 4, 11, 4, 14, 12, 0, 12], "B")),
  px(5, 1, "q"), px(4, 2, "q"), rect(6, 6, 2, 2, "y"), px(6, 6, "Y"),
  (c) => { for (let x = 0; x < 14; x += 2) { c.px(x, 12, "w"); c.px(x, 13, "q") } },
  vline(6, 8, 4, "B"), vline(9, 8, 3, "B"))
sprite("arm_9", L14,   // Magma Plate: black rock breastplate split by glowing cracks
  stamp("_torso", 0, 2, { swap: { a: "M", b: "m" } }),
  recolor({ M: "p" }, (x, y) => x < 4 && y < 9),
  line(3, 4, 6, 8, "a"), line(6, 8, 5, 12, "R"), line(6, 8, 10, 7, "Z"), line(10, 7, 12, 4, "a"), line(10, 7, 10, 11, "R"),
  px(6, 8, "y"), px(10, 7, "Y"), px(3, 3, "P"), px(2, 4, "P"),
  glow("yYZa", { r: 2, strength: 0.5, bands: 2 }))
sprite("arm_10", L14,   // Rune Aegis: a round slate shield with a silver rim and glowing runes
  circ(7, 7, 6, "I"), circ(7, 7, 5, "p"), clip((x, y) => x + y < 13, circ(7, 7, 5, "P")),
  clip((x, y) => x + y > 15, ring(7, 7, 6, "S")),
  circ(7, 7, 1, "S"), px(6, 6, "w"),
  px(7, 3, "N"), px(7, 4, "X"), px(4, 6, "N"), px(3, 7, "N"), px(10, 7, "N"), px(11, 8, "N"),
  px(5, 10, "N"), px(9, 10, "N"), px(8, 11, "N"), px(3, 3, "w"),
  glow("NX", { r: 2, strength: 0.6, bands: 2 }))
sprite("arm_11", L14,   // Starweave: a night-blue cloak shot with stars
  ellipse(7, 3, 3, 3, "W"), ellipse(7, 4, 2, 2, "U"),
  poly([3, 4, 11, 4, 14, 13, 0, 13], "b"),
  clip((x, y) => x < 5, poly([3, 4, 11, 4, 14, 13, 0, 13], "W")),
  clip((x, y) => x > 10, poly([3, 4, 11, 4, 14, 13, 0, 13], "U")),
  rect(6, 6, 2, 2, "y"), px(6, 6, "w"),
  px(3, 8, "Y"), px(10, 10, "w"), px(5, 11, "y"), px(9, 6, "Y"), px(12, 12, "y"), px(2, 12, "w"), px(6, 2, "N"),
  ...spark(8, 10, "y", "w"),
  glow("Yw", { r: 2, strength: 0.5, bands: 2 }))

// ------------------------------------------------------------------ slings
sprite("sl_3", L14,   // Acorn Catapult: a little wooden catapult with an acorn in the cup
  hline(1, 11, 12, "l"), hline(1, 12, 12, "F"), circ(3, 12, 1, "D"), circ(10, 12, 1, "D"), px(3, 12, "L"), px(10, 12, "L"),
  vline(9, 7, 4, "F"), vline(8, 7, 4, "l"),
  line(10, 10, 3, 3, "l"), line(10, 11, 4, 4, "F"),
  rect(1, 1, 4, 2, "F"), hline(1, 3, 4, "D"),
  circ(3, 1, 1, "a"), px(2, 0, "f"), px(3, 0, "f"), px(4, 0, "F"), px(3, 1, "Y"))
sprite("sl_4", L14,   // Crystal Sling: a Y fork grown from cyan crystal, with a silver band
  vline(6, 7, 7, "t"), vline(7, 7, 7, "B"),
  line(6, 7, 2, 2, "T"), line(7, 7, 11, 2, "B"), line(3, 2, 6, 6, "t"), line(10, 2, 7, 5, "t"),
  px(2, 1, "w"), px(11, 1, "T"), px(1, 0, "T"), px(12, 0, "t"),
  line(2, 3, 6, 5, "I"), line(11, 3, 7, 5, "S"), rect(6, 5, 2, 2, "I"), px(6, 5, "w"), px(6, 10, "T"))
sprite("sl_5", L14,   // Ember Bow: a scorched bow with a flaming arrow nocked
  (c) => {
    for (let a = -80; a <= 80; a += 4) {
      const t = (a * Math.PI) / 180
      c.px(Math.round(2 + 6 * Math.cos(t)), Math.round(7 + 6 * Math.sin(t)), a < 0 ? "R" : "r")
    }
  },
  vline(3, 1, 13, "S"), px(8, 0, "a"), px(8, 13, "a"), px(7, 1, "Z"),
  hline(3, 7, 8, "l"), px(2, 6, "c"), px(2, 8, "c"),
  px(11, 7, "Y"), px(12, 7, "y"), px(11, 6, "a"), px(11, 8, "a"), px(13, 7, "Z"), px(12, 6, "Z"),
  glow("YyZ", { where: [10, 5, 4, 4], r: 2, strength: 0.5, bands: 2 }))
sprite("sl_6", L14,   // Frost Crossbow: an ice-blue crossbow loaded with a frost bolt
  stick(1, 12, 9, "Bb"),
  (c) => { for (let i = -5; i <= 5; i++) c.px(8 + i, 6 + i - (Math.abs(i) > 3 ? (i > 0 ? 1 : -1) : 0) - (Math.abs(i) > 3 ? 0 : 0), "Q") },
  line(3, 1, 13, 11, "q"), px(3, 2, "S"), px(12, 11, "S"),
  stick(6, 7, 7, "q"), px(13, 0, "w"), px(12, 0, "Q"), px(13, 1, "Q"),
  px(4, 11, "S"), px(3, 12, "S"))
sprite("_cannon", L14,   // Star Cannon body
  stick(2, 10, 7, ".oyYo"), px(12, 1, "Y"), px(13, 2, "o"), circ(11, 2, 1, "o"),
  stick(5, 8, 1, ".Ao"), stick(8, 5, 1, ".Ao"),
  circ(4, 10, 3, "f"), ring(4, 10, 3, "D"), px(4, 10, "y"), px(3, 8, "l"), px(2, 9, "l"),
  hline(0, 13, 10, "D"))
sprite("sl_7", { w: 16, h: 16 },
  stamp("_cannon", 0, 0),
  px(13, 0, "w"), px(12, 0, "Y"), px(14, 0, "Y"), px(13, 1, "Y"), px(15, 3, "y"),
  glow("Yw", { where: [6, 0, 10, 8], r: 2, strength: 0.4, bands: 2 }))

// ------------------------------------------------------------------ buffs / charms
sprite("_heartshape", { mx: true }, `
  .aaa...
  aaaaa.a
  aaaaaaa
  aaaaaaa
  aaaaaaa
  .aaaaaa
  ..aaaaa
  ...aaaa
  ....aaa
  .....aa`)
sprite("sunflower", L14,   // Sunflower Heart: petals ringing a heart of seeds
  stamp("_heartshape", 0, 1, { swap: { a: "y" } }),
  clip((x, y) => x + y > 15, stamp("_heartshape", 0, 1, { swap: { a: "o" } })),
  px(1, 3, "Y"), px(2, 2, "Y"), px(3, 2, "Y"), px(1, 4, "Y"),
  stamp("_heartshape", 3, 4, { swap: { a: "f" } }),
  clip([0, 0, 14, 14], (c) => { for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if (c.is(x, y, "f") && (x + y) % 2) c.px(x, y, "D") }))
sprite("ironfur", L14,   // Iron Fur: a tuft of metallic fur, strands sweeping up like a flame
  poly([2, 13, 12, 13, 12, 9, 13, 3, 9, 7, 8, 0, 6, 6, 3, 2, 3, 8], "S"),
  clip((x, y) => x < 6, poly([2, 13, 12, 13, 12, 9, 13, 3, 9, 7, 8, 0, 6, 6, 3, 2, 3, 8], "I")),
  clip((x, y) => x > 9 || y > 11, poly([2, 13, 12, 13, 12, 9, 13, 3, 9, 7, 8, 0, 6, 6, 3, 2, 3, 8], "s")),
  line(4, 12, 4, 6, "s"), line(7, 12, 7, 4, "s"), line(10, 12, 11, 7, "M"),
  px(4, 4, "w"), px(7, 2, "w"), px(5, 8, "w"))
sprite("nighteye", L14,   // Night Eyes: a gold-rimmed owl-eye amulet on a chain
  (c) => { for (let x = 1; x <= 12; x++) { const y = Math.round(4 - 3.2 * Math.sin((Math.PI * (x - 1)) / 11)); c.px(x, y, x % 2 ? "S" : "s") } },
  circ(7, 8, 5, "o"), circ(7, 8, 4, "y"), circ(7, 8, 3, "V"), clip((x, y) => x + y > 15, circ(7, 8, 3, "v")),
  circ(7, 8, 1, "k"), px(6, 7, "w"), px(5, 6, "Y"), px(4, 8, "Y"),
  glow("Vv", { r: 3, strength: 0.5, bands: 2 }))
sprite("wheelspirit", L14,   // Wheel Spirit: a ghostly golden wheel with a spark at its hub
  circ(7, 7, 6, "7"), circ(7, 7, 4, "_"), ring(7, 7, 6, "y"), ring(7, 7, 4, "o"),
  clip((x, y) => x + y < 13, ring(7, 7, 6, "Y")),
  line(1, 7, 13, 7, "7"), line(7, 1, 7, 13, "7"), line(3, 3, 11, 11, "7"), line(11, 3, 3, 11, "7"),
  ...spark(7, 7, "Y", "w"), px(7, 5, "Y"), px(7, 9, "Y"), px(5, 7, "Y"), px(9, 7, "Y"),
  glow("wY", { where: [4, 4, 7, 7], r: 3, strength: 0.5, bands: 2 }))
sprite("leechfang", L14,   // Vampire Tooth: a long curved fang dipped red, with a drop
  poly([3, 1, 10, 1, 11, 4, 9, 9, 6, 13, 6, 8, 4, 4], "c"),
  clip((x, y) => x > 7, poly([3, 1, 10, 1, 11, 4, 9, 9, 6, 13, 6, 8, 4, 4], "3")),
  clip((x, y) => y > 8, poly([3, 1, 10, 1, 11, 4, 9, 9, 6, 13, 6, 8, 4, 4], "R")),
  clip((x, y) => y > 8 && x > 6, poly([3, 1, 10, 1, 11, 4, 9, 9, 6, 13, 6, 8, 4, 4], "r")),
  hline(3, 0, 8, "n"), px(4, 2, "w"), px(5, 4, "w"),
  px(11, 11, "R"), px(11, 12, "r"), px(12, 12, "R"))
sprite("seedmagnet", L14,   // Seed Magnet: a red horseshoe magnet pulling a sunflower seed
  circ(5, 9, 5, "R"), circ(5, 9, 2, "_"), rect(0, 0, 14, 9, "_"),
  rect(0, 4, 3, 5, "R"), rect(8, 4, 3, 5, "R"), clip((x, y) => x > 6, circ(5, 9, 5, "r")), rect(10, 4, 1, 5, "r"),
  rect(0, 2, 3, 2, "I"), rect(8, 2, 3, 2, "I"), px(0, 2, "w"), px(10, 3, "S"), px(2, 3, "S"),
  vline(0, 5, 5, "n"),
  grid(4, 0, `
    .s.
    sSc`), px(5, -1, "s"),
  px(3, 0, "y"), px(8, 0, "y"))
sprite("swiftpaw", L14,   // Swift Paws: a pink paw print with speed lines
  ellipse(9, 9, 3, 2, "n"), clip((x, y) => y > 9, ellipse(9, 9, 3, 2, "r")), px(8, 8, "w"),
  circ(6, 5, 1, "n"), circ(9, 3, 1, "n"), circ(12, 5, 1, "n"), px(6, 4, "w"), px(9, 2, "w"), px(12, 4, "w"),
  px(7, 6, "r"), px(10, 4, "r"), px(13, 6, "r"),
  hline(0, 6, 3, "S"), hline(1, 9, 4, "I"), hline(0, 12, 3, "S"), px(3, 3, "S"), px(4, 3, "S"))

// ------------------------------------------------------------------ chests (same shapes as delve's chest)
sprite("_chestbody", { w: 14, h: 14, mx: true },
  rect(1, 7, 6, 6, "F"), hline(1, 9, 6, "f"), hline(1, 11, 6, "f"), hline(1, 12, 6, "f"),
  vline(3, 7, 6, "y"), px(3, 12, "o"), rect(6, 6, 1, 4, "y"), px(6, 9, "o"))
sprite("_chest", L14,
  stamp("_chestbody", 0, 0),
  rect(1, 3, 12, 4, "l"), hline(2, 2, 10, "l"), hline(2, 3, 10, "L"), hline(1, 6, 12, "f"),
  vline(3, 2, 5, "y"), vline(10, 2, 5, "y"), vline(10, 2, 5, "o"), px(3, 2, "Y"),
  rect(6, 6, 2, 3, "y"), px(6, 7, "k"), px(7, 8, "o"),
  vline(12, 7, 6, "f"))
sprite("_chest_open", L14,
  stamp("_chestbody", 0, 0),
  rect(2, 1, 10, 3, "f"), hline(2, 1, 10, "F"), vline(3, 1, 3, "o"), vline(10, 1, 3, "o"),
  rect(1, 4, 12, 3, "K"), hline(1, 6, 12, "D"),
  rect(6, 7, 2, 2, "y"), px(7, 8, "o"), vline(12, 7, 6, "f"))
// silver: iron-bound slate wood with silver straps; gold: crimson lacquer with gold straps and a ruby
const SILVER = { F: "p", f: "M", l: "P", L: "x", y: "I", o: "S", Y: "w" }
const GOLD = { F: "r", f: "E", l: "R", L: "n", D: "E", K: "k" }
sprite("chest_silver", { w: 16, h: 16 }, stamp("_chest", 0, 0, { swap: SILVER }), px(4, 3, "w"), px(11, 8, "S"))
sprite("chest_silver_open", { w: 16, h: 16 },
  stamp("_chest_open", 0, 0, { swap: SILVER }),
  px(5, 6, "T"), px(6, 6, "t"), px(8, 5, "q"), px(9, 6, "T"), px(7, 5, "w"), px(7, 4, "q"), px(10, 6, "B"), px(4, 6, "I"),
  glow("wqT", { where: [3, 3, 9, 4], r: 2, strength: 0.6, bands: 2 }))
sprite("chest_gold", { w: 16, h: 16 },
  stamp("_chest", 0, 0, { swap: GOLD }),
  px(7, 7, "T"), px(8, 8, "t"), px(4, 3, "w"), px(4, 10, "R"), px(11, 10, "R"))
sprite("chest_gold_open", { w: 16, h: 16 },
  stamp("_chest_open", 0, 0, { swap: GOLD }),
  px(4, 6, "y"), px(5, 6, "Y"), px(5, 5, "Y"), px(6, 5, "w"), px(7, 4, "Y"), px(7, 3, "w"), px(8, 5, "y"), px(9, 6, "R"), px(10, 6, "y"), px(8, 6, "T"),
  glow("wY", { where: [3, 2, 9, 5], r: 3, strength: 0.6, bands: 2 }))

// ------------------------------------------------------------------ overlays / fx (16x16, no outline)
sprite("seal", { w: 16, h: 16 },   // boss lock over the stairs: rune ring and four chains
  ring(8, 8, 7, "r"), ring(8, 8, 6, "R"),
  (c) => { for (let i = 0; i < 8; i++) { const t = (Math.PI * i) / 4 + 0.39; c.px(Math.round(8 + 6 * Math.cos(t)), Math.round(8 + 6 * Math.sin(t)), "5") } },
  px(8, 2, "w"), px(8, 14, "n"), px(2, 8, "n"), px(14, 8, "n"),
  // chain links running from the corners into the ring
  ...[[0, 0, 1, 1], [15, 0, -1, 1], [0, 15, 1, -1], [15, 15, -1, -1]].flatMap(([x, y, dx, dy]) => [
    px(x, y, "S"), px(x + dx, y + dy, "s"), px(x + 2 * dx, y + 2 * dy, "S"), px(x + dx, y, "s"), px(x, y + dy, "s"), px(x + 3 * dx, y + 3 * dy, "I")]),
  glow("5wR", { r: 2, strength: 0.6, bands: 2 }))
anim("explosion", { w: 16, h: 16, fps: 12, loop: false },
  frame(circ(8, 8, 3, "a"), circ(8, 8, 2, "y"), px(8, 8, "w"), px(7, 7, "w")),
  frame(burst(8, 8, 4, 7, 7, "R", 0.2), burst(8, 8, 3, 5, 7, "a", 0.6), circ(8, 8, 3, "y"), circ(8, 8, 1, "Y"), px(7, 7, "w")),
  frame(burst(8, 8, 5, 8, 8, "r", 0.1), burst(8, 8, 4, 7, 8, "R", 0.5), circ(8, 8, 4, "a"), circ(7, 7, 2, "y"), px(6, 6, "Y"),
    circ(3, 3, 2, "s"), circ(13, 4, 2, "s"), circ(12, 13, 1, "O")),
  frame(circ(4, 5, 3, "s"), circ(11, 4, 3, "s"), circ(8, 10, 4, "O"), circ(3, 11, 2, "s"), circ(13, 11, 2, "O"),
    px(3, 4, "S"), px(10, 3, "S"), px(7, 8, "S"), px(6, 9, "S"), px(12, 10, "S"),
    px(8, 3, "a"), px(14, 7, "R"), px(2, 8, "a")))
anim("levelup", { w: 16, h: 16, fps: 10 },
  frame(ellipse(8, 13, 6, 2, "y", true), clip([0, 13, 16, 3], ellipse(8, 13, 6, 2, "o", true)), ...spark(4, 9), ...spark(12, 7), px(8, 6, "Y")),
  frame(ellipse(8, 9, 5, 2, "Y", true), clip([0, 9, 16, 3], ellipse(8, 9, 5, 2, "y", true)), ellipse(8, 14, 4, 1, "o", true),
    ...spark(3, 4), ...spark(13, 11, "o", "y"), px(8, 2, "Y"), px(10, 4, "w")),
  frame(ellipse(8, 4, 4, 1, "Y", true), ellipse(8, 10, 5, 2, "y", true), clip([0, 10, 16, 3], ellipse(8, 10, 5, 2, "o", true)),
    ...spark(12, 2, "y", "w"), ...spark(3, 13, "o", "y"), px(5, 1, "Y"), px(14, 7, "y")))
const plus = (x, y, c1, c2) => [rect(x - 1, y - 3, 3, 7, c1), rect(x - 3, y - 1, 7, 3, c1), vline(x, y - 2, 5, c2), hline(x - 2, y, 5, c2)]
anim("heal", { w: 16, h: 16, fps: 6 },
  frame(...plus(8, 9, "G", "v"), px(8, 9, "V"), px(7, 7, "V"), ...spark(3, 4, "n", "w"), ...spark(13, 12, "n", "w"), px(13, 3, "n")),
  frame(...plus(7, 6, "G", "v"), px(7, 6, "V"), px(6, 4, "V"), ...spark(12, 9, "n", "w"), ...spark(3, 12, "n", "w"), px(13, 1, "n"), px(10, 14, "v")))
anim("poof", { w: 16, h: 16, fps: 10, loop: false },
  frame(circ(8, 9, 4, "S"), circ(5, 7, 3, "S"), circ(11, 7, 3, "S"), circ(8, 5, 3, "I"),
    clip((x, y) => y > 9, circ(8, 9, 4, "s")), px(6, 4, "w"), px(7, 4, "w")),
  frame(circ(3, 5, 2, "S"), circ(12, 4, 2, "s"), circ(4, 12, 2, "s"), circ(12, 12, 2, "S"), circ(8, 8, 1, "O"),
    px(2, 4, "I"), px(11, 11, "I"), px(8, 2, "s"), px(14, 8, "s")))

// ------------------------------------------------------------------ projectiles (6x6 + outline = 8x8)
sprite("proj_web", S6, `
  .wSw..
  wSwSw.
  SwSwSw
  wSwSw.
  .wSwS.
  ..S...`)
sprite("proj_spit", S6, `
  ......
  ...vv.
  .GvVVv
  GGvvVv
  .gGvv.
  ..gg..`)
sprite("proj_feather", S6, `
  ....LF
  ...LlF
  ..LlF.
  .Llf..
  .cF...
  c.....`)
sprite("proj_fire", S6, `
  ......
  ..RaR.
  .RayaR
  RayYya
  .Raya.
  ..RR..`)
sprite("proj_star", S6, `
  ..y..
  ..Y..
  yYwYy
  .yYy.
  .y.y.
  y...y`)

// ------------------------------------------------------------------ UI icons (6x6 + outline = 8x8)
sprite("icon_atk", S6, `
  c....c
  3c..c3
  .3cc3.
  .c33c.
  c3..3c
  3....3`)
sprite("icon_def", { ...S6, mx: true }, `
  yyy
  yBB
  yBw
  yBB
  .yB
  ..y`)
sprite("icon_xp", { ...S6, mx: true }, `
  ..q
  .qQ
  qQB
  QBB
  .Bb
  ..b`)
sprite("icon_lvl", { ...S6, mx: true }, `
  ..Y
  .YY
  Yyy
  ..y
  ..y
  ..o`)
sprite("icon_boss", { ...S6, mx: true }, `
  y..
  y.y
  yyY
  yyR
  ooo
  ...`)
sprite("icon_key", S6, `
  ...yy.
  ..y..y
  ...yyo
  ..yo..
  .yo...
  yoy...`)
sprite("icon_chain", S6, `
  .SS...
  S..S..
  S.ISS.
  .SS..S
  ...S.S
  ....S.`)

sheet("items", [
  "wpn_5", "wpn_6", "wpn_7", "wpn_8", "wpn_9", "wpn_10", "wpn_11", "wpn_12", "wpn_13", "wpn_14", "wpn_15",
  "arm_4", "arm_5", "arm_6", "arm_7", "arm_8", "arm_9", "arm_10", "arm_11",
  "sl_3", "sl_4", "sl_5", "sl_6", "sl_7",
  "sunflower", "ironfur", "nighteye", "wheelspirit", "leechfang", "seedmagnet", "swiftpaw",
  "chest_silver", "chest_silver_open", "chest_gold", "chest_gold_open",
  "seal", "explosion", "levelup", "heal", "poof",
  "proj_web", "proj_spit", "proj_feather", "proj_fire", "proj_star",
  "icon_atk", "icon_def", "icon_xp", "icon_lvl", "icon_boss", "icon_key", "icon_chain",
], { pad: 1 })
