# DT Exchange — Manual Android release

Status: **BLOCKED_FOR_PRODUCTION**. Implementation continues the existing release candidate; no production deployment or real transfer was performed.

## What changed

- Additive migration `008_manual_android.sql` introduces private encrypted evidence, manual deposit requests, immutable manual history, and signed Android release metadata. Existing wallet, quote, order, payout, journal and ledger-entry tables remain authoritative.
- A shared, operator-configured TRC20 receiving wallet is displayed without generating or storing a signing key. Users submit a mandatory 64-character TxID; optional proof cannot credit funds.
- Separate review and approval permissions protect manual deposit approval. The admin records independently checked token, receiving address, sender, amount, block, block hash, timestamp, successful execution and confirmations. Approval posts the existing balanced deposit journal in the same database transaction.
- Sell quotes are wallet-funded in manual mode. Existing backend rate, fee, limits, account eligibility and available-ledger-balance checks are retained. Quote consumption and rate immutability are unchanged.
- Manual payouts preserve encrypted beneficiary snapshots, use an authorized bank reveal, and require exact INR, UTR, payment timestamp, business bank, admin note and private receipt. Settlement and order completion are atomic and duplicate-safe. Uncertain transfers go to manual review; they are never automatically retransferred.
- Flutter connects deposit entry, proof upload, review history, resubmission, existing sell flow and authenticated payment receipts. Existing light components, animations, four bottom destinations and simple Profile are preserved.
- Admin adds Manual Deposit Reviews, Manual INR Payouts, dashboard counts and Android Releases. Existing provider abstractions remain.
- Public `/download`, signed release metadata and an official-domain-only Android updater support direct APK distribution. No APK is advertised before a verified signed artifact is published.

## Configuration

```dotenv
MANUAL_DEPOSIT_REVIEW=true
MANUAL_PAYOUT=true
AUTOMATED_BLOCKCHAIN_CREDIT=false
AUTOMATED_PAYOUT=false
PRIVATE_FINANCIAL_STORAGE=postgres-encrypted
ANDROID_UPDATE_ENFORCED=true
```

Supply `MANUAL_COLLECTION_ADDRESS`, chain network/contract/confirmations, secrets, exact `APK_ALLOWED_ORIGINS`, public `APK_RELEASE_PUBLIC_KEY_B64`, and verified deployment URLs externally. Production requires explicit mainnet configuration for a real collection wallet. Development fixtures use `tron-mock` and cannot start in production.

Do not launch blockchain or payout automation workers in manual mode; they refuse startup. Keep API, engagement worker, PostgreSQL and required Redis services. Operator-controlled manual rate policies need no market-rate API. Live identity/authentication/notification adapters are still missing and production startup continues to fail closed until registered and validated.

## Compatibility

Existing order statuses remain `READY_FOR_PAYOUT → PAYOUT_PROCESSING → COMPLETED`; manual action history adds `READY_FOR_MANUAL_PAYOUT → PAYOUT_IN_PROGRESS → PAID → COMPLETED`. Reusing these existing statuses preserves SQL transition guards, settlement requirements, history and Flutter timeline behavior. No second balance or ledger implementation was added.

Automatic blockchain/payout acceptance is `AUTOMATION_FUTURE`. Play Store, App Store and iOS are `FUTURE_REQUIREMENT`, not initial-release blockers. Historical reports are preserved and superseded only for this release profile.

## Delivery

Source mobile version: `1.0.0+8002`; release profile: `1.0.0-manual.1`. The archive includes source, tests, migration, operating guides and 12 UI previews. Native APK/signing is pending; no unsigned or debug APK is included.

## API additions

All routes below use the existing `/api/v1` prefix. User routes require the existing user access token; admin routes require existing admin-session authentication and the listed granular permissions. IDs are UUID-validated. JSON is strict-schema validated; POST proof submission uses `Idempotency-Key`.

| Method / path | Behavior |
|---|---|
| GET `/manual/configuration` | Manual flags, configured collection address, network and confirmation target |
| GET/POST `/manual/deposits` | Paginated owned review requests / submit immutable claim without credit |
| GET `/manual/deposits/:id` | Owned evidence status and ordered history |
| POST `/manual/deposits/:id/resubmit` | Attach new owned proof to rejected/information-requested record |
| POST `/manual/files` | Multipart `file` and `purpose=proof`; private encrypted upload |
| GET `/manual/files/:id` | Authorized MIME/base64 bytes and SHA-256; no-store |
| GET `/admin/manual/dashboard` | Scoped operations metrics |
| GET `/admin/manual/deposits?page=1` | Review queue, 50 rows/page |
| POST `/admin/manual/deposits/:id/review` | `action=start/reject/information/approve`, note and mandatory approval evidence |
| GET `/admin/manual/payouts?page=1` | Locked order figures and masked bank queue |
| POST `/admin/manual/payouts/:orderId/process` | Reason and method; audited beneficiary reveal and processing |
| POST `/admin/manual/payouts/:orderId/confirm` | Exact amount, UTR, paidAt, bankUsed, note, receiptId; atomic settlement |
| POST `/admin/manual/payouts/:orderId/review` | Escalate uncertain processing payout with note; no duplicate transfer |
| POST/GET `/admin/manual/files[/:id]` | Authorized private proof/receipt upload or access |
| GET/POST `/admin/manual/releases` | Release history / externally attested publication |
| GET `/app/version/android` | Public safe APK/version metadata; no provider credentials |

Existing `/sell/quote`, `/sell/orders`, `/sell/orders/:id`, `/wallet`, `/history` and `/transactions` remain connected. Order response `payout` now contains `receiptId`, `paidAt` and `manual`; history includes manual deposits and private receipt availability on payout details.

Apply `npm run db:migrate` only after a backup and verified target connection. Migration 008 is forward/additive; never reset schemas. A code rollback must not resume automatic financial workers over unresolved manual records. Preserve the migration/evidence and disable financial features while investigating.

## Controlled operating-model cutover

Before enabling this profile on an existing deployment, disable new financial writes, stop automatic scanner/payout workers and independently reconcile all outstanding automatic deposits, provider attempts and payouts. Do not relabel or re-confirm existing automated payouts as manual. Deploy the additive migration and reviewed source, assign roles, configure the externally held collection wallet and restore-test encrypted evidence. Keep automatic financial workers disabled. Enable only the reviewed manual operational flags after staging acceptance.

Existing database operational controls and environment transaction/payout switches block new manual credits/payout starts. Recording evidence for a payment already made externally can still settle an existing processing payout; disabling outbound transfers must not discard a genuine bank result. Use manual-review escalation for uncertain outcomes. A rollback keeps financial writes paused and does not delete evidence or journals.
