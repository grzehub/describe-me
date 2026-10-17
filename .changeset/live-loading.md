---
'describe-me': minor
---

Live shows that it is loading. Until the live page reports its first status, the recorded frame stays on the stage under the live frame, dimmed and with a shimmer, and the dot of the Live toggle pulses. With no recorded frame on the stage, after Restart or a change of test in Live, the shimmer runs on the empty canvas. Any status ends it, a failure too. The live frame fades in over 150 ms while the recorded frame fades out. With `prefers-reduced-motion: reduce` there is no shimmer, pulse or fade, only the dimmed frame.
