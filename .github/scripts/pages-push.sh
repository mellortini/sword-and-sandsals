#!/usr/bin/env bash
# Replaces gh-pages with a single commit holding the contents of $1, so the branch never grows a history.
set -euo pipefail
dir=$1
message=$2
cd "$dir"
touch .nojekyll
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout --quiet --orphan next
git add -A
git commit --quiet --allow-empty -m "$message"
git push --quiet --force origin next:gh-pages
