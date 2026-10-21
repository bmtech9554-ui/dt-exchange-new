# End-to-end staging scenario report

The executable scenario uses actual Nest controllers/guards/services and PostgreSQL SQL through PGlite, with synthetic users and mock external providers. **It is not a deployed staging environment, native device test or real transfer.**

| Step | Executable evidence |
| --- | --- |
| Register and OTP login | Phase 3/6/7 setup uses encrypted contacts, hashed OTP and real session endpoints |
| Verification required and approval | Phase 3 integration cases exercise activation and mock verification adapters |
| Bank account | Actual masked/encrypted bank API and ownership/default constraints |
| Quote and order | Server quote, immutable terms, one-time consumption and idempotency tests |
| TRC20 deposit | Authoritative mock provider evidence, token/recipient validation and confirmation threshold |
| Ledger | Actual double-entry journals, duplicate-post protection and integrity view |
| INR payout | Durable mock provider submission; success only through explicit provider fixture evidence |
| Webhook/UTR/completion | Signed mock webhook, replay deduplication, SANDBOX-prefixed UTR, atomic settlement |
| History and notifications | Actual account APIs; Phase 6 fanout/delivery and settings preference cases |
| Admin and reconciliation | Authenticated permission checks, masked monitoring, ledger audit and provider comparison |
| Referral | Qualifying completed mock transaction, explicit sandbox reward opt-in, concurrent single reward |
| Support | Ticket creation/replies, private attachments and cross-user authorization |
| Emergency control | Payout cannot be submitted while disabled; an already-submitted payout can settle during maintenance |

Run `npm test` for the complete retained suite. `backend/test/phase7.test.mjs` contains the maintenance-settlement scenario plus policy, authorization and production-gate cases; `phase6.test.mjs` retains the full engagement/financial concurrency sequence.

The same suite can use the disposable real PostgreSQL harness as documented separately. Additional pre-release evidence must cover the actual reverse proxy, admin browser, signed mobile builds and each real provider sandbox. Fixture success is never reported as production payment success.
