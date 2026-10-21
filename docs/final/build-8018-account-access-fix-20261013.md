# Build 8018 account-access routing fix

## Confirmed cause

The isolated test shutdown installed `dt_8018_closed` in the production Nginx
virtual host. Every request carrying `X-DT-Version-Code: 8018` returned HTTP 503
before reaching NestJS. It affects registration, login, OTP verification, token
refresh, app configuration and authenticated reads. The production API,
PostgreSQL, Redis and worker readiness checks are healthy.

The separate backend Android guard remains enabled. It enforces the published
minimum version on financial writes, after checking the JWT, live session and
account state. That guard returns 403 for an insufficient version; it is not the
source of this blanket 503. No credentials, TOTP or sessions need resetting.

## Deployed narrow fix

The user explicitly approved this exact Nginx-only scope on 13 October 2026.
Deployment succeeded. The retired isolated-test shutdown timer is disabled and
its disposable container remains stopped. No production container was restarted.

Replace only the obsolete Build 8018 blanket block with the reviewed method/path
allowlist in `deployment/cloudzy/android-8018-access.json`, rendered by
`scripts/render-android-access.py`. Unknown routes fail closed for this build.

- Allow existing authentication/OTP/session endpoints to reach their unchanged
  backend validation, rate limits and provider checks.
- Allow account, balance, history, protected receipt reads, bank management,
  preferences, notifications and support endpoints.
- Block manual deposit configuration (including the receiving address), deposit
  evidence uploads/submissions, wallet address allocation, sell quotes/orders,
  referral claims and all mobile attempts at admin operations with HTTP 403.
  The response uses the existing JSON error envelope and the existing backend
  wording, “Service temporarily paused,” so the unchanged app can distinguish it
  from a connectivity failure.
- Keep every other build's routing unchanged. Preserve owner authentication,
  existing production flags, financial settings, database and all APK files.
- Change no app/website content. Existing error handling displays denied actions.
- Reload Nginx only; do not restart the API, worker, database or Redis.

The version header is client supplied. This overlay is an **additional routing
restriction**, not a trusted financial entitlement or proof of regulatory
compliance. It does not authorize anything denied by NestJS. Removing/spoofing
that header cannot enable orders/payouts while the backend execution flags remain
false, but existing separately authorized manual intake for other clients remains
enabled. A public non-financial distribution needs a separately reviewed,
server-enforced eligibility policy if it must prevent untrusted clients from
accessing all existing intake endpoints. This fix is not publication clearance.

## Validation and deployment boundary

Preflight verified the encrypted database archive checksum and authenticated full
`pg_restore` parse without restoring into production. Disk has over 200 GiB free.
The current 8011 artifact and root-only rollback copy are intact. Full proposed
Nginx configuration passes syntax validation. Fifty real Nginx loopback cases
pass, including normal account routes, blocked financial paths, path normalization,
query strings, unrelated builds and unknown routes. The isolated test process
was terminated; production configuration and container identities did not change.

Runtime evidence and immutable before/candidate hashes are recorded under
`.tools/build-8018-routing/`. Complete backend/admin/Flutter regressions are
recorded separately there or in `.tools/build-8018-routing-*.log`.

The approved deployment helper rechecked the exact old config hash and
service/flag state, saved a
root-only rollback copy, atomically installs the tested candidate, syntax-checks
and reloads Nginx. It tests account routes without credentials or SMS, checks
financial paths remain denied, confirms all existing containers stayed running,
and restores/reloads the prior config automatically if validation fails.
The JSON-format follow-up initially reached an old worker immediately after
graceful reload and automatically restored the working routing config. After
adding a bounded wait for new workers, its five real Nginx contract checks and
live 403/JSON verification passed. No additional permission was enabled.

Regression results: backend full suite 274 passed, followed by 6 focused routing
checks including the new JSON response contract; admin/website 55 passed;
Flutter analysis passed and 401 Flutter tests passed; backend/admin typechecks
passed. The first sandboxed backend attempt could not connect to loopback;
the complete rerun with local networking passed.

Fresh production password login succeeded on Samsung Build 8018, confirmed by
the user and observed authenticated Home with ₹103.00 and an animating graph.
Wallet, History, Profile, bank-list/form and Settings screens loaded; the bank
note and Referral Coming Soon remained intact. Dark mode was selected and the
original Light preference restored. No bank record or financial request was
submitted. The USB connection was restored and the remaining physical checks
completed on 13 October 2026:

- Deposit displays the existing “Service temporarily paused” message, with no
  receiving address or submission form exposed.
- Sell displays the same paused-service message; no quote, order or payout is
  accepted. The unchanged screen's initial quote request is denied at Nginx.
- Telegram Support launches the exact `tg://resolve?domain=dtexchange` Android
  intent. No Telegram account authentication or message was sent; the HTTPS
  fallback remains unchanged and covered by the existing tests.
- The installed APK hash matched the verified release. The identical APK was
  installed using `adb install -r`, with no uninstall or app-data clearing.
- Android's native biometric prompt appeared after relaunch. The user completed
  it and confirmed “Unlocked.” Authenticated Home recovered without a password
  or OTP; Wallet reopened, ₹103.00 appeared and graph frames changed.
- The production certificate, release signature, build number 8018 and
  non-debuggable manifest were verified again. No rebuild or re-sign occurred.

The immutable APK SHA-256 remains
`e671fa441f37e1dc90914ec886a82aca9c16f894fe7407fb151f2262df35aef8`
(60,219,794 bytes). Same-signed update and recovery evidence is stored in
`.tools/build-8018-routing/update-install.json` and `post-update-recovery.json`.

Final read-only live checks confirmed healthy API, PostgreSQL, Redis, queues and
workers; website/download/admin/API HTTPS returned 200. The actual public APK
download remains Build 8011, SHA-256
`8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b`.
The private rollback copy matches. The isolated container stays stopped and its
expired shutdown timer disabled. No further production changes were made during
these physical follow-up checks.

Fresh financial/configuration/owner table fingerprints remain unchanged from the
verified production baseline, and all prior audit rows are intact. Ordinary
authentication/session activity is expected and is not a financial write.

## Remaining validation/publication requirements

- Physical account-access follow-up is complete. Fresh production password
  login, core account screens, same-signed update, biometric recovery, support
  link and paused-service displays passed. No OTP was sent or app data cleared.
- Keep signed Build 8018 unchanged and public Build 8011 available.
- Legal operator/privacy/financial-service eligibility and applicable logging
  jurisdiction evidence remain unresolved. No legal document is created or
  edited and no legal exemption or compliance conclusion is assumed.
- Do not publish until the outstanding publication evidence and any required
  stronger server-enforced non-financial eligibility boundary are resolved.
  Client-supplied build headers alone do not establish that boundary. Existing
  older-client manual intake was deliberately preserved; global transaction
  execution, payouts, automated credit and automated payouts remain disabled.
