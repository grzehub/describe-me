---
'@describe-me/core': minor
'@describe-me/vitest': minor
'describe-me': minor
---

Fonts and other page-level resources can be added to every replayed frame with the new `previewHead` option, and CSS files copied into `assets/` keep their fonts and images.

- **New option `previewHead`** (`string`) on the plugin (`@describe-me/vitest/plugin`) and the reporter (`@describe-me/vitest/reporter`). It is HTML the viewer adds to the start of the `<head>` of every frame and thumbnail, like Storybook's `preview-head.html`. It never reaches the test page. Local files it links with `href` or `src` are copied into `assets/`, and so are the `url()` targets in its `<style>` blocks and `style` attributes. Remote URLs load from the network in the viewer. The reporter warns when it contains a `<script>`, because the viewer never runs scripts.
- **New manifest field `Manifest.head`** (`@describe-me/core`): the preview head with local files as `describe-me-asset:` URLs. It is absent when `previewHead` is not set.
- **New export `cssReferences()`** and its type `CssReference`, from `@describe-me/core` and the new entry point `@describe-me/core/css-references`. It lists the `url()` and `@import` references in CSS text with their positions. An unquoted URL runs until the closing parenthesis, so Google Fonts `css2` URLs, which contain semicolons, are read whole.
- **Copied CSS files keep working.** When a project `.css` file is copied into `assets/`, its `url()` and `@import` targets are copied too and referenced by their stored names. A font declared in a linked `fonts.css` used to fail with a 404 in the viewer. Only fonts, images, cursors and CSS files are pulled in this way. Targets that cannot be found are listed in `assetsMissing`. CSS assets written by earlier versions stay as they are until their tests run again.
- Garbage collection also keeps the assets the preview head refers to, and every file a kept CSS asset refers to.
- The viewer waits up to 3 seconds for web fonts, then fits the stage and the thumbnails again, so the frame height matches the loaded font.

No existing export changes.
