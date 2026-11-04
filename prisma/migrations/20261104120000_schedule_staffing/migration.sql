ALTER TABLE "Schedule" ADD COLUMN "courseId" TEXT, ADD COLUMN "staffingCompletedAt" TIMESTAMP(3);
ALTER TABLE "ScheduleAssignment" ADD COLUMN "ministryId" TEXT;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Schedule_eventId_idx" ON "Schedule"("eventId");
CREATE INDEX "Schedule_courseId_idx" ON "Schedule"("courseId");
CREATE INDEX "ScheduleAssignment_ministryId_idx" ON "ScheduleAssignment"("ministryId");
UPDATE "ScheduleAssignment" AS a SET "ministryId" = s."ministryId" FROM "Schedule" AS s WHERE a."scheduleId" = s."id" AND s."ministryId" IS NOT NULL;
