# Image publishing and the runtime contract

- **Date:** 2026-10-10
- **Status:** Accepted

## Context

yabe is going to run in a Kubernetes homelab cluster, managed by a separate GitOps repository. The cluster pulls yabe's container images from a registry and pins each one by digest. A release there is a commit in that repository that pins every yabe image to the same yabe commit. The cluster's side of this is described as a deployment contract, and this document covers yabe's side of it:

1. publishing the images
2. keeping the runtime interface the cluster's manifests depend on stable
3. promoting each release to the GitOps repository automatically

Until now, CI built the images but published them nowhere.

## Goals

- Every push to `master` that passes CI and the end-to-end suite publishes the images, all tagged with that commit.
- A push that fails either check publishes nothing.
- A published release reaches the cluster without a manual step, and releases land in merge order.
- The images are public, so the cluster pulls them without credentials.
- A change that would break what the cluster relies on fails CI before it ships.

## Out of scope for now

- Prometheus `/metrics` on the indexer and the API, a later item of the same contract. The other later item, a configurable path prefix for the API docs, has since been added as `API_PUBLIC_PREFIX`.
- Image signing, SBOMs and vulnerability scanning.
- Multi-architecture images.

## How it works

```
push to master ─► release workflow
                    ├─ CI          format, lint, types, build, tests, image builds and checks
                    ├─ end to end  the whole stack on regtest, in a browser
                    ├─ publish     only if both pass ─► ghcr.io/pedroshaina/yabe-<app>:<commit SHA>
                    └─ promote     only if publish passes ─► pins all four digests in the GitOps repository
```

- **Four images** are published, each tagged with the full commit SHA and labelled with the source repository and the revision: `yabe-indexer`, `yabe-api`, `yabe-db-migration` and `yabe-web`.
- **The run lists each image's digest** and hands the four digests to the promote step.
- **Promotion** pins every image by tag and digest in yabe's kustomization in the GitOps repository and pushes that as one release commit, which Argo CD then deploys. Before committing, it checks that the rendered manifests use each pinned image and that nothing else changed.
- **Releases run one at a time,** in merge order. A newer pending release replaces an older pending one, so an older build never lands after a newer one.
- **The runtime contract** is what the cluster relies on:
  - the `INDEXER_*` and `API_*` environment variables
  - `GET /health` and `GET /ready` on the API
  - a clean shutdown on SIGTERM
  - JSON logs on stdout
  - running as the non-root `node` user
  - `prisma migrate deploy` as the migration image's command

  Each of these is checked by CI or by the end-to-end suite, so breaking one fails a build rather than a deployment.

## Key decisions

| Decision              | Chosen                                                                                                                         | Alternatives considered                                                                              | Why                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate                  | One release workflow that runs CI and the end-to-end suite, then publishes only if both pass                                   | Publishing from the end-to-end workflow; chaining workflows on completion                            | One run with an explicit gate on both checks; a completion trigger can wait on only one workflow                                            |
| Registry              | GitHub Container Registry, public images                                                                                       | Docker Hub; private images with a pull secret                                                        | It sits next to the repository and needs no stored credential; the repository is public, so a pull secret would protect nothing             |
| Tags                  | The full commit SHA only                                                                                                       | Adding `latest` or version tags                                                                      | The consumer pins by digest; a moving tag would only invite unpinned use                                                                    |
| Images                | All four, including the frontend                                                                                               | Only the three the backend needs                                                                     | The cluster will serve the frontend from the same hostname; publishing it now costs one more build                                          |
| Credentials           | The workflow's own short-lived token, with write access to packages only in the publish step                                   | A stored personal access token                                                                       | Nothing to store or rotate; least privilege                                                                                                 |
| Runtime contract      | Checked by CI and the end-to-end suite                                                                                         | Documented only                                                                                      | A break is caught before it reaches the cluster                                                                                             |
| Promotion             | A job in the release workflow that pushes a release commit to the GitOps repository, copied from the homelab's shared template | A manual pull request per release; an image updater running in the cluster that watches the registry | Every release follows the same reviewed, auditable path as other homelab apps, with no manual step and nothing extra running in the cluster |
| Promotion credentials | A GitHub App installation token, valid for an hour and able to write only to the GitOps repository                             | A personal access token or deploy key stored in this repository                                      | Short-lived and scoped to one repository; nothing long-lived to rotate here                                                                 |
| Ordering              | One release at a time per repository, without cancelling a run in progress                                                     | One concurrency group per commit                                                                     | Parallel releases could finish out of order and deploy an older build over a newer one                                                      |

## Known limitations

- **The published images are rebuilds of the tested commit,** not the exact bytes the tests ran. Builds use a frozen lockfile and pinned base images, so they match in practice.
- **A release that fails partway through can publish some images and not others.** Promotion runs only when all four are published, so a partial release is never deployed.
- **A new image package starts private on GitHub,** so each one is made public once, by hand, after its first publish.
- **Images are built for `linux/amd64` only.**
- **Promotion needs the GitHub App's credentials** in this repository's Actions settings. Without them the images are still published, but nothing is promoted.
