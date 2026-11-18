ALTER TABLE "Discipleship" ADD COLUMN "coDisciplerId" TEXT;
ALTER TYPE "DiscipleshipHistoryAction" ADD VALUE 'DISCIPLERS_UPDATED';
CREATE INDEX "Discipleship_coDisciplerId_idx" ON "Discipleship"("coDisciplerId");
ALTER TABLE "Discipleship" ADD CONSTRAINT "Discipleship_coDisciplerId_fkey"
    FOREIGN KEY ("coDisciplerId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
