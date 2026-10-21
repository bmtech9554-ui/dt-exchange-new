#!/usr/bin/env bash
set -euo pipefail
: "${API_BASE_URL:?Set the approved HTTPS API URL}"
: "${VERSION_CODE:?Set the approved release build number}"
case "$VERSION_CODE" in ''|*[!0-9]*|0) echo 'Positive VERSION_CODE required' >&2; exit 1;; esac
case "$API_BASE_URL" in https://*) ;; *) echo 'HTTPS required' >&2; exit 1;; esac
cd "$(dirname "$0")/../mobile"
flutter clean
flutter pub get
flutter analyze
flutter test
case "${1:-}" in
 android)
 : "${DT_ANDROID_KEYSTORE:?Provide external keystore}" "${DT_ANDROID_STORE_PASSWORD:?}" "${DT_ANDROID_KEY_ALIAS:?}" "${DT_ANDROID_KEY_PASSWORD:?}"
 flutter build appbundle --release --build-name=1.0.0 --build-number="$VERSION_CODE" --dart-define="APP_VERSION_CODE=$VERSION_CODE" --dart-define="API_BASE_URL=$API_BASE_URL"
 ;;
 ios) test "$(uname -s)" = Darwin
 flutter build ipa --release --build-name=1.0.0 --build-number="$VERSION_CODE" --dart-define="APP_VERSION_CODE=$VERSION_CODE" --dart-define="API_BASE_URL=$API_BASE_URL" ;;
 *) echo 'Usage: scripts/native-release.sh android|ios' >&2; exit 1;;
esac
