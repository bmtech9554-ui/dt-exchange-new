# Phase 7 handoff

This is a historical phase roadmap. See [Current handover — 20 October 2026](CURRENT_HANDOVER.md) for the recovered source and remaining work.

Phase 7 production preparation is implemented; production activation remains blocked by documented provider/infrastructure/native validation gates. Do not start Phase 8 until explicitly authorized. See `phase7/Phase7_Release_Checklist.md` and `phase7/Phase7_Test_Results.md`.

---

## Preserved earlier roadmap

# Phase roadmap and handoff

Current delivery: **Phase 6 engagement and hardening foundations implemented with explicit development delivery adapters**. No production deployment occurred. Stop until **Continue Phase 7**. Preserve the approved brand, schema baseline, four-tab navigation and module boundaries.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Architecture, database, design system, navigation | Completed baseline |
| 2 | Complete mobile UI and isolated preview | Completed baseline |
| 3 | Authentication, verification, banks, rates, quotes | Completed; regressions retained |
| 4 | Orders, custody port, TRC20 tracking, ledger, mobile/admin connections | Implemented; see phase4 documentation and validation limits |
| 5 | INR payout execution and reconciliation | Implemented in sandbox; see phase5 validation and release gates |
| 6 | Notification/referral/support and hardening foundations | Implemented; see Phase 6 validation gates |
| 7 | Full operational admin modules | Not started; limited Phase 4 monitoring exists |
| 8 | Production deployment hardening and release validation | Not started |

## Phase 2 implementation record

1. Replaced mobile feature placeholders with connected screens and original design components.
2. Starts at the branded splash, then login/registration/OTP and activation.
3. Isolated and labelled sample account/rate/balance/transaction data behind explicit preview opt-in.
4. Completed Home, Wallet, History, the restricted Profile, Bank, Referral, Settings, Notifications and Support, including the sell UI preview.
5. Added validators, responsive layouts, requested animations, native host files/icons and Flutter runtime tests.
6. Kept backend services, schema, financial ports, original logo and design tokens unchanged. Real account/rate repositories begin only in Phase 3.

## Release dependencies for the already requested later phases

- Phase 3 needs chosen OTP and verification providers, approved activation rules, credential/key management and a reviewed authorization matrix.
- Phase 4 needs the approved custody/address model, verified TRON network and USDT contract, RPC/indexer access, operational confirmation/finality policy, chain reorg and partial/late-payment handling.
- Phase 5 needs a payout provider that supports the intended business, sandbox credentials, bank verification, signed callbacks, UTR support and a funding/reconciliation process.
- Before live release: complete transaction state checks, concurrent balance/limit tests on PostgreSQL, provider outage/replay tests, least-privilege DB roles, backups and restore drills, secrets rotation, authenticated admin access and deployment monitoring. Any applicable operating requirements must be resolved as part of that release work.

These dependencies do not block the completed Phase 2 UI. No real keys, provider calls or money transfers are needed to review this foundation.

## Phase 8 RC1

Release-candidate preparation completed with explicit external blockers. Production certification remains BLOCKED_FOR_PRODUCTION. Next authorized step requires Continue Final Production Setup.
