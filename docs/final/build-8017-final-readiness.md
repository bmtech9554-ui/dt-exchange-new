# Build 8017 final readiness — 12 October 2026

Status: technically validated candidate; HOLD FOR PUBLICATION REQUIREMENTS.
No APK rebuild, signing change, production setting change or publication occurred.
No Privacy Policy, customer wording, quote, brand or design was edited.

## Passed evidence

- Fresh production checks: website, download page, admin and release API HTTP 200
  with normal TLS verification. API/database/Redis/queues/workers ready.
- Build 8017 APK v2 signature verified with existing production certificate
  475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c.
  SHA-256 d1a3731d1aaf2ba4dae45fd09711b69916393d4fd7ca786fc540d54ba5d3aecc.
  60,219,794 bytes, version 1.0.0+8017, previously verified non-debuggable.
- Recorded Samsung 8017 update preserved the session; Referral Coming Soon,
  light/dark layout, gift animation, Back, Home rate/graph, Wallet, History,
  Deposit and Sell read-only screens passed. Source routing still matches this.
- Focused referral and payout-proof Flutter tests rerun: 11 passed. Flutter
  analysis rerun: no issues. Prior complete 399-test Flutter, 42-test focused
  backend and 51-test admin/website results retained; not misrepresented as rerun.
- Payment proof retains isolated admin upload/private storage/ownership, Samsung
  History preview/zoom/download, failure/retry and expired-session evidence from
  payout-proof-validation-8016.md. This is not a new production payout test.
- Existing owner authenticated/TOTP/module validation retained. Fresh checks found
  17 operational notifications and audit events, an owner with required read
  access, and anonymous protected-health rejection (401). No fresh interactive
  owner login was performed. SSH failed-authentication burst was reported by
  monitoring with deliveryPending=false and SSH protection healthy; it is not
  evidence of a successful intrusion.
- Public metadata still advertises 8011. The immediately preceding DNS recovery
  downloaded the complete public APK and matched SHA-256
  8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b.
- Automation remains disabled; zero ledger integrity issues, 21 migrations,
  healthy local encrypted logging and recovery. Legal drafts remain unpublished.

## Remaining requirements

1. Confirm accountable legal operator, official privacy/grievance contacts and
   resolve effective Privacy/Terms publication requirements. No legal document
   edits are authorized by this task.
2. Supply documented operating/compliance clearance for the actual VDA service:
   applicable FIU registration, AML/customer due diligence/reporting, custody,
   bank and tax responsibilities. No exemption inferred from manual processing
   or a friends-only user population.
3. India-jurisdiction logging/retention and incident-response evidence remains
   unresolved. Singapore-only encrypted metadata archives do not establish all
   CERT-In requirements, five-year reconstructable VDA records or incident contact
   and reporting readiness. No new hosting is authorized.
4. Existing 'fully guaranteed' claim still lacks documented substantiation and
   reviewed guarantee terms in the release evidence. It was preserved unchanged.
5. The mobile Coming Soon UI does not pause backend referrals for older clients.
   Tested backend pause remains staged, not deployed. If campaign-wide pause is
   required for launch, separately authorize and validate that scoped change.
6. Update from final execution: the Build 8017 attestation/package is now prepared
   and accepted by the deployed verifier in a read-only check. Final publication
   approval remains pending the unresolved requirements. See
   build-8017-final-launch-status.md for current engineering evidence and beta limits.

Qualified operator/legal resolution is required; this report is not certification
of compliance or a finding of unlawful conduct. Existing public 8011 is unchanged.

Primary references rechecked: FIU January 2026 VDA guidance
https://fiuindia.gov.in/pdfs/downloads/VDA08012026.pdf ; CERT-In directions
https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf ; phased DPDP
commencement https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf ;
CCPA guidance index https://consumeraffairs.gov.in/pages/consumer-protection-acts .
