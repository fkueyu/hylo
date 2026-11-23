#!/usr/bin/env bash
# Mac App Store 构建脚本（原 package.json 中内联的一长串命令，便于维护与复用）
#
# 需要的环境变量（可选，默认沿用 li tan / UKK3BUGG85 的现有发布配置）：
#   MAS_SIGN_IDENTITY   3rd Party Mac Developer Application 证书名
#   MAS_INSTALL_IDENTITY 3rd Party Mac Developer Installer 证书名
#   MAS_TEAM_ID          Apple Developer Team ID
set -euo pipefail

cd "$(dirname "$0")/.."

MAS_SIGN_IDENTITY="${MAS_SIGN_IDENTITY:-3rd Party Mac Developer Application: li tan (UKK3BUGG85)}"
MAS_INSTALL_IDENTITY="${MAS_INSTALL_IDENTITY:-3rd Party Mac Developer Installer: li tan (UKK3BUGG85)}"

echo "==> 1/4 TypeScript + Vite build (App Store variant)"
npx tsc
VITE_APP_STORE=true npx vite build

echo "==> 2/4 Tauri bundle (appstore features)"
npx tauri build --config src-tauri/tauri.appstore.conf.json --features appstore --bundles app

APP="src-tauri/target/release/bundle/macos/Hylo.app"
BIN="$APP/Contents/MacOS/tauri-app"

echo "==> 3/4 Localizations + code signing"
xattr -c src-tauri/embedded.provisionprofile || true
xattr -cr "$APP"
mkdir -p "$APP/Contents/Resources/zh.lproj" "$APP/Contents/Resources/en.lproj"
touch "$APP/Contents/Resources/zh.lproj/Localizable.strings"
touch "$APP/Contents/Resources/en.lproj/Localizable.strings"
codesign --force --options runtime --sign "$MAS_SIGN_IDENTITY" \
  --entitlements src-tauri/entitlements.plist \
  --identifier "ink.ainx.hylo.editor.v2" "$BIN"
codesign --force --options runtime --sign "$MAS_SIGN_IDENTITY" \
  --entitlements src-tauri/entitlements.plist \
  --identifier "ink.ainx.hylo.editor.v2" "$APP"

echo "==> 4/4 Product archive (pkg)"
productbuild --sign "$MAS_INSTALL_IDENTITY" \
  --component "$APP" /Applications \
  "src-tauri/target/release/bundle/macos/Hylo.pkg"

echo "Done: src-tauri/target/release/bundle/macos/Hylo.pkg"
