import { PAGE_URL_PREFIX } from '@describe-me/core/types'
import type { ProjectPaths } from './project-paths.js'

const DEV_ID = 'data-vite-dev-id'

/**
 * What the `href` of a link of Vitest's own page starts with, once the page
 * URLs are rewritten: `/__vitest__/`, `/__vitest_browser__/` or `/__vitest_test__/`.
 */
const RUNNER_HREF = `${PAGE_URL_PREFIX}/__vitest`

/** rrweb's `NodeType.Element`. */
const ELEMENT_NODE = 2

/** A leading `/` or `\`, or a drive letter. */
const ABSOLUTE_PATH = /^(?:[\\/]|[A-Za-z]:)/

/** The part of an rrweb serialized node that the walk reads. */
interface SerializedNode {
  type?: unknown
  tagName?: unknown
  attributes?: Record<string, unknown>
  childNodes?: unknown
}

function isNode(value: unknown): value is SerializedNode {
  return typeof value === 'object' && value !== null
}

function isElement(node: SerializedNode, tagName: string): boolean {
  return (
    node.type === ELEMENT_NODE &&
    typeof node.tagName === 'string' &&
    node.tagName.toLowerCase() === tagName
  )
}

/** The icon of Vitest's page or the preload of its runner, in browser mode. */
function isRunnerLink(node: SerializedNode): boolean {
  const href = isNode(node.attributes) ? node.attributes.href : undefined

  return isElement(node, 'link') && typeof href === 'string' && href.startsWith(RUNNER_HREF)
}

function isLeftOut(node: SerializedNode): boolean {
  return isElement(node, 'script') || isRunnerLink(node)
}

function cleanDevId(node: SerializedNode, paths: ProjectPaths): void {
  const attributes = isNode(node.attributes) ? node.attributes : {}
  const devId = attributes[DEV_ID]

  if (typeof devId !== 'string' || !ABSOLUTE_PATH.test(devId)) {
    return
  }

  const path = paths.of(devId)

  if (path === undefined) {
    delete attributes[DEV_ID]
  } else {
    attributes[DEV_ID] = path
  }
}

function clean(node: SerializedNode, paths: ProjectPaths): void {
  cleanDevId(node, paths)

  if (!Array.isArray(node.childNodes)) {
    return
  }

  const children = node.childNodes.filter((child) => !isNode(child) || !isLeftOut(child))
  node.childNodes = children

  for (const child of children) {
    if (isNode(child)) {
      clean(child, paths)
    }
  }
}

/**
 * A serialized snapshot without what names the machine or the run that
 * recorded it: every `<script>`, which the viewer never runs, the links of
 * Vitest's own page, whose files are named after their content, and absolute
 * paths in Vite's `data-vite-dev-id`. rrweb keeps shadow roots and iframe
 * documents among the child nodes, so they are cleaned too. Node ids stay as
 * rrweb wrote them.
 */
export function cleanSnapshot(json: string, paths: ProjectPaths): string {
  const nothingToClean =
    !json.includes('"tagName":"script"') &&
    !json.includes(`"${DEV_ID}"`) &&
    !json.includes(RUNNER_HREF)

  if (nothingToClean) {
    return json
  }

  const tree: unknown = JSON.parse(json)

  if (isNode(tree)) {
    clean(tree, paths)
  }

  return JSON.stringify(tree)
}
