#!/bin/sh
set -e

# Install dependencies when node_modules is missing or empty.
if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "[docker-entrypoint] Installing dependencies..."
  npm install --legacy-peer-deps
fi

exec npm run start:tunnel
