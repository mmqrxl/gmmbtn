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
anim("spider", R14, frame(SPIDER), frame(SPIDER))

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

// Ferret: long sneaky body arched mid-stride, cream face with a brown bandit mask.
const FERRET = chk("ferret", `
  ..............
  ..............
  ..............
  ..............
  ..............
  .....FFF..FF..
  ...FFllFF.F8F.
  ..FllllllF88kF
  .FlllllllF888n
  FlF888888lF88.
  F..9888889F...
  F...fF...fF...
  ....ff...ff...
  ..............`, 14)
anim("ferret", R14, frame(FERRET), frame(sink(FERRET, 10)))

// Slime: mint jelly dome with a sunflower seed floating inside (squashes on frame 1).
anim("slime", { ...R14, frames: 2 }, (c) => {
  const sq = c.frame === 1
  const cy = sq ? 10 : 9, rx = sq ? 7 : 6, ry = sq ? 3 : 4
  c.ellipse(7, cy, rx, ry, "Z")
  c.rect(7 - rx + 1, cy, 2 * rx - 1, 13 - cy + 1, "Z")
  c.hline(7 - rx + 2, 13, 2 * rx - 3, "z")
  c.vline(7 + rx - 1, cy, 13 - cy, "z")
  c.hline(7 - rx + 2, cy - ry + 1, 3, "W"); c.px(7 - rx + 1, cy - ry + 2, "W"); c.px(7 - rx + 1, cy - ry + 3, "W")
  c.grid(4, cy, sq ? "sS\nssS" : "s.\nsS\n.s")
  c.px(9, cy - 1, "k"); c.px(11, cy - 1, "k")
})

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

// Golem: blocky stone hulk studded with cyan crystals.
anim("golem", { ...R14, frames: 2 }, (c) => {
  const b = c.frame                                                   // breathing: torso dips 1px
  c.rect(4, 11, 3, 3, "s"); c.rect(9, 11, 3, 3, "s")                 // legs
  c.rect(2, 4 + b, 11, 8, "S")                                       // torso
  c.rect(2, 9 + b, 11, 3, "s")
  c.rect(7, 1 + b, 5, 4, "S"); c.hline(7, 4 + b, 5, "s")             // head
  c.px(10, 2 + b, "T"); c.px(11, 2 + b, "T")                          // glowing eye
  c.rect(0, 6 + b, 2, 5, "s"); c.rect(11, 6 + b, 3, 5, "s")           // fists
  c.hline(0, 6 + b, 2, "S"); c.hline(11, 6 + b, 3, "S")
  c.grid(2, 1 + b, "t.\ntT\nBt")                                      // shoulder crystal
  c.grid(5, 6 + b, ".T\ntT\nB.")                                      // chest crystal
  c.px(12, 9 + b, "T")
  c.px(4, 8 + b, "p"); c.px(5, 9 + b, "p"); c.px(8, 7 + b, "p")       // cracks
}, glow("T", { r: 3, strength: 0.45, bands: 2 }))

// Wraith: the ghost of a hamster, pale and see-through, hollow glowing eyes, wisp for a tail.
const WRAITH = chk("wraith", `
  ..............
  ....00...00...
  ...0II000II0..
  ..0IIIIIIIII0.
  .0IIII%TII%T0.
  .0III0%TI0%T0.
  .0IIIIIIIIIn0.
  .00IIIIIIII0..
  ..00IIIIII0...
  ...00IIII0....
  ....00II0.....
  ...0..0I0.....
  ..0....00.....
  ...00.........`, 14)
anim("wraith", { ...R14, outline: "%" }, frame(WRAITH), frame(sink(WRAITH, 9), grid(0, 10, `
    .....0II0.....
    ......0I0.....
    .......00.0...
    ........00....`)),
  glow("T", { r: 3, strength: 0.6, bands: 2 }))

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

anim("boss_weasel", B22, (c) => {
  const b = c.frame
  c.line(2, 20, 1, 13, "f", 2); c.px(1, 12, "F")                      // tail
  c.ellipse(9, 14 + b, 5, 7, "F")                                    // upright body
  c.ellipse(11, 15 + b, 2, 5, "c")                                   // belly
  c.ellipse(12, 6 + b, 4, 3, "F")                                    // head
  c.poly([14, 5 + b, 20, 7 + b, 14, 9 + b], "F"); c.px(20, 7 + b, "k")  // snout
  c.px(15, 6 + b, "k")
  c.ellipse(11, 4 + b, 5, 2, "A"); c.hline(7, 5 + b, 10, "o")        // leather helmet + rim
  c.px(11, 1 + b, "S"); c.px(11, 2 + b, "S")                          // spike
  c.rect(6, 19, 3, 3, "f"); c.rect(11, 19, 3, 3, "f")                // legs
  c.circ(15, 14 + b, 5, "S"); c.circ(15, 14 + b, 4, "R"); c.circ(15, 14 + b, 2, "r")   // bottle-cap shield
  for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2; c.px(15 + Math.round(5 * Math.cos(t)), 14 + b + Math.round(5 * Math.sin(t)), "w") }
})

anim("boss_owl", B22, (c) => {
  const b = c.frame
  c.poly([2, 8 + b, 8, 7 + b, 8, 17, 0, 15 - b], "D"); c.poly([20, 8 + b, 14, 7 + b, 14, 17, 22, 15 - b], "D")   // half-spread wings
  c.ellipse(11, 12, 6, 8, "f")
  c.ellipse(11, 14, 4, 5, "F")
  c.poly([5, 4, 7, 0, 9, 4], "D"); c.poly([13, 4, 15, 0, 17, 4], "D")    // ear tufts
  c.ellipse(11, 6, 5, 3, "A")
  c.circ(9, 6, 2, "y"); c.circ(13, 6, 2, "y"); c.px(9, 6, "k"); c.px(13, 6, "k")
  c.poly([10, 8, 12, 8, 11, 10], "S")
  c.hline(8, 20, 2, "y"); c.hline(13, 20, 2, "y")
})

anim("boss_serpent", B22, (c) => {
  const b = c.frame
  c.ellipse(10, 18, 9, 3, "$"); c.ellipse(10, 15, 7, 3, "G"); c.ellipse(10, 12, 5, 2, "$")
  tube(c, [[10, 12], [12, 8], [14, 5 + b], [17, 5 + b]], () => 1.8, ["g", "$", "v"], 2.5)
  c.grid(14, 2 + b, "y.y.y\nyyyyy")                                   // crown
  c.px(17, 5 + b, "k"); c.grid(18, 7 + b, "w.w")
})

anim("boss_fox", B22, (c) => {
  const b = c.frame
  c.ellipse(4, 16, 4, 3, "X"); c.ellipse(1, 18, 2, 2, "8")           // tail + white tip
  c.ellipse(10, 14 + b, 5, 6, "X"); c.ellipse(12, 14 + b, 2, 4, "8")
  c.ellipse(13, 7 + b, 4, 3, "X")
  c.poly([15, 7 + b, 21, 9 + b, 15, 10 + b], "X"); c.px(21, 9 + b, "k")
  c.ellipse(12, 5 + b, 5, 3, "l"); c.hline(7, 7 + b, 11, "F")        // walnut kabuto
  c.line(9, 2 + b, 7, 0 + b, "y"); c.line(15, 2 + b, 17, 0 + b, "y") // crest horns
  c.px(15, 8 + b, "k")
  c.rect(7, 19, 3, 3, "M"); c.rect(12, 19, 3, 3, "M")
  c.line(16, 15 + b, 21, 4 + b, "L")                                 // twig katana
  c.ellipse(16, 15 + b, 1, 1, "M")
})

anim("boss_emperor", B22, (c) => {
  const b = c.frame
  c.poly([3, 8, 18, 8, 22, 21, 0, 21], "&"); c.poly([5, 9, 16, 9, 19, 21, 3, 21], "C")   // cape
  c.ellipse(11, 15 + b, 5, 6, "M")
  c.circ(11, 8 + b, 5, "M")
  c.poly([6, 6 + b, 7, 1 + b, 10, 4 + b], "M"); c.poly([12, 4 + b, 15, 1 + b, 16, 6 + b], "M")
  c.grid(6, 0 + b, `
    y..y..y..y
    yyyyyyyyyy
    oRoCoRoCoo`)
  c.grid(8, 8 + b, "NwM.NwM")
  c.rect(8, 19, 3, 3, "m"); c.rect(13, 19, 3, 3, "m")
}, glow("Nw", { r: 3, strength: 0.6, bands: 2 }))

sheet("monsters", [
  "spider", "bat", "fireant", "worm", "scorpion", "toad", "ferret", "slime", "owl", "badger", "wasp", "golem", "wraith",
  "boss_tabby", "boss_weasel", "boss_owl", "boss_serpent", "boss_fox", "boss_emperor",
], { pad: 1 })
