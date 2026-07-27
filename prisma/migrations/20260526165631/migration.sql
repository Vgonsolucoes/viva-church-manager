-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('SUPER_ADMIN', 'PASTOR_PRESIDENTE', 'PASTOR', 'MINISTRY_LEADER', 'CELL_LEADER', 'VOLUNTEER', 'MEMBER', 'FINANCE', 'SECRETARY', 'RECEPTION', 'KIDS_MINISTRY', 'PARKING');

-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('MEMBER', 'VISITOR', 'NEW_MEMBER', 'LEADER', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "PastorRole" AS ENUM ('PRESIDENT', 'PASTOR', 'ASSISTANT', 'EVANGELIST');

-- CreateEnum
CREATE TYPE "DiscipleshipStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "ScheduleKind" AS ENUM ('SERVICE', 'EVENT', 'CELL', 'MEETING', 'REHEARSAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SERVICE', 'CONFERENCE', 'CELL', 'TRAINING', 'SOCIAL_ACTION', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "FinanceDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "FinanceKind" AS ENUM ('TITHE', 'OFFERING', 'DONATION', 'CAMPAIGN', 'PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "LostFoundStatus" AS ENUM ('WAITING_PICKUP', 'DELIVERED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'LOANED', 'MAINTENANCE', 'DISPOSED');

-- CreateEnum
CREATE TYPE "ChildCheckStatus" AS ENUM ('CHECKED_IN', 'CHECKED_OUT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "passwordHash" TEXT,
    "memberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RoleKey" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ministry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ministry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "birthDate" TIMESTAMP(3),
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "maritalStatus" "MaritalStatus",
    "joinedAt" TIMESTAMP(3),
    "type" "MemberType" NOT NULL DEFAULT 'MEMBER',
    "baptized" BOOLEAN NOT NULL DEFAULT false,
    "participatesInCell" BOOLEAN NOT NULL DEFAULT false,
    "ministryId" TEXT,
    "attendanceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastoralNote" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT,
    "contentEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PastoralNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastorProfile" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" "PastorRole" NOT NULL,
    "responsibleMinistryId" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PastorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerProfile" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "ministryId" TEXT,
    "availability" TEXT,
    "skills" TEXT[],
    "restrictions" TEXT,
    "absencesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "ScheduleKind" NOT NULL DEFAULT 'SERVICE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "ministryId" TEXT,
    "eventId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleAssignment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "justification" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EventType" NOT NULL DEFAULT 'SERVICE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "responsibleMemberId" TEXT,
    "ministriesInvolved" TEXT[],
    "volunteersNeeded" INTEGER,
    "budgetCents" INTEGER,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cell" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "hostId" TEXT,
    "address" TEXT,
    "weekday" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CellMeeting" (
    "id" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "participantsCount" INTEGER,
    "visitorsCount" INTEGER,
    "prayerRequests" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CellMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CellMeetingAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CellMeetingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discipleship" (
    "id" TEXT NOT NULL,
    "discipleId" TEXT NOT NULL,
    "disciplerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DiscipleshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "meetingsDone" INTEGER NOT NULL DEFAULT 0,
    "nextMeetingAt" TIMESTAMP(3),
    "notes" TEXT,
    "concludedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discipleship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "direction" "FinanceDirection" NOT NULL,
    "kind" "FinanceKind" NOT NULL DEFAULT 'OTHER',
    "category" TEXT,
    "costCenter" TEXT,
    "ministryId" TEXT,
    "projectId" TEXT,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPlan" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "ministryId" TEXT,
    "projectId" TEXT,
    "plannedCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundraisingProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "goalCents" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "public" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundraisingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "targetRoles" "RoleKey"[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "projectId" TEXT,
    "eventId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "qrCode" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "location" TEXT,
    "condition" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "valueCents" INTEGER,
    "invoiceUrl" TEXT,
    "responsible" TEXT,
    "maintenanceNotes" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostFoundItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "photoUrl" TEXT,
    "foundAtLocation" TEXT,
    "foundAtDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "status" "LostFoundStatus" NOT NULL DEFAULT 'WAITING_PICKUP',
    "pickedUpByName" TEXT,
    "proofUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LostFoundItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "allergies" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildGuardian" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildCheckIn" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "status" "ChildCheckStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "pickupCode" TEXT NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ChildCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingFlow" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehiclesIn" INTEGER NOT NULL DEFAULT 0,
    "vehiclesOut" INTEGER NOT NULL DEFAULT 0,
    "specialSpotsUsed" INTEGER NOT NULL DEFAULT 0,
    "capacityAlert" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,

    CONSTRAINT "ParkingFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");

-- CreateIndex
CREATE INDEX "UserRole_role_idx" ON "UserRole"("role");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Ministry_name_key" ON "Ministry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE INDEX "Member_fullName_idx" ON "Member"("fullName");

-- CreateIndex
CREATE INDEX "Member_email_idx" ON "Member"("email");

-- CreateIndex
CREATE INDEX "Member_type_idx" ON "Member"("type");

-- CreateIndex
CREATE INDEX "PastoralNote_memberId_idx" ON "PastoralNote"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "PastorProfile_memberId_key" ON "PastorProfile"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerProfile_memberId_key" ON "VolunteerProfile"("memberId");

-- CreateIndex
CREATE INDEX "VolunteerProfile_ministryId_idx" ON "VolunteerProfile"("ministryId");

-- CreateIndex
CREATE INDEX "Schedule_startsAt_idx" ON "Schedule"("startsAt");

-- CreateIndex
CREATE INDEX "Schedule_kind_idx" ON "Schedule"("kind");

-- CreateIndex
CREATE INDEX "ScheduleAssignment_scheduleId_idx" ON "ScheduleAssignment"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleAssignment_volunteerId_idx" ON "ScheduleAssignment"("volunteerId");

-- CreateIndex
CREATE INDEX "ScheduleAssignment_status_idx" ON "ScheduleAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleAssignment_scheduleId_volunteerId_roleName_key" ON "ScheduleAssignment"("scheduleId", "volunteerId", "roleName");

-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Event_public_idx" ON "Event"("public");

-- CreateIndex
CREATE INDEX "Cell_leaderId_idx" ON "Cell"("leaderId");

-- CreateIndex
CREATE INDEX "Cell_weekday_idx" ON "Cell"("weekday");

-- CreateIndex
CREATE INDEX "CellMeeting_cellId_idx" ON "CellMeeting"("cellId");

-- CreateIndex
CREATE INDEX "CellMeeting_meetingDate_idx" ON "CellMeeting"("meetingDate");

-- CreateIndex
CREATE INDEX "CellMeetingAttendance_memberId_idx" ON "CellMeetingAttendance"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "CellMeetingAttendance_meetingId_memberId_key" ON "CellMeetingAttendance"("meetingId", "memberId");

-- CreateIndex
CREATE INDEX "Discipleship_discipleId_idx" ON "Discipleship"("discipleId");

-- CreateIndex
CREATE INDEX "Discipleship_disciplerId_idx" ON "Discipleship"("disciplerId");

-- CreateIndex
CREATE INDEX "Discipleship_status_idx" ON "Discipleship"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Discipleship_discipleId_disciplerId_startedAt_key" ON "Discipleship"("discipleId", "disciplerId", "startedAt");

-- CreateIndex
CREATE INDEX "FinanceTransaction_occurredAt_idx" ON "FinanceTransaction"("occurredAt");

-- CreateIndex
CREATE INDEX "FinanceTransaction_direction_idx" ON "FinanceTransaction"("direction");

-- CreateIndex
CREATE INDEX "FinanceTransaction_kind_idx" ON "FinanceTransaction"("kind");

-- CreateIndex
CREATE INDEX "BudgetPlan_year_month_idx" ON "BudgetPlan"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetPlan_year_month_ministryId_projectId_key" ON "BudgetPlan"("year", "month", "ministryId", "projectId");

-- CreateIndex
CREATE INDEX "FundraisingProject_public_idx" ON "FundraisingProject"("public");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_userId_readAt_idx" ON "NotificationDelivery"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_userId_key" ON "NotificationDelivery"("notificationId", "userId");

-- CreateIndex
CREATE INDEX "Donation_projectId_idx" ON "Donation"("projectId");

-- CreateIndex
CREATE INDEX "Donation_eventId_idx" ON "Donation"("eventId");

-- CreateIndex
CREATE INDEX "Donation_occurredAt_idx" ON "Donation"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_code_key" ON "Asset"("code");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "Asset_category_idx" ON "Asset"("category");

-- CreateIndex
CREATE INDEX "LostFoundItem_status_idx" ON "LostFoundItem"("status");

-- CreateIndex
CREATE INDEX "LostFoundItem_foundAtDate_idx" ON "LostFoundItem"("foundAtDate");

-- CreateIndex
CREATE INDEX "ChildGuardian_childId_idx" ON "ChildGuardian"("childId");

-- CreateIndex
CREATE INDEX "ChildCheckIn_childId_idx" ON "ChildCheckIn"("childId");

-- CreateIndex
CREATE INDEX "ChildCheckIn_checkInAt_idx" ON "ChildCheckIn"("checkInAt");

-- CreateIndex
CREATE INDEX "ParkingFlow_occurredAt_idx" ON "ParkingFlow"("occurredAt");

-- CreateIndex
CREATE INDEX "ParkingFlow_capacityAlert_idx" ON "ParkingFlow"("capacityAlert");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralNote" ADD CONSTRAINT "PastoralNote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastoralNote" ADD CONSTRAINT "PastoralNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastorProfile" ADD CONSTRAINT "PastorProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastorProfile" ADD CONSTRAINT "PastorProfile_responsibleMinistryId_fkey" FOREIGN KEY ("responsibleMinistryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerProfile" ADD CONSTRAINT "VolunteerProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerProfile" ADD CONSTRAINT "VolunteerProfile_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "VolunteerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_responsibleMemberId_fkey" FOREIGN KEY ("responsibleMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CellMeeting" ADD CONSTRAINT "CellMeeting_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CellMeetingAttendance" ADD CONSTRAINT "CellMeetingAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CellMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CellMeetingAttendance" ADD CONSTRAINT "CellMeetingAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discipleship" ADD CONSTRAINT "Discipleship_discipleId_fkey" FOREIGN KEY ("discipleId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discipleship" ADD CONSTRAINT "Discipleship_disciplerId_fkey" FOREIGN KEY ("disciplerId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FundraisingProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FundraisingProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FundraisingProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildGuardian" ADD CONSTRAINT "ChildGuardian_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildCheckIn" ADD CONSTRAINT "ChildCheckIn_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildCheckIn" ADD CONSTRAINT "ChildCheckIn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingFlow" ADD CONSTRAINT "ParkingFlow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
