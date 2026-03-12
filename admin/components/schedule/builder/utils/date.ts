function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function parseISODateOnlyToUTC(dateStr: string): Date | null {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(
    String(dateStr ?? "").trim(),
  );
  if (!m) return null;
  const y = Number(m[1]);
  const mon = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mon) || !Number.isFinite(d)) {
    return null;
  }
  if (mon < 1 || mon > 12) return null;
  if (d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mon - 1, d, 0, 0, 0, 0));
}

export function toISODateOnlyUTC(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}`;
}

export function endOfMonthUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function addDaysUTC(date: Date, days: number) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
      0,
      0,
      0,
      0,
    ),
  );
}

export function generateDatesForMonthFromStartDateUTC(firstLessonDate: string) {
  const start = parseISODateOnlyToUTC(firstLessonDate);
  if (!start) return [] as string[];
  const end = endOfMonthUTC(start);

  const dates: string[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDaysUTC(d, 1)) {
    dates.push(toISODateOnlyUTC(d));
  }
  return dates;
}

export function formatWeekdayUTC(dateStr: string) {
  const d = parseISODateOnlyToUTC(dateStr);
  if (!d) return "";
  const day = d.getUTCDay();
  switch (day) {
    case 0:
      return "Sun";
    case 1:
      return "Mon";
    case 2:
      return "Tue";
    case 3:
      return "Wed";
    case 4:
      return "Thu";
    case 5:
      return "Fri";
    case 6:
      return "Sat";
    default:
      return "";
  }
}

export function formatDateShort(dateStr: string) {
  const d = parseISODateOnlyToUTC(dateStr);
  if (!d) return dateStr;
  return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}`;
}

export function toMonthYearUTC(dateStr: string): {
  month: number;
  year: number;
} {
  const d = parseISODateOnlyToUTC(dateStr) ?? new Date();
  return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}
