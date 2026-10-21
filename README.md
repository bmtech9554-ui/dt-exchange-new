# Mobile UI and Manual Deposit UX refresh

For the current recovered source, completed fixes, test results and outstanding release gates, read [Current handover — 20 October 2026](docs/CURRENT_HANDOVER.md). The phase and release reports below describe historical milestones.

Larger Home actions, a canonical USDT icon, an animated rate card and inline manual deposit evidence form are implemented. See [implementation](docs/ui-ux-update/Implementation_Summary.md), [tests](docs/ui-ux-update/Test_Results.md) and [previews](docs/ui-ux-update/previews/). Production financial infrastructure and approval requirements are unchanged.

---

# DT Exchange · Final Production Setup

**BLOCKED_FOR_PRODUCTION**. Available local validation: 149 backend tests, 260 Flutter tests and 12 admin checks; analysis and web/admin builds pass. Live credentials/infrastructure/signing and external approvals are still required. No production deployment or real transfer occurred.

Read [setup summary](docs/final/Final_Production_Setup_Summary.md), [required inputs](docs/final/Final_Inputs_Required.md), [configuration checklist](docs/final/Final_Configuration_Checklist.md), [blockers](docs/final/Final_Production_Blockers.md) and [test results](docs/final/Final_Test_Results.md). Final setup stops here pending those inputs; live cutover requires separate explicit authorization.

## Preserved prior phase notes

# DT Exchange · Phase 7

**Sell USDT. Receive INR.**

Phase 7 production preparation extends the approved Phase 6 codebase. See [implementation](docs/phase7/Phase7_Implementation_Summary.md), [deployment guide](docs/phase7/Phase7_Deployment_Guide.md), [security review](docs/phase7/Phase7_Security_Audit.md), [release checklist](docs/phase7/Phase7_Release_Checklist.md) and [test results](docs/phase7/Phase7_Test_Results.md).

Production startup fails closed until reviewed real provider adapters are registered. No live funds or production deployment were used. Available validation: backend 126/126; Flutter 255 tests and zero analysis issues; admin 12 tests; backend/admin/web builds pass. Native SDKs, live PostgreSQL/Redis, provider sandboxes and restore drills remain external release gates.

**Phase 7 stops here. Await “Continue Phase 8”.**

---

## Preserved historical delivery notes

# DT Exchange

**Sell USDT. Receive INR.**

Phase 6 adds API-connected notifications, referrals, support, settings and permission-controlled engagement admin screens. The existing financial lifecycle and approved visual system are preserved. External delivery/storage remain explicit adapters with development mocks; no production deployment occurred.

See [implementation](docs/phase6/Phase6_Implementation_Summary.md), [API](docs/phase6/Phase6_API_Documentation.md), [hardening](docs/phase6/Phase6_Production_Hardening.md) and [test results](docs/phase6/Phase6_Test_Results.md). Run migration 006, the Phase 6 seed and the engagement worker as documented. Campaigns default disabled; admin role grants are explicit.

**Phase 6 stops here. Await “Continue Phase 7”.**

---

## Historical foundation documentation

Phase 4 extends the existing Flutter/NestJS/PostgreSQL/Next.js foundation with USDT order creation, provider-based deposit tracking, confirmation checks, immutable ledger posting, Flutter tracking/history and permission-controlled admin monitoring. The approved white, mint, teal, blue and navy design remains fixed.

Confirmed funds stop at **READY_FOR_PAYOUT**. No INR payout execution or wallet private-key custody is implemented. The default chain is an isolated non-payable development mock; the read-only real provider and custody gateway interfaces require external configuration and acceptance validation.

See [Phase 4 implementation and setup](docs/phase4/Phase4_Implementation_Summary.md), [blockchain architecture](docs/phase4/Phase4_Blockchain_Architecture.md), [API documentation](docs/phase4/Phase4_API_Documentation.md), and [test results](docs/phase4/Phase4_Test_Results.md). These supersede historical operational-status notes below. Phase 5 has not started.

## Included

| Area         | Current deliverable                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Architecture | Domain boundaries, provider ports, funding modes, financial invariants, state model and API conventions                 |
| PostgreSQL   | Phase 1 schema plus additive Phase 3–4 migrations; immutable money snapshots retained              |
| Backend      | Phase 3 foundation plus Phase 4 orders, chain workers, ledger and history       |
| Mobile       | Approved screens connected through Phase 4; isolated preview retained |
| Admin        | Existing Next.js shell plus deposits/orders/detail/manual-review monitoring                                   |
| Brand        | Original vector DT monogram and shared design tokens with generation/drift check                                        |
| Local setup  | Environment template, random development credential generator, PostgreSQL/Redis Compose foundation                      |

## Project map

| Directory  | Responsibility                                                                          |
| ---------- | --------------------------------------------------------------------------------------- |
| `mobile/`  | Flutter source, connected mobile UI, tests and Android/iOS/web hosts      |
| `backend/` | NestJS API boundaries, PostgreSQL migration, seeds, provider contracts and schema tests |
| `admin/`   | Next.js admin navigation shell and design foundation                                    |
| `docs/`    | Architecture, database guide, design system, roadmap and validation record              |
| `docker/`  | Local PostgreSQL/Redis services; deployment boundary for Phase 8                        |
| `brand/`   | Canonical original DT monogram SVG                                                      |
| `scripts/` | Shared token generation and local setup                                                 |

## Start the web foundation

Requires Node.js 24 LTS (24.19.0 used during validation), npm and a modern browser.

```sh
npm ci
npm run dev:admin
```

Open `http://localhost:3000`. The root page is the design gallery. Orders and deposits have authenticated Phase 4 monitoring; other modules retain their clearly labelled foundation placeholders. The phone inside the gallery is a web component preview, not a Flutter emulator. Mobile code is in `mobile/`.

In another terminal:

```sh
npm run build --workspace @dt/backend
npm run start --workspace @dt/backend
```

The API binds to `127.0.0.1:4000` by default. `GET /health/live` returns 200. Without a migrated PostgreSQL database, `GET /health/ready` returns 503. Health readiness currently covers the foundation database only; Redis/BullMQ workers are not connected in Phase 1.

For database setup, follow [docker/README.md](docker/README.md). Financial feature flags must remain false.

## Start Flutter

See [mobile/README.md](mobile/README.md) for the SDK, host platform setup and commands. Run `flutter run -t lib/main_preview.dart` from `mobile/` to explore the complete UI. All account and financial interactions are simulated. See [Phase 2 implementation](docs/phase2/IMPLEMENTATION.md) and [Phase 2 results](docs/phase2/TEST_RESULTS.md).

## Checks

```sh
npm run tokens:check
npm run typecheck
npm test
npm run build
```

The SQL suite runs in PGlite (PostgreSQL in WebAssembly) and exercises constraints with synthetic fixtures. PostgreSQL server concurrency, provider integration, device signing, operational security and deployment are later release gates, not established by this suite. See [docs/VALIDATION.md](docs/VALIDATION.md) for actual results and limitations.

## Continue

**Phase 2 stops here.** The next instruction is **“Continue Phase 3”**. Subsequent work must preserve this schema baseline, module boundaries and design system. Start with [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Phase 8 RC1

Version 1.0.0-rc.1; mobile 1.0.0+8001. Certification: **BLOCKED_FOR_PRODUCTION**. See [Phase 8 implementation](docs/phase8/Phase8_Implementation_Summary.md), [release certification](docs/phase8/Phase8_Release_Certification.md) and [handover](docs/phase8/Phase8_Developer_DevOps_Handover.md). No production deployment or real transfers were performed. Await Continue Final Production Setup.

## Initial manual Android release

The current operating profile is documented in [Manual Operations](docs/manual/Manual_Operations_Implementation.md). It adds manual TRC20 proof review, ledger-funded sales, evidenced manual INR settlement, private receipts and signed Android APK distribution through the official website. Automatic provider ports remain available for future use. See [current blockers](docs/manual/Updated_Production_Blockers.md); this profile is **BLOCKED_FOR_PRODUCTION** until external acceptance is complete. Play/iOS stores and automatic financial providers are future requirements for this initial manual release.
