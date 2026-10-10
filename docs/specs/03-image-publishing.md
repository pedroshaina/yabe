# Image publishing and the runtime contract

- **Date:** 2026-10-10
- **Status:** Proposed

## Context

yabe is going to run in a Kubernetes homelab cluster, managed by a separate GitOps repository. The cluster pulls yabe's container images from a registry and pins each one by digest. A release there is a pull request that moves every yabe image to the same commit. The cluster's side of this is described as a deployment contract, and this document covers yabe's side of it:

1. publishing the images
2. keeping the runtime interface the cluster's manifests depend on stable

Until now, CI built the images but published them nowhere.

## Goals

- Every push to `master` that passes CI and the end-to-end suite publishes the images, all tagged with that commit.
- A push that fails either check publishes nothing.
- The images are public, so the cluster pulls them without credentials.
- A change that would break what the cluster relies on fails CI before it ships.

## Out of scope for now

- Prometheus `/metrics` on the indexer and the API, and a configurable path prefix for the API docs. Both are later items of the same contract.
- Image signing, SBOMs and vulnerability scanning, and automatic promotion in the cluster's repository.
- Multi-architecture images.

## How it works

```
push to master ─► release workflow
                    ├─ CI          format, lint, types, build, tests, image builds and checks
                    ├─ end to end  the whole stack on regtest, in a browser
                    └─ publish     only if both pass ─► ghcr.io/pedroshaina/yabe-<app>:<commit SHA>
```

- **Four images** are published, each tagged with the full commit SHA and labelled with the source repository and the revision: `yabe-indexer`, `yabe-api`, `yabe-db-migration` and `yabe-web`.
- **The run lists each image's digest,** so the cluster's release pull request can pin all four exactly.
- **The runtime contract** is what the cluster relies on:
  - the `INDEXER_*` and `API_*` environment variables
  - `GET /health` and `GET /ready` on the API
  - a clean shutdown on SIGTERM
  - JSON logs on stdout
  - running as the non-root `node` user
  - `prisma migrate deploy` as the migration image's command

  Each of these is checked by CI or by the end-to-end suite, so breaking one fails a build rather than a deployment.

## Key decisions

| Decision         | Chosen                                                                                       | Alternatives considered                                                   | Why                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Gate             | One release workflow that runs CI and the end-to-end suite, then publishes only if both pass | Publishing from the end-to-end workflow; chaining workflows on completion | One run with an explicit gate on both checks; a completion trigger can wait on only one workflow                                |
| Registry         | GitHub Container Registry, public images                                                     | Docker Hub; private images with a pull secret                             | It sits next to the repository and needs no stored credential; the repository is public, so a pull secret would protect nothing |
| Tags             | The full commit SHA only                                                                     | Adding `latest` or version tags                                           | The consumer pins by digest; a moving tag would only invite unpinned use                                                        |
| Images           | All four, including the frontend                                                             | Only the three the backend needs                                          | The cluster will serve the frontend from the same hostname; publishing it now costs one more build                              |
| Credentials      | The workflow's own short-lived token, with write access to packages only in the publish step | A stored personal access token                                            | Nothing to store or rotate; least privilege                                                                                     |
| Runtime contract | Checked by CI and the end-to-end suite                                                       | Documented only                                                           | A break is caught before it reaches the cluster                                                                                 |

## Known limitations

- **The published images are rebuilds of the tested commit,** not the exact bytes the tests ran. Builds use a frozen lockfile and pinned base images, so they match in practice.
- **A release that fails partway through can publish some images and not others.** The cluster promotes a commit only when all four images exist for it.
- **A new image package starts private on GitHub,** so each one is made public once, by hand, after its first publish.
- **Images are built for `linux/amd64` only.**
