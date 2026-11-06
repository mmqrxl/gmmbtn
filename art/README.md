# Squeek Delve art

All game pixel art is code (pxl DSL: shared palette, light from the top-left, characters face right). Rebuild with the [claude-pxl](https://gameskill.dev/skills/claude-pxl) skill (`curl -fsSL https://gameskill.dev/dl/skills/claude-pxl.zip -o pxl.zip && unzip pxl.zip`, Node ≥ 22.18), running `node <pxl>/bin/pxl.js build art/<file>.px.js` from the repo root, then copy the sheet PNG and JSON (TexturePacker hash format) into `web/assets/`. The game merges all four sheets into one frame lookup.

| Source | Sheet | Contents |
|---|---|---|
| `delve.px.js` | `sprites` | hero, beetle/rat/snake/mole/cat, biomes b0–b2 tiles, exit wheel, seeds, cheese, chests, wpn_0–4, arm_0–3, sl_0–2, first charms, hit/sparkle FX, 8x8 HUD icons; `title` scene |
| `monsters.px.js` | `monsters` | 13 new 16x16 monsters and six 24x24 bosses (`boss_tabby` … `boss_emperor`), 2 frames each |
| `items.px.js` | `items` | wpn_5–15, arm_4–11, sl_3–7, 7 new charms, silver/gold chests, boss seal, explosion/levelup/heal/poof FX, 8x8 projectiles and icons |
| `biomes.px.js` | `biomes` | tiles for b3 Fungal Grotto, b4 Frost Hollow, b5 Magma Vent, b6 Sunken Ruins, b7 Void Burrow, and 4 props for every biome |

Build `monsters.px.js` with `--out art/out_monsters` (the others use the default `art/out/`). Every biome has `floor_0..3`, `room_0..1`, `wall_top`, `wall_face_0..1`, `stairs` and `prop_0..3` (for example `b5_prop_0`). The hero fur uses exactly `#E8B07A` / `#C98A54` / `#8A5A34` so the game can recolor it from the player's Squeek at runtime; never reuse those hexes elsewhere. `preview_*.png` are upscaled previews of each sheet.
