/** The node answered with a JSON-RPC error (for example -8 "Block height out of range"). */
export class RpcError extends Error {
  override name = "RpcError";
  constructor(
    readonly method: string,
    readonly code: number,
    message: string,
  ) {
    super(`${method}: ${message} (code ${code})`);
  }
}

/** The node answered without a JSON-RPC body: 401/403 auth failures, proxies, etc. */
export class RpcHttpError extends Error {
  override name = "RpcHttpError";
  constructor(
    readonly method: string,
    readonly status: number,
  ) {
    super(
      `${method}: HTTP ${status}${status === 401 ? " (check INDEXER_BITCOIN_RPC_USER/PASSWORD)" : ""}`,
    );
  }
}

/** No response at all: connection refused, timeout, DNS failure. */
export class RpcConnectionError extends Error {
  override name = "RpcConnectionError";
  constructor(
    readonly method: string,
    readonly url: string,
    options: { cause: unknown },
  ) {
    super(`${method}: no response from ${url}`, options);
  }
}

/** The node's result didn't match the expected schema. */
export class RpcResponseError extends Error {
  override name = "RpcResponseError";
  constructor(
    readonly method: string,
    details: string,
  ) {
    super(`${method}: unexpected response from the node\n${details}`);
  }
}
