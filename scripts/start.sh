#!/bin/sh
# Starts the site in its container: migrate the database, build once, serve.
# A restart of the same container skips the build; an update (a new container) builds again.
set -e
node scripts/migrate.mjs --soft
if [ ! -f .next/BUILD_ID ]; then
  echo "[start] building the site, this takes a minute or two"
  npx next build
fi
exec npx next start -H 0.0.0.0 -p 3000
