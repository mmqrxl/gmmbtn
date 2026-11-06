// Squeek Delve: biome tiles b3..b7 and floor props for all eight biomes (b0..b7).
// Rebuild: node <pxl>/bin/pxl.js build art/biomes.px.js, then copy out/biomes.png + biomes.json to web/assets/.
// Same conventions as delve.px.js: 16x16 opaque tiles, 3/4 walls (5px top + lit face), light from the top-left.
// Never use the hero fur hexes #E8B07A / #C98A54 / #8A5A34 here: the game recolors them at runtime.

// Shared colors copied from delve.px.js (same keys, same hexes).
pal({
  k: "#14101C",
  K: "#2A1E25", D: "#3E2C29", f: "#5C4131", F: "#745439", l: "#96704C", L: "#BC9864",   // earth, root ladder
  s: "#5E5A6A", S: "#8F8C99", w: "#FFFFFF", c: "#F7E3C3",                              // stone, white, bone cream
  o: "#A8642A", y: "#F5C451", Y: "#FFF0A8",
  b: "#232A5C", B: "#2F6B9A", t: "#45B5AE", T: "#9EF0DC",                              // cyan crystal
  g: "#1F4A3A", G: "#3C8A44", v: "#86C452", V: "#D2E27A",                              // greens
  e: "#2B1419", E: "#4A1E1F", i: "#73302A", A: "#9C4628", j: "#BD6440", J: "#DB9068",  // Rootclay
  m: "#191828", M: "#2A2840", p: "#3B3958", P: "#504D74", x: "#6E6C9A",                // Crystal Deep slate
  C: "#7E4FD0", N: "#C9A2FF",                                                          // violet crystal
  h: "#0A081266",                                                                      // soft contact shadow under props
})
ramps("kKDfFlL", "kbBtT", "kgGvV", "oyYw", "sS", "eEiAjJ", "mMpPx", "CN")

// Biome role keys, redefined by each biome section below (assets keep the palette active where they
// are defined): 1 wall top, 2 top grit, 3 floor, 4 floor grit, 5 floor pits, 6 lit face, 7 lip,
// 8 lower face, 9 strata, 0 seam at the wall foot. Accents: q/Q glow, z/Z second accent,
// d/I/U/X built material (dark -> light), W/n/a extras.
const ROLE = "1234567890qQzZdIUXWna"
pal(Object.fromEntries([...ROLE].map((k) => [k, "#808080"])))
ramps("k09867", "534", "12", "dIUX", "zZ", "qQ", "na")

const T16 = (name, ...items) => sprite(name, { w: 16, h: 16 }, ...items)
const PAWS = (a, b, at = [[2, 2], [8, 6], [4, 10], [10, 13]]) => at.map(([x, y]) => grid(x, y, `${a}.${a}\n.${b}.`))

// Shared tile skeleton (identical layout to delve.px.js biomes).
function biome(n, { floor, walltop, face } = {}) {
  sprite(`_${n}_floor`, { w: 16, h: 16 }, ...(floor || [rect(0, 0, 16, 16, "3"), noise(0, 0, 16, 16, "4", 0.035, 11), noise(0, 0, 16, 16, "5", 0.02, 23)]))
  T16(`${n}_floor_0`, stamp(`_${n}_floor`, 0, 0))
  sprite(`_${n}_walltop`, { w: 16, h: 16 }, ...(walltop || [rect(0, 0, 16, 16, "1"), noise(0, 0, 16, 16, "2", 0.04, 5)]))
  T16(`${n}_wall_top`, stamp(`_${n}_walltop`, 0, 0))
  sprite(`_${n}_wallface`, { w: 16, h: 16 },
    stamp(`_${n}_walltop`, 0, 0),
    ...(face || [
      rect(0, 5, 16, 11, "6"),
      hline(0, 5, 16, "7"),
      rect(0, 10, 16, 6, "8"),
      (c) => { for (let x = 0; x < 16; x++) c.px(x, x < 5 || x > 11 ? 9 : 8, "8") },
      (c) => { for (let x = 0; x < 16; x++) c.px(x, x < 7 || x > 12 ? 13 : 12, "9") },
    ]),
    hline(0, 15, 16, "0"))
  sprite(`${n}_stairs`, { w: 16, h: 16 },
    stamp(`_${n}_floor`, 0, 0),
    ellipse(8, 9, 6, 5, "5"),
    ellipse(8, 10, 5, 4, "k"),
    hline(4, 6, 9, "4"), hline(3, 7, 11, "1"),
    vline(5, 3, 11, "L"), vline(11, 3, 11, "L"), px(5, 3, "l"), px(11, 3, "l"), px(6, 3, "5"), px(12, 3, "5"),
    hline(6, 8, 5, "L"), hline(6, 11, 5, "l"), hline(6, 13, 5, "F"),
    vline(5, 12, 2, "l"), vline(11, 12, 2, "l"))
}
const tile = (n, name, ...items) => T16(`${n}_${name}`, ...items)
const onFloor = (n, ...items) => [stamp(`_${n}_floor`, 0, 0), ...items]
const onFace = (n, ...items) => [stamp(`_${n}_wallface`, 0, 0), ...items]
const prop = (n, i, ...items) => T16(`${n}_prop_${i}`, ...items)

// Flagstones: seams on the top/left edges so neighbours close them (same layout as b2 slabs).
const slabs = (base, seam, lip) => [
  rect(0, 0, 16, 16, base),
  hline(0, 0, 16, seam), vline(0, 0, 9, seam), vline(9, 0, 9, seam), hline(0, 9, 16, seam), vline(5, 9, 7, seam), vline(12, 9, 7, seam),
  hline(1, 1, 8, lip), vline(1, 1, 8, lip), hline(10, 1, 6, lip), vline(10, 1, 8, lip),
  hline(0, 10, 5, lip), hline(6, 10, 6, lip), vline(6, 10, 6, lip), hline(13, 10, 3, lip), vline(13, 10, 6, lip)]
// Boards: 4px rows with staggered butt joints (rows line up across tiles).
const planks = (base, dark, light, joints) => [
  rect(0, 0, 16, 16, base),
  (c) => { for (let y = 0; y < 16; y += 4) { c.hline(0, y + 3, 16, dark); c.hline(0, y, 16, light) } },
  (c) => joints.forEach((x, i) => { c.vline(x, i * 4, 3, dark); c.px(x + 1, i * 4, base) })]

// ================================================================== props for b0..b2 (delve palette)
// Props sit on any floor tile of their biome: lower two thirds, no black outline (items and foes have one).
// --- b0 Topsoil
prop("b0", 0,   // pebble cluster
  grid(2, 8, `
    ...SS.......
    ..SSSs...S..
    .SSssss.SSs.
    .Sssssd.Sss.
    .hDssDhhhDDh
    ..hhhhh..hh.`.replace(/d/g, "s")),
  grid(10, 7, "S"))
prop("b0", 1,   // grass sprouting from a root
  grid(2, 5, `
    .......v....
    ...v..vG..v.
    ...Gv.vG.vG.
    ....G.GgvG..
    ....GvGgG...
    .....GgGg...
    .LLLLLggLLL.
    LlDDDDDDDDlL
    hDhhhhhhhhDh`))
prop("b0", 2,   // tiny bones: a rib and a knuckle bone
  grid(3, 8, `
    cc.........
    wcc........
    .cSc.......
    ..cSc...cw.
    ...cSc.cSc.
    ....cScSc..
    ....hcSch..
    ...cwSSSc..
    ...hcchcch.
    ....hh.hh..`))
prop("b0", 3,   // tiny brown mushroom
  grid(4, 6, `
    ...LL...
    .lLLLll.
    lLllllFl
    FFFFFFFF
    .DDcSDD.
    ...cS...
    ...cS...
    ..hcSh..
    ..hhhh..`))

// --- b1 Rootclay
prop("b1", 0,   // broken clay pot shard (curved, rim up) and a chip
  grid(2, 7, `
    .......JJ...
    ....JJjjE...
    ..JJjjjiE...
    .Jjjjjiie...
    Jjjjiiiie...
    jjiiiiee..jJ
    hiieeeehh.ie
    .hhhhhh...hh`))
prop("b1", 1,   // thick root knot breaking the surface
  grid(1, 6, `
    .....LL.......
    ....LlDD......
    ...LlDKDLL....
    LL.lDKLlDDD..L
    lDLlDLlDKKDLlD
    DKDDKlDKDDKDDK
    .KKDDDKKhKKKK.
    ..hhKKhhhhhh..`))
prop("b1", 2,   // worm-hole mound: heaped clay with a dark burrow mouth
  grid(3, 8, `
    ....jjj....
    ...jJkkj...
    ..jJjkkij..
    .jjjjiiiij.
    jjJjjiiiiAi
    AiiiiiiiAAE
    hEEAAAAEEEh
    .hhhhhhhhh.`))
prop("b1", 3,   // red clay pebbles
  grid(3, 9, `
    .JJ.......
    JjjA...J..
    jjAA..JjA.
    EAAE..jAAE
    hEEh.Jh.Eh
    .hh.jjA.h.
    ....EAEh..
    .....hh...`))

// --- b2 Crystal Deep
prop("b2", 0,   // glowing cyan crystal cluster (game adds a glow)
  grid(3, 3, `
    .....w....
    ....wT....
    ....TT..w.
    .w..Tt..T.
    .T..Tt.TT.
    TT.wTt.Tt.
    Tt.TTttTt.
    TttTTtttt.
    tttTttttBB
    BtttttBBBb
    hBBBBBBbbh
    .hhhhhhhh.`))
prop("b2", 1,   // violet crystal (game adds a glow)
  grid(4, 4, `
    ....w...
    ...wN...
    ...NN...
    ..NNC.w.
    ..NNC.N.
    ..NCC.NC
    .NNCCNNC
    .NCCCNCC
    NNCCCCCC
    MCCCCCMM
    hMMMMMMh
    .hhhhhh.`))
prop("b2", 2,   // stone rubble
  grid(2, 8, `
    .....xx.....
    ....xxPP....
    .xx.xPPPM...
    xxPPMPPMM.x.
    xPPPMMMM.xPP
    PPMMhhhh.PPM
    hMMhh....hMh
    .hh.......h.`))
prop("b2", 3,   // small geode split open, crystals inside
  grid(3, 6, `
    ...xxxx...
    ..xPPPPx..
    .xPMMMMPP.
    xPMTwtNMPP
    xPMtTCNMPP
    xPMMtCMMPM
    .PPMMMMPPM
    ..MPPPPMM.
    ..hhMMMhh.
    ...hhhhh..`))

// ================================================================== b3 Fungal Grotto
pal({
  1: "#141A24", 2: "#1F2B36", 3: "#2A2942", 4: "#33495A", 5: "#1C1B30",
  6: "#3D6266", 7: "#5E8E86", 8: "#2F4D52", 9: "#283F48", 0: "#18222E",
  q: "#3ED8B4", Q: "#BAFFE6", z: "#7A3FB8", Z: "#C88CFF",   // glow moss, purple fungus
  d: "#3A3D5A", I: "#545A80", U: "#6E74A0", X: "#8C92BC",   // flagstone
  W: "#2E6E5A", n: "#E6DEF2", a: "#A79DC4",                 // moss, fungus stem
})
biome("b3")
tile("b3", "floor_1", ...onFloor("b3",   // a moss patch creeping over the loam, a few glowing tips
  grid(3, 7, `
    ...WW.....
    .WWWWW.W..
    WWqWWWWWW.
    .WWWWWqW..
    ..WW.WW...`)))
tile("b3", "floor_2", ...onFloor("b3",   // pale mycelium threads running just under the surface
  grid(1, 4, `
    a.............
    .a......a.....
    ..aa...a......
    ....a.a.......
    .....a....a...
    ....a.aa.a....
    ...a....a.....
    ..........a...
    ...........a..`)))
tile("b3", "floor_3", ...onFloor("b3", ...PAWS("5", "1")))
tile("b3", "wall_face_0", ...onFace("b3",   // glowing moss dripping from the lip
  grid(0, 6, `
    WWWW.WWWWW.WWWWW
    WqW...WqW...WW.W
    .W.....W.....q..
    .q.............W
    ..........q.....`),
  glow("qQ", { where: [0, 6, 16, 6], r: 2, ramp: 1 })))
tile("b3", "wall_face_1", ...onFace("b3",   // purple shelf fungus growing out of the face
  grid(0, 6, "WWW.......WWWW.W\n.q...........W.."),
  grid(4, 8, `
    .ZZZz..
    ZZZzzz.
    zzzzzzz
    .555555`),
  grid(9, 11, `
    .ZZz
    Zzzz
    .555`)))
tile("b3", "room_0", ...slabs("I", "d", "U"), px(9, 4, "W"), vline(9, 5, 2, "W"), hline(2, 9, 3, "W"), px(3, 9, "q"))
tile("b3", "room_1", ...slabs("I", "d", "U"),   // moss filling the joints, a cracked slab
  hline(0, 9, 5, "W"), vline(0, 3, 4, "W"), vline(5, 11, 3, "W"), px(5, 12, "q"), hline(10, 0, 4, "W"), px(12, 0, "q"),
  grid(11, 3, "d..\n.d.\n.dd\n..d"))
prop("b3", 0,   // tall glowing teal mushroom (game adds a glow)
  grid(3, 2, `
    ...QQQ....
    .QQQqqQq..
    QQqqQqqqq.
    qqqqqqqqqq
    .WWWWWWWW.
    ....na....
    ....na....
    ...nna....
    ...na.....
    ...nna....
    ..nnnaa...
    .hhnaahhh.
    ..hhhhhh..`.replace(/^/, "")))
prop("b3", 1,   // purple mushroom cluster
  grid(2, 6, `
    ...ZZ........
    ..ZZzz...ZZ..
    .ZzzzzZ.ZZzz.
    .zzzzzz.zzzz.
    ...na....na..
    ZZ.na...nna..
    zz..na..na...
    na..nana.a...
    hnahhnaahahh.
    .hhh.hhhhh...`))
prop("b3", 2,   // spore puff: a puffball breathing out glowing spores (game adds a glow)
  grid(3, 3, `
    ..Q......
    ......Q..
    ....q....
    .Q.....q.
    ...QQQ...
    ..QqqqQ..
    .QqqqqqZ.
    .qqqqqqZ.
    .qqqqqzZ.
    ..zzzzZ..
    .hhzzzhh.
    ..hhhhh..`))
prop("b3", 3,   // low moss patch with a couple of glowing tips
  grid(2, 9, `
    .....q.......
    ..WWWWWW.....
    .WWqWWWWWW.q.
    WWWWWWWWWWWW.
    gWWgWWWgWWWWg
    .ggggggggggg.
    ..hhhhhhhhh..`))

// ================================================================== b4 Frost Hollow
pal({
  1: "#16234A", 2: "#22346A", 3: "#A9C6DE", 4: "#DCEDF8", 5: "#89AACA",
  6: "#3F6FB0", 7: "#D8F2FF", 8: "#30589A", 9: "#284B88", 0: "#182A58",
  q: "#7FE8FF", Q: "#E6FFFF", z: "#6C8EBA", Z: "#5679AA",   // ice glow, cracks
  d: "#4A5B78", I: "#6E819E", U: "#91A5BF", X: "#CFE2F0",   // frozen planks + frost
  W: "#7C7F8E", n: "#565A6C", a: "#B4B8C6",                 // pebble
})
// Ice is not granular: the floor gets sparse snow grains only, plus a faint sheen.
biome("b4", { floor: [rect(0, 0, 16, 16, "3"), noise(0, 0, 16, 16, "4", 0.03, 11), noise(0, 0, 16, 16, "5", 0.015, 23)] })
tile("b4", "floor_1", ...onFloor("b4",   // a crack in the ice, branching
  grid(2, 3, `
    z...........
    .z..........
    .Zz.........
    ..Zzz.......
    ....Zz....z.
    .....Zzzzz..
    .....z...Z..
    ....z....Zz.
    ...z......z.`)))
tile("b4", "floor_2", ...onFloor("b4",   // a frozen-over puddle: smooth glassy ice with a sheen
  ellipse(8, 9, 6, 4, "4"), ellipse(8, 9, 6, 4, "5", true),
  line(4, 9, 6, 7, "w"), line(7, 10, 9, 8, "w"), px(11, 8, "w")))
tile("b4", "floor_3", ...onFloor("b4", ...PAWS("5", "z")))
tile("b4", "wall_top", stamp("_b4_walltop", 0, 0))
tile("b4", "wall_face_0", ...onFace("b4",   // icicles hanging from the frost rim
  hline(0, 6, 16, "4"),
  grid(1, 7, `
    7.4..7...4.7..
    4.4..4...4.4..
    4.q..4.....q..
    q....q.....q..
    q.....`),
  line(9, 11, 11, 13, "6"), line(3, 11, 4, 12, "6")))   // sheen streaks on the ice face
tile("b4", "wall_face_1", ...onFace("b4",   // a pebble frozen into the face, frost along a crack
  hline(0, 6, 16, "4"), px(4, 7, "4"), px(12, 7, "4"),
  grid(9, 9, `
    .WW.
    WaWn
    WWnn
    .nn.`),
  grid(2, 8, `
    9...
    .9..
    .99.
    ...9`)))
tile("b4", "room_0", ...planks("I", "d", "U", [5, 12, 2, 9]), hline(1, 0, 3, "X"), hline(8, 4, 2, "X"), hline(13, 8, 3, "X"), hline(4, 12, 2, "X"))
tile("b4", "room_1", ...planks("I", "d", "U", [10, 3, 14, 6]), hline(0, 0, 2, "X"), hline(11, 4, 3, "X"), hline(6, 12, 4, "X"),
  grid(11, 9, "dI\nId"), grid(2, 5, "X.\nXX"))   // knot; a frost bloom in a joint
prop("b4", 0,   // ice stalagmite
  grid(5, 3, `
    ...7...
    ...76..
    ..776..
    ..776..
    ..7768.
    .77668.
    .7Q668.
    .77668.
    77666688
    7766668h
    h888888h
    .hhhhhh.`.replace(/Q/g, "4")))
prop("b4", 1,   // snow drift heaped against nothing in particular, wind-shaped
  grid(1, 9, `
    .....4444.....
    ...44wwww44...
    .44wwwww444444
    4wwwww44444445
    44444444455555
    h555555555555h
    .hhhhhhhhhhhh.`))
prop("b4", 2,   // a pebble locked in a lump of clear ice
  grid(3, 7, `
    ...7777...
    ..7Q4447..
    .7Q4WW445.
    .74WaWn45.
    .74WWnn45.
    .744nn445.
    ..5444455.
    .h555555h.
    ..hhhhhh..`.replace(/Q/g, "w")))
prop("b4", 3,   // glowing ice crystal (game adds a glow)
  grid(4, 2, `
    ....Q...
    ...QQ...
    ...Qq...
    ...Qq.Q.
    .Q.Qq.Qq
    .QqQqqQq
    .QqQqqqq
    QqqQqqqq
    qqqqqqq6
    6qqqqq66
    h666666h
    .hhhhhh.`))

// ================================================================== b5 Magma Vent
pal({
  1: "#120B0E", 2: "#211316", 3: "#2B2527", 4: "#3E3538", 5: "#181215",
  6: "#3E2121", 7: "#603129", 8: "#2D181B", 9: "#251417", 0: "#160B0E",
  q: "#FF8C2E", Q: "#FFE07A", z: "#B83A1C", Z: "#5E1F17",   // lava: hot core -> dull crust
  d: "#17131F", I: "#251F33", U: "#3E3558", X: "#8E80B8",   // obsidian + glint
  W: "#C9C2C6", n: "#8C8490", a: "#5A5260",                 // steam, ash
})
biome("b5")
tile("b5", "floor_1", ...onFloor("b5",   // a cooling crack, still warm in its deepest part
  grid(2, 4, `
    Z...........
    .Z..........
    .zZ.........
    ..zzZ.......
    ...ZzqzZ....
    ......ZzzZ..
    ........Zz..
    .........Z..
    ..........Z.`)))
tile("b5", "floor_2", ...onFloor("b5",   // basalt cooled into a hexagonal column top
  grid(3, 3, `
    ...5555...
    ..5444445.
    .54333335.
    5433333335
    5433333335
    .54333335.
    ..5333335.
    ...5555...`)))
tile("b5", "floor_3", ...onFloor("b5",   // a drift of grey ash
  grid(4, 9, `
    ..aaa...
    .anaana.
    anannaa.
    .aaaa.a.`)))
tile("b5", "wall_face_0", ...onFace("b5",   // a glowing seam zigzagging down the face
  grid(3, 6, `
    .z........
    .qz.......
    ..Qz......
    ..qQz.....
    ...zqz....
    ....zQqz..
    ......zqz.
    .......zq.
    ........z.`),
  glow("qQ", { where: [3, 6, 10, 9], r: 2, ramp: 1 })))
tile("b5", "wall_face_1", ...onFace("b5",   // molten seam along the strata, dripping
  (c) => { for (let x = 0; x < 16; x++) { const y = x < 5 || x > 11 ? 9 : 8; c.px(x, y, x % 5 === 2 ? "Q" : "q"); c.px(x, y + 1, "z") } },
  vline(7, 10, 2, "q"), px(7, 12, "z"), vline(13, 11, 1, "z"),
  glow("qQ", { where: [0, 8, 16, 5], r: 2, ramp: 1 })))
// room: polished obsidian tiles, 8x8, a glint on each tile's lit corner
const obsidian = [
  rect(0, 0, 16, 16, "I"),
  hline(0, 0, 16, "d"), vline(0, 0, 16, "d"), hline(0, 8, 16, "d"), vline(8, 0, 16, "d"),
  (c) => { for (const [x, y] of [[1, 1], [9, 1], [1, 9], [9, 9]]) { c.hline(x, y, 3, "U"); c.vline(x, y, 3, "U"); c.px(x + 1, y + 1, "X") } }]
tile("b5", "room_0", ...obsidian, line(10, 6, 14, 2, "U"))
tile("b5", "room_1", ...obsidian, line(3, 2, 6, 6, "z"), px(5, 5, "q"), px(6, 6, "d"), line(11, 13, 14, 10, "U"))   // a hairline crack, glowing
prop("b5", 0,   // glowing lava crack in the ground (game adds a glow)
  grid(1, 8, `
    ..ZZ..........
    .ZzqZZ......Z.
    ZzqQqzZZ...Zz.
    .ZzqQQqqzZZzqZ
    ..ZZzqQqqqzqzZ
    ....ZZzzqzzZZ.
    ......ZZZZZ...`))
prop("b5", 1,   // ember rock: a basalt lump with live coals in its cracks
  grid(3, 6, `
    ....444...
    ..44433Z..
    .4433z33Z.
    4433qQ333Z
    433zq3z33Z
    3Z333qQz3Z
    .ZZ3333ZZ.
    .hZZZZZZh.
    ..hhhhhh..`))
prop("b5", 2,   // obsidian shard standing in the ground
  grid(5, 3, `
    ...X...
    ..XU...
    ..XUI..
    .XUUI..
    .XUId..
    .UUId..
    XUUIdd.
    UUIIdd.
    UIIddd.
    dIIdddd
    hdddddh
    .hhhhh.`))
prop("b5", 3,   // steam vent: a glowing hole puffing steam (game adds a glow)
  grid(3, 2, `
    ....WW....
    ..WWnWW...
    .WnnWWn...
    ..WWnW....
    ...nW.....
    ....W.....
    ...nW.....
    ....WW....
    ..44444...
    .4ZzqzZ4..
    4ZqQQQqZ4.
    .3ZzzzZ3..
    .h33333h..
    ..hhhhh...`))

// ================================================================== b6 Sunken Ruins
pal({
  1: "#262820", 2: "#33382B", 3: "#8A846F", 4: "#A49E87", 5: "#6A6555",
  6: "#B5AE94", 7: "#D8D1B5", 8: "#9C957D", 9: "#857F69", 0: "#4C493C",
  q: "#3C7C78", Q: "#6FB8AA", z: "#59554A", Z: "#C9C0A2",   // teal inlay, mortar, worn edge
  d: "#3E6230", I: "#C6BB97", U: "#A99F7E", X: "#9CC25A",   // moss dark, temple tile, moss light
  W: "#6E9A44", n: "#4E7E98", a: "#A6CFE0",                 // moss mid, water
})
// Floor: worn paving laid in irregular blocks; seams on the top/left edges close against neighbours.
const paving = [
  rect(0, 0, 16, 16, "3"),
  hline(0, 0, 16, "5"), vline(0, 0, 16, "5"), vline(10, 0, 7, "5"), hline(0, 7, 16, "5"), vline(6, 7, 9, "5"), vline(13, 7, 9, "5"),
  hline(1, 1, 9, "4"), hline(11, 1, 5, "4"), hline(1, 8, 5, "4"), hline(7, 8, 6, "4"), hline(14, 8, 2, "4"),
  // worn chips at block corners
  px(9, 6, "5"), px(5, 15, "5"), px(12, 14, "5")]
biome("b6", {
  floor: paving,
  walltop: [rect(0, 0, 16, 16, "1"), noise(0, 0, 16, 16, "2", 0.05, 5)],
  // ancient masonry: two block courses with offset joints, each block lit along its top
  face: [
    rect(0, 5, 16, 11, "6"), hline(0, 5, 16, "7"),
    hline(0, 10, 16, "9"), hline(0, 6, 16, "Z"), hline(0, 11, 16, "Z"),
    rect(0, 12, 16, 3, "8"),
    vline(4, 6, 4, "9"), vline(12, 6, 4, "9"), vline(8, 11, 4, "9"), vline(0, 11, 4, "9"),
  ],
})
tile("b6", "floor_1", ...paving, hline(0, 7, 6, "W"), px(2, 6, "W"), px(3, 8, "d"), vline(10, 2, 4, "W"), px(11, 4, "X"), hline(1, 0, 4, "d"))   // moss in the joints
tile("b6", "floor_2", ...paving, grid(2, 2, "5..\n.5.\n.55\n...5"), grid(8, 10, "Z5\n.5\n.Z5"))   // cracked blocks
tile("b6", "floor_3", ...paving,   // a carved spiral, worn shallow
  grid(1, 2, `
    .zzz.
    z...z
    z.z.z
    z..z.
    .zz..`), hline(13, 0, 3, "W"), px(14, 1, "X"))
tile("b6", "wall_face_0", ...onFace("b6",   // moss hanging over the lip
  grid(0, 5, `
    XWWWWX.XWWWX...X
    WWdWWW..WdW....W
    .Wd.dW...d.....d
    .d...d.........d
    .....d..........`)))
tile("b6", "wall_face_1", ...onFace("b6",   // a carved glyph in the upper course, a crack in the lower one
  grid(6, 7, `
    q.q
    .q.`),
  hline(6, 7, 1, "q"), px(7, 9, "q"),
  grid(13, 11, "9.\n.9\n9.")))
// room: temple tiles, 8x8 squares with a teal diamond inlay and a worn cream border
const temple = [
  rect(0, 0, 16, 16, "I"),
  hline(0, 0, 16, "z"), vline(0, 0, 16, "z"), hline(0, 8, 16, "z"), vline(8, 0, 16, "z"),
  (c) => { for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
    c.hline(x + 1, y + 7, 7, "U"); c.vline(x + 7, y + 1, 7, "U")
    c.grid(x + 2, y + 2, ".q..\nqQq.\n.qq.\n...".replace(/\./g, "."))
    c.px(x + 4, y + 3, "q"); c.px(x + 4, y + 4, "q"); c.px(x + 5, y + 3, "U")
  } }]
tile("b6", "room_0", ...temple)
tile("b6", "room_1", ...temple, grid(9, 9, "z..\n.zz\n..z"), px(1, 1, "W"), hline(0, 8, 3, "W"), px(1, 7, "X"))   // cracked tile, moss in a joint
prop("b6", 0,   // broken pillar stump, fluted, snapped top
  grid(3, 2, `
    ..7.......
    .767..7...
    76869767..
    6868686898
    6868686898
    6868686898
    6868686898
    6868686898
    6868686898
    7666666688
    9999999999
    h00000000h
    .hhhhhhhh.`))
prop("b6", 1,   // fallen temple tile fragment, moss creeping over it
  grid(2, 7, `
    ...zzzzzz...
    ..zIIIIIIz..
    .zIIqIIIUz..
    zIIqQqIUzWW.
    zIIIqqIUWXW.
    zUUUUUUWWdW.
    .zzzzzdWdd..
    .hhhhhhhhh..`))
prop("b6", 2,   // a small puddle in a sunken stone
  grid(2, 9, `
    ...5555555..
    .55nnnnnnn5.
    5nnaannnnnn5
    5nnnnnaannn5
    .55nnnnnn55.
    ...555555...`))
prop("b6", 3,   // old urn, teal patina at the shoulder
  grid(4, 2, `
    ..7777..
    ...69...
    ..7669..
    .7qQqq9.
    766qq698
    76666698
    76666698
    .766698.
    ..7698..
    ..9999..
    .h0000h.
    ..hhhh..`))

// ================================================================== b7 Void Burrow
pal({
  1: "#0B0916", 2: "#17122E", 3: "#141128", 4: "#5E46B4", 5: "#0B0918",
  6: "#2A2356", 7: "#9466F0", 8: "#1F1A44", 9: "#3A2F74", 0: "#0C0A1A",
  q: "#B07CFF", Q: "#ECDDFF", z: "#5C3FB4", Z: "#382A78",   // void glow
  d: "#100E22", I: "#221D42", U: "#363062", X: "#4C4488",   // floating slabs
  W: "#1A1636", n: "#7A62D8", a: "#D4C4FF",
})
// The floor is near-black; the stars are the material, so a sparse scatter is right here.
biome("b7", {
  floor: [rect(0, 0, 16, 16, "3"), noise(0, 0, 16, 16, "W", 0.05, 11), noise(0, 0, 16, 16, "4", 0.018, 23), noise(0, 0, 16, 16, "a", 0.006, 31)],
  walltop: [rect(0, 0, 16, 16, "1"), noise(0, 0, 16, 16, "2", 0.05, 5)],
  // dark crystal: facets split by lit violet edges, the lip catches the light
  face: [
    rect(0, 5, 16, 11, "6"), hline(0, 5, 16, "7"), hline(0, 6, 16, "9"),
    poly([0, 10, 4, 7, 7, 16, 0, 16], "8"), poly([9, 16, 12, 8, 16, 11, 16, 16], "8"),
    line(0, 10, 3, 7, "9"), line(4, 7, 6, 14, "z"), line(12, 8, 9, 15, "z"), line(12, 8, 15, 11, "9"),
  ],
})
tile("b7", "floor_1", ...onFloor("b7",   // a bright four-point star glinting in the dark
  grid(5, 4, `
    ...n...
    ...q...
    .nqQqn.
    ...q...
    ...n...`)))
tile("b7", "floor_2", ...onFloor("b7",   // a hairline fissure leaking violet light
  grid(2, 4, `
    Z...........
    .Zz.........
    ..zqz.......
    ....zZ......
    .....zqzZ...
    ........zZ..
    .........zZ.`)))
tile("b7", "floor_3", ...onFloor("b7", ...PAWS("z", "Z")))   // pawprints that glow faintly
tile("b7", "wall_face_0", ...onFace("b7",   // a violet crystal spike growing from the face
  grid(9, 6, `
    ..Q..
    .Qq..
    .qqn.
    Qqqn.
    qqnnz
    qnnzz
    Zzzz.`),
  glow("qQ", { where: [9, 6, 5, 7], r: 3, ramp: 1 })))
tile("b7", "wall_face_1", ...onFace("b7",   // a glowing vein through the crystal
  grid(2, 7, `
    Q.........
    .q........
    .qz.......
    ..qq......
    ....qz....
    .....qqz..
    .......qz.
    ........q.`),
  glow("qQ", { where: [2, 7, 10, 8], r: 2, ramp: 1 })))
// room: dark slabs floating over the void, joints glowing violet (b2 slab layout)
tile("b7", "room_0", ...slabs("I", "z", "U"), px(9, 4, "q"), px(0, 12, "q"), px(12, 9, "Q"))
tile("b7", "room_1", ...slabs("I", "z", "U"), px(5, 13, "q"), px(4, 0, "Q"),
  grid(2, 3, "d..\n.d.\n.dd\n...d"), grid(14, 12, "X\nI"))   // a chipped slab
prop("b7", 0,   // floating void orb, its shadow on the ground below (game adds a glow)
  grid(4, 3, `
    ...qq...
    ..qQQq..
    .qQwQqz.
    .qQQqqz.
    .qqqqzz.
    ..zzzZ..
    ...ZZ...
    ........
    ........
    ........
    ..hhhh..
    .hhhhhh.`))
prop("b7", 1,   // star speck cluster hanging just above the floor
  grid(2, 4, `
    ......n.....
    ...........a
    .n....q....n
    ....nqQqn...
    ......q.....
    .a....n...n.
    ..n.........
    .naq....a...
    ..n.........
    .......n....`))
prop("b7", 2,   // glowing rift crack (game adds a glow)
  grid(2, 7, `
    ..........Z.
    .Z.......Zz.
    .zZ.....ZqZ.
    ..zZZ..Zqz..
    ..ZqqZZqQz..
    ...ZqQQqzZ..
    ...ZzqqzZ...
    ..ZzZzZZ....
    .Zz...Z.....
    .Z..........`))
prop("b7", 3,   // dark crystal with violet edges
  grid(4, 3, `
    ....7...
    ...79...
    ...7I9..
    ..79I9.7
    ..7IId79
    .79IId7I
    .7IIdd7I
    79IIddId
    7IIIdddd
    ZIIdddZd
    hZZZZZZh
    .hhhhhh.`))

// ================================================================== seam test scenes (not in the sheet)
for (const n of ["b3", "b4", "b5", "b6", "b7"])
  scene(`biometest_${n}`, { w: 128, h: 112, bg: "k" },
    tilemap(`
      TTTTTTTT
      TWVWWVWT
      T0123s0T
      T2rRrR1T
      T3RrRr0T
      T0102030
      TTWVTTTT`, { size: 16, map: { T: `${n}_wall_top`, W: `${n}_wall_face_0`, V: `${n}_wall_face_1`, 0: `${n}_floor_0`, 1: `${n}_floor_1`, 2: `${n}_floor_2`, 3: `${n}_floor_3`, r: `${n}_room_0`, R: `${n}_room_1`, s: `${n}_stairs` } }),
    stamp(`${n}_prop_0`, 16, 32), stamp(`${n}_prop_1`, 96, 32), stamp(`${n}_prop_2`, 16, 80), stamp(`${n}_prop_3`, 64, 80))
scene("biometest_props", { w: 128, h: 128, bg: "k" },
  ...["b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7"].flatMap((n, r) => [0, 1, 2, 3].flatMap((i) => [
    stamp(n === "b0" || n === "b1" || n === "b2" ? `_pf_${n}` : `${n}_floor_0`, i * 32, r * 16), stamp(`_pf_${n}`, i * 32 + 16, r * 16),
    stamp(`${n}_prop_${i}`, i * 32 + 16, r * 16)])))
// Floor stand-ins for the delve biomes so props can be checked on their ground.
pal({ 3: "f", 4: "F", 5: "D" }); sprite("_pf_b0", { w: 16, h: 16 }, rect(0, 0, 16, 16, "3"), noise(0, 0, 16, 16, "4", 0.035, 11), noise(0, 0, 16, 16, "5", 0.02, 23))
pal({ 3: "i", 4: "A", 5: "E" }); sprite("_pf_b1", { w: 16, h: 16 }, rect(0, 0, 16, 16, "3"), noise(0, 0, 16, 16, "4", 0.035, 11), noise(0, 0, 16, 16, "5", 0.02, 23))
pal({ 3: "p", 4: "P", 5: "M" }); sprite("_pf_b2", { w: 16, h: 16 }, rect(0, 0, 16, 16, "3"), noise(0, 0, 16, 16, "4", 0.035, 11), noise(0, 0, 16, 16, "5", 0.02, 23))
for (const n of ["b3", "b4", "b5", "b6", "b7"]) sprite(`_pf_${n}`, { w: 16, h: 16 }, stamp(`_${n}_floor`, 0, 0))

const TILES = ["floor_0", "floor_1", "floor_2", "floor_3", "room_0", "room_1", "wall_top", "wall_face_0", "wall_face_1", "stairs"]
sheet("biomes", [
  ...["b3", "b4", "b5", "b6", "b7"].flatMap((n) => TILES.map((t) => `${n}_${t}`)),
  ...["b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7"].flatMap((n) => [0, 1, 2, 3].map((i) => `${n}_prop_${i}`)),
], { pad: 1 })
