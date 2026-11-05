# Squeek Seers 🐹◎

**A holder-only, fully onchain prediction league for Squeek NFT holders on Sepolia.**

Every Squeek you hold is a *seer*. Call Squeektoshi's mood for an upcoming 10-minute round.
When SqueekCore certifies that round, the game contract reads the real wheel work straight from
`SqueekCore.roundPage` and pays points to the Squeeks that called it. No oracle, no server, no admin key.

| Mood | Work in the round |
|---|---|
| 💤 Snooze | 0 |
| 🐾 Potter | 1–99 |
| 🏃 Jog | 100–299 |
| ⚡ Zoomies | 300+ |

## Rules

- **Holders only.** `predict` checks `SqueekNFT.ownerOf` live; Squeeks deposited in SqueekStaking play
  too (via `SqueekStaking.depositor`), so staking doesn't cost you your seat.
- **No peeking.** A round can be called from the next round up to 144 rounds (24 h) ahead, and calls
  lock when the round starts, before any of its work exists. You can change a call until then.
- **Settled by the chain.** `resolve(round)` is permissionless and only works once
  `round <= SqueekCore.state().settledThroughRound`. Work = `roundPage(r,r,0).end.cumulativeWork − roundPage(r−1,r−1,0).end.cumulativeWork`.
- **Contrarians win big.** Points = `100 × (total calls ÷ correct calls) × level`. The hamster sleeps
  most rounds, so calling the zoomies right is worth far more than calling another nap.
- **Level matters.** A Squeek's level is locked in when it makes the call, so merged Squeeks score more.
- **Reputation lives on the Squeek.** Points, wins, streaks and the top-10 leaderboard are keyed by
  tokenId. Sell the Squeek and its record goes with it. Anyone can `score` anyone; points always go to
  the Squeek.
- **Onchain badge.** `badgeURI(tokenId)` returns a JSON + SVG data URI: a wheel that spins faster the
  more accurate the seer is, with its title (Wheel Watcher → Hamster Prophet), points and rank.

## Layout

```
src/SqueekSeers.sol            game contract
src/SeerBadge.sol              onchain SVG badge
src/interfaces/ISqueekchain.sol  views of SqueekCore / SqueekNFT / SqueekStaking (published ABIs)
test/                          unit tests (mocks) + fork tests against live Sepolia
script/Deploy.s.sol            Sepolia deployment
web/                           static dApp (no build step; viem from CDN)
```

Squeekchain addresses come from the published deployment record
(https://docs.squeekchain.com/assets/deployments/sepolia.json):
SqueekCore `0xfd6c…e0c4`, SqueekNFT `0xc4c7…856b`, SqueekStaking `0x50fd…11ca`.

## Develop

```sh
forge test                                              # unit tests
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com forge test --match-contract Fork
```

## Deploy

```sh
cast wallet import deployer --interactive               # once; keeps the key in an encrypted keystore
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --account deployer --broadcast
```

Put the printed address in `web/config.js` (`GAME_ADDRESS`), then host `web/` on any static host
(GitHub Pages, Vercel, Netlify). You can also open the page with `?game=0x…`.
After a contract change, regenerate the ABI:

```sh
forge build && (echo "// Generated from out/SqueekSeers.sol/SqueekSeers.json (forge build). Do not edit."; \
  echo -n "export const GAME_ABI = "; jq -c .abi out/SqueekSeers.sol/SqueekSeers.json; echo ";") > web/abi.js
```

Testnet only: Squeeks and $SQK on Sepolia have no monetary value, and the game has no money in it,
only points.
