import { setTimeout as sleep } from "node:timers/promises";
import { sql, type PrismaClient } from "@yabe/db";
import type { Logger } from "pino";
import type { Network } from "../chain/network.ts";
import { RpcError } from "../rpc/errors.ts";
import type { BitcoinNode } from "../rpc/node.ts";
import { DEFAULT_BACKOFF, withRetry, type BackoffOptions } from "../resilience/retry.ts";
import { isTransient } from "../resilience/transient.ts";
import { blockToRows } from "./transform.ts";
import { rollbackTo, writeBlock } from "./writer.ts";

/** The database and the node share no block: the database holds a different chain. Fatal. */
export class ChainMismatchError extends Error {
  override name = "ChainMismatchError";
}

/** The fork point is more than MAX_REORG_DEPTH blocks below our tip. Fatal; nothing was deleted. */
export class ReorgTooDeepError extends Error {
  override name = "ReorgTooDeepError";
}

export interface SyncDeps {
  node: BitcoinNode;
  prisma: PrismaClient;
  network: Network;
  logger: Logger;
  maxReorgDepth: number;
  /** Called after each block written or reorg rolled back; lets retries tell progress from a stuck loop. */
  onProgress?: () => void;
}

export interface SyncResult {
  /** Blocks written in this pass. */
  indexed: number;
  /** Blocks removed by a reorg at the start of this pass. */
  rolledBack: number;
  /** False when the pass ended early (abort or a chain change); run another pass right away. */
  caughtUp: boolean;
}

const PROGRESS_EVERY = 1_000;
/** bitcoind RPC_INVALID_PARAMETER, e.g. "Block height out of range" when its chain shrank. */
const RPC_INVALID_PARAMETER = -8;

/**
 * Walks back from min(our tip, node tip) to the highest block whose hash we
 * share with the node. Refuses before it would have to roll back more than
 * `maxReorgDepth` blocks.
 */
async function findCommonBlock(
  deps: SyncDeps,
  tipHeight: number,
  nodeHeight: number,
): Promise<{ height: number; hash: string }> {
  for (let height = Math.min(tipHeight, nodeHeight); height >= 0; height -= 1) {
    const [ours, theirs] = await Promise.all([
      deps.prisma.block.findUnique({ where: { height }, select: { hash: true } }),
      deps.node.getBlockHash(height),
    ]);
    if (ours?.hash === theirs) {
      return { height, hash: theirs };
    }
    if (tipHeight - (height - 1) > deps.maxReorgDepth) {
      throw new ReorgTooDeepError(
        `the node's chain diverges more than ${deps.maxReorgDepth} blocks below our tip ${tipHeight}; refusing to roll back (MAX_REORG_DEPTH)`,
      );
    }
  }
  throw new ChainMismatchError(
    "the database and the node share no block; it holds a different chain",
  );
}

/**
 * One pass: reconcile with the node's chain (rolling back a reorg if needed),
 * then index forward to the node's tip. Each block is atomic, so a pass can be
 * cut short at any point and the next pass resumes from what was committed.
 */
export async function syncOnce(deps: SyncDeps, signal?: AbortSignal): Promise<SyncResult> {
  const { node, prisma, network, logger } = deps;
  const [tip] = await prisma.$queryRawTyped(sql.selectTip());
  const nodeHeight = await node.getBlockCount();

  let height = 0;
  let tipHash: string | null = null;
  let rolledBack = 0;
  if (tip) {
    let common: { height: number; hash: string };
    try {
      common = await findCommonBlock(deps, tip.height, nodeHeight);
    } catch (error) {
      if (error instanceof RpcError && error.code === RPC_INVALID_PARAMETER) {
        logger.info(
          { tip: tip.height },
          "the node's chain changed during the fork check; re-checking",
        );
        return { indexed: 0, rolledBack: 0, caughtUp: false };
      }
      throw error;
    }
    if (common.height < tip.height && common.height === nodeHeight) {
      logger.warn({ tip: tip.height, nodeHeight }, "the node is behind our tip; waiting for it");
      return { indexed: 0, rolledBack: 0, caughtUp: true };
    }
    if (common.height < tip.height) {
      rolledBack = await rollbackTo(prisma, common.height);
      deps.onProgress?.();
      logger.warn(
        { from: tip.height, to: common.height, rolledBack },
        "chain reorganisation: rolled back",
      );
    }
    height = common.height + 1;
    tipHash = common.hash;
  }

  let indexed = 0;
  while (height <= nodeHeight) {
    if (signal?.aborted) {
      return { indexed, rolledBack, caughtUp: false };
    }
    let hash: string;
    try {
      hash = await node.getBlockHash(height);
    } catch (error) {
      if (error instanceof RpcError && error.code === RPC_INVALID_PARAMETER) {
        logger.info({ height }, "the node's chain changed during sync; re-checking");
        return { indexed, rolledBack, caughtUp: false };
      }
      throw error;
    }
    const block = await node.getBlock(hash);
    if ((block.previousblockhash ?? null) !== tipHash) {
      logger.info({ height, hash }, "the node's chain changed during sync; re-checking");
      return { indexed, rolledBack, caughtUp: false };
    }

    await writeBlock(prisma, blockToRows(block, network));
    deps.onProgress?.();
    tipHash = block.hash;
    height += 1;
    indexed += 1;
    if (indexed % PROGRESS_EVERY === 0) {
      logger.info({ height: block.height, nodeHeight }, "indexing");
    }
  }
  return { indexed, rolledBack, caughtUp: true };
}

/**
 * Keeps the database at the node's tip until `signal` aborts. Transient
 * failures are retried with backoff; anything else is rethrown. Stops between
 * blocks, and promptly while waiting to retry.
 */
export async function runSync(
  deps: SyncDeps & { pollIntervalMs: number; backoff?: BackoffOptions },
  signal: AbortSignal,
): Promise<void> {
  const { logger } = deps;
  let progressed = false;
  const tracked: SyncDeps = { ...deps, onProgress: () => (progressed = true) };
  while (!signal.aborted) {
    let outcome: { result: SyncResult; height: number | undefined };
    try {
      outcome = await withRetry(
        async () => {
          const result = await syncOnce(tracked, signal);
          // Inside the retry: a database blip right after a pass is just another transient error.
          const [tip] = await deps.prisma.$queryRawTyped(sql.selectTip());
          return { result, height: tip?.height };
        },
        {
          isTransient,
          signal,
          backoff: deps.backoff ?? DEFAULT_BACKOFF,
          madeProgress: () => {
            const made = progressed;
            progressed = false;
            return made;
          },
          onRetry: (error, attempt, delayMs) =>
            logger.warn({ err: error, attempt, delayMs }, "transient error, retrying"),
        },
      );
    } catch (error) {
      if (signal.aborted) return;
      throw error;
    }
    progressed = false;
    const { result, height } = outcome;
    if (result.indexed > 0 || result.rolledBack > 0) {
      logger.info({ ...result, height }, "synced with the node");
    }
    if (result.caughtUp) {
      await sleep(deps.pollIntervalMs, undefined, { signal }).catch(() => undefined);
    }
  }
}
