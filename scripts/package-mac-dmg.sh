#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

npm run build
mkdir -p build
sips -s format icns public/icons/wavelength-512.png --out build/mac-icon.icns >/dev/null
./node_modules/.bin/electron-builder --mac dmg
