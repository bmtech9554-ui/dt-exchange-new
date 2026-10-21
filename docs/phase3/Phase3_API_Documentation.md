# DT Exchange Phase 3 API

Base path: `/api/v1`. JSON only. Dates are UTC ISO 8601. Money is returned as decimal strings or integer strings, never authoritative floating-point values. TLS is required for a release client. No blockchain custody, deposit acceptance or payout execution endpoint is exposed.

## Authentication

Access JWT: RS256, issuer `dt-exchange`, audience `dt-mobile`, 10-minute validity. Refresh tokens: 256 random bits, HMAC digest in `sessions`, 30-day absolute family lifetime. Every rotation creates a successor row; replay of a rotated token revokes the family. Protected requests also check the live database session and account status. Refresh tokens belong in OS secure storage; access tokens stay in memory. Flutter serializes refresh requests and retries a protected request once after a 401.

| Method and path | Input | Result |
|---|---|---|
| POST `/auth/register` | `fullName`, `email`, E.164 `mobile`, `password`, `termsAccepted:true` | OTP challenge for email; pending user created |
| POST `/auth/login` | `contact`, `password`, `deviceId`, optional `deviceLabel` | Token pair |
| POST `/auth/request-otp` | `contact`, `purpose`: `register`, `login`, `reset` | Challenge ID, expiry, resend cooldown |
| POST `/auth/verify-otp` | `challengeId`, six-digit `code`, `deviceId`, optional `deviceLabel` | Token pair; reset-purpose returns a short-lived `resetToken` |
| POST `/auth/refresh` | `refreshToken` | Rotated token pair |
| POST `/auth/forgot-password` | `contact` | Reset-purpose challenge; generic response for unknown/ineligible contacts |
| POST `/auth/reset-password` | `resetToken`, `password` | Consumes grant, changes password, revokes all sessions |
| POST `/auth/change-password` | `currentPassword`, `password` | Changes password, revokes all sessions; authenticated |
| POST `/auth/logout` | No body | Revokes current device family |
| POST `/auth/logout-all` | No body | Revokes all user sessions |
| POST `/auth/contact/request-otp` | `contact` belonging to signed-in user | Challenge to verify an additional contact |
| POST `/auth/contact/verify-otp` | Same OTP fields | Confirms contact; requires the challenge owner's active session |
| GET `/sessions` | — | Active device sessions; `current` flag |
| DELETE `/sessions/:id` | Owned session UUID | Revokes that device family |
| POST `/sessions/logout-others` | — | Retains current family, revokes others |

Passwords: 12–128 characters for registration/change/reset; salted scrypt N=131072, r=8, p=1. OTPs: cryptographically random six digits, five-minute expiry, at most five attempts, 60-second destination cooldown, destination/IP quotas. Wrong attempts commit even when verification fails. Consumed, expired or locked challenges cannot issue tokens. Reset grants are random, hashed, single use, five minutes.

Registration initially verifies email. The onboarding **Verify mobile for sign-in** action verifies the registered mobile using an authenticated OTP challenge. A mobile/email cannot be used for login or recovery until that contact has been verified. Supplying another user's contact to this authenticated flow cannot grant access to that account.

`OTP_PROVIDER=dev` is the local delivery adapter. Its temporary inbox stores encrypted values. `DEV_OTP_EXPOSE=true` explicitly includes `developmentOtp` in development challenge responses and displays it in the development UI; **never enable it in production**. Production startup rejects dev/mock adapters and exposed codes. Replace the `OtpProvider` DI binding with an audited SMS/email adapter before production. Provider credentials must be read from environment/secret management by that adapter; none are embedded here.

## Accounts and required verification

`GET /users/me` returns `id`, `fullName`, `email`, `mobile`, `accountStatus`, `verificationStatus`, `verificationBadge`, `createdAt`, `emailVerified`, `mobileVerified`. No password hashes, token hashes or full bank numbers are returned. ACTIVE, FROZEN, SUSPENDED and DISABLED map to the existing account enum (`closed` → DISABLED); pending is the internal pre-activation state. The Profile displays only Verified/Verification Required.

| Method and path | Input / behavior |
|---|---|
| GET `/verification/status` | Account state, required types and owned records |
| POST `/verification/start` | Empty object plus `Idempotency-Key`; creates/reuses pending review workflow |
| POST `/verification/submit` | `verificationId` plus `Idempotency-Key`; obtains the adapter's decision |

Provider port supports identity, PAN, document, selfie/face, bank and risk checks. The user cannot submit an approval status. Required activation checks are identity, PAN, document, selfie and risk; all must be verified. Production hosted document collection, signed callbacks and private object-storage uploads are adapter work, not fake implementations. Existing document/admin-review tables remain available. Mock records carry `provider=development_mock` and `metadata.sandbox=true`; `MOCK_VERIFICATION_DECISION=under_review` is the safe default. `verified`/`rejected` may be selected only by local developer configuration. The production adapter is deliberately unavailable until integrated.

Verification API states include NOT_STARTED, REQUIRED, PENDING, UNDER_REVIEW, VERIFIED, REJECTED; existing EXPIRED records are retained for historical compatibility. The normal UI reduces these to its two approved badges.

## Banks

All endpoints require a live user session. Ownership is enforced in SQL, including set-default and disable actions. Cross-user reads return 404. Account number and holder name are AES-256-GCM encrypted with per-record associated data. Deduplication uses an HMAC fingerprint. Normal responses expose only `XXXXXX` plus the last four digits.

| Method and path | Input / behavior |
|---|---|
| GET `/bank-accounts` | Active owned accounts |
| POST `/bank-accounts` | `accountHolderName`, `accountNumber` (9–18 digits), uppercase `ifsc`, `bankName`, optional `branch`; `Idempotency-Key` required |
| GET `/bank-accounts/:id` | Owned account |
| PATCH `/bank-accounts/:id/default` | Only verified active accounts may be default |
| DELETE `/bank-accounts/:id` | Soft-disable; choose another verified default when available |

At most five active banks. Immutable beneficiary identity from Phase 1 is retained. The mock bank adapter does not perform a real penny drop or account-name match. A production bank-verification adapter must do those checks before returning VERIFIED.

## Rates, fees and limits

`GET /rates/usdt-inr` returns `marketRate` (null for operator-manual mode), `exchangeRate`, `marginBps`, `spreadBps`, `fixedFeeInrMinor`, `feeBasisPoints`, `source`, `timestamp`, `validUntil`, `sandbox`, minimum/maximum sell and daily/monthly limits.

Modes reuse the existing enum: manual, market, market_plus_margin, market_minus_margin. Manual rate comes from a versioned `rate_policies` record. Other modes use `RateProvider`; `MockRateProvider` is explicit local data. A missing policy, unavailable provider, stale timestamp or invalid rate fails closed. No public endpoint can change a rate or fee policy.

Exact arithmetic:

- USDT has six supported decimal places; rate has eight. Convert both to integer units.
- Apply plus/minus margin in basis points, then reduce by spread; round effective rate down to eight decimals.
- Gross INR minor units = floor(USDT units × rate units / 10^12).
- Percentage fee = ceil(gross minor × fee basis points / 10000).
- Total fee = fixed fee minor + percentage fee. Final INR = gross − total fee; must be positive.

Policies and fee terms are versioned and immutable except retirement timestamp. Configure new versions through a trusted operator migration/script; Phase 7 will provide admin controls. Do not edit historical snapshots. Account-specific `user_limits` may tighten but never loosen global limits. Unverified, inactive or high/critical-risk accounts cannot create quotes. Daily/monthly periods use Asia/Kolkata. Accepted non-cancelled/non-expired/non-failed orders and currently ACTIVE unexpired quotes count toward usage. Active quotes reserve limit capacity temporarily; cancellation/expiry releases it. User-row locks serialize quote creation. Phase 4 execution must retain the same lock discipline and recheck eligibility/limits before accepting an order.

## Quotes

`POST /sell/quote`, authenticated, with an `Idempotency-Key` (16–128 letters/digits/underscore/hyphen):

```json
{"amountUsdt":"100","bankAccountId":"optional-owned-verified-bank-uuid"}
```

Omit bankAccountId to use the default verified bank. Extra frontend INR/fee/rate fields are rejected by DTO validation.

Example with the development rate and 0.50% fee:

```json
{
  "quoteId":"server-generated-uuid",
  "amountUsdt":"100.000000000000000000",
  "marketRate":"92.45000000",
  "exchangeRate":"92.45000000",
  "feeInrMinor":"4623",
  "finalInrMinor":"919877",
  "fee":"46.23",
  "finalInr":"9198.77",
  "bankAccountId":"owned-bank-uuid",
  "createdAt":"2026-09-20T12:00:00.000Z",
  "expiresAt":"2026-09-20T12:01:30.000Z",
  "status":"ACTIVE",
  "executionEnabled":false,
  "sandbox":true
}
```

`GET /sell/quote/:id` returns current lifecycle, deriving EXPIRED when its server expiry passes. `DELETE /sell/quote/:id` cancels an owned active quote. Financial columns remain append-only. `quote_states` stores the separate lifecycle. The order-acceptance database trigger consumes ACTIVE → USED atomically, rejects expired/cancelled/used quotes and checks user/bank eligibility. **There is no public order-acceptance, transfer or payout endpoint in Phase 3.**

The same idempotency key/input returns the original response; changed input returns 409. Replayed responses retain their original expiry—always check `expiresAt` or GET the current quote. Keys are user/scope-specific; encrypted response snapshots and financial dedupe records are not automatically deleted.

## Errors and operations

Errors are bounded JSON: `error.code`, safe `error.message`, request ID and path. Validation 400, authentication 401, eligibility 403, missing owned resource 404, conflict 409, rate limit 429, unavailable provider/database 503. Database exceptions, credentials and stacks are not returned. Logs contain method/status/request ID, not bodies/tokens/PII. Audit history is append-only. Global IP quotas and tighter auth/OTP/quote quotas use shared PostgreSQL counters, not per-process memory. Untrusted forwarded IP headers are not used; configure ingress-level limits and a reviewed proxy trust policy before deployment.

`GET /health/live` and `/health/ready` remain outside `/api/v1`. Ready checks migration 003; this is database readiness, not approval to trade. Redis/BullMQ are preserved for later workers; no fake workers or money-moving processes start. Do not delete active refresh lineage or financial idempotency records during retention maintenance.
