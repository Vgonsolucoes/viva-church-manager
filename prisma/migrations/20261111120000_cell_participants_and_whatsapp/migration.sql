ALTER TABLE "Cell" ADD COLUMN "leaderWhatsapp" TEXT;
ALTER TABLE "Member" ADD COLUMN "cellId" TEXT;

CREATE INDEX "Member_cellId_idx" ON "Member"("cellId");
ALTER TABLE "Member" ADD CONSTRAINT "Member_cellId_fkey"
    FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE SET NULL ON UPDATE CASCADE;
