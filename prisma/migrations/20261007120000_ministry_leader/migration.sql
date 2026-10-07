-- AlterTable
ALTER TABLE "Ministry" ADD COLUMN     "leaderId" TEXT;

-- CreateIndex
CREATE INDEX "Ministry_leaderId_idx" ON "Ministry"("leaderId");

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
