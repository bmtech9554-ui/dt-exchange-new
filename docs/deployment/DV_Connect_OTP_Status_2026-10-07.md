# DV Connect OTP integration — 2026-10-07

Status: BLOCKED_ON_PROVIDER_CONTRACT_AND_SESSION_ACCESS. No production adapter or whitelist change deployed.

## Inspection

Current NestJS provider binding is BlackSMS, not DV Connect. It must not be relabeled or pointed at a guessed DV Connect endpoint. The existing service owns cryptographic OTP generation, hashed challenge storage, five-minute expiry, 60-second resend cooldown, per-IP/destination limits, failed-attempt limits, and single-use verification. No authentication redesign is needed.

DV Connect public OTP product documentation (https://dvconnect.in/otp-sms.php) identifies API-key authentication and predefined OTP templates, but does not specify the exact endpoint, request fields, or success/failure response contract. Account Setup Guide must supply these before implementation. No API key was requested in chat.

Computer Use browser runtime failed twice at initialization. Installed agent-browser --auto-connect found no accessible Chrome instance. The authenticated Setup Guide and IP Whitelist therefore remain uninspected. The Setup Guide URL or redacted API documentation has been requested.

## Local safeguards completed

- Canonicalize India phone formats before contact lookup and OTP rate-limit hashing; registration DTO applies the same normalization.
- Explicit production response guard prevents any provider development-inbox access/code disclosure.
- Provider delivery failures consume the challenge and return a generic error without upstream details.
- Added normalization, malformed-input, production-code-disclosure, failure-consumption and rate-limit regression tests.

## Production observation

Strict SSH confirmed KEY_ACCESS_OK. Web/PostgreSQL/Redis containers healthy. API readiness returned 503 behind the existing maintenance gate. No runtime configuration changed.

## JeetMax preservation

No JeetMax source, backend, settings, API keys, credits or whitelist entries were modified. Existing delivery was not independently tested. Future whitelist change must append 172.86.81.233 only if missing; never replace existing entries, reset service, rotate key or buy credits.

## Next steps

1. Read authenticated Setup Guide and verify exact HTTPS endpoint, authentication placement, parameters, template/sender requirements and acceptance response.
2. Add a dedicated DV Connect backend adapter and mocked transport tests; select it explicitly in production startup capabilities and secret-file loader.
3. Store credentials exclusively in protected VPS configuration through the existing secure terminal mechanism.
4. Append VPS whitelist entry alongside JeetMax; validate unchanged existing entries.
5. Re-evaluate all genuine startup dependencies and deploy behind the maintenance gate before activation.
6. Ask for one authorized test mobile number only when ready; send exactly one controlled OTP. Enter the received code privately for verification, without emitting it into chat/logs.

Financial manual-mode flags unchanged; no financial execution or APK publication.

## Documentation inspected after Setup Guide URL was supplied

Index: https://blog.dvhosting.in/blog-list?category_id=34
Original guide: https://blog.dvhosting.in/blog/how-to-setup-otp-sms
- Documents HTTPS GET https://otp.dvconnect.in/api-sms-v1.php with api_key, number and otp.
- Does not list sender/template parameters or a successful response contract.
- Example disables certificate verification; DT Exchange must not copy that setting.
- An unauthenticated request with no key, destination or OTP returned Missing Parameters. No SMS was sent; this does not validate successful delivery.

Migration guide: https://blog.dvhosting.in/blog/how-to-replace-fast2sms-1
- Distinguishes accounts purchased after 1 March 2025.
- Documents https://dvhosting.in/api-sms-v4.php for query-string authorization and https://dvhosting.in/api-sms-v5.php for header authorization, as Fast2SMS bulkV2 replacements.
- The current Fast2SMS managed-OTP send/verify API is a different contract and must not be substituted for this documented bulkV2 compatibility route.

Remaining required nonsecret input: the endpoint assigned to the existing DV Connect service or currently used by JeetMax, without credentials/query strings, plus the account-specific acceptance response contract. Do not guess account version or infer success from HTTP 200. No runtime provider binding, whitelist entry, credentials or JeetMax configuration changed in this documentation step.

## Confirmed v1 transport implemented

User confirmed https://otp.dvconnect.in/api-sms-v1.php. Added backend-only dvconnect-otp.transport.ts with exact documented query parameter names, single-recipient India number validation, URL encoding, TLS verification, redirects disabled, 10-second timeout, no automatic retry, no logging, sanitized errors and an 8 KiB response limit. Added DVCONNECT_API_KEY_FILE support to the existing secret loader. No credential values are in source.

The transport deliberately returns a bounded response to an acceptance parser; it is not registered as a working OtpProvider. Successful response semantics are still undocumented. Production capability gate remains closed for dvconnect until that parser is implemented and validated. This prevents HTTP 200 error messages from being recorded as sent. Asked for a redacted acceptance-response example. No changes to JeetMax, whitelist, credentials, credits or production configuration; no SMS sent.

## One controlled live request and response contract

Exactly one authorized SMS request was made from the VPS, with verified TLS and redirects/retries disabled. Recipient was shown only as ending 4012. Provider HTTP status: 200. The response contained return=true, a positive numeric request_id, and message=["Message sent successfully"]. Raw status/body captured encrypted on VPS; no API key or OTP emitted. User confirmed receipt. An exclusive attempt marker prevents accidental rerun.

Added DvConnectOtpProvider with strict observed-response validation. Unknown bodies, false/string return values, missing or differently typed request IDs, and unexpected messages fail closed. Auth module and manual capability validation now recognize dvconnect explicitly. Existing BlackSMS adapter retained for compatibility; no JeetMax code/configuration was accessed or changed.

Backend validation: 189 tests passed. Provider acceptance and handset receipt are verified; full DT Exchange registration/login verification was NOT exercised by this standalone provider probe. No second SMS is authorized. Production runtime has not been activated in this test step. Whitelist was not inspected or modified; the successful VPS request establishes that the provider allowed this request from the VPS, not that a particular whitelist entry exists.
