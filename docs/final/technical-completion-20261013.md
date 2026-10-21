# Technical completion and release hold — 13 October 2026

Status: engineering regression and isolated workflow validation passed;
**financial activation and publication remain held**. The legal operator and
operating-clearance documents are not available for verification. The latest
user instruction supersedes any earlier statement that these were resolved.
No compliance exemption or approval is inferred.

## Work and scope

The existing implementation already contains the requested Deposit, Sell,
manual INR payout, Owner Admin, bank reveal, protected receipt and notification
workflows. This pass found no application regression requiring an Android or
backend source change. It reran the complete test suites, exercised the actual
Owner UI against a disposable local backend, checked the Samsung and preserved
the existing signed release. No real payment, production migration, service
restart, financial-policy change, customer-text edit or Privacy Policy work was
performed.

## Fresh validation

| Check | Result and boundary |
| --- | --- |
| Backend compilation and full suite | PASS; 276 tests, zero failures/skips |
| Flutter analyze and full suite | PASS; no issues; 401 tests |
| Admin typecheck and full suite | PASS; 55 tests |
| Admin production build | PASS |
| Inactive activation preparation | PASS; 4 tests; additive/idempotent reference data and narrow candidate routing only, never deployed |
| Canonical design tokens | PASS; generated tokens match, no design change |
| Owner login/TOTP/logout | PASS in disposable local environment; existing production owner remains active with password/TOTP present and unchanged permissions |
| Full bank reveal/copy/hide | PASS in actual browser; every synthetic stored digit checked; unauthorized role denied; audit protection covered by backend tests |
| Deposit request/proof/TxID | PASS isolated; duplicate rejected; idempotent retries; one notification; UNDER_REVIEW and no credit |
| Sell request/review | PASS isolated; wallet reservation and immutable beneficiary details; idempotent retries; one notification per order |
| Manual payout/UTR | PASS for authorized processing/review and UTR form entry; false payment attestation and disabled payout execution rejected; no completed payout or committed UTR manufactured |
| Receipt upload/view/download | PASS actual Owner UI with synthetic receipt; downloaded hash matches; linked to the correct PROCESSING fixture and user's History |
| Receipt authorization/errors | PASS correct user; anonymous/other-user/expired access rejected; missing proof handled; encrypted storage. Flutter tests cover zoom, download failure/retry and refreshed multipart uploads |
| Admin notifications | PASS exact deposit/sell record links, payout link, read/unread persistence and badge update; no duplicate event keys |
| Referral pause | PASS in isolated end-to-end flow and live flags; no new attribution/accrual; registration/OTP/account access remains available |
| Ledger integrity | Zero issues in disposable test database; no completed payout, credited deposit or real transfer |
| Production preservation | Fresh baseline comparison: no financial/configuration/owner table changes; previous audit rows intact |
| Production health | API, PostgreSQL, Redis, queues and workers ready; website/download/admin/API HTTPS 200 |

Evidence: `.tools/technical-completion-20261013/owner-browser-result.json`,
test/build logs, `release-preflight.json`, and the copied final live/integrity
reports. Synthetic OTP testing does not assert a new live SMS delivery test;
no SMS was sent during this pass.

## Android and physical evidence

- Build 8018, version 1.0.0, package `com.dtexchange.dt_exchange`.
- 60,219,794 bytes; non-debuggable; APK Signature Scheme v2 verified.
- APK SHA-256:
  `e671fa441f37e1dc90914ec886a82aca9c16f894fe7407fb151f2262df35aef8`.
- Production certificate SHA-256:
  `475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c`.
- API configuration: `https://api.dtexchange.app/api/v1`.
- Known disposable fixture markers and private-key/config file extensions were
  absent from all decompressed APK entries. This bounded scan is not a universal
  proof that arbitrary unknown secret strings cannot exist.
- Existing release attestation verifies using the production API's public key;
  no private signing or attestation key was accessed or changed in this pass.
- Latest APK: `mobile/build/verified-releases/8018/app-release.apk`.
  Prepared download payload: `.tools/release-readiness-8018/DTExchange-8018.apk`.
- Samsung is authorized and running 8018. Fresh read-only checks covered Home
  rate/graph animation, Wallet, History, Profile, Bank Accounts, Referral Coming
  Soon and appearance. Additional results are in `device-validation.json`.
- Same-day earlier password login, identical signed update without uninstall,
  session retention, native biometric recovery and Telegram intent checks remain
  valid for the identical hash. Prior isolated physical receipt/financial and
  maintenance checks remain historical evidence, not new live-money tests.
- Production financial workflows were not re-enabled to repeat phone tests.

## Actual production gates

API and engagement worker both retain:

```
MANUAL_DEPOSIT_REVIEW=true
MANUAL_PAYOUT=true
AUTOMATED_BLOCKCHAIN_CREDIT=false
AUTOMATED_PAYOUT=false
TRANSACTIONS_ENABLED=false
PAYOUTS_ENABLED=false
REFERRAL_PROGRAM_PAUSED=true
```

Build 8018's deposit configuration/address/intake/upload, quote/order and referral
claim routes remain denied. Normal account access is allowed. The old isolated
container is stopped and its expired timer disabled.

`MANUAL_DEPOSIT_SUBMISSIONS_ENABLED=true` is an existing older-client evidence
intake setting, deliberately unchanged. Therefore this report does **not** claim
that all clients' deposit intake is disabled. Submission cannot credit a wallet;
ledger/payout execution remains gated. A client-supplied build header is not a
trusted financial entitlement. Before an unrestricted non-financial release,
its intended account eligibility/intake boundary needs explicit review and
server-side enforcement independent of that header, if selective intake is
required. No such production-policy cutover was performed here.

## Held technical activation work

The separate `manual-financial-activation-prepared` package is inactive. It
contains tested additive TRON network/token reference preparation and explicit
runtime configuration. Current production lacks those required mainnet reference
rows and a valid configured contract/provider. Candidate startup checks passed,
but no live chain integration or financial activation is claimed.

Only after external prerequisites and controlled-cutover authorization: verify
fresh backup and immutable service rollback images; apply the exact reviewed
reference transaction and runtime changes; verify readiness and authorization
without making a real transfer. Never bypass startup checks or edit balances.

## Remaining external evidence

1. Confirm the real operating person/entity, legal contact/address and accountable
   owners/officers. A brand name is not verification of an operating entity.
2. Obtain a qualified review and documentary evidence of the requirements for
   this specific USDT/INR exchange, custody and manual-settlement model: applicable
   FIU-IND/PMLA registration, AML/customer due diligence, sanctions/transaction
   monitoring, reporting and recordkeeping. UI removal or manual processing is
   not evidence that those obligations disappear. See the official
   [FIU-IND guidance index](https://fiuindia.gov.in/files/downloads/downloads.html)
   and [2026 VDA guidance](https://fiuindia.gov.in/pdfs/downloads/VDA08012026.pdf).
3. Verify lawful bank/custody/settlement arrangements and applicable tax/reporting
   treatment for the actual operator. No generic exchange license, bank approval
   or operating clearance is invented by this engineering report.
4. Resolve privacy/terms/contact, consent, security, retention and grievance
   requirements for actual data processing and distribution. No Privacy Policy
   was created or edited. Review the
   [official SPDI rules](https://www.meity.gov.in/sites/upload_files/dit/files/RNUS_CyberLaw_15411.pdf)
   and the [phased DPDP commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf);
   do not assume every DPDP provision is already in force on this date.
5. Resolve applicable log/financial-record jurisdiction, retention, retrieval,
   incident reporting and responsible contact evidence. The existing Cloudzy
   server is in Singapore. CERT-In FAQ 35 permits overseas copies subject to
   timely production, while FAQ 36 addresses Indian-jurisdiction logs/financial
   records for services offered in India. Existing VPS archives alone do not
   establish satisfaction of the applicable requirements. See
   [CERT-In FAQs](https://www.cert-in.org.in/PDF/FAQs_on_CyberSecurityDirections_May2022.pdf).
6. Obtain review/substantiation of existing financial guarantees and claims for
   the intended distribution. All existing wording remains untouched.

These are unresolved evidence/review items, not a finding that an unspecified
license is necessarily required. The qualified review must determine applicability
and supply verifiable evidence. Friends/limited access is not assumed an exemption.

## Website release and rollback package — not executed

Keep public Build 8011 at `https://dtexchange.app/downloads/DTExchange.apk`.
Its downloaded SHA-256 is
`8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b`.
The private server rollback copy is verified; local rollback bytes are bundled
with the candidate, public attested metadata, checksums and this runbook. No
database recovery material or secret configuration is included.

Once requirements are verified and the exact release is approved:

1. Recheck production readiness, allowed feature scope, fresh backups, current
   release metadata, candidate/rollback checksums and signature. Preserve public
   8011 metadata and payload privately. Do not use debug or rebuilt bytes.
2. Stage the exact candidate on the same existing VPS filesystem, outside the
   public location. Verify its hash before changing the official pointer.
3. Use the existing authorized release workflow and public-key attestation
   validation. Coordinate metadata and atomic file replacement; verify the
   release service's on-disk hash requirement before ordering those operations.
   Never create success metadata for an unavailable/mismatched file.
4. Download through the real HTTPS button, verify build/hash/signature and confirm
   authorized app/account access and financial gates. Preserve website design.
5. If validation fails, restore the private 8011 payload and its existing release
   metadata through the supported authorized workflow. Verify the public hash
   again. Do not reset the database, erase history or change financial records.

No public 8018 release timestamp is assigned while publication remains held.
