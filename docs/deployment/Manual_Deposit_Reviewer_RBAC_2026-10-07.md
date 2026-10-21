# Narrow manual-deposit reviewer access - 7 October 2026

## Implemented production RBAC
The unique active existing operations administrator retains the operations role and now also has the existing manual-deposit-approver role. No admin was created; password and TOTP were not modified. The role contains exactly DEPOSIT_REVIEW and DEPOSIT_APPROVE. The assignment is idempotent and recorded as admin.manual_deposit_role.granted in append-only audit logs.

No schema migration, service deployment, APK rebuild or role-definition change was necessary. Operations role grants are unchanged. No payout, arbitrary ledger, system settings, role-management, Android publication or super-admin permission was added.

DEPOSIT_REVIEW permits viewing manual submissions/private proof and review transitions. DEPOSIT_APPROVE permits only the existing evidenced manual-deposit approval workflow. It retains matching amount/hash/address/network/token/confirmations, account/risk/policy, idempotency, operational and ledger-integrity checks. Synthetic records remain permanently non-creditable. Global transaction execution is still paused; this role assignment does not enable it.

## Validation
28 focused backend tests passed. The new isolated test verifies combined-role permissions, private proof ownership/authentication, receipt/payout/settings denials, synthetic approval denial, rejection audit, duplicate TxID rejection, evidence requirements and correct approval in an isolated test ledger.

Production role grant audit count: 1. API readiness HTTP 200. Ledger journals: 0. Synthetic test access disabled. Manual deposit review/manual payout true; automatic blockchain credit/automatic payout false; global transactions/payouts false. Active Android releases: 0; public APK HTTP 404.

## Interactive acceptance pending
The secure local terminal is open for one existing-admin login using email, hidden password and hidden current TOTP. It does not provision or reset accounts or send SMS. It will check Manual Deposits HTTP 200, synthetic UNDER_REVIEW record, protected proof HTTP 200/anonymous HTTP 401, unrelated permission denials, synthetic approval denial, synthetic-only rejection and its returned audit timeline, then logout. Only non-secret status markers are saved. Do not claim live login/proof/review acceptance until MANUAL_REVIEWER_VALIDATION_COMPLETE is recorded.


## Completed interactive acceptance
Secure terminal status confirms existing admin login HTTP 200, secure session cookie, Manual Deposits HTTP 200, synthetic UNDER_REVIEW amount/TxID visibility, authenticated private proof HTTP 200 and anonymous HTTP 401, payout/settings denials, synthetic approval HTTP 403, audited synthetic rejection with no credit, and logout HTTP 201. MANUAL_REVIEWER_VALIDATION_COMPLETE recorded. No further RBAC changes.
