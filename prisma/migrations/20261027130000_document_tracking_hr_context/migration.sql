-- AlterTable
ALTER TABLE "document_tracking_events" ADD COLUMN     "recipient_department_version_id" INTEGER,
ADD COLUMN     "recipient_employment_id" INTEGER,
ADD COLUMN     "recipient_ministry_name" VARCHAR(255),
ADD COLUMN     "recipient_office_name" VARCHAR(255),
ADD COLUMN     "recipient_position_title" VARCHAR(150);

-- CreateIndex
CREATE INDEX "document_tracking_events_recipient_department_version_id_idx" ON "document_tracking_events"("recipient_department_version_id");

-- CreateIndex
CREATE INDEX "document_tracking_events_recipient_employment_id_idx" ON "document_tracking_events"("recipient_employment_id");

-- AddForeignKey
ALTER TABLE "document_tracking_events" ADD CONSTRAINT "document_tracking_events_recipient_department_version_id_fkey" FOREIGN KEY ("recipient_department_version_id") REFERENCES "department_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tracking_events" ADD CONSTRAINT "document_tracking_events_recipient_employment_id_fkey" FOREIGN KEY ("recipient_employment_id") REFERENCES "employment_histories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
