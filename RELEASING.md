# Releasing

How describe-me gets to npm. Four packages ship together under one version:
`describe-me` (viewer + CLI), `@describe-me/vitest`, `@describe-me/react`,
`@describe-me/core`. The example project is private and never published.

## Before every release

1. `pnpm build && pnpm lint && pnpm format:check` and the example suite green.
2. Verify the artifact, not the sources: `pnpm smoke` (also a CI job). It packs
   every package, installs the tarballs into a fresh project in a temp
   directory with an isolated pnpm store, runs a browser-mode test through the
   plugin and builds the static site. This catches what the workspace hides:
   `workspace:` protocol left unresolved, files missing from `files`, wrong
   peer dependencies, dependency-optimizer reloads, imports that only resolve
   through symlinks. Right after the install it checks that exactly one Vite
   version is in the project, so no package nests its own, and the same for
   React. A second project installs without the optional
   `@testing-library/user-event` peer and must still record a jsdom
   `fireEvent` test. Needs Node `^20.19.0 || >=22.12.0` (Vite 8). Pass
   `--keep` to inspect the temp projects afterwards, and `--vite <x.y.z>`,
   `--vitest <x.y.z>` and `--react <x.y.z>` to pin older versions of the
   user's toolchain. CI runs four variants: `default` (the default
   toolchain), `vite-8.2` (`--vite 8.2.2`), `vitest-4`
   (`--vitest 4.1.11 --vite 6.4.3`) and `react-18`
   (`--react 18.3.1 --vitest 4.1.11 --vite 8.2.2`).
3. A changeset exists for every user-visible change (`pnpm changeset`).

## Versioning

[Changesets](https://github.com/changesets/changesets) with a `fixed` group
covering all four packages, so users see a single version everywhere.

- `pnpm changeset` in a feature branch writes the changeset file, and the PR
  carries it. Every user-visible change needs one.
- On every push to `main`, the `version` job of `release.yml` runs
  `changesets/action`. With pending changesets it opens or refreshes the
  "Version Packages" PR (`pnpm version-packages`: bumps versions, writes
  CHANGELOGs from the changeset texts with PR links, refreshes the lockfile,
  formats). The action pushes that commit through the GitHub API, so it is
  signed by GitHub.
- Merging that PR starts the `publish` job (`pnpm release`: build, then
  `changeset publish`, which uses `pnpm publish` under the hood and therefore
  resolves the `workspace:` protocol). The job runs in the `npm` environment,
  which deploys only from `main` and waits for a maintainer's approval in
  Actions. Nothing is published before that approval.
- The publish job can be started again by hand (`workflow_dispatch`) when a
  publish failed.
- CI on the "Version Packages" PR does not start by itself, because the PR is
  pushed with the default `GITHUB_TOKEN`. Approve the run on the PR ("Approve
  and run") before merging. The PR also needs a code owner's review.

Start at `0.1.0` (the `first-release` changeset). Anything below `1.0.0` may
change its public exports between minors. Say so in the changelog entry.

## Prereleases

A release made of several PRs can ship prereleases on the way. In pre mode
every "Version Packages" PR bumps to the next prerelease (`0.5.0-next.0`,
`0.5.0-next.1`, …) and publishes under the `next` dist-tag. `latest` stays on
the last stable version, so nobody gets a prerelease by accident.

- **Enter**: `pnpm changeset pre enter next` writes `.changeset/pre.json`.
  Merge it to `main` in its own PR.
- **Ship a prerelease**: merge the "Version Packages (next)" PR and approve the
  deployment. Consumed changesets move to `.changeset/pre/` and stay there
  until the stable release, which builds its CHANGELOG from them.
- **Try it**: `pnpm add -D describe-me@next @describe-me/vitest@next` (plus
  `@describe-me/react@next`) in a real project.
- **Exit**: `pnpm changeset pre exit` in a PR. The next "Version Packages" PR
  bumps to the stable version (`0.5.0`) and publishes it as `latest`.

## Publishing

- The `describe-me` npm org owns the scope. Public packages are free.
- **First publish is manual**, from a laptop with `npm login` done and Node
  `^20.19.0 || >=22.12.0`:

  ```sh
  pnpm smoke                        # tarballs work in a fresh project
  pnpm version-packages             # or merge the Version Packages PR
  pnpm release                      # build + changeset publish
  ```

  Use `pnpm publish` (which `changeset publish` does for pnpm workspaces),
  never `npm publish`: only pnpm rewrites the `workspace:` protocol. Internal
  dependencies are declared as `workspace:^`, which becomes `^0.1.0`.
  `publishConfig.provenance: true` is set on every package, so a publish from
  GitHub Actions carries a provenance attestation automatically.

- **After the first publish**, on npmjs.com set a _trusted publisher_ on each
  of the four packages: repository `grzehub/describe-me`, workflow
  `release.yml`, environment `npm`. CI then publishes through OIDC (pnpm
  delegates to the npm CLI, which needs `npm >= 11.5.1`, and the workflow
  upgrades it). No npm token is stored in the repository.

## Manifest rules

- `files` lists exactly what ships. `README.md` and `LICENSE` live in every
  package directory because npm only picks them up from there.
- `sideEffects: false` everywhere except `@describe-me/vitest`, whose
  `dist/setup.js` works by side effect and is listed explicitly.
- `build` scripts clean their output first (`rimraf dist`), so a deleted
  source never leaves a stale file in a tarball.
- `typescript` is an optional peer of `@describe-me/vitest`: without it the
  reporter still runs, it just skips the props documentation.
- `engines.node >= 20` for the libraries. `describe-me` declares
  `^20.16.0 || >=22.4.0`, the first versions whose `parseArgs` supports
  `allowNegative`. The effective floor comes from the user's Vite: Vite 8's
  native rolldown bindings declare `^20.19.0 || >=22.12.0`, and package
  managers silently skip optional dependencies that do not match `engines`,
  which surfaces as "Cannot find native binding" at startup.

## Known caveats

- `vitest ^4 || ^5` is declared. `5.x` is what the examples run on, and 4.1 is
  covered by the `--vitest 4.1.11 --vite 6.4.3` smoke variant.
- `react ^18 || ^19` is declared. The examples run 19, and the `react-18`
  smoke variant covers 18.3, component naming included.
- `vite` is a peer of `describe-me` because the viewer is built from source in
  the user's project, with their own Vite and plugins. yarn does not install
  peers automatically.
- The repo pins TypeScript 6 because typescript-eslint does not support 7 yet.
  That affects contributors only. Users need `typescript ^5 || ^6`.
