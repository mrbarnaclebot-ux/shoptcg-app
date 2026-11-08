#!/bin/sh
# Apply pending migrations, then start the dev server. Magic links print to this console.
set -eu
cd "$(dirname "$0")/.."
pnpm db:migrate
exec pnpm dev
