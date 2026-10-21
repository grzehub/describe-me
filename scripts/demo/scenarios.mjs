import { foundationsScenario } from './foundations-scenario.mjs'
import { SIGNUP_STORIES, signupScenario } from './signup-scenario.mjs'

/** Every demo by name: the test its viewer opens on, and the scenario that records it. */
export const scenarios = {
  submits: {
    test: SIGNUP_STORIES.submits.test,
    run: (stage) => signupScenario(stage, SIGNUP_STORIES.submits),
  },
  rejects: {
    test: SIGNUP_STORIES.rejects.test,
    run: (stage) => signupScenario(stage, SIGNUP_STORIES.rejects),
  },
  foundations: {
    test: SIGNUP_STORIES.submits.test,
    run: foundationsScenario,
  },
}
