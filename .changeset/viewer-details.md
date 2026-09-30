---
'describe-me': patch
---

Viewer fixes.

- **The selected test is revealed after an overview.** Coming back from an overview expands the test's collapsed module or suite and scrolls its row into view. From a test hidden in a collapsed suite, ↓ and ↑ open the nearest row the sidebar shows, not the first or last test of the list.
- **↑ and ↓ add no history entries.** Stepping through tests replaces the current entry, like stepping through frames.
- **Failed loads are tried again.** The viewer retries a missing `styles/` chunk once after half a second. A frame whose styles came back incomplete, or whose snapshot failed, loads again the next time it is shown. It no longer stays broken until the next run.
- **A note names fonts that did not load.** Under the frame, the viewer lists the web fonts and stylesheets that failed to load in the browser, for example offline in `describe-me dev`.
- **Auto height for content sized to the viewport.** A full-height layout or a dialog on a backdrop gets the stage's height. A centred dialog taller than the stage gets room for all of it instead of being cut off at the top.
- **A fixed height of at least 120 px.** A smaller `h` in the link or the H field is raised to 120, the floor auto height already uses.

Nothing added to or removed from any package's exports.
