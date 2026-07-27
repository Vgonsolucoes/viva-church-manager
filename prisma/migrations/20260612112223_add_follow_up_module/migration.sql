-- CreateEnum
CREATE TYPE "FollowUpStage" AS ENUM ('NEW_VISITOR', 'WELCOMED', 'IN_PROCESS', 'READY_FOR_MEMBERSHIP', 'READY_FOR_VOLUNTEERING', 'COMPLETED');

-- CreateTable
CREATE TABLE "FollowUpJourney" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "assignedToMemberId" TEXT,
    "stage" "FollowUpStage" NOT NULL DEFAULT 'NEW_VISITOR',
    "firstVisitAt" TIMESTAMP(3),
    "lastContactAt" TIMESTAMP(3),
    "nextContactAt" TIMESTAMP(3),
    "wantsMembership" BOOLEAN NOT NULL DEFAULT false,
    "wantsToServe" BOOLEAN NOT NULL DEFAULT false,
    "ideDiscipleCompletedAt" TIMESTAMP(3),
    "loyaltyHonorCompletedAt" TIMESTAMP(3),
    "calledToServeCompletedAt" TIMESTAMP(3),
    "rescueEventCompletedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpHistory" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FollowUpJourney_memberId_key" ON "FollowUpJourney"("memberId");

-- CreateIndex
CREATE INDEX "FollowUpJourney_stage_idx" ON "FollowUpJourney"("stage");

-- CreateIndex
CREATE INDEX "FollowUpJourney_assignedToMemberId_idx" ON "FollowUpJourney"("assignedToMemberId");

-- CreateIndex
CREATE INDEX "FollowUpJourney_nextContactAt_idx" ON "FollowUpJourney"("nextContactAt");

-- CreateIndex
CREATE INDEX "FollowUpHistory_journeyId_idx" ON "FollowUpHistory"("journeyId");

-- CreateIndex
CREATE INDEX "FollowUpHistory_createdAt_idx" ON "FollowUpHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "FollowUpJourney" ADD CONSTRAINT "FollowUpJourney_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpJourney" ADD CONSTRAINT "FollowUpJourney_assignedToMemberId_fkey" FOREIGN KEY ("assignedToMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpJourney" ADD CONSTRAINT "FollowUpJourney_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpHistory" ADD CONSTRAINT "FollowUpHistory_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "FollowUpJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpHistory" ADD CONSTRAINT "FollowUpHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
