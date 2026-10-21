# DT Exchange implementation contract

Read README.md, docs/ARCHITECTURE.md and docs/ROADMAP.md before extending this project.

- Implement only the phase authorized by the user. Final Production Setup local preparation is implemented with BLOCKED_FOR_PRODUCTION status. Read docs/final for required inputs. Do not deploy production or enable financial activity without explicit controlled-cutover authorization.
- Keep the white / mint / teal / soft blue / navy design. docs/design-tokens.json is canonical. Run `npm run tokens` after an authorized token change; never independently change generated Flutter and CSS token values.
- Mobile uses Flutter, Riverpod, Dio, GoRouter and Flutter Secure Storage. The admin uses Next.js. NestJS owns all business writes.
- Bottom navigation is exactly Home, Wallet, History, Profile. Sell is an action inside Home/Wallet, never a fifth tab.
- Profile menu is User Details, Bank Accounts, Referral Program, Settings, Logout. Verification is onboarding or pre-transaction; no crypto-card, KYC/PAN/selfie menu or separate security section.
- No fake live rates, fake balances, fake successful payments or demo routes in production.
- Use decimal strings / integer strings across API boundaries. PostgreSQL ledger journals balance separately per asset. Do not use binary floating point for monetary calculations.
- Never amend an applied SQL migration. Add a numbered migration after this Phase 1 baseline is delivered.
- Preserve accepted quotes, permanent financial idempotency, immutable beneficiary terms, append-only journals and audit records. A user's “I have sent” action cannot credit funds.
- Provider adapters are ports until their authorized phase. Never store blockchain private keys in this repository or application database.
- When reporting completion, distinguish compiled/tested behavior from stubs and untested deployment targets.

- Final approved logo: docs/brand/FINAL_LOGO.md and Approved_Reference.jpeg; use the canonical mint/teal D + blue T vector consistently.
