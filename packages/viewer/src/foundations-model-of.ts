import type { FoundationsModel } from './build-foundations-model.js'
import { buildFoundationsModel } from './build-foundations-model.js'
import type { FoundationsLoad } from './load-foundations.js'
import { readCustomProperties } from './read-custom-properties.js'

type Ready = Extract<FoundationsLoad, { status: 'ready' }>

const models = new WeakMap<Ready, FoundationsModel>()

/**
 * The model of a finished load, built once per load, because every repaint
 * shows the panel and the inspector and parsing the sheets is not free.
 */
export function foundationsModelOf(load: Ready): FoundationsModel {
  let model = models.get(load)

  if (!model) {
    model = buildFoundationsModel(load.file, readCustomProperties(load.tokenCss))
    models.set(load, model)
  }

  return model
}
