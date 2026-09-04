const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function pad2(n: number): string {
  return n < 10 ? "0" + n : "" + n;
}

export function weekdayLabel(weekday: number): string {
  const clamped = Math.max(0, Math.min(6, Number(weekday) || 0));
  return WEEKDAYS[clamped] ?? WEEKDAYS[0];
}

export function weekdayShort(weekday: number): string {
  const clamped = Math.max(0, Math.min(6, Number(weekday) || 0));
  return WEEKDAYS_SHORT[clamped] ?? WEEKDAYS_SHORT[0];
}

function fmtBRDate(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtBRTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function diffDays(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatDateTime(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return `${fmtBRDate(d)} ${fmtBRTime(d)}`;
}

export function formatDate(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return fmtBRDate(d);
}

export function formatTime(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return fmtBRTime(d);
}

export function friendlyEventDate(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  ) {
    return `Hoje · ${formatTime(d)}`;
  }
  if (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  ) {
    return `Amanhã · ${formatTime(d)}`;
  }
  const diff = diffDays(d, today);
  if (diff >= 2 && diff <= 6) {
    return `${weekdayShort(d.getDay())} · ${formatTime(d)}`;
  }
  return `${formatDate(d)} · ${formatTime(d)}`;
}

export function formatCurrencyBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return "-";
  const value = cents / 100;
  try {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  } catch {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }
}

export function initialsFromName(name: string | null | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/g).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0] ?? "";
  const second =
    parts.length > 1
      ? parts[parts.length - 1][0] ?? ""
      : parts[0][1] ?? "";
  return (first + second).toUpperCase();
}
