-- CreateEnum
CREATE TYPE "PrayerRequestPrivacy" AS ENUM ('PRIVATE', 'PASTORS', 'LEADERSHIP', 'PUBLIC');

-- CreateEnum
CREATE TYPE "VolunteerAvailabilityReason" AS ENUM ('DISPONIVEL', 'INDISPONIVEL', 'VIAGEM', 'FERIAS', 'TRABALHO', 'OUTRO');

-- CreateEnum
CREATE TYPE "ScheduleDeclineReason" AS ENUM ('TRABALHO', 'VIAGEM', 'FAMILIAR', 'SAUDE', 'OUTRO');

-- CreateEnum
CREATE TYPE "ScheduleSubstitutionStatus" AS ENUM ('REQUESTED', 'VOLUNTEER_B_ACCEPTED', 'APPROVED_BY_LEADER', 'REJECTED');

-- AlterTable
ALTER TABLE "YoutubeVideo" ALTER COLUMN "viewCount" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PrayerRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" TEXT,
    "privacy" "PrayerRequestPrivacy" NOT NULL DEFAULT 'PRIVATE',
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrayerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerAvailabilityBlock" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "reason" "VolunteerAvailabilityReason" NOT NULL DEFAULT 'INDISPONIVEL',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerAvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleSubstitutionRequest" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "fromVolunteerId" TEXT NOT NULL,
    "toVolunteerId" TEXT NOT NULL,
    "status" "ScheduleSubstitutionStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" "ScheduleDeclineReason",
    "note" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleSubstitutionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrayerRequest_memberId_idx" ON "PrayerRequest"("memberId");

-- CreateIndex
CREATE INDEX "PrayerRequest_privacy_idx" ON "PrayerRequest"("privacy");

-- CreateIndex
CREATE INDEX "PrayerRequest_createdAt_idx" ON "PrayerRequest"("createdAt");

-- CreateIndex
CREATE INDEX "VolunteerAvailabilityBlock_volunteerId_idx" ON "VolunteerAvailabilityBlock"("volunteerId");

-- CreateIndex
CREATE INDEX "VolunteerAvailabilityBlock_startDate_idx" ON "VolunteerAvailabilityBlock"("startDate");

-- CreateIndex
CREATE INDEX "VolunteerAvailabilityBlock_reason_idx" ON "VolunteerAvailabilityBlock"("reason");

-- CreateIndex
CREATE INDEX "ScheduleSubstitutionRequest_assignmentId_idx" ON "ScheduleSubstitutionRequest"("assignmentId");

-- CreateIndex
CREATE INDEX "ScheduleSubstitutionRequest_fromVolunteerId_idx" ON "ScheduleSubstitutionRequest"("fromVolunteerId");

-- CreateIndex
CREATE INDEX "ScheduleSubstitutionRequest_toVolunteerId_idx" ON "ScheduleSubstitutionRequest"("toVolunteerId");

-- CreateIndex
CREATE INDEX "ScheduleSubstitutionRequest_status_idx" ON "ScheduleSubstitutionRequest"("status");

-- AddForeignKey
ALTER TABLE "PrayerRequest" ADD CONSTRAINT "PrayerRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAvailabilityBlock" ADD CONSTRAINT "VolunteerAvailabilityBlock_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "VolunteerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSubstitutionRequest" ADD CONSTRAINT "ScheduleSubstitutionRequest_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ScheduleAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSubstitutionRequest" ADD CONSTRAINT "ScheduleSubstitutionRequest_fromVolunteerId_fkey" FOREIGN KEY ("fromVolunteerId") REFERENCES "VolunteerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSubstitutionRequest" ADD CONSTRAINT "ScheduleSubstitutionRequest_toVolunteerId_fkey" FOREIGN KEY ("toVolunteerId") REFERENCES "VolunteerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSubstitutionRequest" ADD CONSTRAINT "ScheduleSubstitutionRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
