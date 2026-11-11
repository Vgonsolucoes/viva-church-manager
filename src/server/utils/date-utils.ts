import { churchDateKey, churchDateTime } from "@/lib/weekly-services";

export function calculateNextWeekdayMeeting(weekday: number, time: string): Date {
  const now = new Date();
  const [hoursStr, minutesStr] = time.split(":");
  const hours = Math.min(23, Math.max(0, parseInt(hoursStr, 10) || 0));
  const minutes = Math.min(59, Math.max(0, parseInt(minutesStr, 10) || 0));
  const clock = String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
  const day = new Date(churchDateKey(now) + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() + (weekday - day.getUTCDay() + 7) % 7);
  const meeting = churchDateTime(day.toISOString().slice(0, 10), clock);
  if (meeting > now) return meeting;
  day.setUTCDate(day.getUTCDate() + 7);
  return churchDateTime(day.toISOString().slice(0, 10), clock);
}
