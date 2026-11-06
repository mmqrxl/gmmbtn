# Squeek Delve 🐹⛏️

**A holder-only pixel roguelike for Squeek NFT holders: 200 floors, verified onchain on Sepolia.**

Your Squeek is your delver. Dig through 200 floors of a hamster burrow across 8 biomes. The maps get
bigger, the monsters deadlier and the loot better the deeper you go. Every 10th floor is sealed by a
boss, and floor 200 hides the Cat Emperor and the golden wheel.

Ranked runs draw their burrow seed **onchain**. Whenever you like, you checkpoint your progress: the
contract rebuilds those floors and **replays every single move** (monster AI, crits, loot rolls) to
record your depth and score. No server, no oracle, no trusted client.

The real hamster matters too: a run's mood comes from the work Squeektoshi did in SqueekCore's last
6 certified rounds when the run started.

| Mood | Hamster work | Burrow |
|---|---|---|
| 💤 Snooze | 0 | Dark (small torch radius); monsters are drowsy and act every other turn |
| 🐾 Potter | 1–99 | Normal |
| 🏃 Jog | 100–299 | Seeds +2 and one extra chest per floor |
| ⚡ Zoomies | 300+ | One extra monster per floor, seeds worth double |

## What's in the burrow

- **200 floors, 8 biomes** (Topsoil, Rootclay, Crystal Deep, Fungal Grotto, Frost Hollow, Magma Vent,
  Sunken Ruins, Void Burrow). Maps grow from 17×13 to 47×35. Three generators (caverns, dug-out rooms,
  warrens), random start, and more monsters and chests on bigger maps.
- **23 monsters with 6 behaviors:** chasers, fast movers (2 steps a turn), slow tanks, ranged
  spitters (web, spit, feathers), exploding fire ants, regenerators. Kinds unlock with depth (beetle
  and rat on B1 up to golem on B55 and wraith on B70), and every monster scales with depth.
- **6 bosses:** the Tabby, the Weasel Warlord, the Great Horned Owl, the Serpent Queen and the Fox
  Shogun take turns on boss floors; the Cat Emperor waits on floor 200. Bosses enrage (two actions a
  turn) below a third of their HP and always drop a boss chest with two boosted rolls.
- **40+ items.** 16 weapons (Twig → Wheel of Fate), some piercing, cleaving, leeching or with bonus
  crit; 12 armors (Walnut Helm → Starweave); 8 slings (Pebble Toss → Star Cannon); 12 charms (Pebble
  Pouch, Vitamin, Four-leaf Clover, Lucky Whisker, Big Cheese, Sunflower Heart, Iron Fur, Night Eyes,
  Wheel Spirit, Vampire Tooth, Seed Magnet, Swift Paws). Chest tiers climb with depth; worse gear is
  salvaged for seeds.
- **Growth.** Kills give XP and level you up (+HP, +ATK); stairways let you rest; your Squeek's NFT
  level sets your starting HP and attack, and its onchain art colors your hero.
- **Pressure.** Linger past 300 turns on one floor and the burrow caves in. This also bounds how much
  gas one floor's replay can cost.
- **Score** = seeds + monster bounties (scaled by depth) + 50 per floor descended, + 5000 for winning.

Balance was tuned with a greedy bot (`tools/bot.mjs`, 150 runs per setting). A level-1 Squeek in a
Potter burrow reaches B23 at the median, B74 at the 90th percentile and about B95 at best; a level-10
Squeek reaches B58 at the median. Floor 200 is for the very best.

## How it looks

Canvas renderer with a camera that follows you on big maps, a multiply light map (flickering torch,
glowing crystals, mushrooms, lava and void props, boss seals, chests, projectiles and explosions),
per-biome ambient particles (dust, spores, embers, snow, sparkles, void motes), wall ambient
occlusion, entity shadows, a fog-of-war minimap, a boss HP bar, loot toasts, floating damage
numbers, screen shake and chiptune SFX. The title screen pans through a living, lit burrow of a
random biome.

## Onchain design

- `src/DelveRules.sol` is a pure, integer-only twin of `web/engine.js`. `advance(seed, mood,
  checkpoint, tape)` rebuilds the current floor from the run seed (map bitmap + O(1) occupancy grids),
  replays the tape and returns the next checkpoint. A tape must end at a floor boundary (just
  descended) or at the end of the run. The worst-case single floor (B179, 40 monsters, every one
  acting until the cave-in) costs about 13M gas.
- `src/DelveTables.sol` (monster, weapon, armor and sling tables) is **generated** from `web/engine.js`
  by `tools/gen-tables.mjs`, so the onchain tables can't drift from the game's.
- `src/SqueekDelve.sol`: daily seasons; `startRun` (holder check via `SqueekNFT.ownerOf` or
  `SqueekStaking.depositor` for staked Squeeks, 3 runs per Squeek per season, seed from `prevrandao`,
  the previous blockhash and the run id, mood from `SqueekCore.roundPage`); `advance` (replays new
  floors through DelveRules and stores the checkpoint packed); season and all-time top-10 boards;
  `crown`; lifetime records per tokenId (runs, deepest floor, best score, bosses, victories, crowns).
  Runs stay open for 2 days. The seed is testnet-grade randomness: it can't be chosen, but a
  determined bot could predict it a block ahead. Floors are deterministic, so a player can practice
  the current floor locally before checkpointing; that's part of the puzzle.
- The client splits checkpoints by `eth_estimateGas` so each transaction stays under 25M gas.
- **Parity.** `tools/parity.mjs` records 59 runs with the JS engine: bot runs, noisy runs, junk
  tapes, strong delvers dropped onto deep floors (up to B200, including a Cat Emperor win), plus 60
  floor layouts across all depths. `test/DelveParity.t.sol` replays every checkpoint in Solidity and
  requires identical results. `test/SqueekDelve.t.sol` also checkpoints a real run through the game
  contract with a seed it derives in the test.

## Layout

```
src/DelveRules.sol          the game rules onchain (twin of web/engine.js)
src/DelveTables.sol         generated data tables
src/SqueekDelve.sol         seasons, runs, checkpoints, boards, records
test/                       parity, unit and integration tests, fork test against live Sepolia
tools/parity.mjs            regenerates test/fixtures/parity.json
tools/gen-tables.mjs        regenerates src/DelveTables.sol
tools/bot.mjs               greedy test bot (balance checks and fixtures)
script/Deploy.s.sol         Sepolia deployment
web/                        the game (static; no build step; viem from esm.sh)
art/                        all pixel art as code (pxl DSL); see art/README.md
```

Squeekchain addresses come from the published deployment record
(https://docs.squeekchain.com/assets/deployments/sepolia.json):
SqueekCore `0xfd6c…e0c4`, SqueekNFT `0xc4c7…856b`, SqueekStaking `0x50fd…11ca`.

## Develop

```sh
forge test                                                   # parity, unit and integration tests
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com forge test   # + fork test
node tools/gen-tables.mjs && forge fmt                       # after changing a data table
node tools/parity.mjs                                        # after changing any rule (needs `cast`)
cd web && python3 -m http.server 8080                        # play locally
```

Open `http://localhost:8080/?practiceFloor=75` to practice from a deeper floor (with matching gear)
and preview later biomes.

## Deploy

The deploy script creates DelveRules (~23.3M gas) and SqueekDelve (~19.9M gas), measured with
`eth_estimateGas` on Sepolia.

```sh
cast wallet import deployer --interactive        # once; keeps the key in an encrypted keystore
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --account deployer --broadcast
```

Put the printed SqueekDelve address in `web/config.js` (`GAME_ADDRESS`) and host `web/` on any static
host (GitHub Pages, Vercel, Netlify, IPFS). There's nothing to open or seed: seasons start on their
own. After changing the contract, regenerate the ABI:

```sh
forge build && (echo "// Generated from out/SqueekDelve.sol/SqueekDelve.json (forge build). Do not edit."; \
  echo -n "export const GAME_ABI = "; jq -c .abi out/SqueekDelve.sol/SqueekDelve.json; echo ";") > web/abi.js
```

Testnet only: Squeeks on Sepolia have no monetary value, and the game has no money in it.
