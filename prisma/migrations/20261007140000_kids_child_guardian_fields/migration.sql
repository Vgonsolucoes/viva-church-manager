-- Kids: campos complementares da criança e vínculo do responsável com Member (não destrutivo)
ALTER TABLE "Child"
  ADD COLUMN "sex" TEXT,
  ADD COLUMN "photoUrl" TEXT,
  ADD COLUMN "medications" TEXT,
  ADD COLUMN "specialNeeds" TEXT,
  ADD COLUMN "emergencyContact" TEXT;

ALTER TABLE "ChildGuardian"
  ADD COLUMN "memberId" TEXT,
  ADD COLUMN "relationship" TEXT;

ALTER TABLE "ChildGuardian"
  ADD CONSTRAINT "ChildGuardian_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ChildGuardian_memberId_idx" ON "ChildGuardian"("memberId");
