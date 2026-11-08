#!/bin/sh
# One-command local setup: deps, .env, database, browsers.
set -eu
cd "$(dirname "$0")/.."

pnpm install --frozen-lockfile

if [ ! -f .env ]; then
  cp .env.example .env
  secret=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  sed -i.bak "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$secret|" .env && rm -f .env.bak
  echo "Created .env with a fresh BETTER_AUTH_SECRET"
fi

pnpm db:migrate
pnpm exec playwright install chromium
echo "Setup done. Run scripts/dev.sh"
