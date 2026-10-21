-- Release publication is distinct from financial operations. No users are assigned here.
INSERT INTO admin_permissions(code,description) VALUES ('ANDROID_RELEASE_PUBLISH','Read Android release history and publish verified attested Android releases') ON CONFLICT (code) DO NOTHING;
INSERT INTO admin_roles(name,description) VALUES ('android-release-publisher','Android release publication only; no financial or account administration') ON CONFLICT (name) DO NOTHING;
INSERT INTO admin_role_permissions(role_id,permission_code) SELECT id,'ANDROID_RELEASE_PUBLISH' FROM admin_roles WHERE name='android-release-publisher' ON CONFLICT DO NOTHING;
