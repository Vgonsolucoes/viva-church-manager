// Constantes da comunicação Kids → Projeção compartilhadas entre servidor e
// componentes cliente. Este módulo NÃO pode importar Prisma ou código de
// servidor — é carregado também no bundle do navegador.

export const KIDS_PROJECTION_PRESETS = [
  "Está chorando",
  "Solicitar responsável",
  "Não está se sentindo bem",
] as const;

export const KIDS_PROJECTION_MESSAGE_MAX = 140;
