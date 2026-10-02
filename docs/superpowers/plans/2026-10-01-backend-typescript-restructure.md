# YABE Backend TypeScript Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the JavaScript `yabe-backend/` (indexer + API) with a strict-TypeScript pnpm monorepo: a reorg-safe Bitcoin indexer and a versioned, OpenAPI-described Fastify REST API over Postgres.

**Architecture:** Three shared packages (`shared`: config/logging/utils, `bitcoin-rpc`: typed bitcoind client, `db`: Prisma schema, client and `tx_num` key helpers) and two apps (`indexer`, `api`).
- **Indexer:** fetches `getblock <hash> 3`, transforms it with pure functions into rows keyed by indexer-computed `tx_num = height << 20 | position`, and writes one DB transaction per block. Reorgs are handled by height-range deletes.
- **API:** Fastify with TypeBox schemas, which give runtime validation, TypeScript types and a generated OpenAPI document.

**Tech Stack:**
- Runtime and language: Node 24, TypeScript 6.0, pnpm 10 workspaces
- Database: Prisma 7.10 (`prisma-client` generator + `@prisma/adapter-pg`), Postgres 18
- API: Fastify 5, TypeBox 1.x, `@fastify/swagger`
- Logging and Bitcoin helpers: pino 10, bitcoinjs-lib 7
- Testing: Vitest 5, Testcontainers 12, Bitcoin Core 31.1 (regtest)

**Spec:** `docs/superpowers/specs/2026-10-01-backend-typescript-restructure-design.md`

## Global Constraints

- Node `>=24`; pnpm `10.34.6` via corepack (`packageManager` field). TypeScript **6.0.x**, not 7.x: typescript-eslint 8.71 supports `<6.1`.
- ESM everywhere (`"type": "module"`). Relative imports in `.ts` files end in `.js`.
- Code style (Prettier): no semicolons, single quotes, `printWidth` 110, trailing commas.
- Workspace packages export TypeScript source under the custom condition `@yabe/source` (used by vitest, tsx and `tsc --noEmit`) and `dist/` otherwise (used by builds and production).
- Amounts: Postgres `bigint` satoshis; JS `bigint` in the indexer and DB layer; JSON integer numbers in the API.
- Hashes and scripts: Postgres `bytea`, holding exactly the bytes of the hex Bitcoin Core prints (display order). The API returns lowercase hex.
- The internal transaction key is named `tx_num` / `txNum`, never `tx_id`.
- Images: `bitcoin/bitcoin:31.1`, `postgres:18-alpine`, `node:24-slim`.
- Integration tests need a Docker-compatible runtime. With Podman: `export DOCKER_HOST=unix://$(podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}')` and `export TESTCONTAINERS_RYUK_DISABLED=true`.
- **Spec deviations decided during planning** (Task 13 records them in the spec):
  1. `transaction.txid` has a **non-unique** index, not a unique one. Mainnet has two BIP30 duplicate coinbase txids (heights 91842 and 91880); lookups take the highest `tx_num`.
  2. The `script_type` enum uses Bitcoin Core's names verbatim (`pubkeyhash`, `witness_v1_taproot`, …).
  3. The subsidy halving interval depends on the network: 210,000, except regtest at 150.
  4. Transaction `version` is stored as `bigint`, since it's uint32 in Core.
  5. The API always returns `wtxid`, falling back to `txid` for non-witness transactions.
  6. `/v1/blocks/:hashOrHeight/transactions` accepts a height as well as a hash.
  7. Builds are per-package `tsc -p tsconfig.build.json` runs in pnpm's topological order, instead of `tsc` project references.

## Review Focus

1. **Block hash made only of digits:** a 64-character hash containing only digits, passed to `/v1/blocks/:hashOrHeight`, must be treated as a hash, never parsed as a height. Test in Task 10.
2. **Very large blocks:** a block with more than 5,000 inputs or outputs must still write without hitting Postgres's 65,535 bind-parameter limit. Test in Task 6.
3. **Duplicate txids (BIP30):** a second transaction with an already-indexed txid must index, and prevout resolution must pick the newest. Test in Task 6.
4. **Malformed scripts:** an output script that can't be decoded must return `asm: null`, not a 500. Test in Task 11.
5. **Failures in the middle of a sync:** a failed RPC call, or a bad prevout in the middle of a block, must leave nothing partially written, and the run loop must retry rather than exit. Tests in Tasks 6 and 7.

---

## File Map

```
package.json, pnpm-workspace.yaml, tsconfig.base.json, eslint.config.js, vitest.config.ts,
.prettierrc.json, .prettierignore, .nvmrc, .gitignore (modify), .env.example, .dockerignore,
docker-compose.yml (replace), docker/Dockerfile, README.md (replace), .github/workflows/ci.yml

packages/shared/src/        hex.ts, sats.ts, network.ts, config.ts, logger.ts, index.ts (+ *.test.ts)
packages/bitcoin-rpc/src/   types.ts, client.ts, rpcauth.ts, cli/rpcauth.ts, index.ts (+ *.test.ts)
packages/db/                prisma.config.ts, prisma/schema.prisma, prisma/migrations/20261001000000_init/*
packages/db/src/            client.ts, txnum.ts, index.ts, testing/{postgres,seed,index}.ts (+ tests)
apps/indexer/src/           config.ts, main.ts
  transform/                types.ts, script-type.ts, subsidy.ts, block.ts (+ tests)
  store/                    chunk.ts, resolve-inputs.ts, block-store.ts (+ tests)
  sync/                     backoff.ts, node-check.ts, syncer.ts (+ tests)
apps/indexer/test/          fixtures.ts, fakes.ts, bitcoind.ts, regtest.int.test.ts
apps/api/src/               config.ts, errors.ts, app.ts, server.ts, scripts/export-openapi.ts
  lib/script.ts             schemas/common.ts
  modules/chain.ts          modules/{status,blocks,transactions}/{schemas,repository,service,routes}.ts
apps/api/test/              app.ts, *.int.test.ts
apps/api/openapi.json       (generated, committed)
```

---

### Task 1: Monorepo scaffold and `@yabe/shared` byte/amount utilities

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `vitest.config.ts`, `.prettierrc.json`, `.prettierignore`, `.nvmrc`
- Modify: `.gitignore` (append)
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/tsconfig.build.json`
- Create: `packages/shared/src/hex.ts`, `packages/shared/src/sats.ts`, `packages/shared/src/network.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/src/hex.test.ts`, `packages/shared/src/sats.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (from `@yabe/shared`):
  - `hexToBytes(hex: string): Uint8Array<ArrayBuffer>` (throws `Error('Invalid hex …')`)
  - `bytesToHex(bytes: Uint8Array): string` (lowercase)
  - `SATS_PER_BTC = 100_000_000`
  - `btcToSats(btc: number): bigint` (throws `RangeError`)
  - `NETWORKS = ['main','test','testnet4','signet','regtest'] as const`, `type Network`

- [ ] **Step 1: Make sure Node 24 and corepack are available**

Run: `node -v` and expect `v24.x`. If it isn't, install it with `nvm install 24 && nvm use 24`. Then run `corepack enable`.

- [ ] **Step 2: Create the root workspace files**

`package.json`:
```json
{
  "name": "yabe",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.34.6",
  "engines": { "node": ">=24" },
  "scripts": {
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:all": "vitest run"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/node": "^24.0.0",
    "eslint": "^10.11.0",
    "eslint-config-prettier": "^10.1.8",
    "prettier": "^3.9.9",
    "tsx": "^4.23.15",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.71.0",
    "vite": "^8.3.2",
    "vitest": "^5.0.3"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - packages/*
onlyBuiltDependencies:
  - '@prisma/engines'
  - prisma
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["es2023"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "customConditions": ["@yabe/source"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "types": ["node"]
  }
}
```

`eslint.config.js`:
```js
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/src/generated/**', '**/coverage/**', 'yabe-backend/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
)
```

`vitest.config.ts`:
```ts
import { defaultClientConditions, defaultServerConditions } from 'vite'
import { defineConfig } from 'vitest/config'

const SOURCE_CONDITION = '@yabe/source'

export default defineConfig({
  resolve: { conditions: [SOURCE_CONDITION, ...defaultClientConditions] },
  ssr: { resolve: { conditions: [SOURCE_CONDITION, ...defaultServerConditions] } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['{apps,packages}/*/{src,test}/**/*.test.ts'],
          exclude: ['**/*.int.test.ts', '**/node_modules/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['{apps,packages}/*/{src,test}/**/*.int.test.ts'],
          testTimeout: 120_000,
          hookTimeout: 300_000,
        },
      },
    ],
  },
})
```

`.prettierrc.json`:
```json
{ "semi": false, "singleQuote": true, "printWidth": 110, "trailingComma": "all" }
```

`.prettierignore`:
```
pnpm-lock.yaml
**/dist
**/src/generated
**/prisma/migrations
apps/api/openapi.json
yabe-backend
```

`.nvmrc`:
```
24
```

Append to `.gitignore`:
```
# Prisma generated client
packages/db/src/generated/
```

- [ ] **Step 3: Create the `@yabe/shared` package skeleton**

`packages/shared/package.json`:
```json
{
  "name": "@yabe/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "@yabe/source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.json"
  }
}
```

`packages/shared/tsconfig.json` (use this exact content in **every** package and app, changing nothing):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src", "test"]
}
```

`packages/shared/tsconfig.build.json` (also identical in every package and app):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "rootDir": "src", "outDir": "dist", "customConditions": [] },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/testing/**"]
}
```

Run: `pnpm install`
Expected: creates `pnpm-lock.yaml` and installs without errors.

- [ ] **Step 4: Write failing tests for hex and sats**

`packages/shared/src/hex.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { bytesToHex, hexToBytes } from './hex.js'

describe('hex', () => {
  it('round-trips bytes', () => {
    const bytes = hexToBytes('00ff10ab')
    expect([...bytes]).toEqual([0, 255, 16, 171])
    expect(bytesToHex(bytes)).toBe('00ff10ab')
  })

  it('accepts uppercase input and returns lowercase', () => {
    expect(bytesToHex(hexToBytes('ABCD'))).toBe('abcd')
  })

  it('handles empty input', () => {
    expect(hexToBytes('')).toHaveLength(0)
    expect(bytesToHex(new Uint8Array())).toBe('')
  })

  it('rejects odd-length and non-hex input', () => {
    expect(() => hexToBytes('abc')).toThrow(/Invalid hex/)
    expect(() => hexToBytes('zz')).toThrow(/Invalid hex/)
  })

  it('respects subarray offsets', () => {
    expect(bytesToHex(hexToBytes('00112233').subarray(1, 3))).toBe('1122')
  })
})
```

`packages/shared/src/sats.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { btcToSats } from './sats.js'

describe('btcToSats', () => {
  it.each([
    [0, 0n],
    [0.00000001, 1n],
    [0.1, 10_000_000n],
    [0.29, 29_000_000n],
    [1.23456789, 123_456_789n],
    [50, 5_000_000_000n],
    [20999999.99999999, 2_099_999_999_999_999n],
  ])('converts %s BTC to %s sats without float drift', (btc, sats) => {
    expect(btcToSats(btc)).toBe(sats)
  })

  it('rejects negative and non-finite amounts', () => {
    expect(() => btcToSats(-1)).toThrow(RangeError)
    expect(() => btcToSats(Number.NaN)).toThrow(RangeError)
    expect(() => btcToSats(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
```

- [ ] **Step 5: Run the tests and confirm they fail**

Run: `pnpm test`
Expected: FAIL, because `./hex.js` and `./sats.js` can't be resolved.

- [ ] **Step 6: Implement**

`packages/shared/src/hex.ts`:
```ts
const HEX_RE = /^(?:[0-9a-fA-F]{2})*$/

export const hexToBytes = (hex: string): Uint8Array<ArrayBuffer> => {
  if (!HEX_RE.test(hex)) {
    throw new Error(`Invalid hex string: "${hex.slice(0, 16)}${hex.length > 16 ? '…' : ''}"`)
  }
  return Uint8Array.from(Buffer.from(hex, 'hex'))
}

export const bytesToHex = (bytes: Uint8Array): string =>
  Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('hex')
```

`packages/shared/src/sats.ts`:
```ts
export const SATS_PER_BTC = 100_000_000

// Bitcoin Core reports amounts as BTC floats with 8 decimals; rounding after scaling is exact for every
// valid amount (max supply 2.1e15 sats < 2^53).
export const btcToSats = (btc: number): bigint => {
  if (!Number.isFinite(btc) || btc < 0) throw new RangeError(`Invalid BTC amount: ${btc}`)
  return BigInt(Math.round(btc * SATS_PER_BTC))
}
```

`packages/shared/src/network.ts`:
```ts
// Values match `getblockchaininfo.chain` in Bitcoin Core.
export const NETWORKS = ['main', 'test', 'testnet4', 'signet', 'regtest'] as const
export type Network = (typeof NETWORKS)[number]
```

`packages/shared/src/index.ts`:
```ts
export * from './hex.js'
export * from './network.js'
export * from './sats.js'
```

- [ ] **Step 7: Run all checks**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm build`
Expected: all pass, and `packages/shared/dist/index.js` exists. If `format:check` fails, run `pnpm format` and re-run.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json eslint.config.js vitest.config.ts .prettierrc.json .prettierignore .nvmrc .gitignore packages/shared
git commit -m "chore: scaffold pnpm TypeScript monorepo with @yabe/shared utils"
```

---

### Task 2: `@yabe/shared` config loader and logger

**Files:**
- Create: `packages/shared/src/config.ts`, `packages/shared/src/logger.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/package.json` (deps)
- Test: `packages/shared/src/config.test.ts`

**Interfaces:**
- Consumes: `NETWORKS`/`Network` from Task 1.
- Produces:
  - `loadConfig<T extends TSchema>(schema: T, env?: Record<string, string | undefined>): Static<T>` (throws `ConfigError`)
  - `class ConfigError extends Error`
  - `NetworkSchema`, a TypeBox union of the network literals
  - `LogLevelSchema`, a union of pino levels with default `'info'`
  - `createLogger(opts: { name: string; level: LogLevel }): Logger`
  - `type Logger` (pino), `type LogLevel`

- [ ] **Step 1: Add dependencies**

Run: `pnpm --filter @yabe/shared add pino@^10.3.1 typebox@^1.3.34`

- [ ] **Step 2: Write the failing test**

`packages/shared/src/config.test.ts`:
```ts
import { Type } from 'typebox'
import { describe, expect, it } from 'vitest'
import { ConfigError, LogLevelSchema, loadConfig, NetworkSchema } from './config.js'

const Schema = Type.Object({
  DATABASE_URL: Type.String({ minLength: 1 }),
  PORT: Type.Integer({ minimum: 1, default: 8080 }),
  BITCOIN_NETWORK: NetworkSchema,
  LOG_LEVEL: LogLevelSchema,
})

describe('loadConfig', () => {
  it('coerces numeric strings, applies defaults and drops unknown variables', () => {
    const config = loadConfig(Schema, {
      DATABASE_URL: 'postgresql://x',
      PORT: '9000',
      BITCOIN_NETWORK: 'signet',
      HOME: '/home/me',
    })
    expect(config).toEqual({
      DATABASE_URL: 'postgresql://x',
      PORT: 9000,
      BITCOIN_NETWORK: 'signet',
      LOG_LEVEL: 'info',
    })
  })

  it('reports every problem in one ConfigError', () => {
    const load = () => loadConfig(Schema, { PORT: 'abc', BITCOIN_NETWORK: 'mainnet' })
    expect(load).toThrow(ConfigError)
    expect(load).toThrow(/DATABASE_URL/)
    expect(load).toThrow(/BITCOIN_NETWORK/)
    expect(load).toThrow(/PORT/)
  })
})
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `pnpm vitest run packages/shared/src/config.test.ts`
Expected: FAIL, because `./config.js` doesn't exist.

- [ ] **Step 4: Implement**

`packages/shared/src/config.ts`:
```ts
import { Type, type Static, type TSchema } from 'typebox'
import { Value } from 'typebox/value'

export class ConfigError extends Error {
  override name = 'ConfigError'
}

export const NetworkSchema = Type.Union([
  Type.Literal('main'),
  Type.Literal('test'),
  Type.Literal('testnet4'),
  Type.Literal('signet'),
  Type.Literal('regtest'),
])

export const LogLevelSchema = Type.Union(
  [
    Type.Literal('fatal'),
    Type.Literal('error'),
    Type.Literal('warn'),
    Type.Literal('info'),
    Type.Literal('debug'),
    Type.Literal('trace'),
    Type.Literal('silent'),
  ],
  { default: 'info' },
)
export type LogLevel = Static<typeof LogLevelSchema>

// Parses environment variables against a TypeBox schema: applies defaults, coerces strings to the declared
// types, drops variables the schema doesn't declare, then validates. Fails with every problem listed at once.
export const loadConfig = <T extends TSchema>(
  schema: T,
  env: Record<string, string | undefined> = process.env,
): Static<T> => {
  const value = Value.Clean(schema, Value.Convert(schema, Value.Default(schema, { ...env })))
  if (!Value.Check(schema, value)) {
    const details = [...Value.Errors(schema, value)]
      .map((error) => `  ${error.instancePath || '(root)'} ${error.message}`)
      .join('\n')
    throw new ConfigError(`Invalid configuration:\n${details}`)
  }
  return value
}
```

The test expects `/DATABASE_URL/` to appear in the message. TypeBox reports a missing required property at the root, with the message `must have required properties DATABASE_URL`, so the property name is in the text.

`packages/shared/src/logger.ts`:
```ts
import { pino, type Logger } from 'pino'
import type { LogLevel } from './config.js'

export type { Logger }

export const createLogger = (opts: { name: string; level: LogLevel }): Logger =>
  pino({ name: opts.name, level: opts.level })
```

Append to `packages/shared/src/index.ts`:
```ts
export * from './config.js'
export * from './logger.js'
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): add TypeBox env config loader and pino logger"
```

---

### Task 3: `@yabe/bitcoin-rpc` typed client

**Files:**
- Create: `packages/bitcoin-rpc/package.json`, `tsconfig.json`, `tsconfig.build.json` (same content as in Task 1)
- Create: `packages/bitcoin-rpc/src/types.ts`, `src/client.ts`, `src/rpcauth.ts`, `src/cli/rpcauth.ts`, `src/index.ts`
- Modify: root `package.json` (add an `rpcauth` script)
- Test: `packages/bitcoin-rpc/src/client.test.ts`, `packages/bitcoin-rpc/src/rpcauth.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (from `@yabe/bitcoin-rpc`):
  - `class BitcoinRpcClient(opts: RpcClientOptions)` with:
    - `call<T>(method: string, params?: unknown[]): Promise<T>`
    - `getBlockchainInfo(): Promise<RpcBlockchainInfo>`
    - `getBlockCount(): Promise<number>`
    - `getBlockHash(height: number): Promise<string>`
    - `getBlock(hash: string): Promise<RpcBlock>` (verbosity 3)
  - `interface RpcClientOptions { url: string; username: string; password: string; timeoutMs: number }`
  - `class RpcError extends Error { code?: number; method: string }`, and `class RpcTimeoutError extends RpcError`
  - Types: `RpcBlock`, `RpcTx`, `RpcVin`, `RpcVout`, `RpcScriptPubKey`, `RpcPrevout`, `RpcBlockchainInfo`
  - `rpcAuthLine(user: string, password: string, salt?: string): string`

- [ ] **Step 1: Create the package**

`packages/bitcoin-rpc/package.json`:
```json
{
  "name": "@yabe/bitcoin-rpc",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "@yabe/source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.json"
  }
}
```
Copy `tsconfig.json` and `tsconfig.build.json` from `packages/shared` unchanged. Then run `pnpm install`.

- [ ] **Step 2: Write the failing tests**

`packages/bitcoin-rpc/src/rpcauth.test.ts`:
```ts
import { expect, it } from 'vitest'
import { rpcAuthLine } from './rpcauth.js'

it('produces the same line as Bitcoin Core share/rpcauth/rpcauth.py', () => {
  // python3: hmac.new(b'0123456789abcdef0123456789abcdef', b'secret', 'sha256').hexdigest()
  expect(rpcAuthLine('yabe', 'secret', '0123456789abcdef0123456789abcdef')).toBe(
    'yabe:0123456789abcdef0123456789abcdef$0ad814968caefdecab8a6c0c55414688fdcad02f100ee7ac5def2352aaff36e5',
  )
})

it('generates a random 32-hex-character salt by default', () => {
  expect(rpcAuthLine('u', 'p')).toMatch(/^u:[0-9a-f]{32}\$[0-9a-f]{64}$/)
})
```

`packages/bitcoin-rpc/src/client.test.ts`:
```ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { BitcoinRpcClient, RpcError, RpcTimeoutError } from './client.js'

type Handler = (req: IncomingMessage, body: { method: string; params: unknown[] }, res: ServerResponse) => void
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
    await expect(client(url).getBlockCount()).rejects.toThrow(/authentication failed/)
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
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm vitest run packages/bitcoin-rpc`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 4: Implement**

`packages/bitcoin-rpc/src/types.ts`:
```ts
// Shapes returned by Bitcoin Core (v23+) for the RPCs YABE uses. Amounts are BTC floats.

export interface RpcScriptPubKey {
  asm: string
  desc?: string
  hex: string
  address?: string
  type: string
}

export interface RpcPrevout {
  generated: boolean
  height: number
  value: number
  scriptPubKey: RpcScriptPubKey
}

export interface RpcVin {
  coinbase?: string
  txid?: string
  vout?: number
  scriptSig?: { asm: string; hex: string }
  txinwitness?: string[]
  prevout?: RpcPrevout
  sequence: number
}

export interface RpcVout {
  value: number
  n: number
  scriptPubKey: RpcScriptPubKey
}

export interface RpcTx {
  txid: string
  hash: string
  version: number
  size: number
  vsize: number
  weight: number
  locktime: number
  vin: RpcVin[]
  vout: RpcVout[]
  fee?: number
  hex: string
}

export interface RpcBlock {
  hash: string
  confirmations: number
  height: number
  version: number
  versionHex: string
  merkleroot: string
  time: number
  mediantime: number
  nonce: number
  bits: string
  difficulty: number
  chainwork: string
  nTx: number
  previousblockhash?: string
  nextblockhash?: string
  strippedsize: number
  size: number
  weight: number
  tx: RpcTx[]
}

export interface RpcBlockchainInfo {
  chain: string
  blocks: number
  headers: number
  bestblockhash: string
  pruned: boolean
  initialblockdownload: boolean
  verificationprogress: number
}
```

`packages/bitcoin-rpc/src/client.ts`:
```ts
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
      throw new RpcError(`RPC ${method} returned a non-JSON response (HTTP ${response.status})`, method, undefined, {
        cause: err,
      })
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
```

`packages/bitcoin-rpc/src/rpcauth.ts`:
```ts
import { createHmac, randomBytes } from 'node:crypto'

// Same algorithm as Bitcoin Core's share/rpcauth/rpcauth.py: HMAC-SHA256 keyed by the hex salt string.
export const rpcAuthLine = (user: string, password: string, salt = randomBytes(16).toString('hex')): string =>
  `${user}:${salt}$${createHmac('sha256', salt).update(password).digest('hex')}`
```

`packages/bitcoin-rpc/src/cli/rpcauth.ts`:
```ts
import { rpcAuthLine } from '../rpcauth.js'

const [user, password] = process.argv.slice(2)
if (!user || !password) {
  console.error('Usage: pnpm rpcauth <user> <password>')
  process.exit(1)
}
console.log(rpcAuthLine(user, password))
```

`packages/bitcoin-rpc/src/index.ts`:
```ts
export * from './client.js'
export * from './rpcauth.js'
export type * from './types.js'
```

Add to the root `package.json` `scripts`:
```json
"rpcauth": "tsx --conditions=@yabe/source packages/bitcoin-rpc/src/cli/rpcauth.ts"
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS. Also run `pnpm rpcauth yabe secret`, which should print `yabe:<32 hex>$<64 hex>`.

- [ ] **Step 6: Commit**

```bash
git add packages/bitcoin-rpc package.json pnpm-lock.yaml
git commit -m "feat(bitcoin-rpc): add typed bitcoind JSON-RPC client and rpcauth helper"
```

---

### Task 4: `@yabe/db` schema, migration, client, `tx_num` helpers and test utilities

**Files:**
- Create: `packages/db/package.json`, `tsconfig.json`, `tsconfig.build.json` (same as in Task 1), `prisma.config.ts`, `prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/migration_lock.toml`, `packages/db/prisma/migrations/20261001000000_init/migration.sql` (generated)
- Create: `packages/db/src/txnum.ts`, `src/client.ts`, `src/index.ts`, `src/testing/postgres.ts`, `src/testing/seed.ts`, `src/testing/index.ts`
- Modify: root `package.json` (add `postinstall` and `db:migrate` scripts)
- Test: `packages/db/src/txnum.test.ts`, `packages/db/src/schema.int.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks at runtime.
- Produces (from `@yabe/db`):
  - Everything the generated client exports: `PrismaClient`, `Prisma` (including `Prisma.TransactionClient`), the model types `Block`, `Transaction`, `TxInput`, `TxOutput`, `SyncState`, and the `ScriptType` const and type
  - `createPrismaClient(databaseUrl: string): PrismaClient`
  - `TX_POSITION_BITS = 20n`, `MAX_TX_POSITION = 1_048_575`
  - `toTxNum(height: number, position: number): bigint` (throws `RangeError`)
  - `fromTxNum(txNum: bigint): { height: number; position: number }`
  - `txNumRangeForHeight(height: number): { start: bigint; end: bigint }` (end is exclusive)
- Produces (from `@yabe/db/testing`, source condition only):
  - `startTestDatabase(): Promise<TestDatabase>`, where `TestDatabase` is `{ url: string; prisma: PrismaClient; stop(): Promise<void> }`
  - `resetDatabase(prisma): Promise<void>`
  - `seedChain(prisma): Promise<SeededChain>`, `SEED`

- [ ] **Step 1: Create the package files**

`packages/db/package.json`:
```json
{
  "name": "@yabe/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "@yabe/source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./testing": {
      "@yabe/source": "./src/testing/index.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "generate": "prisma generate",
    "build": "prisma generate && tsc -p tsconfig.build.json",
    "typecheck": "prisma generate && tsc -p tsconfig.json",
    "migrate:deploy": "node --env-file-if-exists=../../.env node_modules/prisma/build/index.js migrate deploy"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.10.0",
    "@prisma/client": "^7.10.0"
  },
  "devDependencies": {
    "@testcontainers/postgresql": "^12.2.0",
    "prisma": "^7.10.0",
    "testcontainers": "^12.2.0"
  }
}
```
Pin Prisma to the 7.x line: npm's `latest` tag currently points at an 8.0 release candidate.

Copy `tsconfig.json` and `tsconfig.build.json` from `packages/shared` unchanged.

`packages/db/prisma.config.ts`:
```ts
import { defineConfig } from 'prisma/config'

// `generate` and `migrate diff` don't connect, so a placeholder URL is fine; `migrate deploy` gets the real
// DATABASE_URL from the environment.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/unset' },
})
```

`packages/db/prisma/schema.prisma`:
```prisma
generator client {
  provider            = "prisma-client"
  output              = "../src/generated"
  moduleFormat        = "esm"
  importFileExtension = "js"
}

datasource db {
  provider = "postgresql"
}

/// Bitcoin Core `scriptPubKey.type` values, verbatim.
enum ScriptType {
  nonstandard
  pubkey
  pubkeyhash
  scripthash
  multisig
  nulldata
  anchor
  witness_v0_keyhash
  witness_v0_scripthash
  witness_v1_taproot
  witness_unknown

  @@map("script_type")
}

/// Canonical chain only. Hashes are the bytes of Core's display-order hex.
model Block {
  height       Int           @id
  hash         Bytes         @unique @db.ByteA
  prevHash     Bytes?        @map("prev_hash") @db.ByteA
  merkleRoot   Bytes         @map("merkle_root") @db.ByteA
  chainwork    Bytes         @db.ByteA
  version      Int
  bits         BigInt
  nonce        BigInt
  difficulty   Float
  time         DateTime      @db.Timestamptz(0)
  medianTime   DateTime      @map("median_time") @db.Timestamptz(0)
  size         Int
  strippedSize Int           @map("stripped_size")
  weight       Int
  txCount      Int           @map("tx_count")
  subsidySats  BigInt        @map("subsidy_sats")
  totalFeeSats BigInt        @map("total_fee_sats")
  totalOutSats BigInt        @map("total_out_sats")
  transactions Transaction[]

  @@map("block")
}

/// tx_num = (block_height << 20) | position_in_block — computed by the indexer, see src/txnum.ts.
model Transaction {
  txNum       BigInt     @id @map("tx_num")
  /// Not unique: mainnet has two BIP30 duplicate coinbase txids (heights 91842, 91880).
  txid        Bytes      @db.ByteA
  wtxid       Bytes?     @db.ByteA
  blockHeight Int        @map("block_height")
  block       Block      @relation(fields: [blockHeight], references: [height], onDelete: Restrict)
  version     BigInt
  locktime    BigInt
  size        Int
  vsize       Int
  weight      Int
  inputCount  Int        @map("input_count")
  outputCount Int        @map("output_count")
  isCoinbase  Boolean    @map("is_coinbase")
  feeSats     BigInt?    @map("fee_sats")
  inputs      TxInput[]
  outputs     TxOutput[]

  @@index([txid])
  @@index([blockHeight])
  @@map("transaction")
}

model TxOutput {
  txNum        BigInt      @map("tx_num")
  vout         Int
  valueSats    BigInt      @map("value_sats")
  scriptPubkey Bytes       @map("script_pubkey") @db.ByteA
  scriptType   ScriptType  @map("script_type")
  address      String?
  transaction  Transaction @relation(fields: [txNum], references: [txNum], onDelete: Restrict)

  @@id([txNum, vout])
  @@map("tx_output")
}

model TxInput {
  txNum       BigInt      @map("tx_num")
  vin         Int
  /// Null for coinbase inputs. No FK to tx_output on purpose (insert cost on huge tables, rollback order).
  prevTxNum   BigInt?     @map("prev_tx_num")
  prevVout    Int?        @map("prev_vout")
  sequence    BigInt
  /// Coinbase data for coinbase inputs.
  scriptSig   Bytes       @map("script_sig") @db.ByteA
  witness     Bytes[]     @db.ByteA
  transaction Transaction @relation(fields: [txNum], references: [txNum], onDelete: Restrict)

  @@id([txNum, vin])
  @@unique([prevTxNum, prevVout], map: "tx_input_prevout_key")
  @@map("tx_input")
}

/// Single row (id = 1) written by the indexer.
model SyncState {
  id               Int      @id @default(1)
  network          String
  nodeTipHeight    Int      @map("node_tip_height")
  indexedTipHeight Int      @map("indexed_tip_height")
  updatedAt        DateTime @map("updated_at") @db.Timestamptz(3)

  @@map("sync_state")
}
```

Add to the root `package.json` `scripts`:
```json
"postinstall": "pnpm --filter @yabe/db generate",
"db:migrate": "pnpm --filter @yabe/db migrate:deploy"
```

Run: `pnpm install`
Expected: installs packages and generates the client in `packages/db/src/generated/`, which is gitignored.

- [ ] **Step 2: Generate the initial migration**

```bash
mkdir -p packages/db/prisma/migrations/20261001000000_init
pnpm --filter @yabe/db exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output prisma/migrations/20261001000000_init/migration.sql
cat >> packages/db/prisma/migrations/20261001000000_init/migration.sql <<'EOF'

-- sync_state holds exactly one row
ALTER TABLE "sync_state" ADD CONSTRAINT "sync_state_single_row" CHECK ("id" = 1);
EOF
printf '# Please do not edit this file manually\n# It should be added in your version-control system (e.g., Git)\nprovider = "postgresql"\n' > packages/db/prisma/migrations/migration_lock.toml
```
Expected: `migration.sql` contains `CREATE TABLE "block"`, `"transaction"`, `"tx_output"`, `"tx_input"` (with `"witness" BYTEA[]`), `"sync_state"`, the `CREATE UNIQUE INDEX "tx_input_prevout_key"` statement, and the CHECK constraint.

- [ ] **Step 3: Write failing tests for `tx_num`**

`packages/db/src/txnum.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { fromTxNum, MAX_TX_POSITION, toTxNum, txNumRangeForHeight } from './txnum.js'

describe('tx_num', () => {
  it('packs height and position into a bigint', () => {
    expect(toTxNum(800_000, 5)).toBe(838_860_800_005n)
    expect(toTxNum(0, 0)).toBe(0n)
  })

  it('round-trips', () => {
    for (const [height, position] of [
      [0, 0],
      [1, 1],
      [800_000, 5],
      [3_000_000, MAX_TX_POSITION],
    ] as const) {
      expect(fromTxNum(toTxNum(height, position))).toEqual({ height, position })
    }
  })

  it('does not overflow above 32 bits (JS << would)', () => {
    expect(toTxNum(4_096, 0)).toBe(4_294_967_296n)
  })

  it('orders by chain position', () => {
    expect(toTxNum(10, MAX_TX_POSITION)).toBeLessThan(toTxNum(11, 0))
  })

  it('rejects out-of-range input', () => {
    expect(() => toTxNum(-1, 0)).toThrow(RangeError)
    expect(() => toTxNum(1, MAX_TX_POSITION + 1)).toThrow(RangeError)
    expect(() => toTxNum(1.5, 0)).toThrow(RangeError)
  })

  it('gives the exclusive tx_num range of a block', () => {
    expect(txNumRangeForHeight(2)).toEqual({ start: toTxNum(2, 0), end: toTxNum(3, 0) })
  })
})
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `pnpm vitest run packages/db/src/txnum.test.ts`
Expected: FAIL, because `./txnum.js` doesn't exist.

- [ ] **Step 5: Implement `txnum.ts`, `client.ts` and `index.ts`**

`packages/db/src/txnum.ts`:
```ts
// tx_num packs a transaction's chain position into one 64-bit key: (block_height << 20) | position.
// Unlike Fulcrum/ElectrumX `TxNum` (a dense global counter) it has gaps, but it is computable without
// reading the database, deterministic across re-indexes, and a block is a contiguous range.
// Must use BigInt: JS `<<` is 32-bit and silently overflows.
export const TX_POSITION_BITS = 20n
export const MAX_TX_POSITION = 2 ** 20 - 1
const POSITION_MASK = (1n << TX_POSITION_BITS) - 1n

export const toTxNum = (height: number, position: number): bigint => {
  if (!Number.isInteger(height) || height < 0) throw new RangeError(`Invalid block height: ${height}`)
  if (!Number.isInteger(position) || position < 0 || position > MAX_TX_POSITION) {
    throw new RangeError(`Invalid transaction position: ${position}`)
  }
  return (BigInt(height) << TX_POSITION_BITS) | BigInt(position)
}

export const fromTxNum = (txNum: bigint): { height: number; position: number } => ({
  height: Number(txNum >> TX_POSITION_BITS),
  position: Number(txNum & POSITION_MASK),
})

export const txNumRangeForHeight = (height: number): { start: bigint; end: bigint } => ({
  start: toTxNum(height, 0),
  end: toTxNum(height + 1, 0),
})
```

`packages/db/src/client.ts`:
```ts
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client.js'

export const createPrismaClient = (databaseUrl: string): PrismaClient =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
```

`packages/db/src/index.ts`:
```ts
export * from './generated/client.js'
export * from './client.js'
export * from './txnum.js'
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm vitest run packages/db/src/txnum.test.ts && pnpm --filter @yabe/db typecheck`
Expected: PASS.

- [ ] **Step 7: Write the test utilities**

`packages/db/src/testing/postgres.ts`:
```ts
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { createPrismaClient } from '../client.js'
import type { PrismaClient } from '../generated/client.js'

const PACKAGE_DIR = fileURLToPath(new URL('../../', import.meta.url))
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js')

export interface TestDatabase {
  url: string
  prisma: PrismaClient
  stop(): Promise<void>
}

// Starts a throwaway Postgres and applies the real migrations to it.
export const startTestDatabase = async (): Promise<TestDatabase> => {
  const container = await new PostgreSqlContainer('postgres:18-alpine').start()
  const url = container.getConnectionUri()
  execFileSync(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], {
    cwd: PACKAGE_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  })
  const prisma = createPrismaClient(url)
  return {
    url,
    prisma,
    stop: async () => {
      await prisma.$disconnect()
      await container.stop()
    },
  }
}

export const resetDatabase = async (prisma: PrismaClient): Promise<void> => {
  await prisma.$executeRawUnsafe('TRUNCATE tx_input, tx_output, "transaction", block, sync_state')
}
```

`packages/db/src/testing/seed.ts`:
```ts
import { createHash } from 'node:crypto'
import type { PrismaClient } from '../generated/client.js'
import { toTxNum } from '../txnum.js'

const hash = (seed: string): Uint8Array<ArrayBuffer> => Uint8Array.from(createHash('sha256').update(seed).digest())
const fromHex = (hex: string): Uint8Array<ArrayBuffer> => Uint8Array.from(Buffer.from(hex, 'hex'))
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex')

export const SEED = {
  p2wpkhScript: `0014${'11'.repeat(20)}`,
  p2trScript: `5120${'22'.repeat(32)}`,
  opReturnScript: '6a0568656c6c6f',
  malformedScript: '4c',
  witness: [`3044${'33'.repeat(68)}`, `02${'44'.repeat(32)}`],
} as const

export interface SeededChain {
  blockHashes: [string, string, string]
  txids: { coinbase0: string; coinbase1: string; coinbase2: string; spend: string }
}

// Three blocks:
//   0: coinbase0
//   1: coinbase1 (50 BTC, p2wpkh)
//   2: coinbase2, plus `spend`, which spends coinbase1:0 into p2tr 30 BTC, p2wpkh 19.9999 BTC,
//      OP_RETURN 0 and a malformed script 0, paying a 10,000 sat fee
export const seedChain = async (prisma: PrismaClient): Promise<SeededChain> => {
  const blockHashes = [hash('block-0'), hash('block-1'), hash('block-2')] as const
  const txids = {
    coinbase0: hash('cb-0'),
    coinbase1: hash('cb-1'),
    coinbase2: hash('cb-2'),
    spend: hash('spend'),
  }
  const genesisTime = Date.UTC(2026, 0, 1)
  const block = (height: 0 | 1 | 2) => ({
    height,
    hash: blockHashes[height],
    prevHash: height === 0 ? null : blockHashes[(height - 1) as 0 | 1],
    merkleRoot: hash(`mr-${height}`),
    chainwork: fromHex(`${'00'.repeat(31)}0${height + 1}`),
    version: 0x20000000,
    bits: 0x207fffffn,
    nonce: BigInt(height),
    difficulty: 4.656542373906925e-10,
    time: new Date(genesisTime + height * 600_000),
    medianTime: new Date(genesisTime + height * 600_000),
    size: 300,
    strippedSize: 200,
    weight: 900,
    subsidySats: 5_000_000_000n,
  })
  await prisma.block.createMany({
    data: [
      { ...block(0), txCount: 1, totalFeeSats: 0n, totalOutSats: 0n },
      { ...block(1), txCount: 1, totalFeeSats: 0n, totalOutSats: 0n },
      { ...block(2), txCount: 2, totalFeeSats: 10_000n, totalOutSats: 4_999_990_000n },
    ],
  })

  const coinbase = (height: number, txid: Uint8Array<ArrayBuffer>, valueSats: bigint) => {
    const txNum = toTxNum(height, 0)
    return {
      tx: {
        txNum,
        txid,
        wtxid: null,
        blockHeight: height,
        version: 2n,
        locktime: 0n,
        size: 100,
        vsize: 100,
        weight: 400,
        inputCount: 1,
        outputCount: 1,
        isCoinbase: true,
        feeSats: null,
      },
      input: {
        txNum,
        vin: 0,
        prevTxNum: null,
        prevVout: null,
        sequence: 4_294_967_295n,
        scriptSig: fromHex('0101'),
        witness: [],
      },
      output: {
        txNum,
        vout: 0,
        valueSats,
        scriptPubkey: fromHex(SEED.p2wpkhScript),
        scriptType: 'witness_v0_keyhash' as const,
        address: `bcrt1qminer${height}`,
      },
    }
  }
  const coinbases = [
    coinbase(0, txids.coinbase0, 5_000_000_000n),
    coinbase(1, txids.coinbase1, 5_000_000_000n),
    coinbase(2, txids.coinbase2, 5_000_010_000n),
  ]
  const spendNum = toTxNum(2, 1)

  await prisma.transaction.createMany({
    data: [
      ...coinbases.map((c) => c.tx),
      {
        txNum: spendNum,
        txid: txids.spend,
        wtxid: hash('spend-w'),
        blockHeight: 2,
        version: 2n,
        locktime: 0n,
        size: 250,
        vsize: 141,
        weight: 562,
        inputCount: 1,
        outputCount: 4,
        isCoinbase: false,
        feeSats: 10_000n,
      },
    ],
  })
  await prisma.txOutput.createMany({
    data: [
      ...coinbases.map((c) => c.output),
      {
        txNum: spendNum,
        vout: 0,
        valueSats: 3_000_000_000n,
        scriptPubkey: fromHex(SEED.p2trScript),
        scriptType: 'witness_v1_taproot',
        address: 'bcrt1ptaproot',
      },
      {
        txNum: spendNum,
        vout: 1,
        valueSats: 1_999_990_000n,
        scriptPubkey: fromHex(SEED.p2wpkhScript),
        scriptType: 'witness_v0_keyhash',
        address: 'bcrt1qchange',
      },
      {
        txNum: spendNum,
        vout: 2,
        valueSats: 0n,
        scriptPubkey: fromHex(SEED.opReturnScript),
        scriptType: 'nulldata',
        address: null,
      },
      {
        txNum: spendNum,
        vout: 3,
        valueSats: 0n,
        scriptPubkey: fromHex(SEED.malformedScript),
        scriptType: 'nonstandard',
        address: null,
      },
    ],
  })
  await prisma.txInput.createMany({
    data: [
      ...coinbases.map((c) => c.input),
      {
        txNum: spendNum,
        vin: 0,
        prevTxNum: toTxNum(1, 0),
        prevVout: 0,
        sequence: 4_294_967_293n,
        scriptSig: new Uint8Array(),
        witness: SEED.witness.map(fromHex),
      },
    ],
  })
  await prisma.syncState.create({
    data: {
      id: 1,
      network: 'regtest',
      nodeTipHeight: 3,
      indexedTipHeight: 2,
      updatedAt: new Date('2026-01-01T00:30:00Z'),
    },
  })

  return {
    blockHashes: [toHex(blockHashes[0]), toHex(blockHashes[1]), toHex(blockHashes[2])],
    txids: {
      coinbase0: toHex(txids.coinbase0),
      coinbase1: toHex(txids.coinbase1),
      coinbase2: toHex(txids.coinbase2),
      spend: toHex(txids.spend),
    },
  }
}
```

`packages/db/src/testing/index.ts`:
```ts
export * from './postgres.js'
export * from './seed.js'
```

- [ ] **Step 8: Write the schema integration test**

`packages/db/src/schema.int.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase, seedChain, SEED, startTestDatabase, type TestDatabase } from './testing/index.js'
import { toTxNum } from './txnum.js'

let db: TestDatabase

beforeAll(async () => {
  db = await startTestDatabase()
})
beforeEach(async () => {
  await resetDatabase(db.prisma)
  await seedChain(db.prisma)
})
afterAll(async () => {
  await db.stop()
})

describe('schema', () => {
  it('round-trips bytea[] witness data and bigint amounts', async () => {
    const input = await db.prisma.txInput.findUniqueOrThrow({
      where: { txNum_vin: { txNum: toTxNum(2, 1), vin: 0 } },
    })
    expect(input.witness.map((w) => Buffer.from(w).toString('hex'))).toEqual(SEED.witness)
    const output = await db.prisma.txOutput.findUniqueOrThrow({
      where: { txNum_vout: { txNum: toTxNum(2, 1), vout: 0 } },
    })
    expect(output.valueSats).toBe(3_000_000_000n)
  })

  it('rejects a second input spending the same outpoint', async () => {
    await expect(
      db.prisma.txInput.create({
        data: {
          txNum: toTxNum(2, 0),
          vin: 1,
          prevTxNum: toTxNum(1, 0),
          prevVout: 0,
          sequence: 0n,
          scriptSig: new Uint8Array(),
          witness: [],
        },
      }),
    ).rejects.toThrow()
  })

  it('allows many coinbase inputs with NULL prevouts', async () => {
    const count = await db.prisma.txInput.count({ where: { prevTxNum: null } })
    expect(count).toBe(3)
  })

  it('keeps sync_state to a single row', async () => {
    await expect(
      db.prisma.syncState.create({
        data: { id: 2, network: 'regtest', nodeTipHeight: 0, indexedTipHeight: 0, updatedAt: new Date() },
      }),
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 9: Run the integration tests**

Run: `pnpm test:integration`
Expected: PASS (4 tests). Docker or Podman must be running; see Global Constraints.

- [ ] **Step 10: Run all checks and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add packages/db package.json pnpm-lock.yaml
git commit -m "feat(db): add Prisma schema, initial migration, tx_num helpers and test utilities"
```

---

### Task 5: Indexer block transform (pure functions)

**Files:**
- Create: `apps/indexer/package.json`, `tsconfig.json`, `tsconfig.build.json` (same as in Task 1)
- Create: `apps/indexer/src/transform/types.ts`, `src/transform/script-type.ts`, `src/transform/subsidy.ts`, `src/transform/block.ts`
- Create: `apps/indexer/test/fixtures.ts`
- Test: `apps/indexer/src/transform/subsidy.test.ts`, `apps/indexer/src/transform/block.test.ts`

**Interfaces:**
- Consumes: `hexToBytes`, `bytesToHex`, `btcToSats`, `Network` (`@yabe/shared`); `toTxNum`, `MAX_TX_POSITION`, `ScriptType` (`@yabe/db`); `RpcBlock`, `RpcTx` (`@yabe/bitcoin-rpc`).
- Produces:
  - Types: `Bytes`, `BlockRow`, `TransactionRow`, `OutputRow`, `InputRow`, `PendingInputRow` (an `InputRow` without `prevTxNum`, plus `prevTxid: string | null`), and `BlockData { block; transactions; outputs; inputs: PendingInputRow[] }`
  - `toScriptType(coreType: string): ScriptType` (throws `UnknownScriptTypeError`)
  - `subsidyFor(height: number, network: Network): bigint`
  - `transformBlock(rpc: RpcBlock, network: Network): BlockData` (throws `MissingFeeError` and `InvalidBlockError`)
  - Test fixtures in `apps/indexer/test/fixtures.ts`: `fakeHash(seed)`, `makeCoinbaseTx(height, opts?)`, `makeSpendTx(seed, spends, outputsBtc, feeBtc)`, `makeBlock({ height, prevHash, txs, seed? })`, `makeChain(length, seedPrefix?)`

- [ ] **Step 1: Create the app package**

`apps/indexer/package.json`:
```json
{
  "name": "@yabe/indexer",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.json",
    "start": "node dist/main.js",
    "dev": "tsx watch --env-file-if-exists=../../.env --conditions=@yabe/source src/main.ts"
  },
  "dependencies": {
    "@yabe/bitcoin-rpc": "workspace:*",
    "@yabe/db": "workspace:*",
    "@yabe/shared": "workspace:*"
  },
  "devDependencies": {
    "testcontainers": "^12.2.0"
  }
}
```
Copy both tsconfig files from `packages/shared`, then run `pnpm install`.

- [ ] **Step 2: Write the test fixtures**

`apps/indexer/test/fixtures.ts`:
```ts
import { createHash } from 'node:crypto'
import type { RpcBlock, RpcTx } from '@yabe/bitcoin-rpc'

export const fakeHash = (seed: string): string => createHash('sha256').update(seed).digest('hex')
const p2wpkh = (seed: string) => ({
  asm: '',
  hex: `0014${fakeHash(seed).slice(0, 40)}`,
  address: `bcrt1q${fakeHash(seed).slice(0, 38)}`,
  type: 'witness_v0_keyhash',
})

export const makeCoinbaseTx = (height: number, opts: { valueBtc?: number; seed?: string } = {}): RpcTx => {
  const seed = opts.seed ?? `coinbase-${height}`
  return {
    txid: fakeHash(seed),
    hash: fakeHash(seed),
    version: 2,
    size: 100,
    vsize: 100,
    weight: 400,
    locktime: 0,
    vin: [{ coinbase: `03${height.toString(16).padStart(6, '0')}`, sequence: 4_294_967_295 }],
    vout: [{ value: opts.valueBtc ?? 50, n: 0, scriptPubKey: p2wpkh(`${seed}-out`) }],
    hex: '',
  }
}

export const makeSpendTx = (
  seed: string,
  spends: { txid: string; vout: number; valueBtc: number }[],
  outputsBtc: number[],
  feeBtc: number,
): RpcTx => ({
  txid: fakeHash(seed),
  hash: fakeHash(`${seed}-witness`),
  version: 2,
  size: 222,
  vsize: 141,
  weight: 561,
  locktime: 0,
  vin: spends.map((s) => ({
    txid: s.txid,
    vout: s.vout,
    scriptSig: { asm: '', hex: '' },
    txinwitness: ['3044aa', '02bb'],
    sequence: 4_294_967_293,
    prevout: { generated: false, height: 1, value: s.valueBtc, scriptPubKey: p2wpkh(`${s.txid}-${s.vout}`) },
  })),
  vout: outputsBtc.map((value, n) => ({ value, n, scriptPubKey: p2wpkh(`${seed}-out-${n}`) })),
  fee: feeBtc,
  hex: '',
})

export const makeBlock = (opts: {
  height: number
  prevHash: string | undefined
  txs: RpcTx[]
  seed?: string
}): RpcBlock => ({
  hash: fakeHash(opts.seed ?? `block-${opts.height}`),
  confirmations: 1,
  height: opts.height,
  version: 0x20000000,
  versionHex: '20000000',
  merkleroot: fakeHash(`merkle-${opts.seed ?? opts.height}`),
  time: 1_767_225_600 + opts.height * 600,
  mediantime: 1_767_225_600 + opts.height * 600 - 300,
  nonce: 42,
  bits: '207fffff',
  difficulty: 4.656542373906925e-10,
  chainwork: `${'00'.repeat(31)}02`,
  nTx: opts.txs.length,
  ...(opts.prevHash === undefined ? {} : { previousblockhash: opts.prevHash }),
  strippedsize: 200,
  size: 300,
  weight: 900,
  tx: opts.txs,
})

// A linear chain of coinbase-only blocks; `seedPrefix` lets tests build competing branches.
export const makeChain = (length: number, seedPrefix = 'main', startHeight = 0, prevHash?: string): RpcBlock[] => {
  const blocks: RpcBlock[] = []
  let prev = prevHash
  for (let height = startHeight; height < startHeight + length; height++) {
    const block = makeBlock({
      height,
      prevHash: prev,
      txs: [makeCoinbaseTx(height, { seed: `${seedPrefix}-cb-${height}` })],
      seed: `${seedPrefix}-${height}`,
    })
    blocks.push(block)
    prev = block.hash
  }
  return blocks
}
```

- [ ] **Step 3: Write the failing tests**

`apps/indexer/src/transform/subsidy.test.ts`:
```ts
import { expect, it } from 'vitest'
import { subsidyFor } from './subsidy.js'

it.each([
  [0, 'main', 5_000_000_000n],
  [209_999, 'main', 5_000_000_000n],
  [210_000, 'main', 2_500_000_000n],
  [840_000, 'main', 312_500_000n],
  [210_000, 'signet', 2_500_000_000n],
  [149, 'regtest', 5_000_000_000n],
  [150, 'regtest', 2_500_000_000n],
  [64 * 210_000, 'main', 0n],
] as const)('subsidy at height %s on %s is %s sats', (height, network, sats) => {
  expect(subsidyFor(height, network)).toBe(sats)
})
```

`apps/indexer/src/transform/block.test.ts`:
```ts
import { bytesToHex } from '@yabe/shared'
import { toTxNum } from '@yabe/db'
import { describe, expect, it } from 'vitest'
import { fakeHash, makeBlock, makeCoinbaseTx, makeSpendTx } from '../../test/fixtures.js'
import { InvalidBlockError, MissingFeeError, transformBlock } from './block.js'
import { toScriptType, UnknownScriptTypeError } from './script-type.js'

describe('transformBlock', () => {
  it('maps a genesis-style block with only a coinbase', () => {
    const data = transformBlock(makeBlock({ height: 0, prevHash: undefined, txs: [makeCoinbaseTx(0)] }), 'regtest')

    expect(data.block).toMatchObject({
      height: 0,
      prevHash: null,
      bits: 0x207fffffn,
      nonce: 42n,
      txCount: 1,
      subsidySats: 5_000_000_000n,
      totalFeeSats: 0n,
      totalOutSats: 0n,
      time: new Date(1_767_225_600 * 1000),
    })
    expect(data.transactions).toHaveLength(1)
    expect(data.transactions[0]).toMatchObject({ txNum: 0n, isCoinbase: true, feeSats: null, wtxid: null })
    expect(data.inputs[0]).toMatchObject({ prevTxid: null, prevVout: null, sequence: 4_294_967_295n })
    expect(bytesToHex(data.inputs[0]!.scriptSig)).toBe('03000000')
    expect(data.outputs[0]).toMatchObject({ valueSats: 5_000_000_000n, scriptType: 'witness_v0_keyhash' })
  })

  it('maps spends, fees, totals and tx_num positions', () => {
    const funding = fakeHash('funding')
    const spend = makeSpendTx('spend', [{ txid: funding, vout: 1, valueBtc: 2 }], [1.5, 0.4999], 0.0001)
    const coinbase = makeCoinbaseTx(7, { valueBtc: 50.0001 })
    const data = transformBlock(makeBlock({ height: 7, prevHash: fakeHash('prev'), txs: [coinbase, spend] }), 'main')

    expect(data.transactions.map((t) => t.txNum)).toEqual([toTxNum(7, 0), toTxNum(7, 1)])
    expect(data.transactions[1]).toMatchObject({
      isCoinbase: false,
      feeSats: 10_000n,
      inputCount: 1,
      outputCount: 2,
      version: 2n,
    })
    expect(bytesToHex(data.transactions[1]!.wtxid!)).toBe(fakeHash('spend-witness'))
    expect(data.block.totalFeeSats).toBe(10_000n)
    expect(data.block.totalOutSats).toBe(199_990_000n)
    expect(bytesToHex(data.block.prevHash!)).toBe(fakeHash('prev'))

    const input = data.inputs.find((i) => i.txNum === toTxNum(7, 1))!
    expect(input).toMatchObject({ vin: 0, prevTxid: funding, prevVout: 1, sequence: 4_294_967_293n })
    expect(input.witness.map(bytesToHex)).toEqual(['3044aa', '02bb'])
    expect(input.scriptSig).toHaveLength(0)
  })

  it('stores a null address when the node reports none', () => {
    const coinbase = makeCoinbaseTx(1)
    coinbase.vout.push({ value: 0, n: 1, scriptPubKey: { asm: 'OP_RETURN', hex: '6a', type: 'nulldata' } })
    const data = transformBlock(makeBlock({ height: 1, prevHash: fakeHash('p'), txs: [coinbase] }), 'main')
    expect(data.outputs[1]).toMatchObject({ address: null, scriptType: 'nulldata', valueSats: 0n })
  })

  it('fails when a non-coinbase transaction has no fee (pruned node without undo data)', () => {
    const spend = makeSpendTx('s', [{ txid: fakeHash('f'), vout: 0, valueBtc: 1 }], [0.9], 0.1)
    delete spend.fee
    const block = makeBlock({ height: 3, prevHash: fakeHash('p'), txs: [makeCoinbaseTx(3), spend] })
    expect(() => transformBlock(block, 'main')).toThrow(MissingFeeError)
  })

  it('fails when the coinbase is not the first transaction', () => {
    const spend = makeSpendTx('s', [{ txid: fakeHash('f'), vout: 0, valueBtc: 1 }], [0.9], 0.1)
    const block = makeBlock({ height: 3, prevHash: fakeHash('p'), txs: [spend, makeCoinbaseTx(3)] })
    expect(() => transformBlock(block, 'main')).toThrow(InvalidBlockError)
  })
})

describe('toScriptType', () => {
  it('accepts every Bitcoin Core output type', () => {
    for (const type of [
      'nonstandard',
      'pubkey',
      'pubkeyhash',
      'scripthash',
      'multisig',
      'nulldata',
      'anchor',
      'witness_v0_keyhash',
      'witness_v0_scripthash',
      'witness_v1_taproot',
      'witness_unknown',
    ]) {
      expect(toScriptType(type)).toBe(type)
    }
  })

  it('fails loudly on a type this version does not know', () => {
    expect(() => toScriptType('witness_v2_future')).toThrow(UnknownScriptTypeError)
  })
})
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `pnpm vitest run apps/indexer`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 5: Implement**

`apps/indexer/src/transform/types.ts`:
```ts
import type { ScriptType } from '@yabe/db'

export type Bytes = Uint8Array<ArrayBuffer>

export interface BlockRow {
  height: number
  hash: Bytes
  prevHash: Bytes | null
  merkleRoot: Bytes
  chainwork: Bytes
  version: number
  bits: bigint
  nonce: bigint
  difficulty: number
  time: Date
  medianTime: Date
  size: number
  strippedSize: number
  weight: number
  txCount: number
  subsidySats: bigint
  totalFeeSats: bigint
  totalOutSats: bigint
}

export interface TransactionRow {
  txNum: bigint
  txid: Bytes
  wtxid: Bytes | null
  blockHeight: number
  version: bigint
  locktime: bigint
  size: number
  vsize: number
  weight: number
  inputCount: number
  outputCount: number
  isCoinbase: boolean
  feeSats: bigint | null
}

export interface OutputRow {
  txNum: bigint
  vout: number
  valueSats: bigint
  scriptPubkey: Bytes
  scriptType: ScriptType
  address: string | null
}

export interface InputRow {
  txNum: bigint
  vin: number
  prevTxNum: bigint | null
  prevVout: number | null
  sequence: bigint
  scriptSig: Bytes
  witness: Bytes[]
}

// An input before its previous transaction's txid has been resolved to a tx_num (needs the database).
export interface PendingInputRow extends Omit<InputRow, 'prevTxNum'> {
  prevTxid: string | null
}

export interface BlockData {
  block: BlockRow
  transactions: TransactionRow[]
  outputs: OutputRow[]
  inputs: PendingInputRow[]
}
```

`apps/indexer/src/transform/script-type.ts`:
```ts
import { ScriptType } from '@yabe/db'

export class UnknownScriptTypeError extends Error {
  override name = 'UnknownScriptTypeError'
}

const KNOWN = new Set<string>(Object.values(ScriptType))

// Fails instead of guessing: a new output type from a newer Bitcoin Core needs a schema update.
export const toScriptType = (coreType: string): ScriptType => {
  if (!KNOWN.has(coreType)) {
    throw new UnknownScriptTypeError(`Unknown scriptPubKey type '${coreType}'; update the script_type enum`)
  }
  return coreType as ScriptType
}
```

`apps/indexer/src/transform/subsidy.ts`:
```ts
import type { Network } from '@yabe/shared'

const HALVING_INTERVAL: Record<Network, number> = {
  main: 210_000,
  test: 210_000,
  testnet4: 210_000,
  signet: 210_000,
  regtest: 150,
}
const INITIAL_SUBSIDY_SATS = 5_000_000_000n

export const subsidyFor = (height: number, network: Network): bigint => {
  const halvings = Math.floor(height / HALVING_INTERVAL[network])
  return halvings >= 64 ? 0n : INITIAL_SUBSIDY_SATS >> BigInt(halvings)
}
```

`apps/indexer/src/transform/block.ts`:
```ts
import type { RpcBlock, RpcTx } from '@yabe/bitcoin-rpc'
import { MAX_TX_POSITION, toTxNum } from '@yabe/db'
import { btcToSats, hexToBytes, type Network } from '@yabe/shared'
import { toScriptType } from './script-type.js'
import { subsidyFor } from './subsidy.js'
import type { BlockData, OutputRow, PendingInputRow, TransactionRow } from './types.js'

export class MissingFeeError extends Error {
  override name = 'MissingFeeError'
}
export class InvalidBlockError extends Error {
  override name = 'InvalidBlockError'
}

// Pure mapping from `getblock <hash> 3` output to database rows. No I/O.
export const transformBlock = (rpc: RpcBlock, network: Network): BlockData => {
  if (rpc.tx.length === 0 || rpc.tx.length > MAX_TX_POSITION + 1) {
    throw new InvalidBlockError(`Block ${rpc.height} has ${rpc.tx.length} transactions`)
  }

  const transactions: TransactionRow[] = []
  const outputs: OutputRow[] = []
  const inputs: PendingInputRow[] = []
  let totalFeeSats = 0n
  let totalOutSats = 0n

  rpc.tx.forEach((tx: RpcTx, position) => {
    const txNum = toTxNum(rpc.height, position)
    const isCoinbase = tx.vin[0]?.coinbase !== undefined
    if (isCoinbase !== (position === 0)) {
      throw new InvalidBlockError(`Block ${rpc.height}: coinbase must be exactly the first transaction (tx ${tx.txid})`)
    }
    if (!isCoinbase && tx.fee === undefined) {
      throw new MissingFeeError(
        `Block ${rpc.height}: tx ${tx.txid} has no fee; the node must be non-pruned with undo data (getblock verbosity 3)`,
      )
    }
    const feeSats = tx.fee === undefined ? null : btcToSats(tx.fee)
    if (feeSats !== null) totalFeeSats += feeSats

    transactions.push({
      txNum,
      txid: hexToBytes(tx.txid),
      wtxid: tx.hash === tx.txid ? null : hexToBytes(tx.hash),
      blockHeight: rpc.height,
      version: BigInt(tx.version),
      locktime: BigInt(tx.locktime),
      size: tx.size,
      vsize: tx.vsize,
      weight: tx.weight,
      inputCount: tx.vin.length,
      outputCount: tx.vout.length,
      isCoinbase,
      feeSats,
    })

    for (const out of tx.vout) {
      const valueSats = btcToSats(out.value)
      if (!isCoinbase) totalOutSats += valueSats
      outputs.push({
        txNum,
        vout: out.n,
        valueSats,
        scriptPubkey: hexToBytes(out.scriptPubKey.hex),
        scriptType: toScriptType(out.scriptPubKey.type),
        address: out.scriptPubKey.address ?? null,
      })
    }

    tx.vin.forEach((input, vin) => {
      inputs.push({
        txNum,
        vin,
        prevTxid: input.txid ?? null,
        prevVout: input.vout ?? null,
        sequence: BigInt(input.sequence),
        scriptSig: hexToBytes(input.coinbase ?? input.scriptSig?.hex ?? ''),
        witness: (input.txinwitness ?? []).map(hexToBytes),
      })
    })
  })

  return {
    block: {
      height: rpc.height,
      hash: hexToBytes(rpc.hash),
      prevHash: rpc.previousblockhash ? hexToBytes(rpc.previousblockhash) : null,
      merkleRoot: hexToBytes(rpc.merkleroot),
      chainwork: hexToBytes(rpc.chainwork),
      version: rpc.version,
      bits: BigInt(Number.parseInt(rpc.bits, 16)),
      nonce: BigInt(rpc.nonce),
      difficulty: rpc.difficulty,
      time: new Date(rpc.time * 1000),
      medianTime: new Date(rpc.mediantime * 1000),
      size: rpc.size,
      strippedSize: rpc.strippedsize,
      weight: rpc.weight,
      txCount: rpc.nTx,
      subsidySats: subsidyFor(rpc.height, network),
      totalFeeSats,
      // Sum of non-coinbase outputs — matches `getblockstats.total_out`.
      totalOutSats,
    },
    transactions,
    outputs,
    inputs,
  }
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm vitest run apps/indexer && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/indexer pnpm-lock.yaml
git commit -m "feat(indexer): add pure block transform from getblock verbosity 3 to rows"
```

---

### Task 6: Indexer block store (writes, prevout resolution, rollback)

**Files:**
- Create: `apps/indexer/src/store/chunk.ts`, `src/store/resolve-inputs.ts`, `src/store/block-store.ts`
- Test: `apps/indexer/src/store/resolve-inputs.test.ts`, `apps/indexer/src/store/block-store.int.test.ts`

**Interfaces:**
- Consumes: `BlockData`, `InputRow`, `Bytes` (Task 5); `PrismaClient`, `Prisma`, `toTxNum` (`@yabe/db`); `startTestDatabase`, `resetDatabase` (`@yabe/db/testing`); `bytesToHex`, `hexToBytes`, `Network` (`@yabe/shared`); the fixtures from Task 5.
- Produces:
  - `chunk<T>(items: readonly T[], size: number): T[][]`
  - `type TxNumLookup = (txids: Bytes[]) => Promise<Map<string, bigint>>`
  - `resolveInputs(data: BlockData, lookup: TxNumLookup): Promise<InputRow[]>` (throws `UnresolvedPrevoutError`)
  - `interface StoredTip { height: number; hash: string }`
  - `interface SyncStore` with:
    - `getTip(): Promise<StoredTip | null>`
    - `getHashAt(height: number): Promise<string | null>`
    - `writeBlock(data: BlockData, nodeTipHeight: number): Promise<void>`
    - `rollbackFrom(height: number): Promise<void>`
    - `recordNodeTip(nodeTipHeight: number): Promise<void>`
  - `class BlockStore implements SyncStore`, constructed as `new BlockStore(prisma, network)`

- [ ] **Step 1: Write failing unit tests for `resolveInputs`**

`apps/indexer/src/store/resolve-inputs.test.ts`:
```ts
import { toTxNum } from '@yabe/db'
import { describe, expect, it, vi } from 'vitest'
import { fakeHash, makeBlock, makeCoinbaseTx, makeSpendTx } from '../../test/fixtures.js'
import { transformBlock } from '../transform/block.js'
import { resolveInputs, UnresolvedPrevoutError, type TxNumLookup } from './resolve-inputs.js'

const external = fakeHash('external')
const coinbase = makeCoinbaseTx(5)
const spendExternal = makeSpendTx('a', [{ txid: external, vout: 2, valueBtc: 1 }], [0.9], 0.1)
const spendInBlock = makeSpendTx('b', [{ txid: spendExternal.txid, vout: 0, valueBtc: 0.9 }], [0.8], 0.1)
const data = transformBlock(
  makeBlock({ height: 5, prevHash: fakeHash('p'), txs: [coinbase, spendExternal, spendInBlock] }),
  'regtest',
)

describe('resolveInputs', () => {
  it('resolves coinbase, in-block and external spends with one lookup', async () => {
    const lookup = vi.fn<TxNumLookup>(async () => new Map([[external, toTxNum(3, 4)]]))
    const inputs = await resolveInputs(data, lookup)

    expect(lookup).toHaveBeenCalledTimes(1)
    expect(lookup.mock.calls[0]![0].map((b) => Buffer.from(b).toString('hex'))).toEqual([external])
    expect(inputs.map((i) => [i.txNum, i.prevTxNum, i.prevVout])).toEqual([
      [toTxNum(5, 0), null, null],
      [toTxNum(5, 1), toTxNum(3, 4), 2],
      [toTxNum(5, 2), toTxNum(5, 1), 0],
    ])
    expect(inputs[0]).not.toHaveProperty('prevTxid')
  })

  it('fails when a previous transaction is not indexed', async () => {
    await expect(resolveInputs(data, async () => new Map())).rejects.toThrow(UnresolvedPrevoutError)
  })
})
```

- [ ] **Step 2: Write the failing integration tests for `BlockStore`**

`apps/indexer/src/store/block-store.int.test.ts`:
```ts
import { toTxNum } from '@yabe/db'
import { resetDatabase, startTestDatabase, type TestDatabase } from '@yabe/db/testing'
import { bytesToHex, hexToBytes } from '@yabe/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fakeHash, makeBlock, makeChain, makeCoinbaseTx, makeSpendTx } from '../../test/fixtures.js'
import { transformBlock } from '../transform/block.js'
import { BlockStore } from './block-store.js'
import { UnresolvedPrevoutError } from './resolve-inputs.js'

let db: TestDatabase
let store: BlockStore

beforeAll(async () => {
  db = await startTestDatabase()
  store = new BlockStore(db.prisma, 'regtest')
})
beforeEach(async () => {
  await resetDatabase(db.prisma)
})
afterAll(async () => {
  await db.stop()
})

const writeChain = async (length: number) => {
  const chain = makeChain(length)
  for (const block of chain) await store.writeBlock(transformBlock(block, 'regtest'), length - 1)
  return chain
}

describe('BlockStore', () => {
  it('starts empty', async () => {
    expect(await store.getTip()).toBeNull()
  })

  it('writes blocks atomically and tracks the tip and sync state', async () => {
    const chain = await writeChain(3)
    expect(await store.getTip()).toEqual({ height: 2, hash: chain[2]!.hash })
    expect(await store.getHashAt(1)).toBe(chain[1]!.hash)
    expect(await store.getHashAt(9)).toBeNull()
    expect(await db.prisma.syncState.findUnique({ where: { id: 1 } })).toMatchObject({
      network: 'regtest',
      nodeTipHeight: 2,
      indexedTipHeight: 2,
    })
  })

  it('links inputs to previous outputs across blocks', async () => {
    const chain = await writeChain(2)
    const funding = chain[1]!.tx[0]!
    const spend = makeSpendTx('spend', [{ txid: funding.txid, vout: 0, valueBtc: 50 }], [49.9], 0.1)
    await store.writeBlock(
      transformBlock(makeBlock({ height: 2, prevHash: chain[1]!.hash, txs: [makeCoinbaseTx(2), spend] }), 'regtest'),
      2,
    )
    const input = await db.prisma.txInput.findUniqueOrThrow({
      where: { txNum_vin: { txNum: toTxNum(2, 1), vin: 0 } },
    })
    expect(input).toMatchObject({ prevTxNum: toTxNum(1, 0), prevVout: 0 })
  })

  it('writes nothing when a prevout cannot be resolved', async () => {
    const chain = await writeChain(1)
    const orphanSpend = makeSpendTx('o', [{ txid: fakeHash('missing'), vout: 0, valueBtc: 1 }], [0.9], 0.1)
    const block = makeBlock({ height: 1, prevHash: chain[0]!.hash, txs: [makeCoinbaseTx(1), orphanSpend] })
    await expect(store.writeBlock(transformBlock(block, 'regtest'), 1)).rejects.toThrow(UnresolvedPrevoutError)
    expect(await db.prisma.block.count()).toBe(1)
    expect(await db.prisma.transaction.count()).toBe(1)
  })

  it('resolves duplicate (BIP30) txids to the newest transaction', async () => {
    const chain = makeChain(2)
    // Block 1's coinbase reuses block 0's coinbase txid, as happened on mainnet at heights 91842/91880.
    chain[1]!.tx[0] = makeCoinbaseTx(1, { seed: 'main-cb-0' })
    for (const block of chain) await store.writeBlock(transformBlock(block, 'regtest'), 2)
    const dupTxid = chain[0]!.tx[0]!.txid
    const spend = makeSpendTx('s', [{ txid: dupTxid, vout: 0, valueBtc: 50 }], [49], 1)
    await store.writeBlock(
      transformBlock(makeBlock({ height: 2, prevHash: chain[1]!.hash, txs: [makeCoinbaseTx(2), spend] }), 'regtest'),
      2,
    )
    expect(await db.prisma.transaction.count({ where: { txid: hexToBytes(dupTxid) } })).toBe(2)
    const input = await db.prisma.txInput.findUniqueOrThrow({
      where: { txNum_vin: { txNum: toTxNum(2, 1), vin: 0 } },
    })
    expect(input.prevTxNum).toBe(toTxNum(1, 0))
  })

  it('writes a block with more inputs and outputs than one statement can bind', async () => {
    const chain = await writeChain(1)
    const coinbase = makeCoinbaseTx(1)
    coinbase.vout = Array.from({ length: 12_000 }, (_, n) => ({
      value: 0.0001,
      n,
      scriptPubKey: { asm: '', hex: `0014${fakeHash(`o${n}`).slice(0, 40)}`, type: 'witness_v0_keyhash' },
    }))
    const spends = Array.from({ length: 6_000 }, (_, n) => ({ txid: coinbase.txid, vout: n, valueBtc: 0.0001 }))
    const bigSpend = makeSpendTx('big', spends, [0.5], 0.1)
    const block = makeBlock({ height: 1, prevHash: chain[0]!.hash, txs: [coinbase, bigSpend] })

    await store.writeBlock(transformBlock(block, 'regtest'), 1)
    expect(await db.prisma.txOutput.count({ where: { txNum: toTxNum(1, 0) } })).toBe(12_000)
    expect(await db.prisma.txInput.count({ where: { txNum: toTxNum(1, 1) } })).toBe(6_000)
  })

  it('rolls back every row at or above a height', async () => {
    await writeChain(4)
    await store.rollbackFrom(2)
    expect((await store.getTip())?.height).toBe(1)
    expect(await db.prisma.transaction.count({ where: { txNum: { gte: toTxNum(2, 0) } } })).toBe(0)
    expect(await db.prisma.txOutput.count({ where: { txNum: { gte: toTxNum(2, 0) } } })).toBe(0)
    expect(await db.prisma.txInput.count({ where: { txNum: { gte: toTxNum(2, 0) } } })).toBe(0)
    expect((await db.prisma.syncState.findUniqueOrThrow({ where: { id: 1 } })).indexedTipHeight).toBe(1)
  })

  it('records the node tip without changing the indexed tip', async () => {
    await writeChain(2)
    await store.recordNodeTip(10)
    expect(await db.prisma.syncState.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({
      nodeTipHeight: 10,
      indexedTipHeight: 1,
    })
  })

  it('stores hashes in display order', async () => {
    const chain = await writeChain(1)
    const row = await db.prisma.block.findUniqueOrThrow({ where: { height: 0 } })
    expect(bytesToHex(row.hash)).toBe(chain[0]!.hash)
  })
})
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm vitest run apps/indexer/src/store`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 4: Implement**

`apps/indexer/src/store/chunk.ts`:
```ts
export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
```

`apps/indexer/src/store/resolve-inputs.ts`:
```ts
import { bytesToHex, hexToBytes } from '@yabe/shared'
import type { BlockData, Bytes, InputRow } from '../transform/types.js'

// Maps txid (hex) → tx_num. When a txid is duplicated (BIP30), it must return the newest tx_num.
export type TxNumLookup = (txids: Bytes[]) => Promise<Map<string, bigint>>

export class UnresolvedPrevoutError extends Error {
  override name = 'UnresolvedPrevoutError'
}

export const resolveInputs = async (data: BlockData, lookup: TxNumLookup): Promise<InputRow[]> => {
  // Transactions in this block take precedence: a spend of an earlier tx in the same block, and the
  // newest occurrence of a duplicated txid.
  const inBlock = new Map<string, bigint>()
  for (const tx of data.transactions) inBlock.set(bytesToHex(tx.txid), tx.txNum)

  const external = [
    ...new Set(data.inputs.flatMap((i) => (i.prevTxid !== null && !inBlock.has(i.prevTxid) ? [i.prevTxid] : []))),
  ]
  const found = external.length > 0 ? await lookup(external.map(hexToBytes)) : new Map<string, bigint>()

  return data.inputs.map(({ prevTxid, ...input }) => {
    if (prevTxid === null) return { ...input, prevTxNum: null }
    const prevTxNum = inBlock.get(prevTxid) ?? found.get(prevTxid)
    if (prevTxNum === undefined) {
      throw new UnresolvedPrevoutError(
        `Input ${input.txNum}:${input.vin} spends ${prevTxid}:${input.prevVout}, which is not indexed`,
      )
    }
    return { ...input, prevTxNum }
  })
}
```

`apps/indexer/src/store/block-store.ts`:
```ts
import { toTxNum, type Prisma, type PrismaClient } from '@yabe/db'
import { bytesToHex, type Network } from '@yabe/shared'
import type { BlockData } from '../transform/types.js'
import { chunk } from './chunk.js'
import { resolveInputs, type TxNumLookup } from './resolve-inputs.js'

// Postgres allows 65,535 bind parameters per statement; 5,000 rows × ≤7 columns stays well below it.
const ROWS_PER_STATEMENT = 5_000

export interface StoredTip {
  height: number
  hash: string
}

export interface SyncStore {
  getTip(): Promise<StoredTip | null>
  getHashAt(height: number): Promise<string | null>
  writeBlock(data: BlockData, nodeTipHeight: number): Promise<void>
  rollbackFrom(height: number): Promise<void>
  recordNodeTip(nodeTipHeight: number): Promise<void>
}

type Db = PrismaClient | Prisma.TransactionClient

const txNumLookup =
  (db: Db): TxNumLookup =>
  async (txids) => {
    const found = new Map<string, bigint>()
    for (const part of chunk(txids, ROWS_PER_STATEMENT)) {
      const rows = await db.transaction.findMany({
        where: { txid: { in: part } },
        select: { txid: true, txNum: true },
        orderBy: { txNum: 'asc' },
      })
      // Ascending order, so the newest duplicate (BIP30) is set last and wins.
      for (const row of rows) found.set(bytesToHex(row.txid), row.txNum)
    }
    return found
  }

export class BlockStore implements SyncStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly network: Network,
    private readonly transactionTimeoutMs = 120_000,
  ) {}

  async getTip(): Promise<StoredTip | null> {
    const row = await this.prisma.block.findFirst({
      orderBy: { height: 'desc' },
      select: { height: true, hash: true },
    })
    return row ? { height: row.height, hash: bytesToHex(row.hash) } : null
  }

  async getHashAt(height: number): Promise<string | null> {
    const row = await this.prisma.block.findUnique({ where: { height }, select: { hash: true } })
    return row ? bytesToHex(row.hash) : null
  }

  async writeBlock(data: BlockData, nodeTipHeight: number): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const inputs = await resolveInputs(data, txNumLookup(tx))
        await tx.block.create({ data: data.block })
        for (const part of chunk(data.transactions, ROWS_PER_STATEMENT)) await tx.transaction.createMany({ data: part })
        for (const part of chunk(data.outputs, ROWS_PER_STATEMENT)) await tx.txOutput.createMany({ data: part })
        for (const part of chunk(inputs, ROWS_PER_STATEMENT)) await tx.txInput.createMany({ data: part })
        await this.upsertSyncState(tx, nodeTipHeight, data.block.height)
      },
      { timeout: this.transactionTimeoutMs, maxWait: 10_000 },
    )
  }

  // Removes every block at or above `height`, children first (FKs have no cascades).
  async rollbackFrom(height: number): Promise<void> {
    const fromTxNum = toTxNum(height, 0)
    await this.prisma.$transaction(
      async (tx) => {
        await tx.txInput.deleteMany({ where: { txNum: { gte: fromTxNum } } })
        await tx.txOutput.deleteMany({ where: { txNum: { gte: fromTxNum } } })
        await tx.transaction.deleteMany({ where: { txNum: { gte: fromTxNum } } })
        await tx.block.deleteMany({ where: { height: { gte: height } } })
        await tx.syncState.updateMany({ data: { indexedTipHeight: height - 1, updatedAt: new Date() } })
      },
      { timeout: this.transactionTimeoutMs, maxWait: 10_000 },
    )
  }

  async recordNodeTip(nodeTipHeight: number): Promise<void> {
    const tip = await this.getTip()
    await this.upsertSyncState(this.prisma, nodeTipHeight, tip?.height ?? -1)
  }

  private async upsertSyncState(db: Db, nodeTipHeight: number, indexedTipHeight: number): Promise<void> {
    const state = { network: this.network, nodeTipHeight, indexedTipHeight, updatedAt: new Date() }
    await db.syncState.upsert({ where: { id: 1 }, create: { id: 1, ...state }, update: state })
  }
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm vitest run apps/indexer/src/store`
Expected: PASS (2 unit tests and 9 integration tests).

- [ ] **Step 6: Run all checks and commit**

Run: `pnpm typecheck && pnpm lint`

```bash
git add apps/indexer
git commit -m "feat(indexer): add Prisma block store with batched writes, prevout resolution and rollback"
```

---

### Task 7: Sync loop with reorg handling, prefetch, retry and node check

**Files:**
- Create: `apps/indexer/src/sync/backoff.ts`, `src/sync/syncer.ts`, `src/sync/node-check.ts`
- Create: `apps/indexer/test/fakes.ts`
- Test: `apps/indexer/src/sync/backoff.test.ts`, `src/sync/syncer.test.ts`, `src/sync/node-check.test.ts`

**Interfaces:**
- Consumes: `SyncStore`, `StoredTip` (Task 6); `transformBlock`, `BlockData` (Task 5); `BitcoinRpcClient`, `RpcError`, `RpcBlock`, `RpcBlockchainInfo` (`@yabe/bitcoin-rpc`); `Logger`, `Network`, `createLogger`, `bytesToHex` (`@yabe/shared`); `makeChain` (Task 5 fixtures).
- Produces:
  - `class Backoff(opts: { initialMs: number; maxMs: number })` with `next(): number` and `reset(): void`
  - `type ChainSource = Pick<BitcoinRpcClient, 'getBlockCount' | 'getBlockHash' | 'getBlock'>`
  - `class ReorgTooDeepError extends Error`
  - `interface SyncerOptions` with: `chain`, `store`, `network`, `logger`, `reorgMaxDepth`, `prefetchBlocks`, `pollIntervalMs`, and optional `backoff`
  - `class Syncer(opts)` with `syncOnce(signal?: AbortSignal): Promise<number>` and `run(signal: AbortSignal): Promise<void>`
  - `class NodeMismatchError extends Error`
  - `waitForNode(rpc: Pick<BitcoinRpcClient, 'getBlockchainInfo'>, network: Network, logger: Logger, signal: AbortSignal, backoff?: Backoff): Promise<RpcBlockchainInfo>`

- [ ] **Step 1: Write the fakes**

`apps/indexer/test/fakes.ts`:
```ts
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
```

- [ ] **Step 2: Write the failing tests**

`apps/indexer/src/sync/backoff.test.ts`:
```ts
import { expect, it } from 'vitest'
import { Backoff } from './backoff.js'

it('doubles up to the cap and resets', () => {
  const backoff = new Backoff({ initialMs: 100, maxMs: 500 })
  expect([backoff.next(), backoff.next(), backoff.next(), backoff.next()]).toEqual([100, 200, 400, 500])
  backoff.reset()
  expect(backoff.next()).toBe(100)
})
```

`apps/indexer/src/sync/syncer.test.ts`:
```ts
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
```

`apps/indexer/src/sync/node-check.test.ts`:
```ts
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
  await expect(waitForNode(rpc, 'signet', logger, new AbortController().signal, fast())).resolves.toMatchObject({
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
  await expect(waitForNode(rpc, 'signet', logger, new AbortController().signal, fast())).rejects.toThrow(/pruned/)
})
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm vitest run apps/indexer/src/sync`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 4: Implement**

`apps/indexer/src/sync/backoff.ts`:
```ts
export class Backoff {
  private attempt = 0

  constructor(private readonly opts: { initialMs: number; maxMs: number }) {}

  next(): number {
    const delay = Math.min(this.opts.maxMs, this.opts.initialMs * 2 ** this.attempt)
    this.attempt++
    return delay
  }

  reset(): void {
    this.attempt = 0
  }
}
```

`apps/indexer/src/sync/syncer.ts`:
```ts
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
          { height: block.height, hash: block.hash, txCount: block.nTx, ms: Math.round(performance.now() - started) },
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
```

`apps/indexer/src/sync/node-check.ts`:
```ts
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
      throw new NodeMismatchError('Node is pruned; YABE needs a non-pruned node (getblock verbosity 3 needs undo data)')
    }
    return info
  }
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm vitest run apps/indexer/src/sync && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/indexer
git commit -m "feat(indexer): add sync loop with reorg rollback, prefetch, backoff and node check"
```

---

### Task 8: Indexer entrypoint and end-to-end regtest tests

**Files:**
- Create: `apps/indexer/src/config.ts`, `apps/indexer/src/main.ts`, `apps/indexer/test/bitcoind.ts`
- Test: `apps/indexer/src/config.test.ts`, `apps/indexer/test/regtest.int.test.ts`

**Interfaces:**
- Consumes: `Syncer`, `waitForNode` (Task 7); `BlockStore` (Task 6); `BitcoinRpcClient`, `rpcAuthLine` (Task 3); `createPrismaClient`, `toTxNum` (Task 4); `startTestDatabase` (Task 4); `loadConfig`, `NetworkSchema`, `LogLevelSchema`, `createLogger`, `hexToBytes`, `bytesToHex` (Tasks 1–2).
- Produces:
  - `IndexerConfigSchema`, `type IndexerConfig`, `loadIndexerConfig(env?)`
  - A runnable `src/main.ts`
  - `startRegtestNode(): Promise<{ rpc: BitcoinRpcClient; stop(): Promise<void> }>`

- [ ] **Step 1: Write the failing config test**

`apps/indexer/src/config.test.ts`:
```ts
import { ConfigError } from '@yabe/shared'
import { expect, it } from 'vitest'
import { loadIndexerConfig } from './config.js'

const required = {
  DATABASE_URL: 'postgresql://x',
  BITCOIN_NETWORK: 'signet',
  BITCOIN_RPC_URL: 'http://localhost:8332',
  BITCOIN_RPC_USER: 'yabe',
  BITCOIN_RPC_PASSWORD: 'pw',
}

it('applies defaults', () => {
  expect(loadIndexerConfig(required)).toEqual({
    ...required,
    RPC_TIMEOUT_MS: 30_000,
    POLL_INTERVAL_MS: 5_000,
    PREFETCH_BLOCKS: 4,
    REORG_MAX_DEPTH: 100,
    LOG_LEVEL: 'info',
  })
})

it('rejects out-of-range values', () => {
  expect(() => loadIndexerConfig({ ...required, PREFETCH_BLOCKS: '64' })).toThrow(ConfigError)
})
```

- [ ] **Step 2: Run the test and confirm it fails, then implement**

Run: `pnpm vitest run apps/indexer/src/config.test.ts`, which should FAIL.

`apps/indexer/src/config.ts`:
```ts
import { loadConfig, LogLevelSchema, NetworkSchema } from '@yabe/shared'
import { Type, type Static } from 'typebox'

export const IndexerConfigSchema = Type.Object({
  DATABASE_URL: Type.String({ minLength: 1 }),
  BITCOIN_NETWORK: NetworkSchema,
  BITCOIN_RPC_URL: Type.String({ minLength: 1 }),
  BITCOIN_RPC_USER: Type.String({ minLength: 1 }),
  BITCOIN_RPC_PASSWORD: Type.String({ minLength: 1 }),
  RPC_TIMEOUT_MS: Type.Integer({ minimum: 1, default: 30_000 }),
  POLL_INTERVAL_MS: Type.Integer({ minimum: 100, default: 5_000 }),
  PREFETCH_BLOCKS: Type.Integer({ minimum: 1, maximum: 32, default: 4 }),
  REORG_MAX_DEPTH: Type.Integer({ minimum: 1, default: 100 }),
  LOG_LEVEL: LogLevelSchema,
})
export type IndexerConfig = Static<typeof IndexerConfigSchema>

export const loadIndexerConfig = (env: Record<string, string | undefined> = process.env): IndexerConfig =>
  loadConfig(IndexerConfigSchema, env)
```

Run: `pnpm --filter @yabe/indexer add typebox@^1.3.34`, then re-run the test. Expected: PASS.

- [ ] **Step 3: Write `main.ts`**

`apps/indexer/src/main.ts`:
```ts
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
```

- [ ] **Step 4: Write the regtest helper and the end-to-end tests**

`apps/indexer/test/bitcoind.ts`:
```ts
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
```

`apps/indexer/test/regtest.int.test.ts`:
```ts
import type { BitcoinRpcClient } from '@yabe/bitcoin-rpc'
import { toTxNum } from '@yabe/db'
import { startTestDatabase, type TestDatabase } from '@yabe/db/testing'
import { bytesToHex, createLogger, hexToBytes } from '@yabe/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BlockStore } from '../src/store/block-store.js'
import { Syncer } from '../src/sync/syncer.js'
import { startRegtestNode } from './bitcoind.js'

let db: TestDatabase
let node: Awaited<ReturnType<typeof startRegtestNode>>
let rpc: BitcoinRpcClient
let syncer: Syncer

const syncToTip = async () => {
  while ((await syncer.syncOnce()) > 0) {
    // keep going until a pass indexes nothing
  }
}

beforeAll(async () => {
  ;[db, node] = await Promise.all([startTestDatabase(), startRegtestNode()])
  rpc = node.rpc
  syncer = new Syncer({
    chain: rpc,
    store: new BlockStore(db.prisma, 'regtest'),
    network: 'regtest',
    logger: createLogger({ name: 'regtest', level: 'silent' }),
    reorgMaxDepth: 10,
    prefetchBlocks: 4,
    pollIntervalMs: 50,
  })
  await rpc.call('createwallet', ['test'])
})

afterAll(async () => {
  await Promise.all([db?.stop(), node?.stop()])
})

describe('indexer against a real Bitcoin Core node (regtest)', () => {
  it('indexes mined blocks and a wallet spend, matching the node', async () => {
    const miner = await rpc.call<string>('getnewaddress')
    await rpc.call('generatetoaddress', [101, miner])
    const destination = await rpc.call<string>('getnewaddress', ['', 'bech32m'])
    const txid = await rpc.call<string>('sendtoaddress', [destination, 1.5])
    await rpc.call('generatetoaddress', [1, miner])

    await syncToTip()

    expect(await db.prisma.block.count()).toBe(103)
    const tx = await db.prisma.transaction.findFirstOrThrow({
      where: { txid: hexToBytes(txid) },
      include: { inputs: true, outputs: true },
    })
    expect(tx.blockHeight).toBe(102)
    expect(tx.feeSats).toBeGreaterThan(0n)
    expect(tx.inputs.length).toBeGreaterThan(0)
    for (const input of tx.inputs) {
      expect(input.prevTxNum).not.toBeNull()
      expect(input.witness).toHaveLength(2) // p2wpkh: signature + pubkey
    }
    expect(
      tx.outputs.some(
        (o) => o.address === destination && o.valueSats === 150_000_000n && o.scriptType === 'witness_v1_taproot',
      ),
    ).toBe(true)

    const stats = await rpc.call<{ totalfee: number; subsidy: number; total_out: number }>('getblockstats', [
      102,
      ['totalfee', 'subsidy', 'total_out'],
    ])
    const block = await db.prisma.block.findUniqueOrThrow({ where: { height: 102 } })
    expect(block.totalFeeSats).toBe(BigInt(stats.totalfee))
    expect(block.subsidySats).toBe(BigInt(stats.subsidy))
    expect(block.totalOutSats).toBe(BigInt(stats.total_out))
    expect(bytesToHex(block.hash)).toBe(await rpc.getBlockHash(102))

    expect(await db.prisma.syncState.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({
      network: 'regtest',
      indexedTipHeight: 102,
    })
  })

  it('rolls back and re-indexes after a reorg', async () => {
    const oldTip = await rpc.getBlockCount()
    await rpc.call('invalidateblock', [await rpc.getBlockHash(oldTip - 1)])
    const otherMiner = await rpc.call<string>('getnewaddress')
    await rpc.call('generatetoaddress', [3, otherMiner])
    const newTip = await rpc.getBlockCount()
    expect(newTip).toBe(oldTip + 1)

    await syncToTip()

    expect(await db.prisma.block.count()).toBe(newTip + 1)
    for (let height = oldTip - 3; height <= newTip; height++) {
      const row = await db.prisma.block.findUniqueOrThrow({ where: { height } })
      expect(bytesToHex(row.hash)).toBe(await rpc.getBlockHash(height))
    }
    expect(await db.prisma.transaction.count({ where: { txNum: { gte: toTxNum(newTip + 1, 0) } } })).toBe(0)
    const nodeTxCount = (
      await Promise.all(
        Array.from({ length: 4 }, async (_, i) => (await rpc.getBlock(await rpc.getBlockHash(newTip - i))).nTx),
      )
    ).reduce((a, b) => a + b, 0)
    expect(await db.prisma.transaction.count({ where: { blockHeight: { gte: newTip - 3 } } })).toBe(nodeTxCount)
  })
})
```

- [ ] **Step 5: Run the integration tests**

Run: `pnpm vitest run --project integration apps/indexer`
Expected: PASS (block-store tests and the two regtest tests). The first run pulls `bitcoin/bitcoin:31.1`.

- [ ] **Step 6: Run all checks and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

```bash
git add apps/indexer pnpm-lock.yaml
git commit -m "feat(indexer): add entrypoint and end-to-end regtest sync and reorg tests"
```

---

### Task 9: API foundation (app factory, errors, security, OpenAPI, status endpoint)

**Files:**
- Create: `apps/api/package.json`, `tsconfig.json`, `tsconfig.build.json` (same as in Task 1)
- Create: `apps/api/src/config.ts`, `src/errors.ts`, `src/app.ts`, `src/server.ts`, `src/schemas/common.ts`, `src/modules/chain.ts`
- Create: `apps/api/src/modules/status/schemas.ts`, `src/modules/status/service.ts`, `src/modules/status/routes.ts`
- Create: `apps/api/test/app.ts`
- Test: `apps/api/src/config.test.ts`, `apps/api/test/status.int.test.ts`

**Interfaces:**
- Consumes: `PrismaClient`, `ScriptType`, `Block` (`@yabe/db`); `startTestDatabase`, `resetDatabase`, `seedChain` (`@yabe/db/testing`); `Logger`, `createLogger`, `loadConfig`, `LogLevelSchema` (`@yabe/shared`).
- Produces:
  - `buildApp(opts: AppOptions)`, with `AppOptions` = `{ prisma: PrismaClient; logger: Logger; corsOrigins: string[]; rateLimitMax: number }`
  - `type App = Awaited<ReturnType<typeof buildApp>>`
  - `class HttpError(statusCode: number, message: string)`, `notFound(message): HttpError`, `problem(status, detail?)`, `PROBLEM_CONTENT_TYPE`
  - From `schemas/common.ts`: `Nullable`, `HashHex`, `HashParam`, `HashOrHeightParam`, `Sats`, `DateTime`, `ScriptTypeSchema`, `Problem`, `Page`, `LimitQuery`
  - `getTipHeight(prisma): Promise<number>` and `confirmations(height: number, tipHeight: number): number`
  - `loadApiConfig(env?)` returning `{ DATABASE_URL, API_HOST, API_PORT, RATE_LIMIT_MAX, LOG_LEVEL, corsOrigins: string[] }`
  - Test helper `createTestApp(prisma): Promise<App>`

- [ ] **Step 1: Create the package**

`apps/api/package.json`:
```json
{
  "name": "@yabe/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "dev": "tsx watch --env-file-if-exists=../../.env --conditions=@yabe/source src/server.ts",
    "openapi:export": "tsx --conditions=@yabe/source src/scripts/export-openapi.ts"
  },
  "dependencies": {
    "@fastify/cors": "^11.3.0",
    "@fastify/helmet": "^13.1.1",
    "@fastify/rate-limit": "^11.2.0",
    "@fastify/swagger": "^9.9.1",
    "@fastify/swagger-ui": "^6.1.1",
    "@fastify/type-provider-typebox": "^6.1.0",
    "@yabe/db": "workspace:*",
    "@yabe/shared": "workspace:*",
    "bitcoinjs-lib": "^7.0.2",
    "fastify": "^5.12.5",
    "typebox": "^1.3.34"
  }
}
```
Copy both tsconfig files from `packages/shared`, then run `pnpm install`.

- [ ] **Step 2: Write the failing tests**

`apps/api/src/config.test.ts`:
```ts
import { expect, it } from 'vitest'
import { loadApiConfig } from './config.js'

it('applies defaults and splits CORS origins', () => {
  expect(
    loadApiConfig({ DATABASE_URL: 'postgresql://x', CORS_ORIGINS: 'http://a.test, http://b.test' }),
  ).toEqual({
    DATABASE_URL: 'postgresql://x',
    API_HOST: '0.0.0.0',
    API_PORT: 8080,
    RATE_LIMIT_MAX: 300,
    LOG_LEVEL: 'info',
    corsOrigins: ['http://a.test', 'http://b.test'],
  })
  expect(loadApiConfig({ DATABASE_URL: 'postgresql://x' }).corsOrigins).toEqual([])
})
```

`apps/api/test/app.ts`:
```ts
import type { PrismaClient } from '@yabe/db'
import { createLogger } from '@yabe/shared'
import { buildApp, type App } from '../src/app.js'

export const createTestApp = (prisma: PrismaClient): Promise<App> =>
  buildApp({ prisma, logger: createLogger({ name: 'test', level: 'silent' }), corsOrigins: [], rateLimitMax: 10_000 })
```

`apps/api/test/status.int.test.ts`:
```ts
import { resetDatabase, seedChain, startTestDatabase, type TestDatabase } from '@yabe/db/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { App } from '../src/app.js'
import { createTestApp } from './app.js'

let db: TestDatabase
let app: App

beforeAll(async () => {
  db = await startTestDatabase()
  app = await createTestApp(db.prisma)
})
beforeEach(async () => {
  await resetDatabase(db.prisma)
})
afterAll(async () => {
  await app.close()
  await db.stop()
})

describe('GET /v1/status', () => {
  it('returns 503 problem+json before the indexer has reported', async () => {
    const res = await app.inject({ url: '/v1/status' })
    expect(res.statusCode).toBe(503)
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/)
    expect(res.json()).toMatchObject({ type: 'about:blank', title: 'Service Unavailable', status: 503 })
  })

  it('reports sync progress', async () => {
    await seedChain(db.prisma)
    const res = await app.inject({ url: '/v1/status' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      network: 'regtest',
      nodeTipHeight: 3,
      indexedTipHeight: 2,
      lag: 1,
      updatedAt: '2026-01-01T00:30:00.000Z',
    })
    expect(res.headers['cache-control']).toBe('public, max-age=10')
  })
})

describe('cross-cutting behaviour', () => {
  it('returns problem+json for unknown routes', async () => {
    const res = await app.inject({ url: '/v1/nope' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ status: 404, title: 'Not Found' })
  })

  it('serves the OpenAPI UI', async () => {
    const res = await app.inject({ url: '/docs/json' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ openapi: '3.1.0', info: { title: 'YABE API' } })
  })

  it('sets security headers', async () => {
    const res = await app.inject({ url: '/v1/status' })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })
})
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm vitest run apps/api`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 4: Implement**

`apps/api/src/config.ts`:
```ts
import { loadConfig, LogLevelSchema } from '@yabe/shared'
import { Type } from 'typebox'

const ApiEnvSchema = Type.Object({
  DATABASE_URL: Type.String({ minLength: 1 }),
  API_HOST: Type.String({ default: '0.0.0.0' }),
  API_PORT: Type.Integer({ minimum: 1, maximum: 65_535, default: 8080 }),
  CORS_ORIGINS: Type.String({ default: '' }),
  RATE_LIMIT_MAX: Type.Integer({ minimum: 1, default: 300 }),
  LOG_LEVEL: LogLevelSchema,
})

export const loadApiConfig = (env: Record<string, string | undefined> = process.env) => {
  const { CORS_ORIGINS, ...rest } = loadConfig(ApiEnvSchema, env)
  return {
    ...rest,
    corsOrigins: CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  }
}
export type ApiConfig = ReturnType<typeof loadApiConfig>
```

`apps/api/src/errors.ts`:
```ts
import { STATUS_CODES } from 'node:http'

export const PROBLEM_CONTENT_TYPE = 'application/problem+json'

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

export const notFound = (message: string): HttpError => new HttpError(404, message)

// RFC 9457 problem details.
export const problem = (status: number, detail?: string) => ({
  type: 'about:blank',
  title: STATUS_CODES[status] ?? 'Error',
  status,
  ...(detail ? { detail } : {}),
})
```

The handlers that use these are registered inline in `buildApp` (below). Fastify's instance type depends on the logger type, so a separate helper typed with the default `FastifyInstance` wouldn't type-check against an instance created with a pino `loggerInstance`.

`apps/api/src/schemas/common.ts`:
```ts
import { ScriptType } from '@yabe/db'
import { Type, type TSchema } from 'typebox'

export const Nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()])

export const HashHex = Type.String({ pattern: '^[0-9a-f]{64}$', description: 'Lowercase hex, display byte order' })
export const HashParam = Type.String({ pattern: '^[0-9a-fA-F]{64}$' })
// Heights are capped at 9 digits so they always fit a Postgres integer.
export const HashOrHeightParam = Type.String({
  pattern: '^([0-9a-fA-F]{64}|[0-9]{1,9})$',
  description: 'Block hash (64 hex chars) or height',
})
export const Sats = Type.Integer({ minimum: 0, description: 'Amount in satoshis' })
export const DateTime = Type.String({ format: 'date-time' })
export const ScriptTypeSchema = Type.Enum(ScriptType)
export const LimitQuery = Type.Integer({ minimum: 1, maximum: 100, default: 25 })

export const Problem = Type.Object({
  type: Type.String(),
  title: Type.String(),
  status: Type.Integer(),
  detail: Type.Optional(Type.String()),
})

export const Page = <T extends TSchema>(item: T) =>
  Type.Object({ data: Type.Array(item), nextCursor: Nullable(Type.Integer()) })
```

`apps/api/src/modules/chain.ts`:
```ts
import type { PrismaClient } from '@yabe/db'

export const getTipHeight = async (prisma: PrismaClient): Promise<number> => {
  const tip = await prisma.block.findFirst({ orderBy: { height: 'desc' }, select: { height: true } })
  return tip?.height ?? -1
}

export const confirmations = (height: number, tipHeight: number): number =>
  tipHeight >= height ? tipHeight - height + 1 : 0
```

`apps/api/src/modules/status/schemas.ts`:
```ts
import { Type, type Static } from 'typebox'
import { DateTime } from '../../schemas/common.js'

export const Status = Type.Object({
  network: Type.String(),
  nodeTipHeight: Type.Integer(),
  indexedTipHeight: Type.Integer(),
  lag: Type.Integer({ minimum: 0 }),
  updatedAt: DateTime,
})
export type Status = Static<typeof Status>
```

`apps/api/src/modules/status/service.ts`:
```ts
import type { PrismaClient } from '@yabe/db'
import { HttpError } from '../../errors.js'
import type { Status } from './schemas.js'

export const createStatusService = (prisma: PrismaClient) => ({
  async get(): Promise<Status> {
    const state = await prisma.syncState.findUnique({ where: { id: 1 } })
    if (!state) throw new HttpError(503, 'The indexer has not reported any progress yet')
    return {
      network: state.network,
      nodeTipHeight: state.nodeTipHeight,
      indexedTipHeight: state.indexedTipHeight,
      lag: Math.max(0, state.nodeTipHeight - state.indexedTipHeight),
      updatedAt: state.updatedAt.toISOString(),
    }
  },
})
export type StatusService = ReturnType<typeof createStatusService>
```

`apps/api/src/modules/status/routes.ts`:
```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Problem } from '../../schemas/common.js'
import { Status } from './schemas.js'
import type { StatusService } from './service.js'

export const statusRoutes: FastifyPluginAsyncTypebox<{ service: StatusService }> = async (app, { service }) => {
  app.get(
    '/status',
    {
      schema: {
        tags: ['status'],
        summary: 'Indexer sync progress',
        response: { 200: Status, 503: Problem },
      },
    },
    async () => service.get(),
  )
}
```

`apps/api/src/app.ts`:
```ts
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { PrismaClient } from '@yabe/db'
import type { Logger } from '@yabe/shared'
import Fastify, { type FastifyError } from 'fastify'
import { HttpError, PROBLEM_CONTENT_TYPE, problem } from './errors.js'
import { statusRoutes } from './modules/status/routes.js'
import { createStatusService } from './modules/status/service.js'

export interface AppOptions {
  prisma: PrismaClient
  logger: Logger
  corsOrigins: string[]
  rateLimitMax: number
}

export const buildApp = async ({ prisma, logger, corsOrigins, rateLimitMax }: AppOptions) => {
  const app = Fastify({ loggerInstance: logger }).withTypeProvider<TypeBoxTypeProvider>()

  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500
    if (status >= 500 && !(err instanceof HttpError)) {
      req.log.error({ err }, 'unhandled error')
      return reply.code(500).type(PROBLEM_CONTENT_TYPE).send(problem(500))
    }
    return reply.code(status).type(PROBLEM_CONTENT_TYPE).send(problem(status, err.message))
  })
  app.setNotFoundHandler((req, reply) =>
    reply
      .code(404)
      .type(PROBLEM_CONTENT_TYPE)
      .send(problem(404, `Route ${req.method} ${req.url} not found`)),
  )

  // CSP is disabled because the API serves JSON only and Swagger UI ships inline scripts.
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, { origin: corsOrigins.length > 0 ? corsOrigins : false, methods: ['GET'] })
  await app.register(rateLimit, { max: rateLimitMax, timeWindow: '1 minute' })
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'YABE API',
        version: '1.0.0',
        description: 'Yet Another Block Explorer — Bitcoin blocks and transactions. Amounts are in satoshis.',
      },
    },
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  app.addHook('onSend', async (req, reply, payload) => {
    if (req.method === 'GET' && reply.statusCode === 200 && !reply.hasHeader('cache-control')) {
      reply.header('cache-control', 'public, max-age=10')
    }
    return payload
  })

  await app.register(
    async (v1) => {
      await v1.register(statusRoutes, { service: createStatusService(prisma) })
    },
    { prefix: '/v1' },
  )

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
```

`apps/api/src/server.ts`:
```ts
import { createPrismaClient } from '@yabe/db'
import { createLogger } from '@yabe/shared'
import { buildApp } from './app.js'
import { loadApiConfig } from './config.js'

const config = loadApiConfig()
const logger = createLogger({ name: 'api', level: config.LOG_LEVEL })
const prisma = createPrismaClient(config.DATABASE_URL)
const app = await buildApp({
  prisma,
  logger,
  corsOrigins: config.corsOrigins,
  rateLimitMax: config.RATE_LIMIT_MAX,
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    logger.info({ signal }, 'shutting down')
    await app.close()
    await prisma.$disconnect()
  })
}

await app.listen({ host: config.API_HOST, port: config.API_PORT })
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm vitest run apps/api && pnpm vitest run --project integration apps/api`
Expected: PASS.

- [ ] **Step 6: Run all checks and commit**

Run: `pnpm typecheck && pnpm lint`

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add Fastify app with problem+json errors, security, OpenAPI and status endpoint"
```

---

### Task 10: Blocks endpoints

**Files:**
- Create: `apps/api/src/modules/blocks/schemas.ts`, `repository.ts`, `service.ts`, `routes.ts`
- Modify: `apps/api/src/app.ts` (register the routes)
- Test: `apps/api/test/blocks.int.test.ts`

**Interfaces:**
- Consumes: the common schemas, `notFound`, `getTipHeight` and `confirmations` (Task 9); `Block`, `PrismaClient`, `fromTxNum`, `txNumRangeForHeight` (Task 4); `bytesToHex`, `hexToBytes` (Task 1); `seedChain` (Task 4).
- Produces:
  - Schemas `BlockSummary`, `BlockDetail` and `TxSummary` (also used by the frontend contract)
  - `createBlocksRepository(prisma)` and `createBlocksService(repo)` with:
    - `list({ before?, limit })`
    - `get(hashOrHeight)`
    - `listTransactions(hashOrHeight, { after?, limit })`
  - `blocksRoutes`, which registers:
    - `GET /v1/blocks`
    - `GET /v1/blocks/:hashOrHeight`
    - `GET /v1/blocks/:hashOrHeight/transactions`

- [ ] **Step 1: Write the failing tests**

`apps/api/test/blocks.int.test.ts`:
```ts
import { resetDatabase, seedChain, startTestDatabase, type SeededChain, type TestDatabase } from '@yabe/db/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { App } from '../src/app.js'
import { createTestApp } from './app.js'

let db: TestDatabase
let app: App
let chain: SeededChain

beforeAll(async () => {
  db = await startTestDatabase()
  app = await createTestApp(db.prisma)
})
beforeEach(async () => {
  await resetDatabase(db.prisma)
  chain = await seedChain(db.prisma)
})
afterAll(async () => {
  await app.close()
  await db.stop()
})

const get = (url: string) => app.inject({ url })

describe('GET /v1/blocks', () => {
  it('lists newest first with summaries', async () => {
    const res = await get('/v1/blocks')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.nextCursor).toBeNull()
    expect(body.data.map((b: { height: number }) => b.height)).toEqual([2, 1, 0])
    expect(body.data[0]).toEqual({
      height: 2,
      hash: chain.blockHashes[2],
      time: '2026-01-01T00:20:00.000Z',
      txCount: 2,
      size: 300,
      weight: 900,
      totalFee: 10_000,
      subsidy: 5_000_000_000,
    })
  })

  it('paginates with a keyset cursor', async () => {
    const first = (await get('/v1/blocks?limit=2')).json()
    expect(first.data.map((b: { height: number }) => b.height)).toEqual([2, 1])
    expect(first.nextCursor).toBe(1)
    const second = (await get(`/v1/blocks?limit=2&before=${first.nextCursor}`)).json()
    expect(second.data.map((b: { height: number }) => b.height)).toEqual([0])
    expect(second.nextCursor).toBeNull()
  })

  it.each(['limit=0', 'limit=101', 'limit=abc', 'before=-1'])('rejects %s with 400 problem+json', async (query) => {
    const res = await get(`/v1/blocks?${query}`)
    expect(res.statusCode).toBe(400)
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/)
  })
})

describe('GET /v1/blocks/:hashOrHeight', () => {
  it('returns block detail by height with derived fields', async () => {
    const res = await get('/v1/blocks/1')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      height: 1,
      hash: chain.blockHashes[1],
      prevHash: chain.blockHashes[0],
      nextHash: chain.blockHashes[2],
      confirmations: 2,
      bits: '207fffff',
      nonce: 1,
      version: 0x20000000,
      totalOut: 0,
      chainwork: `${'00'.repeat(31)}02`,
    })
  })

  it('returns block detail by hash, case-insensitively', async () => {
    const res = await get(`/v1/blocks/${chain.blockHashes[2].toUpperCase()}`)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ height: 2, nextHash: null, confirmations: 1, totalOut: 4_999_990_000 })
  })

  it('returns null prevHash for genesis', async () => {
    expect((await get('/v1/blocks/0')).json().prevHash).toBeNull()
  })

  it('treats a 64-digit all-numeric value as a hash, not a height', async () => {
    const res = await get(`/v1/blocks/${'0'.repeat(64)}`)
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for unknown heights and hashes', async () => {
    expect((await get('/v1/blocks/999999999')).statusCode).toBe(404)
    expect((await get(`/v1/blocks/${'ab'.repeat(32)}`)).json()).toMatchObject({ status: 404, title: 'Not Found' })
  })

  it.each(['xyz', '1234567890', 'ab'.repeat(31)])('rejects malformed id %s with 400', async (id) => {
    expect((await get(`/v1/blocks/${id}`)).statusCode).toBe(400)
  })
})

describe('GET /v1/blocks/:hashOrHeight/transactions', () => {
  it('lists transactions in block order with totals', async () => {
    const res = await get(`/v1/blocks/${chain.blockHashes[2]}/transactions`)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      data: [
        {
          txid: chain.txids.coinbase2,
          position: 0,
          isCoinbase: true,
          inputCount: 1,
          outputCount: 1,
          totalOut: 5_000_010_000,
          fee: null,
          vsize: 100,
        },
        {
          txid: chain.txids.spend,
          position: 1,
          isCoinbase: false,
          inputCount: 1,
          outputCount: 4,
          totalOut: 4_999_990_000,
          fee: 10_000,
          vsize: 141,
        },
      ],
      nextCursor: null,
    })
  })

  it('paginates by position and accepts a height', async () => {
    const first = (await get('/v1/blocks/2/transactions?limit=1')).json()
    expect(first.data.map((t: { position: number }) => t.position)).toEqual([0])
    expect(first.nextCursor).toBe(0)
    const second = (await get(`/v1/blocks/2/transactions?limit=1&after=${first.nextCursor}`)).json()
    expect(second.data.map((t: { position: number }) => t.position)).toEqual([1])
    expect(second.nextCursor).toBeNull()
  })

  it('returns 404 for an unknown block', async () => {
    expect((await get(`/v1/blocks/${'cd'.repeat(32)}/transactions`)).statusCode).toBe(404)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm vitest run --project integration apps/api/test/blocks.int.test.ts`
Expected: FAIL, with 404s from the not-found handler.

- [ ] **Step 3: Implement**

`apps/api/src/modules/blocks/schemas.ts`:
```ts
import { Type, type Static } from 'typebox'
import { DateTime, HashHex, Nullable, Sats } from '../../schemas/common.js'

const blockSummaryProps = {
  height: Type.Integer({ minimum: 0 }),
  hash: HashHex,
  time: DateTime,
  txCount: Type.Integer(),
  size: Type.Integer(),
  weight: Type.Integer(),
  totalFee: Sats,
  subsidy: Sats,
}

export const BlockSummary = Type.Object(blockSummaryProps)
export type BlockSummary = Static<typeof BlockSummary>

export const BlockDetail = Type.Object({
  ...blockSummaryProps,
  confirmations: Type.Integer({ minimum: 0 }),
  prevHash: Nullable(HashHex),
  nextHash: Nullable(HashHex),
  merkleRoot: HashHex,
  version: Type.Integer(),
  bits: Type.String({ description: 'Compact target, 8 hex chars' }),
  nonce: Type.Integer(),
  difficulty: Type.Number(),
  medianTime: DateTime,
  strippedSize: Type.Integer(),
  chainwork: Type.String({ description: 'Hex' }),
  totalOut: Sats,
})
export type BlockDetail = Static<typeof BlockDetail>

export const TxSummary = Type.Object({
  txid: HashHex,
  position: Type.Integer({ minimum: 0 }),
  isCoinbase: Type.Boolean(),
  inputCount: Type.Integer(),
  outputCount: Type.Integer(),
  totalOut: Sats,
  fee: Nullable(Sats),
  vsize: Type.Integer(),
})
export type TxSummary = Static<typeof TxSummary>
```

`apps/api/src/modules/blocks/repository.ts`:
```ts
import type { PrismaClient } from '@yabe/db'
import { getTipHeight } from '../chain.js'

export const createBlocksRepository = (prisma: PrismaClient) => ({
  list: (before: number | undefined, take: number) =>
    prisma.block.findMany({
      where: before === undefined ? {} : { height: { lt: before } },
      orderBy: { height: 'desc' },
      take,
    }),
  findByHash: (hash: Uint8Array<ArrayBuffer>) => prisma.block.findUnique({ where: { hash } }),
  findByHeight: (height: number) => prisma.block.findUnique({ where: { height } }),
  findHashAtHeight: async (height: number) =>
    (await prisma.block.findUnique({ where: { height }, select: { hash: true } }))?.hash ?? null,
  tipHeight: () => getTipHeight(prisma),
  // [fromTxNum, toTxNum) in chain order.
  listTransactions: (fromTxNum: bigint, toTxNum: bigint, take: number) =>
    prisma.transaction.findMany({
      where: { txNum: { gte: fromTxNum, lt: toTxNum } },
      orderBy: { txNum: 'asc' },
      take,
    }),
  sumOutputs: async (txNums: bigint[]): Promise<Map<bigint, bigint>> => {
    if (txNums.length === 0) return new Map()
    const rows = await prisma.txOutput.groupBy({
      by: ['txNum'],
      where: { txNum: { in: txNums } },
      _sum: { valueSats: true },
    })
    return new Map(rows.map((r) => [r.txNum, r._sum.valueSats ?? 0n]))
  },
})
export type BlocksRepository = ReturnType<typeof createBlocksRepository>
```

`apps/api/src/modules/blocks/service.ts`:
```ts
import { fromTxNum, txNumRangeForHeight, type Block } from '@yabe/db'
import { bytesToHex, hexToBytes } from '@yabe/shared'
import { notFound } from '../../errors.js'
import { confirmations } from '../chain.js'
import type { BlocksRepository } from './repository.js'
import type { BlockDetail, BlockSummary, TxSummary } from './schemas.js'

const toSummary = (block: Block): BlockSummary => ({
  height: block.height,
  hash: bytesToHex(block.hash),
  time: block.time.toISOString(),
  txCount: block.txCount,
  size: block.size,
  weight: block.weight,
  totalFee: Number(block.totalFeeSats),
  subsidy: Number(block.subsidySats),
})

const page = <T, C>(rows: T[], limit: number, cursorOf: (row: T) => C) => {
  const data = rows.slice(0, limit)
  const last = data[data.length - 1]
  return { data, nextCursor: rows.length > limit && last !== undefined ? cursorOf(last) : null }
}

export const createBlocksService = (repo: BlocksRepository) => {
  // Length decides, not digits: a 64-char hash can consist only of digits.
  const findBlock = async (hashOrHeight: string): Promise<Block> => {
    const block =
      hashOrHeight.length === 64
        ? await repo.findByHash(hexToBytes(hashOrHeight.toLowerCase()))
        : await repo.findByHeight(Number(hashOrHeight))
    if (!block) throw notFound(`Block ${hashOrHeight} not found`)
    return block
  }

  return {
    async list(query: { before?: number; limit: number }): Promise<{ data: BlockSummary[]; nextCursor: number | null }> {
      const rows = await repo.list(query.before, query.limit + 1)
      const result = page(rows, query.limit, (b) => b.height)
      return { data: result.data.map(toSummary), nextCursor: result.nextCursor }
    },

    async get(hashOrHeight: string): Promise<BlockDetail> {
      const block = await findBlock(hashOrHeight)
      const [tip, nextHash] = await Promise.all([repo.tipHeight(), repo.findHashAtHeight(block.height + 1)])
      return {
        ...toSummary(block),
        confirmations: confirmations(block.height, tip),
        prevHash: block.prevHash ? bytesToHex(block.prevHash) : null,
        nextHash: nextHash ? bytesToHex(nextHash) : null,
        merkleRoot: bytesToHex(block.merkleRoot),
        version: block.version,
        bits: block.bits.toString(16).padStart(8, '0'),
        nonce: Number(block.nonce),
        difficulty: block.difficulty,
        medianTime: block.medianTime.toISOString(),
        strippedSize: block.strippedSize,
        chainwork: bytesToHex(block.chainwork),
        totalOut: Number(block.totalOutSats),
      }
    },

    async listTransactions(
      hashOrHeight: string,
      query: { after?: number; limit: number },
    ): Promise<{ data: TxSummary[]; nextCursor: number | null }> {
      const block = await findBlock(hashOrHeight)
      const { start, end } = txNumRangeForHeight(block.height)
      const from = query.after === undefined ? start : start + BigInt(query.after) + 1n
      const rows = await repo.listTransactions(from, end, query.limit + 1)
      const result = page(rows, query.limit, (t) => fromTxNum(t.txNum).position)
      const totals = await repo.sumOutputs(result.data.map((t) => t.txNum))
      return {
        data: result.data.map((t) => ({
          txid: bytesToHex(t.txid),
          position: fromTxNum(t.txNum).position,
          isCoinbase: t.isCoinbase,
          inputCount: t.inputCount,
          outputCount: t.outputCount,
          totalOut: Number(totals.get(t.txNum) ?? 0n),
          fee: t.feeSats === null ? null : Number(t.feeSats),
          vsize: t.vsize,
        })),
        nextCursor: result.nextCursor,
      }
    },
  }
}
export type BlocksService = ReturnType<typeof createBlocksService>
```

`apps/api/src/modules/blocks/routes.ts`:
```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { MAX_TX_POSITION } from '@yabe/db'
import { Type } from 'typebox'
import { HashOrHeightParam, LimitQuery, Page, Problem } from '../../schemas/common.js'
import { BlockDetail, BlockSummary, TxSummary } from './schemas.js'
import type { BlocksService } from './service.js'

const Params = Type.Object({ hashOrHeight: HashOrHeightParam })

export const blocksRoutes: FastifyPluginAsyncTypebox<{ service: BlocksService }> = async (app, { service }) => {
  app.get(
    '/blocks',
    {
      schema: {
        tags: ['blocks'],
        summary: 'Latest blocks, newest first',
        querystring: Type.Object({
          before: Type.Optional(Type.Integer({ minimum: 0, maximum: 2_147_483_647, description: 'Height cursor' })),
          limit: LimitQuery,
        }),
        response: { 200: Page(BlockSummary), 400: Problem },
      },
    },
    async (req) => service.list(req.query),
  )

  app.get(
    '/blocks/:hashOrHeight',
    {
      schema: {
        tags: ['blocks'],
        summary: 'Block detail',
        params: Params,
        response: { 200: BlockDetail, 400: Problem, 404: Problem },
      },
    },
    async (req) => service.get(req.params.hashOrHeight),
  )

  app.get(
    '/blocks/:hashOrHeight/transactions',
    {
      schema: {
        tags: ['blocks'],
        summary: "A block's transactions in block order",
        params: Params,
        querystring: Type.Object({
          after: Type.Optional(Type.Integer({ minimum: 0, maximum: MAX_TX_POSITION, description: 'Position cursor' })),
          limit: LimitQuery,
        }),
        response: { 200: Page(TxSummary), 400: Problem, 404: Problem },
      },
    },
    async (req) => service.listTransactions(req.params.hashOrHeight, req.query),
  )
}
```

In `apps/api/src/app.ts`, add these imports:
```ts
import { createBlocksRepository } from './modules/blocks/repository.js'
import { blocksRoutes } from './modules/blocks/routes.js'
import { createBlocksService } from './modules/blocks/service.js'
```
Then add this line inside the `/v1` plugin, after the status registration:
```ts
      await v1.register(blocksRoutes, { service: createBlocksService(createBlocksRepository(prisma)) })
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run --project integration apps/api && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add blocks list, detail and block-transactions endpoints"
```

---

### Task 11: Transaction detail endpoint

**Files:**
- Create: `apps/api/src/lib/script.ts`, `src/modules/transactions/schemas.ts`, `repository.ts`, `service.ts`, `routes.ts`
- Modify: `apps/api/src/app.ts` (register the routes)
- Test: `apps/api/src/lib/script.test.ts`, `apps/api/test/transactions.int.test.ts`

**Interfaces:**
- Consumes: the common schemas, `notFound`, `getTipHeight` and `confirmations` (Task 9); `PrismaClient` (Task 4); `bytesToHex`, `hexToBytes` (Task 1); `seedChain`, `SEED` (Task 4).
- Produces:
  - `scriptToAsm(bytes: Uint8Array): string | null`
  - The `TxDetail` schema
  - `createTransactionsRepository(prisma)` and `createTransactionsService(repo)` with `getByTxid(txid)`
  - `transactionsRoutes`, registering `GET /v1/transactions/:txid`

- [ ] **Step 1: Write the failing tests**

`apps/api/src/lib/script.test.ts`:
```ts
import { expect, it } from 'vitest'
import { scriptToAsm } from './script.js'

const bytes = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'))

it('decodes standard scripts', () => {
  expect(scriptToAsm(bytes('76a914000102030405060708090a0b0c0d0e0f1011121388ac'))).toBe(
    'OP_DUP OP_HASH160 000102030405060708090a0b0c0d0e0f10111213 OP_EQUALVERIFY OP_CHECKSIG',
  )
  expect(scriptToAsm(bytes('6a0568656c6c6f'))).toBe('OP_RETURN 68656c6c6f')
})

it('returns an empty string for an empty script and null for an undecodable one', () => {
  expect(scriptToAsm(new Uint8Array())).toBe('')
  expect(scriptToAsm(bytes('4c'))).toBeNull()
})
```

`apps/api/test/transactions.int.test.ts`:
```ts
import {
  resetDatabase,
  SEED,
  seedChain,
  startTestDatabase,
  type SeededChain,
  type TestDatabase,
} from '@yabe/db/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { App } from '../src/app.js'
import { createTestApp } from './app.js'

let db: TestDatabase
let app: App
let chain: SeededChain

beforeAll(async () => {
  db = await startTestDatabase()
  app = await createTestApp(db.prisma)
})
beforeEach(async () => {
  await resetDatabase(db.prisma)
  chain = await seedChain(db.prisma)
})
afterAll(async () => {
  await app.close()
  await db.stop()
})

const get = (url: string) => app.inject({ url })

describe('GET /v1/transactions/:txid', () => {
  it('returns a spend with prevouts, scripts, witness and fee', async () => {
    const res = await get(`/v1/transactions/${chain.txids.spend}`)
    expect(res.statusCode).toBe(200)
    const tx = res.json()
    expect(tx).toMatchObject({
      txid: chain.txids.spend,
      isCoinbase: false,
      fee: 10_000,
      feeRate: 70.92,
      totalIn: 5_000_000_000,
      totalOut: 4_999_990_000,
      confirmations: 1,
      vsize: 141,
      version: 2,
      block: { height: 2, hash: chain.blockHashes[2], time: '2026-01-01T00:20:00.000Z' },
    })
    expect(tx.inputs).toEqual([
      {
        vin: 0,
        coinbase: false,
        prevout: {
          txid: chain.txids.coinbase1,
          vout: 0,
          value: 5_000_000_000,
          address: 'bcrt1qminer1',
          scriptType: 'witness_v0_keyhash',
        },
        scriptSig: { hex: '', asm: '' },
        witness: [...SEED.witness],
        sequence: 4_294_967_293,
      },
    ])
    expect(tx.outputs.map((o: { scriptPubKey: { type: string } }) => o.scriptPubKey.type)).toEqual([
      'witness_v1_taproot',
      'witness_v0_keyhash',
      'nulldata',
      'nonstandard',
    ])
    expect(tx.outputs[2].scriptPubKey).toEqual({
      hex: SEED.opReturnScript,
      asm: 'OP_RETURN 68656c6c6f',
      type: 'nulldata',
      address: null,
    })
    expect(tx.outputs[3].scriptPubKey.asm).toBeNull()
    expect(tx.outputs.every((o: { spentBy: unknown }) => o.spentBy === null)).toBe(true)
  })

  it('shows which input spent an output', async () => {
    const tx = (await get(`/v1/transactions/${chain.txids.coinbase1}`)).json()
    expect(tx.isCoinbase).toBe(true)
    expect(tx.fee).toBeNull()
    expect(tx.feeRate).toBeNull()
    expect(tx.totalIn).toBeNull()
    expect(tx.wtxid).toBe(chain.txids.coinbase1)
    expect(tx.inputs[0]).toMatchObject({ coinbase: true, prevout: null, scriptSig: { hex: '0101', asm: null } })
    expect(tx.outputs[0].spentBy).toEqual({ txid: chain.txids.spend, vin: 0 })
  })

  it('accepts an uppercase txid', async () => {
    expect((await get(`/v1/transactions/${chain.txids.spend.toUpperCase()}`)).statusCode).toBe(200)
  })

  it('returns 404 for an unknown txid and 400 for a malformed one', async () => {
    expect((await get(`/v1/transactions/${'ef'.repeat(32)}`)).statusCode).toBe(404)
    expect((await get('/v1/transactions/not-a-txid')).statusCode).toBe(400)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm vitest run apps/api/src/lib && pnpm vitest run --project integration apps/api/test/transactions.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/api/src/lib/script.ts`:
```ts
import { script } from 'bitcoinjs-lib'

// ASM for display. Returns null when the bytes don't parse as a script, which is legal on-chain in output scripts.
// Note: bitcoinjs-lib's ASM differs cosmetically from Bitcoin Core's (e.g. small integers, sighash suffixes).
export const scriptToAsm = (bytes: Uint8Array): string | null => {
  try {
    return script.toASM(bytes)
  } catch {
    return null
  }
}
```

`apps/api/src/modules/transactions/schemas.ts`:
```ts
import { Type, type Static } from 'typebox'
import { DateTime, HashHex, Nullable, Sats, ScriptTypeSchema } from '../../schemas/common.js'

const Prevout = Type.Object({
  txid: HashHex,
  vout: Type.Integer(),
  value: Sats,
  address: Nullable(Type.String()),
  scriptType: ScriptTypeSchema,
})

const InputView = Type.Object({
  vin: Type.Integer(),
  coinbase: Type.Boolean(),
  prevout: Nullable(Prevout),
  scriptSig: Type.Object({
    hex: Type.String(),
    asm: Nullable(Type.String({ description: 'Null for coinbase data or undecodable scripts' })),
  }),
  witness: Type.Array(Type.String()),
  sequence: Type.Integer(),
})

const OutputView = Type.Object({
  vout: Type.Integer(),
  value: Sats,
  scriptPubKey: Type.Object({
    hex: Type.String(),
    asm: Nullable(Type.String()),
    type: ScriptTypeSchema,
    address: Nullable(Type.String()),
  }),
  spentBy: Nullable(Type.Object({ txid: HashHex, vin: Type.Integer() })),
})

export const TxDetail = Type.Object({
  txid: HashHex,
  wtxid: HashHex,
  version: Type.Integer(),
  locktime: Type.Integer(),
  size: Type.Integer(),
  vsize: Type.Integer(),
  weight: Type.Integer(),
  isCoinbase: Type.Boolean(),
  fee: Nullable(Sats),
  feeRate: Nullable(Type.Number({ description: 'sat/vB, 2 decimals' })),
  totalIn: Nullable(Sats),
  totalOut: Sats,
  confirmations: Type.Integer({ minimum: 0 }),
  block: Type.Object({ height: Type.Integer(), hash: HashHex, time: DateTime }),
  inputs: Type.Array(InputView),
  outputs: Type.Array(OutputView),
})
export type TxDetail = Static<typeof TxDetail>
```

`apps/api/src/modules/transactions/repository.ts`:
```ts
import type { PrismaClient } from '@yabe/db'
import { getTipHeight } from '../chain.js'

export const createTransactionsRepository = (prisma: PrismaClient) => ({
  // txid is not unique (BIP30); the newest occurrence wins, matching Bitcoin Core.
  findByTxid: (txid: Uint8Array<ArrayBuffer>) =>
    prisma.transaction.findFirst({
      where: { txid },
      orderBy: { txNum: 'desc' },
      include: {
        block: { select: { height: true, hash: true, time: true } },
        inputs: { orderBy: { vin: 'asc' } },
        outputs: { orderBy: { vout: 'asc' } },
      },
    }),
  findOutputs: async (refs: { txNum: bigint; vout: number }[]) =>
    refs.length === 0
      ? []
      : prisma.txOutput.findMany({
          where: { OR: refs.map((r) => ({ txNum: r.txNum, vout: r.vout })) },
          include: { transaction: { select: { txid: true } } },
        }),
  findSpenders: (txNum: bigint) =>
    prisma.txInput.findMany({
      where: { prevTxNum: txNum },
      select: { vin: true, prevVout: true, transaction: { select: { txid: true } } },
    }),
  tipHeight: () => getTipHeight(prisma),
})
export type TransactionsRepository = ReturnType<typeof createTransactionsRepository>
```

`apps/api/src/modules/transactions/service.ts`:
```ts
import { bytesToHex, hexToBytes } from '@yabe/shared'
import { notFound } from '../../errors.js'
import { scriptToAsm } from '../../lib/script.js'
import { confirmations } from '../chain.js'
import type { TransactionsRepository } from './repository.js'
import type { TxDetail } from './schemas.js'

const outpointKey = (txNum: bigint, vout: number) => `${txNum}:${vout}`

export const createTransactionsService = (repo: TransactionsRepository) => ({
  async getByTxid(txidHex: string): Promise<TxDetail> {
    const tx = await repo.findByTxid(hexToBytes(txidHex.toLowerCase()))
    if (!tx) throw notFound(`Transaction ${txidHex} not found`)

    const refs = tx.inputs.flatMap((i) =>
      i.prevTxNum === null || i.prevVout === null ? [] : [{ txNum: i.prevTxNum, vout: i.prevVout }],
    )
    const [tip, prevOutputs, spenders] = await Promise.all([
      repo.tipHeight(),
      repo.findOutputs(refs),
      repo.findSpenders(tx.txNum),
    ])
    const prevByOutpoint = new Map(prevOutputs.map((o) => [outpointKey(o.txNum, o.vout), o]))
    const spenderByVout = new Map(spenders.map((s) => [s.prevVout, s]))

    const inputs = tx.inputs.map((input) => {
      const prev =
        input.prevTxNum === null || input.prevVout === null
          ? undefined
          : prevByOutpoint.get(outpointKey(input.prevTxNum, input.prevVout))
      return {
        vin: input.vin,
        coinbase: tx.isCoinbase,
        prevout: prev
          ? {
              txid: bytesToHex(prev.transaction.txid),
              vout: prev.vout,
              value: Number(prev.valueSats),
              address: prev.address,
              scriptType: prev.scriptType,
            }
          : null,
        scriptSig: { hex: bytesToHex(input.scriptSig), asm: tx.isCoinbase ? null : scriptToAsm(input.scriptSig) },
        witness: input.witness.map(bytesToHex),
        sequence: Number(input.sequence),
      }
    })

    const outputs = tx.outputs.map((output) => {
      const spender = spenderByVout.get(output.vout)
      return {
        vout: output.vout,
        value: Number(output.valueSats),
        scriptPubKey: {
          hex: bytesToHex(output.scriptPubkey),
          asm: scriptToAsm(output.scriptPubkey),
          type: output.scriptType,
          address: output.address,
        },
        spentBy: spender ? { txid: bytesToHex(spender.transaction.txid), vin: spender.vin } : null,
      }
    })

    const totalOut = outputs.reduce((sum, o) => sum + o.value, 0)
    const totalIn =
      tx.isCoinbase || inputs.some((i) => i.prevout === null)
        ? null
        : inputs.reduce((sum, i) => sum + (i.prevout?.value ?? 0), 0)
    const fee = tx.feeSats === null ? null : Number(tx.feeSats)
    const txid = bytesToHex(tx.txid)

    return {
      txid,
      wtxid: tx.wtxid ? bytesToHex(tx.wtxid) : txid,
      version: Number(tx.version),
      locktime: Number(tx.locktime),
      size: tx.size,
      vsize: tx.vsize,
      weight: tx.weight,
      isCoinbase: tx.isCoinbase,
      fee,
      feeRate: fee === null ? null : Math.round((fee / tx.vsize) * 100) / 100,
      totalIn,
      totalOut,
      confirmations: confirmations(tx.block.height, tip),
      block: { height: tx.block.height, hash: bytesToHex(tx.block.hash), time: tx.block.time.toISOString() },
      inputs,
      outputs,
    }
  },
})
export type TransactionsService = ReturnType<typeof createTransactionsService>
```

`apps/api/src/modules/transactions/routes.ts`:
```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Type } from 'typebox'
import { HashParam, Problem } from '../../schemas/common.js'
import { TxDetail } from './schemas.js'
import type { TransactionsService } from './service.js'

export const transactionsRoutes: FastifyPluginAsyncTypebox<{ service: TransactionsService }> = async (
  app,
  { service },
) => {
  app.get(
    '/transactions/:txid',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Transaction detail with prevouts and spending inputs',
        params: Type.Object({ txid: HashParam }),
        response: { 200: TxDetail, 400: Problem, 404: Problem },
      },
    },
    async (req) => service.getByTxid(req.params.txid),
  )
}
```

In `apps/api/src/app.ts`, add these imports:
```ts
import { createTransactionsRepository } from './modules/transactions/repository.js'
import { transactionsRoutes } from './modules/transactions/routes.js'
import { createTransactionsService } from './modules/transactions/service.js'
```
Then add this line inside the `/v1` plugin, after the blocks registration:
```ts
      await v1.register(transactionsRoutes, {
        service: createTransactionsService(createTransactionsRepository(prisma)),
      })
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test && pnpm vitest run --project integration apps/api && pnpm typecheck && pnpm lint`
Expected: PASS. In the spend test, `feeRate` is 10,000 / 141 = 70.92.

- [ ] **Step 5: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add transaction detail endpoint with prevouts, spenders and script asm"
```

---

### Task 12: OpenAPI contract, Docker, Compose, env and README

**Files:**
- Create: `apps/api/src/scripts/export-openapi.ts`, `apps/api/openapi.json` (generated), `apps/api/src/openapi.test.ts`
- Create: `docker/Dockerfile`, `.dockerignore`, `.env.example`
- Replace: `docker-compose.yml`, `README.md`
- Delete: `.env.sample`

**Interfaces:**
- Consumes: `buildApp` (Tasks 9–11); `createPrismaClient` (Task 4); `createLogger` (Task 2).
- Produces:
  - The committed `apps/api/openapi.json`, the frontend contract that workstream 2 consumes
  - Container images, targets `migrate`, `indexer` and `api`
  - The Compose stack

- [ ] **Step 1: Write the failing contract test**

`apps/api/src/openapi.test.ts`:
```ts
import { readFile } from 'node:fs/promises'
import { createPrismaClient } from '@yabe/db'
import { createLogger } from '@yabe/shared'
import { expect, it } from 'vitest'
import { buildApp } from './app.js'

it('matches the committed openapi.json (run `pnpm --filter @yabe/api openapi:export` after API changes)', async () => {
  const app = await buildApp({
    prisma: createPrismaClient('postgresql://unused@localhost:5432/unused'),
    logger: createLogger({ name: 'test', level: 'silent' }),
    corsOrigins: [],
    rateLimitMax: 1,
  })
  await app.ready()
  const spec = JSON.parse(JSON.stringify(app.swagger())) as { paths: Record<string, unknown> }
  await app.close()

  expect(Object.keys(spec.paths).sort()).toEqual([
    '/v1/blocks',
    '/v1/blocks/{hashOrHeight}',
    '/v1/blocks/{hashOrHeight}/transactions',
    '/v1/status',
    '/v1/transactions/{txid}',
  ])
  const committed = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'))
  expect(spec).toEqual(committed)
})
```

Run: `pnpm vitest run apps/api/src/openapi.test.ts`
Expected: FAIL with ENOENT, because `openapi.json` doesn't exist yet.

- [ ] **Step 2: Write the export script and generate the contract**

`apps/api/src/scripts/export-openapi.ts`:
```ts
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createPrismaClient } from '@yabe/db'
import { createLogger } from '@yabe/shared'
import { buildApp } from '../app.js'

// Builds the app without touching the database (Prisma connects lazily) and writes the OpenAPI document.
const output = new URL('../../openapi.json', import.meta.url)
const app = await buildApp({
  prisma: createPrismaClient('postgresql://unused@localhost:5432/unused'),
  logger: createLogger({ name: 'openapi', level: 'silent' }),
  corsOrigins: [],
  rateLimitMax: 1,
})
await app.ready()
await writeFile(output, `${JSON.stringify(app.swagger(), null, 2)}\n`)
await app.close()
console.log(`Wrote ${fileURLToPath(output)}`)
```

Run: `pnpm --filter @yabe/api openapi:export && pnpm vitest run apps/api/src/openapi.test.ts`
Expected: writes `apps/api/openapi.json`, and the test passes.

- [ ] **Step 3: Write the Dockerfile and `.dockerignore`**

`docker/Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm -r build
RUN pnpm deploy --filter @yabe/api --prod --legacy /out/api \
 && pnpm deploy --filter @yabe/indexer --prod --legacy /out/indexer

# One-shot schema migration; reuses the build stage because it needs the Prisma CLI.
FROM build AS migrate
WORKDIR /repo/packages/db
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM node:24-slim AS indexer
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/indexer .
USER node
CMD ["node", "dist/main.js"]

FROM node:24-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api .
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

`.dockerignore`:
```
**/node_modules
**/dist
**/src/generated
.git
.env
yabe-backend
docs
```

- [ ] **Step 4: Write `.env.example` and replace `docker-compose.yml`**

`.env.example`:
```bash
# Copy to .env and change every "change-me".

# --- Postgres ---
POSTGRES_USER=yabe
POSTGRES_PASSWORD=change-me
POSTGRES_DB=yabe
# Used when running the apps on the host (pnpm dev / pnpm db:migrate). Compose builds its own URL.
DATABASE_URL=postgresql://yabe:change-me@localhost:5432/yabe

# --- Bitcoin Core ---
# main | test | testnet4 | signet | regtest
BITCOIN_NETWORK=signet
BITCOIN_RPC_USER=yabe
BITCOIN_RPC_PASSWORD=change-me
# Generate with: pnpm rpcauth <BITCOIN_RPC_USER> <BITCOIN_RPC_PASSWORD>
# Keep the single quotes: the value contains a "$".
BITCOIN_RPCAUTH='yabe:replace-with-pnpm-rpcauth-output'
# Used when running the indexer on the host. Compose uses http://bitcoind:8332.
BITCOIN_RPC_URL=http://localhost:8332

# --- Indexer (optional) ---
# RPC_TIMEOUT_MS=30000
# POLL_INTERVAL_MS=5000
# PREFETCH_BLOCKS=4
# REORG_MAX_DEPTH=100

# --- API (optional) ---
# API_PORT=8080
# CORS_ORIGINS=http://localhost:5173
# RATE_LIMIT_MAX=300

LOG_LEVEL=info
```

`docker-compose.yml`:
```yaml
name: yabe

x-database-url: &database-url postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql
    ports:
      - 127.0.0.1:5432:5432
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U "$${POSTGRES_USER}" -d "$${POSTGRES_DB}"']
      interval: 5s
      timeout: 3s
      retries: 20
    networks: [yabe]

  bitcoind:
    image: bitcoin/bitcoin:31.1
    command:
      - -chain=${BITCOIN_NETWORK}
      - -server=1
      - -printtoconsole=1
      - -rpcport=8332
      - -rpcbind=0.0.0.0
      - -rpcallowip=172.28.0.0/16
      - -rpcauth=${BITCOIN_RPCAUTH}
    volumes:
      - bitcoin-data:/home/bitcoin/.bitcoin
    ports:
      - 127.0.0.1:8332:8332
    networks: [yabe]

  migrate:
    build: { context: ., dockerfile: docker/Dockerfile, target: migrate }
    environment:
      DATABASE_URL: *database-url
    depends_on:
      postgres: { condition: service_healthy }
    networks: [yabe]

  indexer:
    build: { context: ., dockerfile: docker/Dockerfile, target: indexer }
    restart: unless-stopped
    stop_grace_period: 2m
    environment:
      DATABASE_URL: *database-url
      BITCOIN_NETWORK: ${BITCOIN_NETWORK}
      BITCOIN_RPC_URL: http://bitcoind:8332
      BITCOIN_RPC_USER: ${BITCOIN_RPC_USER}
      BITCOIN_RPC_PASSWORD: ${BITCOIN_RPC_PASSWORD}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    depends_on:
      migrate: { condition: service_completed_successfully }
      bitcoind: { condition: service_started }
    networks: [yabe]

  api:
    build: { context: ., dockerfile: docker/Dockerfile, target: api }
    restart: unless-stopped
    environment:
      DATABASE_URL: *database-url
      API_PORT: '8080'
      CORS_ORIGINS: ${CORS_ORIGINS:-}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    ports:
      - ${API_PUBLISH_PORT:-8080}:8080
    depends_on:
      migrate: { condition: service_completed_successfully }
    networks: [yabe]

networks:
  yabe:
    ipam:
      config:
        - subnet: 172.28.0.0/16

volumes:
  pgdata: {}
  bitcoin-data: {}
```

Run: `git rm .env.sample`

- [ ] **Step 5: Replace `README.md`**

```markdown
![Yet Another Block Explorer](yabe-logo.png 'Y.A.B.E - Yet Another Block Explorer')

YABE is a Bitcoin block explorer backend with two parts: an **indexer**, which reads blocks from Bitcoin Core into Postgres and handles chain reorgs, and a **REST API** over the indexed data. The API is described by OpenAPI in [`apps/api/openapi.json`](apps/api/openapi.json), with an interactive UI at `/docs`.

## Layout

| Path                   | What                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `apps/indexer`         | Sync worker: `getblock` (verbosity 3) → Postgres, one DB transaction per block |
| `apps/api`             | Fastify REST API (`/v1`), TypeBox schemas, generated OpenAPI            |
| `packages/db`          | Prisma schema and migrations, `tx_num` key helpers, test utilities     |
| `packages/bitcoin-rpc` | Typed Bitcoin Core JSON-RPC client                                     |
| `packages/shared`      | Config loading, logging, hex/satoshi utilities                         |

The design is in `docs/superpowers/specs/2026-10-01-backend-typescript-restructure-design.md`.

## Requirements

- Node 24 (`nvm use`) and pnpm via corepack (`corepack enable`)
- Docker, or Podman with `podman compose`
- Disk space for a **non-pruned** Bitcoin Core node on your chosen network. Signet is small (tens of GB); mainnet needs well over 700 GB. Check the actual size with `bitcoin-cli getblockchaininfo` (`size_on_disk`).

The `bitcoin/bitcoin` image is community-maintained (it verifies the official release signatures at build time). For mainnet production, consider running a binary you verified yourself.

## Run everything with Compose

    cp .env.example .env
    pnpm install
    pnpm rpcauth yabe <your-rpc-password>   # paste the output into BITCOIN_RPCAUTH (keep the quotes)
    docker compose up -d --build
    curl localhost:8080/v1/status

The indexer follows the node while it syncs. Watch it with `docker compose logs -f indexer`.

## Develop on the host

    docker compose up -d postgres bitcoind
    pnpm db:migrate
    pnpm --filter @yabe/indexer dev
    pnpm --filter @yabe/api dev            # http://localhost:8080/docs

## Checks

    pnpm lint && pnpm typecheck && pnpm test     # unit tests
    pnpm test:integration                        # Testcontainers: Postgres + bitcoind regtest

Using Podman for the integration tests:

    export DOCKER_HOST=unix://$(podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}')
    export TESTCONTAINERS_RYUK_DISABLED=true

After changing an API route or schema, run `pnpm --filter @yabe/api openapi:export` and commit `openapi.json`.
```

- [ ] **Step 6: Verify the images and the stack**

Run:
```bash
docker compose build
cp -n .env.example .env   # then fill in the passwords and BITCOIN_RPCAUTH as the README describes
docker compose up -d
docker compose ps
```
Expected:
- `migrate` exits with code 0; `postgres`, `bitcoind`, `indexer` and `api` are running.
- `curl -s localhost:8080/v1/status` returns either 503 (indexer still connecting) or 200 JSON with `"network":"signet"`.
- Within a few minutes, `curl -s 'localhost:8080/v1/blocks?limit=1'` returns a block, and `docker compose logs indexer` shows `indexed block` lines.

With Podman, use `podman compose` in place of `docker compose`. Shut down with `docker compose down`, keeping the volumes.

- [ ] **Step 7: Run all checks and commit**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`

```bash
git add apps/api docker .dockerignore .env.example docker-compose.yml README.md
git commit -m "feat: add OpenAPI contract, Docker images, Compose stack and README"
```

---

### Task 13: CI, removal of the legacy backend, and spec addendum

**Files:**
- Create: `.github/workflows/ci.yml`
- Delete: `yabe-backend/`
- Modify: `eslint.config.js`, `.prettierignore`, `.dockerignore` (remove the `yabe-backend` entries)
- Modify: `docs/superpowers/specs/2026-10-01-backend-typescript-restructure-design.md` (append an addendum)

**Interfaces:**
- Consumes: every script defined in earlier tasks.
- Produces: CI that runs on every PR to `develop`.

- [ ] **Step 1: Write the workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [develop]

jobs:
  checks:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm test:integration
      - run: pnpm build

  images:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: docker/setup-buildx-action@v3
      - run: docker build -f docker/Dockerfile --target indexer -t yabe-indexer:ci .
      - run: docker build -f docker/Dockerfile --target api -t yabe-api:ci .
```

The OpenAPI drift check runs inside `pnpm test` (`apps/api/src/openapi.test.ts`).

- [ ] **Step 2: Delete the legacy backend and its ignore entries**

```bash
git rm -r yabe-backend
```
Remove the `'yabe-backend/**'` entry from `ignores` in `eslint.config.js`, and the `yabe-backend` line from both `.prettierignore` and `.dockerignore`.

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build`
Expected: all pass.

- [ ] **Step 3: Append the addendum to the spec**

Append to `docs/superpowers/specs/2026-10-01-backend-typescript-restructure-design.md`:
```markdown

## 13. Addendum: decisions made during implementation planning

- **`transaction.txid` is indexed, not unique.** Mainnet has two BIP30 duplicate coinbase txids (heights 91842 and 91880). Lookups return the highest `tx_num`; prevout resolution prefers the newest occurrence.
- **`script_type` uses Bitcoin Core's names verbatim** (`pubkeyhash`, `witness_v0_keyhash`, `witness_v1_taproot`, `anchor`, …). An unknown type stops the indexer, which makes a schema update necessary.
- **The subsidy halving interval depends on the network:** 210,000, except regtest at 150.
- **Transaction `version` is `bigint`,** because it is uint32 in Bitcoin Core.
- **The API always returns `wtxid`,** equal to `txid` for non-witness transactions.
- **`/v1/blocks/:hashOrHeight/transactions` also accepts a height.**
- **Builds:** per-package `tsc` builds in pnpm's topological order. Dev, tests and typecheck resolve workspace packages to source through the `@yabe/source` export condition.
- **Pinned versions:** Bitcoin Core image `bitcoin/bitcoin:31.1` (community-built; it verifies official release signatures), `postgres:18-alpine`, Prisma 7.10.
- **`Bytes[]` is supported** by Prisma on Postgres, so `witness` is a `bytea[]` column and the child-table fallback is unused.
```

- [ ] **Step 4: Commit**

```bash
git add -A .github eslint.config.js .prettierignore .dockerignore docs/superpowers/specs
git commit -m "chore: add CI workflow, remove legacy JS backend, record planning decisions in spec"
```

---

## Spec Coverage

| Spec section | Tasks |
|---|---|
| §2 Bugs (lookup 404s, witness storage, migration ordering, address column) | 4 (schema), 6 (witness), 10 and 11 (404s) |
| §3 Technology choices | 1–4, 9 |
| §4 Repository layout | 1, 3, 4, 5, 9 |
| §5 `tx_num` | 4 |
| §6 Schema (including `sync_state`, spend link, unique prevout) | 4, 6 |
| §7 Indexer (reorg, verbosity 3, prefetch, per-block transaction, polling, shutdown, retry, node requirements) | 5, 6, 7, 8 |
| §8 API (endpoints, cursors, response shapes, problem+json, hardening, cache headers, OpenAPI) | 9, 10, 11, 12 |
| §9 Testing (unit fixtures, regtest integration and reorg, API integration, contract) | 5–12 |
| §10 Docker, Compose, CI, migration path | 12, 13 |
| §12 Items to verify | Resolved during planning (Global Constraints and the Task 13 addendum) |
