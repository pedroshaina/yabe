import { RpcError, type RpcBlockchainInfo } from '@yabe/bitcoin-rpc'
import { createLogger } from '@yabe/shared'
import { expect, it } from 'vitest'
import { Backoff } from './backoff.js'
import { NodeMismatchError, waitForNode } from './node-check.js'

const logger = createLogger({ name: 'test', level: 'silent' })
const info = (over: Partial<RpcBlockchainInfo> = {}): RpcBlockchainInfo => ({
  chain: 'signet',
  blocks: 10,
  headers: 10,
  bestblockhash: 'ab',
  pruned: false,
  initialblockdownload: false,
  verificationprogress: 1,
  ...over,
})
const fast = () => new Backoff({ initialMs: 1, maxMs: 2 })

it('retries while the node is warming up, then returns its info', async () => {
  let calls = 0
  const rpc = {
    getBlockchainInfo: async () => {
      if (++calls < 3) throw new RpcError('Loading block index…', 'getblockchaininfo', -28)
      return info()
    },
  }
  await expect(
    waitForNode(rpc, 'signet', logger, new AbortController().signal, fast()),
  ).resolves.toMatchObject({
    chain: 'signet',
  })
  expect(calls).toBe(3)
})

it('rejects a node on a different network', async () => {
  const rpc = { getBlockchainInfo: async () => info({ chain: 'main' }) }
  await expect(waitForNode(rpc, 'signet', logger, new AbortController().signal, fast())).rejects.toThrow(
    NodeMismatchError,
  )
})

it('rejects a pruned node', async () => {
  const rpc = { getBlockchainInfo: async () => info({ pruned: true }) }
  await expect(waitForNode(rpc, 'signet', logger, new AbortController().signal, fast())).rejects.toThrow(
    /pruned/,
  )
})
