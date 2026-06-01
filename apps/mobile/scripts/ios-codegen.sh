#!/usr/bin/env bash
# Regenerate ios/build/generated after ios/build was deleted (disk cleanup / clean).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RN="$ROOT/node_modules/react-native/scripts/generate-codegen-artifacts.js"

if [[ ! -f "$RN" ]]; then
  echo "error: react-native not found — run bun install" >&2
  exit 1
fi

echo "[ios-codegen] generating into ios/build/generated/ios/..."
node "$RN" --path "$ROOT" --outputPath "$ROOT/ios" --targetPlatform ios
echo "[ios-codegen] done"
