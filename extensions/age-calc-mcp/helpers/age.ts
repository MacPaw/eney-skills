export interface Span {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  direction: "past" | "future" | "same";
}

function daysInMonth(year: number, monthZero: number): number {
  return new Date(year, monthZero + 1, 0).getDate();
}

export function spanBetween(from: Date, to: Date): Span {
  const direction: Span["direction"] =
    from.getTime() === to.getTime() ? "same" : from < to ? "past" : "future";

  const earlier = from < to ? from : to;
  const later = from < to ? to : from;

  let years = later.getFullYear() - earlier.getFullYear();
  let months = later.getMonth() - earlier.getMonth();
  let days = later.getDate() - earlier.getDate();

  if (days < 0) {
    months -= 1;
    const borrowedMonth = (later.getMonth() - 1 + 12) % 12;
    const borrowedYear = later.getMonth() === 0 ? later.getFullYear() - 1 : later.getFullYear();
    days += daysInMonth(borrowedYear, borrowedMonth);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const ms = later.getTime() - earlier.getTime();
  const totalDays = Math.floor(ms / 86_400_000);
  const totalHours = Math.floor(ms / 3_600_000);
  const totalMinutes = Math.floor(ms / 60_000);

  return { years, months, days, totalDays, totalHours, totalMinutes, direction };
}
