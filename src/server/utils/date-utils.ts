export function calculateNextWeekdayMeeting(weekday: number, time: string): Date {
  const now = new Date();
  const [hoursStr, minutesStr] = time.split(":");
  const hours = parseInt(hoursStr, 10) || 0;
  const minutes = parseInt(minutesStr, 10) || 0;

  const result = new Date(now);
  result.setHours(hours, minutes, 0, 0);

  const currentWeekday = now.getDay();
  let diff = weekday - currentWeekday;

  if (diff < 0 || (diff === 0 && result.getTime() <= now.getTime())) {
    diff += 7;
  }

  result.setDate(result.getDate() + diff);
  return result;
}
