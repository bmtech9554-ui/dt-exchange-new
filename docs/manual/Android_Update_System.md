# Android update system

`GET /api/v1/app/version/android` is public and returns availability, latest version/name/code, minimum version code, APK URL, official download page URL, SHA-256, signing certificate SHA-256, byte size, release date, notes and mandatory flag. With no signed release it returns `available:false`; no artifact details are invented.

Admin release publication requires FINANCIAL_ADMIN and a valid external Ed25519 attestation. Both URLs must belong to `APK_ALLOWED_ORIGINS`; APK path is `/downloads/DTExchange.apk` and page path `/download`. Credentials, queries, fragments and arbitrary hosts are rejected. New version codes increase, minimum version cannot go backward, and historical metadata is immutable except deactivation.

Release builds produced by the provided script enable the version gate and bind `OFFICIAL_DOWNLOAD_ORIGIN` and `APP_VERSION_CODE`. The app checks metadata before allowing the signed-release session to proceed. Network failure offers retry. Optional newer versions show Update Now / Later. A below-minimum or mandatory newer release blocks use until update. Update opens only the configured official HTTPS `/download` page; no silent installation occurs.

The backend also checks `x-dt-version-code` on financial writes when ANDROID_UPDATE_ENFORCED is true. Missing/unacceptable versions or missing active release metadata are blocked. This header is not device attestation and can be forged by a custom client; all financial authorization and safety controls remain enforced independently.

The website does not automatically host files when metadata is published. The operator must stage verified signed bytes, verify TLS/hash and publish metadata in a controlled release. Known-vulnerable APKs must be removed from active hosting; deprecated metadata alone must not leave a vulnerable download accessible.
