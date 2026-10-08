# yabe

## Design docs: private vs public

Full design docs are private. Only high-level decisions are published.

- **Private: `.internal/`.** A clone of the private repo `pedroshaina/yabe-internal-docs`, ignored by this repo. Full specs go in `.internal/specs/`, implementation plans in `.internal/plans/`. Commit and push them in that repo, never in this one. This overrides the superpowers default of `docs/superpowers/`.
- **Public: `docs/specs/`.** Short decision documents derived from an approved full spec: goals and scope, an architecture overview, key decisions with the alternatives considered and why, and known limitations. No table-level schemas, detailed algorithms, task lists or other implementation detail. Name them with a two-digit sequential index, no date: `01-backend-typescript-rewrite.md`, `02-...`.
- **Order:** full spec (private) → approved → public decision doc → approved → implementation plan (private).
- Never copy, link or quote `.internal/` content into commits, PRs or files in this repo beyond what the public decision doc states.
