# Build 8018 isolated technical validation — 12 October 2026

Status: technical validation completed in the authorized disposable environment. **Unpublished. Not authorization for real financial execution or public release.**

## Artifact

- Android version 1.0.0, build 8018; package `com.dtexchange.dt_exchange`.
- SHA-256: `e671fa441f37e1dc90914ec886a82aca9c16f894fe7407fb151f2262df35aef8`.
- Size: 60,219,794 bytes.
- Production certificate SHA-256: `475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c`.
- APK signature verified, certificate matches the existing production identity, non-debuggable.
- Production API URL retained: `https://api.dtexchange.app/api/v1`.
- Installed as an update on the Samsung without uninstalling. No rebuild or resign during this validation.
- Candidate package: `.tools/release-readiness-8018/DTExchange-8018.apk`; canonical verified artifact: `mobile/build/verified-releases/8018/app-release.apk`.
- Local release attestation verified against the production public verifier. No release record activated.

## Isolation and shutdown

The existing Cloudzy VPS hosted one disposable, resource-limited container based on the exact running production API image. It used PGlite and synthetic fixtures, with no production data, credentials, external network, payment provider access, database mounts or published ports. It ran read-only, with capabilities dropped, no-new-privileges, 1 CPU, 1536 MiB memory and a bounded temporary filesystem. SSH-only controls were separate from the IP-restricted mobile API socket. Public clients could not access admin or fixture controls.

Only build header 8018 from the approved test IPs reached this environment. Other builds continued to use production. A persistent server-side shutdown timer was armed before deployment; the container also had a lifetime limit.

The test container was stopped at approximately **15:25:36 UTC**, before its original **15:30:51 UTC** deadline. The temporary route was removed. Live verification: normal API requests **200**, Build 8011 **200**, unpublished Build 8018 **503**. Build 8018 cannot fall through to production. The private SSH tunnel and local test-admin server were closed. Samsung rotation and USB stay-awake preferences were restored.

## Validation and evidence

| Area | Result and actual scope |
| --- | --- |
| Registration / login / OTP | PASS. Actual Samsung registration and verification against the isolated API; synthetic development OTP only. No SMS sent. Existing synthetic login also passed. |
| Public user IDs | PASS. Fixture ID 1000; second fixture 1001; newly registered phone account 1002. |
| Owner login / TOTP | PASS. Actual Next.js form and session through SSH to the isolated backend, then a fresh owner login/read/logout. No production credentials reset or roles modified. |
| Bank reveal / copy / hide | PASS. Actual authorized owner controls revealed every stored synthetic digit, clipboard matched, Hide masked it; unauthorized role rejected. |
| Bank addition | PASS. Samsung-created dummy account became Available without a false independent-verification claim. |
| Deposit / proof / TxID | PASS. Samsung rejected 99, accepted 100, uploaded a synthetic image and submitted a synthetic TxID. Result UNDER_REVIEW; wallet remained zero. Duplicate TxID rejected by the backend. Owner could read this exact record and proof. |
| Sell request | PASS in isolated integration. Real NestJS quote/order services created synthetic orders from explicitly seeded test-ledger opening funds; repeated requests remained idempotent. Samsung quote and confirmation screens showed 100 USDT → ₹10,300, zero fee; 5,001 was rejected. The newly registered phone account had zero spendable funds, so no positive order was submitted from that phone account. |
| Quote expiry | PASS. Server timestamps showed approximately 60 seconds; submission after waiting 61 seconds was rejected. |
| Admin notifications | PASS. Actual deposit/sell notification links opened the correct records; read/unread state persisted. Exactly-once checks passed, including the Samsung-created deposit. |
| Manual payout review | PASS. Actual owner review/hold and authorized processing controls exercised against isolated synthetic orders. No payout completed. |
| UTR | PASS for entry and negative validation. Entered in the actual form; intentionally not committed as a completed bank payment. False payment attestation rejected and execution gate verified. |
| Payment proof | PASS. Actual admin upload, protected preview and matching download. Receipt associated only with a PROCESSING synthetic fixture; no fictitious completed payment. |
| Android History | PASS. Correct synthetic user opened the receipt, viewed the image and saved it through Android's native picker. Download SHA-256 matched admin upload. Another user, anonymous and expired-session requests were denied; missing proof handled; injected download failure recovered on retry. |
| Biometrics | PASS for native prompt acceptance and saved preference; user completed the native biometric prompt. Enabled preference remained visible, and the saved synthetic session recovered to Home after restart. |
| Light / dark | PASS. Actual Samsung theme changes rendered and original Light preference restored. |
| Referral Coming Soon | PASS. Animated Coming Soon screen shown; active referral controls hidden. Attribution and reward accrual remained paused. |
| Maintenance | PASS. Isolated Owner App Maintenance ON blocked normal flow and displayed Retry; OFF recovered without reinstall; both changes audited. Production maintenance was not changed. |
| Home graph | PASS. ₹103 displayed and graph pixels changed between frames, including after navigation/restart. |

Receipt SHA-256: `ff494ca4a91625b3109646897250e5f7aed855d484a8bdb66445e30714429111`.

Detailed non-secret evidence is in `.tools/final-8018-isolated-browser-result.json`, `.tools/isolated-8018-followup-result.json`, `.tools/isolated-8018-admin-read-final.json`, `.tools/isolated-8018-maintenance-result.json`, `.tools/isolated-8018-boundary-live.json`, `.tools/isolated-8018-closed-verification.json`, and the `isolated8018-*` device captures.

A supplementary test helper failed to provide a TOTP and repeated test logins correctly hit the authentication rate limit. No controls were bypassed or counters reset. A later fresh synthetic TOTP login succeeded after the limit window; final read checks and logout passed. This did not change the production account or authentication implementation.

## Regressions and production preservation

- Backend: 270 tests passed.
- Flutter: analyze passed, 401 tests passed.
- Admin/website: 55 tests passed, typecheck and production build passed.
- No application source changed during this final isolated validation.
- Fresh production table-fingerprint comparison: no changed production tables; prior audit records preserved.
- API, PostgreSQL, Redis, queues and worker readiness all ready; containers healthy/worker heartbeat confirmed.
- Public website, admin, API and download page HTTPS returned 200.
- Public Build 8011 remains active and unchanged; SHA-256 `8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b`.
- Manual deposit review and manual payout remain true; automated blockchain credit and automated payout false; transaction/payout execution gates remain disabled. Approved rates and limits unchanged. Referral pause remains true in API and engagement worker.
- No real USDT transfer, INR transfer, production financial write, customer restriction, migration or APK publication occurred.

## Publication holds and limits

1. Separate explicit Build 8018 publication approval remains required. Do not activate metadata or replace public Build 8011 automatically.
2. Final legal operator/contact details, publication of appropriately reviewed legal documents and evidence addressing applicable financial/privacy/cybersecurity obligations remain unresolved. No legal document or customer-facing text was changed; no exemption is claimed for limited-access users.
3. Indian-jurisdiction log-storage/compliance evidence remains unresolved; the existing VPS is in Singapore. No additional infrastructure was provisioned.
4. This is synthetic technical validation, not fresh live SMS-delivery validation or verification of real-money payout execution. No actual payment was claimed or completed.

For an approved future publication, use the exact verified candidate, recheck its checksum/signature and attestation, retain the verified public Build 8011 rollback artifact, then publish through the authorized release workflow. The temporary 8018 block must be handled only as part of that approved release or a separately approved test window.
