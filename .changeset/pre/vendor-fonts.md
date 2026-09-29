---
'describe-me': minor
---

`describe-me build` downloads web fonts into the static site, so the published docs show them without network access.

- Stylesheets from Google Fonts (`fonts.googleapis.com/css`, `/css2` and `/icon`), Bunny Fonts and Fontsource on jsDelivr are stored in `__data/assets/` with the font files they point at. The build scans the preview head, the snapshots, the style chunks and the copied CSS assets. Links that an app's font loader added and data written by 0.4 are covered too.
- Requests send a current Chrome User-Agent, so Google serves woff2 files split by `unicode-range`. Every response is checked for type, size and, for fonts, file signature. Redirects must stay on the same hosts. A stylesheet is replaced only when all its files downloaded. Otherwise it keeps loading from the network and the build prints a warning. The build never fails because of it.
- Adobe Fonts are never downloaded, because their license does not allow self-hosting. Stylesheets and fonts on other hosts stay remote too. The build lists both.
- Downloads are cached in `node_modules/.cache/describe-me/fonts`. Font files are kept for good and stylesheets for 7 days. A stale stylesheet is used when the network is down, so a build works offline after one online build.
- New flag `--no-vendor-fonts` turns this off.

`describe-me dev` and the `.describe-me` directory are unchanged. No export changes.
