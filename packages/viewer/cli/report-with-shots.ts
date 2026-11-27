import type {
  ChangesReport,
  FrameChange,
  Look,
  ShotsSummary,
  TestChange,
  TestShot,
} from './changes-report.js'
import { testLook } from './test-look.js'

/** What `--shots` found, to add to a report. */
export interface ShotFindings {
  /** The look of a changed frame, `undefined` when a side did not render. */
  lookOf(frame: FrameChange): Look | undefined
  /** The images written, by test id. */
  shots: Map<string, TestShot>
  summary: ShotsSummary
}

/** The look goes right after the kind, as in `changes-report.ts`. */
function frameWith(frame: FrameChange, look: Look | undefined): FrameChange {
  const { change, kind, ...sides } = frame

  return {
    change,
    ...(kind === undefined ? {} : { kind }),
    ...(look === undefined ? {} : { look }),
    ...sides,
  }
}

function testWith(test: TestChange, findings: ShotFindings): TestChange {
  const { change, id, module, fullName, kind, ...rest } = test
  const look = testLook(test, findings.lookOf)
  const shot = findings.shots.get(id)

  return {
    change,
    id,
    module,
    fullName,
    ...(kind === undefined ? {} : { kind }),
    ...(look === undefined ? {} : { look }),
    ...(shot === undefined ? {} : { shot }),
    ...rest,
    frames: test.frames.map((frame) =>
      frameWith(frame, frame.change === 'changed' ? findings.lookOf(frame) : undefined),
    ),
  }
}

/**
 * The report with what `--shots` found: `look` on changed frames and tests,
 * `shot` on the tests that got an image and `shots` with the counts. Every
 * other field stays as `diffRuns()` wrote it.
 */
export function reportWithShots(report: ChangesReport, findings: ShotFindings): ChangesReport {
  return {
    ...report,
    tests: report.tests.map((test) => testWith(test, findings)),
    shots: findings.summary,
  }
}
