import { rmSync, writeFileSync } from "node:fs";
import { cli, waitFor } from "./compose.ts";
import { API_URL, SEED_FILE } from "./urls.ts";

// A stale file would point the specs at a chain that no longer matches: drop it first.
rmSync(SEED_FILE, { force: true });

const WALLET = "e2e";
const wallet = (...args: string[]) => cli(`-rpcwallet=${WALLET}`, ...args);
if (!(JSON.parse(cli("listwallets")) as string[]).includes(WALLET)) {
  try {
    cli("loadwallet", WALLET);
  } catch {
    cli("createwallet", WALLET);
  }
}
const address = wallet("getnewaddress");

// 130 blocks: pages of older blocks to load, and 30 matured coinbase outputs, so 30 sends
// each spend a confirmed coin (chained unconfirmed change stops at 25 ancestors).
cli("generatetoaddress", "130", address);
const spends = Array.from({ length: 30 }, () => wallet("sendtoaddress", address, "0.1"));
// The big block: more transactions than one 25-item page.
cli("generatetoaddress", "1", address);
const bigHash = cli("getbestblockhash");
const big = JSON.parse(cli("getblock", bigHash)) as { height: number; nTx: number };
// One more, so the big block has a Next link and isn't the tip.
cli("generatetoaddress", "1", address);
const tip = Number(cli("getblockcount"));

await waitFor(`the API to serve height ${tip}`, async () => {
  const res = await fetch(`${API_URL}/v1/status`);
  return res.ok && ((await res.json()) as { tip: { height: number } | null }).tip?.height === tip;
});

writeFileSync(
  SEED_FILE,
  JSON.stringify(
    {
      tip,
      bigBlock: { height: big.height, hash: bigHash, txCount: big.nTx },
      spendTxid: spends[0],
    },
    null,
    2,
  ),
);
console.log(`seeded: tip ${tip}, big block ${big.height} (${big.nTx} transactions)`);
