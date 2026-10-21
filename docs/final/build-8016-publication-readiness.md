# Build 8016 final publication-readiness review

Reviewed 9 October 2026. **HOLD FOR LEGAL / COMPLIANCE RESOLUTION.**
Technical verification passed. No APK was rebuilt, resigned, uploaded or published. Public Build 8011 remains available. No production configuration, credential, permission or financial record was changed by this review.

## Verified technical state

| Item | Evidence / result |
| --- | --- |
| Public APK | Downloaded from the official HTTPS URL; Build 8011; 59,383,620 bytes; SHA-256 `8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b`; production signature verified. A verified local rollback copy is retained. |
| Candidate | Version 1.0.0, Build 8016; 60,367,418 bytes; SHA-256 `1f83fbf061c6bf39e352930f988beb88bf987b03eb28daee49b83aef1e24d4ad`. |
| Candidate signing | `apksigner` verification passed; certificate SHA-256 `475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c`, matching Build 8011; non-debuggable. APK bytes unchanged. |
| API configuration | `https://api.dtexchange.app/api/v1`, present in the compiled APK and production build configuration; production entry point `lib/main.dart`. |
| Release attestation | Candidate metadata signed locally using the existing separate attestation identity. Read-only execution of the deployed verification logic accepted it with the production public key and official URL allowlist. No publication row for 8016 exists. |
| User IDs / referrals | All 21 migration checksums valid; IDs start at 1000. Live policy is 0.1 USDT, REGISTRATION_OTP, MANUAL_RELEASE. Separate reward accounting and anti-abuse cases have passed synthetic tests. Production reward entries/releases are zero; no live reward was created to prove the feature. |
| Banks | Approved manual self-declared eligibility integrated; two currently available records and one permanently non-payable synthetic record; zero synthetic/self-declared safety violations. Prior authenticated production reads and synthetic write tests passed. |
| Payout proof | Actual isolated admin upload, encrypted storage, user ownership, expired sessions, History preview/zoom, Android download/hash, errors and retry passed. See `payout-proof-validation-8016.md`. Physical proof testing used a separate harness importing unchanged production widgets; no production payout was manufactured. |
| Biometrics / theme | Recorded Samsung acceptance covers OS biometric enable/restart unlock and Light/Dark/System, with unchanged implementations in 8016. Biometrics unlock the stored session locally; they do not replace backend authorization or send biometric templates to the server. |
| Backend and data | API, PostgreSQL, Redis and web healthy; engagement heartbeat current; zero ledger-integrity issues. Existing user, role, bank, ledger, deposit, sell, payout, private-file and append-only audit snapshot records retained. |
| Admin | Existing account active, password credential and TOTP enrollment present; OWNER_ADMIN, operations, manual-deposit-approver and android-release-publisher roles intact. Earlier authenticated login/TOTP and 24 module checks remain valid; this review did not request credentials or claim a new interactive login. |
| Financial controls | MANUAL_DEPOSIT_REVIEW=true; MANUAL_PAYOUT=true; AUTOMATED_BLOCKCHAIN_CREDIT=false; AUTOMATED_PAYOUT=false; TRANSACTIONS_ENABLED=false; PAYOUTS_ENABLED=false. Synthetic window disabled; maintenance off. |

Financial configuration digest remains
`eef37fbd8e35d85bb875b2cea19119c76651db3b14a6a512dd93a8813c5b0182`.
Rate 103; deposit minimum 100, fee zero, daily 20,000, monthly uncapped; sell maximum 5,000, daily 20,000, monthly 100,000, fee zero, quote 60 seconds.

One mutable manual-deposit row differs from the historical pre-cutover snapshot. The prior read-only investigation identified an owner amendment at 07:10:44 UTC to an UNDER_REVIEW record. This review did not make that change or treat a mutable-row difference as ledger corruption.

Focused retained validation: backend 34/34, admin 7/7 plus real isolated browser integration, Flutter 25/25, Samsung integration 1/1 plus native save/retry; Flutter analyze clean. These checks were not rerun without a code change. Master regression and prior production acceptance evidence remain in `.tools/master-completion-evidence-8016.json`.

## Actual remaining release blockers

### 1. Named operator and effective legal documents

Only the DT Exchange brand and temporary `dtexchangeservice@gmail.com` contact are confirmed. The contracting/data-controlling operator, address and official privacy/grievance contact are unconfirmed. Privacy and Terms endpoints still intentionally say unpublished. Finalize the documents' processing purposes, providers/locations, retention, account closure, eligibility, disputes, referral conditions and effective version, then obtain publication approval. Do not invent an incorporated entity or regulatory status.

The current privacy review cannot treat the DPDP transition as permission to operate without an applicable privacy notice. The [2011 SPDI Rules, rule 4](https://www.wipo.int/wipolex/en/legislation/details/15063) address publication of privacy practices. The [DPDP commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf) and [2025 Rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf) phase commencement; the core provisions are scheduled 18 months after 13 November 2025. They must not all be described as already operative in October 2026. The responsible legal adviser must confirm the requirements applicable at the actual publication date.

### 2. Documented VDA operating-compliance clearance

No confirmed legal operator, FIU registration evidence or approved end-to-end AML/customer-due-diligence/reporting procedure was supplied or found in the reviewed release records. Current OTP and self-declared bank checks are not independent identity verification. No KYC UI was reintroduced and no control was weakened in this review.

The [FIU circular of 15 September 2025](https://fiuindia.gov.in/pdfs/downloads/VDASP15092025.pdf), pages 1-2, covers specified VDA services including fiat exchange and requires reporting-entity registration and AML controls. DT Exchange's intended USDT-to-INR service appears relevant to that scope; the accountable operator and an Indian compliance adviser must confirm applicability, evidence and permitted launch scope. Manual processing and disabled automation are not evidence of an exemption. The [current FIU index](https://fiuindia.gov.in/files/downloads/downloads.html) also lists updated January 2026 AML/CFT guidance, which must be covered by the operator's compliance review.

The same review must resolve lawful custody/receiving-wallet and business-bank arrangements and VDA withholding/reporting responsibilities. Zero service fee does not establish zero tax liability. The [Income Tax Department's current exchange-reporting guidance](https://www.incometax.gov.in/iec/foportal/newformpage/forms/form142-um) refers to section 393(1), Table 8(vi), under the 2025 Act; do not rely only on older section numbering. No tax, fee or payout rule was changed here.

### 3. Retention and incident-response evidence

Live inspection found:

- DT Exchange and Nginx logs: daily rotation, 14 retained files.
- API, web and engagement container logs: five files of 10 MB each, with no 180-day retention guarantee.
- No rsyslog forwarding configured and no recognized remote collection service found besides rsyslog. An independent India-based archive was not evidenced; this is not a claim to have inspected an undisclosed external service.

[CERT-In directions](https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf), paragraphs (ii)-(vi), specify covered incident reporting within six hours, a designated contact, 180-day ICT logs within Indian jurisdiction, and five-year VDA KYC/transaction records. The currently identified Singapore VPS and short local rotation do not demonstrate the required Indian log retention. Establish or provide verified evidence of the applicable archive/retention and incident-response arrangements. Persistent database audit records alone do not prove retention of all required ICT logs. No logging or hosting configuration was changed without approval.

### 4. Unsubstantiated guarantee wording

Build 8016 Home still states: “The funding we provide is clean, secure, and fully guaranteed.” No substantiation or defined guarantee terms are present in the reviewed release evidence. The draft Terms explicitly avoid guaranteeing source/lawfulness of every asset or protection from all losses, so the two messages are inconsistent.

The [CCPA misleading-advertisement guidelines](https://consumeraffairs.gov.in/public/upload/files/CCPA_Notification_1732707665.pdf), paragraphs 4, 11 and 12, require truthful, substantiable claims and do not allow a disclaimer to cure a misleading headline. Resolve the claim through verifiable evidence and reviewed terms or approve a truthful wording change. If an app change is needed, it requires a later signed build and focused device verification; unchanged 8016 must not be silently relabeled or resigned.

These are evidence-backed publication holds, not a determination that an unidentified operator has violated a particular law. Obtain the missing operating facts and qualified legal/tax resolution. This technical review cannot certify compliance from working software alone.

## Prepared update package

Local directory: `.tools/release-readiness-8016/`.

- `release-8016-attested.json`: signed public metadata; version 8016, unchanged minimum 8008, mandatory=false, official URLs, exact size/hash/certificate and release notes.
- `DTExchange-8016.apk.sha256`: candidate checksum sidecar.
- Candidate source: `mobile/build/verified-releases/8016/app-release.apk` (unchanged).
- `public-8011.apk`: downloaded, signature/hash-verified prior public bytes for recovery.
- `production-health.json`, `production-preflight.json`, `feature-safety.json`, `host-readiness.json`, signature logs and `preparation.json`: non-secret evidence.

The deployed download page reads release metadata dynamically with no-store caching. No website or backend rebuild is necessary solely to advertise the new signed APK. Live Nginx serves the exact official APK alias from `/srv/dtexchange/releases/approved/DTExchange.apk`; the directory is currently a regular directory, not a symlink. No additional APK rollback copy was found under `/srv/dtexchange/releases`; create the private on-server copy as the first approved publication step, using the verified current bytes. No new public APK path is needed.

## Proposed publication and rollback sequence — NOT EXECUTED

1. Resolve the holds above and re-evaluate whether unchanged 8016 is still the approved candidate. Request explicit approval for its exact hash, public-file replacement, metadata publication and narrowly scoped rollback arrangement. Include a secure owner credential/TOTP step only if needed by the authorized publishing workflow.
2. Recheck API/DB/Redis/worker health, financial flags, legal status and current public 8011 metadata/hash. Abort on unexpected drift. Keep minimum build 8008 and mandatory=false; no forced upgrade, financial cutover or database migration is included.
3. Preserve the current APK, checksum, active release metadata and Nginx download-location configuration in a private versioned recovery directory. Verify hashes. Stage candidate bytes outside the public alias; verify candidate hash/signature against the prepared attestation.
4. Under an explicitly approved brief download-only hold, prevent new requests to the APK and checksum aliases while leaving API/admin/website operations unaffected. Validate any Nginx adjustment before reload. This avoids exposing a new APK with old checksum metadata. This hold has not been activated.
5. Atomically rename the staged APK and checksum onto their exact official paths on the same filesystem. Publish the already-attested 8016 metadata through the existing ANDROID_RELEASE_PUBLISH workflow with its normal audit record. No role changes or direct bypass of that workflow are included.
6. Verify stored release metadata, internal served bytes and sidecar match 8016 before removing the download hold. Then verify the public page, full HTTPS download SHA-256, production certificate, non-debuggable manifest, API health and unchanged financial settings. Keep 8011's private recovery copy and immutable release-history record.

Rollback boundaries:

- **Before metadata publication:** restore the verified 8011 APK/sidecar and original download routing; assert active metadata is still 8011, then reopen downloads. No application database restore is necessary.
- **After metadata publication:** the current API intentionally rejects decreasing release codes. There is no verified general-purpose lower-version rollback endpoint. Do not bypass it with an unapproved SQL update or silently serve 8011 while metadata says 8016. Hold only new downloads, preserve evidence, and obtain a separately scoped, audited metadata/file recovery approval or publish a verified higher-numbered corrective release after approval.
- **Devices already updated:** replacing website bytes does not downgrade installed apps. Never uninstall/reset users' apps to roll back. A device fix requires a higher build signed by the same identity.

No payout, wallet/ledger, user, admin-credential, legal-document or financial-policy change belongs in this APK-publication operation. No production approval is being requested yet because the substantive publication holds remain unresolved.
