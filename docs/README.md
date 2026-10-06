# The docs site

The documentation of describe-me as a static site: plain HTML pages and one
stylesheet, `docs.css`, in the look of the viewer. There is no build step, no
script and no web font. `pnpm check-docs` keeps the pages in step with the
plan and the code.

## Looking at it

- `open docs/index.html` shows the pages straight from disk.
- `pnpm site` builds `site/` (the pages plus the viewers of both example
  projects under `examples/react-browser/` and `examples/react-jsdom/`) and
  serves it at `http://localhost:6060/`. It needs `pnpm build` and both
  examples' tests. The viewers fetch their data, so they only work over HTTP.
- `.github/workflows/docs.yml` publishes `site/` at
  `https://grzehub.github.io/describe-me/` on every push to `main`.

## A page

Every page is a copy of the same skeleton. Start a page from an existing one.

- **Shared, identical on every page:** the `<head>` (apart from `<title>` and
  the meta description), the topbar `<header class="topbar">`, the sidebar
  `<nav class="sidebar">`, and the structure of the pager and footer. The
  sidebar differs only in `aria-current="page"` on the page's own link. The
  pager links the previous and next page of the sidebar order, and the footer
  links the page's source on GitHub.
- **Owned by the page:** everything in `<main class="page">` above the pager,
  and the "On this page" list in `<aside class="toc">`, which links every `h2`
  of the page in order.

The topbar shows the version of `packages/viewer/package.json`.
`node scripts/sync-docs-version.mjs` sets it on every page, and
`pnpm version-packages` runs that for each release.

## Components

All of them are classes of `docs.css`. Use nothing else: no `style`
attributes, no `<style>` and no `<script>`.

The lead, right under the page head:

```html
<p class="lead">One or two sentences that say what the page is for.</p>
```

A section. The id is the anchor, the `a.anchor` shows on hover:

```html
<h2 id="options">
  Options <a class="anchor" href="#options" aria-label="Link to this section">#</a>
</h2>
<h3>A subsection</h3>
```

Callouts, plain or with a tone. A leading `<strong>` takes the tone colour:

```html
<div class="callout"><strong>Note.</strong> Something worth knowing.</div>
<div class="callout warn">…</div>
<div class="callout danger">…</div>
<div class="callout pass">…</div>
```

Numbered steps, each number in a disc:

```html
<ol class="steps">
  <li><strong>Install</strong> Text of the step.</li>
</ol>
```

Code. Escape `<`, `>` and `&` inside it. `.dim` steps back a comment or a
prompt, `.file` names the file of the block below it:

```html
<p class="file">vitest.config.ts</p>
<pre><code><span class="dim">// a comment</span>
import { describeMe } from '@describe-me/vitest/plugin'</code></pre>
```

Keys: `<kbd>/</kbd>`.

Tables sit in a `.scroll` card. `table.wide` keeps a prose table from
squeezing on a phone. A reference table is `table.fields`: its first column
is code and never wraps, and its rows carry ids so other pages can link one
row. `td.name` and `td.nowrap` do the same for single cells:

```html
<div class="scroll">
  <table class="fields">
    <thead>
      <tr>
        <th>Option</th>
        <th>Default</th>
        <th>What it does</th>
      </tr>
    </thead>
    <tbody>
      <tr id="option-include">
        <td><code>include</code></td>
        <td class="nowrap"><code>[]</code></td>
        <td>…</td>
      </tr>
    </tbody>
  </table>
</div>
```

Key and value pairs:

```html
<dl class="kv">
  <dt>Node</dt>
  <dd>^20.19 or 22.12 and later</dd>
</dl>
```

Cards in a grid, and a card that opens an example viewer (with an arrow):

```html
<div class="cards">
  <a class="card" href="configuration.html"
    ><h3>Configuration</h3>
    <p>Every option.</p></a
  >
  <a class="card viewer" href="examples/react-browser/"
    ><h3>Browser mode</h3>
    <p>The live viewer.</p></a
  >
</div>
```

Two columns, browser mode and jsdom, which stack on a phone:

```html
<div class="pair">
  <div>…</div>
  <div>…</div>
</div>
```

Badges. `.dot` adds a dot in the tone:

```html
<span class="badge prototype">prototype</span>
<span class="badge env">jsdom</span>
<span class="badge dot status-open">open</span>
<span class="badge status-planned">planned</span>
<span class="badge status-by-design">by design</span>
<span class="badge status-fixed">fixed</span>
<span class="badge passed">passed</span>
<span class="badge failed">failed</span>
```

Chips, as the component overview shows covered prop values:

```html
<p class="chips">
  <span class="chip covered">primary</span><span class="chip uncovered">danger</span>
</p>
```

A piece of the viewer drawn with docs markup:

```html
<div class="mock">
  <div class="mock-body">…</div>
</div>
<p class="mock-caption">What the picture shows.</p>
```

Diagrams are inline SVG in a `figure.diagram`, coloured only through the
`dg-*` classes, so dark mode needs nothing extra. Give the SVG a `<title>`
with an id and point `aria-labelledby` at it. Ids inside the SVG (titles,
arrow markers) must be unique on the page:

```html
<figure class="diagram">
  <svg viewBox="0 0 640 120" role="img" aria-labelledby="flow-title">
    <title id="flow-title">A test writes frames, the viewer reads them</title>
    <defs>
      <marker
        id="flow-arrow"
        viewBox="0 0 8 8"
        refX="7"
        refY="4"
        markerWidth="8"
        markerHeight="8"
        orient="auto"
      >
        <path class="dg-head" d="M0,0 L8,4 L0,8 z" />
      </marker>
    </defs>
    <rect class="dg-group" x="1" y="1" width="300" height="118" rx="10" />
    <text class="dg-group-title" x="16" y="22">Vitest</text>
    <rect class="dg-node" x="20" y="40" width="120" height="48" rx="8" />
    <text class="dg-title" x="34" y="62">Recorder</text>
    <text class="dg-mono" x="34" y="78">recorder.ts</text>
    <path class="dg-edge" d="M140,64 H200" marker-end="url(#flow-arrow)" />
    <text class="dg-label" x="150" y="58">frames</text>
  </svg>
  <figcaption>One sentence on what the reader should take away.</figcaption>
</figure>
```

The other diagram classes: `.dg-node.strong` (accent border), `.dg-node.toned`
and `.dg-dot` (coloured by `--tone`, for example through a `passed` or
`failed` class), `.dg-text`, `.dg-title.mono`, `.dg-edge.accent`,
`.dg-edge.fail`, `.dg-edge.dashed`, `.dg-head.accent`, `.dg-head.fail`,
`.dg-label.mono` and `.dg-lifeline` for sequence diagrams.

## Ids

The `h2` ids of every page are listed in `scripts/docs/sections.mjs`. They are
a contract between the pages: other pages link to them. A title may change,
an id may not. A page may add sections of its own.

Rows of reference tables carry ids too, so a page can link a single option or
flag:

| Id                             | Page                 | What                                                                                                                                                               |
| ------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `option-<name>`                | configuration.html   | every option of `describeMe()`                                                                                                                                     |
| `env-<NAME>`                   | configuration.html   | environment variables                                                                                                                                              |
| `version-<slug>`               | installation.html    | supported versions: the package name without `@`, `/` turned into `-` (`testing-library-react`), and `version-node`                                                |
| `cmd-<command>`, `flag-<flag>` | viewer.html          | CLI commands and flags (`flag-no-vendor-fonts` for the negated one)                                                                                                |
| `diag-<key>`                   | troubleshooting.html | every key of `ManifestDiagnostics`                                                                                                                                 |
| `entry-<pkg>[-<subpath>]`      | api.html             | entry points: `pkg` is `vitest`, `react`, `core`, or `cli` for the `describe-me` package. The subpath without `./`, `/` turned into `-` (`entry-vitest-setup-dom`) |
| `manifest-<field>`             | how-it-works.html    | every field of `manifest.json`                                                                                                                                     |
| `limit-<slug>`                 | limitations.html     | every known limitation                                                                                                                                             |

## Deep links into the examples

A link can open one test of an example viewer, at a frame and a viewport
size. The view sits after `#` as URL parameters: `test` (the 12-character id
of a test), `frame` (from 0), `suite` (`<module>::<suite path joined with
' > '>`, which opens the component overview instead), `w` and `h` in pixels.
In HTML, write `&` as `&amp;`:

```html
<a href="examples/react-browser/#test=0123456789ab&amp;frame=1">the hover frame</a>
```

`pnpm docs:link react-browser "Button > variants > renders primary by default" 1`
prints the link for a test by its full name, plain and with `&amp;`. Without an
exact match it lists names that contain the text.

`pnpm check-docs` reads both examples' manifests and checks that the test
exists and the viewer shows it, that the frame exists, that the suite names a
module and a suite of it, that `w` is 1 to 10000 and `h` 120 to 10000, and
that there are no other parameters. Run both examples' tests first. Test ids
are stable across machines, so a link breaks only when its test is renamed or
moved. Link to a viewer with the trailing slash: `examples/react-jsdom/`.

## Stubs

No page is a stub. `structure.mjs` refuses a `data-stub` attribute and a
`.stub` class on any element.

## Checks

`pnpm check-docs` runs every file of `scripts/check-docs/` in name order:

- `api.mjs`: `api.html` documents every entry point of the published packages
  and every name each one exports, under an `entry-*` id.
- `cli.mjs`: `viewer.html` has a `cmd-*` row for every command and a `flag-*`
  row for every flag of the `describe-me` CLI, and nothing else.
- `code-samples.mjs`: in a `<pre><code>` block, every import of
  `describe-me` or `@describe-me/…` (with names, for side effects or dynamic)
  names an entry point of its package, and so does every other quoted
  `@describe-me/…` specifier, such as a `setupFiles` entry. `describe-me` is
  the CLI and has none. Package globs, prefixes and versions, as in
  `pnpm up '@describe-me/*'` or a Renovate rule, are not specifiers and pass.
  Every imported name is exported by that entry point's source. Only
  `<pre><code>` blocks are read, so put program output, such as an error that
  quotes a wrong import, in a `<pre>` without `<code>`.
- `diagnostics.mjs`: `troubleshooting.html` has a `diag-*` element for every
  key of `ManifestDiagnostics`, and every row of `limitations.html#summary`
  carries an environment badge, one status badge and a link.
- `examples.mjs`: `examples.html` opens both example viewers from cards, and
  names every component of each example's manifest.
- `interactions.mjs`: `writing-stories.html#frames` names every call that
  records a frame.
- `links.mjs`: relative links point at a page, `docs.css`, `favicon.svg` or an
  example viewer, fragments at ids of their target, SVG references at ids of
  their page, and deep links at tests, frames and suites of the manifests.
- `manifest-fields.mjs`: `how-it-works.html#manifest` has a `manifest-*` row
  for every field of `manifest.json`.
- `options.mjs`: `configuration.html` has an `option-*` row for every option
  of `describeMe()` and an `env-*` row for every environment variable, and
  nothing else.
- `readme-links.mjs`: the docs links of the root `README.md` and the package
  READMEs point at pages, ids and example viewers that exist. A package README
  links docs pages, not anchors of the root README. The root README keeps the
  heading `## Add it to your project`, which the READMEs on npm link, and its
  "Documentation" section links every page.
- `structure.mjs`: the page files, the head, no scripts or inline styles,
  relative URLs, identical topbar and sidebar, pager order, footer link, `h2`
  ids and anchors, the "On this page" list, the ids of `sections.mjs` and
  unique ids.
- `tokens.mjs`: the tokens at the top of `docs.css` equal those of
  `packages/viewer/src/style.css`, light and dark.
- `versions.mjs`: `installation.html` has a `version-*` row with every version
  range the published packages ask for.

To add a check, add a file with one default export. It receives the shared
context (`root`, `pages`, `sections`, `html` as a map from file to text,
`helpers`, `manifests` of the examples and the published `packages`) and
returns a list of problems, each a string that starts with the page:
`'configuration.html: no row for the option include'`. The helpers live in
`scripts/docs/`, one per file.

## Looking at a page

`pnpm site:build`, then `pnpm docs:screenshots configuration.html`. It takes
full-page screenshots at 1280 and 390 px wide, in the light and the dark
scheme, and prints where they are. It fails when a page is wider than 390 px.
Look at all four. `pnpm check-site` checks that the built site loads in
Chromium.

## Adding a page

1. Add it to `scripts/docs/pages.mjs` in sidebar order, with its title and
   group, and its section ids to `scripts/docs/sections.mjs`.
2. Copy a page, change the title, description, `main` and "On this page".
3. Add its link to the sidebar of every page, and fix the pager of the pages
   before and after it.
4. Link it from the "Documentation" list of the root `README.md`, with its
   site URL. `readme-links` checks it.
5. `pnpm check-docs` tells you what is still out of step.

## Writing

- English, and the prose rules of `STYLE.md`: short sentences, plain words,
  periods instead of semicolons.
- One home per fact. Explain a thing on one page. Other pages summarise it in
  a sentence and link there.
- Code samples import only real entry points and real exports. `check-docs`
  holds them to it.
