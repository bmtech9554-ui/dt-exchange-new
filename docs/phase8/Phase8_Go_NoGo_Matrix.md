# Launch go / no-go matrix

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

Overall: **NO-GO / BLOCKED_FOR_PRODUCTION**. PASS is scoped to the stated evidence.

| Area | Status | Evidence / limitation |
|---|---|---|
| Backend | PASS | Local SQL/Nest tests and TypeScript build; not live deployment |
| Flutter | PASS | Local analysis/tests and web build; native listed separately |
| Admin | PASS | 12 SSR/BFF checks and Next build; browser interaction remains manual |
| Database | BLOCKED | Live PostgreSQL acceptance absent |
| Redis | BLOCKED | Live Redis recovery/TLS acceptance absent |
| Blockchain | BLOCKED | Mock fixture only; real adapter endpoint unvalidated |
| Payout | BLOCKED | Mock adapter only; no real vendor adapter |
| KYC / bank verification | BLOCKED | Mock adapters only |
| Notifications / storage | BLOCKED | Production delivery/storage adapters absent |
| Security | BLOCKED | Local checks pass; high external acceptance gaps remain |
| Backups | BLOCKED | Restore/PITR not performed |
| Monitoring / domains | BLOCKED | No deployed alert or TLS evidence |
| Android | BLOCKED | SDK/signing/device acceptance absent |
| iOS | BLOCKED | Mac/Xcode/signing absent |
| Compliance configuration | MANUAL_VERIFICATION_REQUIRED | Organization/legal owner must approve |
| Real-money automated tests | NOT_REQUIRED | Prohibited in this phase |

No missing external validation is waived by local tests. Release operator and accountable business owner must review the complete matrix before a separately authorized launch.
