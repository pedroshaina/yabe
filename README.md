![Yet Another Block Explorer](yabe-logo.png "Y.A.B.E - Yet Another Block Explorer")

# yabe

[https://yabe.pdrlabs.com.br](https://yabe.pdrlabs.com.br)

**Yet Another Block Explorer**: a Bitcoin indexer, a read-only REST API and a web frontend, written in TypeScript. The indexer copies the chain from a Bitcoin Core node into Postgres and keeps it correct across chain reorganisations. The API serves blocks, transactions and search, described by a committed OpenAPI contract. The frontend is built on that contract.

It runs against **signet** with one command and is tested against **regtest**.

## Architecture

```
┌──────────┐  JSON-RPC  ┌──────────────┐  writes  ┌──────────┐  reads (read-only role)  ┌──────────┐  HTTP  ┌──────────┐
│ bitcoind │ ─────────▶ │ yabe-indexer │ ───────▶ │ Postgres │ ◀─────────────────────── │ yabe-api │ ◀───── │ yabe-web │ ◀── browser
└──────────┘            └──────────────┘          └──────────┘                          └──────────┘        └──────────┘
```

- **The indexer is the only writer, and the API only reads**, through a database role that can't write. The two services share a database package, never each other's code, so the schema is their only contract.
- **Only the main chain is stored.** When the node switches to a different tip, the indexer finds where the chains diverge and atomically removes the abandoned blocks before continuing. Each block is written in its own transaction, so a crash at any point leaves consistent data and the indexer resumes where it stopped.
- **Untrusted input is validated at the edges:** node responses, environment config and HTTP requests are all schema-checked.
- **Amounts are integer satoshis.** Values that change over time, such as confirmations, are computed when read rather than stored.

```
apps/indexer    bitcoind → Postgres (writes)
apps/api        Postgres → HTTP (reads only)
apps/web        the frontend (Next.js), API → HTML
packages/db     Prisma schema, migrations, typed SQL, the shared client
e2e             end-to-end tests (Playwright) against the whole stack on regtest
```

## Quick start

You need Docker (or Podman) with Compose.

```bash
git clone https://github.com/pedroshaina/yabe.git && cd yabe
cp .env.example .env    # then change the passwords (see "Configuration")
docker compose up -d
```

This starts six containers:

| Container           | What it does                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `bitcoind`          | Bitcoin Core 31.1 on signet (unpruned), RPC authenticated with `rpcauth`                             |
| `yabe-db`           | Postgres 18; creates the `yabe_indexer` (read-write) and `yabe_api` (read-only) roles on first start |
| `yabe-db-migration` | Applies the database migrations, then exits                                                          |
| `yabe-indexer`      | Starts once the migration succeeds and bitcoind is healthy, then follows the chain                   |
| `yabe-api`          | Starts once the migration succeeds; serves http://127.0.0.1:8080                                     |
| `yabe-web`          | Starts once the API is healthy; serves the frontend on http://127.0.0.1:3000                         |

Open **http://127.0.0.1:3000** to browse the chain, or **http://127.0.0.1:8080/docs** to explore the API. The node first syncs signet from the network, and the indexer follows it, so recent blocks appear as both catch up. Follow progress with `docker compose logs -f yabe-indexer`. A fully indexed signet takes tens of gigabytes of disk for the node and the database together.

Every port is published on 127.0.0.1 only (frontend 3000, API 8080, Postgres 5432, RPC 38332), so nothing is reachable from your network.

**If the indexer stops.** It waits out outages of the node or the database however long they last, retrying at most every 30 seconds. It exits only on an error a restart can't fix, for example a chain reorganisation deeper than `INDEXER_MAX_REORG_DEPTH`, a node on the wrong network, or wrong credentials. The container is then restarted up to 5 times (counted since Compose last started or recreated it) and left stopped rather than restarting forever. `docker compose ps -a` shows it as exited and `docker compose logs yabe-indexer` says why. Once the cause is fixed (for example a larger `INDEXER_MAX_REORG_DEPTH` in `.env`), `docker compose up -d yabe-indexer` starts it again. After a host or Docker restart, run `docker compose up -d`: on Docker the other services come back by themselves but the indexer does not, and on Podman none of them do.

**If the indexer is up but not advancing**, `/v1/status` falls behind and its logs repeat `transient error, retrying`. After about 3 minutes without progress these become errors saying the node or database is down or misconfigured. A mistyped host or port in the node or database URL, or an `INDEXER_BITCOIN_RPC_TIMEOUT_MS` too short for a large block, looks the same as an outage, so the indexer keeps retrying instead of exiting.

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
- **`WEB_API_URL`**: where the frontend reaches the API when it runs on your machine (`pnpm dev:web`). In Compose, `yabe-web` uses `http://yabe-api:8080`.
- **`API_CORS_ORIGINS`**: the browser origins allowed to call the API, comma-separated (for example `http://localhost:5173`).
- **`API_PUBLIC_PREFIX`**: the path a reverse proxy strips before requests reach the API, for example `/api` when `/api/v1/blocks` arrives as `/v1/blocks`. The routes stay at the root; the prefix makes Swagger UI load at `/api/docs` and adds it to the document's `servers`, so "Try it out" calls `/api/v1/...`. Unset by default, as Compose publishes the API directly.

## Frontend

A Next.js app (`apps/web`) for browsing the indexed chain: the latest blocks as a timeline, block and transaction pages, search by height, hash or txid, light and dark themes, and phone layouts. Pages are rendered on the server, which calls the API over the Compose network. The browser only talks to the frontend.

- With the stack running, open http://127.0.0.1:3000.
- It is typed from the committed OpenAPI contract (`pnpm web:types`); CI fails if the types drift.
- The design and its decisions are in [`docs/specs/02-frontend.md`](docs/specs/02-frontend.md).

## Images

Every push to `master` that passes CI and the end-to-end suite publishes four public images to GitHub Container Registry, all built from that commit and tagged with its full SHA:

- `ghcr.io/pedroshaina/yabe-indexer`
- `ghcr.io/pedroshaina/yabe-api`
- `ghcr.io/pedroshaina/yabe-db-migration`
- `ghcr.io/pedroshaina/yabe-web`

There is no `latest` tag: deployments pin `tag@sha256:digest`. The release run's summary lists all four references. They are `linux/amd64` only. CI and the end-to-end suite check the runtime interface deployments rely on: the `INDEXER_*` and `API_*` variables, `/health` and `/ready`, a clean SIGTERM shutdown, JSON logs on stdout, the non-root `node` user, and the migration image running `prisma migrate deploy`. See [`docs/specs/03-image-publishing.md`](docs/specs/03-image-publishing.md).

## Development

Requirements: Node.js 24 (see `.nvmrc`), pnpm 10 (`corepack enable`), and Docker or Podman.

```bash
pnpm install
docker compose up -d bitcoind yabe-db-migration   # the node, the database and its migrations
pnpm dev                                          # the indexer, the API and the frontend, on your machine
```

- If the full stack is running, stop its apps first: `docker compose stop yabe-indexer yabe-api yabe-web`. Run only one indexer at a time; a second one would fail on the first block both try to write. And while the `yabe-api` container runs, http://127.0.0.1:8080 keeps reaching it rather than your local API.
- `pnpm dev:indexer`, `pnpm dev:api` and `pnpm dev:web` run one app each. The frontend (http://localhost:3000) reaches the API at `WEB_API_URL`. It shares port 3000 with the `yabe-web` container, so stop one of the two. On Ctrl-C, pnpm reports exit code 130 (its own convention for an interrupted run); the app itself shuts down cleanly.

| Command                                           | Does                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                                       | Unit and integration tests. Testcontainers starts throwaway Postgres and regtest bitcoind containers, so only Docker is needed                                                                                                                                   |
| `pnpm lint`, `pnpm typecheck`, `pnpm format`      | ESLint, the TypeScript compiler, Prettier                                                                                                                                                                                                                        |
| `pnpm build`                                      | Builds every package: `tsc`, and `next build` for the frontend                                                                                                                                                                                                   |
| `pnpm openapi`                                    | Regenerates `apps/api/openapi.json` from the routes                                                                                                                                                                                                              |
| `pnpm db:generate`                                | Regenerates the Prisma client and typed SQL                                                                                                                                                                                                                      |
| `pnpm e2e`                                        | The end-to-end suite: builds the images, starts the whole stack on regtest (project `yabe-e2e`, ports 13000 and 18080), mines a known chain, runs Playwright and tears it all down. Leaves your signet stack untouched. Run `pnpm e2e:install` once for Chromium |
| `pnpm e2e:up`, `e2e:seed`, `e2e:test`, `e2e:down` | The same steps one at a time, to keep the stack up while you iterate on specs (`pnpm e2e:test search` runs one file)                                                                                                                                             |
| `pnpm web:types`                                  | Regenerates the frontend's API types after a contract change                                                                                                                                                                                                     |

With Podman, set `TESTCONTAINERS_RYUK_DISABLED=true` before `pnpm test`.

### Testing

- **Unit tests** cover the pure parts: turning a block into rows, subsidy and fee arithmetic, configuration, error classification and script asm. The asm decoder is checked against output captured from Bitcoin Core itself.
- **Integration tests** run against real systems, not mocks. They mine regtest blocks containing real transactions and check every stored row. They force a **chain reorganisation** and assert the database matches the node afterwards. They also exercise every API endpoint against a seeded Postgres through the read-only role.
- **End-to-end tests** (Playwright) run against the whole Compose stack on regtest. They cover the API, the frontend's journeys (browsing, search, not found, paging, the theme, the phone layout), an API outage and recovery, and axe accessibility checks in both themes.
- **CI** (GitHub Actions) runs format, lint, type-check, build, the tests, the OpenAPI and frontend type drift checks and the image builds on every pull request. The end-to-end suite runs when `master` is updated, and the images are published only if it and CI pass.

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

The full decision records are [`docs/specs/01-backend-typescript-rewrite.md`](docs/specs/01-backend-typescript-rewrite.md) (the backend), [`docs/specs/02-frontend.md`](docs/specs/02-frontend.md) (the frontend) and [`docs/specs/03-image-publishing.md`](docs/specs/03-image-publishing.md) (publishing the images).

## Known limitations

Nothing in the design is specific to signet, but pointing yabe at mainnet would hit three practical limits:

1. **Database size.** Storing every transaction's scripts and witnesses would reach several terabytes. Mainnet would store less and fetch details from the node on demand.
2. **Initial sync time.** Writing block by block would take weeks. Mainnet would need bulk loading and indexes built after the initial load.
3. **Pruned nodes.** A pruned node discards the data the indexer reads once the node has moved past it. Mainnet needs an unpruned node or an indexer kept in step with it.

Also:

- Very large transactions are returned in a single response.
- New blocks are detected by polling, not push notifications.
- There is no rate limiting, HTTP caching or authentication.

**Not built yet:** address pages (the data model already records which input spends each output), the mempool, and live updates. The frontend lives in `apps/web` (see [Frontend](#frontend)).
