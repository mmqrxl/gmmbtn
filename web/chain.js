// Chain access: Sepolia reads, simulated writes, and replay logs.
import {
  createPublicClient, createWalletClient, custom, http, getAddress, isAddress, parseAbiItem,
} from "https://esm.sh/viem@2.21.0";
import { sepolia } from "https://esm.sh/viem@2.21.0/chains";
import { GAME_ABI } from "./abi.js";
import { GAME_ADDRESS, DEPLOY_BLOCK, RPC_URL, API_BASE } from "./config.js";

const params = new URLSearchParams(location.search);
const qsGame = params.get("game");
export const gameAddress = isAddress(qsGame ?? "") ? getAddress(qsGame)
  : (isAddress(GAME_ADDRESS) ? getAddress(GAME_ADDRESS) : null);
// ?rpc= is for local testing against an anvil fork.
export const pub = createPublicClient({ chain: sepolia, transport: http(params.get("rpc") || RPC_URL), batch: { multicall: true } });

const NFT_ABI = [
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "string" }] },
];
const RUN_EVENT = parseAbiItem(
  "event RunSubmitted(uint256 indexed expeditionId, uint256 indexed tokenId, address indexed player, uint8 attempt, uint8 level, uint32 score, uint8 floor, uint16 kills, bool won, bool dead, bytes tape)",
);

export const read = (functionName, args = []) =>
  pub.readContract({ address: gameAddress, abi: GAME_ABI, functionName, args });

let wallet = null;
export let account = null;

export async function connectWallet() {
  if (!window.ethereum) throw new Error("No injected wallet found. Install MetaMask or Rabby.");
  wallet = createWalletClient({ chain: sepolia, transport: custom(window.ethereum) });
  const [addr] = await wallet.requestAddresses();
  try { await wallet.switchChain({ id: sepolia.id }); } catch {
    try { await wallet.addChain({ chain: sepolia }); } catch { /* declined */ }
  }
  account = getAddress(addr);
  window.ethereum.on?.("accountsChanged", () => location.reload());
  window.ethereum.on?.("chainChanged", () => location.reload());
  return account;
}

/** Simulate from the signer first, then ask the wallet to sign. */
export async function write(functionName, args, onStatus) {
  onStatus?.("Simulating…");
  const { request, result } = await pub.simulateContract({ address: gameAddress, abi: GAME_ABI, functionName, args, account });
  onStatus?.("Confirm in your wallet…");
  const hash = await wallet.writeContract(request);
  onStatus?.("Waiting for confirmation…", hash);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Transaction reverted (${hash})`);
  return { hash, result };
}

/** Squeek IDs the API suggests for an address; eligibility is always re-checked onchain. */
export async function suggestedSqueeks(addr) {
  const ids = [];
  try {
    let cursor = null;
    do {
      const q = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : {}) });
      const page = await (await fetch(`${API_BASE}/v1/accounts/${addr}?${q}`)).json();
      if (page.status !== "available") break;
      page.tokens.forEach((t) => ids.push(BigInt(t.tokenId)));
      cursor = page.nextCursor;
    } while (cursor);
  } catch { /* the player can still add IDs by hand */ }
  return ids;
}

/** The Squeek's onchain metadata: name and SVG image (as text, treated strictly as data). */
export async function squeekArt(nftAddress, tokenId) {
  try {
    const uri = await pub.readContract({ address: nftAddress, abi: NFT_ABI, functionName: "tokenURI", args: [tokenId] });
    if (!uri.startsWith("data:application/json;base64,")) return null;
    const json = JSON.parse(atob(uri.split(",")[1]));
    if (typeof json.image !== "string" || !json.image.startsWith("data:image/svg+xml;base64,")) return null;
    return { image: json.image, svg: atob(json.image.split(",")[1]) };
  } catch { return null; }
}

/** The best submitted tape for a Squeek in an expedition, from RunSubmitted logs. */
export async function bestTape(expeditionId, tokenId) {
  const logs = await pub.getLogs({
    address: gameAddress, event: RUN_EVENT,
    args: { expeditionId, tokenId },
    fromBlock: BigInt(DEPLOY_BLOCK || 0), toBlock: "latest",
  });
  let best = null;
  for (const l of logs) {
    if (!best || l.args.score > best.score) best = { ...l.args, tx: l.transactionHash };
  }
  return best;
}

export async function liveWheel() {
  try {
    const s = await (await fetch(`${API_BASE}/v1/status`, { headers: { accept: "application/json" } })).json();
    const m = s.measurement ?? {};
    if (m.freshness !== "online") return { known: false };
    return { known: true, spinning: m.coreStatus && m.coreStatus !== "IDLE", rpm: (m.rpmMilli ?? 0) / 1000 };
  } catch { return { known: false }; }
}
