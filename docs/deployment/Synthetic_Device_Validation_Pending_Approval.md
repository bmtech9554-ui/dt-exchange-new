Superseded by [completed deployment and validation record](Build_8004_Synthetic_Physical_Validation_2026-10-07.md). Owner approved migration/API deployment and the separate release-guard fix.

# Scoped synthetic physical validation

Status: local implementation tested; production rollout awaiting explicit approval.

The existing global TRANSACTIONS_ENABLED=false gate pauses deposit submission. No global gate has been changed.

Prepared a user-ID-scoped, expiring system_settings entry named synthetic_device_validation. It is effective only with both manual modes true, both automated modes false, TRANSACTIONS_ENABLED=false and PAYOUTS_ENABLED=false, and the database safety triggers installed. It does not change production bank verification.

Synthetic submissions are labelled TEST/SYNTHETIC, immediately UNDER_REVIEW, and have a permanent synthetic policy marker. Application and database guards prohibit credit. Synthetic bank fixtures retain UNDER_REVIEW, have a synthetic-nonpayable verification provider, and cannot be verified or used in orders/payouts. Only quotes are permitted during the scoped window.

Migration 013 is additive and has NOT been applied to production. Migrations 001-012 are unchanged. Backend compile and 31 focused tests pass. No Flutter changes or APK rebuild.

Automatic approval review rejected the production backup/migration/build/API restart pending explicit controlled deployment approval. No production deployment or fixture creation occurred.

Phone remains authorized on Build 8004. Public address text and TRON/TRC20 labels are visible; device screencap did not return PNG, so QR decoding from physical screen remains unverified. Do not claim full physical validation. Existing widget tests verify QR payload but do not replace physical decoding.

After approval: deploy backend with encrypted pre-migration backup, apply only migration 013 through official checksum runner, restart API, activate the expiring scope for the authorized test account only, perform synthetic phone checks, inspect scoped admin visibility and zero financial postings, then disable the scope. Keep public download disabled.
