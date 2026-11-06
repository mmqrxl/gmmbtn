// Squeek Delve: monster roster (regular foes 16x16, bosses 24x24).
// Build: node <pxl>/bin/pxl.js build art/monsters.px.js --out art/out_monsters
// Same rules as delve.px.js: ink outline, light from the top-left, everything faces right.
// Never use the hero fur colors (#E8B07A #C98A54 #8A5A34): the game recolors them at runtime.
pal({
  k: "#14101C",                                                   // ink
  K: "#2A1E25", D: "#3E2C29", f: "#5C4131", F: "#745439",         // earth ramp
  l: "#96704C", L: "#BC9864",
  s: "#5E5A6A", S: "#8F8C99",                                     // stone
  r: "#8C2E3A", R: "#D2483E",
  o: "#A8642A", y: "#F5C451", Y: "#FFF0A8", w: "#FFFFFF",
  c: "#F7E3C3", n: "#F08AA0",
  b: "#232A5C", B: "#2F6B9A", t: "#45B5AE", T: "#9EF0DC",
  g: "#1F4A3A", G: "#3C8A44", v: "#86C452", V: "#D2E27A",
  a: "#E07B39", A: "#9C4628",
  e: "#2B1419", E: "#4A1E1F", i: "#73302A", j: "#BD6440", J: "#DB9068",
  m: "#191828", M: "#2A2840", p: "#3B3958", P: "#504D74", x: "#6E6C9A",
  C: "#7E4FD0", N: "#C9A2FF",
  O: "#7D6F66",
  // --- new for the monster roster
  d: "#2E1F4A", q: "#6A3E86", Q: "#B07AC0",                       // bat purple
  1: "#6E1F3C", 2: "#C24D68",                                     // worm (n is its light)
  4: "#D9902E",                                                   // amber (o dark, y light)
  5: "#3F4A22", 6: "#6E7E2E", 7: "#A3AE46",                       // toad olive
  8: "#E9E6EF", 9: "#B4B0C4",                                     // off-white fur + its cool shadow
  z: "#2C7A5E", Z: "#5DC48A", W: "#B6F2C0",                       // slime mint
  X: "#C24A1E", U: "#7A2614",                                     // fox red
  "0": "#8C9BE6", I: "#E0F0FF", "%": "#5552A8",                   // wraith
  "$": "#1E8C5C",                                                 // serpent emerald
  "&": "#5A2A86",                                                 // royal purple (cape shadow)
})
ramps("kKDfFlL", "kbBtT", "kgGvV", "rRn", "oyYw", "sS", "Aa", "mMpPx", "CN", "dqQ", "12n", "o4y", "567", "98", "zZW", "UXa", "%0I")

// grid helper: every row must be exactly w wide (catches miscounted rows)
const rows = (G) => G.trim().split("\n").map((r) => r.trim())
const chk = (name, G, w) => { rows(G).forEach((r, i) => { if (r.length !== w) throw new Error(`${name} row ${i} is ${r.length} wide`) }); return G }
// idle bob: rows above `cut` sink 1px (row `cut` is swallowed), the rest stays planted
const sink = (G, cut) => (c) => {
  const r = rows(G)
  c.grid(0, 1, r.slice(0, cut).join("\n"))
  c.grid(0, cut + 1, r.slice(cut + 1).join("\n"))
}

// ------------------------------------------------------------------ regular foes (14x14 + outline = 16x16)
const R14 = { w: 14, h: 14, fps: 3, outline: "k" }

// Spider: seen from above, fat furred abdomen, dark head with four red eyes, eight bent legs.
const SPIDER = chk("spider", `
  ..............
  ..f.......f...
  .f.f.....f.f..
  f...f...f...f.
  .....f.f......
  ...DDDDDf.....
  .DDfffDDKKK...
  DDfDDDDDKKKRR.
  DDDDDKDDKKKRR.
  .DDDDDDDKKK...
  ...DDDDDf.....
  .....f.f......
  f...f...f...f.
  .f.f.....f.f..`, 14)
anim("spider", R14, frame(SPIDER), frame((c) => {
  const r = rows(SPIDER)
  c.grid(0, 0, r.slice(0, 5).join("\n")); c.grid(0, 12, r.slice(12).join("\n"))
  c.grid(0, 6, r.slice(5, 11).join("\n").replace(/RR/g, "Rr"))
  c.grid(0, 5, "....f.f..f...."); c.grid(0, 12, ".....f.f......")
}))

// Bat: wings spread wide, purple membrane over lighter finger bones.
anim("bat", { ...R14, frames: 2, fps: 4 }, (c) => {
  const up = c.frame === 0
  for (const s of [1, -1]) {
    const X = (x) => (s === 1 ? x : 13 - x)
    const P = (...a) => a.map((v, i) => (i % 2 ? v : s === 1 ? v : 14 - v))
    if (up) {
      c.poly(P(6, 5, 0, 1, 0, 9, 1, 8, 2, 10, 3, 9, 4, 11, 6, 9), "d")
      c.line(X(5), 5, X(0), 1, "q"); c.line(X(4), 6, X(1), 8, "q"); c.line(X(5), 7, X(3), 9, "q")
    } else {
      c.poly(P(6, 5, 1, 6, 0, 12, 1, 11, 2, 13, 3, 12, 4, 13, 6, 10), "d")
      c.line(X(5), 6, X(1), 6, "q"); c.line(X(1), 6, X(0), 11, "q"); c.line(X(4), 7, X(2), 12, "q")
    }
  }
  c.ellipse(7, 8, 2, 3, "q")
  c.grid(5, 3, `
    Q..Q.
    QqqQq
    qqyqy
    qQqqn
    .qqq.`)
  c.px(6, 8, "Q"); c.px(6, 9, "Q")
})

// Fire ant: red body, a glowing ember gaster that it detonates.
const ANT = chk("fireant", `
  ..............
  ............R.
  ..........RR..
  ..........R...
  .........RRRR.
  .aaaa...RRRkRA
  aayyaa..RRRRA.
  ayYYya.RRrRAA.
  ayYYyaRRr.....
  aayyaarRr.....
  .AaaA..r.r....
  ...r..r...r...
  ..r...r....r..
  ..r....r....r.`, 14)
anim("fireant", { ...R14, fps: 6 }, frame(ANT),
  frame(ANT, grid(1, 6, "ayYYa\nyYYYy\nyYYYy\nayYya"), grid(0, 11, `
    ..r..r...r....
    ..r...r...r...
    .r....r....r..`)),
  glow("yY", { r: 3, strength: 0.5, bands: 2 }))

// Worm: fat S-curved earthworm, a soft tube with segment rings.
const tube = (c, pts, rad, keys, ring = 2.2, ringFrom = 0) => {
  // densely sample the polyline, keep arc length for rings and a 0..1 taper parameter
  const S = []
  let len = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], seg = Math.hypot(x1 - x0, y1 - y0)
    for (let t = 0; t < seg; t += 0.2) S.push([x0 + ((x1 - x0) * t) / seg, y0 + ((y1 - y0) * t) / seg, len + t])
    len += seg
  }
  S.push([...pts.at(-1), len])
  const [dk, md, lt] = keys
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    let best = null, bd = 1e9
    for (const p of S) { const d = Math.hypot(x + 0.5 - p[0], y + 0.5 - p[1]); if (d < bd) { bd = d; best = p } }
    const r = rad(best[2] / len)
    if (bd > r) continue
    const u = (y + 0.5 - best[1]) / r
    let k = u < -0.35 ? lt : u > 0.4 ? dk : md
    if (best[2] > ringFrom && (best[2] % ring) < 0.45) k = k === lt ? md : dk
    c.px(x, y, k)
  }
}
const WORM = (c, f) => {
  const pts = f === 0
    ? [[1, 9], [2, 11.5], [4.5, 12], [6.5, 10.5], [7.5, 8], [8.5, 5.5], [10.5, 4.5], [12.5, 5.5]]
    : [[1, 10], [2, 12], [4.5, 12.3], [6.5, 11], [7.5, 8.5], [8.8, 6.2], [10.8, 5.2], [12.6, 6.4]]
  tube(c, pts, (t) => 1.3 + 0.9 * Math.min(1, t * 2.2), ["1", "2", "n"], 2.1)
}
anim("worm", { ...R14, frames: 2 }, (c) => {
  WORM(c, c.frame)
  const hy = c.frame === 0 ? 4 : 5
  c.px(11, hy, "k"); c.px(12, hy + 2, "1")
})

// Scorpion: amber armor, segmented tail arched over the back, stinger cocked forward.
const SCORP = chk("scorpion", `
  ..............
  ...y44........
  ..y4oo4.......
  ..y4..o4......
  ..y4...oA.....
  ..y4....k.....
  ..y4o.........
  ...y4o....y4..
  ..yyyy4o.y44o.
  .y44444o44oyy.
  .o4444444o.4o.
  ..oooooooo....
  ..o.o.o.o.....
  .o.o.o.o......`, 14)
anim("scorpion", R14, frame(SCORP),
  frame(SCORP, grid(7, 4, "_."), grid(7, 3, "o4"), grid(8, 4, "oA"), grid(8, 5, "_"), grid(9, 4, "."), grid(0, 12, `
    ...o.o.o.o....
    ..o.o.o.o.....`)))

// Toad: squat warty olive body, big eye bump, yellow throat sac.
const TOAD = chk("toad", `
  ..............
  ..............
  ..............
  ..............
  .....6666.77..
  ...66766667w7.
  ..667666666k6.
  .667666766666.
  .6666666665555
  .666676666yYy.
  566666656yYYy.
  556665566yyy..
  .55556.556....
  ..5555..5555..`, 14)
anim("toad", R14, frame(TOAD),
  frame(TOAD, grid(9, 9, "6yYYy"), grid(9, 10, "yYYYy"), grid(9, 11, "yYYy")))

// Ferret: long sneaky body arched mid-stride, white face with a brown bandit mask over the eye.
const FERRET = chk("ferret", `
  ..............
  ..............
  ..............
  ..............
  ..............
  .........f....
  ....llll.F88F.
  ..lllllllFFkF8
  .FlllllllF888n
  FlFFFFFFFF988.
  F..fF...fF....
  ...ff...ff....
  ..............
  ..............`, 14)
anim("ferret", R14, frame(FERRET), frame(sink(FERRET, 10)))

// Slime: mint jelly dome with a sunflower seed floating inside (squashes on frame 1).
const SLIME = [chk("slime", `
  ..............
  ..............
  ..............
  ......Z.......
  .....ZZZ......
  ....ZWZZZ.....
  ...ZWZZZZZZ...
  ..ZWZZZZZZZZ..
  .ZWZZsZZkZZkZ.
  .ZZZsSZZkZZkZ.
  .ZZsSZZZZZZZz.
  .ZZScZZZZzzZz.
  .zZZZZZZZZZzz.
  ..zzzzzzzzzz..`, 14), chk("slime1", `
  ..............
  ..............
  ..............
  ..............
  ..............
  ......Z.......
  ....ZZZZZ.....
  ..ZZWZZZZZZ...
  .ZWZZZZZZZZZZ.
  ZWZZZsZZZkZZkZ
  ZZZZsSZZZkZZkZ
  ZZZsSZZZZZzzZz
  ZZZScZZZZZZZzz
  .zzzzzzzzzzzz.`, 14)]
anim("slime", R14, frame(SLIME[0]), frame(SLIME[1]))

// Barn owl: upright, heart-shaped white face disc, orange eyes.
const OWL = chk("owl", `
  ..............
  ....LLLLLL....
  ...L888888L...
  ..L88888888L..
  ..L8ak88ak8L..
  ..L88889888L..
  ..lL888o88Ll..
  .lLlL8888LlLl.
  .llLlLLLLLlll.
  .lllL8.8LllFl.
  .lFlL.8.LlFFl.
  ..FlLL8LLlFl..
  ...FFllllFF...
  ....oo..oo....`, 14)
anim("owl", R14, frame(OWL), frame(OWL, grid(4, 4, "LL"), grid(8, 4, "LL")))

// Badger: low heavy barrel, grizzled gray back, black legs, striped white head.
const BADGER = chk("badger", `
  ..............
  ..............
  ..............
  ..............
  ...SSSSSSS....
  ..SSSSsSSSS8M.
  .SSsSSSSSSM88M
  SsSSSsSSSSM8k8
  sSSsSSSSSM888n
  sSSSSSSSsM88..
  .sssssssMMM...
  .MMM.MMM.MMM..
  .MkM.MkM.MkM..
  ..............`, 14)
anim("badger", R14, frame(BADGER), frame(sink(BADGER, 10)))

// Wasp: striped abdomen ending in a stinger, smoky blurred wings.
anim("wasp", { ...R14, frames: 2, fps: 8 }, (c) => {
  const f = c.frame
  // wings: pale, see-through blur behind the thorax
  if (f === 0) { c.ellipse(5, 3, 2, 3, "I"); c.ellipse(8, 3, 2, 2, "T") }
  else { c.ellipse(4, 5, 3, 2, "I"); c.ellipse(8, 4, 3, 1, "T") }
  c.ellipse(4, 9, 3, 2, "y")
  c.vline(3, 7, 5, "k"); c.vline(5, 7, 5, "k")
  c.px(0, 11, "k"); c.px(1, 10, "y")                                   // stinger
  c.ellipse(8, 8, 1, 1, "M"); c.px(8, 7, "p")
  c.circ(11, 7, 2, "y"); c.px(12, 6, "k"); c.px(12, 7, "k"); c.px(13, 8, "o"); c.px(10, 6, "Y")
  c.line(11, 4, 13, 2, "M")                                           // antenna
  c.line(8, 10, 7, 12, "M"); c.line(9, 10, 10, 12, "M")
})

// Golem: blocky stone hulk, cyan crystals growing from its shoulder, chest and fist.
const GOLEM = chk("golem", `
  ..............
  ..T...SSSSS...
  .tT...SssTs...
  .BtT..sssps...
  ..SSSSSSSSSS..
  SSSsSSSSSSSsSS
  Ss.sssTtsss.Ss
  Sp.ssBtssps.sp
  sp.sssBssps.sp
  SSs.sssspp.SSs
  Sss.pp..pp.TSs
  ppp.ss..ss.ppp
  ....ss..ss....
  ...Sps..Sps...`, 14)
anim("golem", R14, frame(GOLEM), frame(sink(GOLEM, 10), grid(9, 3, "T")))

// Wraith: the ghost of a hamster: round ears, puffed cheeks, buck teeth, hollow glowing eyes,
// and a wisp where its feet should be. Body colors are slightly see-through.
pal({ "0": "#8C9BE6D8", I: "#E0F0FFE0" })
const WRAITH = chk("wraith", `
  ..............
  ..00......00..
  .0II000000II0.
  .0IIIIIIIIII0.
  .0II%TIII%TI0.
  0III%%I0I%%II0
  0IIIIIIwwIIII0
  .0IIIIIIIIII0.
  ..0I0IIII0I0..
  ...0IIIIII0...
  ....0III0.....
  .....0II0.....
  ..0...0II.....
  ...0000I......`, 14)
const WRAITH1 = chk("wraith1", `
  ..............
  ..............
  ..00......00..
  .0II000000II0.
  .0IIIIIIIIII0.
  .0II%TIII%TI0.
  0III%%I0I%%II0
  0IIIIIIwwIIII0
  .0IIIIIIIIII0.
  ..0I0IIII0I0..
  ....0IIII0....
  .....0III0....
  .0.....0II....
  ..00000I......`, 14)
anim("wraith", { ...R14, outline: "%" }, frame(WRAITH), frame(WRAITH1))

// ------------------------------------------------------------------ bosses (22x22 + outline = 24x24)
const B22 = { w: 22, h: 22, fps: 3, outline: "k", frames: 2 }

anim("boss_tabby", B22, (c) => {
  const b = c.frame
  c.line(1, 18, 2, 8, "A", 2); c.line(2, 8, 4, 6, "a", 2)             // tail curling up
  c.ellipse(9, 15 + b, 8, 5, "a")                                     // crouched body
  c.ellipse(9, 18, 7, 2, "A")
  for (const x of [5, 8, 11]) { c.line(x, 10 + b, x - 1, 14 + b, "A") }  // stripes
  c.circ(15, 9 + b, 5, "a")                                          // head
  c.poly([11, 7 + b, 12, 1 + b, 15, 5 + b], "a"); c.poly([16, 5 + b, 19, 1 + b, 20, 7 + b], "a")   // ears
  c.px(12, 3 + b, "n"); c.px(18, 3 + b, "n")
  c.line(13, 5 + b, 14, 7 + b, "A"); c.line(16, 4 + b, 16, 6 + b, "A")
  c.ellipse(17, 12 + b, 3, 2, "c")                                   // muzzle
  c.grid(14, 8 + b, "VkV.VkV")                                       // slit eyes
  c.px(19, 11 + b, "n")
  c.ellipse(17, 19, 3, 2, "a"); c.ellipse(9, 20, 3, 1, "A")          // paws
  c.grid(18, 20, "w.w.")
})

// Weasel Warlord: upright weasel in a stitched leather helmet, sewing-needle spear, bottle-cap shield.
anim("boss_weasel", B22, (c) => {
  const b = c.frame
  c.vline(3, 1, 20, "S"); c.vline(2, 2, 18, "s"); c.px(3, 0, "w"); c.px(3, 1, "w"); c.px(3, 17, "k")   // needle spear
  c.line(6, 20, 1, 16, "f", 2); c.line(1, 16, 1, 12, "D", 2)          // tail
  c.ellipse(9, 15 + b, 5, 6, "F")                                     // body
  c.ellipse(7, 13 + b, 2, 3, "l")                                     // lit shoulder
  c.ellipse(11, 14 + b, 2, 4, "c")                                    // belly
  c.grid(3, 12 + b, "lF\nFF")                                         // paw on the spear
  c.ellipse(13, 8 + b, 4, 3, "F")                                     // head
  c.poly([15, 6 + b, 22, 9 + b, 15, 12 + b], "F")                     // snout
  c.hline(15, 11 + b, 5, "c"); c.px(21, 9 + b, "k"); c.px(20, 9 + b, "k")
  c.px(10, 6 + b, "l"); c.px(10, 5 + b, "f")                          // ear
  c.px(16, 8 + b, "k"); c.px(17, 8 + b, "k"); c.px(16, 7 + b, "w")   // eye
  c.ellipse(13, 5 + b, 4, 2, "A"); c.rect(9, 5 + b, 9, 1, "A")        // helmet dome
  c.hline(11, 3 + b, 3, "o"); c.px(10, 4 + b, "o")                    // shine
  c.vline(14, 3 + b, 3, "i")                                           // stitched seam
  c.hline(9, 6 + b, 9, "i"); c.px(11, 6 + b, "S"); c.px(16, 6 + b, "S")  // rim + rivets
  c.rect(11, 7 + b, 2, 2, "A"); c.line(12, 9 + b, 15, 11 + b, "i")    // ear flap + chin strap
  c.rect(6, 19, 3, 3, "f"); c.grid(5, 21, "kk")                       // feet
  // bottle-cap shield: crimped silver rim, red face, gold star
  const sx = 15, sy = 16 + b
  for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; c.px(sx + Math.round(5 * Math.cos(t)), sy + Math.round(5 * Math.sin(t)), a % 2 ? "S" : "8") }
  c.circ(sx, sy, 4, "R"); c.ring(sx, sy, 4, "r")
  c.line(sx - 3, sy - 1, sx - 1, sy - 3, "n")
  c.grid(sx - 1, sy - 1, ".y.\nyYy\n.y.")
})

// Great Horned Owl: dark wings half spread, rusty face disc, angry yellow eyes, barred chest.
anim("boss_owl", B22, (c) => {
  const b = c.frame
  for (const s of [1, -1]) {
    const X = (x) => (s === 1 ? x : 21 - x)
    const P = (...a) => a.map((v, i) => (i % 2 ? v : X(v)))
    c.poly(P(8, 7, 3, 8 + b, 0, 13 + b, 0, 18 + b, 2, 17 + b, 3, 19 + b, 5, 18 + b, 6, 20, 8, 19), "D")
    for (let k = 0; k < 3; k++) c.line(X(2 + k), 12 + b + k * 2, X(7), 10 + k * 3, "f")   // feather rows
    c.px(X(1), 17 + b, "F"); c.px(X(3), 18 + b, "F"); c.px(X(5), 18 + b, "F")
  }
  c.ellipse(11, 13, 6, 8, "f")
  c.ellipse(11, 15, 4, 5, "L")
  for (let y = 12; y <= 19; y += 2) for (let x = 8; x <= 14; x += 2) c.px(x + (y % 4 ? 1 : 0), y, "F")   // barring
  c.rect(9, 10, 5, 2, "8")                                            // throat bib
  c.poly([5, 6, 4, 0, 8, 4], "D"); c.poly([17, 6, 18, 0, 14, 4], "D") // ear tufts
  c.px(5, 2, "f"); c.px(17, 2, "f")
  c.ellipse(11, 6, 5, 3, "A"); c.ellipse(11, 7, 4, 2, "o")            // face disc
  c.circ(8, 6, 2, "y"); c.circ(14, 6, 2, "y")
  c.rect(8, 6, 2, 2, "k"); c.rect(14, 6, 2, 2, "k"); c.px(8, 6, "w"); c.px(14, 6, "w")
  if (b) { c.hline(6, 5, 5, "A"); c.hline(12, 5, 5, "A") }            // eyes narrow
  c.line(6, 3, 10, 5, "D"); c.line(16, 3, 12, 5, "D")                 // scowling brows
  c.grid(10, 8, "SS\nSK\n.K")                                          // hooked beak
  c.grid(7, 20, "y.y.....y.y\nk.k.....k.k")                            // talons
})

// Serpent Queen: an emerald coil three loops high, hooded head reared up in a tiny gold crown.
anim("boss_serpent", B22, (c) => {
  const b = c.frame
  const T3 = ["g", "$", "v"]
  c.ellipse(10, 15, 8, 5, "g")                                         // shadowed back of the coil
  tube(c, [[0.5, 21], [2, 19.5], [5, 20], [10, 20.3], [15, 19.8], [19.5, 17.5]], () => 2.3, T3, 99)
  tube(c, [[2.5, 15], [5, 16.8], [10, 17.2], [15, 16.6], [18, 14]], () => 2.1, T3, 99)
  tube(c, [[4.5, 11.5], [7, 13.3], [11, 13.6], [14.5, 12.8], [16, 10.5]], () => 1.9, T3, 99)
  c.ellipse(13, 8 + b, 3, 4, "$"); c.ellipse(13, 8 + b, 2, 3, "G")     // cobra hood
  c.px(12, 7 + b, "V"); c.px(14, 7 + b, "V"); c.px(13, 9 + b, "V")
  tube(c, [[11, 13], [12, 10 + b], [14, 6 + b], [15.5, 4.5 + b]], () => 1.4, T3, 9)   // neck
  c.ellipse(17, 4 + b, 3, 2, "$"); c.hline(15, 3 + b, 4, "v"); c.hline(16, 6 + b, 4, "g")   // head
  c.grid(15, 0 + b, "y.y.y\nyRyCy")                                    // crown
  c.px(18, 4 + b, "y"); c.px(18, 3 + b, "k")                           // eye
  c.grid(19, 6 + b, "kk.\nw.w")                                        // open jaw + fangs
  c.px(21, 5 + b, "R"); c.px(21, 7 + b, "R")                           // forked tongue
})

// Fox Shogun: red fox in a walnut-shell kabuto with gold horns, raising a twig katana.
anim("boss_fox", B22, (c) => {
  const b = c.frame
  c.ellipse(4, 16, 4, 3, "X"); c.ellipse(4, 17, 3, 1, "U"); c.ellipse(1, 18, 2, 2, "8")   // tail
  c.ellipse(10, 14 + b, 5, 6, "X"); c.ellipse(8, 11 + b, 2, 2, "a")   // body + lit shoulder
  c.ellipse(12, 14 + b, 2, 4, "8")                                     // white chest
  c.ellipse(13, 8 + b, 4, 3, "X")                                      // head
  c.poly([15, 7 + b, 21, 9 + b, 15, 11 + b], "X"); c.hline(15, 10 + b, 5, "8"); c.px(21, 9 + b, "k")
  c.px(16, 8 + b, "k"); c.line(15, 7 + b, 17, 7 + b, "U")              // eye + brow
  c.ellipse(12, 5 + b, 5, 3, "l"); c.hline(7, 7 + b, 11, "F")          // walnut kabuto
  c.line(9, 3 + b, 9, 6 + b, "F"); c.line(12, 2 + b, 12, 6 + b, "F"); c.line(15, 3 + b, 15, 6 + b, "F")   // shell ridges
  c.hline(9, 3 + b, 2, "L"); c.px(8, 4 + b, "L")
  c.line(10, 2 + b, 8, 0 + b, "y"); c.line(14, 2 + b, 16, 0 + b, "y")  // gold horns
  c.rect(7, 19, 3, 3, "M"); c.rect(12, 19, 3, 3, "M")                  // black socks
  c.line(17, 14 + b, 21, 2 + b, "L"); c.line(18, 14 + b, 21, 5 + b, "f")   // twig blade
  c.hline(15, 15 + b, 4, "y")                                          // tsuba
  c.line(16, 16 + b, 16, 18 + b, "D")                                  // grip
  c.ellipse(15, 15 + b, 1, 1, "X")                                     // paw
})

// Cat Emperor: black cat on the throne of the burrow: gold crown, ermine collar, violet cape,
// glowing violet eyes, a scepter with a crystal orb.
anim("boss_emperor", B22, (c) => {
  const b = c.frame
  c.poly([4, 9, 18, 9, 22, 22, 0, 22], "&")                            // cape
  c.poly([5, 10, 9, 10, 7, 22, 2, 22], "C"); c.poly([13, 10, 17, 10, 20, 22, 15, 22], "C")
  c.line(3, 21, 5, 13, "N"); c.line(16, 13, 18, 21, "&")               // folds
  c.line(9, 10, 7, 21, "y"); c.line(13, 10, 15, 21, "y")               // gold trim
  c.ellipse(11, 16 + b, 4, 5, "M"); c.ellipse(11, 16 + b, 2, 4, "p")   // chest
  c.rect(8, 20, 2, 2, "p"); c.rect(12, 20, 2, 2, "p")                  // front paws
  c.circ(11, 6 + b, 4, "M"); c.ellipse(11, 7 + b, 5, 3, "M")           // head
  c.poly([5, 6 + b, 5, 1 + b, 9, 3 + b], "M"); c.poly([17, 6 + b, 17, 1 + b, 13, 3 + b], "M")   // ears
  c.px(6, 3 + b, "&"); c.px(6, 4 + b, "&"); c.px(16, 3 + b, "&"); c.px(16, 4 + b, "&")   // inner ears
  c.line(5, 2 + b, 5, 6 + b, "P"); c.px(7, 4 + b, "p"); c.hline(7, 10 + b, 2, "p")   // rim light
  c.grid(8, 6 + b, "CNw.CNw")                                         // glowing eyes
  c.grid(10, 8 + b, "xPx\n.p.")                                        // muzzle
  c.px(6, 8 + b, "P"); c.px(5, 9 + b, "P"); c.px(15, 8 + b, "P"); c.px(16, 9 + b, "P")   // whiskers
  c.hline(5, 10 + b, 12, "8"); c.hline(6, 11 + b, 10, "8")              // ermine collar
  for (const x of [6, 9, 12, 15]) c.px(x, 10 + b + (x % 2), "k")
  c.grid(7, 0 + b, `
    Y...Y...Y
    yY.yYy.Yy
    yyyyyyyyy
    oRoCoRoCo`)                                                        // crown
  c.line(19, 20, 19, 7, "o"); c.vline(18, 9, 11, "y")                  // scepter
  c.circ(19, 5, 2, "C"); c.px(18, 4, "N"); c.px(19, 5, "N"); c.px(18, 4, "w")
  c.ellipse(17, 15 + b, 1, 1, "p")                                     // paw on the scepter
})

sheet("monsters", [
  "spider", "bat", "fireant", "worm", "scorpion", "toad", "ferret", "slime", "owl", "badger", "wasp", "golem", "wraith",
  "boss_tabby", "boss_weasel", "boss_owl", "boss_serpent", "boss_fox", "boss_emperor",
], { pad: 1 })
