// Accept typed 24-hour times and familiar AM/PM examples without Date timezone conversions.
export function parseTimeInput(value: string, endOfDay = false): number | null {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (minute > 59) return null;
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (match[3].toLowerCase() === "pm" ? 12 : 0);
  }
  if (hour === 24 && minute === 0 && endOfDay) return 1440;
  return hour <= 23 ? hour * 60 + minute : null;
}
