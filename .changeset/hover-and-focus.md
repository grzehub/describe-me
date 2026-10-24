---
'@describe-me/core': minor
'@describe-me/vitest': minor
'@describe-me/react': minor
'describe-me': minor
---

Frames show hover and focus. Each frame records which elements were in `:hover`, `:focus`, `:focus-visible` and `:focus-within`, and the viewer replays them on the stage, in the overview, in frame links and in static builds. In browser mode the browser decides, and a hover shows only while `hover()` is the test's last pointer gesture. In jsdom and other DOM environments `hover()`, `unhover()`, the clicks and the enter, over, leave and out events of `fireEvent` move the hover, and `:focus-visible` follows a text field or the last keyboard gesture. `:active` is not recorded. Frames recorded before 0.12 replay as before.

`@describe-me/core/types` exports `PSEUDO_STATES_ATTRIBUTE`, the attribute that holds the states in a stored snapshot, and the types `PseudoState`, `RecorderEnvironment` and `GestureKind`. `RecorderOptions` takes `environment`, which the setup files set. Adapters report gestures with `recorder.noteGesture(kind, target?)`. The recorder protocol is 3, so all describe-me packages must be on 0.12 together.
