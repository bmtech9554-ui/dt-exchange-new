# Build 8018 website release review — 13 October 2026

**Publication completed: NO. Public Build 8011 is unchanged.**

The user's 13 October instruction authorizes publication **conditional on applicable release requirements being met**. That conditional authorization is recorded; another generic publication approval is not the missing prerequisite. No production financial policy, website design/content, credentials, signing identity, APK bytes or database records were changed. A verified private rollback copy of Build 8011 was created as requested.

## Verified candidate

- Version 1.0.0, build 8018, package `com.dtexchange.dt_exchange`.
- APK: `.tools/release-readiness-8018/DTExchange-8018.apk`.
- Size: 60,219,794 bytes.
- SHA-256: `e671fa441f37e1dc90914ec886a82aca9c16f894fe7407fb151f2262df35aef8`.
- Production certificate SHA-256: `475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c`.
- Fresh Android tool verification: valid v2 signature, matching existing certificate, build 8018, non-debuggable.
- Production API URL `https://api.dtexchange.app/api/v1` verified in metadata and decompressed APK content.
- Every decompressed APK entry was checked for the known isolated test-account addresses/phone numbers, non-payable fixture address, test-container/socket names, local test endpoints and private-key/config file extensions. None were found. This is a bounded scan, not a claim that string scanning proves the absence of every possible secret.
- The authorized Samsung is running build 8018. Its installed `base.apk` SHA-256 exactly matches the candidate. No reinstall, rebuild, resign or data reset was necessary.
- The 12 October Samsung and isolated integration evidence remains valid; see `build-8018-isolated-validation.md`. It establishes synthetic testing, not fresh production login/financial activation.
- Existing release attestation was freshly verified using the production API's verification key. Build 8018 has not been inserted/activated in production release metadata. No release timestamp was invented.

## Current live state

- Website, download page, admin and API configuration endpoints return HTTPS 200 with certificate validation enabled.
- API root `/` returns 404 because no root handler is defined; `/api/v1/app/configuration` returns 200 and private API readiness reports database, Redis, queues and workers ready. The root 404 is not an API-health failure.
- Google and Cloudflare DNS independently resolve the official hosts to `172.86.81.233`.
- Actual website Download button points to `https://dtexchange.app/downloads/DTExchange.apk`.
- The public APK was downloaded again: Build 8011, 59,383,620 bytes, SHA-256 `8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b`.
- Private rollback created/verified at `/srv/dtexchange/releases/rollback/build-8011/DTExchange-8011.apk`, root-only directory/file access, outside public Nginx aliases. Public old-version filename probe returns 404. The served current file was not moved or deleted.
- Checked debug APK URLs return 404. No debug package was uploaded.
- Fresh production record fingerprint comparison found no changed production tables and preserved all prior audit rows.
- Existing owner remains active with password, TOTP and assigned permissions intact.

## Financial and non-financial release gates

`MANUAL_DEPOSIT_REVIEW=true`, `MANUAL_PAYOUT=true`, `AUTOMATED_BLOCKCHAIN_CREDIT=false`, `AUTOMATED_PAYOUT=false`, `TRANSACTIONS_ENABLED=false`, `PAYOUTS_ENABLED=false`, `REFERRAL_PROGRAM_PAUSED=true` remain unchanged.

However, **`MANUAL_DEPOSIT_SUBMISSIONS_ENABLED=true`** remains intentionally enabled for existing production users. Production configuration still returns the real receiving address. Disabled automation does not make that intake a non-financial test service.

The approved isolated environment was closed before its deadline and remains stopped. Nginx currently denies Build 8018 with HTTP 503; ordinary requests and Build 8011 return 200. This is an external deployment guard, not an isolated endpoint or test credential embedded in the APK. Removing it alone would expose the ordinary production deposit flow. Publishing while retaining it would distribute an app that cannot connect normally.

The unchanged signed package is preserved as a **private, previously validated synthetic-test candidate**. It is not represented as a currently usable public non-financial release. A usable public test channel still requires a tested server-side non-financial boundary that does not expose a payable receiving address, cannot create/approve financial transactions, and does not globally restrict existing customers. A client-supplied build header alone must not be represented as a complete financial authorization boundary. The already staged global restricted-beta mode is unsuitable because it would change existing customer access and global intake settings. It was not enabled.

## Unresolved release prerequisites

1. A compatible live route for Build 8018, with the intended financial/non-financial scope actually enforced and then tested on the Samsung. Fresh production login, Wallet/History/Profile checks cannot pass while the current 503 guard remains.
2. Confirmed legal operator/contact and appropriate privacy/terms publication/review evidence. The production legal settings are absent/unpublished. A non-financial service that still collects passwords or bank details does not automatically avoid privacy obligations. No Privacy Policy or customer wording was created or edited.
3. For real-money exchange: evidence addressing applicable VDA registration, AML/customer-due-diligence, monitoring/reporting and recordkeeping requirements. Technical tests do not establish that evidence.
4. Cybersecurity/financial-record retention and jurisdiction evidence remains unresolved for the Singapore VPS. Do not assume that every log must exist exclusively in India: CERT-In FAQ 35 allows additional overseas storage subject to timely production, while FAQ 36 specifically addresses Indian-jurisdiction logs/financial records for services offered to users in India. The applicable arrangement needs documented confirmation.

Official references reviewed: [FIU-IND VDA guidance](https://fiuindia.gov.in/files/downloads/downloads.html), [SPDI Rules 2011, Rules 3–5](https://www.wipo.int/wipolex/en/legislation/details/15063), [Government clarification](https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=74990), [CERT-In FAQ 35–36](https://www.cert-in.org.in/PDF/FAQs_on_CyberSecurityDirections_May2022.pdf). These sources identify review requirements; this report does not certify legal compliance or invent an exemption.

## Prepared publication and rollback sequence

After those prerequisites are evidenced, use the exact attested candidate; retain private Build 8011; stage and hash-check the candidate outside the public directory; perform the authorized release-metadata/file activation with a brief consistency guard; verify the actual website download, signature, checksum, release metadata and Samsung production login/read flows. Release date must come from the actual successful publication, not preparation time. If validation fails, restore both the prior served artifact and its matching metadata under the controlled rollback procedure; never serve an old APK with new release metadata.

Current evidence: `.tools/website-8018-preflight-20261013.json`, `.tools/website-8018-private-rollback.json`, `.tools/website-8018-final-live.json`, `.tools/final-8018-public.json`, `.tools/isolated-8018-closed-verification.json`, `.tools/isolated-8018-production-integrity.json`.
