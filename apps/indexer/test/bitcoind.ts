import { BitcoinRpcClient, rpcAuthLine } from '@yabe/bitcoin-rpc'
import { GenericContainer, Wait } from 'testcontainers'

const USER = 'yabe'
const PASSWORD = 'regtest-password'

export const startRegtestNode = async () => {
  const container = await new GenericContainer('bitcoin/bitcoin:31.1')
    .withCommand([
      '-regtest=1',
      '-server=1',
      '-printtoconsole=1',
      '-rpcbind=0.0.0.0',
      '-rpcallowip=0.0.0.0/0',
      `-rpcauth=${rpcAuthLine(USER, PASSWORD)}`,
      '-fallbackfee=0.0002',
    ])
    .withExposedPorts(18443)
    .withWaitStrategy(Wait.forLogMessage(/init message: Done loading/))
    .withStartupTimeout(120_000)
    .start()
  const rpc = new BitcoinRpcClient({
    url: `http://${container.getHost()}:${container.getMappedPort(18443)}`,
    username: USER,
    password: PASSWORD,
    timeoutMs: 30_000,
  })
  return { rpc, stop: async () => void (await container.stop()) }
}
