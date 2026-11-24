#!/bin/sh
# Updates the site on the server: new code from GitHub, rebuild, restart.
# The site is down for a minute or two while it builds.
set -e
cd "$(dirname "$0")/.."
git pull
docker compose up -d --build
docker image prune -f > /dev/null
echo "Updated. Follow the build with: docker compose logs -f app"
