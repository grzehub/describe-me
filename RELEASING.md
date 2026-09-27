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
   version is in the project, so no package nests its own. Needs Node
   `^20.19.0 || >=22.12.0` (Vite 8). Pass `--keep` to inspect the temp project
   afterwards, and `--vite <x.y.z>` / `--vitest <x.y.z>` to pin older versions
   of the user's toolchain. CI runs three variants: the default toolchain,
   `--vite 8.2.2`, and `--vitest 4.1.11 --vite 6.4.3`.
3. A changeset exists for every user-visible change (`pnpm changeset`).

## Versioning

[Changesets](https://github.com/changesets/changesets) with a `fixed` group
covering all four packages, so users see a single version everywhere.

- `pnpm changeset` in a feature branch writes the changeset file; the PR
  carries it. Every user-visible change needs one.
- On merge to `main`, `release.yml` runs `changesets/action`. With pending
  changesets it opens or refreshes the "Version Packages" PR
  (`pnpm version-packages`: bumps versions, writes CHANGELOGs from the
  changeset texts with PR links, refreshes the lockfile, formats).
- Merging that PR runs the same workflow again, now with no pending
  changesets, so the action publishes (`pnpm release`: build, then
  `changeset publish`, which uses `pnpm publish` under the hood and therefore
  resolves the `workspace:` protocol).
- The "Version Packages" PR is opened with the default `GITHUB_TOKEN`, and
  GitHub does not run CI on PRs created by that token. Review it by eye or, if
  CI on it matters, give the action a fine-grained PAT or a GitHub App token.
  Branch protection still requires an approving review before merging it.

Start at `0.1.0` (the `first-release` changeset). Anything below `1.0.0` may
change its public exports between minors; say so in the changelog entry.

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
  `release.yml`, environment empty. From then on CI publishes through OIDC
  (pnpm delegates to the npm CLI, which needs `npm >= 11.5.1`; the workflow
  upgrades it). Once all four are configured, delete the `NPM_TOKEN` secret;
  it exists only as the fallback before trusted publishers can be created.

## Manifest rules

- `files` lists exactly what ships. `README.md` and `LICENSE` live in every
  package directory because npm only picks them up from there.
- `sideEffects: false` everywhere except `@describe-me/vitest`, whose
  `dist/setup.js` works by side effect and is listed explicitly.
- `build` scripts clean their output first (`rimraf dist`), so a deleted
  source never leaves a stale file in a tarball.
- `typescript` is an optional peer of `@describe-me/vitest`: without it the
  reporter still runs, it just skips the props documentation.
- `engines.node >= 20` for the libraries; `describe-me` declares
  `^20.16.0 || >=22.4.0`, the first versions whose `parseArgs` supports
  `allowNegative`. The effective floor comes from the user's Vite: Vite 8's
  native rolldown bindings declare `^20.19.0 || >=22.12.0`, and package
  managers silently skip optional dependencies that do not match `engines`,
  which surfaces as "Cannot find native binding" at startup.

## Known caveats

- `vitest ^4 || ^5` is declared. `5.x` is what the examples run on; 4.1 is
  covered by the `--vitest 4.1.11 --vite 6.4.3` smoke variant.
- `vite` is a peer of `describe-me` because the viewer is built from source in
  the user's project, with their own Vite and plugins. yarn does not install
  peers automatically.
- The repo pins TypeScript 6 because typescript-eslint does not support 7 yet.
  That affects contributors only; users need `typescript ^5 || ^6`.
