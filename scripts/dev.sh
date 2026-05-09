#!/bin/sh

set -e

detect_host_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1"
}

HOST_IP="${EXPO_HOST_IP:-$(detect_host_ip)}"
export EXPO_PUBLIC_API_URL="http://${HOST_IP}:3000/api"

docker compose up --build "$@"