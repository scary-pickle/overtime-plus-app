import { OvertimeLog } from '../types';
import dayjs from 'dayjs';

export type DateRange = { start: string; end: string };

export function getLast30DaysRange(now: Date = new Date()): DateRange {
  const end = dayjs(now).endOf('day');
  const start = end.subtract(29, 'day').startOf('day');
  return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') };
}

export function getThisWeekRange(now: Date = new Date()): DateRange {
  const end = dayjs(now).endOf('week');
  const start = dayjs(now).startOf('week');
  return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') };
}

export function getThisMonthRange(now: Date = new Date()): DateRange {
  const end = dayjs(now).endOf('month');
  const start = dayjs(now).startOf('month');
  return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') };
}

export function getLogsInRange(logs: OvertimeLog[], range: DateRange): OvertimeLog[] {
  return logs.filter((l) => l.date >= range.start && l.date <= range.end);
}

export function bucketByDay(logs: OvertimeLog[], range: DateRange): { date: string; minutes: number }[] {
  const start = dayjs(range.start);
  const end = dayjs(range.end);
  const days: { [date: string]: number } = {};
  for (let d = start; d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
    days[d.format('YYYY-MM-DD')] = 0;
  }
  for (const l of logs) {
    if (days[l.date] !== undefined) {
      days[l.date] += l.minutesOvertime || 0;
    }
  }
  return Object.keys(days).sort().map((date) => ({ date, minutes: days[date] }));
}

export function bucketByWeek(logs: OvertimeLog[]): { week: string; minutes: number }[] {
  const map: Record<string, number> = {};
  for (const l of logs) {
    const w = dayjs(l.date).startOf('week').format('YYYY-[W]WW');
    map[w] = (map[w] || 0) + (l.minutesOvertime || 0);
  }
  return Object.keys(map)
    .sort()
    .map((k) => ({ week: k, minutes: map[k] }));
}

export function bucketByMonth(logs: OvertimeLog[]): { month: string; minutes: number }[] {
  const map: Record<string, number> = {};
  for (const l of logs) {
    const m = dayjs(l.date).startOf('month').format('YYYY-MM');
    map[m] = (map[m] || 0) + (l.minutesOvertime || 0);
  }
  return Object.keys(map)
    .sort()
    .map((k) => ({ month: k, minutes: map[k] }));
}

export function getCategoryBreakdown(logs: OvertimeLog[]): { category: string; minutes: number }[] {
  const map: Record<string, number> = {};
  for (const l of logs) {
    const key = l.category || 'Other';
    map[key] = (map[key] || 0) + (l.minutesOvertime || 0);
  }
  return Object.keys(map)
    .map((k) => ({ category: k, minutes: map[k] }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function sumMinutes(logs: OvertimeLog[]): number {
  return logs.reduce((sum, l) => sum + (l.minutesOvertime || 0), 0);
}

export function getPeriodComparison(current: number, previous: number) {
  const delta = current - previous;
  const pct = previous === 0 ? (current > 0 ? 100 : 0) : (delta / previous) * 100;
  return { delta, pct };
}

export function getFortnightSummary(now: Date = new Date(), logs: OvertimeLog[]) {
  const end = dayjs(now).endOf('day');
  const start = end.subtract(13, 'day').startOf('day');
  const range: DateRange = { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') };
  const inRange = getLogsInRange(logs, range);
  return sumMinutes(inRange);
}


