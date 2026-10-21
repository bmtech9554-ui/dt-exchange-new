#!/usr/bin/env bash
set -euo pipefail
# Never enable shell tracing: signing credentials are environment-only.
: "${API_BASE_URL:?HTTPS production API required}"
: "${OFFICIAL_DOWNLOAD_ORIGIN:?Verified official HTTPS website origin required}"
: "${DT_ANDROID_KEYSTORE:?External release keystore required}"
: "${DT_ANDROID_STORE_PASSWORD:?}" "${DT_ANDROID_KEY_ALIAS:?}" "${DT_ANDROID_KEY_PASSWORD:?}"
: "${APK_SIGNER_SHA256:?Expected release signing certificate SHA-256 required}"
: "${APK_ATTESTATION_PRIVATE_KEY:?External Ed25519 release-attestation key path required}"
: "${RELEASE_NOTES_FILE:?Release notes file required}"
: "${VERSION_CODE:?Set the approved release build number}"
: "${MINIMUM_VERSION_CODE:?Set the approved minimum supported build number}"
export VERSION_NAME="${VERSION_NAME:-1.0.0}" VERSION_CODE MINIMUM_VERSION_CODE
node -e 'for(const k of ["API_BASE_URL","OFFICIAL_DOWNLOAD_ORIGIN"]){const u=new URL(process.env[k]);if(u.protocol!=="https:"||u.username||u.password||u.hostname==="localhost"||u.hostname.endsWith(".invalid"))throw Error("Approved HTTPS configuration required");}'
command -v flutter >/dev/null
command -v apksigner >/dev/null
command -v apkanalyzer >/dev/null
root="$(cd "$(dirname "$0")/.." && pwd)"
case "$(realpath "$DT_ANDROID_KEYSTORE")" in "$root"/*) echo 'Keystore must be outside source repository' >&2; exit 1;; esac
case "$(realpath "$APK_ATTESTATION_PRIVATE_KEY")" in "$root"/*) echo 'Attestation key must be outside source repository' >&2; exit 1;; esac
cd "$root/mobile"
flutter clean
flutter pub get
flutter analyze
flutter test
flutter build apk --release --build-name="$VERSION_NAME" --build-number="$VERSION_CODE" --dart-define="APP_VERSION_CODE=$VERSION_CODE" --dart-define="API_BASE_URL=$API_BASE_URL" --dart-define="OFFICIAL_DOWNLOAD_ORIGIN=$OFFICIAL_DOWNLOAD_ORIGIN" --dart-define=ANDROID_UPDATES_ENABLED=true
mkdir -p "$root/release/artifacts"
cp build/app/outputs/flutter-apk/app-release.apk "$root/release/artifacts/DTExchange.apk"
cd "$root"
node scripts/attest-apk.mjs release/artifacts/DTExchange.apk
# The attestation script hashes the final bytes. Do not modify APK after this step.
