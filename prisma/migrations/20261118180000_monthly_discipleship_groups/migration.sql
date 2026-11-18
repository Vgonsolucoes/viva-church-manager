CREATE TABLE "DiscipleshipMaterial" (
  "id" TEXT NOT NULL, "rootMemberId" TEXT NOT NULL, "month" TEXT NOT NULL,
  "title" TEXT NOT NULL, "filename" TEXT NOT NULL, "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscipleshipMaterial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DiscipleshipMaterial_rootMemberId_fkey" FOREIGN KEY ("rootMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DiscipleshipMaterial_rootMemberId_month_key" ON "DiscipleshipMaterial"("rootMemberId", "month");
CREATE TABLE "DiscipleshipGroupMeeting" (
  "id" TEXT NOT NULL, "leaderId" TEXT NOT NULL, "month" TEXT NOT NULL,
  "meetingAt" TIMESTAMP(3) NOT NULL, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscipleshipGroupMeeting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DiscipleshipGroupMeeting_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DiscipleshipGroupMeeting_leaderId_month_key" ON "DiscipleshipGroupMeeting"("leaderId", "month");
ALTER TABLE "DiscipleshipMeeting" ADD COLUMN "groupMeetingId" TEXT;
ALTER TABLE "DiscipleshipMeeting" ADD CONSTRAINT "DiscipleshipMeeting_groupMeetingId_fkey" FOREIGN KEY ("groupMeetingId") REFERENCES "DiscipleshipGroupMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "DiscipleshipMeeting_groupMeetingId_discipleshipId_key" ON "DiscipleshipMeeting"("groupMeetingId", "discipleshipId");
