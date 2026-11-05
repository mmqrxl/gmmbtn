# Squeek Delve 🐹⛏️

**A holder-only pixel roguelike for Squeek NFT holders, verified entirely onchain on Sepolia.**

Your Squeek is your delver. Dig through five floors of a hamster burrow, grab sunflower seeds,
eat cheese, fight beetles, snakes and the tabby boss, and reach the golden wheel. When you're done,
submit your run: the contract rebuilds the burrow and **replays every single move** to compute your
score. No server, no oracle, no trusted client.

The real hamster matters too: every expedition's burrow is seeded from SqueekCore's certified ledger,
and the work Squeektoshi did in the 6 certified rounds before it opened sets its mood.

| Mood | Hamster work | Burrow |
|---|---|---|
| 💤 Snooze | 0 | Dark (small torch radius); enemies are drowsy and act every other turn |
| 🐾 Potter | 1–99 | Normal |
| 🏃 Jog | 100–299 | Seeds worth +2 |
| ⚡ Zoomies | 300+ | One extra enemy per floor, seeds worth double |

## How it plays

- Turn-based on a 15×11 grid. Move/attack with WASD or arrows (or the on-screen pad), wait with Space,
  **flee with Q** to climb out keeping every seed. Die and you lose half your seeds. Reach the golden
  wheel on floor 5 for +100 and +5 per remaining HP.
- Score = seeds (halved if you died) + enemy bounties (beetle 3, snake 5, cat 12) + 20 per floor descended + victory bonus.
- Your Squeek's **level** (from merges) sets HP (6 + 2·level) and attack (1 + level/3). Its **onchain
  art** sets your hero's fur colors, and its portrait shows in the delver panel.
- Each expedition lasts 2 hours and every holder gets the **same burrow**, so it's a shared puzzle:
  practice as much as you like, then submit. Each Squeek can submit 3 runs per expedition; the best
  counts. Ties go to whoever got there first, so copying a public tape never overtakes the original.
- The top 10 of every expedition are listed with a **▶ replay** button that rebuilds the run from its
  onchain transaction data. Anyone can open the next expedition, which also crowns the last champion.

## Onchain design

- `src/DelveEngine.sol` is a pure, integer-only twin of `web/engine.js`: xorshift32 PRNG, drunkard-walk
  cave carving into a 165-bit bitmap, deterministic enemy AI, combat and scoring. A 600-turn replay
  costs about 2.5M gas.
- `src/SqueekDelve.sol` handles expeditions (seed = keccak of the certified ledger position, expedition id and
  `prevrandao`; mood = work over `roundPage` in the last 6 certified rounds), holder checks
  (`SqueekNFT.ownerOf`, or `SqueekStaking.depositor` for staked Squeeks), replay-verified
  submissions, per-expedition leaderboards, crowns and lifetime records per tokenId. It also exposes
  `simulate(...)`, which the UI calls to show the contract's verdict before you submit.
- **Parity.** `tools/parity.mjs` plays 160 runs (bot and random tapes across all moods and levels,
  including victories, deaths and 600-turn runs) plus 40 floor layouts with the JS engine.
  `test/DelveParity.t.sol` replays them in Solidity and requires identical results.

## Layout

```
src/DelveEngine.sol        deterministic game rules (onchain twin of web/engine.js)
src/SqueekDelve.sol        expeditions, holder gating, verified submissions, boards
test/                      unit tests, JS↔Solidity parity tests, fork test against live Sepolia
tools/parity.mjs           regenerates test/fixtures/parity.json from the JS engine
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

Deployment takes about 24.4M gas on Sepolia (measured with `eth_estimateGas`).

```sh
cast wallet import deployer --interactive        # once; keeps the key in an encrypted keystore
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --account deployer --broadcast
```

Put the printed address in `web/config.js` (`GAME_ADDRESS`, and `DEPLOY_BLOCK`), open the first
expedition from the site (or `cast send <game> "openExpedition()"`), and host `web/` on any static
host (GitHub Pages, Vercel, Netlify, IPFS). After changing the contract, regenerate the ABI:

```sh
forge build && (echo "// Generated from out/SqueekDelve.sol/SqueekDelve.json (forge build). Do not edit."; \
  echo -n "export const GAME_ABI = "; jq -c .abi out/SqueekDelve.sol/SqueekDelve.json; echo ";") > web/abi.js
```

Testnet only: Squeeks on Sepolia have no monetary value, and the game has no money in it.
