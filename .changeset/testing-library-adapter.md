---
'@describe-me/react': minor
'@describe-me/core': minor
'@describe-me/vitest': minor
---

Testing Library adapter fixes: `fireEvent` records frames, `afterEach(cleanup)` and fake timers no longer spoil the closing frame, and `renderHook` files are unmounted.

- **`fireEvent` records a frame** (`@describe-me/react/testing-library`). The function and every method (`fireEvent.click`, `fireEvent.change`, …) are recording wrappers with the same signatures. One call is one frame, labelled like `click(button "Save")` or `change(text "Name", "hello")`. Only `fireEvent` from `@testing-library/react` is covered.
- **`cleanup` takes the closing frame before it unmounts** (`@describe-me/react/testing-library`). `afterEach(cleanup)` in a test file no longer records an empty page. Called in the middle of a test, it leaves a `before cleanup()` step once the test records again.
- **`renderHook` files are unmounted.** The adapter registers its unmount when it is imported, not on the first `render`, so a file that only uses `renderHook` no longer leaves trees mounted. `renderHook` still records no frames.
- **No empty closing frames.** The closing frame is skipped when the page shows nothing, for example after `unmount()`.
- **Fake timers are safe.** The recorder keeps the real `setTimeout` and `performance`, so `vi.useFakeTimers()` left on no longer hangs a `step()` or the closing frame until the timeout, and frame times stay real.
- **Act warnings are back** (`@describe-me/vitest/setup-dom`). Switching off Testing Library's auto-cleanup also skipped its `IS_REACT_ACT_ENVIRONMENT` setup, which silenced React's "not wrapped in act(...)" warnings. The setup file sets the flag under Testing Library's own conditions (Vitest globals). The warnings you see are the ones you get without describe-me. This is not a regression.
- **`@testing-library/user-event` is really optional.** The DOM setup file loads it dynamically and skips the patch when it is missing.
- **The render redirect finds the adapter by its installed path.** Test files under a `packages/react/` directory of your own repository are now redirected and recorded.
- **New export `elementLabel`** (`@describe-me/core`) names a DOM element for a frame label, e.g. `button "Save"`. It moved from `@describe-me/vitest`, where it was internal.

No exports removed. `cleanup` and `fireEvent` keep their names and signatures.
