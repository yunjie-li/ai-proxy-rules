#!/usr/bin/env bash
set -euo pipefail

git fetch --no-tags https://github.com/VPSDance/ai-proxy-rules.git main:refs/remotes/upstream/main
# Track upstream ancestry, then take its complete tree except our isolated overlay.
# This also handles deleted upstream files without conflicts in generated rules.
git merge --no-commit --no-ff --strategy=ours refs/remotes/upstream/main
git restore --source=refs/remotes/upstream/main --staged --worktree -- . \
  ':(exclude)fork' ':(exclude).github/workflows/generate.yml'
