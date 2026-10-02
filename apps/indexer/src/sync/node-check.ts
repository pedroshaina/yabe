import { setTimeout as sleep } from 'node:timers/promises'
import { RpcError, type BitcoinRpcClient, type RpcBlockchainInfo } from '@yabe/bitcoin-rpc'
import type { Logger, Network } from '@yabe/shared'
import { Backoff } from './backoff.js'

export class NodeMismatchError extends Error {
  override name = 'NodeMismatchError'
}

// Waits until bitcoind answers, then checks that it is suitable: right network, not pruned.
export const waitForNode = async (
  rpc: Pick<BitcoinRpcClient, 'getBlockchainInfo'>,
  network: Network,
  logger: Logger,
  signal: AbortSignal,
  backoff = new Backoff({ initialMs: 1_000, maxMs: 30_000 }),
): Promise<RpcBlockchainInfo> => {
  for (;;) {
    signal.throwIfAborted()
    let info: RpcBlockchainInfo
    try {
      info = await rpc.getBlockchainInfo()
    } catch (err) {
      if (!(err instanceof RpcError)) throw err
      const retryInMs = backoff.next()
      logger.warn({ reason: err.message, retryInMs }, 'bitcoin node not ready')
      await sleep(retryInMs, undefined, { signal })
      continue
    }
    if (info.chain !== network) {
      throw new NodeMismatchError(`Node is on '${info.chain}' but BITCOIN_NETWORK is '${network}'`)
    }
    if (info.pruned) {
      throw new NodeMismatchError(
        'Node is pruned; YABE needs a non-pruned node (getblock verbosity 3 needs undo data)',
      )
    }
    return info
  }
}
