#!/usr/bin/env bash
# Spike: with the bot account's token from the repository secret in $GH_TOKEN,
# posts one comment with an attached image on pull request $PR, or edits the
# bot's last one, and writes the outcome to the job summary and the log. A
# rerun attaches another image, which shows that an edit replaces it. Without
# the secret it says so. A failure is a finding, so the script never fails the
# job.
set -u

summary="${GITHUB_STEP_SUMMARY:-/dev/null}"
attempt="${GITHUB_RUN_ATTEMPT:-1}"

if [ -z "${GH_TOKEN:-}" ]; then
  {
    echo "### The bot account's token"
    echo
    echo "The secret DESCRIBE_ME_COMMENT_TOKEN is not set, so nothing was tried."
  } | tee -a "$summary"

  exit 0
fi

if [ $((attempt % 2)) -eq 1 ]; then
  image="spike/pr-attach/sample/card.png#Card before and after"
else
  image="spike/pr-attach/sample/button.png#Button before and after"
fi

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
  } | tee -a "$summary"
}

{
  echo "### The bot account's token, attempt $attempt"
  echo
  echo "$(gh --version | head -1)"
  echo
} | tee -a "$summary"

try "account" gh api user --jq .login

# The scopes of a classic token. A fine-grained token has no such header.
try "scopes" bash -c "gh api -i user | grep -i '^x-oauth-scopes' || echo 'no x-oauth-scopes header'"

try "comment with --edit-last --create-if-none --attach" \
  gh pr comment "$PR" \
  --edit-last --create-if-none \
  --body "Spike, from Actions with the bot account's token, attempt $attempt: one comment, edited on every rerun." \
  --attach "$image"
