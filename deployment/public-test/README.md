# Public software test release

This is an additive, separately identified test service. The production API,
worker, financial settings, ledger, signing identity and public Build 8011 are
not replaced. The production activation candidate remains staged and inactive.

## Boundaries

- App: `com.dtexchange.dt_exchange.publictest`, version 1.0.0, build 8019.
- Only API: `https://dtexchange.app/test-api/api/v1`. Redirects and other API
  origins/paths are rejected by the app. Production sessions are not imported.
- Separate PostgreSQL container/database/volume, fresh keys and test-admin MFA.
- A Docker internal network has no route to Internet providers. There are no
  production mounts, secrets, databases, Docker sockets or payment workers.
- The only address is a non-payable `DT-TEST-...` marker; no wallet QR is shown.
- Users choose pseudonymous test usernames/passwords. Generic OTP/reset and
  real bank-entry routes are denied. A generated bank fixture represents an
  established demo beneficiary; the underlying 24-hour bank cooldown is intact.
- All credits, journals, mock-chain evidence and simulated payout completion
  exist solely in this test database. Every screen has a permanent TEST MODE
  banner. Approvals are authenticated, permission checked and audited.
- No test fixture/bootstrap routes, arbitrary owner adjustment, provider
  callbacks, release publishing or financial configuration writes are exposed.

## Limits

Demo rate 103, zero fees, deposit min 100 / day 20,000 / no monthly cap;
sell min 100 / transaction 5,000 / day 20,000 / month 100,000 / quote 60s.
Manual demo payout max 515,000 INR; existing 1,000,000 INR daily platform
budget remains. No automatic credit/payout/provider delivery is enabled.

The initial capacity is 1,000 test accounts, 1 MiB per file, 20 files per user,
and 1 GiB aggregate encrypted uploads. Database triggers enforce capacity.
The proxy and application enforce rate limits. Containers have CPU, process,
memory and log caps. No data is automatically deleted to make room.

## Rollout and rollback

1. Confirm production health, stable APK hash, backup authentication/full parse,
   rollback images, disk reserve and network non-overlap.
2. Verify the source package manifest. Create only the separate test stack.
3. Test database persistence, secret isolation, blocked egress, protected admin
   credentials/TOTP and complete demo workflows before opening download.
4. Add exact Nginx paths for test pages/API/assets; `nginx -t` before reload.
   Preserve the original Nginx file securely and restore it if checks fail.
5. Sign and verify the separate test APK. Install alongside the Samsung's
   production app. Verify the full workflow and production non-interference.
6. Publish only this verified artifact and matching metadata. Never substitute
   production Build 8018 or a debug build. Download metadata requires a passed
   physical-device check, correct test application ID and production signer.
7. For rollback, remove only the added test routes/link, reload checked Nginx,
   and stop `dtexchange-public-test`. Retain its database and private backups.
   Do not reset/recreate production data or replace stable Build 8011.

Legal drafts remain unpublished; this deployment makes no claim of financial,
privacy or regulatory compliance and does not activate customer-fund operations.
