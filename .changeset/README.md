# Changesets

Every user-visible change ships with a changeset: a small markdown file in this
directory that names the packages it touches, the bump (`patch`, `minor`,
`major`) and a line for the changelog. Create one with:

```sh
pnpm changeset
```

All four published packages are in one `fixed` group, so they always share a
version; picking any of them bumps them all. The example project is private and
is never versioned or published.

On merge to `main`, the release workflow collects the pending changesets into a
"Version Packages" pull request. Merging that PR bumps versions, writes the
CHANGELOGs and publishes to npm. See `RELEASING.md` at the repo root.
