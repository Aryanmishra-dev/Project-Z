#!/usr/bin/env bash
# Wrapper: forwards to init-dev.sh for backwards compatibility
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/init-dev.sh" "$@"
