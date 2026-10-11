/**
 * How a reason goes on when the live preview cannot start or build: what
 * that means for the command, so the same reason fits `dev` and `build --live`.
 */
export const LIVE_CONSEQUENCES = {
  dev: 'so the viewer runs without Live',
  build: 'so describe-me build --live stopped',
} as const
