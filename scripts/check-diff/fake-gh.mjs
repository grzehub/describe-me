/**
 * A stand-in for `gh` in scenario 29 of check-diff, which runs the comment
 * step of .github/workflows/changes.yml. It keeps the comments of one pull
 * request in `$FAKE_GH_STATE/comments.json`, appends each call to
 * `$FAKE_GH_STATE/calls.jsonl` and answers only the calls of that step, as
 * gh 2.105 does. With `FAKE_GH_NO_ATTACH=1` its help has no `--attach`.
 *
 * Usage: `node scripts/check-diff/fake-gh.mjs <gh arguments>`
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const LOGIN = 'the-bot'
const ATTACHMENT_URL = 'https://github.com/user-attachments/assets/'
const state = process.env.FAKE_GH_STATE
const args = process.argv.slice(2)
const commentsFile = join(state, 'comments.json')
const comments = JSON.parse(readFileSync(commentsFile, 'utf8'))

appendFileSync(join(state, 'calls.jsonl'), `${JSON.stringify(args)}\n`)

function fail(message) {
  console.error(message)
  process.exit(1)
}

function save() {
  writeFileSync(commentsFile, JSON.stringify(comments, null, 2))
}

/** The body as gh sends it: each attached file's reference swapped for its URL, an unreferenced one appended. */
function sentBody() {
  let body = readFileSync(args[args.indexOf('--body-file') + 1], 'utf8')
  const attached = args.filter((_, i) => args[i - 1] === '--attach')

  for (const path of attached) {
    if (!existsSync(path)) {
      fail(`${path}: no such file`)
    }

    const name = path.replace(/^\.\//, '')
    const url = `${ATTACHMENT_URL}${name}`

    body = body.includes(`](./${name})`)
      ? body.replace(`](./${name})`, `](${url})`)
      : `${body}\n![${name}](${url})`
  }

  return body
}

function comment() {
  if (args.includes('--edit-last')) {
    const last = comments.filter((item) => item.user.login === LOGIN).at(-1)

    if (last === undefined) {
      fail('no comments found for the current user')
    }

    last.body = sentBody()
    save()
    console.log(last.html_url)

    return
  }

  const id = Math.max(100, ...comments.map((item) => item.id)) + 1
  const html = `https://github.com/${process.env.GH_REPO}/pull/${args[2]}#issuecomment-${id}`

  comments.push({ id, user: { login: LOGIN }, body: sentBody(), html_url: html })
  save()
  console.log(html)
}

/** gh prints one JSON array per page. Two comments a page make the step merge pages. */
function pages() {
  if (comments.length === 0) {
    console.log('[]')
  }

  for (let i = 0; i < comments.length; i += 2) {
    console.log(JSON.stringify(comments.slice(i, i + 2)))
  }
}

function remove(path) {
  const id = Number(path.split('/').at(-1))
  const index = comments.findIndex((item) => item.id === id)

  if (index < 0) {
    fail(`HTTP 404: Not Found (${path})`)
  }

  comments.splice(index, 1)
  save()
}

const call = args.join(' ')

if (call === '--version') {
  console.log('gh version 2.98.0 (2026-01-01)')
} else if (call === 'pr comment --help') {
  const attach = process.env.FAKE_GH_NO_ATTACH === '1' ? '' : '      --attach file\n'

  console.log(`${attach}  -F, --body-file file\n      --edit-last`)
} else if (call === 'api user --jq .login') {
  console.log(LOGIN)
} else if (
  call ===
  `api --paginate repos/${process.env.GH_REPO}/issues/${process.env.PR}/comments?per_page=100`
) {
  pages()
} else if (args[0] === 'api' && args[1] === '-X' && args[2] === 'DELETE') {
  remove(args[3])
} else if (args[0] === 'pr' && args[1] === 'comment') {
  comment()
} else {
  console.error(`fake gh: unknown call ${call}`)
  process.exit(2)
}
