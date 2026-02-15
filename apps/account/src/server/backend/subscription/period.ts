export type ApiInterval = "month" | "year";

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lastDayOfUtcMonth(year: number, monthIndex0: number): number {
  // Day 0 of the next month is the last day of the target month.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

export function addUtcMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();
  const ms = date.getUTCMilliseconds();

  const targetMonth = month + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const maxDay = lastDayOfUtcMonth(targetYear, normalizedMonth);
  const clampedDay = clampInt(day, 1, maxDay);

  return new Date(
    Date.UTC(targetYear, normalizedMonth, clampedDay, hour, minute, second, ms),
  );
}

export function addUtcYears(date: Date, years: number): Date {
  return addUtcMonths(date, years * 12);
}

export function addInterval(date: Date, interval: ApiInterval, count = 1): Date {
  return interval === "year" ? addUtcYears(date, count) : addUtcMonths(date, count);
}

export function toApiInterval(value: "MONTH" | "YEAR" | null | undefined): ApiInterval {
  return value === "YEAR" ? "year" : "month";
}

export function toDbInterval(value: ApiInterval): "MONTH" | "YEAR" {
  return value === "year" ? "YEAR" : "MONTH";
}
