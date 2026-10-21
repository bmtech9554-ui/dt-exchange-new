# Phase 7 security review

Scope: code-level review, source pattern scan, dependency advisory scan, SQL/Nest integration tests and available builds. This is not an independent penetration test or certification. No repository history is available in this workspace, so Git-history secret absence cannot be established.

| Severity | Finding | Disposition |
| --- | --- | --- |
| HIGH | Worker bootstrap did not share all API production checks; configuration names could imply a live adapter absent from code | Fixed with Core startup validation and pre-import entrypoint gate; unregistered production ports fail closed |
| HIGH | New-activity emergency controls were absent from worker/SQL execution paths | Fixed with transactional database triggers and audited versioned controls; tests cover no provider submission while paused |
| HIGH | Admin password/status could change between password verification and locked session creation | Fixed: recheck locked account status and password hash before creating session |
| HIGH | Real providers, PostgreSQL multi-connection behavior and recovery drills lack deployment evidence | Release blocker, not silently accepted; no production activation |
| MEDIUM | Engagement admin login could not submit TOTP | Fixed; backend TOTP replay protection and production MFA remain |
| MEDIUM | API/BFF request sizes were not explicitly aligned | Fixed 64 KiB JSON/BFF and 16 KiB form limits; sanitized errors |
| MEDIUM | Expired/logout admin responses could leave cached rows on screen | Fixed: clear rows, details and reconciliation lists on unauthorized/logout responses |
| MEDIUM | Admin configuration and account management pages were placeholders | Connected with distinct permissions, masked fields, audited actions and versioned policies |
| MEDIUM | Worker shutdown could wait indefinitely | Bounded 30-second shutdown; uncertain provider work remains reconcilable, not blindly replayed |
| MEDIUM | Signed native builds, browser interaction, container configuration and external alert delivery are untested | Documented release gates |
| LOW | CI action tags/base images require release-time digest pinning and image scanning | Checklist gate; npm dependencies remain lockfile-controlled |
| INFORMATIONAL | Generic source pattern scan found no credential patterns; npm advisory scan returned zero vulnerabilities | Limited evidence, not proof that every possible secret/vulnerability is absent |

## Reviewed invariants

Authentication: scrypt passwords/PIN, expiring hashed OTP, rate limits, JWT verification, refresh family rotation/replay revocation, device session checks. Admin uses separate opaque sessions, TOTP replay tracking, exact permission lookup and no automatic user grants to powerful roles.

Financial integrity: integer/decimal-string calculations, locked quotes, bank ownership, unique financial event keys, append-only balanced journals, transactional order/payout/referral operations. Binary floats are used only for non-money counters, timing and basis-point configuration integers. New policy versions do not mutate old quotes.

Blockchain: configured contract/network/recipient, exact raw token units, authoritative confirmation evidence, duplicate protection, mismatch/reorg review. Payout: stable provider request key, no success from HTTP 200 alone, final evidence/UTR, atomic ledger settlement, append-only reversals, unknown outcome review. Webhooks: authenticated raw body, bounded timestamp, event deduplication and polling fallback.

Privacy: no full bank details in normal/admin monitoring responses; encrypted contacts, beneficiary snapshots, push tokens and support messages; private attachment abstraction. Audit views omit arbitrary metadata. Logs do not print request bodies, cookies, credentials or provider raw errors.

Operational controls serialize with new financial claims. There is a documented in-flight boundary: a provider request claimed before an emergency pause commits may still be sent. Reconcile it; never assume a pause cancels an already-authorized transfer.

## Remaining work before live release

Register and review vendor adapters; obtain sandbox evidence; validate live infrastructure/concurrency, backup restoration and native builds; pin CI actions/images; review retention, operating permissions and incident ownership with responsible operators. A future adapter requires a new code/security review before the startup capability gate can be removed. No bypass flag is provided.
