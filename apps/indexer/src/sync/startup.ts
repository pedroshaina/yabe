import type { PrismaClient } from "@yabe/db";
import { nodeChainName, type Network } from "../chain/network.ts";
import type { BitcoinNode } from "../rpc/node.ts";

/** Indexing would mix chains or networks. Fatal. */
export class StartupCheckError extends Error {
  override name = "StartupCheckError";
}

export async function checkNode(
  node: BitcoinNode,
  prisma: PrismaClient,
  network: Network,
): Promise<void> {
  const { chain } = await node.getBlockchainInfo();
  const expected = nodeChainName(network);
  if (chain !== expected) {
    throw new StartupCheckError(
      `the node is on "${chain}" but BITCOIN_NETWORK=${network} expects "${expected}"`,
    );
  }

  const storedGenesis = await prisma.block.findUnique({
    where: { height: 0 },
    select: { hash: true },
  });
  if (storedGenesis) {
    const nodeGenesis = await node.getBlockHash(0);
    if (storedGenesis.hash !== nodeGenesis) {
      throw new StartupCheckError(
        `the database holds a different chain (genesis ${storedGenesis.hash}) than the node (genesis ${nodeGenesis})`,
      );
    }
  }
}
