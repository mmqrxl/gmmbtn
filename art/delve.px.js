// Squeek Delve: pixel art for a hamster-burrow roguelike.
// Rebuild: node /tmp/skills/pxl/pxl-pixel-art/bin/pxl.js build art/delve.px.js
// Light comes from the top-left. Characters face right (the game flips them).
pal({
  k: "#14101C",                                                   // ink: outlines, eyes, tunnel dark
  K: "#2A1E25", D: "#3E2C29", f: "#5C4131", F: "#745439",         // earth ramp (wall top -> floor)
  l: "#96704C", L: "#BC9864",                                     // lit earth face, roots
  s: "#5E5A6A", S: "#8F8C99",                                     // stone / tabby gray
  r: "#8C2E3A", R: "#D2483E",                                     // headband, hearts
  o: "#A8642A", y: "#F5C451", Y: "#FFF0A8", w: "#FFFFFF",         // gold, light, white
  H: "#E8B07A", h: "#C98A54", u: "#8A5A34",                       // hero fur (recolored at runtime)
  c: "#F7E3C3", n: "#F08AA0",                                     // cream belly/cheeks, nose
  b: "#232A5C", B: "#2F6B9A", t: "#45B5AE", T: "#9EF0DC",         // beetle shell
  g: "#1F4A3A", G: "#3C8A44", v: "#86C452", V: "#D2E27A",         // snake (V also cat eyes)
  a: "#E07B39", A: "#9C4628",                                     // tabby orange
})
ramps("kKDfFlL", "kbBtT", "kgGvV", "rRn", "oyYw", "sS", "Aa")

// ------------------------------------------------------------------ floor & walls (16x16, opaque)
sprite("_floor", { w: 16, h: 16 },
  rect(0, 0, 16, 16, "f"),
  // packed dirt is granular: a sparse, even scatter of lighter grit and darker pits
  noise(0, 0, 16, 16, "F", 0.035, 11), noise(0, 0, 16, 16, "D", 0.02, 23))

sprite("floor_0", { w: 16, h: 16 }, stamp("_floor", 0, 0))
sprite("floor_1", { w: 16, h: 16 }, stamp("_floor", 0, 0),   // pebble pair
  grid(3, 8, `
    .SS.
    SSss
    Dsss
    .DD.`),
  grid(9, 11, `
    SS
    ss
    DD`))
sprite("floor_2", { w: 16, h: 16 }, stamp("_floor", 0, 0),   // root tip poking out of the ground
  grid(2, 3, `
    DLL......
    .DlLL....
    ..DDlLL..
    ....DDlL.
    ......Dl.
    .......D.`))
sprite("floor_3", { w: 16, h: 16 }, stamp("_floor", 0, 0),   // tiny hamster pawprints, pressed in
  grid(2, 2, `
    D.D
    .K.`),
  grid(8, 6, `
    D.D
    .K.`),
  grid(4, 10, `
    D.D
    .K.`),
  grid(10, 13, `
    D.D
    .K.`))

sprite("_walltop", { w: 16, h: 16 },
  rect(0, 0, 16, 16, "K"), noise(0, 0, 16, 16, "D", 0.04, 5))
sprite("wall_top", { w: 16, h: 16 }, stamp("_walltop", 0, 0))

// 3/4 wall: 5px of wall top, a lit lip, then the earth face with strata that meet at the tile edges.
sprite("_wallface", { w: 16, h: 16 },
  stamp("_walltop", 0, 0),
  rect(0, 5, 16, 11, "l"),
  hline(0, 5, 16, "L"),
  rect(0, 10, 16, 6, "F"),
  // strata: start and end at the same rows so neighbours join
  (c) => { for (let x = 0; x < 16; x++) c.px(x, x < 5 || x > 11 ? 9 : 8, "F") },
  (c) => { for (let x = 0; x < 16; x++) c.px(x, x < 7 || x > 12 ? 13 : 12, "f") },
  hline(0, 15, 16, "D"))
sprite("wall_face_0", { w: 16, h: 16 }, stamp("_wallface", 0, 0),
  grid(10, 10, `
    Ss
    sD`))
sprite("wall_face_1", { w: 16, h: 16 }, stamp("_wallface", 0, 0),   // a root hanging out of the face
  grid(4, 5, `
    LD.
    lD.
    Ll.
    .LD
    .lD
    .L.
    ..l`))

// Stairs down: a hole with a root ladder, on floor.
sprite("stairs", { w: 16, h: 16 },
  stamp("_floor", 0, 0),
  ellipse(8, 9, 6, 5, "D"),
  ellipse(8, 10, 5, 4, "k"),
  hline(4, 6, 9, "F"), hline(3, 7, 11, "K"),   // far wall of the shaft, lit
  vline(5, 3, 11, "L"), vline(11, 3, 11, "L"), px(5, 3, "l"), px(11, 3, "l"), px(6, 3, "D"), px(12, 3, "D"),
  hline(6, 8, 5, "L"), hline(6, 11, 5, "l"), hline(6, 13, 5, "F"),
  vline(5, 12, 2, "l"), vline(11, 12, 2, "l"))

// Exit: golden hamster wheel. The two frames turn the spokes 45 degrees.
anim("exit", { w: 16, h: 16, fps: 4 },
  stamp("_floor", 0, 0),
  line(8, 8, 4, 15, "o"), line(8, 8, 12, 15, "o"),
  hline(3, 15, 3, "D"), hline(11, 15, 3, "D"),
  ring(8, 7, 6, "y"), ring(8, 7, 5, "o"),
  frame(line(8, 3, 8, 11, "y"), line(4, 7, 12, 7, "y"), px(4, 2, "Y"), px(3, 3, "Y")),
  frame(line(5, 4, 11, 10, "y"), line(11, 4, 5, 10, "y"), px(2, 5, "Y"), px(6, 1, "Y"), px(13, 9, "Y")),
  px(8, 7, "Y"),
  glow("yY", { r: 3, ramp: 1 }))

// ------------------------------------------------------------------ characters (14x14 + outline = 16x16)
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
anim("hero", { w: 14, h: 14, fps: 3, outline: "k" },
  frame(HERO),
  frame((c) => {
    // bob: everything above the feet sinks 1px
    const rows = HERO.trim().split("\n").map((r) => r.trim())
    c.grid(0, 1, rows.slice(0, 12).join("\n"))
    c.grid(0, 13, rows[13])
  }))

const BEETLE = `
  ..............
  ..............
  ..............
  ..............
  ..............
  ............b.
  ..ttttttB..b..
  .tTTtttBBBb...
  tTTttBBBBBbbb.
  tTtBBBBBBbbwbb
  tBBBBBBBbbbbbb
  bbbbbbbbbb.bb.`
anim("beetle", { w: 14, h: 14, fps: 3, outline: "k" },
  BEETLE,
  frame(grid(1, 12, `
    b..b..b..b
    .b..b..b..b`)),
  frame(grid(12, 5, "_b"), grid(11, 6, "_.b"), grid(0, 12, `
    .b..b..b..b
    b..b..b..b.`)))

const SNAKE = `
  ..............
  ........GGG...
  .......GvvGG..
  .......GvkGGGR
  .......gGGGGR.
  ........gGVV..
  .........GV...
  .........GV...
  ..GGGGG..GV...
  .GvvvvvGGGV...
  GvGGgGGvvGg...
  GGgVVVVgGGg...
  gGGGGGGGGgg...
  .gggggggg.....`
anim("snake", { w: 14, h: 14, fps: 3, outline: "k" },
  frame(SNAKE),
  frame((c) => {
    const rows = SNAKE.trim().split("\n").map((r) => r.trim())
    c.grid(0, 0, rows.slice(8).map(() => "").join("\n"))
    c.grid(0, 1, rows.slice(0, 8).join("\n").replace(/R/g, "."))
    c.grid(0, 8, rows.slice(8).join("\n"))
  }))

// Boss: front-facing tabby, mirrored.
const CAT = `
  A......
  aA.....
  anA..aA
  anaAaAa
  aaaaaaa
  aAAaaaa
  aVVAAaa
  aVkkVAa
  aaVkVac
  Aaaaccn
  .AaaSkk
  .aaaSwk
  sSaaSSS
  sSsSSsS`
anim("cat", { w: 14, h: 14, fps: 3, outline: "k", mx: true },
  frame(CAT),
  frame(CAT, grid(1, 6, "AA"), grid(1, 7, "AkkV")))

// ------------------------------------------------------------------ items & fx (16x16)
sprite("_seedbody", { mx: "c" }, `
  ...s
  ..ss
  ..sc
  .Ssc
  .Ssc
  sSsc
  sSsc
  sSsc
  sSsc
  .Ssc
  ..ss`)
sprite("seed", { w: 14, h: 14, outline: "k" }, stamp("_seedbody", 3, 1), px(4, 5, "w"), px(4, 6, "w"))

sprite("cheese", { w: 14, h: 14, outline: "k" },
  poly([0, 8, 6, 3, 14, 3, 11, 8], "Y"),
  rect(0, 8, 11, 5, "y"),
  poly([11, 8, 14, 3, 14, 10, 11, 13], "o"),
  circ(3, 10, 1, "o"), px(7, 11, "o"), px(8, 11, "o"), px(8, 9, "o"), circ(7, 5, 1, "y"))

anim("hit", { w: 16, h: 16, fps: 12, loop: false },
  frame(circ(8, 8, 2, "y"), px(8, 8, "w"), px(8, 5, "Y"), px(8, 11, "Y"), px(5, 8, "Y"), px(11, 8, "Y")),
  frame(circ(8, 8, 3, "Y"), circ(8, 8, 1, "w"),
    line(8, 1, 8, 4, "y"), line(8, 12, 8, 15, "y"), line(1, 8, 4, 8, "y"), line(12, 8, 15, 8, "y"),
    line(3, 3, 5, 5, "Y"), line(13, 3, 11, 5, "Y"), line(3, 13, 5, 11, "Y"), line(13, 13, 11, 11, "Y")),
  frame(px(8, 1, "y"), px(8, 14, "y"), px(1, 8, "y"), px(14, 8, "y"),
    px(3, 3, "o"), px(12, 3, "o"), px(3, 12, "o"), px(12, 12, "o"), px(8, 8, "Y")))

anim("sparkle", { w: 16, h: 16, fps: 6 },
  frame(vline(8, 5, 7, "y"), hline(5, 8, 7, "y"), px(8, 8, "Y"), px(4, 4, "o"), px(12, 12, "o")),
  frame(vline(8, 2, 13, "y"), hline(2, 8, 13, "y"), rect(7, 7, 3, 3, "Y"), px(8, 8, "w"),
    px(8, 3, "Y"), px(3, 8, "Y"), px(12, 4, "y"), px(4, 12, "y")))

sprite("_seedmini", { mx: "c" }, `
  ..s
  .sc
  sSc
  sSc
  sSc
  .sc`)
sprite("grave", { w: 14, h: 14, outline: "k" },
  stamp("_seedmini", 4, 2), px(5, 4, "w"),
  ellipse(7, 11, 6, 2, "F"), clip([0, 8, 14, 2], ellipse(7, 11, 5, 2, "l")),
  hline(3, 13, 9, "f"), px(2, 12, "f"), px(12, 12, "f"))

// ------------------------------------------------------------------ UI icons (6x6 + outline = 8x8)
sprite("_heart", { mx: true }, `
  RR.
  RRR
  RRR
  .RR
  ..R`)
sprite("heart_full", { w: 6, h: 6, outline: "k" }, stamp("_heart", 0, 0), px(1, 1, "n"), px(4, 2, "r"), px(3, 3, "r"))
sprite("heart_empty", { w: 6, h: 6, outline: "k" }, stamp("_heart", 0, 0, { swap: { R: "D" } }))
sprite("heart_half", { w: 6, h: 6, outline: "k" },
  stamp("_heart", 0, 0, { swap: { R: "D" } }), clip([0, 0, 3, 6], stamp("_heart", 0, 0)), px(1, 1, "n"))
sprite("icon_seed", { w: 6, h: 6, outline: "k" }, stamp("_seedmini", 1, 0))
sprite("icon_floor", { w: 6, h: 6, outline: "k" }, `
  ..Yy..
  ..Yy..
  ..Yo..
  yyyyoo
  .yyoo.
  ..yo..`)
sprite("icon_skull", { w: 6, h: 6, outline: "k", mx: true }, `
  .cc
  ccc
  ckc
  ccc
  .cS
  .c.`)
sprite("icon_wheel", { w: 6, h: 6, outline: "k" }, `
  .yyyy.
  yo..oy
  y.YY.y
  y.YY.y
  yo..oy
  .yyyy.`)
sprite("icon_sword", { w: 6, h: 6, outline: "k" }, `
  ....Sw
  ...SwS
  o.SwS.
  .oyS..
  .yo...
  y..o..`)

sheet("sprites", [
  "floor_*", "wall_top", "wall_face_*", "stairs", "exit",
  "hero", "beetle", "snake", "cat",
  "seed", "cheese", "hit", "sparkle", "grave",
  "heart_full", "heart_half", "heart_empty", "icon_seed", "icon_floor", "icon_skull", "icon_wheel", "icon_sword",
], { pad: 1 })

// ------------------------------------------------------------------ seam test (not exported to the game)
scene("tiletest", { w: 96, h: 64, bg: "k" },
  tilemap(`
    TTTTTT
    WVWWVW
    0123s0
    21e032`, { size: 16, map: { T: "wall_top", W: "wall_face_0", V: "wall_face_1", 0: "floor_0", 1: "floor_1", 2: "floor_2", 3: "floor_3", s: "stairs", e: "exit" }, frame: 0 }))

// ------------------------------------------------------------------ title illustration (240x96)
pal({ z: "#1A1A20", q: "#F08A3C", Q: "#FFE08A" })   // night sky (UI bg), torch flame
const TW = 240, TH = 96
const wave = (x, base, amp, per, ph = 0) => base + Math.round(amp * Math.sin(x / per + ph))
const chambers = [   // [cx, cy, rx, ry, floorY]
  [56, 52, 26, 12, 62],
  [126, 66, 22, 10, 74],
  [198, 74, 34, 16, 90],
  [46, 84, 16, 7, 90],
]
const passages = [[36, 26, 42, 46], [34, 60, 38, 82], [76, 58, 108, 70], [144, 70, 170, 84]]
const carve = (c, grow, col) => {
  for (const [cx, cy, rx, ry, fy] of chambers)
    c.clip([cx - rx - grow, cy - ry - grow, 2 * rx + 2 * grow + 1, fy - (cy - ry) + grow], () => c.ellipse(cx, cy, rx + grow, ry + grow, col))
  for (const [x0, y0, x1, y1] of passages) c.line(x0, y0, x1, y1, col, 7 + 2 * grow)
}
sprite("_seedo", { w: 5, h: 6, outline: "k" }, stamp("_seedmini", 0, 0), px(1, 2, "w"))
sprite("_sunflower", `
  .oyo.
  oyDyo
  yDDDy
  oyDyo
  .oyo.
  ..g..
  .gG..
  ..g..
  ..gG.
  ..g..
  ..g..`)
scene("title", { w: TW, h: TH, bg: "z" },
  layer("sky",
    px(18, 6, "S"), px(70, 14, "S"), px(112, 4, "w"), px(150, 18, "S"), px(184, 8, "S"), px(226, 3, "w"), px(5, 20, "S"),
    stamp("_sunflower", 214, 10), stamp("_sunflower", 226, 14), stamp("_sunflower", 8, 13, { flip: "x" })),
  layer("earth", (c) => {
    for (let x = 0; x < TW; x++) {
      const g = wave(x, 26, 1, 9), a = wave(x, 40, 2, 17), b = wave(x, 58, 2, 23, 1), d = wave(x, 78, 2, 19, 2)
      c.vline(x, g, a - g, "F"); c.vline(x, a, b - a, "f"); c.vline(x, b, d - b, "D"); c.vline(x, d, TH - d, "K")
      c.px(x, a, "l"); c.px(x, b, "f"); c.px(x, d, "D")            // strata seams catch a little light
      c.px(x, g - 1, x % 3 ? "G" : "g")                            // grass
      if (x % 7 === 2) c.px(x, g - 2, "v")
    }
  },
    // roots hanging from the grass into the topsoil
    line(60, 26, 62, 36, "L"), line(62, 36, 66, 40, "l"), line(61, 31, 57, 35, "l"),
    line(96, 26, 95, 38, "L"), line(95, 34, 99, 38, "l"),
    line(150, 26, 152, 44, "L"), line(152, 44, 150, 50, "l"), line(151, 36, 156, 40, "l"),
    line(218, 26, 219, 40, "L"), line(219, 33, 214, 37, "l"), line(228, 26, 230, 34, "l"),
    // embedded stones
    ellipse(14, 50, 4, 2, "s"), hline(12, 49, 3, "S"), ellipse(100, 48, 3, 2, "s"), hline(99, 47, 2, "S"),
    ellipse(10, 86, 5, 3, "s"), hline(8, 84, 4, "S"), ellipse(150, 90, 4, 2, "s"), hline(148, 89, 3, "S"),
    ellipse(90, 82, 3, 2, "s"), hline(89, 81, 2, "S"), ellipse(236, 54, 3, 2, "s")),
  layer("tunnels",
    (c) => carve(c, 1, "K"),
    (c) => carve(c, 0, "k"),
    // packed floors
    ...chambers.map(([cx, cy, rx, ry, fy]) => hline(cx - rx + 3, fy, 2 * rx - 5, "D"))),
  layer("seeds", (c) => {
    // a pyramid of sunflower seeds in the middle chamber
    const pile = [[0, 0], [6, 0], [12, 0], [18, 0], [24, 0], [3, -5], [9, -5], [15, -5], [21, -5], [6, -10], [12, -10], [18, -10], [12, -15]]
    for (const [dx, dy] of pile) c.stamp("_seedo", 109 + dx, 67 + dy)
  }, vline(126, 47, 5, "Y"), hline(124, 49, 5, "Y"), px(126, 49, "w"), px(134, 56, "Y"), px(112, 60, "Y")),
  layer("foe", stamp("beetle", 48, 75, { frame: 0, flip: "x" })),
  layer("hero",
    stamp("hero", 42, 47, { frame: 0 }),
    line(60, 51, 58, 61, "D"), line(61, 51, 59, 60, "l"),
    grid(58, 44, `
      .q..
      .qq.
      qQqq
      qQQq
      .yy.`)),
  layer("wheel",
    line(198, 74, 188, 90, "o", 2), line(198, 74, 208, 90, "o", 2), hline(184, 90, 28, "o"),
    ring(198, 74, 13, "y"), ring(198, 74, 12, "o"), ring(198, 74, 11, "y"),
    ...[0, 1, 2, 3].map((i) => {
      const t = (i * Math.PI) / 4
      return line(198 - Math.round(11 * Math.cos(t)), 74 - Math.round(11 * Math.sin(t)), 198 + Math.round(11 * Math.cos(t)), 74 + Math.round(11 * Math.sin(t)), "o")
    }),
    circ(198, 74, 2, "Y"), px(190, 64, "w"), px(189, 65, "Y")),
  glow("qQ", { r: 18, strength: 0.4, bands: 3 }),
  glow("yY", { where: [198, 74, 16], r: 20, strength: 0.4, bands: 3 }))
