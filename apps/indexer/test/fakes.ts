import { RpcError, type RpcBlock } from '@yabe/bitcoin-rpc'
import { bytesToHex } from '@yabe/shared'
import type { StoredTip, SyncStore } from '../src/store/block-store.js'
import type { ChainSource } from '../src/sync/syncer.js'
import type { BlockData } from '../src/transform/types.js'

export class FakeChain implements ChainSource {
  getBlockCalls = 0
  failNextTipCalls = 0

  constructor(public blocks: RpcBlock[]) {}

  async getBlockCount(): Promise<number> {
    if (this.failNextTipCalls > 0) {
      this.failNextTipCalls--
      throw new RpcError('connection refused', 'getblockcount')
    }
    return this.blocks.length - 1
  }

  async getBlockHash(height: number): Promise<string> {
    const block = this.blocks[height]
    if (!block) throw new RpcError('Block height out of range', 'getblockhash', -8)
    return block.hash
  }

  async getBlock(hash: string): Promise<RpcBlock> {
    this.getBlockCalls++
    const block = this.blocks.find((b) => b.hash === hash)
    if (!block) throw new RpcError('Block not found', 'getblock', -5)
    return block
  }

  // Simulates a reorg: replaces the chain from `height` upwards with `blocks`.
  reorg(height: number, blocks: RpcBlock[]): void {
    this.blocks = [...this.blocks.slice(0, height), ...blocks]
  }
}

export class InMemoryStore implements SyncStore {
  hashes: string[] = []
  nodeTip = -1
  onWrite: (height: number) => void = () => {}

  async getTip(): Promise<StoredTip | null> {
    const height = this.hashes.length - 1
    return height >= 0 ? { height, hash: this.hashes[height]! } : null
  }

  async getHashAt(height: number): Promise<string | null> {
    return this.hashes[height] ?? null
  }

  async writeBlock(data: BlockData, nodeTipHeight: number): Promise<void> {
    if (data.block.height !== this.hashes.length) {
      throw new Error(`out-of-order write: got ${data.block.height}, expected ${this.hashes.length}`)
    }
    this.hashes.push(bytesToHex(data.block.hash))
    this.nodeTip = nodeTipHeight
    this.onWrite(data.block.height)
  }

  async rollbackFrom(height: number): Promise<void> {
    this.hashes = this.hashes.slice(0, height)
  }

  async recordNodeTip(nodeTipHeight: number): Promise<void> {
    this.nodeTip = nodeTipHeight
  }
}
