#!/usr/bin/env bash
# Builds assets/Vir.app: a universal (arm64 + x86_64), ad-hoc-signed helper
# app that posts desktop notifications as "vir". The output is committed and
# shipped in the npm package, so installing vir never needs a Swift toolchain.
# Needs macOS with Xcode or the Command Line Tools. Run: npm run build:notifier
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
app="$root/assets/Vir.app"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$here/Info.plist" "$app/Contents/Info.plist"

for arch in arm64 x86_64; do
  swiftc -O -target "$arch-apple-macos11" "$here/main.swift" -o "$work/vir-notifier-$arch"
done
lipo -create "$work/vir-notifier-arm64" "$work/vir-notifier-x86_64" \
  -output "$app/Contents/MacOS/vir-notifier"

# Thicker strokes than the site logo so the spiral survives at 32px.
sed 's/stroke-width="2.1"/stroke-width="4"/' "$root/assets/vir_graph_spiral.svg" > "$work/logo.svg"
swiftc -O "$here/icon.swift" -o "$work/icon"
mkdir "$work/vir.iconset"
for s in 16 32 128 256 512; do
  "$work/icon" "$work/logo.svg" "$work/vir.iconset/icon_${s}x${s}.png" "$s"
  "$work/icon" "$work/logo.svg" "$work/vir.iconset/icon_${s}x${s}@2x.png" "$((s * 2))"
done
iconutil -c icns "$work/vir.iconset" -o "$app/Contents/Resources/vir.icns"

codesign --force --sign - "$app"
codesign --verify --strict "$app"
echo "built $app ($(lipo -archs "$app/Contents/MacOS/vir-notifier"))"
