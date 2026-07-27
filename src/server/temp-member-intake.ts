function parseBooleanEnv(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isTempMemberIntakeEnabled() {
  return parseBooleanEnv(process.env.TEMP_MEMBER_INTAKE_ENABLED);
}

export function getTempMemberIntakePath() {
  return "/cadastro-temporario/membros";
}
