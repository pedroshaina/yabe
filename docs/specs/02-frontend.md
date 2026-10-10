# Web frontend

- **Date:** 2026-10-10
- **Status:** Accepted

## Context

yabe has an indexer and a read-only REST API, described by a committed OpenAPI contract. This adds the web frontend for browsing that data. It revises one point of [01](01-backend-typescript-rewrite.md): the frontend lives in this repository rather than in a separate project.

yabe is a portfolio and learning project, so the frontend favours a simple, consistent design and solid engineering over features.

## Goals

- Browse the latest blocks as a timeline, load older ones, and be offered new blocks as they arrive.
- Search by block height, block hash or txid.
- View a block with its transactions, and a transaction with where its funds came from and went.
- Light and dark themes, and every page usable on a phone.
- Start with the rest of the stack from one `docker compose up`.

## Out of scope for now

- **Address pages.** The API doesn't serve them yet, so addresses are shown as plain text.
- **Unconfirmed transactions.** The API only knows confirmed ones.
- **Multiple networks.** The network selector lists Signet, Testnet and Mainnet, but only Signet can be chosen until the indexer and API support several networks.
- Fiat prices, charts, statistics, translations, and links to the API documentation.

## Architecture

```
browser ──▶ yabe-web (Next.js) ──▶ yabe-api ──▶ Postgres
```

- **The browser only talks to the frontend.** Pages are rendered on the server, which calls the API over the internal Compose network. The few requests the browser makes by itself (loading more items, checking for new blocks) go through a small read-only route in the frontend that forwards only the API endpoints the UI uses. There's no cross-origin access and no public API dependency.
- **Typed from the contract.** The frontend's API types are generated from the committed OpenAPI contract, and CI fails if they fall out of date. The frontend depends on the contract, never on the API's code.
- **Always fresh.** Pages are rendered per request and nothing is cached: confirmations change with every block, and a block abandoned in a chain reorganisation must disappear rather than linger in a cache.
- **Calm live updates.** The home page checks for new blocks every 30 seconds and offers them with a "new blocks" prompt instead of moving content under the reader.
- **Loading and failures.** Pages show skeletons of their layout while data loads. If the API can't be reached, a toast explains it and offers a retry; a block or transaction that doesn't exist gets a "not found" page.

## Key decisions

| Decision   | Chosen                                                                                                  | Alternatives considered                             | Why                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Location   | `apps/web` in this monorepo                                                                             | A separate repository                               | Shares the workspace, CI and Compose stack; an API contract change breaks the frontend in the same pull request                                                                                 |
| Framework  | Next.js (App Router) with React                                                                         | Vite + React single-page app; Astro                 | An explorer is "read data for this URL and show it", which server rendering does well; pages arrive complete and the API stays private                                                          |
| Styling    | CSS Modules with CSS custom properties                                                                  | Tailwind; styled-components; vanilla-extract        | Built in, no runtime cost, works with server rendering; the small design token set maps directly to CSS variables. styled-components only works in client components and is in maintenance mode |
| API client | Types generated from OpenAPI (`openapi-typescript`, `openapi-fetch`)                                    | Sharing the API's schemas; hand-written types       | Depends only on the published contract, with drift caught in CI                                                                                                                                 |
| Caching    | None                                                                                                    | Short page caching; caching deeply confirmed blocks | Correctness through reorgs and changing confirmations; the traffic doesn't need it                                                                                                              |
| New blocks | Poll and offer a prompt                                                                                 | Insert automatically; refresh to update             | Keeps the reader in control; the API has no push channel                                                                                                                                        |
| Errors     | Toasts (Sonner) over the page's skeleton                                                                | A dedicated error page                              | Keeps the page's shape and offers a retry in place                                                                                                                                              |
| Testing    | Vitest and React Testing Library; Playwright with automated accessibility checks against the real stack | Unit tests only; browser tests only                 | Logic and components are tested quickly; pages and the real API integration are tested in a browser                                                                                             |
| Fonts      | Self-hosted at build time                                                                               | Loaded from Google Fonts                            | Visitors' browsers make no third-party requests                                                                                                                                                 |

## Known limitations

- **URLs don't include the network.** A link like `/block/318440` means "on the current network". When several networks are supported, URLs will need to say which one, and older links will open on the default network.
- **HTTP status of streamed pages.** Because pages start streaming their skeleton before the API answers, a "not found" page or an API failure is sent with status 200 (not-found pages are marked as not to be indexed).
- **Polling, not push:** new blocks can take up to 30 seconds to be offered.
- **No Content Security Policy yet.** Basic security headers are set; a stricter policy is planned.
- English only.
