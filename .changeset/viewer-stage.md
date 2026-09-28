---
'describe-me': minor
---

The viewer keeps its place while you browse.

- Stepping through frames swaps the replay in place. The next frame is built out of sight and shown once its fonts load, or after 200 ms, so the stage no longer flashes blank. Within a test the stage keeps its scroll position.
- The sidebar keeps its scroll position when you pick a test or the manifest updates, and the timeline keeps it while you step through frames. The overview keeps its scroll position when the manifest updates. The issues panel stays open until you pick an item in it.
- Width and height fields sit next to the 100%, 768px and 375px presets. The size is kept in the link as `w` and `h`. A fixed height is used as is, without fitting the frame to its content. A viewport wider than the stage is scaled down to fit, and the toolbar shows the zoom.
- Keyboard shortcuts are ignored while you type in a field.

No package exports change. Links without `w` and `h` open at 100% width, as before.
