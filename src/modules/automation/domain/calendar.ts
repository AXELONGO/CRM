export type CalendarInterval = { isoDay: number; startLocal: string; endLocal: string };
export type CalendarException = {
  localDate: string;
  kind: "holiday" | "closed" | "open";
  intervals?: CalendarInterval[];
};
export type BusinessCalendar = {
  timezone: string;
  intervals: readonly CalendarInterval[];
  exceptions: readonly CalendarException[];
};

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function localDate(date: Date, timezone: string) {
  const parts = localParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function isBusinessInstant(date: Date, calendar: BusinessCalendar) {
  const parts = localParts(date, calendar.timezone);
  const dateString = `${parts.year}-${parts.month}-${parts.day}`;
  const exception = calendar.exceptions.find((item) => item.localDate === dateString);
  if (exception?.kind === "holiday" || exception?.kind === "closed") return false;
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: calendar.timezone,
    weekday: "short",
  }).format(date);
  const isoDay =
    (
      { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<
        string,
        number
      >
    )[weekday] ?? 7;
  const intervals =
    exception?.kind === "open" ? (exception.intervals ?? []) : calendar.intervals;
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  return intervals.some(
    (interval) =>
      interval.isoDay === isoDay &&
      current >= minutes(interval.startLocal) &&
      current < minutes(interval.endLocal),
  );
}

export function addBusinessMinutes(
  start: Date,
  amount: number,
  calendar: BusinessCalendar,
) {
  if (!Number.isInteger(amount) || amount < 0)
    throw new Error("invalid_business_minutes");
  const result = new Date(start);
  let remaining = amount;
  while (remaining > 0) {
    result.setUTCMinutes(result.getUTCMinutes() + 1);
    if (isBusinessInstant(result, calendar)) remaining -= 1;
  }
  return result;
}

export function calendarLocalDate(date: Date, timezone: string) {
  return localDate(date, timezone);
}
