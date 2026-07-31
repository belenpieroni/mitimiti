#!/bin/sh
set -e

# Install dependencies when node_modules is missing, empty, or missing a key package.
if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ] || ! npm ls expo-document-picker --depth=0 >/dev/null 2>&1; then
  echo "[docker-entrypoint] Installing dependencies..."
  npm install --legacy-peer-deps
fi

exec npx expo start --lan
