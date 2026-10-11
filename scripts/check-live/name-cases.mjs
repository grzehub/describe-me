/**
 * The rules the live page names `each` and `for` rows by, against names the
 * real formatters of Vitest 4.1.11 and 5.0.1 gave, on the built output.
 */
import { liveEachName } from '../../packages/vitest/dist/live-each-name.js'

const NAME_CASES = [
  {
    template: '$name is $age',
    values: [{ name: 'Ada', age: 36 }],
    4: "'Ada' is 36",
    5: 'Ada is 36',
  },
  { template: '$0 and $1', values: ['a', 'b'], 4: "'a' and 'b'", 5: 'a and b' },
  {
    template: '%s, %d, %j, %# of %$',
    values: ['x', 2, { a: 1 }],
    4: 'x, 2, {"a":1}, 0 of 1',
    5: 'x, 2, {"a":1}, 0 of 1',
  },
  { template: '%d%% of %s', values: [50, 'x'], 4: '50% x of undefined', 5: '50% x of undefined' },
  { template: '$missing', values: [{ name: 'Ada' }], 4: 'undefined', 5: 'undefined' },
]

/** Checks every case with the rules of both majors. */
export function checkNameCases() {
  const problems = []

  for (const nameCase of NAME_CASES) {
    for (const major of [4, 5]) {
      const name = liveEachName(nameCase.template, nameCase.values, 0, major)

      if (name !== nameCase[major]) {
        problems.push(
          `names: ${JSON.stringify(nameCase.template)} with the rules of Vitest ${major} gives ${JSON.stringify(name)}, expected ${JSON.stringify(nameCase[major])}`,
        )
      }
    }
  }

  return { problems, cases: NAME_CASES.length }
}
