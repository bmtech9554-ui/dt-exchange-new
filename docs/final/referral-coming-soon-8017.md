# Referral Coming Soon — Build 8017

## Scope

Only the customer referral experience changes. Profile keeps Referral Program
with a Coming Soon badge. The route shows the approved heading, message and
supporting sentence, a subtle gift pulse, and Back. It supports reduced motion,
background pause, light/dark themes and narrow large-text layouts. Existing
referral widgets remain in source for future approved reactivation but are not
reachable while `REFERRAL_COMING_SOON=true` (also the default).

Signup's optional referral field and incoming referral-code prefill/submission
are disabled in this release. Other signup fields and authentication are unchanged.
No referral API is called by the Coming Soon page. Historical notification records
remain intact; their referral destination opens Coming Soon.

Build 8016 is preserved. Build 8017 uses the same production API and signing
identity. Neither the new APK nor staged backend changes are automatically published.

## Staged backend pause — NOT activated in production

`REFERRAL_PROGRAM_PAUSED=true` is a separate backend environment flag prepared
for API and engagement worker. Unset/empty/`false` retains current behavior;
other nonempty values fail closed. It requires an explicitly approved deployment
and consistent API/worker configuration; editing mobile configuration does not
change backend rewards.

When activated it:

- Rejects new code generation and explicit referral claims.
- Returns no invite code/link and reports effective customer campaign availability
  as false without changing stored campaign policy, balances or history.
- Ignores an old signup invitation without blocking normal registration/OTP.
- Stops new registration-OTP reward entries and legacy worker reward accrual.
- Preserves relationships, reward entries/releases and administrator read/review
  access. Existing manual-release safeguards remain unchanged.

No migration, deletion, balance reset or automatic replay is involved. Setting
the flag back to `false` restores prospective processing only. Re-enabling does
not automatically backfill OTP events that completed during the pause; any such
eligibility review requires a separately approved operation. Existing public
clients and website invitation links can still refer users until this backend
pause is approved and activated. They are not silently disabled by this task.

Before a future activation, verify encrypted backup, rollback images, unchanged
record hashes and financial settings; deploy only the tested referral patch to
API/engagement worker; test with isolated data; keep automation disabled. Audit
the operational configuration change. Roll back the flag and images if needed,
without touching referral records. Obtain explicit approval first.

## Validation

- Flutter analyze passed. Full Flutter rerun: 399 passed. The first run had one
  timeout during a prolonged host-time interruption; the unchanged test passed
  on rerun with the complete suite in 41 seconds.
- 42 focused backend tests passed, covering paused signup, code/claim denial, zero new accrual,
  balance/history preservation, retained admin access and reversible configuration.
- Admin/website: 51 tests passed; admin typecheck passed.
- Cloudzy logging remains active with zero backlog and verified archive recovery;
  API/website/admin HTTPS are healthy. No live referral configuration was changed.
- Build 8017 signed release verified: version 1.0.0, 60,219,794 bytes, non-debuggable,
  production API configuration, certificate identical to 8016 and previous releases.
  SHA-256: `d1a3731d1aaf2ba4dae45fd09711b69916393d4fd7ca786fc540d54ba5d3aecc`.
  Certificate SHA-256:
  `475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c`.
- Samsung update 8016 to 8017 succeeded with the same application UID; no
  uninstall occurred. Existing session worked. Profile badge, Coming Soon copy,
  absence of invite actions, gift pixel animation, explicit Back button and
  Light/Dark visual layouts passed. Original Light preference restored.
- Home rate 103 and graph frame animation, Wallet, History, Deposit address/QR
  area and Sell screen loaded on the physical device without submitting anything.
  Phone left on Home. Evidence: `.tools/referral-coming-soon/` and screenshots
  `.tools/master-device/referral8017-*`. No new financial test records created.

## New external DNS blocker discovered at final verification

At approximately 14:49 IST on 12 October 2026, fresh queries to Cloudflare
1.1.1.1, Google 8.8.8.8 and the authoritative verification nameserver returned
198.54.117.242 for dtexchange.app/api/admin instead of VPS 172.86.81.233.
Nameservers are now `failed-whois-verification.namecheap.com` and
`verify-contact-details.namecheap.com`. This indicates a registrar contact-
verification suspension, consistent with Namecheap's official documentation.

Nginx is active with valid configuration; port 443 listens. Private readiness
reports API, PostgreSQL, Redis, queues and workers ready. HTTPS requests pinned
to the existing VPS **with normal hostname/certificate validation** return the
correct site/API/admin responses. No hosts file, DNS record, nameserver,
certificate or service configuration was changed to work around this issue.

Public Build 8011 remains configured and intact on the origin, but normal public
domain access is now blocked or cache-dependent. The earlier Samsung checks
passed before this final DNS finding; do not claim current public connectivity
is healthy. The registrant must verify the actual registered contact details;
then recheck public DNS and HTTPS before any publication. Build 8017 remains
unpublished, and the staged backend pause remains inactive.

[Namecheap contact-verification recovery instructions](https://www.namecheap.com/support/knowledgebase/article.aspx/10698/46/what-to-do-if-my-domain-was-suspended-due-to-whois-verification-process/).

Public release configuration remains Build 8011, subject to the DNS blocker above. No Privacy Policy, legal text, customer
screen outside Referral, financial rule or production database is changed.
Existing Singapore-only log-location and same-host recovery limitations remain;
this feature does not establish legal/compliance clearance for public release.
