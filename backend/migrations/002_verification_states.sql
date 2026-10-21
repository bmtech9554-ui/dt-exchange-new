-- Enum additions are committed before Phase 3 tables use them.
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'not_started';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'under_review';
