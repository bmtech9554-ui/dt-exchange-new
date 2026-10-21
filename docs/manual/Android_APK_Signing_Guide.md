# Secure APK signing

Supply these values through a protected operator environment or secret manager, never source files or command-line literals:

| Variable | Purpose |
|---|---|
| DT_ANDROID_KEYSTORE | Absolute path to external release keystore |
| DT_ANDROID_STORE_PASSWORD | Keystore password |
| DT_ANDROID_KEY_ALIAS | Approved signing alias |
| DT_ANDROID_KEY_PASSWORD | Signing-key password |
| APK_SIGNER_SHA256 | Independently recorded release certificate fingerprint |
| APK_ATTESTATION_PRIVATE_KEY | External Ed25519 PEM key path used only by release verifier |
| APK_RELEASE_PUBLIC_KEY_B64 | Corresponding public key supplied to backend |
| API_BASE_URL | Owned HTTPS API URL including `/api/v1` |
| OFFICIAL_DOWNLOAD_ORIGIN | Exact owned HTTPS website origin, no trailing path |
| RELEASE_NOTES_FILE | Path to public release notes |
| VERSION_NAME / VERSION_CODE | Default `1.0.0` / `8002` |
| MINIMUM_VERSION_CODE | Minimum accepted Android build, default `8002` |
| MANDATORY_UPDATE | `true` only for a reviewed mandatory release |

The Android Gradle configuration reads signing values from environment and has no debug-key fallback. The release script refuses a keystore or attestation key inside the repository. Do not turn on shell tracing or print environment values.

`apksigner verify --verbose --print-certs` must succeed, the certificate must match the externally pinned release fingerprint, and `apkanalyzer manifest debuggable` must be false. The attestation tool reads the application ID/version directly from the APK, hashes its exact bytes and signs the public metadata. Admin cannot publish a manifest without a valid attestation signature.

Back up release signing material under organizational key-management policy. Losing the Android signing key prevents seamless updates to installed copies. Never put keystores, passwords, private attestations keys or certificates in source archives. This delivery generates no production signing key.
