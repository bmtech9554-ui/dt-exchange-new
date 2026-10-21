# Deposit and Sell regression investigation — 13 October 2026

Status: **isolated functionality restored and verified; temporary window closed**.
Production financial activation and publication were not performed.

## What last worked

The latest complete Deposit/Sell validation used **the same signed Build 8018**
on 12 October against a disposable Cloudzy fixture. It used synthetic customers,
mock OTP, a non-payable receiving address and isolated opening ledger balances.
It was not evidence of authorized real-money operation.

Production separately supported manual evidence intake during the Build
8012/8013 work. Current read-only history contains two non-synthetic-marked
UNDER_REVIEW submissions from 8 October, two synthetic UNDER_REVIEW submissions
and one rejected synthetic submission. It contains no sell orders or payouts.
Those records prove submission, not a blockchain transfer, wallet credit or
completed INR settlement.

This checkout has no Git repository. Comparisons therefore use preserved
deployment snapshots, immutable image/APK identities, applied migration
checksums, Nginx configurations and database history, not unavailable commits.

## Exact cause and classification

1. The prior isolated window's shutdown installed a blanket Build 8018 HTTP 503
   rule. That also blocked login. It was already replaced by the separately
   approved account-access fix before this investigation.
2. The current account-only Nginx allowlist deliberately excludes manual
   configuration/address/intake/upload and Sell quote/order routes for 8018.
   Its HTTP 403 body is `Service temporarily paused`. These requests do not
   reach NestJS. This is the immediate cause of the current screen message.
3. Transaction and payout execution were **false before and after** migrations
   017–021 and subsequent deployments. They were not newly disabled by the
   major feature update. Manual modes remain true and automatic credit/payout
   remain false. Earlier-client manual evidence intake remains true.
4. All 21 migration checksums match. App/API/site maintenance is off, the
   dedicated production test account is active, and Build 8018 exceeds the
   active release minimum of 8008. No incorrect migration, stale minimum-build
   guard or production account lock was found as the cause.
5. No Flutter implementation change is needed to display the forms and submit
   permitted requests. The identical APK works against the scoped test backend.

The deliberate production restrictions were preserved, as requested. No
operating-clearance evidence was invented, no Privacy Policy was created, and
no real customer-fund operation was enabled.

## Approved isolated restoration

The user explicitly approved a new maximum 60-minute test window. It reused
the verified image
`sha256:b2dad9ed3c155e717cd112ce68a94c1dcaf02de46abca9436874bb9c1d151a6b`.

- Only Build 8018 from the approved test connection reached the fixture.
- No external network, production network membership, production volumes,
  production credentials or payment execution were available to that container.
- Filesystem was read-only, capabilities dropped, and resources limited.
- Private fixture/admin controls were accessible only through SSH.
- A persistent shutdown timer was armed before routing was enabled.
- Synthetic deposit credit and completed payout/order states were prohibited
  by disposable-database triggers.
- Shutdown stops the fixture first and restores the exact current account-only
  baseline, **not** the obsolete blanket 503 rule. Configuration drift fails
  closed and prevents overwriting unrelated changes.

The first attempt stopped before creating the environment because available
memory was below the unchanged 3 GiB preflight reserve. It retried only after
three passing samples. Later read-only diagnostics found substantial guest
memory ballooning; the fixture used about 483 MiB and production readiness
remained healthy. No production process was killed or rebooted.

The window closed early, at 13:01:55 UTC, before its 13:38:14 UTC deadline.
The fixture is stopped, its timer is disabled/inactive, the private tunnel and
local test-admin server are closed, and normal account routing is restored.
Nginx baseline SHA-256:
`0f938af1a1ef2fe3a207bd8f5f2d158fd9d6ee894293f3ff4669107615e6c1fc`.

## Fresh results and limits

| Check | Verified result |
| --- | --- |
| Flutter analyze | No issues |
| Flutter suite | 401 passed |
| Backend suite | 276 passed |
| Admin suite | 55 passed |
| Restoration helper | 5 checks passed; actual close independently verified |
| Candidate Nginx | Full syntax check and 48 isolated loopback routing cases passed |
| Encrypted backup | Checksum, authenticated decryption and full pg_restore parse passed; no production restore |
| Samsung registration/OTP | Fresh synthetic registration and development-OTP verification; no real SMS |
| Deposit UI | Existing network, address/QR, amount, TxID, proof and submission controls work |
| QR | Decoded screenshot matches `DT-SYNTHETIC-NONPAYABLE`; intentionally not the production receiving address |
| Deposit validation | 99 rejected; 100 accepted; zero fee; 100 USDT estimate ₹10,300 |
| Physical submission | Samsung-created request entered UNDER_REVIEW, exact proof bytes linked, no wallet credit |
| Account risk hold | Held synthetic account rejected; hold preserved, fresh eligible account used instead |
| Duplicate TxID | Existing phone-submitted TxID rejected by backend; permanent uniqueness/idempotency tests pass |
| Owner review | Actual UI shows the exact phone record, user and TxID; protected proof renders and downloads with matching hash |
| Sell UI | Samsung shows selected synthetic bank, zero wallet balance, backend ₹103 rate and zero fee; 100 → ₹10,300 |
| Sell safeguards | 5,001 rejected physically and by API; unfunded wallet rejected; expired 60-second quote rejected |
| Funded Sell requests | Actual NestJS flow accepts funded isolated fixtures with permanent idempotency, ledger reservation, status tracking and admin detail/review UI |
| Notifications | Deposit and Sell events link to exact records once; actual Owner inbox links tested, including phone-created deposit |
| Manual payout/proof | Authorized isolated processing/review and UTR form entry, protected receipt association/view/download; no completed payment or committed UTR manufactured |
| Preservation | Home ₹103 and animated graph, navigation and animated Coming Soon verified physically; existing APK and application sources unchanged |

The new phone account had no spendable balance, so no successful sell order was
created from that account. Successful funded-order validation used the separate
isolated opening-balance fixtures. These are different checks, not a claim of
real production settlement. An externally added synthetic bank became visible
after an app relaunch refreshed the test session's cached account state.

## Production closure verification

- API, database, Redis, queues and workers report ready.
- Production container IDs/images/start times are unchanged.
- Financial/configuration/owner table fingerprints match the preserved baseline;
  prior audit rows are unchanged.
- Website, download page and Admin HTTPS return 200.
- Build 8018 account configuration returns 200; its intentional production
  deposit gate returns 403 after test closure.
- Public Build 8011 remains unchanged, SHA-256
  `8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b`.
- Build 8018 remains signed, non-debuggable, production-certificate verified and
  unpublished; SHA-256
  `e671fa441f37e1dc90914ec886a82aca9c16f894fe7407fb151f2262df35aef8`.
- The Samsung was signed out of its disposable account. Existing production
  credentials/data were not reset; production sign-in must use the user's own
  credentials on the phone.

## Remaining boundary

Deposit/Sell restoration is verified **as an isolated test flow**, not a
persistent production unlock. Real customer-fund activation still requires the
unverified operator/operating requirements to be resolved, the required live
chain configuration to be validated, and a separately scoped activation.
No blanket restriction removal, automatic credit/payout, APK rebuild, signing
identity change or APK publication was performed.

Primary evidence is in `.tools/deposit-sell-regression-20261013/`: `history.json`,
`restoration-preflight.json`, `local-owner-result.json`, `vps-owner-result.json`,
`vps-boundary.json`, `device-api-result.json`, `phone-owner-result.json`, device
captures, `production-integrity.json`, `closure.json` and the full test logs.
Prepared/executed helpers are `.tools/restore-isolated-8018.py`, its test,
deployment/preflight/closure helpers and guarded device checks. No application
source or applied migration was changed during this investigation.
