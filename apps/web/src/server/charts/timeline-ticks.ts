import type { ProfileHistoryPoint } from "@paceandpush/api-contracts";

export interface TimelineTick {
  index: number;
  label: string;
  anchor: "start" | "middle" | "end";
}

const dayMs = 24 * 60 * 60 * 1000;

export function profileTimelineTicks(history: ProfileHistoryPoint[]): TimelineTick[] {
  if (history.length === 0) return [];

  const lastIndex = history.length - 1;
  const spanDays = daySpan(history[0]?.date, history[lastIndex]?.date) ?? lastIndex;
  let indices: number[];

  if (spanDays <= 14) {
    indices = evenlySpacedIndices(history.length, Math.min(history.length, 8));
  } else if (spanDays <= 70) {
    indices = intervalTickIndices(history, 7, 4);
  } else if (spanDays <= 370) {
    indices = monthBoundaryTickIndices(history, 1, 21);
  } else {
    indices = monthBoundaryTickIndices(history, 3, 60);
  }

  return indices.map((index) => ({
    index,
    label: formatDateLabel(history[index]?.date ?? ""),
    anchor: tickAnchor(index, lastIndex),
  }));
}

function evenlySpacedIndices(length: number, maxTicks: number): number[] {
  if (length <= 0 || maxTicks <= 0) return [];
  if (length <= maxTicks) return Array.from({ length }, (_, index) => index);

  const lastIndex = length - 1;
  return uniqueSortedIndices(
    Array.from({ length: maxTicks }, (_, tickIndex) =>
      Math.round((tickIndex / (maxTicks - 1)) * lastIndex),
    ),
  );
}

function intervalTickIndices(
  history: ProfileHistoryPoint[],
  intervalDays: number,
  minDaysBeforeEnd: number,
): number[] {
  const lastIndex = history.length - 1;
  const firstDay = parseDay(history[0]?.date);
  const lastDay = parseDay(history[lastIndex]?.date);
  if (firstDay === null || lastDay === null) {
    return evenlySpacedIndices(history.length, Math.min(history.length, 8));
  }

  const indices = [0];
  let nextTarget = firstDay + intervalDays;

  for (let index = 1; index < lastIndex; index += 1) {
    const day = parseDay(history[index]?.date);
    if (day === null || day < nextTarget) continue;

    if (lastDay - day >= minDaysBeforeEnd) {
      indices.push(index);
    }
    while (nextTarget <= day) {
      nextTarget += intervalDays;
    }
  }

  indices.push(lastIndex);
  return uniqueSortedIndices(indices);
}

function monthBoundaryTickIndices(
  history: ProfileHistoryPoint[],
  monthStep: number,
  minDaysBeforeEnd: number,
): number[] {
  const lastIndex = history.length - 1;
  const firstMonth = monthIndex(history[0]?.date);
  const lastDay = parseDay(history[lastIndex]?.date);
  if (firstMonth === null || lastDay === null) {
    return evenlySpacedIndices(history.length, Math.min(history.length, 10));
  }

  const indices = [0];
  let previousMonth = firstMonth;

  for (let index = 1; index < lastIndex; index += 1) {
    const currentMonth = monthIndex(history[index]?.date);
    const day = parseDay(history[index]?.date);
    if (currentMonth === null || day === null || currentMonth === previousMonth) continue;

    const monthsSinceStart = currentMonth - firstMonth;
    if (monthsSinceStart % monthStep === 0 && lastDay - day >= minDaysBeforeEnd) {
      indices.push(index);
    }
    previousMonth = currentMonth;
  }

  indices.push(lastIndex);
  return uniqueSortedIndices(indices);
}

function tickAnchor(index: number, lastIndex: number): TimelineTick["anchor"] {
  if (index === 0) return "start";
  if (index === lastIndex) return "end";
  return "middle";
}

function uniqueSortedIndices(indices: number[]): number[] {
  return [...new Set(indices)].sort((left, right) => left - right);
}

function formatDateLabel(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(5) : date;
}

function daySpan(start: string | undefined, end: string | undefined): number | null {
  const startDay = parseDay(start);
  const endDay = parseDay(end);
  return startDay === null || endDay === null ? null : Math.max(0, endDay - startDay);
}

function parseDay(date: string | undefined): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return Date.UTC(year, month - 1, day) / dayMs;
}

function monthIndex(date: string | undefined): number | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date ?? "");
  if (!match) return null;

  return Number(match[1]) * 12 + Number(match[2]) - 1;
}
