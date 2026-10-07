-- Kids: comunicação Kids → Projeção (KidsProjectionMessage) — não destrutiva
CREATE TABLE "KidsProjectionMessage" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentById" TEXT,
    "serviceScheduleId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "viewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KidsProjectionMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "KidsProjectionMessage"
  ADD CONSTRAINT "KidsProjectionMessage_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KidsProjectionMessage"
  ADD CONSTRAINT "KidsProjectionMessage_sentById_fkey"
  FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KidsProjectionMessage"
  ADD CONSTRAINT "KidsProjectionMessage_viewedById_fkey"
  FOREIGN KEY ("viewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KidsProjectionMessage"
  ADD CONSTRAINT "KidsProjectionMessage_serviceScheduleId_fkey"
  FOREIGN KEY ("serviceScheduleId") REFERENCES "KidsServiceSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "KidsProjectionMessage_status_sentAt_idx" ON "KidsProjectionMessage"("status", "sentAt");

CREATE INDEX "KidsProjectionMessage_childId_idx" ON "KidsProjectionMessage"("childId");
