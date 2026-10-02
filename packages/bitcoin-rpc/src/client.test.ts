import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { BitcoinRpcClient, RpcAuthError, RpcError, RpcTimeoutError } from './client.js'

type Handler = (
  req: IncomingMessage,
  body: { method: string; params: unknown[] },
  res: ServerResponse,
) => void
const servers: { close: () => Promise<void> }[] = []

const startServer = async (handler: Handler): Promise<string> => {
  const server = createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    handler(req, JSON.parse(raw) as { method: string; params: unknown[] }, res)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  servers.push({
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  })
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

const json = (res: ServerResponse, status: number, payload: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

const client = (url: string, timeoutMs = 2_000) =>
  new BitcoinRpcClient({ url, username: 'alice', password: 's3cret', timeoutMs })

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()))
})

describe('BitcoinRpcClient', () => {
  it('sends basic auth and a JSON-RPC body, and returns the result', async () => {
    let seen: { auth?: string; method?: string; params?: unknown[] } = {}
    const url = await startServer((req, body, res) => {
      seen = { auth: req.headers.authorization, method: body.method, params: body.params }
      json(res, 200, { result: 812_345, error: null, id: 'x' })
    })

    await expect(client(url).getBlockCount()).resolves.toBe(812_345)
    expect(seen).toEqual({
      auth: `Basic ${Buffer.from('alice:s3cret').toString('base64')}`,
      method: 'getblockcount',
      params: [],
    })
  })

  it('requests blocks with verbosity 3', async () => {
    let params: unknown[] = []
    const url = await startServer((_req, body, res) => {
      params = body.params
      json(res, 200, { result: { hash: 'abc' }, error: null, id: 'x' })
    })
    await client(url).getBlock('abc')
    expect(params).toEqual(['abc', 3])
  })

  it('raises RpcError with the node error code', async () => {
    const url = await startServer((_req, _body, res) =>
      json(res, 500, { result: null, error: { code: -8, message: 'Block height out of range' }, id: 'x' }),
    )
    const error = await client(url)
      .getBlockHash(999_999_999)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RpcError)
    expect(error).toMatchObject({ code: -8, method: 'getblockhash', message: 'Block height out of range' })
  })

  it('raises RpcError on authentication failure', async () => {
    const url = await startServer((_req, _body, res) => {
      res.writeHead(401)
      res.end()
    })
    const error = await client(url)
      .getBlockCount()
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RpcAuthError)
    expect(error).toBeInstanceOf(RpcError)
    expect((error as Error).message).toMatch(/authentication failed/)
  })

  it('raises RpcTimeoutError when the node does not answer in time', async () => {
    const url = await startServer(() => {
      // never respond
    })
    await expect(client(url, 50).getBlockCount()).rejects.toBeInstanceOf(RpcTimeoutError)
  })

  it('raises RpcError when the node is unreachable', async () => {
    const url = await startServer((_req, _body, res) => json(res, 200, { result: 1, error: null, id: 'x' }))
    await Promise.all(servers.splice(0).map((s) => s.close()))
    const error = await client(url)
      .getBlockCount()
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RpcError)
    expect(error).not.toBeInstanceOf(RpcTimeoutError)
  })
})
