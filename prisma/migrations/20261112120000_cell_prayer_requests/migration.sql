CREATE TABLE "CellPrayerRequest" (
    "id" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "meetingId" TEXT,
    "requesterName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "CellPrayerRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CellPrayerRequest_cellId_closedAt_idx" ON "CellPrayerRequest"("cellId", "closedAt");
CREATE INDEX "CellPrayerRequest_meetingId_idx" ON "CellPrayerRequest"("meetingId");
ALTER TABLE "CellPrayerRequest" ADD CONSTRAINT "CellPrayerRequest_cellId_fkey"
    FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CellPrayerRequest" ADD CONSTRAINT "CellPrayerRequest_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "CellMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
