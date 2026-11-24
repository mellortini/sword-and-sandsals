#!/usr/bin/env bash
# Checks out the gh-pages branch into $1 (an empty folder with a fresh repo when the branch does not exist yet).
set -euo pipefail
dir=$1
remote="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
if git ls-remote --exit-code --heads "$remote" gh-pages >/dev/null; then
  git clone --quiet --depth 1 --branch gh-pages "$remote" "$dir"
else
  git init --quiet -b gh-pages "$dir"
  git -C "$dir" remote add origin "$remote"
fi
