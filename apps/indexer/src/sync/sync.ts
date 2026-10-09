import { setTimeout as sleep } from "node:timers/promises";
import { sql, type PrismaClient } from "@yabe/db";
import type { Logger } from "pino";
import type { Network } from "../chain/network.ts";
import type { BitcoinNode } from "../rpc/node.ts";
import { blockToRows } from "./transform.ts";
import { writeBlock } from "./writer.ts";

/** The node's next block doesn't extend our tip. Reorg handling is not implemented yet, so this is fatal. */
export class ChainMismatchError extends Error {
  override name = "ChainMismatchError";
}

export interface SyncDeps {
  node: BitcoinNode;
  prisma: PrismaClient;
  network: Network;
  logger: Logger;
}

const PROGRESS_EVERY = 1_000;

/** Indexes every block from our tip + 1 to the node's current tip. Returns how many. */
export async function syncOnce(deps: SyncDeps, signal?: AbortSignal): Promise<number> {
  const { node, prisma, network, logger } = deps;
  const [tip] = await prisma.$queryRawTyped(sql.selectTip());
  let tipHash = tip?.hash ?? null;
  let height = tip ? tip.height + 1 : 0;
  const nodeHeight = await node.getBlockCount();
  let indexed = 0;

  while (height <= nodeHeight && !signal?.aborted) {
    const hash = await node.getBlockHash(height);
    const block = await node.getBlock(hash);
    if ((block.previousblockhash ?? null) !== tipHash) {
      throw new ChainMismatchError(
        `block ${height} (${hash}) does not build on our tip ${tipHash}; reorg handling is not implemented yet`,
      );
    }

    await writeBlock(prisma, blockToRows(block, network));
    tipHash = block.hash;
    height += 1;
    indexed += 1;
    if (indexed % PROGRESS_EVERY === 0) {
      logger.info({ height: block.height, nodeHeight }, "indexing");
    }
  }
  return indexed;
}

/** Keeps the database at the node's tip until `signal` aborts. Stops between blocks. */
export async function runSync(
  deps: SyncDeps & { pollIntervalMs: number },
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted) {
    const indexed = await syncOnce(deps, signal);
    if (indexed > 0) {
      const [tip] = await deps.prisma.$queryRawTyped(sql.selectTip());
      deps.logger.info({ indexed, height: tip?.height }, "caught up with the node");
    }
    await sleep(deps.pollIntervalMs, undefined, { signal }).catch(() => undefined);
  }
}
