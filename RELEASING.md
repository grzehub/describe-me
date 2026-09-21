# Releasing

How describe-me gets to npm. Four packages ship together under one version:
`describe-me` (viewer + CLI), `@describe-me/vitest`, `@describe-me/react`,
`@describe-me/core`. The example project is private and never published.

## Before every release

1. `pnpm build && pnpm lint && pnpm format:check` and the example suite green.
2. Verify the artifact, not the sources. From the repo root:

   ```sh
   pnpm -r --filter './packages/*' pack --pack-destination /tmp/dm-pack
   ```

   Then, in a fresh directory outside the monorepo, install the tarballs
   into a minimal Vitest browser-mode project, add `describeMe()` to its
   config, run one test and `describe-me build`. This catches everything the
   workspace hides: `workspace:*` left unresolved, files missing from `files`,
   wrong peer dependencies, imports that only resolve through symlinks.

3. A changeset exists for every user-visible change (`pnpm changeset`).

## Versioning

[Changesets](https://github.com/changesets/changesets) with a `fixed` group
covering all four packages, so users see a single version everywhere. Merging a
PR that carries changeset files makes the release action open or update a
"Version Packages" PR. Merging that PR bumps versions, writes CHANGELOGs and
publishes.

Start at `0.1.0`. Anything below `1.0.0` may change its public exports between
minors; say so in the changelog entry.

## Publishing

- The `describe-me` npm org owns the scope. Public packages are free.
- **First publish is manual**, from a laptop with `npm login` done:

  ```sh
  pnpm -r --filter './packages/*' publish --access public
  ```

  Use `pnpm publish`, never `npm publish`: only pnpm rewrites the
  `workspace:` protocol in the published manifest. Internal dependencies are
  declared as `workspace:^`, which becomes `^0.1.0`; `workspace:*` would pin
  the exact version and force a lockstep bump of every package on each
  release. Publish `@describe-me/core` first (pnpm's recursive publish orders
  by dependency graph).

- **After the first publish**, on npmjs.com set a _trusted publisher_ for each
  of the four packages pointing at this repository and the `release.yml`
  workflow. From then on CI publishes through OIDC with `--provenance`; no
  long-lived npm token lives in GitHub secrets.
- `release.yml` runs on push to `main`: install, build, then
  `changesets/action` with `publish: pnpm -r publish --access public --provenance`.

## Manifest rules

- `files` lists exactly what ships. `README.md` and `LICENSE` live in every
  package directory because npm only picks them up from there.
- `sideEffects: false` everywhere except `@describe-me/vitest`, whose
  `dist/setup.js` works by side effect and is listed explicitly.
- `build` scripts clean their output first (`rimraf dist`), so a deleted
  source never leaves a stale file in a tarball.
- `typescript` is an optional peer of `@describe-me/vitest`: without it the
  reporter still runs, it just skips the props documentation.
- `engines.node >= 20`.

## Known caveats

- `vitest >= 4` is declared, `5.x` is what the example runs on.
- `describe-me` depends on `vite` at runtime because the viewer is built from
  source in the user's project (their Vite, their plugins). That dependency is
  deliberate and heavy.
- The repo pins TypeScript 6 because typescript-eslint does not support 7 yet.
  That affects contributors only; users need `typescript >= 5`.
