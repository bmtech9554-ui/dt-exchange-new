# Build 8017 final launch execution — 12 October 2026

## Engineering work completed

- Final local regressions: backend 252/252, admin/website 51/51, Flutter 399/399.
  Backend compiled, admin typecheck passed, Flutter analysis passed. Initial npm
  launcher/PATH and sandbox loopback failures were resolved by invoking the same
  compiler/test scripts directly with local networking enabled. No source defect
  or production change was needed.
- Signed APK remains exactly 1.0.0+8017, 60,219,794 bytes, non-debuggable,
  minSdk 24, targetSdk 36. Permissions: INTERNET, USE_BIOMETRIC,
  USE_FINGERPRINT and the application-scoped non-exported receiver permission.
  Production API configuration remains https://api.dtexchange.app/api/v1.
- SHA-256: d1a3731d1aaf2ba4dae45fd09711b69916393d4fd7ca786fc540d54ba5d3aecc.
  Production certificate: 475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c.
- Local release metadata was signed using the existing separate attestation key.
  The deployed releasePayload/officialUrl verifier accepted the candidate in a
  READ ONLY transaction with its production public key. Candidate is not published.
- Existing owner is active; password credential, TOTP enrollment, OWNER_ADMIN,
  operations, manual-deposit-approver and android-release-publisher roles remain.
  No password, role, TOTP or session reset occurred. Prior authenticated module
  tests remain evidence; this execution did not perform a new interactive login.
- Website, API, admin and download HTTPS returned 200. Full public download is
  still Build 8011, 59,383,620 bytes, SHA-256
  8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b.
- Latest root-only encrypted database backup: checksum and authenticated full
  archive parse passed, age approximately 7.7 hours. No restore into production.
  Prior isolated restore and verified image-recovery evidence retained.
- Samsung already had signed 8017 installed as an update. No redundant install,
  uninstall or rebuild was needed. Fresh Home rate and graph frame-change checks
  passed. USB disconnected during the optional repeat Profile navigation; input
  stopped. Previously completed 8017 referral/light-dark/read-only screen tests
  remain documented, not misrepresented as freshly repeated.

## Release package and rollback — prepared, not executed

Local `.tools/release-readiness-8017/` contains signed public candidate metadata,
checksum, preparation record and fresh public download verification. No private
attestation or Android signing key is stored there.

The unchanged rollback APK is `.tools/release-readiness-8016/public-8011.apk` and
its hash was reverified. On any future authorized publication, first preserve the
current on-server public bytes and active release metadata in a private rollback
location. Stage and verify the candidate outside the public alias; publish only
through the existing authenticated release workflow after final approval. Check
download bytes, attestation, signature, version and HTTPS immediately. If an
integrity check fails, stop and restore the retained 8011 bytes and metadata using
the controlled rollback workflow. This report does not execute or authorize that.

## Private beta boundary

Update: the backend-only fail-closed beta boundary is now implemented and tested
locally, still disabled and undeployed. See
[restricted beta preparation](build-8017-restricted-beta-preparation.md) for exact
behavior, 263 backend/401 Flutter results, unchanged Samsung 8017 recheck and the
required production approval scope. This supersedes only the earlier statement
that the beta implementation itself was missing; no live restriction is claimed.

The installed Samsung candidate and existing isolated synthetic test harness are
available for controlled evaluation. The harness uses disposable PGlite data,
synthetic identities/receipts, loopback API access and no production credentials.
It is not an alternative live financial service or public distribution channel.

The current production service must NOT be labeled a fully restricted no-money
beta: registrations and MANUAL_DEPOSIT_SUBMISSIONS_ENABLED remain true from prior
authorized deployments; operational deposits remain enabled and the receiving
address is visible. TRANSACTIONS_ENABLED and PAYOUTS_ENABLED are false, so the
manual evidence-intake exception does not itself authorize ledger credit, order
execution or payouts. Both automatic execution flags are false. Nevertheless,
those execution gates do not prevent someone independently sending funds to a
displayed public blockchain address.

A live beta-only cutover therefore needs a separately reviewed and explicitly
approved scope covering normal intake/registration restrictions, test-account
allowlisting and receiving-address exposure, while keeping real orders, credits
and payouts blocked. Merely disabling an upload button or hiding referrals is
insufficient. Do not alter production financial settings or reopen the expired
synthetic exception based on this document. Existing production records remain.

## Exact outstanding requirements

- Accountable legal operator, official privacy/grievance contacts and applicable
  effective disclosures remain unconfirmed; legal documents remain unpublished.
- Applicable VDA/FIU, customer-due-diligence/AML/reporting, custody/bank and tax
  clearance is not evidenced. Friends-only/manual processing is not an exemption.
- Indian-jurisdiction log-retention and incident-response evidence is unresolved;
  the approved Singapore-only archives cannot establish those requirements.
- Existing financial guarantee wording lacks documented substantiation/terms.
  No wording, Privacy Policy or design was changed in this task.
- Campaign-wide referral pause remains staged and requires approved API/worker
  deployment if that behavior is required; 8017 Coming Soon UI itself is complete.
- Live no-money beta cutover is not approved or implemented. No real financial
  transaction was performed, and no execution gate was enabled.
- Final public publication approval is withheld until mandatory requirements
  are resolved. Build 8011 remains public; 8017 remains private.

Status: app regression VERIFIED; admin regression VERIFIED (fresh interactive
login not repeated); backend/database/DNS/HTTPS VERIFIED; Android artifact
VERIFIED; prior Samsung acceptance VERIFIED with the fresh repetition PARTIAL
due to USB disconnection; public publication BLOCKED; live private beta PARTIAL;
financial-service activation BLOCKED.
