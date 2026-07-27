-- CreateEnum
CREATE TYPE "CourseAudience" AS ENUM ('MEMBERS', 'VOLUNTEERS', 'BOTH');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "targetMemberTypes" "MemberType"[];

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "details" TEXT,
    "instructorName" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "audience" "CourseAudience" NOT NULL DEFAULT 'BOTH',
    "agendaVisible" BOOLEAN NOT NULL DEFAULT true,
    "notifyAdmins" BOOLEAN NOT NULL DEFAULT false,
    "notifyMembers" BOOLEAN NOT NULL DEFAULT false,
    "notifyVolunteers" BOOLEAN NOT NULL DEFAULT false,
    "notifyVisitors" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_startsAt_idx" ON "Course"("startsAt");

-- CreateIndex
CREATE INDEX "Course_audience_idx" ON "Course"("audience");

-- CreateIndex
CREATE INDEX "Course_agendaVisible_idx" ON "Course"("agendaVisible");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
