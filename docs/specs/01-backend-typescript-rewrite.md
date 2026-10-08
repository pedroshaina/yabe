# Backend rewrite in TypeScript

- **Date:** 2026-10-08
- **Status:** Accepted

## Context

yabe's backend is two Node.js (JavaScript) services: an indexer that copies blocks from a Bitcoin node into Postgres, and an Express API that serves them. It works, but it has no types or tests and doesn't handle chain reorganisations, so its data can silently go stale. It also stores values that change over time (such as confirmations) and keeps amounts as BTC decimals.

yabe is a portfolio and learning project, so the rewrite favours a clear design and solid engineering over scale.

## Goals

- Browse the latest blocks, view a block and its transactions, view a transaction, and search by block height, block hash or txid.
- Show, for each transaction input, the value and address of the output it spends.
- **Stay correct across chain reorganisations.** This is the main correctness requirement, and an automated test proves it.
- Publish the API as an **OpenAPI contract** that a separate frontend project can build on.
- Run everything with one command (`docker compose up`) against **signet**, and test against **regtest**.

## Out of scope for now

- **Address pages** (balances and history). They come next, and the data model already records which input spends each output so they can be added without a redesign.
- The frontend (a separate project), mempool and fee estimates, live updates, rate limiting and auth.
- **Mainnet.** Nothing in the design is network-specific, but the practical limits are listed below.

## Architecture

```
┌──────────┐  JSON-RPC  ┌──────────────┐  writes  ┌──────────┐  reads (read-only role)  ┌──────────┐
│ bitcoind │ ─────────▶ │ yabe-indexer │ ───────▶ │ Postgres │ ◀─────────────────────── │ yabe-api │ ◀── HTTP
└──────────┘            └──────────────┘          └──────────┘                          └──────────┘
```

- **Two services in one monorepo.** The indexer is the only writer and the API only reads, through a read-only database role. The services share a database package, never each other's code, so the schema is their only contract.
- **Only the main chain is stored.** When the node switches to a different chain tip, the indexer finds where the chains diverge and atomically removes the abandoned blocks before continuing. Each block is written in its own database transaction, so a crash at any point leaves consistent data and the indexer resumes where it stopped.
- **Untrusted input is validated at the edges:** node responses, environment config and HTTP requests are all schema-checked.
- Amounts are **integer satoshis**. Values that change over time, such as confirmations, are computed when read rather than stored.

## Key decisions

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

## Known limitations

Pointing yabe at mainnet would work in principle but hit three practical limits:

1. **Database size.** Storing every transaction's scripts and witnesses would reach several terabytes. Mainnet would store less and fetch details from the node on demand.
2. **Initial sync time.** Writing block by block would take weeks. Mainnet would need bulk loading and indexes built after the initial load.
3. **Pruned nodes.** A pruned node discards the data the indexer reads once the node has moved past it. Mainnet would need an unpruned node or an indexer kept in step with it.

Also: very large transactions are returned in a single response, and new blocks are detected by polling rather than push notifications.
