#!/usr/bin/env bash
# Creates or updates the single preview comment (found by $MARKER) on PR $PR.
set -euo pipefail
body=$1
id=$(gh api "repos/${GITHUB_REPOSITORY}/issues/${PR}/comments" --paginate \
  --jq ".[] | select(.body | startswith(\"${MARKER}\")) | .id" | head -n 1)
if [ -n "$id" ]; then
  gh api --method PATCH "repos/${GITHUB_REPOSITORY}/issues/comments/${id}" -f body="$body" >/dev/null
else
  gh api --method POST "repos/${GITHUB_REPOSITORY}/issues/${PR}/comments" -f body="$body" >/dev/null
fi
