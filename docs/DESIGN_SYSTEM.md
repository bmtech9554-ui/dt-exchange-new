# DT Exchange design system · v1

Canonical values are in `design-tokens.json`. Run `npm run tokens` to produce Flutter constants and CSS variables; `npm run tokens:check` detects divergence. This design carries forward unchanged into every phase.

| Token        | Value               | Use                                |
| ------------ | ------------------- | ---------------------------------- |
| White        | `#FFFFFF`           | Primary surfaces, splash           |
| Background   | `#F7F9FC`           | Page canvas                        |
| Navy         | `#081B3A`           | Main text, CTA labels              |
| Mint         | `#20DDA5`           | Identity accents                   |
| Emerald      | `#06BC83`           | Primary emphasis                   |
| Teal         | `#18C7BA`           | Identity gradient                  |
| Aqua         | `#41D9E7`           | Supporting decoration              |
| Blue         | `#3D6FF5`           | Focus and accent                   |
| Soft Blue    | `#EDF4FF`           | Supporting cards                   |
| Soft Mint    | `#EAFEF6`           | Selected states, positive surfaces |
| CTA gradient | `#28E3AE → #06B980` | Primary actions                    |

Cards use 24px corners; compact surfaces use 20px; controls use 16px. Spacing follows 4/8/12/16/20/24/32/40/48/64. Body text is navy or muted slate, with dark green/blue for status text. Keep mint decorative or behind dark labels; white text on pale mint is not the default.

Typography uses a clean system sans-serif fallback now, with Inter as the preferred family when a locally bundled licensed font is supplied. No runtime remote font fetch is required. Display 40, headings 28, titles 20, body 16 and captions 13 are the baseline; support device text scaling. The HTML phone is a scaled component illustration, not a specification of literal mobile font sizes.

`brand/dt-monogram.svg` is an original connected D/T mark. The rounded D loop shares a stroke with the T stem, with a navy → teal → mint gradient. The SVG is scalable, transparent and included in both clients. Launcher bitmap generation and native launch screens are Phase 2 tasks; do not treat the default platform launcher as the final identity.

## Components present

| Flutter           | Admin React    | Purpose                               |
| ----------------- | -------------- | ------------------------------------- |
| DtLogo            | Monogram asset | Identity                              |
| DtCard            | Card           | Surface                               |
| DtButton          | Button         | Primary/secondary/destructive actions |
| DtField           | Field          | Labelled input                        |
| DtStatusBadge     | Status / Badge | Explicit text status                  |
| DtEmptyState      | EmptyState     | Honest no-data state                  |
| DtSkeleton        | Skeleton       | Loading state                         |
| DtStepProgress    | StepProgress   | Step indicators                       |
| DtReveal          | CSS reveal     | Entrance motion                       |
| DtNavigationShell | AdminShell     | Stable navigation                     |

Animations use 120ms press, 240ms standard transitions and 360ms entrance reveal, with opacity/transform changes and reduced-motion support. Flutter respects `MediaQuery.disableAnimations`; web respects `prefers-reduced-motion`. No 60 FPS guarantee is made before profiling on physical devices. Count-up, rate changes, QR reveal, copy success and the final success animation are implemented with their screens in later phases. The web gallery already demonstrates copy success, button state and a four-step progress preview.

## Locked information architecture

Main mobile tabs: **Home / Wallet / History / Profile**. Sell is accessible inside Home and Wallet only.

Profile: User Details Card, Bank Accounts, Referral Program, Settings, Logout; footer DT Exchange v1.0. Account status is Verified or Verification Required and is shown only from real account state. Never fabricate a Verified badge in an unauthenticated shell.

No crypto card, KYC/PAN/identity/selfie verification menu or separate Security menu. Verification is an account activation/transaction flow. Settings owns password, PIN, biometrics, 2FA, devices, notifications, privacy, terms, help, delete account and preferences.
