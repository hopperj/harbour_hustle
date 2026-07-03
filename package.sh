#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    return 1
  fi
}

if ! need_command npm || ! need_command zip || ! need_command unzip; then
  exit 1
fi

if [ ! -f VERSION ]; then
  echo "Missing VERSION file." >&2
  exit 1
fi

VERSION="$(tr -d '[:space:]' < VERSION)"

if [ -z "$VERSION" ]; then
  echo "VERSION file is empty." >&2
  exit 1
fi

case "$VERSION" in
  *[!A-Za-z0-9._-]*)
    echo "VERSION contains invalid filename characters: $VERSION" >&2
    echo "Use only letters, numbers, dots, underscores, and hyphens." >&2
    exit 1
    ;;
esac

ZIP_NAME="harbour-hustle-$VERSION.zip"
ZIP_PATH="$ROOT_DIR/$ZIP_NAME"

echo "Building Harbour Hustle $VERSION..."
npm run build

rm -f "$ZIP_PATH"

echo "Creating $ZIP_NAME..."
(
  cd dist
  zip -qr "$ZIP_PATH" . \
    -x ".git" \
    -x ".git/*" \
    -x ".gitignore" \
    -x ".gitattributes" \
    -x ".gitmodules" \
    -x "*/.git" \
    -x "*/.git/*" \
    -x "*/.gitignore" \
    -x "*/.gitattributes" \
    -x "*/.gitmodules"
)

if unzip -Z1 "$ZIP_PATH" | grep -Eq '(^|/)\.git($|/|ignore$|attributes$|modules$)'; then
  echo "Package contains Git files or metadata; removing $ZIP_NAME." >&2
  rm -f "$ZIP_PATH"
  exit 1
fi

echo "Created $ZIP_NAME"
