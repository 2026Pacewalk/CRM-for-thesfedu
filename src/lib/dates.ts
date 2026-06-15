// Shared date-range helpers for dashboards and reports (Sections 6 & 7.9).

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// Monday-based start of the current week.
export function startOfWeek(): Date {
  const d = startOfToday();
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d;
}

export function startOfMonth(): Date {
  const d = startOfToday();
  d.setDate(1);
  return d;
}

// `days` ago from now (used for SLA / unattended-lead thresholds).
export function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}
