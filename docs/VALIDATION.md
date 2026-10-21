# Phase 1 validation record

Validated on 20 September 2026. This record distinguishes foundation checks from the later financial-service release checks.

| Check                                                                 | Result                                                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| NestJS TypeScript compilation                                         | Passed                                                                                                     |
| Next.js optimized build                                               | Passed; root gallery and all 16 admin navigation modules generated                                         |
| TypeScript strict checks for both workspaces                          | Passed                                                                                                     |
| Canonical tokens vs generated Flutter/CSS values                      | Passed                                                                                                     |
| PostgreSQL schema application in PGlite                               | Passed; 43 application tables and one balance view                                                         |
| Reference seed applied twice                                          | Passed; repeatable, with financial features disabled                                                       |
| Database invariant suite                                              | **12 passed, 0 failed**                                                                                    |
| API liveness                                                          | 200, with request ID and security headers                                                                  |
| API readiness without a configured/migrated database                  | 503 as expected                                                                                            |
| Unimplemented financial endpoint                                      | 404 as expected                                                                                            |
| Production-start prevention                                           | Passed; foundation API refuses production mode                                                             |
| Browser QA, desktop                                                   | Primary button state, Home/Profile phone navigation, required Profile entries, admin module routing passed |
| Browser QA, 390px viewport                                            | Mobile menu and Bank Accounts navigation passed; no horizontal overflow                                    |
| Browser exceptions during checked flows                               | None                                                                                                       |
| Visual inspection of gallery screenshot                               | Passed; saved in foundation-preview.png                                                                    |
| Compose and Flutter YAML parsing                                      | Passed                                                                                                     |
| Docker services / full PostgreSQL server                              | Not run; Docker is unavailable in this environment                                                         |
| Redis / BullMQ workers                                                | Not implemented in Phase 1                                                                                 |
| Flutter analyze, widget tests, pub resolution, Android/iOS/Web builds | **Not run; blocked SDK setup**                                                                             |

## Database invariants exercised

1. Required business tables exist and financial features seed disabled.
2. Quotes cannot use another user's bank account.
3. One active verified default bank per user; bank identity cannot be edited.
4. Accepted quote values and order quote references cannot change; quote reuse fails.
5. Expired quotes cannot be accepted.
6. Payout amount equals accepted net paise; beneficiary terms cannot change.
7. Duplicate chain transfer event fails; a distinct event in the same transaction is allowed.
8. A balanced journal derives exact decimal balances, rejects edits/deletes, and rejects later appends.
9. Unbalanced and empty journals fail at commit and roll back.
10. Journal account asset must match; fractional INR paise are rejected.
11. Scoped idempotency keys reject duplicate request identities.
12. Audit history cannot be deleted.

A journal trigger bug found by this suite was corrected before packaging. PGlite runs the PostgreSQL engine in WebAssembly; it does not validate a multi-worker PostgreSQL deployment, row-lock contention, external queues or provider behavior.

## Flutter limitation

The initial environment had no Flutter SDK. An official SDK setup attempt was rejected by automatic approval review because the command unexpectedly attempted to access a cloud metadata address. That action was not retried or bypassed. Mobile source and an information-architecture widget test are included, but Flutter packages are unresolved and no `pubspec.lock` or native host projects were fabricated. `mobile/README.md` documents local setup and the remaining validation commands.

## Release status

**Phase 1 foundation only.** No live rates, account authentication, verification service, bank validation, custody, deposits, ledger-posting service, financial admin controls or payouts are operational. No production deployment, actual wallet address, private key, payment provider or real transaction was created. The Flutter source still needs normal SDK/device validation. Continue only when Phase 2 is explicitly requested.
