-- Kids: encerramento automático de sessões (closeReason no ChildCheckIn) — não destrutiva
-- Valores esperados: SERVICE_ENDED (encerramento automático ao fim do culto) | CHECKED_OUT (retirada pelo responsável)
ALTER TABLE "ChildCheckIn" ADD COLUMN "closeReason" TEXT;
