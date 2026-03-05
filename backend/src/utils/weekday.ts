import { Weekday } from "@prisma/client";

export function getWeekdayUTC(date: Date = new Date()): Weekday {
  // JS: 0=Sun..6=Sat; DB enum includes SUN
  const day = date.getUTCDay();
  switch (day) {
    case 0:
      return Weekday.SUN;
    case 1:
      return Weekday.MON;
    case 2:
      return Weekday.TUE;
    case 3:
      return Weekday.WED;
    case 4:
      return Weekday.THU;
    case 5:
      return Weekday.FRI;
    case 6:
      return Weekday.SAT;
    default:
      return Weekday.MON;
  }
}

export function getUTCDayRange(date: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const end = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
  return { start, end };
}
