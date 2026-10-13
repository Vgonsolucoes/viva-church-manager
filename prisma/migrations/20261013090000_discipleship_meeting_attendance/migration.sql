-- Adiciona campo de presença individual do discípulo no encontro de discipulado.
-- null = não informado | true = presente | false = ausente.
-- Encontros cancelados (status MISSED) e não informados (attendance null) não contam como ausência.
ALTER TABLE "DiscipleshipMeeting" ADD COLUMN "attendance" BOOLEAN;

-- Backfill: encontros históricos concluídos passam a constar como presença confirmada.
UPDATE "DiscipleshipMeeting" SET "attendance" = true WHERE "status" = 'COMPLETED';

-- Índice para cálculo de sequência de ausências por vínculo.
CREATE INDEX "DiscipleshipMeeting_discipleshipId_attendance_idx" ON "DiscipleshipMeeting"("discipleshipId", "attendance");
