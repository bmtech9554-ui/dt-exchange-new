-- Include the canonical permission definitions absent from migration-only installs.
INSERT INTO admin_permissions(code,description) VALUES
 ('orders.read','Read orders'),
 ('deposits.read','Read blockchain deposit evidence'),
 ('reviews.read','Read transaction review queue'),
 ('reviews.acknowledge','Acknowledge a review with a reason; cannot credit funds')
ON CONFLICT (code) DO NOTHING;
-- Production installations apply migrations without development/reference seeding.
-- Restore only the canonical standard-operations role and its existing narrow grants.
INSERT INTO admin_roles(name,description)
VALUES ('operations','Review deposits and orders; no manual balance edits')
ON CONFLICT (name) DO NOTHING;
INSERT INTO admin_role_permissions(role_id,permission_code)
SELECT id,p FROM admin_roles
CROSS JOIN unnest(ARRAY['orders.read','deposits.read','reviews.read','reviews.acknowledge']) p
WHERE name='operations'
ON CONFLICT DO NOTHING;
