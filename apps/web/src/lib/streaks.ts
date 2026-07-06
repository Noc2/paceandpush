const dayMs = 24 * 60 * 60 * 1000;

export function calculateStreakDays(days: Iterable<string>): number {
  const sortedDays = [...new Set(days)].sort().reverse();
  if (sortedDays.length === 0) return 0;

  let streak = 1;
  let previous = new Date(`${sortedDays[0]}T00:00:00.000Z`);

  for (const day of sortedDays.slice(1)) {
    const current = new Date(`${day}T00:00:00.000Z`);
    const diffDays = (previous.getTime() - current.getTime()) / dayMs;
    if (diffDays !== 1) break;
    streak += 1;
    previous = current;
  }

  return streak;
}
