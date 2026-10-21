# Build 8009 Home and website cleanup

Scope: remove the two Home status/error prompts and their spacing; remove the public website Manual Review & Processing Terms section and its footer anchor. No backend, RBAC, financial policy or signing-identity changes. Notification module, approved graph painter/lifecycle, server-authoritative rate, Telegram and relevant bank/compliance copy are retained. Quote errors remain beside the existing quick-sell input instead of a top Home prompt.

Changed application files:
- mobile/lib/features/home/home_page.dart
- mobile/pubspec.yaml (1.0.0+8009)
- mobile/config/production.json (8009; production API unchanged)
- admin/src/app/site/page.tsx
- admin/test/public-site.test.tsx

Release helper updated for Build 8009. The separately pending admin login fix was not included in the website deployment: only the public site page was transferred and rebuilt remotely.

Validation:
- Flutter analyze: no issues.
- Flutter tests: 348 passed.
- Website tests: 41 passed; production build passed.
- Backend unchanged; no migrations or backend deployment.
- Existing production certificate and non-debug APK manifest verified independently with Android tools.
- Downloads copy checksum matches; Samsung SM-F956B updated with adb install -r; no uninstall or app-data clear. User signed in on the device when the existing session required authentication.
- Physical Home: removed prompts absent, no empty gap, correct rupee glyph and backend 103.00 rate, approved graph design, sustained animation over 61 seconds, tab and background resume.
- Wallet/History/Profile/Home navigation, Deposit/Sell entry screens, Telegram Support @dtexchange verified without submissions or financial actions.
- Website-only deployment completed. Live 320/390/1440 px layouts have no horizontal overflow, removed section/heading/anchor, no broken anchors and two official Telegram links. Footer follows remaining download section.

APK SHA-256: 9f4191c5d4085a2c25e866ca98990646cd23cba485eb3e70a5042f715afd40fa
Certificate SHA-256: 475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c
APK size: 59301632 bytes.

Build 8009 publication completed through the existing AndroidService workflow and dedicated ANDROID_RELEASE_PUBLISH permission, with verified attestation and an append-only publication audit. No role changes. The previous public artifact is retained outside the public directory for rollback. Minimum supported build remains 8008; this cleanup does not impose a forced-update policy.

## Completed public verification

Official page: https://dtexchange.app/download
Official APK: https://dtexchange.app/downloads/DTExchange.apk

Independent full HTTPS download: exact 59301632-byte size and SHA-256 matched; production APK signature verified with apksigner and the unchanged certificate. Debug/preview/noncanonical APK paths returned 404. Download page displays Build 8009 and the new checksum at mobile and desktop widths without overflow. Homepage validated-release availability remains accurate. API, PostgreSQL, Redis and worker readiness healthy.

Publication preflight confirmed manual deposit review and manual payout true, automatic blockchain credit and payout false, synthetic exception disabled, existing transaction/payout controls unchanged and existing seven admin permissions unchanged. No SMS, financial submission, credit, order or payout was performed during this cleanup validation.

Remaining blockers for this requested cleanup/release: none. The separately pending admin-login diagnosis/fix was not part of this deployment.
