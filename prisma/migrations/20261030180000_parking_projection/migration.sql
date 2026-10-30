CREATE TYPE "ProjectionChannel" AS ENUM ('KIDS', 'PARKING');
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'PROJECTION';
ALTER TABLE "Ministry" ADD COLUMN "projectionChannel" "ProjectionChannel";
UPDATE "Ministry" SET "projectionChannel" = 'KIDS'
WHERE lower(trim("name")) IN ('kids', 'infantil', 'ministério infantil', 'ministerio infantil', 'viva kids', 'viva church kids');
UPDATE "Ministry" SET "projectionChannel" = 'PARKING'
WHERE lower(trim("name")) IN ('estacionamento', 'ministério estacionamento', 'ministerio estacionamento', 'ministério de estacionamento', 'ministerio de estacionamento');
CREATE TABLE "ParkingProjectionMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "plate" TEXT NOT NULL,
  "vehicle" TEXT,
  "color" TEXT,
  "location" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sentById" TEXT,
  "viewedById" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "viewedAt" TIMESTAMP(3),
  CONSTRAINT "ParkingProjectionMessage_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ParkingProjectionMessage_viewedById_fkey" FOREIGN KEY ("viewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ParkingProjectionMessage_status_sentAt_idx" ON "ParkingProjectionMessage"("status", "sentAt");
