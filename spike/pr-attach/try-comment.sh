#!/usr/bin/env bash
# Spike: posts a plain comment and one with an attached image on pull request
# $PR, with the token in $GH_TOKEN, and writes each outcome to the job summary.
# $GRANT names the permissions the token was given. A failure is a finding, so
# the script never fails the job.
set -u

summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
image="spike/pr-attach/sample/card.png"

try() {
  local name="$1"
  shift

  local output
  output="$("$@" 2>&1)"
  local status=$?

  {
    echo "**$name**: exit $status"
    echo
    echo '```'
    echo "$output"
    echo '```'
  } >> "$summary"
}

{
  echo "### GITHUB_TOKEN with \`$GRANT\`"
  echo
  echo "$(gh --version | head -1)"
  echo
} >> "$summary"

try "plain comment" \
  gh pr comment "$PR" --body "Spike, from Actions with \`$GRANT\`: a plain comment."

try "comment with --attach" \
  gh pr comment "$PR" \
  --body "Spike, from Actions with \`$GRANT\`: a comment with an attached image." \
  --attach "$image#Card before and after"
