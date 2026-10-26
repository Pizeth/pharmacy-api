-- Optional presentation metadata; existing role permissions are unchanged.
ALTER TABLE "roles" ADD COLUMN "icon" VARCHAR(64),
                    ADD COLUMN "color" VARCHAR(7);
