#!/usr/bin/env bash
set -euo pipefail

APP=$(find "$HOME/Library/Developer/Xcode/DerivedData" -path "*/Debug-iphonesimulator/helm.app" -type d 2>/dev/null | head -1)

if [[ -z "$APP" ]]; then
  echo "❌ helm.app not found in DerivedData — run: bun run ios"
  exit 1
fi

APPEX="$APP/PlugIns/HelmWidgetExtension.appex"
if [[ ! -d "$APPEX" ]]; then
  echo "❌ Widget extension NOT embedded in:"
  echo "   $APP"
  echo ""
  echo "Fix:"
  echo "  bun run prebuild:ios"
  echo "  bun run ios"
  exit 1
fi

echo "✅ Widget extension embedded:"
echo "   $APPEX"
plutil -p "$APPEX/Info.plist" | rg "CFBundleDisplayName|CFBundleIdentifier" || true
