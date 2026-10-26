-- CreateEnum
CREATE TYPE "DocumentLifecycle" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentPriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "DocumentStepStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DocumentEventKind" AS ENUM ('REGISTERED', 'UPDATED', 'ASSIGNED', 'FORWARDED', 'RETURNED', 'HELD', 'RESUMED', 'COMPLETED', 'CANCELLED', 'COMMENTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentAttachmentKind" AS ENUM ('INCOMING', 'OUTGOING', 'SUPPORTING');

-- CreateTable
CREATE TABLE "tracking_workflows" (
    "id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_workflow_steps" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "name_kh" VARCHAR(160) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "tracking_workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_storage_locations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(160) NOT NULL,

    CONSTRAINT "document_storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_documents" (
    "id" UUID NOT NULL,
    "registration_number" SERIAL NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "category_id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "subtype" VARCHAR(160),
    "priority" "DocumentPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "DocumentLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "workflow_id" UUID NOT NULL,
    "responsible_department_id" INTEGER,
    "incoming_number" VARCHAR(120),
    "outgoing_number" VARCHAR(120),
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "due_at" TIMESTAMPTZ(6),
    "stamped_at" TIMESTAMPTZ(6),
    "dispatched_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "storage_location_id" UUID,
    "chronological_code" VARCHAR(100),
    "archive_sequence" INTEGER,
    "notes" VARCHAR(4000),
    "created_by_id" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source_system" VARCHAR(60),
    "source_record_id" VARCHAR(160),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "tracked_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_steps" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "workflow_step_id" UUID NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "name_kh" VARCHAR(160) NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "DocumentStepStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to_id" INTEGER,
    "department_id" INTEGER,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "document_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_tracking_events" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "step_id" UUID,
    "kind" "DocumentEventKind" NOT NULL,
    "actor_id" INTEGER,
    "actor_name" VARCHAR(255) NOT NULL,
    "recipient_id" INTEGER,
    "recipient_name" VARCHAR(255),
    "from_stage" VARCHAR(160),
    "to_stage" VARCHAR(160),
    "note" VARCHAR(4000),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_attachments" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "kind" "DocumentAttachmentKind" NOT NULL DEFAULT 'SUPPORTING',
    "created_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracking_workflows_key_key" ON "tracking_workflows"("key");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_workflow_steps_workflow_id_position_key" ON "tracking_workflow_steps"("workflow_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_workflow_steps_workflow_id_key_key" ON "tracking_workflow_steps"("workflow_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "document_categories_name_key" ON "document_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_name_key" ON "document_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "document_storage_locations_code_key" ON "document_storage_locations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_documents_registration_number_key" ON "tracked_documents"("registration_number");

-- CreateIndex
CREATE INDEX "tracked_documents_category_id_idx" ON "tracked_documents"("category_id");

-- CreateIndex
CREATE INDEX "tracked_documents_type_id_idx" ON "tracked_documents"("type_id");

-- CreateIndex
CREATE INDEX "tracked_documents_workflow_id_idx" ON "tracked_documents"("workflow_id");

-- CreateIndex
CREATE INDEX "tracked_documents_responsible_department_id_idx" ON "tracked_documents"("responsible_department_id");

-- CreateIndex
CREATE INDEX "tracked_documents_storage_location_id_idx" ON "tracked_documents"("storage_location_id");

-- CreateIndex
CREATE INDEX "tracked_documents_created_by_id_idx" ON "tracked_documents"("created_by_id");

-- CreateIndex
CREATE INDEX "tracked_documents_archived_at_status_received_at_idx" ON "tracked_documents"("archived_at", "status", "received_at");

-- CreateIndex
CREATE INDEX "tracked_documents_priority_due_at_idx" ON "tracked_documents"("priority", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_documents_source_system_source_record_id_key" ON "tracked_documents"("source_system", "source_record_id");

-- CreateIndex
CREATE INDEX "document_steps_workflow_step_id_idx" ON "document_steps"("workflow_step_id");

-- CreateIndex
CREATE INDEX "document_steps_assigned_to_id_status_idx" ON "document_steps"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "document_steps_department_id_idx" ON "document_steps"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_steps_document_id_position_key" ON "document_steps"("document_id", "position");

-- CreateIndex
CREATE INDEX "document_tracking_events_step_id_idx" ON "document_tracking_events"("step_id");

-- CreateIndex
CREATE INDEX "document_tracking_events_actor_id_idx" ON "document_tracking_events"("actor_id");

-- CreateIndex
CREATE INDEX "document_tracking_events_recipient_id_idx" ON "document_tracking_events"("recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_tracking_events_document_id_sequence_key" ON "document_tracking_events"("document_id", "sequence");

-- CreateIndex
CREATE INDEX "document_attachments_document_id_idx" ON "document_attachments"("document_id");

-- CreateIndex
CREATE INDEX "document_attachments_created_by_id_idx" ON "document_attachments"("created_by_id");

-- AddForeignKey
ALTER TABLE "tracking_workflow_steps" ADD CONSTRAINT "tracking_workflow_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "tracking_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_documents" ADD CONSTRAINT "tracked_documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_documents" ADD CONSTRAINT "tracked_documents_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_documents" ADD CONSTRAINT "tracked_documents_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "tracking_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_documents" ADD CONSTRAINT "tracked_documents_responsible_department_id_fkey" FOREIGN KEY ("responsible_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_documents" ADD CONSTRAINT "tracked_documents_storage_location_id_fkey" FOREIGN KEY ("storage_location_id") REFERENCES "document_storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_documents" ADD CONSTRAINT "tracked_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_steps" ADD CONSTRAINT "document_steps_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "tracked_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_steps" ADD CONSTRAINT "document_steps_workflow_step_id_fkey" FOREIGN KEY ("workflow_step_id") REFERENCES "tracking_workflow_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_steps" ADD CONSTRAINT "document_steps_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_steps" ADD CONSTRAINT "document_steps_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tracking_events" ADD CONSTRAINT "document_tracking_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "tracked_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tracking_events" ADD CONSTRAINT "document_tracking_events_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "document_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tracking_events" ADD CONSTRAINT "document_tracking_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tracking_events" ADD CONSTRAINT "document_tracking_events_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "tracked_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One current stage, positive route/version values and private backend access.
CREATE UNIQUE INDEX "document_steps_one_active" ON "document_steps" ("document_id") WHERE "status" = 'ACTIVE';
ALTER TABLE "tracked_documents" ADD CONSTRAINT "tracked_documents_version_positive" CHECK ("version" > 0), ADD CONSTRAINT "tracked_documents_archive_sequence_positive" CHECK ("archive_sequence" IS NULL OR "archive_sequence" > 0), ADD CONSTRAINT "tracked_documents_due_after_received" CHECK ("due_at" IS NULL OR "due_at" >= "received_at");
ALTER TABLE "document_steps" ADD CONSTRAINT "document_steps_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "tracking_workflow_steps" ADD CONSTRAINT "tracking_workflow_steps_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "tracking_workflows" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "tracking_workflows" FROM PUBLIC;
ALTER TABLE "tracking_workflow_steps" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "tracking_workflow_steps" FROM PUBLIC;
ALTER TABLE "document_categories" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "document_categories" FROM PUBLIC;
ALTER TABLE "document_types" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "document_types" FROM PUBLIC;
ALTER TABLE "document_storage_locations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "document_storage_locations" FROM PUBLIC;
ALTER TABLE "tracked_documents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "tracked_documents" FROM PUBLIC;
ALTER TABLE "document_steps" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "document_steps" FROM PUBLIC;
ALTER TABLE "document_tracking_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "document_tracking_events" FROM PUBLIC;
ALTER TABLE "document_attachments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "document_attachments" FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN EXECUTE format('REVOKE ALL ON TABLE tracking_workflows, tracking_workflow_steps, document_categories, document_types, document_storage_locations, tracked_documents, document_steps, document_tracking_events, document_attachments FROM %I', role_name); EXECUTE format('REVOKE ALL ON SEQUENCE tracked_documents_registration_number_seq FROM %I', role_name); END IF; END LOOP; END $$;
REVOKE ALL ON SEQUENCE tracked_documents_registration_number_seq FROM PUBLIC;

-- Shared route and real classification labels from the existing register. No document records are imported.
INSERT INTO "tracking_workflows" (id,key,name) VALUES ('136fd26e-5880-44c8-b513-1ce06acab34e','shared-document-route','Shared document handling route');
INSERT INTO "tracking_workflow_steps" (id,workflow_id,key,name,name_kh,position) VALUES ('1a6f66dd-7b37-4028-82a5-88490f35d1de','136fd26e-5880-44c8-b513-1ce06acab34e','RECEIVED','Received','ទទួលឯកសារ',0);
INSERT INTO "tracking_workflow_steps" (id,workflow_id,key,name,name_kh,position) VALUES ('b68c8700-83c0-41d9-8c64-2fe79a5ba662','136fd26e-5880-44c8-b513-1ce06acab34e','PROCESSING','Specialist office processing','ការិយាល័យជំនាញ',1);
INSERT INTO "tracking_workflow_steps" (id,workflow_id,key,name,name_kh,position) VALUES ('1c1611f0-8b85-468d-9076-cd0c6537cf73','136fd26e-5880-44c8-b513-1ce06acab34e','CABINET_REVIEW','Cabinet review','ពិនិត្យខុទ្ទកាល័យ',2);
INSERT INTO "tracking_workflow_steps" (id,workflow_id,key,name,name_kh,position) VALUES ('a5989cb4-0d15-4c3a-a09a-02c6138b2444','136fd26e-5880-44c8-b513-1ce06acab34e','FINALIZATION','Return to general affairs','ត្រឡប់មកការិយាល័យកិច្ចការទូទៅ',3);
INSERT INTO "tracking_workflow_steps" (id,workflow_id,key,name,name_kh,position) VALUES ('86b0b401-a853-4d00-b722-86ccf171e500','136fd26e-5880-44c8-b513-1ce06acab34e','STAMPING','Stamp and register outgoing letter','បោះត្រា និងចុះលេខចេញ',4);
INSERT INTO "tracking_workflow_steps" (id,workflow_id,key,name,name_kh,position) VALUES ('3a3fbff4-3011-4d72-bd05-b95964426757','136fd26e-5880-44c8-b513-1ce06acab34e','DISPATCH','Dispatch','បញ្ជូនឯកសារចេញ',5);
INSERT INTO "tracking_workflow_steps" (id,workflow_id,key,name,name_kh,position) VALUES ('df7126f5-10bf-44f0-be55-4a175d2549eb','136fd26e-5880-44c8-b513-1ce06acab34e','FILING','Physical filing','រក្សាទុកឯកសារដើម',6);
INSERT INTO "document_categories" (id,name) VALUES ('6e56890a-3695-4036-a074-8155f694f6ed','ឯកសារមុខការ');
INSERT INTO "document_categories" (id,name) VALUES ('23ff52b2-e128-41b9-9a2f-21a295dbb8b6','ឯកសារជូនជ្រាប');
INSERT INTO "document_categories" (id,name) VALUES ('e74c9fff-9065-497f-8f90-39ee6eed089f','សេចក្តីសម្រេចនានា');
INSERT INTO "document_types" (id,name) VALUES ('d38e0ba2-8abc-4349-bd26-7a822a7fcff9','សំណើសុំច្បាប់');
INSERT INTO "document_types" (id,name) VALUES ('84e85bee-6100-431d-96c1-95500e83eab8','បញ្ជាក់រដ្ឋបាល និងបៀវត្ស');
INSERT INTO "document_types" (id,name) VALUES ('b4bbcbe4-d36d-4c7a-bccd-2794bf4bfc11','របាយការណ៍');
INSERT INTO "document_types" (id,name) VALUES ('e3d8bb8a-0ba3-4c7a-93f2-06fbf5e6e663','សេចក្តីសម្រេចនានា');
INSERT INTO "document_types" (id,name) VALUES ('ed87193d-cdae-486a-80ab-957c89cadd9e','គ្រឿងឥស្សរិយយស និងមេដាយការងារ');
INSERT INTO "document_types" (id,name) VALUES ('0ad30cf9-3571-472f-bac8-4b09d37a9bf6','តំឡើងឋានន្តរស័ក្ត និងថ្នាក់');
INSERT INTO "document_types" (id,name) VALUES ('ad7ac68e-7a17-4284-945f-4150d25bc1cb','សំណើសុំផ្សេងៗ');
INSERT INTO "document_types" (id,name) VALUES ('6dec3ef4-dcf0-41ad-a3b9-fd403cbf841c','ទំនេរគ្មានបៀវត្ស');
INSERT INTO "document_types" (id,name) VALUES ('a4a429a9-6d38-49c6-8ea5-31ee3c6ae702','ឯកសារផ្សេងៗ');
INSERT INTO "document_types" (id,name) VALUES ('9b6d4dd7-d4bb-4625-bc64-ea7346f8874e','មន្ត្រីជាប់កិច្ចសន្យា');
INSERT INTO "document_types" (id,name) VALUES ('8366ea3f-0d8c-4062-a59a-1dfacd909fcd','លុបឈ្មោះ');
INSERT INTO "document_types" (id,name) VALUES ('4c25cd1d-95b7-4dfc-b5ad-037668ef7249','សំណើសុំទំនេរពីមុខងារ');
