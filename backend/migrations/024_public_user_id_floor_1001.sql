-- Preserve all existing public IDs; only future registrations use 1001 or higher.
-- Run with the normal transactional migration runner. Lock registrations while
-- adjusting the sequence so concurrent signups cannot allocate the old floor.
LOCK TABLE users IN ACCESS EXCLUSIVE MODE;
SELECT setval(
  'public_user_id_sequence',
  GREATEST(
    1001::bigint,
    COALESCE((SELECT MAX(public_user_id) + 1 FROM users), 1001::bigint)
  ),
  false
);
-- Existing IDs, including any historical 1000, are never renumbered.
