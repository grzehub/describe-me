---
'describe-me': minor
---

`describe-me diff --out <dir> --shots` renders every changed frame before and after in headless Chromium and compares the pixels. A test that looks different gets an image in `--out`, named after its id: the base frame, the current frame and the changed pixels. An added test gets its render frame. `changes.md` lists the tests that look different first, with their images, keeps DOM changes that look the same under Changed, and folds the CSS-only tests that look the same. `changes.json` gains `shots`, and `look` and `shot` on tests and `look` on frames. `--width` sets the frame width in CSS pixels (480, at twice the pixel density) and `--max-shots` the number of images (20). `--shots` loads Playwright from the project, which `--root` can name, and `playwright` is an optional peer. Frames render only in `describe-me diff`, never in a test run, and the command writes nothing outside `--out`.
