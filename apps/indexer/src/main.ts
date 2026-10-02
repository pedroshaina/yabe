import { BitcoinRpcClient } from '@yabe/bitcoin-rpc'
import { createPrismaClient } from '@yabe/db'
import { createLogger } from '@yabe/shared'
import { loadIndexerConfig } from './config.js'
import { BlockStore } from './store/block-store.js'
import { waitForNode } from './sync/node-check.js'
import { Syncer } from './sync/syncer.js'

const config = loadIndexerConfig()
const logger = createLogger({ name: 'indexer', level: config.LOG_LEVEL })
const prisma = createPrismaClient(config.DATABASE_URL)
const rpc = new BitcoinRpcClient({
  url: config.BITCOIN_RPC_URL,
  username: config.BITCOIN_RPC_USER,
  password: config.BITCOIN_RPC_PASSWORD,
  timeoutMs: config.RPC_TIMEOUT_MS,
})

const controller = new AbortController()
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'shutting down after the current block')
    controller.abort()
  })
}

try {
  const info = await waitForNode(rpc, config.BITCOIN_NETWORK, logger, controller.signal)
  logger.info({ chain: info.chain, nodeHeight: info.blocks }, 'connected to bitcoin node')
  const syncer = new Syncer({
    chain: rpc,
    store: new BlockStore(prisma, config.BITCOIN_NETWORK),
    network: config.BITCOIN_NETWORK,
    logger,
    reorgMaxDepth: config.REORG_MAX_DEPTH,
    prefetchBlocks: config.PREFETCH_BLOCKS,
    pollIntervalMs: config.POLL_INTERVAL_MS,
  })
  await syncer.run(controller.signal)
  logger.info('indexer stopped')
} catch (err) {
  if (!controller.signal.aborted) {
    logger.fatal({ err }, 'indexer failed')
    process.exitCode = 1
  }
} finally {
  await prisma.$disconnect()
}
