-- CreateEnum
CREATE TYPE "DiscipleshipMeetingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'MISSED');

-- CreateEnum
CREATE TYPE "DiscipleshipHistoryAction" AS ENUM ('CREATED', 'STATUS_CHANGED', 'MEETING_RECORDED', 'TRANSFERRED', 'PROGRESS_UPDATED');

-- AlterEnum
ALTER TYPE "DiscipleshipStatus" ADD VALUE 'TRANSFERRED';

-- AlterTable
ALTER TABLE "Discipleship" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DiscipleshipMeeting" (
    "id" TEXT NOT NULL,
    "discipleshipId" TEXT NOT NULL,
    "meetingAt" TIMESTAMP(3) NOT NULL,
    "theme" TEXT,
    "notes" TEXT,
    "nextMeetingAt" TIMESTAMP(3),
    "status" "DiscipleshipMeetingStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscipleshipMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscipleshipHistory" (
    "id" TEXT NOT NULL,
    "discipleshipId" TEXT,
    "memberId" TEXT NOT NULL,
    "action" "DiscipleshipHistoryAction" NOT NULL,
    "previousDisciplerId" TEXT,
    "newDisciplerId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscipleshipHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscipleshipMeeting_discipleshipId_idx" ON "DiscipleshipMeeting"("discipleshipId");

-- CreateIndex
CREATE INDEX "DiscipleshipMeeting_meetingAt_idx" ON "DiscipleshipMeeting"("meetingAt");

-- CreateIndex
CREATE INDEX "DiscipleshipMeeting_status_idx" ON "DiscipleshipMeeting"("status");

-- CreateIndex
CREATE INDEX "DiscipleshipHistory_memberId_idx" ON "DiscipleshipHistory"("memberId");

-- CreateIndex
CREATE INDEX "DiscipleshipHistory_action_idx" ON "DiscipleshipHistory"("action");

-- CreateIndex
CREATE INDEX "DiscipleshipHistory_createdAt_idx" ON "DiscipleshipHistory"("createdAt");

-- CreateIndex
CREATE INDEX "Discipleship_level_idx" ON "Discipleship"("level");

-- CreateIndex
CREATE INDEX "Discipleship_nextMeetingAt_idx" ON "Discipleship"("nextMeetingAt");

-- AddForeignKey
ALTER TABLE "DiscipleshipMeeting" ADD CONSTRAINT "DiscipleshipMeeting_discipleshipId_fkey" FOREIGN KEY ("discipleshipId") REFERENCES "Discipleship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscipleshipMeeting" ADD CONSTRAINT "DiscipleshipMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscipleshipHistory" ADD CONSTRAINT "DiscipleshipHistory_discipleshipId_fkey" FOREIGN KEY ("discipleshipId") REFERENCES "Discipleship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscipleshipHistory" ADD CONSTRAINT "DiscipleshipHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscipleshipHistory" ADD CONSTRAINT "DiscipleshipHistory_previousDisciplerId_fkey" FOREIGN KEY ("previousDisciplerId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscipleshipHistory" ADD CONSTRAINT "DiscipleshipHistory_newDisciplerId_fkey" FOREIGN KEY ("newDisciplerId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscipleshipHistory" ADD CONSTRAINT "DiscipleshipHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
