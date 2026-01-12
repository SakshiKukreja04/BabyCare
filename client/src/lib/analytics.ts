/**
 * Analytics Utilities
 * Handles monthly care calculations and data aggregation
 */

export interface DailyLog {
  date: string; // ISO date string (YYYY-MM-DD)
  hasLog: boolean;
}

export interface MonthlyAnalytics {
  month: string; // Display name (e.g., "January 2026")
  monthNumber: number; // 0-11
  year: number;
  totalDaysInMonth: number;
  daysWithLogs: number;
  missedDays: number;
  consistency: number; // Percentage
  consistencyLevel: 'Excellent' | 'Good' | 'Needs Attention' | 'Poor';
  dailyLogs: DailyLog[];
}

/**
 * Get current month and year
 */
export function getCurrentMonthInfo() {
  const now = new Date();
  return {
    month: now.getMonth() + 1, // 1-12 (1-indexed for backend compatibility)
    year: now.getFullYear(),
    date: now.getDate(),
  };
}

/**
 * Get month name from month number
 */
export function getMonthName(monthNumber: number): string {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  // monthNumber is 1-indexed (1-12), so subtract 1 for array access
  return months[monthNumber - 1];
}

/**
 * Get number of days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
  // month is 1-indexed (1-12), so we use it directly with new Date(year, month, 0)
  return new Date(year, month, 0).getDate();
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse ISO date string to Date object
 */
export function parseISODate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Group care logs by date and count unique days
 * Returns a set of dates that have at least one log
 */
export function getLogsPerDay(
  careLogs: Array<{ timestamp?: string | Date; createdAt?: string | Date }>
): Set<string> {
  const logsPerDay = new Set<string>();

  careLogs.forEach((log) => {
    try {
      // Handle both timestamp and createdAt fields
      const dateStr = log.timestamp || log.createdAt;
      if (!dateStr) return;

      let date: Date;
      if (typeof dateStr === 'string') {
        date = new Date(dateStr);
      } else {
        date = dateStr as Date;
      }

      if (isNaN(date.getTime())) return;

      const dateISO = formatDateToISO(date);
      logsPerDay.add(dateISO);
    } catch (error) {
      console.error('Error processing log date:', log, error);
    }
  });

  return logsPerDay;
}

/**
 * Get the earliest log date (start date)
 */
export function getStartDate(
  careLogs: Array<{ timestamp?: string | Date; createdAt?: string | Date }>
): Date | null {
  let earliestDate: Date | null = null;

  careLogs.forEach((log) => {
    try {
      const dateStr = log.timestamp || log.createdAt;
      if (!dateStr) return;

      let date: Date;
      if (typeof dateStr === 'string') {
        date = new Date(dateStr);
      } else {
        date = dateStr as Date;
      }

      if (isNaN(date.getTime())) return;

      if (!earliestDate || date < earliestDate) {
        earliestDate = date;
      }
    } catch (error) {
      console.error('Error processing log date:', log, error);
    }
  });

  return earliestDate;
}

/**
 * Count days between two dates (inclusive of both dates)
 */
export function getDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
  return diffDays;
}

/**
 * Calculate monthly analytics
 */
export function calculateMonthlyAnalytics(
  careLogs: Array<{ timestamp?: string | Date; createdAt?: string | Date }>,
  monthNumber: number = getCurrentMonthInfo().month,
  year: number = getCurrentMonthInfo().year
): MonthlyAnalytics {
  const monthName = getMonthName(monthNumber);
  const totalDaysInMonth = getDaysInMonth(year, monthNumber);

  // Get unique days that have at least one log
  const logsPerDay = getLogsPerDay(careLogs);

  // Get the start date (earliest log) within this month
  const startDate = getStartDate(careLogs);
  let daysWithLogs = 0;
  let missedDays = 0;
  let consistency = 0;
  let daysCountedForConsistency = 0;

  if (startDate) {
    // Filter logs for current month (monthNumber is 1-indexed: 1-12)
    const monthLogs = Array.from(logsPerDay).filter((dateISO) => {
      const [logYear, logMonth] = dateISO.split('-').map(Number);
      return logYear === year && logMonth === monthNumber;
    });

    daysWithLogs = monthLogs.length;

    // Calculate the period for consistency: from start date to today (or end of month)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDateObj = new Date(startDate);
    startDateObj.setHours(0, 0, 0, 0);

    // Determine the end date (today or end of month, whichever is earlier)
    // monthNumber is 1-indexed, so we use it directly with new Date(year, monthNumber, 0)
    const endOfMonth = new Date(year, monthNumber, 0);
    endOfMonth.setHours(0, 0, 0, 0);
    const endDate = today < endOfMonth ? today : endOfMonth;

    // Only count days if the start date is within the current month
    const startDateInMonth =
      startDateObj.getFullYear() === year && startDateObj.getMonth() === monthNumber - 1;

    if (startDateInMonth) {
      daysCountedForConsistency = getDaysBetween(startDateObj, endDate);
      missedDays = daysCountedForConsistency - daysWithLogs;
      consistency =
        daysCountedForConsistency > 0
          ? Math.round((daysWithLogs / daysCountedForConsistency) * 100)
          : 0;
    } else {
      // Start date is in a previous month, count all days in this month up to today
      const monthStart = new Date(year, monthNumber - 1, 1);
      monthStart.setHours(0, 0, 0, 0);
      daysCountedForConsistency = getDaysBetween(monthStart, endDate);
      missedDays = daysCountedForConsistency - daysWithLogs;
      consistency =
        daysCountedForConsistency > 0
          ? Math.round((daysWithLogs / daysCountedForConsistency) * 100)
          : 0;
    }
  }

  // Determine consistency level
  let consistencyLevel: 'Excellent' | 'Good' | 'Needs Attention' | 'Poor' = 'Poor';
  if (consistency >= 90) consistencyLevel = 'Excellent';
  else if (consistency >= 70) consistencyLevel = 'Good';
  else if (consistency >= 50) consistencyLevel = 'Needs Attention';

  // Create daily logs array for the entire month
  const dailyLogs: DailyLog[] = [];
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateISO = `${year}-${String(monthNumber + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const logsPerDayArray = Array.from(logsPerDay);
    dailyLogs.push({
      date: dateISO,
      hasLog: logsPerDayArray.includes(dateISO),
    });
  }

  return {
    month: `${monthName} ${year}`,
    monthNumber,
    year,
    totalDaysInMonth,
    daysWithLogs,
    missedDays,
    consistency,
    consistencyLevel,
    dailyLogs,
  };
}

/**
 * Get last N months analytics
 */
export function getLast6MonthsAnalytics(
  careLogs: Array<{ timestamp?: string | Date; createdAt?: string | Date }>
): MonthlyAnalytics[] {
  const { month, year } = getCurrentMonthInfo();
  const results: MonthlyAnalytics[] = [];

  for (let i = 0; i < 6; i++) {
    let currentMonth = month - i;
    let currentYear = year;

    if (currentMonth < 0) {
      currentMonth += 12;
      currentYear -= 1;
    }

    results.push(calculateMonthlyAnalytics(careLogs, currentMonth, currentYear));
  }

  return results;
}

/**
 * Get consistency status with color
 */
export function getConsistencyStatus(
  consistencyLevel: 'Excellent' | 'Good' | 'Needs Attention' | 'Poor'
): {
  color: string;
  bgColor: string;
  icon: 'success' | 'warning' | 'error';
} {
  switch (consistencyLevel) {
    case 'Excellent':
      return { color: 'text-alert-success', bgColor: 'bg-alert-success/10', icon: 'success' };
    case 'Good':
      return { color: 'text-healthcare-mint', bgColor: 'bg-healthcare-mint/10', icon: 'success' };
    case 'Needs Attention':
      return { color: 'text-alert-medium', bgColor: 'bg-alert-medium/10', icon: 'warning' };
    case 'Poor':
      return { color: 'text-alert-high', bgColor: 'bg-alert-high/10', icon: 'error' };
  }
}

/**
 * Get logs grouped by week for chart display (counts total logs, not unique days)
 */
export function getLogsPerWeek(
  careLogs: Array<{ timestamp?: string | Date; createdAt?: string | Date }>,
  monthNumber: number = getCurrentMonthInfo().month,
  year: number = getCurrentMonthInfo().year
): Array<{ week: string; logs: number }> {
  const logsPerWeekMap = new Map<number, number>(); // week number -> log count

  careLogs.forEach((log) => {
    try {
      const dateStr = log.timestamp || log.createdAt;
      if (!dateStr) return;

      let date: Date;
      if (typeof dateStr === 'string') {
        date = new Date(dateStr);
      } else {
        date = dateStr as Date;
      }

      if (isNaN(date.getTime())) return;

      const logYear = date.getFullYear();
      const logMonth = date.getMonth() + 1; // Convert to 1-indexed
      const logDate = date.getDate();

      // Only count logs in the current month (monthNumber is 1-indexed)
      if (logYear !== year || logMonth !== monthNumber) return;

      // Calculate week number based on month weeks
      // Week 1: 1-6, Week 2: 7-12, Week 3: 13-18, Week 4: 19-24, Week 5: 25-31
      let weekNumber: number;
      if (logDate <= 6) weekNumber = 1;
      else if (logDate <= 12) weekNumber = 2;
      else if (logDate <= 18) weekNumber = 3;
      else if (logDate <= 24) weekNumber = 4;
      else weekNumber = 5;

      const currentCount = logsPerWeekMap.get(weekNumber) || 0;
      logsPerWeekMap.set(weekNumber, currentCount + 1);
    } catch (error) {
      console.error('Error processing log date:', log, error);
    }
  });

  // Build the weeks array
  const weeks: Array<{ week: string; logs: number }> = [];

  for (let i = 1; i <= 5; i++) {
    weeks.push({
      week: `Week ${i}`,
      logs: logsPerWeekMap.get(i) || 0,
    });
  }

  return weeks;
}

/**
 * Process weight entries for chart display
 */
export function getWeightChartData(
  weightEntries: Array<{ weight: number; date: string; weekStart?: string; timestamp?: string }>
): Array<{ week: string; weight: number }> {
  // Group weights by week of month
  const weekMap = new Map<string, { weight: number; dates: string[] }>();

  for (const entry of weightEntries) {
    // Use weekStart if available, otherwise calculate from date
    let weekLabel = '';
    const dayNum = parseInt(entry.date.split('-')[2], 10);

    if (dayNum <= 6) {
      weekLabel = 'Week 1';
    } else if (dayNum <= 12) {
      weekLabel = 'Week 2';
    } else if (dayNum <= 18) {
      weekLabel = 'Week 3';
    } else if (dayNum <= 24) {
      weekLabel = 'Week 4';
    } else {
      weekLabel = 'Week 5';
    }

    if (!weekMap.has(weekLabel)) {
      weekMap.set(weekLabel, { weight: entry.weight, dates: [entry.date] });
    } else {
      // Keep the latest weight for the week
      const existing = weekMap.get(weekLabel)!;
      if (entry.date > existing.dates[existing.dates.length - 1]) {
        existing.weight = entry.weight;
      }
      existing.dates.push(entry.date);
    }
  }

  // Convert to array in order (Week 1, Week 2, Week 3, Week 4, Week 5)
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
  const result: Array<{ week: string; weight: number }> = [];

  for (const week of weeks) {
    if (weekMap.has(week)) {
      const data = weekMap.get(week)!;
      result.push({
        week,
        weight: parseFloat(data.weight.toFixed(1)),
      });
    }
  }

  return result;
}

/**
 * Calculate weight trend
 */
export function getWeightTrend(
  weightEntries: Array<{ weight: number; date: string }>
): { trend: 'increasing' | 'decreasing' | 'stable'; change: number } {
  if (weightEntries.length < 2) {
    return { trend: 'stable', change: 0 };
  }

  const sorted = weightEntries.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const first = sorted[0].weight;
  const last = sorted[sorted.length - 1].weight;
  const change = parseFloat((last - first).toFixed(2));

  if (change > 0.1) return { trend: 'increasing', change };
  if (change < -0.1) return { trend: 'decreasing', change };
  return { trend: 'stable', change };}