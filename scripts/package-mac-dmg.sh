#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DMG="${1:-$ROOT_DIR/dist/mac/Wavelength-mac.dmg}"
OUTPUT_DIR="$(dirname "$OUTPUT_DMG")"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/wavelength-mac.XXXXXX")"
APP_PATH="$TEMP_DIR/Wavelength.app"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

mkdir -p "$OUTPUT_DIR" "$APP_PATH/Contents/MacOS" "$APP_PATH/Contents/Resources" "$TEMP_DIR/dmg"

ICON_SOURCE="$ROOT_DIR/public/icons/wavelength-512.png"
if [[ ! -f "$ICON_SOURCE" ]]; then
  echo "Missing Wavelength app icon: $ICON_SOURCE" >&2
  exit 1
fi
sips -s format icns "$ICON_SOURCE" --out "$APP_PATH/Contents/Resources/Wavelength.icns" >/dev/null

cat > "$TEMP_DIR/main.swift" <<'SWIFT'
import AppKit
import Foundation

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

DispatchQueue.main.async {
    guard let chromeURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.google.Chrome") else {
        let alert = NSAlert()
        alert.messageText = "Google Chrome is required"
        alert.informativeText = "Install Google Chrome, then open Wavelength again."
        alert.alertStyle = .warning
        alert.addButton(withTitle: "OK")
        alert.runModal()
        app.terminate(nil)
        return
    }

    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
    process.arguments = ["-na", chromeURL.path, "--args", "--app=https://wavelength-d6a7c.web.app/"]
    do {
        try process.run()
    } catch {
        let alert = NSAlert()
        alert.messageText = "Wavelength could not open"
        alert.informativeText = error.localizedDescription
        alert.alertStyle = .warning
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
    app.terminate(nil)
}

app.run()
SWIFT

swiftc -O -module-cache-path "$TEMP_DIR/module-cache" -framework AppKit "$TEMP_DIR/main.swift" -o "$APP_PATH/Contents/MacOS/Wavelength"
cat > "$APP_PATH/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>com.wavelength.music</string>
  <key>CFBundleName</key><string>Wavelength</string>
  <key>CFBundleDisplayName</key><string>Wavelength</string>
  <key>CFBundleExecutable</key><string>Wavelength</string>
  <key>CFBundleIconFile</key><string>Wavelength.icns</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>LSMinimumSystemVersion</key><string>10.15</string>
</dict>
</plist>
PLIST
plutil -lint "$APP_PATH/Contents/Info.plist" >/dev/null
codesign --force --deep --sign - "$APP_PATH" >/dev/null
cp -R "$APP_PATH" "$TEMP_DIR/dmg/Wavelength.app"
ln -s /Applications "$TEMP_DIR/dmg/Applications"
hdiutil create -volname Wavelength -srcfolder "$TEMP_DIR/dmg" -ov -format UDZO "$OUTPUT_DMG" >/dev/null
hdiutil verify "$OUTPUT_DMG" >/dev/null

echo "Created and verified: $OUTPUT_DMG"
