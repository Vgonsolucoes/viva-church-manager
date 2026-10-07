-- Kids: fila de impressão de etiquetas (KidsPrintJob) — camada desacoplada, não destrutiva
CREATE TABLE "KidsPrintJob" (
    "id" TEXT NOT NULL,
    "checkInId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "labelType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "printedAt" TIMESTAMP(3),
    "printedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KidsPrintJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "KidsPrintJob"
  ADD CONSTRAINT "KidsPrintJob_checkInId_fkey"
  FOREIGN KEY ("checkInId") REFERENCES "ChildCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KidsPrintJob"
  ADD CONSTRAINT "KidsPrintJob_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KidsPrintJob"
  ADD CONSTRAINT "KidsPrintJob_printedById_fkey"
  FOREIGN KEY ("printedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "KidsPrintJob_status_createdAt_idx" ON "KidsPrintJob"("status", "createdAt");

CREATE INDEX "KidsPrintJob_checkInId_idx" ON "KidsPrintJob"("checkInId");

CREATE INDEX "KidsPrintJob_childId_idx" ON "KidsPrintJob"("childId");
