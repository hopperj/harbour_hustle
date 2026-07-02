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

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    return 1
  fi
}

if ! need_command node || ! need_command npm; then
  echo
  echo "Install Node.js 20.19+ or 22.12+ first, then rerun ./install.sh." >&2
  if [ "$OS_NAME" = "macOS" ]; then
    echo "macOS option: brew install node" >&2
  else
    echo "Linux option: install Node.js from your distro, nvm, fnm, or https://nodejs.org/" >&2
  fi
  exit 1
fi

NODE_VERSION="$(node -p "process.versions.node")"
NODE_OK="$(node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.stdout.write((major > 22 || (major === 22 && minor >= 12) || (major === 20 && minor >= 19)) ? 'yes' : 'no')")"

if [ "$NODE_OK" != "yes" ]; then
  echo "Unsupported Node.js version: $NODE_VERSION" >&2
  echo "Please install Node.js 20.19+ or 22.12+." >&2
  exit 1
fi

echo "Detected $OS_NAME."
echo "Using Node.js $NODE_VERSION and npm $(npm --version)."

if [ -f package-lock.json ]; then
  echo "Installing dependencies with npm ci..."
  npm ci
else
  echo "Installing dependencies with npm install..."
  npm install
fi

echo "Install complete."
