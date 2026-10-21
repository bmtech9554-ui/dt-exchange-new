# Build 8016 payout-proof validation — 9 October 2026

Result: the remaining payout-proof flow passed in an isolated environment, including native Samsung receipt viewing, pinch zoom and file saving. No production application source change, APK rebuild, resigning or publication was required.

## Isolation and scope

- Used the existing NestJS controllers, guards and services with a new in-memory PostgreSQL-compatible PGlite database, all 21 migrations, synthetic users, a test administrator and a disposable test ledger.
- Used the actual Next.js admin upload form and BFF against the loopback test API. Provider adapters and credentials were test-only; no production credentials were used by the test fixture.
- The existing workflow attaches a receipt when confirming a manual payout. This confirmation and its ledger entries occurred **only in the disposable database**. No real bank transfer, blockchain transaction or production financial record was created or changed.
- The Samsung ran a separate, explicitly labeled validation application importing the unchanged production Flutter History and private-receipt widgets. It connected only to the loopback API over temporary ADB forwarding. This is an isolated physical component/integration test, not a manufactured production payout or an end-to-end receipt test against production data.
- Production package `com.dtexchange.dt_exchange`, its Build 8016 APK, session data and signing identity were preserved.

## Results

| Check | Result and evidence |
| --- | --- |
| Authorized admin upload | PASS: actual admin UI -> BFF -> NestJS multipart upload returned 201; synthetic confirmation returned 201; receipt associated with the intended payout. |
| Secure storage | PASS: encrypted payload stored in the private financial-files table; no public receipt path/directory. Existing MIME, signature and size validation remained intact. |
| Correct user access | PASS: authenticated owner read returned 200 and exact uploaded bytes. |
| Other user / anonymous / expired access | PASS: unrelated user 404, anonymous 401, expired access token 401. |
| History and image zoom | PASS: actual Samsung History -> transaction details -> receipt image; physical-device integration test asserted pinch increased the rendered scale. |
| User download | PASS: Android document picker saved the receipt; phone file and pulled copy both matched the uploaded SHA-256. |
| Cancel and retry | PASS: native picker cancellation returned safely; retry saved successfully. |
| Storage/network failure and retry | PASS: injected isolated HTTP 503 showed the existing error message, retained the proof action and successfully reopened the image on retry. |
| Missing proof | PASS: synthetic payout with no receipt showed no view/download action, including on Samsung. |
| Expired sessions / save failure | PASS: widget tests cover one access-token refresh, rejected refresh, missing receipt, HTTP 503, native save exception and retry preserving exact bytes. |

Synthetic receipt SHA-256:
`ff494ca4a91625b3109646897250e5f7aed855d484a8bdb66445e30714429111`.
The receipt is visibly marked SYNTHETIC / NOT A PAYMENT / NOT VALID AS FINANCIAL EVIDENCE.

## Focused regression results

- Backend manual-workflow tests: **34/34 passed**.
- Admin manual UI tests: **7/7 passed**, plus the actual browser upload/download integration above.
- Flutter focused tests: **25/25 passed**, including six new payout-proof cases.
- Samsung integration test: **1/1 passed**, followed by native picker/save/hash and failure/retry checks.
- `flutter analyze`: **passed, no issues**.

New application-repository test: `mobile/test/payout_proof_test.dart`.
Local test harnesses and non-secret reports/screenshots are under `.tools/payout-proof*`.
No production backend, admin or Flutter implementation file needed changing.

## Production and release checks

- Build **1.0.0+8016**, **60,367,418 bytes**; installed Samsung package reports 8016.
- APK SHA-256: `1f83fbf061c6bf39e352930f988beb88bf987b03eb28daee49b83aef1e24d4ad`.
- Signing certificate SHA-256: `475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c`.
- `apksigner verify` passed; production certificate matches; manifest is non-debuggable.
- Production API configuration remains `https://api.dtexchange.app/api/v1`.
- Read-only SSH checks: API, PostgreSQL, Redis and web healthy; engagement heartbeat current; database/Redis/queues/workers ready; all 21 migration checksums verified; zero ledger-integrity issues.
- Financial configuration digest remains `eef37fbd8e35d85bb875b2cea19119c76651db3b14a6a512dd93a8813c5b0182`.
- Manual deposit review/manual payout remain enabled; automatic blockchain credit and automatic payout remain disabled. Existing transaction/payout execution gates remain disabled. Synthetic production test access remains disabled; maintenance remains off.
- The historical pre-deployment row snapshot initially flagged one mutable manual-deposit record. Read-only audit inspection identified an `owner.deposit.amended` event at 07:10:44 UTC on an UNDER_REVIEW record. This is retained as an explicit snapshot difference, not described as unchanged. Existing ledger, deposits, sell orders, payouts, private files and append-only audit snapshot rows are preserved. No production write was performed by this validation.
- Public release metadata remains **8011**, with its prior APK URL, SHA-256 and signing certificate. Build 8016 was not published.

## Cleanup and remaining gates

The temporary test application, ADB port forwarding and synthetic downloaded receipt were removed from the Samsung. Production DT Exchange was brought back to the foreground without clearing its data. Local test API/admin processes were stopped; the in-memory test database and temporary credentials were discarded. Local non-secret test evidence is retained.

The payout-proof technical validation blocker is resolved. Build 8016 is prepared for **separate explicit publication approval**; this report does not authorize publication.

Legal/compliance publication remains separately blocked on confirmation of the actual legal operator and official contact details. Privacy/Terms drafts remain unpublished. This test does not constitute a legal/compliance approval.
