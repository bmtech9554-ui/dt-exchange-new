# Build 8008 controlled publication

Owner explicitly approved publication and the separate metadata attestation infrastructure. Final permission choice supersedes the earlier proposal: FINANCIAL_ADMIN is not granted or used for Android releases.

Additive migration014 defines ANDROID_RELEASE_PUBLISH and android-release-publisher only; the existing administrator receives this role alongside unchanged operations/manual-deposit-approver roles. Migration/assignment is audited. AndroidService history/publication now require the dedicated permission, retaining signed metadata validation, immutable release evidence, official URL checks and append-only publication audit.

Private Ed25519 metadata key is outside the repository, restricted to the Windows user and SYSTEM. Only public verification material reaches the API. Existing APK production keystore/certificate unchanged. Recovery planning is documented separately; no private key backup transfer was made.

Tests:41 website tests/build passed. Full208 backend tests initially had one obsolete migration count assertion; corrected14-migration assertion and all27 tests in its suite passed. New publisher RBAC/attestation tests passed. Flutter code/APK unchanged; previous clean analysis,348 tests and physical8008 animation/tab/background validation retained.

Encrypted backup completed before migration. Initial migration attempt rolled back fully on an audit actor constraint; corrected atomic attempt committed. Production preflight confirms exact seven existing+release permissions, no FINANCIAL_ADMIN/payout/settings/role/ledger grants, valid attestation, tamper rejection, manual mode, disabled automation and disabled synthetic access. Website final terms section and responsive anchors pass on live HTTPS.

Publication pending complete transfer/hash verification. Public file not activated yet.

## Completed publication
PRODUCTION_RELEASE_COMPLETE

Build8008/version1.0.0 published through AndroidService with the approved ANDROID_RELEASE_PUBLISH permission and verified Ed25519 metadata attestation. Existing Android signing identity unchanged. The server reconstructed the losslessly compressed transfer and verified exact SHA-256 before activating the artifact. No APK rebuild or re-sign occurred.

Official page: https://dtexchange.app/download
Official APK: https://dtexchange.app/downloads/DTExchange.apk
Bytes:59301632
SHA-256:179984a39c28e990ac8aa87e61ce296762a0149ac19347641b83ada07ffc71b2
Certificate SHA-256:475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c

Independent public HTTPS download completed locally; hash and production apksigner verification passed. Public debug/preview/noncanonical APK paths returned404. Download page renders correct CTA, version/build, size/date/checksum at390/1440px without overflow. Homepage availability text corrected to use validated release metadata and website41 tests/build passed again; final terms section and official Telegram links retained.

API readiness200. Active release is8008 only. Role-assignment and android.publish audit records verified. Existing operations/deposit-review permissions retained; no FINANCIAL_ADMIN or broader grants added. Synthetic window disabled, automatic blockchain credit/payout false, manual review/payout true. Transaction/payout global controls not enabled by publication. No real financial action or SMS was performed.

No remaining blocker for this APK publication. Attestation private-key off-device backup remains an owner-approved future recovery action, as documented; no recovery material was transferred.
