// Squeek Delve: pixel art for a hamster-burrow roguelike.
// Rebuild: node <pxl>/bin/pxl.js build art/delve.px.js (see README.md)
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
  a: "#E07B39", A: "#9C4628",                                     // tabby orange (A doubles as Rootclay grit)
  e: "#2B1419", E: "#4A1E1F", i: "#73302A", j: "#BD6440", J: "#DB9068",   // Rootclay: wall top -> lit lip
  m: "#191828", M: "#2A2840", p: "#3B3958", P: "#504D74", x: "#6E6C9A",   // Crystal Deep slate
  C: "#7E4FD0", N: "#C9A2FF",                                     // violet crystal
  O: "#7D6F66",                                                   // rat gray-brown
})
ramps("kKDfFlL", "kbBtT", "kgGvV", "rRn", "oyYw", "sS", "Aa", "eEiAjJ", "mMpPx", "CN")

// ------------------------------------------------------------------ biomes (16x16, opaque)
// Each biome swaps the same roles: wall top, its grit, cave floor, floor grit, pits, lit face, lip,
// lower face, lower strata, and the dark seam at the foot of the wall.
const BIOMES = {
  b0: { top: "K", tg: "D", fl: "f", gr: "F", pit: "D", face: "l", lip: "L", low: "F", str: "f", base: "D" },   // Topsoil
  b1: { top: "e", tg: "E", fl: "i", gr: "A", pit: "E", face: "j", lip: "J", low: "A", str: "i", base: "E" },   // Rootclay
  b2: { top: "m", tg: "M", fl: "p", gr: "P", pit: "M", face: "x", lip: "S", low: "P", str: "p", base: "M" },   // Crystal Deep
}
for (const [n, B] of Object.entries(BIOMES)) {
  sprite(`_${n}_floor`, { w: 16, h: 16 },
    rect(0, 0, 16, 16, B.fl),
    // packed ground is granular: a sparse, even scatter of lighter grit and darker pits
    noise(0, 0, 16, 16, B.gr, 0.035, 11), noise(0, 0, 16, 16, B.pit, 0.02, 23))
  sprite(`${n}_floor_0`, { w: 16, h: 16 }, stamp(`_${n}_floor`, 0, 0))

  sprite(`_${n}_walltop`, { w: 16, h: 16 }, rect(0, 0, 16, 16, B.top), noise(0, 0, 16, 16, B.tg, 0.04, 5))
  sprite(`${n}_wall_top`, { w: 16, h: 16 }, stamp(`_${n}_walltop`, 0, 0))

  // 3/4 wall: 5px of wall top, a lit lip, then the face with strata that meet at the tile edges.
  sprite(`_${n}_wallface`, { w: 16, h: 16 },
    stamp(`_${n}_walltop`, 0, 0),
    rect(0, 5, 16, 11, B.face),
    hline(0, 5, 16, B.lip),
    rect(0, 10, 16, 6, B.low),
    (c) => { for (let x = 0; x < 16; x++) c.px(x, x < 5 || x > 11 ? 9 : 8, B.low) },
    (c) => { for (let x = 0; x < 16; x++) c.px(x, x < 7 || x > 12 ? 13 : 12, B.str) },
    hline(0, 15, 16, B.base))

  // Stairs down: a hole with a root ladder, on this biome's floor.
  sprite(`${n}_stairs`, { w: 16, h: 16 },
    stamp(`_${n}_floor`, 0, 0),
    ellipse(8, 9, 6, 5, B.pit),
    ellipse(8, 10, 5, 4, "k"),
    hline(4, 6, 9, B.gr), hline(3, 7, 11, B.top),   // far wall of the shaft, lit
    vline(5, 3, 11, "L"), vline(11, 3, 11, "L"), px(5, 3, "l"), px(11, 3, "l"), px(6, 3, B.pit), px(12, 3, B.pit),
    hline(6, 8, 5, "L"), hline(6, 11, 5, "l"), hline(6, 13, 5, "F"),
    vline(5, 12, 2, "l"), vline(11, 12, 2, "l"))
}
const T = (n, name, ...items) => sprite(`${n}_${name}`, { w: 16, h: 16 }, ...items)

// --- b0 Topsoil: warm dirt
T("b0", "floor_1", stamp("_b0_floor", 0, 0),   // pebble pair
  grid(3, 8, `
    .SS.
    SSss
    Dsss
    .DD.`),
  grid(9, 11, `
    SS
    ss
    DD`))
T("b0", "floor_2", stamp("_b0_floor", 0, 0),   // root tip poking out of the ground
  grid(2, 3, `
    DLL......
    .DlLL....
    ..DDlLL..
    ....DDlL.
    ......Dl.
    .......D.`))
const PAWS = (a, b) => [[2, 2], [8, 6], [4, 10], [10, 13]].map(([x, y]) => grid(x, y, `${a}.${a}\n.${b}.`))
T("b0", "floor_3", stamp("_b0_floor", 0, 0), ...PAWS("D", "K"))   // tiny hamster pawprints, pressed in
T("b0", "wall_face_0", stamp("_b0_wallface", 0, 0),
  grid(10, 10, `
    Ss
    sD`))
T("b0", "wall_face_1", stamp("_b0_wallface", 0, 0),   // a root hanging out of the face
  grid(4, 5, `
    LD.
    lD.
    Ll.
    .LD
    .lD
    .L.
    ..l`))
// room: old planks, 4px boards with staggered butt joints (rows line up across tiles)
const planks = (joints, ...extra) => [
  rect(0, 0, 16, 16, "F"),
  (c) => { for (let y = 0; y < 16; y += 4) { c.hline(0, y + 3, 16, "D"); c.hline(0, y, 16, "l") } },
  (c) => joints.forEach((x, i) => { c.vline(x, i * 4, 3, "D"); c.px(x + 1, i * 4, "F") }),
  ...extra]
T("b0", "room_0", ...planks([5, 12, 2, 9]), hline(8, 9, 3, "f"), px(13, 1, "s"), px(3, 13, "s"))
T("b0", "room_1", ...planks([10, 3, 14, 6]), hline(1, 5, 4, "f"), hline(9, 14, 3, "f"), px(11, 1, "s"), px(4, 9, "s"),
  grid(12, 9, "fD\nDf"))   // a knot in the wood

// --- b1 Rootclay: red terracotta clay laced with dark roots
T("b1", "floor_1", stamp("_b1_floor", 0, 0),   // clay lumps rolled off the walls
  grid(3, 9, `
    .jj.
    jjAA
    EAAA
    .EE.`),
  grid(10, 4, `
    jA
    EE`))
T("b1", "floor_2", stamp("_b1_floor", 0, 0),   // a dark root crossing the floor, dipping under the clay
  grid(0, 6, `
    DD.............D
    KDDD........DDK.
    ..KKDD....DDK...
    ....KKDDDDKK....
    ......KKKK......`))
T("b1", "floor_3", stamp("_b1_floor", 0, 0),   // the clay dried and cracked
  grid(3, 3, `
    E.......
    .E......
    .jE.....
    ..jEE...
    ....jEEE
    ....E...
    ...jE...
    ...E....`))
T("b1", "wall_face_0", stamp("_b1_wallface", 0, 0),   // a buried stone
  grid(10, 10, `
    Ss
    sE`))
T("b1", "wall_face_1", stamp("_b1_wallface", 0, 0),   // a thick dark root hanging out of the face
  grid(4, 5, `
    DK.
    DK.
    DDK
    .DK
    .DK
    .DK
    ..K`), grid(7, 9, "D\nK"))
// room: fired clay bricks in a running bond, 8x4 with offset rows
const bricks = (...extra) => [
  rect(0, 0, 16, 16, "A"),
  (c) => { for (let y = 0; y < 16; y += 4) { c.hline(0, y + 3, 16, "E"); c.hline(0, y, 16, "j") } },
  (c) => { for (let y = 0; y < 16; y += 4) for (const x of (y / 4) % 2 ? [3, 11] : [7, 15]) { c.vline(x, y, 3, "E"); c.px(x + 1 > 15 ? 0 : x + 1, y, "A") } },
  ...extra]
T("b1", "room_0", ...bricks(), hline(9, 9, 2, "i"), hline(1, 13, 3, "i"))
T("b1", "room_1", ...bricks(), grid(12, 4, "E.\n.E\nE."), grid(1, 4, "K\nK.\n.K"), hline(2, 13, 3, "i"))   // cracked brick, a root through a joint

// --- b2 Crystal Deep: cool slate, crystals growing from the walls
T("b2", "floor_1", stamp("_b2_floor", 0, 0),   // slate chips
  grid(3, 9, `
    .xx.
    xxPP
    MPPP
    .MM.`),
  grid(10, 4, `
    xP
    MM`))
T("b2", "floor_2", stamp("_b2_floor", 0, 0),   // a crystal shard that broke off a wall
  grid(9, 8, `
    ..T.
    .Tt.
    MtM.`))
T("b2", "floor_3", stamp("_b2_floor", 0, 0), ...PAWS("M", "m"))   // pawprints in the slate dust
T("b2", "wall_face_0", stamp("_b2_wallface", 0, 0),   // cyan crystal cluster
  grid(8, 6, `
    ..w...
    .TT...
    .Tt.T.
    TTt.Tt
    Ttt.tt
    MtMMtM`),
  glow("wT", { where: [8, 6, 6, 6], r: 3, ramp: 1 }))
T("b2", "wall_face_1", stamp("_b2_wallface", 0, 0),   // violet crystal
  grid(3, 5, `
    .N...
    NNC..
    NNC..
    NCC.N
    NCCNC
    NCCNC
    MCMMC`),
  glow("N", { where: [3, 5, 5, 7], r: 3, ramp: 1 }))
// room: slate flagstones; seams drawn on the left/top edges so neighbours close them
const slabs = (...extra) => [
  rect(0, 0, 16, 16, "P"),
  hline(0, 0, 16, "M"), vline(0, 0, 9, "M"), vline(9, 0, 9, "M"), hline(0, 9, 16, "M"), vline(5, 9, 7, "M"), vline(12, 9, 7, "M"),
  // lit top-left lips on each slab
  hline(1, 1, 8, "x"), vline(1, 1, 8, "x"), hline(10, 1, 6, "x"), vline(10, 1, 8, "x"),
  hline(0, 10, 5, "x"), hline(6, 10, 6, "x"), vline(6, 10, 6, "x"), hline(13, 10, 3, "x"), vline(13, 10, 6, "x"),
  ...extra]
T("b2", "room_0", ...slabs())
T("b2", "room_1", ...slabs(), grid(3, 3, "M..\n.M.\n.MM\n..M"), grid(13, 5, "t\nM"))   // a crack and a sliver of crystal in a seam

// Exit: golden hamster wheel on Crystal Deep ground. The two frames turn the spokes 45 degrees.
anim("exit", { w: 16, h: 16, fps: 4 },
  stamp("_b2_floor", 0, 0),
  line(8, 8, 4, 15, "o"), line(8, 8, 12, 15, "o"),
  hline(3, 15, 3, "m"), hline(11, 15, 3, "m"),
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

// Rat: lean and low, long snout, big ear, thin pink tail.
const RAT = `
  ..............
  ..............
  ..............
  ..............
  ........SS....
  .......sns....
  ......OOOOO...
  .....OOOOOkOO.
  ...sOOOOOOOOOn
  ..ssOOOOOOSS..
  ..sssOOOSSS...
  .n.sssssss....
  n...n..n..n...
  n.............`
anim("rat", { w: 14, h: 14, fps: 4, outline: "k" },
  frame(RAT),
  // twitch: ear flicks back, snout lifts, tail curls up
  frame(RAT, grid(7, 4, "_SS_\n_sns"), grid(7, 4, ".SS\n.sns".replace(/\./g, ".")), grid(13, 7, "n"), grid(13, 8, "_"), grid(0, 11, ".n\nn.\n_."), grid(0, 10, "n")))

// Mole: a chunky velvet barrel with tiny squinting eyes and huge pink digging claws.
const MOLE = `
  ..............
  ..............
  ....ppppp.....
  ..psssssspp...
  .psSSsssssp...
  psSSssssssp...
  psSssssskksp..
  pssssssssssspn
  psssssssssssnn
  ppssssssccnc..
  .pppssscnncnc.
  ..ppppncncnc.n
  ...p.p.n.n.n..
  ..............`
anim("mole", { w: 14, h: 14, fps: 3, outline: "k" },
  frame(MOLE),
  // breath: back rises a pixel, claws flex
  frame(MOLE, grid(4, 1, "ppppp"), grid(2, 2, "psssssspp"), grid(1, 3, "psSSssssssp"), grid(0, 4, "psSSssssssp"),
    grid(11, 11, "c.n"), grid(9, 12, "n..n")))

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

// ------------------------------------------------------------------ loot (14x14 + outline = 16x16)
// stick(x, y, len, keys): a 45-degree tube rising to the right from (x, y), one column per key.
const stick = (x, y, len, keys) => (c) => { for (let i = 0; i < len; i++) [...keys].forEach((k, j) => k !== "." && c.px(x + i + j, y - i, k)) }
const L14 = { w: 14, h: 14, outline: "k" }

sprite("_chestbody", { w: 14, h: 14, mx: true },
  rect(1, 7, 6, 6, "F"), hline(1, 9, 6, "f"), hline(1, 11, 6, "f"), hline(1, 12, 6, "f"),
  vline(3, 7, 6, "y"), px(3, 12, "o"), rect(6, 6, 1, 4, "y"), px(6, 9, "o"))
sprite("chest", L14,
  stamp("_chestbody", 0, 0),
  rect(1, 3, 12, 4, "l"), hline(2, 2, 10, "l"), hline(2, 3, 10, "L"), hline(1, 6, 12, "f"),
  vline(3, 2, 5, "y"), vline(10, 2, 5, "y"), vline(10, 2, 5, "o"), px(3, 2, "Y"),
  rect(6, 6, 2, 3, "y"), px(6, 7, "k"), px(7, 8, "o"),
  vline(12, 7, 6, "f"))
sprite("chest_open", L14,
  stamp("_chestbody", 0, 0),
  // lid flipped back, showing its dark inside
  rect(2, 1, 10, 3, "f"), hline(2, 1, 10, "F"), vline(3, 1, 3, "o"), vline(10, 1, 3, "o"),
  rect(1, 4, 12, 3, "K"), hline(1, 6, 12, "D"),
  px(4, 5, "y"), px(5, 5, "Y"), px(8, 4, "y"), px(9, 5, "o"), px(6, 4, "w"), px(6, 3, "Y"), px(5, 4, "Y"), px(7, 4, "Y"),
  rect(6, 7, 2, 2, "y"), px(7, 8, "o"), vline(12, 7, 6, "f"),
  glow("wY", { where: [4, 3, 6, 3], r: 2, ramp: 1 }))

sprite("pebble", { w: 14, h: 14, outline: "k" }, grid(6, 6, "SS.\nSss\n.ss".replace(/\./g, "s")), px(6, 6, "w"), px(8, 8, "M"))

// weapons: handle bottom-left, business end top-right
sprite("wpn_0", L14,   // Twig
  stick(1, 12, 11, "lF"),
  grid(2, 4, `
    .vv..
    vvvG.
    vGGGG
    .GgG.
    ..g..`),
  px(5, 8, "F"), px(9, 6, "l"), px(10, 6, "F"))
sprite("wpn_1", L14,   // Thorn Dagger
  stick(1, 12, 4, "Lc"), px(2, 12, "L"), px(1, 12, "D"),
  stick(4, 9, 2, "rRr"),
  stick(5, 7, 4, "RRr"), stick(7, 5, 4, "Rr"), px(12, 1, "R"),
  px(6, 7, "n"))
sprite("wpn_2", L14,   // Pencil Spear
  stick(1, 12, 2, "nnr"), stick(3, 10, 1, "wSs"),
  stick(4, 9, 6, "Yyo"),
  stick(10, 3, 1, "cLL"), stick(11, 2, 1, "cL"), px(12, 1, "s"), px(13, 0, "k"))
sprite("wpn_3", L14,   // Acorn Hammer
  stick(1, 12, 6, "lF"),
  circ(9, 5, 3, "a"), clip((x, y) => x + y >= 15, circ(9, 5, 3, "A")),
  clip((x, y) => x + y <= 12, circ(9, 5, 4, "F")), (c) => { for (const [x, y] of [[7, 3], [9, 2], [6, 5], [8, 4]]) c.px(x, y, "f") },
  px(10, 4, "Y"), px(12, 8, "A"), px(5, 1, "f"), px(4, 0, "F"))
sprite("_fork", L14,
  stick(1, 12, 6, "Yyo"),
  rect(7, 3, 4, 4, "y"),
  // three tines: 45-degree prongs separated by gaps
  stick(7, 3, 4, "Y."), stick(9, 4, 4, "y"), stick(10, 6, 4, "o"),
  px(7, 6, "Y"), px(8, 5, "Y"), px(10, 6, "o"), px(9, 6, "o"))
sprite("wpn_4", { w: 16, h: 16 },   // Golden Fork, legendary
  stamp("_fork", 0, 0), glow("Y", { r: 2, ramp: 1 }),
  px(1, 1, "Y"), px(0, 1, "y"), px(2, 1, "y"), px(1, 0, "y"), px(1, 2, "y"),
  px(14, 10, "Y"), px(13, 10, "o"), px(15, 10, "o"), px(14, 9, "o"), px(14, 11, "o"), px(5, 3, "Y"))

// armor
sprite("arm_0", { w: 16, h: 16 },   // empty slot: dim dashed helmet outline
  (c) => {
    for (let a = 0; a <= 16; a++) {
      const t = Math.PI * (a / 16)
      if (a % 3 !== 2) c.px(8 - Math.round(5 * Math.cos(t)), 10 - Math.round(5 * Math.sin(t)), "D")
    }
    for (let x = 2; x <= 14; x++) if (x % 3 !== 1) c.px(x, 11, "D")
  })
sprite("arm_1", L14,   // Walnut Helm: half a walnut shell
  ellipse(7, 9, 6, 6, "l"), rect(0, 10, 14, 4, "_"),
  hline(1, 10, 12, "F"), hline(1, 11, 12, "f"),
  // the walnut's wrinkled ridges
  grid(3, 5, `
    L..F..
    .F.L.F
    F.L..L
    .L.F..`),
  vline(7, 3, 7, "F"), px(6, 3, "L"), px(4, 5, "L"), px(5, 4, "L"), shade([10, 4, 4, 6]))
sprite("arm_2", L14,   // Thimble Mail
  rect(3, 3, 8, 9, "S"), hline(4, 2, 6, "S"), rect(2, 10, 10, 2, "S"),
  hline(2, 12, 10, "s"), hline(2, 10, 10, "w"),
  (c) => { for (let y = 4; y <= 8; y += 2) for (let x = 4 + (y / 2) % 2; x <= 9; x += 2) c.px(x, y, "s") },
  vline(4, 3, 6, "w"), px(5, 2, "w"), shade([9, 3, 2, 7]), px(10, 11, "s"))
sprite("arm_3", L14,   // Chestnut Plate: spiky green husk around a glossy brown nut
  circ(7, 7, 5, "G"), clip((x, y) => x + y >= 16, circ(7, 7, 5, "g")),
  (c) => { for (const [x, y] of [[7, 0], [2, 2], [12, 2], [0, 7], [14, 7], [2, 12], [12, 12], [7, 14], [4, 1], [10, 1], [1, 4], [13, 4]]) c.px(x, y, x + y > 14 ? "g" : "v") },
  ellipse(7, 8, 3, 3, "A"), px(6, 6, "a"), px(5, 7, "a"), hline(5, 11, 5, "f"), px(9, 10, "f"), px(10, 9, "f"),
  px(4, 4, "v"), px(3, 5, "v"))

// slings
sprite("sl_0", L14,   // Pebble Toss: a little pile
  circ(4, 10, 2, "s"), circ(10, 10, 2, "s"), circ(7, 6, 2, "S"),
  px(3, 9, "S"), px(9, 9, "S"), px(6, 5, "w"), px(5, 12, "M"), px(11, 12, "M"))
sprite("sl_1", L14,   // Rubber Sling: Y twig with a red band
  vline(6, 7, 7, "l"), vline(7, 7, 7, "F"),
  line(6, 7, 2, 2, "l"), line(7, 7, 11, 2, "F"), line(3, 2, 6, 6, "F"), line(10, 2, 7, 5, "l"),
  px(2, 1, "l"), px(11, 1, "F"),
  line(2, 3, 6, 5, "R"), line(11, 3, 7, 5, "r"), rect(6, 5, 2, 2, "R"), px(6, 5, "n"))
sprite("sl_2", L14,   // Pea Shooter: a drinking straw and a pea
  stick(1, 12, 9, "vGg"), stick(1, 12, 1, ".V"),
  circ(11, 2, 1, "v"), px(11, 2, "V"), px(12, 1, "V"), px(12, 3, "G"))

// consumables
sprite("pouch", L14,
  ellipse(7, 9, 5, 4, "c"), clip((x, y) => x + y > 17, ellipse(7, 9, 5, 4, "L")),
  rect(5, 3, 4, 3, "c"), px(4, 2, "c"), px(9, 2, "L"), px(8, 4, "L"),
  hline(4, 5, 6, "r"), px(10, 6, "r"), px(11, 7, "R"),
  px(4, 8, "w"), px(5, 7, "w"))
sprite("vitamin", L14,   // two-tone capsule
  stick(2, 11, 5, "RRr"), stick(7, 6, 5, "wcL"),
  px(2, 11, "n"), px(12, 2, "c"), px(3, 10, "n"), px(8, 5, "w"))
sprite("_leaf", { mx: true }, `
  .vv
  vvG
  vGG
  .GG
  ..g`)
sprite("clover", L14,
  stamp("_leaf", 1, 0, { rot: 270 }), stamp("_leaf", 7, 0), stamp("_leaf", 1, 6, { rot: 180 }), stamp("_leaf", 7, 6, { rot: 90 }),
  px(6, 6, "g"), px(7, 6, "g"), px(6, 7, "g"), px(7, 7, "G"),
  line(7, 9, 10, 13, "g"))
sprite("whisker", { w: 16, h: 16 },
  stamp("_whisker", 0, 0),
  px(12, 2, "Y"), px(11, 2, "y"), px(13, 2, "y"), px(12, 1, "y"), px(12, 3, "y"), px(14, 5, "Y"))
sprite("_whisker", L14,
  line(1, 12, 6, 8, "S"), line(6, 8, 8, 4, "S"),
  px(9, 3, "w"), px(10, 3, "w"), px(11, 4, "S"), px(11, 5, "S"), px(10, 6, "S"), px(9, 5, "w"))
sprite("bigcheese", L14,   // whole wheel, one wedge cut out
  ellipse(7, 8, 6, 4, "y"), rect(1, 8, 13, 3, "y"), ellipse(7, 11, 6, 2, "o"), rect(1, 8, 13, 2, "y"),
  ellipse(7, 7, 6, 3, "Y"),
  // the cut: a wedge from the centre to the front-right rim
  poly([7, 7, 14, 7, 14, 13, 10, 13], "_"),
  poly([7, 7, 10, 10, 10, 13, 7, 11], "y"), vline(10, 10, 3, "o"),
  px(4, 6, "o"), px(10, 5, "o"), px(3, 10, "o"), px(8, 11, "o"), px(9, 10, "o"))

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

sprite("icon_shield", { w: 6, h: 6, outline: "k", mx: true }, `
  SSS
  SBB
  SBt
  SBB
  .SB
  ..S`)
sprite("icon_pebble", { w: 6, h: 6, outline: "k" }, `
  ......
  .SSs..
  SwSss.
  SSsss.
  .ssM..
  ......`)
sprite("icon_crit", { w: 6, h: 6, outline: "k" }, `
  ..Y...
  ..y...
  YywyY.
  ..y...
  ..Y...
  ......`)
sprite("icon_luck", { w: 6, h: 6, outline: "k" }, `
  .SSS..
  S...S.
  S.w.S.
  .S.S..
  ..S...
  ...SSw`)

sheet("sprites", [
  "b0_*", "b1_*", "b2_*", "exit",
  "hero", "beetle", "snake", "cat", "rat", "mole",
  "seed", "cheese", "hit", "sparkle", "grave",
  "chest", "chest_open", "pebble", "wpn_*", "arm_*", "sl_*", "pouch", "vitamin", "clover", "whisker", "bigcheese",
  "heart_full", "heart_half", "heart_empty", "icon_*",
], { pad: 1 })

// ------------------------------------------------------------------ seam test (not exported to the game)
for (const n of Object.keys(BIOMES))
  scene(`tiletest_${n}`, { w: 128, h: 96, bg: "k" },
    tilemap(`
      TTTTTTTT
      TWVWWVWT
      T0123s0T
      T2rRrR1T
      T3RrRr${n === "b2" ? "e" : "0"}T
      TTWVTTTT`, { size: 16, map: { T: `${n}_wall_top`, W: `${n}_wall_face_0`, V: `${n}_wall_face_1`, 0: `${n}_floor_0`, 1: `${n}_floor_1`, 2: `${n}_floor_2`, 3: `${n}_floor_3`, r: `${n}_room_0`, R: `${n}_room_1`, s: `${n}_stairs`, e: "exit" }, frame: 0 }))

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
