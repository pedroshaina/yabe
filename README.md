![Yet Another Block Explorer](yabe-logo.png 'Y.A.B.E - Yet Another Block Explorer')

YABE is a Bitcoin block explorer backend with two parts: an **indexer**, which reads blocks from Bitcoin Core into Postgres and handles chain reorgs, and a **REST API** over the indexed data. The API is described by OpenAPI in [`apps/api/openapi.json`](apps/api/openapi.json), with an interactive UI at `/docs`.

## Layout

| Path                   | What                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ |
| `apps/indexer`         | Sync worker: `getblock` (verbosity 3) → Postgres, one DB transaction per block |
| `apps/api`             | Fastify REST API (`/v1`), TypeBox schemas, generated OpenAPI                   |
| `packages/db`          | Prisma schema and migrations, `tx_num` key helpers, test utilities             |
| `packages/bitcoin-rpc` | Typed Bitcoin Core JSON-RPC client                                             |
| `packages/shared`      | Config loading, logging, hex/satoshi utilities                                 |

The design is in `docs/superpowers/specs/2026-10-01-backend-typescript-restructure-design.md`.

## Design decisions

**Compact, computed transaction keys.** Every transaction is keyed by `tx_num = (block_height << 20) | position_in_block`, a 64-bit integer the indexer computes itself. Storing 32-byte txids in every foreign key would add tens to hundreds of GB of index on mainnet, and database-generated serial ids would force a round trip per insert. Computed keys avoid both: a whole block is written in a few batched inserts, re-indexing produces identical keys, and a block is a contiguous key range. Fulcrum and ElectrumX use the same idea (`TxNum`). The txid remains as an indexed lookup column.

**Reorgs are first-class.** Before indexing, the indexer compares its tip with the node's. On a mismatch it walks back to the fork point and deletes everything above it in one database transaction (a range delete, thanks to `tx_num`), then follows the new branch. A node that is merely behind (restarting or resyncing) is waited for rather than treated as a reorg, and a reorg deeper than `REORG_MAX_DEPTH` stops the indexer instead of guessing.

**One database transaction per block.** A block's rows, including the resolution of each input to the output it spends, are written atomically. A crash or a failed RPC call never leaves a half-written block, and errors that would fail the same way on every retry (an unknown script type, a missing fee, wrong RPC credentials) stop the indexer with a clear message instead of looping.

**Bitcoin details done properly.**

- Amounts are integer satoshis (`bigint`), never floats.
- Values that go stale (confirmations, next block hash) are computed when read rather than stored.
- `getblock` verbosity 3 supplies input values and fees directly from the node.
- The two historical duplicate txids on mainnet (BIP30, blocks 91842 and 91880) are handled: lookups return the newest occurrence.

**Tested against a real node.** Besides unit tests on pure transform functions, the integration suite starts Postgres and a Bitcoin Core regtest node in containers. It mines blocks, sends a real wallet transaction, checks the indexed totals against the node's own `getblockstats`, and then forces a reorg with `invalidateblock` to verify rollback and re-indexing.

**Contract first.** Every route declares TypeBox schemas, which give runtime validation, TypeScript types and the generated OpenAPI document. `apps/api/openapi.json` is committed, and a test fails if it drifts from the code, so the frontend can generate a typed client from it.

## Known limitations and next steps

Deliberately out of scope for v1:

- address pages and search
- mempool and fee estimates
- live updates over SSE or WebSocket
- ZMQ block notifications instead of polling

Before running on mainnet:

- **Initial sync:** tune bulk loading (deferred index creation, `COPY`), make the per-block database timeout configurable, and leave more headroom for blocks with very many transactions.
- **API at scale:** paginate the inputs and outputs of very large transactions, support `trustProxy` for rate limiting behind a proxy, and return 503 when the database is down.
- **Images:** pin by digest, slim the images, and run the migration image as a non-root user.
- **Startup checks:** verify that the database's recorded network matches `BITCOIN_NETWORK`.
- **Script display:** render ASM for unassigned opcodes and for `OP_CHECKLOCKTIMEVERIFY`/`OP_CHECKSEQUENCEVERIFY` correctly.

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
