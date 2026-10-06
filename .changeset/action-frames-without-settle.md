---
'@describe-me/react': patch
'@describe-me/vitest': patch
---

In jsdom, recording no longer hides React act warnings.

- **User-event frames take no wait under Testing Library** (`@describe-me/vitest`). With `@testing-library/react` loaded, the frame of a `@testing-library/user-event` call is taken as soon as the call resolves. Testing Library already runs each event in `act()` and drains a macrotask before the call returns, so the DOM is committed. In 0.5.2 the recorder waited one more macrotask with React's act flag off. An update that landed in that wait did not warn, while a run without describe-me warned. The frame shows the page as the test's next line sees it, so an update that lands one macrotask after the call is no longer in it. Without `@testing-library/react`, and in browser mode, user-event frames still wait one macrotask.
- **The Testing Library entry tells the setup file** (`@describe-me/react`). Importing `@describe-me/react/testing-library` leaves a check on `globalThis`. The check holds while `@testing-library/dom` keeps the `asyncWrapper` that `@testing-library/react` configured. Mixed package versions fall back to the wait.

The recorder still waits one macrotask, with the act flag off, after a `step()`, before the closing frame, and before a `lazy` or `{ pending }` render frame that is still held back when the test ends. Warnings can still differ there. No exports change.
