-- Adiciona campos de trilha obrigatória ao modelo Course
ALTER TABLE "Course" ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN "trackOrder" INTEGER;

-- Cria o enum CourseCompletionSource
CREATE TYPE "CourseCompletionSource" AS ENUM ('VIVA_CHURCH', 'PREVIOUS', 'OTHER_CHURCH');

-- Cria a tabela CourseCompletion
CREATE TABLE "CourseCompletion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "source" "CourseCompletionSource" NOT NULL DEFAULT 'VIVA_CHURCH',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseCompletion_pkey" PRIMARY KEY ("id")
);

-- Constraint única: uma conclusão ativa por curso+membro
CREATE UNIQUE INDEX "CourseCompletion_courseId_memberId_key" ON "CourseCompletion"("courseId", "memberId");

-- Foreign keys
ALTER TABLE "CourseCompletion" ADD CONSTRAINT "CourseCompletion_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseCompletion" ADD CONSTRAINT "CourseCompletion_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseCompletion" ADD CONSTRAINT "CourseCompletion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índices
CREATE INDEX "CourseCompletion_memberId_idx" ON "CourseCompletion"("memberId");
CREATE INDEX "CourseCompletion_courseId_idx" ON "CourseCompletion"("courseId");
CREATE INDEX "CourseCompletion_completedAt_idx" ON "CourseCompletion"("completedAt");

-- Índice para isRequired em Course
CREATE INDEX "Course_isRequired_idx" ON "Course"("isRequired");
