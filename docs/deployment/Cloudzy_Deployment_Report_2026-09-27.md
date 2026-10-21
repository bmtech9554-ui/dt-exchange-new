# DT Exchange deployment report — 27 September 2026

**Status: LOCAL_PREPARATION_COMPLETE / VPS_ACCESS_PENDING / BLOCKED_FOR_PRODUCTION**

The latest user request authorizes infrastructure preparation and deployment with automatic financial activity disabled. No real transaction was performed. No server configuration, database, firewall, certificate or production account was modified during this turn.

| Requested item | Verified status |
|---|---|
| DNS | PASS: dtexchange.app, api.dtexchange.app and admin.dtexchange.app resolve to 172.86.81.233; www is a CNAME to dtexchange.app and resolves to the same IP. |
| VPS | SSH port 22 reachable. Batch key login returns Permission denied. Secure local password window opened; completion has not been confirmed. Ubuntu/services/data have not yet been inspected remotely. |
| Deployed services | None deployed in this session. Existing server inventory remains unknown. |
| Website | https://dtexchange.app — target only; HTTPS connection currently fails. Full website implemented and browser-checked locally at http://127.0.0.1:3100/site. |
| API | https://api.dtexchange.app/api/v1 — target only; HTTPS unavailable. Production startup correctly refuses unregistered provider adapters. |
| Admin | https://admin.dtexchange.app — target only; HTTPS unavailable. Existing admin build/security retained; KYC UI stays removed. |
| APK download | https://dtexchange.app/download and https://dtexchange.app/downloads/DTExchange.apk — prepared targets; no APK published. |
| HTTPS | No certificate issued, renewal configured or live TLS verified. Ports 80/443 not reachable in external probes. Four-host Nginx/Certbot sequence prepared. |
| PostgreSQL | Not provisioned/inspected remotely. No migration executed against a persistent server database. Private TLS Compose candidate prepared; all nine migrations pass isolated tests. |
| Redis | Not provisioned/inspected remotely. Private TLS/ACL candidate prepared; no public port. |
| Workers | None started. Deployment topology omits blockchain and payout workers. Engagement stays gated by real delivery adapters and configured infrastructure. |
| Admin provisioning | Not performed. Existing official script retained; secure interactive wrapper prepared. Explicit role/provisioning approval and enrolled credentials required. |
| Android signing | ANDROID_SIGNING_PENDING. No production keystore or attestation identity generated. |
| APK publication | Not performed. Download button disabled and zero APK links rendered. Current debug/preview APK remains local only. |
| Backup | Existing encrypted-backup and isolated-restore scripts preserved, retention/key-escrow plan documented. No VPS backup or restore drill performed. |
| Monitoring | Private health timer/log-rotation candidates prepared. Nothing installed; alerts, remote datastores, CPU monitoring and receiver acceptance still pending. |
| Tests | npm typecheck/build PASS; backend 172 PASS; admin 33 PASS; Flutter analyze clean and 333 tests PASS. Compose YAML parses; Docker/Nginx server-side syntax/runtime checks not yet available. |
| Remaining blockers | Secure VPS authentication; registered production authentication/bank/delivery/storage adapters; TLS datastore/certificate setup; approved receiving address/reference policies; signing/attestation inputs; secure admin provisioning; legal/support publication inputs; backup/restore/monitoring and real-device acceptance. |

## Safety and approval history

Automatic approval review initially rejected adding persistent root SSH access from a password-terminal request. The user subsequently explicitly approved a **temporary** dedicated root SSH key for this deployment. The local private key is outside the repository. The secure setup terminal was opened, but no successful key authentication or remote installation has been observed. No passwords or private keys were printed. Keep root/password access unchanged, and remove the exact temporary authorized key when the deployment session is finished.

Publishing the informational website while the production API remains blocked needs the user's Phase 22 approval. This report does not silently waive that gate. Do not work around production checks with development/mock deployment labels. No provider/financial cutover is authorized here.

## Implemented locally

- Full public site in the existing Next.js codebase: approved DT logo/colors, labeled current app screenshot, manual workflow, features, security, ten FAQs, support guidance and release preparation.
- Premium official download page with all requested metadata fields, installation guidance and strict metadata validation. Rejects third-party/debug URLs, malformed checksums, invalid version/date/size and unsigned/incomplete metadata.
- Official-domain Nginx candidate: apex website, www 301, API/admin isolation, exact APK MIME, private-file protection, restricted uploads and sanitized access logs. HSTS/preload deliberately absent until TLS acceptance.
- Private persistent PostgreSQL/Redis Compose foundation, loopback-only app ports, non-root application containers and no automatic financial services.
- Portable Windows/Linux admin test runner; no authentication/financial test rules weakened.
- Manual health readiness no longer demands intentionally disabled financial workers; datastore/engagement readiness still required.
- Reviewable inspection, secure provisioning, health and log-rotation scripts plus deployment/backup/restore/signing runbook.

## Browser evidence

Desktop and 320/360-pixel layouts loaded with no browser errors or overflow. All images loaded, ten FAQ entries rendered, FAQ interaction worked, and reduced motion disabled animation. Download rendered a disabled button with no direct APK link. Local response headers include nosniff, DENY and a referrer policy. Public HTTPS/CORS/admin login could not be validated without deployed services and credentials.

Screenshots: website-hero.png, website-desktop.png, website-mobile.png, download-mobile.png in this directory.

## Changed files

- admin/src/app/site/page.tsx, site.css (new full public website)
- admin/public/product/home-preview.png (existing approved preview screenshot copy)
- admin/src/app/download/page.tsx
- admin/src/lib/android-release.ts
- admin/src/app/layout.tsx
- admin/src/components/admin-shell.tsx
- admin/package.json; scripts/test-admin.mjs
- admin/test/public-site.test.tsx
- backend/src/health/health.controller.ts
- backend/test/manual-readiness.test.mjs
- deployment/cloudzy/compose.yml, redis.conf, runtime.env.example
- deployment/cloudzy/nginx.conf, nginx-bootstrap.conf, dtexchange-proxy.conf
- deployment/cloudzy/android-release.env.example
- deployment/cloudzy/inspect-server.sh, provision-admin-interactive.sh, check-health.sh
- deployment/cloudzy/dtexchange-health.service, dtexchange-health.timer, logrotate.conf
- deployment/cloudzy/README.md
- .dockerignore; .gitignore; this report and browser screenshots

No mobile design, brand asset, business ledger rule, provider registration, applied migration, production signing identity or production environment was changed.

## SSH host verification hold

The earlier automatically recorded ED25519 key was not independently verified. The prior password prompt was stopped and `.tools/deployment_known_hosts` moved to `.tools/deployment_host_candidate`. The SSH setup helper now fails closed when the verified host file is absent. StrictHostKeyChecking remains enabled.

Unverified candidate: SHA256:NLkJUL1JPKr3TVhCCHyCGKzkKbO3jInVNoS1KAYbixc.

Desktop and browser control both failed to initialize with `windows sandbox failed: helper_unknown_error: setup refresh had errors`, including a reset/retry. Independent Cloudzy/VNC fingerprint verification is still pending. No SSH authentication or remote changes were attempted in this verification turn.

# Live deployment update — 7 October 2026 (Asia/Calcutta)

Website/infrastructure are deployed; application readiness remains BLOCKED_FOR_PRODUCTION. This supersedes the earlier local-only status.

- Strict host identity comparison and separate key-based SSH passed using C:/Users/Ashik/.ssh/known_hosts. Password recovery remains enabled. Original temporary deployment key retained for unfinished deployment; remove its exact authorized line at completion.
- Ubuntu upgrades completed; controlled reboot and automatic strict-key reconnect passed. Kernel 6.8.0-142-generic; no reboot pending. Initial memory usage was about 702 MiB/7.8 GiB, not 93%; no process was killed.
- Docker 29.1.3, Compose 2.40.3, Nginx, Certbot, UFW and fail2ban installed. Dedicated non-login dtexchange source owner; /srv/dtexchange/current; secrets only in restricted server config.
- https://dtexchange.app/ returns 200. Root rewrite/hydration bug fixed in AdminShell; fresh browser has no JavaScript errors and no admin navigation on public root. 320/360px layouts have no overflow; images load.
- HTTP redirects to HTTPS; https://www.dtexchange.app/ redirects 301 to apex.
- https://admin.dtexchange.app/dashboard returns 200 for the existing admin shell. Admin authentication/operations are NOT validated; no admin provisioned.
- https://api.dtexchange.app/api/v1/ deliberately returns maintenance 503. Backend image built; API and engagement worker not started. Production startup requires registered OTP, verification/bank, email, SMS, push and storage adapters. Automatic blockchain/payout providers are already exempted in manual mode. No safety gate bypassed.
- https://dtexchange.app/download returns 200 with disabled button and no APK links. APK path returns 404; ANDROID_SIGNING_PENDING. No debug/preview APK uploaded.
- Valid four-host Let's Encrypt certificate expires 4 January 2027. Renewal timer and Nginx reload hook installed; renewal dry run passed. Nginx syntax passes; HSTS preload absent.
- UFW allows 22/80/443; new SSH connection passed afterward. fail2ban SSH jail active. External probes cannot connect to 5432/6379/3000/4000. PostgreSQL/Redis have no published ports; web binds loopback only.
- PostgreSQL 16 and Redis 7 healthy on private persistent Docker network with TLS and generated server-only credentials. Tested image digests pinned in compose.yml.
- All nine official migrations applied to new database using verified pre-migration backup. No fixture seeds or real financial activity. Application database-role/runtime configuration remains pending API activation.
- Encrypted daily backup timer active. Checksums and isolated restoration of all nine migrations passed. Test restore databases retained. User chose to leave backup and recovery key on VPS; NO local copy made. Off-server destination, independent key escrow and approved retention remain pending.
- Health timer checks containers, website, Nginx/fail2ban, disk/memory/load and backup age. Logs rotate. Final post-reboot check: all containers healthy, no failed systemd units. External alert routing is pending.
- Manual review/payout true; automatic credit/payout false; transactions, payouts, trading and deposits activation flags remain false.
- Local validation: typecheck, 172 backend tests, 33 admin tests passed. Admin typecheck/tests repeated after root-layout fix; VPS backend/web production builds passed. Flutter unchanged; earlier analyze and 333 tests passed, not rerun here.
- Local changed files: admin/src/components/admin-shell.tsx; deployment/cloudzy/compose.yml; check-health.sh; logrotate.conf; this report; website-live-mobile-2026-10-07.png.
- Remaining inputs: reviewed production adapters/provider configuration, collection/reference policy, application credentials and release attestation, secure admin provisioning, Android signing, authenticated application acceptance, off-server backups and alert destination. Do not represent API/admin financial operations as live.
