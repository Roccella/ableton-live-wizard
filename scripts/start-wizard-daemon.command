#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -d node_modules ]]; then
  npm install
fi

if [[ ! -f dist/src/daemon/main.js ]]; then
  npm run build
fi

LIVE_BRIDGE="${LIVE_BRIDGE:-tcp}" npm run daemon
