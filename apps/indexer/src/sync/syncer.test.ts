import { createLogger } from '@yabe/shared'
import { describe, expect, it } from 'vitest'
import { makeChain } from '../../test/fixtures.js'
import { FakeChain, InMemoryStore } from '../../test/fakes.js'
import { ReorgTooDeepError, Syncer, type SyncerOptions } from './syncer.js'

const setup = (length: number, overrides: Partial<SyncerOptions> = {}) => {
  const chain = new FakeChain(makeChain(length))
  const store = new InMemoryStore()
  const syncer = new Syncer({
    chain,
    store,
    network: 'regtest',
    logger: createLogger({ name: 'test', level: 'silent' }),
    reorgMaxDepth: 10,
    prefetchBlocks: 3,
    pollIntervalMs: 5,
    backoff: { initialMs: 1, maxMs: 5 },
    ...overrides,
  })
  return { chain, store, syncer }
}

describe('Syncer.syncOnce', () => {
  it('indexes from genesis to the node tip in order, prefetching in batches', async () => {
    const { chain, store, syncer } = setup(7)
    expect(await syncer.syncOnce()).toBe(7)
    expect(store.hashes).toEqual(chain.blocks.map((b) => b.hash))
    expect(chain.getBlockCalls).toBe(7)
    expect(store.nodeTip).toBe(6)
  })

  it('returns 0 and records the node tip when already caught up', async () => {
    const { store, syncer } = setup(3)
    await syncer.syncOnce()
    store.nodeTip = -1
    expect(await syncer.syncOnce()).toBe(0)
    expect(store.nodeTip).toBe(2)
  })

  it('indexes only new blocks on later passes', async () => {
    const { chain, store, syncer } = setup(3)
    await syncer.syncOnce()
    chain.blocks.push(...makeChain(2, 'main', 3, chain.blocks[2]!.hash))
    expect(await syncer.syncOnce()).toBe(2)
    expect(store.hashes).toHaveLength(5)
  })

  it('rolls back to the fork point and follows the new branch', async () => {
    const { chain, store, syncer } = setup(5)
    await syncer.syncOnce()
    const branch = makeChain(3, 'fork', 3, chain.blocks[2]!.hash)
    chain.reorg(3, branch)

    expect(await syncer.syncOnce()).toBe(3)
    expect(store.hashes).toEqual(chain.blocks.map((b) => b.hash))
  })

  it('handles a reorg to a shorter chain', async () => {
    const { chain, store, syncer } = setup(5)
    await syncer.syncOnce()
    chain.reorg(3, makeChain(1, 'fork', 3, chain.blocks[2]!.hash))

    expect(await syncer.syncOnce()).toBe(1)
    expect(store.hashes).toEqual(chain.blocks.map((b) => b.hash))
  })

  it('refuses a reorg deeper than reorgMaxDepth and leaves the store untouched', async () => {
    const { chain, store, syncer } = setup(6, { reorgMaxDepth: 2 })
    await syncer.syncOnce()
    const before = [...store.hashes]
    chain.reorg(2, makeChain(5, 'fork', 2, chain.blocks[1]!.hash))

    await expect(syncer.syncOnce()).rejects.toThrow(ReorgTooDeepError)
    expect(store.hashes).toEqual(before)
  })

  it('stops between blocks when aborted', async () => {
    const { store, syncer } = setup(6)
    const controller = new AbortController()
    store.onWrite = (height) => {
      if (height === 1) controller.abort()
    }
    expect(await syncer.syncOnce(controller.signal)).toBe(2)
    expect(store.hashes).toHaveLength(2)
  })
})

describe('Syncer.run', () => {
  it('retries after a transient node failure and keeps going', async () => {
    const { chain, store, syncer } = setup(4)
    chain.failNextTipCalls = 2
    const controller = new AbortController()
    store.onWrite = (height) => {
      if (height === 3) controller.abort()
    }
    await syncer.run(controller.signal)
    expect(store.hashes).toHaveLength(4)
  })

  it('stops with ReorgTooDeepError', async () => {
    const { chain, syncer } = setup(6, { reorgMaxDepth: 1 })
    await syncer.syncOnce()
    chain.reorg(3, makeChain(4, 'fork', 3, chain.blocks[2]!.hash))
    await expect(syncer.run(new AbortController().signal)).rejects.toThrow(ReorgTooDeepError)
  })

  it('returns promptly when aborted while idle', async () => {
    const { syncer } = setup(1, { pollIntervalMs: 60_000 })
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 20)
    await syncer.run(controller.signal)
  })
})
