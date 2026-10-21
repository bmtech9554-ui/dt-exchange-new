# Manual operations security

## Controls implemented

- Separate DEPOSIT_REVIEW, DEPOSIT_APPROVE, PAYOUT_VIEW, PAYOUT_PROCESS, PAYOUT_CONFIRM and FINANCIAL_ADMIN permissions. Migration creates roles but assigns no users. Support-only roles do not inherit financial approval or full-bank access.
- Admin authentication uses existing expiring sessions. Admin BFF keeps tokens in HttpOnly, secure-in-production, SameSite cookies and validates mutation origin. User files and receipts require bearer authentication and ownership checks.
- Evidence is stored as AES-GCM encrypted bytes in PostgreSQL under the existing external data-encryption key, with content type, size and SHA-256. Maximum 5 MB; JPG/PNG/PDF magic bytes and MIME must agree. Receipt access has no permanent public URL. Downloads use no-store responses.
- Images display only after authorization; PDF receipts are saved through the device file chooser. Treat all uploaded evidence as untrusted content. Signature checking is not a malware scan; document-viewing software and operational malware controls remain required.
- Sensitive bank reveal and private file access are audited. Manual transitions append actor, user, entity, previous/new status, timestamp and note. Existing ledger and audit append-only protections remain. Session context remains in existing admin session/login records; these additions do not claim new IP-geolocation evidence.
- BigInt/NUMERIC calculations, row locks, unique constraints, immutable quote/order values and idempotent journals protect financial operations. PGlite tests are not a substitute for live PostgreSQL concurrency validation.
- Automatic credit and payout submission are disabled in manual mode. Mock provider ports are preserved for development and remain forbidden in production. No raw custody key is required or stored by this update.
- Signed APK metadata is accepted only with an externally signed Ed25519 attestation, exact HTTPS host allowlist, artifact hash, release certificate hash and monotonically increasing version codes. Build verification checks APK signature, identity, version and non-debuggable manifest before attesting it.

## Residual operational risks / release gate

An authorized operator can misread blockchain evidence or an external bank transaction. Manual approval is not mathematical proof that an external event happened. Train operators, independently reconcile business-bank statements and blockchain records daily, and use organizational separation of duties for high-value transfers. Never treat a screenshot as authoritative.

Review production role assignments, minimum confirmations, limits, bank cooling period, custody ownership, backup encryption and encryption-key recovery before cutover. Production secrets, domain ownership, TLS, live database/Redis, restore drill, signed APK and required provider/compliance acceptance remain unvalidated.

No production credential, keystore or private signing key is included. Secret scans are pattern-based and do not certify unseen Git history or unknown secrets embedded in arbitrary images. This is technical evidence, not legal approval.
