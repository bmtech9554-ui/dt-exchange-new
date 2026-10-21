# Phase 6 — API additions

Base `/api/v1`. User endpoints require the existing Bearer access token unless marked public. Financial endpoints and immutable decimal-string contracts from Phases 3–5 remain unchanged. Bodies reject extra DTO properties. IDs are UUIDs. Errors use `{error:{code,message}, requestId, path}` with safe messages; no raw provider/database exceptions.

## Notifications

| Method | Path | Request / result |
|---|---|---|
| GET | `/notifications?page=1&limit=20` | Array, newest first; limit 1–100; id/type/category/title/body/created_at/read_at/deep_link |
| PATCH | `/notifications/:id/read` | Owner only; `{read:true}` |
| POST | `/notifications/read-all` | `{read:true}` |
| DELETE | `/notifications/:id` | Archive own record |
| GET/PATCH | `/notifications/preferences` | push,email,sms,transactions,security,referrals,support booleans; security=false rejected |
| POST | `/notifications/devices` | `{token,platform:"ANDROID"|"IOS"|"WEB"}` → `{id,platform}`; token never returned |
| DELETE | `/notifications/devices/:id` | Revoke own token |
| GET | `/notifications/announcements` | Active, audience-filtered id/title/message/priority array |

The API retains the original inbox array response rather than breaking Phase 5 clients. Clients advance page when a full page is returned. Deep links are local app paths and new records are restricted to known route families.

## Referrals

`GET /referrals/me` returns `code`, nullable `inviteLink`, `enabled`, `totalReferrals`, `qualifiedReferrals`, `rewardsEarnedMinor` (integer string), rewardType and recent history. Code creation requires active verified eligibility.

`POST /referrals/claim` accepts `{code}` in the pre-order signup window. Registration accepts optional `referralCode`. Claiming and registration are atomic; unknown/self/duplicate/expired campaign claims fail. Reward qualification is worker-only, never a client write endpoint.

## Support

| Method | Path | Body / behavior |
|---|---|---|
| GET | `/support/faq` | Public published FAQ array |
| GET | `/support/tickets?page=1` | Own tickets, 20/page |
| POST | `/support/tickets` | category,subject,message,optional priority/orderId/payoutId; `Idempotency-Key` required |
| GET | `/support/tickets/:id` | Own detail/messages/attachment metadata; internal notes omitted |
| POST | `/support/tickets/:id/replies` | `{message}`, `Idempotency-Key` required |
| POST | `/support/tickets/:id/close` | Close own ticket |
| POST | `/support/tickets/:id/attachments` | `{mimeType,sizeBytes}`; mock returns null uploadUrl and PENDING |
| GET | `/support/attachments/:id` | Owner only; unavailable unless AVAILABLE |

Support categories: ACCOUNT, BANK_ACCOUNT, USDT_DEPOSIT, SELL_ORDER, PAYOUT, TRANSACTION_DELAY, SECURITY, REFERRAL, TECHNICAL_ISSUE, OTHER. Subject 3–160 characters, initial message 10–5000, replies 1–5000. Priority NORMAL/HIGH.

## Settings and security

- `GET /settings`: pinSet, twoFactorEnabled, explicit biometrics/TOTP readiness and preferences.
- `PATCH /settings/preferences`: optional animations/haptics booleans and language=en.
- `POST /settings/pin`: `{password,pin}`; current password and six digits.
- `POST /settings/pin/verify`: `{pin}`; result never grants backend authorization.
- `POST /settings/delete-account`: `{password,reason}` → DEACTIVATED with retention flags only when no outstanding funds/orders.
- `GET /settings/legal/:kind`: public privacy or terms content, UNAVAILABLE until published.
- Existing `/sessions`, `DELETE /sessions/:id`, `/sessions/logout-others`, password and auth logout endpoints remain intact.

## Admin

Existing admin opaque session token; Next.js forwards it through the HttpOnly same-origin BFF. No credentials enter client local storage.

`GET /admin/engagement/:area?page=1&search=&status=` returns at most 50 records. Areas and permission requirements:

| Area | Permission |
|---|---|
| support | support.write |
| faq | support.faq |
| referrals | referrals.read; writes referrals.review |
| rules | referrals.rules |
| notifications | notifications.manage |
| announcements | notifications.publish |
| health | system.monitor |

`GET /admin/engagement/support/:id` returns the private admin thread. `POST /admin/engagement/:area/:id/action` requires action and a 10–500-character audit reason:

- support: reply/note with message; status with allowed status; assign with eligible adminId; escalate.
- faq: save with question,answer,category,published,sortOrder. New records use a client-generated UUID.
- referrals: reject only unrewarded referrals; no manual monetary award.
- rules: save with `{rules:{enabled,rewardType:"FIXED_INR",rewardAmountMinor,minimumCompletedMinor,maximumRewards,startsAt,endsAt}}`. Monetary values must be integer strings.
- notifications: retry eligible FAILED delivery with fewer than five attempts; send with title,message,userIds (1–100 active users). Reusing the same command UUID deduplicates per-user notifications.
- announcements: save with title,message,audience,userIds,startsAt,endsAt,priority,published. Specific audience limit 100; broad audiences are in-app pull announcements.

Health/queue admin records expose operational metadata and bounded metrics, not bank numbers, device tokens or secrets.

## Health

Outside the API prefix: `GET /health`, `/health/live`, `/health/ready`. Liveness checks process availability. Readiness checks migration/database, configured Redis/queue access and optional/production-required fresh worker heartbeats. It does not claim a successful live vendor transaction. External provider acceptance must be verified in staging. Public errors are sanitized.
