-- CreateTable
CREATE TABLE "MemberMinistry" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberMinistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberMinistry_memberId_idx" ON "MemberMinistry"("memberId");

-- CreateIndex
CREATE INDEX "MemberMinistry_ministryId_idx" ON "MemberMinistry"("ministryId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberMinistry_memberId_ministryId_key" ON "MemberMinistry"("memberId", "ministryId");

-- AddForeignKey
ALTER TABLE "MemberMinistry" ADD CONSTRAINT "MemberMinistry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberMinistry" ADD CONSTRAINT "MemberMinistry_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
