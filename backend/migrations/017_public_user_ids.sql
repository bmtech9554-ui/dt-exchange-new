-- Stable public identities are independent of internal UUID relationships.
-- Migration runner executes this in one transaction; block registrations while
-- backfilling in registration order so two allocators cannot race.
LOCK TABLE users IN ACCESS EXCLUSIVE MODE;
CREATE SEQUENCE public_user_id_sequence AS bigint START WITH 1000 MINVALUE 1000 NO CYCLE;
ALTER TABLE users ADD COLUMN public_user_id bigint;
WITH ordered AS (
 SELECT id, row_number() OVER (ORDER BY created_at,id)+999 AS number FROM users
) UPDATE users u SET public_user_id=o.number FROM ordered o WHERE o.id=u.id;
SELECT setval('public_user_id_sequence',coalesce((SELECT max(public_user_id)+1 FROM users),1000),false);
ALTER TABLE users ALTER COLUMN public_user_id SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_public_user_id_unique UNIQUE(public_user_id);
ALTER TABLE users ADD CONSTRAINT users_public_user_id_range CHECK(public_user_id>=1000);
CREATE FUNCTION assign_public_user_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.public_user_id IS NOT NULL THEN RAISE EXCEPTION 'Public user IDs are server allocated'; END IF;
  NEW.public_user_id=nextval('public_user_id_sequence');
 ELSIF NEW.public_user_id IS DISTINCT FROM OLD.public_user_id THEN
  RAISE EXCEPTION 'Public user ID is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER public_user_id_guard BEFORE INSERT OR UPDATE OF public_user_id ON users
 FOR EACH ROW EXECUTE FUNCTION assign_public_user_id();
-- The sequence is intentionally not owned by a row and is never reset on deletion.
