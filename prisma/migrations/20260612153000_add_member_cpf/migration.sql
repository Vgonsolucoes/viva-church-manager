ALTER TABLE "Member" ADD COLUMN "cpf" TEXT;

CREATE UNIQUE INDEX "Member_cpf_key" ON "Member"("cpf");

CREATE INDEX "Member_cpf_idx" ON "Member"("cpf");
