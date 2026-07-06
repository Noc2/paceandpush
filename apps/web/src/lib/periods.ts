const dayMs = 24 * 60 * 60 * 1000;

export type PeriodKind = "year" | "month" | "week";

export function currentPeriod(date = new Date()): string {
  return toMonthPeriod(date);
}

export function periodBounds(period: string): { start: string; end: string } {
  const yearMatch = /^(\d{4})$/.exec(period);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return {
      start: toDateString(new Date(Date.UTC(year, 0, 1))),
      end: toDateString(new Date(Date.UTC(year, 11, 31))),
    };
  }

  const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    return {
      start: toDateString(new Date(Date.UTC(year, month - 1, 1))),
      end: toDateString(new Date(Date.UTC(year, month, 0))),
    };
  }

  const weekMatch = /^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/.exec(period);
  if (weekMatch) {
    const start = isoWeekStart(Number(weekMatch[1]), Number(weekMatch[2]));
    if (toIsoWeekPeriod(start) !== period) {
      throw new Error("period uses an invalid ISO week.");
    }
    return {
      start: toDateString(start),
      end: toDateString(addDays(start, 6)),
    };
  }

  throw new Error("period must use YYYY, YYYY-MM, or YYYY-Www format.");
}

export function isSupportedPeriod(period: string): boolean {
  try {
    periodBounds(period);
    return true;
  } catch {
    return false;
  }
}

export function parsePeriod(value: string | null | undefined): string {
  if (value && isSupportedPeriod(value)) {
    return value;
  }
  return currentPeriod();
}

export function periodKind(period: string): PeriodKind {
  if (/^\d{4}$/.test(period)) return "year";
  if (/^\d{4}-W\d{2}$/.test(period)) return "week";
  return "month";
}

export function periodForKind(kind: PeriodKind, date: Date): string {
  if (kind === "year") return String(date.getUTCFullYear());
  if (kind === "week") return toIsoWeekPeriod(date);
  return toMonthPeriod(date);
}

export function periodStartDate(period: string): Date {
  const { start } = periodBounds(period);
  return new Date(`${start}T00:00:00.000Z`);
}

export function shiftPeriod(period: string, offset: number): string {
  const start = periodStartDate(period);
  const kind = periodKind(period);

  if (kind === "year") {
    return String(start.getUTCFullYear() + offset);
  }

  if (kind === "week") {
    return toIsoWeekPeriod(addDays(start, offset * 7));
  }

  return toMonthPeriod(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1)));
}

export function isCurrentOrPreviousPeriod(period: string, date = new Date()): boolean {
  const activePeriod = periodForKind(periodKind(period), date);
  return period === activePeriod || period === shiftPeriod(activePeriod, -1);
}

export function toMonthPeriod(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function formatPeriodLabel(period: string): string {
  if (/^\d{4}$/.test(period)) {
    return period;
  }

  const weekMatch = /^(\d{4})-W(\d{2})$/.exec(period);
  if (weekMatch) {
    return `Week ${Number(weekMatch[2])}, ${weekMatch[1]}`;
  }

  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function toIsoWeekPeriod(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);

  const isoYear = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / dayMs + 1) / 7));

  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * dayMs);
}

export function formatWeekRange(period: string): string {
  const { start, end } = periodBounds(period);
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const sameYear = startDate.getUTCFullYear() === endDate.getUTCFullYear();
  const sameMonth = sameYear && startDate.getUTCMonth() === endDate.getUTCMonth();
  const startLabel = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(startDate);
  const endLabel = new Intl.DateTimeFormat("en", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(endDate);

  return `${startLabel}-${endLabel}`;
}

function isoWeekStart(year: number, week: number): Date {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const day = januaryFourth.getUTCDay() || 7;
  return addDays(januaryFourth, 1 - day + (week - 1) * 7);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
