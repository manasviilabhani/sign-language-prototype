#!/usr/bin/env bash
# Serve the prototype on localhost so the browser will grant microphone access.
set -e
PORT="${1:-8765}"
cd "$(dirname "$0")"
echo "Open http://localhost:$PORT in Chrome  (ctrl-c to stop)"
exec python3 -m http.server "$PORT"
