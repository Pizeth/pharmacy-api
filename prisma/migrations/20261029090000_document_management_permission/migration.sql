-- Add an assignable management permission without granting it to existing roles.
INSERT INTO "permissions" ("action", "subject") VALUES ('manage', 'TrackedDocument')
ON CONFLICT ("action", "subject") DO NOTHING;
