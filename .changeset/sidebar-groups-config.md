---
'@describe-me/core': minor
'@describe-me/vitest': minor
---

`describeMe()` takes `sidebar: { groups }`, which puts test files into groups for the viewer's sidebar. Each key is a group path with `/` between levels, such as `'Components/Forms'`, and each value a glob or a list of globs relative to the Vitest root, matched as `include` is. A file joins the first key that matches it, and a file that matches none stays below the groups. A `*` segment in a key takes the folder name that the glob's `*` segment matched, so `'Features/*': 'src/features/*/**'` gives a group per feature folder. A malformed option throws before any test runs, and a key that gets no test file adds a setup warning. `DescribeMeReporterOptions` takes the same `sidebar`.

The manifest carries the groups. `ManifestModule.group` is the group path of a test file, and `Manifest.sidebar.groups` lists every group that holds a file, in sidebar order. Both are absent without the option.
