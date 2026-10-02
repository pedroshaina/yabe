import { setTimeout as sleep } from 'node:timers/promises'
import type { BitcoinRpcClient } from '@yabe/bitcoin-rpc'
import type { Logger, Network } from '@yabe/shared'
import type { StoredTip, SyncStore } from '../store/block-store.js'
import { transformBlock } from '../transform/block.js'
import { Backoff } from './backoff.js'

export type ChainSource = Pick<BitcoinRpcClient, 'getBlockCount' | 'getBlockHash' | 'getBlock'>

export class ReorgTooDeepError extends Error {
  override name = 'ReorgTooDeepError'
}

export interface SyncerOptions {
  chain: ChainSource
  store: SyncStore
  network: Network
  logger: Logger
  reorgMaxDepth: number
  prefetchBlocks: number
  pollIntervalMs: number
  backoff?: { initialMs: number; maxMs: number }
}

export class Syncer {
  constructor(private readonly opts: SyncerOptions) {}

  // One pass: reconcile reorgs, then index up to the node's tip. Returns the number of blocks indexed.
  async syncOnce(signal?: AbortSignal): Promise<number> {
    const { chain, store, logger } = this.opts
    const nodeTip = await chain.getBlockCount()

    let tip = await store.getTip()
    if (tip) {
      const forkHeight = await this.findForkHeight(tip, nodeTip)
      if (forkHeight !== null) {
        logger.warn({ forkHeight, indexedTip: tip.height, nodeTip }, 'reorg detected, rolling back')
        await store.rollbackFrom(forkHeight)
        tip = await store.getTip()
      }
    }

    let indexed = 0
    let next = tip ? tip.height + 1 : 0
    let prevHash = tip?.hash ?? null

    while (next <= nodeTip && !signal?.aborted) {
      const last = Math.min(nodeTip, next + this.opts.prefetchBlocks - 1)
      const heights = Array.from({ length: last - next + 1 }, (_, i) => next + i)
      // Fetch concurrently, write strictly in order.
      const blocks = await Promise.all(heights.map(async (h) => chain.getBlock(await chain.getBlockHash(h))))

      for (const block of blocks) {
        if (block.height !== next || (block.previousblockhash ?? null) !== prevHash) {
          logger.warn({ height: next }, 'chain changed while syncing; restarting pass')
          return indexed
        }
        const started = performance.now()
        await store.writeBlock(transformBlock(block, this.opts.network), nodeTip)
        logger.info(
          {
            height: block.height,
            hash: block.hash,
            txCount: block.nTx,
            ms: Math.round(performance.now() - started),
          },
          'indexed block',
        )
        prevHash = block.hash
        next++
        indexed++
        if (signal?.aborted) return indexed
      }
    }

    if (indexed === 0) await store.recordNodeTip(nodeTip)
    return indexed
  }

  // Loops until aborted: indexes, idles at the tip, and backs off on errors. Only ReorgTooDeepError is fatal.
  async run(signal: AbortSignal): Promise<void> {
    const backoff = new Backoff(this.opts.backoff ?? { initialMs: 1_000, maxMs: 60_000 })
    while (!signal.aborted) {
      try {
        const indexed = await this.syncOnce(signal)
        backoff.reset()
        if (indexed === 0) await sleep(this.opts.pollIntervalMs, undefined, { signal })
      } catch (err) {
        if (err instanceof ReorgTooDeepError) throw err
        if (signal.aborted) break
        const retryInMs = backoff.next()
        this.opts.logger.error({ err, retryInMs }, 'sync pass failed')
        await sleep(retryInMs, undefined, { signal }).catch(() => undefined)
      }
    }
  }

  // Returns the lowest height to delete, or null when our tip is still on the node's chain.
  private async findForkHeight(tip: StoredTip, nodeTip: number): Promise<number | null> {
    for (let height = tip.height; height >= 0; height--) {
      const ours = height === tip.height ? tip.hash : await this.opts.store.getHashAt(height)
      const theirs = height <= nodeTip ? await this.opts.chain.getBlockHash(height) : null
      if (ours !== null && ours === theirs) return height === tip.height ? null : height + 1
      if (tip.height - height + 1 > this.opts.reorgMaxDepth) {
        throw new ReorgTooDeepError(
          `Reorg below height ${tip.height} is deeper than REORG_MAX_DEPTH=${this.opts.reorgMaxDepth}; operator action needed`,
        )
      }
    }
    return 0
  }
}
