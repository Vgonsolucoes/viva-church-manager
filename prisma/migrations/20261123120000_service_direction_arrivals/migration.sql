ALTER TABLE "Event" ADD COLUMN "geoCheckIn" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Event" SET "geoCheckIn" = true WHERE "id" LIKE 'viva-weekly-%' AND "type" = 'SERVICE';
CREATE TABLE "ArrivalConsent" (
  "memberId" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT false, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArrivalConsent_pkey" PRIMARY KEY ("memberId"),
  CONSTRAINT "ArrivalConsent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ServicePresence" (
  "id" TEXT NOT NULL, "eventId" TEXT NOT NULL, "memberId" TEXT NOT NULL,
  "arrivedAt" TIMESTAMP(3) NOT NULL, "lastSeenAt" TIMESTAMP(3) NOT NULL, "leftAt" TIMESTAMP(3), "method" TEXT NOT NULL DEFAULT 'GEO',
  CONSTRAINT "ServicePresence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServicePresence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ServicePresence_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ServicePresence_eventId_memberId_key" ON "ServicePresence"("eventId", "memberId");
CREATE INDEX "ServicePresence_memberId_arrivedAt_idx" ON "ServicePresence"("memberId", "arrivedAt");
CREATE TABLE "ServiceDecision" (
  "eventId" TEXT NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL, "updatedById" TEXT NOT NULL,
  CONSTRAINT "ServiceDecision_pkey" PRIMARY KEY ("eventId"),
  CONSTRAINT "ServiceDecision_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
