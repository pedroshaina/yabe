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
