INSERT INTO admin_permissions(code,description) VALUES
 ('banks.reveal','Explicit audited reveal of encrypted bank account numbers'),
 ('users.close','Deactivate a user through retention-safe account closure')
 ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions(role_id,permission_code)
 SELECT r.id,p.code FROM admin_roles r CROSS JOIN admin_permissions p
 WHERE r.name='OWNER_ADMIN' AND p.code IN ('banks.reveal','users.close') ON CONFLICT DO NOTHING;
