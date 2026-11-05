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
  noise(0, 0, 16, 16, "F", 0.05, 11), noise(0, 0, 16, 16, "D", 0.03, 23))

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
  grid(3, 3, `
    D.D
    .DD`),
  grid(8, 7, `
    D.D
    .DD`),
  grid(4, 11, `
    D.D
    .DD`))

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
  grid(10, 6, `
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
  vline(5, 6, 8, "L"), vline(11, 6, 8, "L"),
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
  .A.....
  .aA....
  .anA...
  .anaaaa
  aaAaaAa
  aAaaaaa
  SAAaaaa
  SVVAaaa
  SVkVSSS
  SSVSSSn
  .SSSSkk
  .sSSwkk
  ssSSSSS
  saaaaSS`
anim("cat", { w: 14, h: 14, fps: 3, outline: "k", mx: true },
  frame(CAT),
  frame(CAT, grid(1, 7, "AAA")))

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
  ellipse(7, 12, 7, 3, "F"), clip([0, 9, 14, 2], ellipse(7, 12, 6, 2, "l")),
  stamp("_seedmini", 5, 3), hline(4, 9, 7, "f"))

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
  ..yy..
  ..yy..
  yyyyyy
  .oyyo.
  ..oo..`)
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
