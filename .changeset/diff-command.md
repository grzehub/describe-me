---
'describe-me': minor
---

`describe-me diff --base <dir>` compares the output of two test runs, a base and the current one in `--data`, and lists what changed. Tests are matched by id and reported as changed, added, removed or moved, where moved is a test under a new name or in a new file with the same snapshots. Frames are matched by content, so one added step is one added frame. A changed frame is `dom` when its DOM differs without the stylesheet text and `css` when only the stylesheet text does. State changes and the changed props of documented components, such as a new default value, are listed too. Without `--out` it prints a summary. With `--out <dir>` it writes `changes.json` (version 1) and `changes.md`, a pull request comment within GitHub's length limit. It exits with 0 whenever it could compare, whatever changed, and with 1 when a manifest or a snapshot cannot be read.
