// Reads every Squeek's traitWord (token 1..9999) from SqueekNFT's DotGrid renderer into
// tools/traitwords.json. Each call costs ~1.9M gas, so point RPC at a local fork:
//   anvil --fork-url https://ethereum-sepolia-rpc.publicnode.com --chain-id 11155111
//   RPC=http://127.0.0.1:8545 node tools/traitwords.mjs
import { createPublicClient, http, keccak256, encodeAbiParameters, parseAbi } from "viem";
import { sepolia } from "viem/chains";
import { writeFileSync } from "node:fs";
const c = createPublicClient({ chain: sepolia, transport: http(process.env.RPC ?? "http://127.0.0.1:8545", { timeout: 600000 }) });
const NFT = "0xc4c7982657f00509548f3a3a41db7fa439a6856b";
const nabi = parseAbi(["function renderer() view returns (address)", "function art() view returns (address)", "function collectionSeed() view returns (bytes32)", "function revealState() view returns (bool,bytes32)"]);
const rabi = parseAbi(["function traitWord(address,bytes32,uint256) view returns (uint256)"]);
const [renderer, art, cs, [, artSeed]] = await Promise.all(["renderer", "art", "collectionSeed", "revealState"].map((f) => c.readContract({ address: NFT, abi: nabi, functionName: f })));
const seed = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [cs, artSeed]));
const words = new Array(10000).fill(null);
const ids = Array.from({ length: 9999 }, (_, i) => i + 1);
let next = 0;
const t0 = Date.now();
async function worker() {
  while (next < ids.length) {
    const id = ids[next++];
    const w = await c.readContract({ address: renderer, abi: rabi, functionName: "traitWord", args: [art, seed, BigInt(id)] });
    words[id] = "0x" + w.toString(16).padStart(64, "0");
  }
}
await Promise.all(Array.from({ length: 24 }, worker));
writeFileSync(new URL("./traitwords.json", import.meta.url), JSON.stringify({ source: "DotGridRenderer.traitWord(SqueekNFT.art(), keccak256(abi.encode(collectionSeed, artSeed)), tokenId) on Sepolia; index = tokenId", renderer, page: art, seed, words }));
console.log("got", words.filter(Boolean).length, "in", Date.now() - t0, "ms;", words[2], words[7]);
