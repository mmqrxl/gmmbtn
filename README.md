# Squeek Delve 🐹⛏️

**A holder-only pixel roguelike for Squeek NFT holders, verified entirely onchain on Sepolia.**

Your Squeek is your delver. Dig through six floors of a hamster burrow across three biomes, open
chests for random gear, fight with your weapon or your sling, and beat the Tabby guarding the golden
wheel. Every run is a brand-new burrow. Ranked runs draw their burrow seed **onchain**, and when you
submit, the contract rebuilds the burrow and **replays every single move** (loot rolls and crits
included) to compute your score. No server, no oracle, no trusted client.

The real hamster matters too: the work Squeektoshi did in the 6 certified SqueekCore rounds before an
expedition opened sets its mood.

| Mood | Hamster work | Burrow |
|---|---|---|
| 💤 Snooze | 0 | Dark (small torch radius); enemies are drowsy and act every other turn |
| 🐾 Potter | 1–99 | Normal |
| 🏃 Jog | 100–299 | Seeds +2 and one extra chest per floor |
| ⚡ Zoomies | 300+ | One extra enemy per floor, seeds worth double |

## How it plays

- **Random every run.** Three map generators (caverns, dug-out rooms, warrens), three biomes
  (Topsoil, Rootclay, Crystal Deep), a random start, random enemies and random loot on a 17×13 grid.
- **Two ways to fight.** Bump to melee (WASD/arrows). Sling pebbles at range with Shift+direction,
  IJKL, or the 🎯 button. Crits deal double. Space waits, Q flees with every seed you carry.
- **Loot.** Chests (and some enemy drops) roll from:
  - Weapons: Twig (start), Thorn Dagger, Pencil Spear (pierces 2 foes), Acorn Hammer, Golden Fork (pierces)
  - Armor: Walnut Helm, Thimble Mail, Chestnut Plate (each point blocks 1 damage per hit, minimum 1)
  - Slings: Pebble Toss (start), Rubber Sling, Pea Shooter (more damage and range)
  - Pebble Pouch, Vitamin (+3 max HP), Four-leaf Clover (+10% crit), Lucky Whisker (+1 per seed), Big Cheese (full heal)
  - Better gear auto-equips; worse gear is salvaged for seeds. Deeper floors roll higher tiers.
- **Enemies.** Beetles, snakes, fast rats (two steps a turn), tanky slow moles, and the Tabby boss on
  floor 6. They get tougher with depth. Each stairway down lets you rest for 25% HP.
- **Your Squeek.** Its level sets HP (10 + 2·level) and attack (1 + level/3). Its onchain art sets
  your hero's fur colors.
- **Score** = seeds (halved if you die) + enemy bounties + 25 per floor descended + 150 and 5/HP for a win.
- **Expeditions** last 2 hours. Each Squeek gets 3 ranked runs per expedition (a started run counts);
  the best submitted run counts. You have 30 minutes after an expedition closes to submit. The top 10
  get a **▶ replay** rebuilt from the onchain tape. Practice runs are free and unlimited.

Balance was tuned with a simple greedy bot (`tools/bot.mjs`): a level-1 Squeek in a Potter burrow
wins about 28% of runs and usually falls on floors 4–6; a thoughtful human does better.

## Onchain design

- `src/DelveRules.sol` is a pure, integer-only twin of `web/engine.js`: xorshift32 PRNG, three
  generators carving into a 221-bit map bitmap, enemy AI, combat, crits, loot tables and scoring.
  A worst-case 1000-turn replay costs about 6.5M gas.
- `src/SqueekDelve.sol` handles expeditions (mood = work over `roundPage` in the last 6 certified
  rounds), holder checks (`SqueekNFT.ownerOf`, or `SqueekStaking.depositor` for staked Squeeks),
  `startRun` (draws a per-run seed from `prevrandao`, the previous blockhash, the expedition salt and
  the run id), `submitRun` (replays the tape through DelveRules), per-expedition leaderboards, crowns
  and lifetime records per tokenId. The seed is testnet-grade randomness: it can't be chosen, but a
  determined bot could predict the next block's value.
- **Parity.** `tools/parity.mjs` plays 200 runs (bot runs with and without the sling, noisy and
  fleeing bots, and random junk tapes across all moods and levels) plus 48 floor layouts with the JS
  engine. `test/DelveParity.t.sol` replays them in Solidity and requires identical results.

## Layout

```
src/DelveRules.sol         deterministic game rules (onchain twin of web/engine.js)
src/SqueekDelve.sol        expeditions, holder gating, verified submissions, boards
test/                      unit tests, JS↔Solidity parity tests, fork test against live Sepolia
tools/parity.mjs           regenerates test/fixtures/parity.json from the JS engine
tools/bot.mjs              greedy test bot used for balance checks and fixtures
script/Deploy.s.sol        Sepolia deployment
web/                       the game (static; no build step; viem from esm.sh)
art/delve.px.js            all pixel art as code (pxl DSL); see art/README.md
```

Squeekchain addresses come from the published deployment record
(https://docs.squeekchain.com/assets/deployments/sepolia.json):
SqueekCore `0xfd6c…e0c4`, SqueekNFT `0xc4c7…856b`, SqueekStaking `0x50fd…11ca`.

## Develop

```sh
forge test                                                   # unit + parity tests
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com forge test   # + fork test
node tools/parity.mjs                                        # after changing game rules
cd web && python3 -m http.server 8080                        # play locally
```

## Deploy

The deploy script creates two contracts, DelveRules (~15.7M gas) and SqueekDelve (~14.9M gas),
measured with `eth_estimateGas` on Sepolia.

```sh
cast wallet import deployer --interactive        # once; keeps the key in an encrypted keystore
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --account deployer --broadcast
```

Put the printed SqueekDelve address in `web/config.js` (`GAME_ADDRESS`, and `DEPLOY_BLOCK`), open the first
expedition from the site (or `cast send <game> "openExpedition()"`), and host `web/` on any static
host (GitHub Pages, Vercel, Netlify, IPFS). After changing the contract, regenerate the ABI:

```sh
forge build && (echo "// Generated from forge build output (out/SqueekDelve.sol, out/DelveRules.sol). Do not edit."; \
  echo -n "export const GAME_ABI = "; jq -c .abi out/SqueekDelve.sol/SqueekDelve.json; echo ";"; \
  echo -n "export const RULES_ABI = "; jq -c .abi out/DelveRules.sol/DelveRules.json; echo ";") > web/abi.js
```

Testnet only: Squeeks on Sepolia have no monetary value, and the game has no money in it.
