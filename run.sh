#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

case "$(uname -s)" in
  Darwin)
    OS_NAME="macOS"
    ;;
  Linux)
    OS_NAME="Linux"
    ;;
  *)
    echo "Unsupported OS: $(uname -s). This project supports macOS and Linux." >&2
    exit 1
    ;;
esac

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. Run ./install.sh after installing Node.js." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Dependencies are not installed. Run ./install.sh first." >&2
  exit 1
fi

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-5173}"

echo "Detected $OS_NAME."
echo "Starting Harbour Hustle at http://$HOST:$PORT/"
echo "Use HOST=0.0.0.0 or PORT=3000 to override defaults."

./node_modules/.bin/vite --host "$HOST" --port "$PORT"
