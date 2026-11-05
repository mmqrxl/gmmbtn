# Squeek of the Hill 🌰

**A holder-only king-of-the-hill game for Squeek NFT holders, settled entirely onchain on Sepolia.**

There is one Golden Seed. Any Squeek holder can seize it. While your Squeek holds the Seed, every
unit of real wheel work Squeektoshi the hamster logs becomes a point for that Squeek. The points are
read straight from SqueekCore's certified round ledger, with no oracle, server or admin key.

The skill is timing: watch the live wheel, guess when the hamster is about to run, and take the
hill right before he does.

## Rules

1. **Holders only.** `seize` checks `SqueekNFT.ownerOf` live. Squeeks deposited in SqueekStaking
   count too (via `SqueekStaking.depositor`).
2. **No claiming the past.** A reign seized in round *R* earns from round *R+1* on, so work that has
   already happened can never be claimed.
3. **Real work = points.** 1 work unit in a reign's rounds = 1 point, computed as
   `roundPage(b,b,0).end.cumulativeWork − roundPage(a,a,0).end.cumulativeWork`, only for rounds up
   to `SqueekCore.state().settledThroughRound`.
4. **Level is armor.** A level-*L* Squeek is shielded for *L* rounds after its reign starts
   (Squeek levels go 1–10, from merges).
5. **Fall and rest.** A dethroned Squeek rests for 6 rounds (1 hour). You can't take the Seed from
   yourself, even with another of your Squeeks.
6. **Permissionless crediting.** Anyone can call `credit(reignId)` / `creditMany` as rounds get
   certified, including on the current reign. Points always go to the reigning Squeek.
7. **Reputation lives on the Squeek.** Points, reigns, rounds held, best reign and the top-10
   Hall of the Hill are keyed by tokenId, so they move with the NFT.
8. **Onchain badge.** `badgeURI(tokenId)` returns a JSON + SVG data URI: the hill grows with
   points, and the Golden Seed glows on the current king's badge.

## Layout

```
src/SqueekOfTheHill.sol          game contract
src/HillBadge.sol                onchain SVG badge
src/interfaces/ISqueekchain.sol  views of SqueekCore / SqueekNFT / SqueekStaking (published ABIs)
test/                            unit tests (mocks) + fork tests against live Sepolia
script/Deploy.s.sol              Sepolia deployment
web/                             static dApp (no build step; viem from CDN)
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

Deployment needs about 33M gas on Sepolia (measured with `eth_estimateGas`), so have some Sepolia ETH.

```sh
cast wallet import deployer --interactive               # once; keeps the key in an encrypted keystore
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --account deployer --broadcast
```

Put the printed address in `web/config.js` (`GAME_ADDRESS`), then host `web/` on any static host
(GitHub Pages, Vercel, Netlify, IPFS). You can also open the page with `?game=0x…`.
After a contract change, regenerate the ABI:

```sh
forge build && (echo "// Generated from out/SqueekOfTheHill.sol/SqueekOfTheHill.json (forge build). Do not edit."; \
  echo -n "export const GAME_ABI = "; jq -c .abi out/SqueekOfTheHill.sol/SqueekOfTheHill.json; echo ";") > web/abi.js
```

Testnet only: Squeeks on Sepolia have no monetary value, and the game has no money in it, only points.
