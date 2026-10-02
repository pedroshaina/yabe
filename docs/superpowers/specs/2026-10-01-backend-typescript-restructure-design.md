# YABE Backend: TypeScript Restructure — Design Spec

- **Date:** 2026-10-01
- **Status:** Draft, awaiting review
- **Scope:** Workstream 1 of 2 (backend). Workstream 2 (UI design agent) gets its own spec.

## 1. Context and goals

YABE (Yet Another Block Explorer) is a Bitcoin block explorer split into an **indexer** (reads blocks from a
Bitcoin Core node and persists them to Postgres) and an **API** (serves the indexed data over REST). A frontend
will consume the API later.

The project is a learning and portfolio piece, but every decision should be one we'd defend for a real
production deployment against mainnet.

**Goals**

1. Migrate both services from JavaScript to strict TypeScript.
2. Restructure into a monorepo with shared packages, following current industry practice.
3. Fix the correctness bugs in the existing code (see §2).
4. Make the indexer reorg-safe and fast enough to sync a real chain.
5. Publish a versioned, OpenAPI-described REST contract that the frontend (and the UI design agent) builds against.

**v1 scope:** blocks and transactions only — what exists today, done properly.

**Non-goals for v1** (recorded in §11 as future work): search, address pages, UTXO lookups, mempool, live push updates.

## 2. Review of the current code

The current layering (route → controller → service → DAO, factory-function DI) is sound and is kept in spirit.
Problems found:

**Correctness bugs**

- `GET /blocks/:hash` calls `blockService.getBlockByHash`, but the service exports `retrieveBlockByHash` — every call throws. It also returns an array and never 404s.
- `GET /transactions/:txid` with an unknown txid dereferences `undefined.id` → 500.
- `storeWitnessData` checks `witnessData.size` on an array (always `undefined`), so witness data is never stored.
- Transaction-level witness retrieval queries `witness_data.transaction_input_id` with a *transaction* id.
- The transaction migration creates `transaction_input` (FK → `script_sig`) before `script_sig` exists, so it likely fails on a fresh database.
- `getAddress` wraps `addresses` in another array and writes it to a string column.

**Design problems**

- `confirmations` and `next_block_hash` are frozen at index time and go stale.
- No reorg detection or handling: blocks are indexed by height without checking `previousblockhash`.
- BTC amounts stored as `decimal` and parsed with `parseFloat` — lossy. Industry norm is integer satoshis.
- One block per polling tick, then a full interval sleep: initial sync is extremely slow.
- No indexes on `block.hash` or `transaction.block_hash`; no input validation (strings passed through, unbounded `pageSize`); offset pagination.
- Code duplicated between the two apps (knexfile, identifier mapping, transaction read DAO).
- `script_sig` / `script_pub_key` tables are 1:1 with no dedup, which only adds joins.
- Node 16 (EOL), knex 0.95; bitcoind RPC published with `rpcallowip=0.0.0.0/0`; pruned node is incompatible with indexing from genesis.

## 3. Technology choices

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node 24 (Active LTS) | Current LTS |
| Language | TypeScript, `strict`, ESM | Goal of the migration |
| Monorepo | pnpm workspaces, `tsc` project references | Standard, lightweight, no extra build orchestrator needed |
| HTTP | Fastify | Async-native, fast, schema-driven, first-class TypeScript type providers |
| Schemas | TypeBox (API schemas *and* env config) | One definition → runtime validation + TS types + OpenAPI; one schema library across the repo |
| OpenAPI | `@fastify/swagger` (+ UI at `/docs`) | Generated from route schemas |
| Data access | Prisma (schema, migrations, client); `$queryRaw` (TypedSQL) as escape hatch | Readable schema, strong generated types, `BigInt` → JS `bigint` |
| Bitcoin script utils | `bitcoinjs-lib` | asm decoding on read |
| Logging | pino | Structured JSON, Fastify-native |
| Tests | Vitest + Testcontainers | Real Postgres and bitcoind (regtest) in integration tests |
| Lint/format | ESLint (flat config, typescript-eslint) + Prettier | Standard |
| Dev runner | `tsx` watch | Fast TS execution in development |

**Alternatives considered:** Express + knex with types added (weak query typing, awkward async error handling);
NestJS + an ORM (heavy for two small services; ORM write paths unsuited to bulk block ingestion); Kysely instead
of Prisma (also viable — Prisma chosen for schema readability and recognisability, made viable for bulk writes by
the key scheme in §5).

**Reference projects:** Fulcrum / ElectrumX for indexer key design and reorg handling;
`hirosystems/stacks-blockchain-api` for the Fastify + TypeBox + Postgres + generated-OpenAPI structure;
mempool.space for API shape and UI.

## 4. Repository layout

```
yabe/
├─ apps/
│  ├─ indexer/        # chain → Postgres sync worker
│  ├─ api/            # Fastify REST API
│  └─ web/            # (later) frontend
├─ packages/
│  ├─ db/             # Prisma schema, migrations, client factory, tx_num helpers
│  ├─ bitcoin-rpc/    # typed bitcoind JSON-RPC client (native fetch, timeouts, retries)
│  └─ shared/         # config loading (TypeBox), logger (pino), sats/hex utils, domain types
├─ docker/            # Dockerfiles
├─ docker-compose.yml
├─ .env.example
└─ docs/
```

Rule: apps depend on packages; apps never depend on each other.

## 5. Key scheme: `tx_num`

Transactions get a compact, **indexer-computed** 64-bit key instead of a database-generated serial id or the
32-byte txid:

```
tx_num = (block_height << 20) | position_in_block

 63                    20 19                 0
┌────────────────────────┬────────────────────┐
│     block height       │ position in block  │
└────────────────────────┴────────────────────┘
```

- 20 bits of position = 1,048,576 slots per block; the physical maximum is ~16k transactions per block.
- 43 bits of height in a signed `bigint`.
- Example: block 800,000, position 5 → `838860800005`.

Properties:

- **Deterministic:** re-indexing a block (after a crash or reorg) reproduces identical keys.
- **No DB round trips:** the indexer knows every key before inserting, so a block's rows are written with a few batched `createMany` calls.
- **Ordering by `tx_num` = chain order;** a block is the contiguous range `[h << 20, (h+1) << 20)`, so rollback is a range delete.
- **8 bytes per key** in every FK and index (vs 32 for txid).
- Gaps are expected and harmless. This differs from Fulcrum/ElectrumX `TxNum`, which is a dense global counter — document this on the helper.

The name is `tx_num` (never `tx_id`) to avoid confusion with `txid`.

Implementation must use `BigInt` — JS `<<` is 32-bit and silently overflows:

```ts
const TX_POS_BITS = 20n
export const toTxNum = (height: number, pos: number): bigint =>
  (BigInt(height) << TX_POS_BITS) | BigInt(pos)
export const fromTxNum = (txNum: bigint) => ({
  height: Number(txNum >> TX_POS_BITS),
  pos: Number(txNum & 0xfffffn),
})
```

`tx_num` is internal and never exposed by the API.

## 6. Database schema

Conventions: hashes and scripts are `bytea` (raw bytes; the API hex-encodes); amounts are `bigint` satoshis;
times are `timestamptz`; Prisma models are camelCase mapped to snake_case with `@map`.

### `block` — canonical chain only

| column | type | notes |
|---|---|---|
| `height` | int **PK** | |
| `hash` | bytea, unique | |
| `prev_hash` | bytea | reorg check |
| `merkle_root` | bytea | |
| `chainwork` | bytea | |
| `version` | int | |
| `bits` | bigint | uint32 |
| `nonce` | bigint | uint32 |
| `difficulty` | double precision | |
| `time` | timestamptz | |
| `median_time` | timestamptz | |
| `size`, `stripped_size`, `weight` | int | |
| `tx_count` | int | |
| `subsidy_sats` | bigint | computed: `5_000_000_000 >> (height / 210_000)` |
| `total_fee_sats` | bigint | computed: sum of tx fees |
| `total_out_sats` | bigint | computed: sum of non-coinbase outputs (matches `getblockstats.total_out`) |

`confirmations` and `next_hash` are not stored; they are derived on read.

### `transaction`

| column | type | notes |
|---|---|---|
| `tx_num` | bigint **PK** | §5 |
| `txid` | bytea, unique | |
| `wtxid` | bytea, nullable | only stored when it differs from `txid` |
| `block_height` | int, FK → `block.height` | |
| `version` | int | |
| `locktime` | bigint | |
| `size`, `vsize`, `weight` | int | |
| `input_count`, `output_count` | int | |
| `is_coinbase` | bool | |
| `fee_sats` | bigint, nullable | null for coinbase |

No stored per-transaction total output value (consistent with its recent removal); list views sum outputs at read time.

### `tx_output`

| column | type | notes |
|---|---|---|
| `tx_num` | bigint, FK → `transaction` | PK part |
| `vout` | int | PK part |
| `value_sats` | bigint | |
| `script_pubkey` | bytea | |
| `script_type` | enum | `p2pk`, `p2pkh`, `p2sh`, `p2wpkh`, `p2wsh`, `p2tr`, `multisig`, `op_return`, `witness_unknown`, `nonstandard` (final list from Bitcoin Core's `scriptPubKey.type` values) |
| `address` | text, nullable | as reported by the node |

### `tx_input`

| column | type | notes |
|---|---|---|
| `tx_num` | bigint, FK → `transaction` | PK part |
| `vin` | int | PK part |
| `prev_tx_num` | bigint, nullable | null for coinbase |
| `prev_vout` | int, nullable | null for coinbase |
| `sequence` | bigint | |
| `script_sig` | bytea | coinbase data for coinbase inputs |
| `witness` | bytea[] | replaces the `witness_data` table |

- **Unique index on `(prev_tx_num, prev_vout)`:** answers "is this output spent, and by whom", and rejects double-spend rows caused by indexer bugs. NULLs are distinct in Postgres, so coinbase inputs don't collide.
- **No FK from an input to the output it spends:** it would make every insert check against billions of rows, and it would conflict with the rollback order.

### `sync_state` — single row, written by the indexer

`network`, `node_tip_height`, `indexed_tip_height`, `updated_at`.

### Design notes

- `asm` is not stored; the API derives it from the raw script bytes with `bitcoinjs-lib`.
- Input values and addresses are not duplicated onto inputs; reads join `tx_output` by `(prev_tx_num, prev_vout)`, which is a primary-key lookup.
- FKs exist (input/output → transaction, transaction → block) but without cascades; rollback is explicit (§7).
- **Verify early:** Prisma support for `Bytes[]` on Postgres. Fallback: a `tx_input_witness(tx_num, vin, idx, data)` child table.
- Anything Prisma can't express goes into the generated migration SQL by hand.

## 7. Indexer

### Loop

1. **Reorg check:** compare the node's block hash at our indexed tip with our stored hash. If they differ, walk back (bounded by `REORG_MAX_DEPTH`, default 100) to the fork point and roll back in one DB transaction:
   1. `DELETE FROM tx_input WHERE tx_num >= fork << 20`
   2. `DELETE FROM tx_output WHERE tx_num >= fork << 20`
   3. `DELETE FROM transaction WHERE tx_num >= fork << 20`
   4. `DELETE FROM block WHERE height >= fork`

   A reorg deeper than the limit stops the indexer with a fatal error (it needs an operator) rather than corrupting data.
2. **Fetch:** `getblockhash` + `getblock <hash> 3` for the next heights. Verbosity 3 includes each input's `prevout` (value, script, address), so input values and fees come from the node. In catch-up mode, prefetch up to `PREFETCH_BLOCKS` (default 4) blocks concurrently; writes stay strictly sequential.
3. **Transform:** pure functions (no I/O) map RPC JSON to row objects, computing `tx_num`, block aggregates and script types. `prev_tx_num` is resolved with one batched `WHERE txid = ANY($1)` lookup per block, plus an in-memory map for spends of outputs created earlier in the same block.
4. **Write:** one DB transaction per block: insert the block, then `createMany` for transactions, outputs and inputs; update `sync_state`.
5. **At tip:** poll every `POLL_INTERVAL_MS` (default 5000). There is no fixed sleep between blocks during catch-up.

### Node requirements

A **non-pruned** Bitcoin Core node, version 23 or later (verbosity 3 needs undo data, and the indexer starts from genesis).

### Operations

- pino JSON logs with height, hash, transaction count and duration per block.
- Graceful shutdown on SIGTERM/SIGINT: finish the current block's DB transaction, then exit.
- RPC and DB errors retry with exponential backoff (capped); config errors fail fast at startup.

## 8. API

### Endpoints (versioned under `/v1`)

| Method | Path | Returns |
|---|---|---|
| GET | `/v1/status` | network, node tip, indexed tip, lag, `updatedAt` |
| GET | `/v1/blocks?before=<height>&limit=` | latest-first block summaries + `nextCursor` |
| GET | `/v1/blocks/:hashOrHeight` | block detail; a 64-character hex value is a hash, digits are a height |
| GET | `/v1/blocks/:hash/transactions?after=<pos>&limit=` | transaction summaries in block order + `nextCursor` |
| GET | `/v1/transactions/:txid` | full transaction detail |

Pagination is keyset-based (cursor). `limit` defaults to 25, maximum 100.

### Response conventions

- camelCase fields; hashes and scripts as lowercase hex.
- Amounts are integer satoshis as JSON numbers (max supply 2.1×10¹⁵ < 2⁵³, so exact). Formatting as BTC is the client's job.
- **Block summary:** `height`, `hash`, `time`, `txCount`, `size`, `weight`, `totalFee`, `subsidy`.
- **Block detail:** the summary plus `confirmations`, `prevHash`, `nextHash`, `merkleRoot`, `version`, `bits`, `nonce`, `difficulty`, `medianTime`, `strippedSize`, `chainwork`, `totalOut`.
- **Transaction summary:** `txid`, `position`, `isCoinbase`, `inputCount`, `outputCount`, `totalOut`, `fee`, `vsize`.
- **Transaction detail:**
  - `txid`, `wtxid`, `version`, `locktime`, `size`, `vsize`, `weight`, `fee`, `feeRate` (sat/vB), `confirmations`
  - `block` summary
  - `inputs[]` with `prevout { txid, vout, value, address, scriptType }`, `scriptSig { hex, asm }`, `witness[]`, `sequence`
  - `outputs[]` with `value`, `scriptPubKey { hex, asm, type, address }`, `spentBy { txid, vin } | null`
- `tx_num` is never exposed.

### Errors and hardening

- RFC 9457 `application/problem+json` (`type`, `title`, `status`, `detail`).
- Schema validation failure → 400; unknown block or transaction → 404; unexpected error → 500 with no internals leaked.
- `@fastify/helmet`, configurable CORS allow-list, `@fastify/rate-limit`, `Cache-Control: public, max-age=10`.

### OpenAPI contract

- TypeBox schemas on every route request and response.
- `pnpm openapi:export` writes `apps/api/openapi.json`, which is committed; CI fails on drift.
- This file is the contract for the frontend's generated client (`openapi-typescript`) and for the UI design agent.

### Code layout

```
apps/api/src/
├─ app.ts            # buildApp(deps) — used by server and tests
├─ server.ts         # config, listen, graceful shutdown
├─ plugins/          # prisma, errors, swagger, security
└─ modules/
   ├─ blocks/        # routes.ts · schemas.ts · service.ts · repository.ts
   ├─ transactions/
   └─ status/
```

## 9. Testing

| Layer | Scope | Approach |
|---|---|---|
| Unit | Transforms, `tx_num` helpers, subsidy, script types, hex/sats utils | Vitest with saved RPC fixtures: genesis, a coinbase-only block, segwit, taproot, OP_RETURN, bare multisig, a large block |
| Indexer integration | Sync loop end to end | Testcontainers Postgres + bitcoind **regtest**: mine blocks, send transactions, index, check rows. **Reorg test:** index to N, `invalidateblock`, mine a longer competing branch, check rollback and the re-indexed state |
| API integration | Routes, validation, errors, pagination | Testcontainers Postgres seeded from fixtures; `app.inject()` |
| Contract | OpenAPI drift | CI regenerates and diffs `openapi.json` |

## 10. Local development, Docker and CI

### Networks

- **Signet** is the local development default.
- **Regtest** is used by automated tests.
- **Mainnet** is the production target.

The network is a config value, validated against the node at startup and reported by `/v1/status`.

### Docker Compose services

| Service | Role |
|---|---|
| `postgres` | database, with a health check |
| `bitcoind` | Bitcoin Core, **maintained pinned image** (chosen during planning; replaces `ruimarinho/bitcoin-core`) |
| `migrate` | one-shot `prisma migrate deploy` |
| `indexer` | sync worker |
| `api` | REST API |

- `depends_on: condition: service_healthy` / `service_completed_successfully` replaces the 30-attempt retry loop in the current entrypoint.
- **Security:**
  - The RPC port is bound to `127.0.0.1` only.
  - `rpcallowip` is restricted to the compose network.
  - `rpcauth` is used instead of a plaintext `rpcpassword`.
  - Pruning is removed.
- **Images:** multi-stage Dockerfiles, `pnpm deploy` for production dependencies, `node:24-slim`, non-root user.
- **Dev workflow:** run only `postgres` + `bitcoind` in Compose and the apps on the host with `pnpm dev` (`tsx` watch).
- **Config:** one root `.env.example`; each app validates its env with TypeBox at startup and exits with a clear message if it's invalid.

### CI (GitHub Actions, every PR)

Install (pnpm cache) → lint → typecheck → unit tests → integration tests (Testcontainers) → OpenAPI drift check → Docker image build.

### Migration path

1. Work on a feature branch.
2. No data migration — re-index from genesis.
3. Build order:
   1. monorepo scaffold and tooling
   2. `packages/shared`
   3. `packages/bitcoin-rpc`
   4. `packages/db` (schema, migrations, `tx_num`)
   5. `apps/indexer`, with the reorg tests
   6. `apps/api`
   7. Docker, Compose and CI
4. `yabe-backend/` stays as a reference until the new stack matches it, then is deleted on the same branch.

## 11. Future work (not in v1)

- `/v1/search` (height, block hash, txid, address)
- Address pages: balance, history, UTXOs (enabled by the `(prev_tx_num, prev_vout)` spend link; needs an address index)
- Mempool and fee estimates
- SSE or WebSocket push for new blocks
- ZMQ `hashblock` notifications instead of polling
- Per-block fee-rate statistics (min, median, max)
- Prometheus metrics
- Bulk-load tuning for the initial mainnet sync (deferred index creation, `COPY`)

## 12. Items to verify during planning

- Prisma `Bytes[]` support on Postgres (fallback in §6).
- A maintained, pinned Bitcoin Core Docker image.
- Current signet chain size, for the README's disk requirements.
- The exact `scriptPubKey.type` values in the target Bitcoin Core version (for the `script_type` enum).

## 13. Addendum: decisions made during implementation planning

- **`transaction.txid` is indexed, not unique.** Mainnet has two BIP30 duplicate coinbase txids (heights 91842 and 91880). Lookups return the highest `tx_num`; prevout resolution prefers the newest occurrence.
- **`script_type` uses Bitcoin Core's names verbatim** (`pubkeyhash`, `witness_v0_keyhash`, `witness_v1_taproot`, `anchor`, …). An unknown type stops the indexer, which makes a schema update necessary.
- **The subsidy halving interval depends on the network:** 210,000, except regtest at 150.
- **Transaction `version` is `bigint`,** because it is uint32 in Bitcoin Core.
- **The API always returns `wtxid`,** equal to `txid` for non-witness transactions.
- **`/v1/blocks/:hashOrHeight/transactions` also accepts a height.**
- **Builds:** per-package `tsc` builds in pnpm's topological order. Dev, tests and typecheck resolve workspace packages to source through the `@yabe/source` export condition. Apps set `declaration: false`.
- **Pinned versions:** Bitcoin Core image `bitcoin/bitcoin:31.1` (community-built; it verifies official release signatures), `postgres:18-alpine`, Prisma 7.10.
- **`Bytes[]` is supported** by Prisma on Postgres, so `witness` is a `bytea[]` column and the child-table fallback is unused.
- **The OpenAPI drift check** is a unit test (`apps/api/src/openapi.test.ts`) that compares the generated spec with the committed `apps/api/openapi.json`.
