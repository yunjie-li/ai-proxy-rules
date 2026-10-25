#!/usr/bin/env bash
set -euo pipefail
script=$(cd "$(dirname "$0")" && pwd)/sync-upstream.sh
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT

git init -q -b main "$fixture/upstream"
git -C "$fixture/upstream" config user.name test
git -C "$fixture/upstream" config user.email test@example.invalid
mkdir -p "$fixture/upstream/.github/workflows"
printf 'initial\n' > "$fixture/upstream/code.ts"
printf 'obsolete\n' > "$fixture/upstream/deleted.ts"
printf 'upstream workflow\n' > "$fixture/upstream/.github/workflows/generate.yml"
git -C "$fixture/upstream" add .
git -C "$fixture/upstream" commit -qm initial
git clone -q "$fixture/upstream" "$fixture/fork"
git -C "$fixture/fork" config user.name test
git -C "$fixture/fork" config user.email test@example.invalid
mkdir -p "$fixture/fork/fork"
printf 'keep filter\n' > "$fixture/fork/fork/filter.ts"
printf 'keep fork workflow\n' > "$fixture/fork/.github/workflows/generate.yml"
printf 'local edit\n' > "$fixture/fork/code.ts"
git -C "$fixture/fork" add .
git -C "$fixture/fork" commit -qm overlay
printf 'latest upstream\n' > "$fixture/upstream/code.ts"
printf 'new upstream file\n' > "$fixture/upstream/added.ts"
rm "$fixture/upstream/deleted.ts"
git -C "$fixture/upstream" add -A
git -C "$fixture/upstream" commit -qm update
git -C "$fixture/fork" config "url.$fixture/upstream.insteadOf" https://github.com/VPSDance/ai-proxy-rules.git
cd "$fixture/fork"
bash "$script"
test "$(cat code.ts)" = 'latest upstream'
test "$(cat fork/filter.ts)" = 'keep filter'
test "$(cat .github/workflows/generate.yml)" = 'keep fork workflow'
test -f added.ts
test ! -e deleted.ts
git commit -qm synced
git merge-base --is-ancestor "$(git -C "$fixture/upstream" rev-parse HEAD)" HEAD
bash "$script"
test -z "$(git status --porcelain)"
printf 'Upstream sync, deletions, overlay preservation, ancestry and repeated sync passed.\n'
