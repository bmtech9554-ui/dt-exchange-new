# DT Exchange — Home and Manual Deposit UX update

Scope: targeted mobile UI only, based on DT_Exchange_Manual_Android_Release.zip (the latest recoverable source archive). Device-only edits made after that archive are not represented; merge the accompanying patch into any newer local checkout rather than overwriting it.

## Changes

- Home: larger side-by-side Deposit USDT and Sell USDT action cards, mint/aqua and blue/teal surfaces, 22px corners, tap highlight, gentle scale and haptic feedback. Existing routes are preserved.
- One canonical UsdtTokenIcon widget represents the asset on Home, Wallet, Sell, deposit, history and transaction summaries. The DT brand logo is unchanged.
- Rate card: smooth curved gradient line, subtle area/glow, one-second entrance and endpoint reveal. Reduced-motion users get a stable final frame. Sample movement appears only with the preview provider. Connected mode keeps the API rate authoritative and labels its flat line as decorative; no historical prices or percentage movement are manufactured.
- Manual deposit: existing QR/address/copy controls plus inline TxID, paste/clear, positive six-decimal amount validation, private proof selection, thumbnail/file name, replacement/removal and submission summary. The existing file picker provides gallery/files through the device picker. JPG/JPEG/PNG and existing backend-supported PDF are accepted, maximum 5 MB.
- Proof stays local until Submit. The existing authenticated /manual/files upload and /manual/deposits endpoint are used. Upload errors preserve the form. A successfully uploaded proof can be reused on request retry without uploading again.
- Deposit Submitted acknowledges receipt for review, links to authoritative server status, and explicitly states that no balance has been credited.
- Existing more-information/resubmission, optional sender/time/note, receipt viewing and review history remain available.

## Preserved boundaries

No backend, ledger, database migration, admin, infrastructure, provider, rate/fee formula, payout workflow, navigation, Profile or brand-asset changes. User evidence remains unverified. Approval, duplicate TxID protection, audit events, private-file access and atomic ledger posting are still backend responsibilities. There is no optimistic balance mutation.

New widget tests use isolated mock API responses and a local proof image. No external provider actions, real USDT or INR movement, or deployment occurs.

## Validation and previews

See Test_Results.md and validation/ for the actual commands, counts and limitations. The PNG previews are rendered Flutter widgets with explicitly isolated fixture data, not live account evidence or a production acceptance claim.

## Applying to Android Studio

Use the mobile folder from this updated archive, or apply the supplied UI patch to a newer local source checkout. Keep locally configured API URLs and signing material outside the archive. Run flutter pub get, flutter analyze and flutter test before generating a new APK. This UI update does not provide or change production credentials or signing keys.
