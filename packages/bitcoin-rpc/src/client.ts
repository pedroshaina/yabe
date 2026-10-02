import { randomUUID } from 'node:crypto'
import type { RpcBlock, RpcBlockchainInfo } from './types.js'

export interface RpcClientOptions {
  url: string
  username: string
  password: string
  timeoutMs: number
}

export class RpcError extends Error {
  override name = 'RpcError'
  constructor(
    message: string,
    readonly method: string,
    readonly code?: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export class RpcTimeoutError extends RpcError {
  override name = 'RpcTimeoutError'
}

interface RpcResponse<T> {
  result: T | null
  error: { code: number; message: string } | null
}

export class BitcoinRpcClient {
  private readonly authorization: string

  constructor(private readonly opts: RpcClientOptions) {
    this.authorization = `Basic ${Buffer.from(`${opts.username}:${opts.password}`).toString('base64')}`
  }

  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    let response: Response
    try {
      response = await fetch(this.opts.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: this.authorization },
        body: JSON.stringify({ jsonrpc: '1.0', id: randomUUID(), method, params }),
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new RpcTimeoutError(`RPC ${method} timed out after ${this.opts.timeoutMs}ms`, method)
      }
      throw new RpcError(`RPC ${method} transport error: ${(err as Error).message}`, method, undefined, {
        cause: err,
      })
    }

    if (response.status === 401 || response.status === 403) {
      throw new RpcError(`RPC authentication failed (HTTP ${response.status})`, method)
    }

    let payload: RpcResponse<T>
    try {
      payload = (await response.json()) as RpcResponse<T>
    } catch (err) {
      throw new RpcError(
        `RPC ${method} returned a non-JSON response (HTTP ${response.status})`,
        method,
        undefined,
        {
          cause: err,
        },
      )
    }
    if (payload.error) throw new RpcError(payload.error.message, method, payload.error.code)
    return payload.result as T
  }

  getBlockchainInfo(): Promise<RpcBlockchainInfo> {
    return this.call('getblockchaininfo')
  }

  getBlockCount(): Promise<number> {
    return this.call('getblockcount')
  }

  getBlockHash(height: number): Promise<string> {
    return this.call('getblockhash', [height])
  }

  // Verbosity 3 includes each input's `prevout` (value, script, address); needs undo data (non-pruned node).
  getBlock(hash: string): Promise<RpcBlock> {
    return this.call('getblock', [hash, 3])
  }
}
