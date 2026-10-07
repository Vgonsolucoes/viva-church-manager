-- Kids: horários de culto (KidsServiceSchedule) e vínculo opcional do check-in ao culto (não destrutivo)
CREATE TABLE "KidsServiceSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "toleranceMinutes" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KidsServiceSchedule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ChildCheckIn"
  ADD COLUMN "serviceScheduleId" TEXT;

ALTER TABLE "ChildCheckIn"
  ADD CONSTRAINT "ChildCheckIn_serviceScheduleId_fkey"
  FOREIGN KEY ("serviceScheduleId") REFERENCES "KidsServiceSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "KidsServiceSchedule_dayOfWeek_isActive_idx" ON "KidsServiceSchedule"("dayOfWeek", "isActive");

CREATE INDEX "ChildCheckIn_serviceScheduleId_idx" ON "ChildCheckIn"("serviceScheduleId");
