-- Application authorization and identity are accessed through Prisma + Better Auth, not the browser Data API.
-- Existing backend owner/BYPASSRLS access is preserved. No public policies or grants are added.
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "roles" FROM PUBLIC;
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "permissions" FROM PUBLIC;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "role_permissions" FROM PUBLIC;
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "user" FROM PUBLIC;
ALTER TABLE "audit_trails" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "audit_trails" FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN EXECUTE format('REVOKE ALL ON TABLE roles, permissions, role_permissions, "user", audit_trails FROM %I', role_name); END IF; END LOOP; END $$;
