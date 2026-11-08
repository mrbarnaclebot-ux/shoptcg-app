#!/bin/sh
# Everything CI runs, in the same order.
set -eu
cd "$(dirname "$0")/.."
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
