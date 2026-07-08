#!/bin/sh

set -e

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$ROOT_DIR"

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "Se creo .env a partir de .env.example"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker no esta instalado o no esta en PATH."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker daemon no disponible."
  echo "Abri Docker Desktop y volve a ejecutar: bash scripts/dev.sh"
  exit 1
fi

detect_host_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1"
}

HOST_IP="${EXPO_HOST_IP:-$(detect_host_ip)}"
export EXPO_PUBLIC_API_URL="http://${HOST_IP}:3000/api"

EAS_PROJECT_ID=""
if [ -f .env ]; then
  EAS_PROJECT_ID=$(grep '^EXPO_PUBLIC_EAS_PROJECT_ID=' .env | head -n 1 | cut -d '=' -f 2-)
fi

# Expo inyecta EXPO_PUBLIC_* leyendo .env/.env.local al bundlear.
# Guardamos vars dinamicas para evitar fallback a localhost en dispositivos fisicos.
{
  printf 'EXPO_PUBLIC_API_URL=%s\n' "$EXPO_PUBLIC_API_URL"
  if [ -n "$EAS_PROJECT_ID" ]; then
    printf 'EXPO_PUBLIC_EAS_PROJECT_ID=%s\n' "$EAS_PROJECT_ID"
  fi
} > .env.local

echo "EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL"
if [ -n "$EAS_PROJECT_ID" ]; then
  echo "EXPO_PUBLIC_EAS_PROJECT_ID configurado"
else
  echo "EXPO_PUBLIC_EAS_PROJECT_ID no configurado (push remoto se omite en Expo Go)"
fi

docker compose up --build "$@"