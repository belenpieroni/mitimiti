#!/bin/sh

set -e

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
exec sh "$ROOT_DIR/scripts/dev.sh" "$@"
