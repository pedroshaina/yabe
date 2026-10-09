![Yet Another Block Explorer](yabe-logo.png "Y.A.B.E - Yet Another Block Explorer")

# yabe

**Yet Another Block Explorer**: a Bitcoin indexer and a read-only REST API, written in TypeScript. The indexer copies the chain from a Bitcoin Core node into Postgres and keeps it correct across chain reorganisations. The API serves blocks, transactions and search, described by a committed OpenAPI contract that a frontend can build on.

It runs against **signet** with one command and is tested against **regtest**.

## Architecture

```
┌──────────┐  JSON-RPC  ┌──────────────┐  writes  ┌──────────┐  reads (read-only role)  ┌──────────┐
│ bitcoind │ ─────────▶ │ yabe-indexer │ ───────▶ │ Postgres │ ◀─────────────────────── │ yabe-api │ ◀── HTTP
└──────────┘            └──────────────┘          └──────────┘                          └──────────┘
```

- **The indexer is the only writer, and the API only reads**, through a database role that can't write. The two services share a database package, never each other's code, so the schema is their only contract.
- **Only the main chain is stored.** When the node switches to a different tip, the indexer finds where the chains diverge and atomically removes the abandoned blocks before continuing. Each block is written in its own transaction, so a crash at any point leaves consistent data and the indexer resumes where it stopped.
- **Untrusted input is validated at the edges:** node responses, environment config and HTTP requests are all schema-checked.
- **Amounts are integer satoshis.** Values that change over time, such as confirmations, are computed when read rather than stored.

```
apps/indexer    bitcoind → Postgres (writes)
apps/api        Postgres → HTTP (reads only)
packages/db     Prisma schema, migrations, typed SQL, the shared client
```

## Quick start

You need Docker (or Podman) with Compose.

```bash
git clone https://github.com/pedroshaina/yabe.git && cd yabe
cp .env.example .env    # then change the passwords (see "Configuration")
docker compose up -d
```

This starts five containers:

| Container           | What it does                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `bitcoind`          | Bitcoin Core 31.1 on signet (unpruned), RPC authenticated with `rpcauth`                             |
| `yabe-db`           | Postgres 18; creates the `yabe_indexer` (read-write) and `yabe_api` (read-only) roles on first start |
| `yabe-db-migration` | Applies the database migrations, then exits                                                          |
| `yabe-indexer`      | Starts once the migration succeeds and bitcoind is healthy, then follows the chain                   |
| `yabe-api`          | Starts once the migration succeeds; serves http://127.0.0.1:8080                                     |

Open **http://127.0.0.1:8080/docs** to explore the API. The node first syncs signet from the network, and the indexer follows it, so recent blocks appear as both catch up. Follow progress with `docker compose logs -f yabe-indexer`. A fully indexed signet takes tens of gigabytes of disk for the node and the database together.

Every port is published on 127.0.0.1 only (API 8080, Postgres 5432, RPC 38332), so nothing is reachable from your network.

**If the indexer stops.** It waits out outages of the node or the database however long they last, retrying at most every 30 seconds. It exits only on an error a restart can't fix: a chain reorganisation deeper than `INDEXER_MAX_REORG_DEPTH`, or a node on the wrong network. The container is then restarted up to 5 times (counted since the last `docker compose up`) and left stopped rather than restarting forever. `docker compose ps -a` shows it as exited and `docker compose logs yabe-indexer` says why. Once the cause is fixed (for example a larger `INDEXER_MAX_REORG_DEPTH` in `.env`), `docker compose up -d yabe-indexer` starts it again and resets the count. After a host or Docker restart, run `docker compose up -d`: on Docker the other services come back by themselves but the indexer does not, and on Podman none of them do.

## The API

| Endpoint                                           | Returns                                                                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/status`                                   | The highest indexed block                                                                                                                                            |
| `GET /v1/blocks?limit=&before=`                    | Latest blocks, newest first; `next` is the cursor for the following page                                                                                             |
| `GET /v1/blocks/{height or hash}`                  | A block, with confirmations, reward and the next block's hash                                                                                                        |
| `GET /v1/blocks/{hash}/transactions?limit=&after=` | A block's transactions in order, with input and output totals                                                                                                        |
| `GET /v1/transactions/{txid}`                      | A transaction: each input with the value and address it spends, each output with the transaction that spent it, fee rate, and script asm identical to Bitcoin Core's |
| `GET /v1/search?q=`                                | Finds a block by height or hash, or a transaction by txid                                                                                                            |
| `GET /health`, `GET /ready`                        | Liveness, and readiness (the database answers)                                                                                                                       |

- Amounts are integer **satoshis**, times are **unix seconds**, the fee rate is **sat/vB**.
- Pagination uses **cursors**, so pages don't shift as new blocks arrive. Omit `before`/`after` for the first page.
- Errors are [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) `application/problem+json`: 400 for bad input, 404 for unknown resources, 503 while the database is unavailable.
- The contract is committed at [`apps/api/openapi.json`](apps/api/openapi.json) and served at `/openapi.json`. CI fails if it drifts from the routes.

## Configuration

Everything is configured through `.env`, documented in [`.env.example`](.env.example):

- **Postgres and role passwords** (`POSTGRES_*`, `YABE_INDEXER_PASSWORD`, `YABE_API_PASSWORD`). Role passwords end up in connection URLs, so keep them URL-safe, for example `openssl rand -hex 32`. They take effect only when the database volume is first created.
- **Bitcoin Core RPC credentials.** Generate all three lines with `pnpm --filter @yabe/indexer rpcauth <user> <password>`. Compose reads the whole file, so `BITCOIN_RPC_AUTH` must be set even to start just the database.
- **App settings**, prefixed with the app's name: `INDEXER_…` and `API_…`, plus a shared `LOG_LEVEL`. In Compose, the containers get their connection URLs from `compose.yaml`; the URLs in `.env` are for running the apps on your machine.
- **`API_CORS_ORIGINS`**: the browser origins allowed to call the API, comma-separated (for example `http://localhost:5173`).

## Development

Requirements: Node.js 24 (see `.nvmrc`), pnpm 10 (`corepack enable`), and Docker or Podman.

```bash
pnpm install
docker compose up -d bitcoind yabe-db-migration   # the node, the database and its migrations
pnpm dev                                          # the indexer and the API, on your machine
```

- If the full stack is running, stop its apps first: `docker compose stop yabe-indexer yabe-api`. Run only one indexer at a time; a second one would fail on the first block both try to write. And while the `yabe-api` container runs, http://127.0.0.1:8080 keeps reaching it rather than your local API.
- `pnpm dev:indexer` and `pnpm dev:api` run one app each. On Ctrl-C, pnpm reports exit code 130 (its own convention for an interrupted run); the app itself shuts down cleanly.

| Command                                      | Does                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm test`                                  | Unit and integration tests. Testcontainers starts throwaway Postgres and regtest bitcoind containers, so only Docker is needed                               |
| `pnpm lint`, `pnpm typecheck`, `pnpm format` | ESLint, the TypeScript compiler, Prettier                                                                                                                    |
| `pnpm build`                                 | Compiles every package with `tsc`                                                                                                                            |
| `pnpm openapi`                               | Regenerates `apps/api/openapi.json` from the routes                                                                                                          |
| `pnpm db:generate`                           | Regenerates the Prisma client and typed SQL                                                                                                                  |
| `./scripts/smoke.sh`                         | The whole Compose stack on regtest: mines blocks with a real spend and checks the API serves them. Needs curl and jq, and leaves your signet stack untouched |

With Podman, set `TESTCONTAINERS_RYUK_DISABLED=true` before `pnpm test`.

### Testing

- **Unit tests** cover the pure parts: turning a block into rows, subsidy and fee arithmetic, configuration, error classification and script asm. The asm decoder is checked against output captured from Bitcoin Core itself.
- **Integration tests** run against real systems, not mocks. They mine regtest blocks containing real transactions and check every stored row. They force a **chain reorganisation** and assert the database matches the node afterwards. They also exercise every API endpoint against a seeded Postgres through the read-only role.
- **CI** (GitHub Actions) runs format, lint, type-check, build, the tests, the OpenAPI drift check and the image builds on every pull request. The regtest smoke test runs when `master` is updated.

## Design decisions

| Decision         | Chosen                                                        | Alternatives considered                                               | Why                                                                                                           |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| System shape     | Indexer and API as separate services, one repo                | One combined service; a thin index that fetches details from the node | Separate failure and restart, a read-only API, and Postgres keeps the data address pages will need            |
| Runtime and repo | Node.js 24 LTS, pnpm workspaces                               | Bun; npm workspaces; Turborepo or Nx                                  | Mainstream and stable; pnpm's strict dependencies catch mistakes; three packages don't need an orchestrator   |
| Database access  | Prisma, with typed raw SQL for the indexer's heaviest queries | Drizzle, Kysely, raw SQL                                              | A well-known ORM for most queries, with real SQL where the work is SQL-shaped                                 |
| HTTP framework   | Fastify                                                       | Express, Hono, NestJS                                                 | Route schemas both validate requests and generate the OpenAPI contract, so the docs can't drift from the code |
| Schemas          | zod                                                           | TypeBox, hand-written JSON Schema                                     | Widely known, readable, and shareable with the frontend                                                       |
| Node client      | A small typed JSON-RPC client written for this project        | Existing npm clients; parsing raw blocks                              | Typed and dependency-free; validates the node's responses at runtime                                          |
| Testing          | Vitest, with Testcontainers for real Postgres and regtest     | Jest; mocks; a manually started test stack                            | The important claims (sync, reorgs, SQL) are tested against real systems, with one command                    |
| Pagination       | Cursors                                                       | Page numbers                                                          | Results don't shift as new blocks arrive                                                                      |
| Errors           | RFC 9457 problem+json                                         | Ad hoc error bodies                                                   | A standard, predictable error format                                                                          |
| Tooling          | ESLint + Prettier, pino, GitHub Actions                       | Biome, winston                                                        | Industry-standard choices                                                                                     |

The full decision record is in [`docs/specs/01-backend-typescript-rewrite.md`](docs/specs/01-backend-typescript-rewrite.md).

## Known limitations

Nothing in the design is specific to signet, but pointing yabe at mainnet would hit three practical limits:

1. **Database size.** Storing every transaction's scripts and witnesses would reach several terabytes. Mainnet would store less and fetch details from the node on demand.
2. **Initial sync time.** Writing block by block would take weeks. Mainnet would need bulk loading and indexes built after the initial load.
3. **Pruned nodes.** A pruned node discards the data the indexer reads once the node has moved past it. Mainnet needs an unpruned node or an indexer kept in step with it.

Also:

- Very large transactions are returned in a single response.
- New blocks are detected by polling, not push notifications.
- There is no rate limiting, HTTP caching or authentication.

**Not built yet:** address pages (the data model already records which input spends each output), the mempool, and live updates. The frontend is a separate project built on the OpenAPI contract.
