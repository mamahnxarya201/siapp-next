export type TimelineSnapIncrement = 'day' | 'half-day'
export type TimelineWeekStart = 0 | 1

/**
 * The timeline supports the two conventional calendar week starts. Values use
 * JavaScript's Date#getDay convention: Sunday is 0 and Monday is 1.
 */
export const DEFAULT_TIMELINE_WEEK_START: TimelineWeekStart = 1

export interface GanttDisplaySettings {
  showGrid: boolean
  showWeekSeparators: boolean
  showGroupGrid: boolean
  visibleWeekdays: number[]
  snapIncrement: TimelineSnapIncrement
  weekStart: TimelineWeekStart
}

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]
export const DEFAULT_GANTT_DISPLAY_SETTINGS: GanttDisplaySettings = {
  showGrid: true,
  showWeekSeparators: true,
  showGroupGrid: true,
  visibleWeekdays: ALL_WEEKDAYS,
  snapIncrement: 'day',
  weekStart: DEFAULT_TIMELINE_WEEK_START,
}

export const GANTT_DISPLAY_SETTINGS_KEY = 'pmis:gantt-display-settings:v1'

export function startOfCalendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Converts persisted or user-provided input to a supported calendar week
 * start. Monday is deliberately the fallback so malformed older preferences
 * cannot unexpectedly change the default calendar convention.
 */
export function normalizeTimelineWeekStart(value: unknown): TimelineWeekStart {
  return value === 0 || value === 'sunday' ? 0 : DEFAULT_TIMELINE_WEEK_START
}

/** Returns the local calendar day on which the date's configured week starts. */
export function startOfCalendarWeek(date: Date, weekStart: unknown = DEFAULT_TIMELINE_WEEK_START): Date {
  const normalizedWeekStart = normalizeTimelineWeekStart(weekStart)
  const day = startOfCalendarDay(date)
  const daysSinceWeekStart = (day.getDay() - normalizedWeekStart + 7) % 7
  return addCalendarDays(day, -daysSinceWeekStart)
}

/**
 * A timezone-safe, stable key for grouping timeline dates into calendar weeks.
 * It represents the local date of the week's first day (rather than a locale-
 * dependent week number, whose year boundary rules vary).
 */
export function calendarWeekKey(date: Date, weekStart: unknown = DEFAULT_TIMELINE_WEEK_START): string {
  const weekBeginning = startOfCalendarWeek(date, weekStart)
  const year = weekBeginning.getFullYear()
  const month = String(weekBeginning.getMonth() + 1).padStart(2, '0')
  const day = String(weekBeginning.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calendarDaysBetween(date1: Date, date2: Date): number {
  const first = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate())
  const second = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate())
  return Math.round((second - first) / 86_400_000)
}

export function normalizeTimelineBoundary(date: Date): Date {
  const normalized = startOfCalendarDay(date)
  if (date.getHours() === 12 && date.getMinutes() === 0 && date.getSeconds() === 0) {
    normalized.setHours(12)
  }
  return normalized
}

export function isVisibleTimelineDate(date: Date, visibleWeekdays: number[]): boolean {
  return visibleWeekdays.includes(date.getDay())
}

/**
 * True for the first displayed day in a calendar week. When the configured
 * week-start day is hidden (for example Monday), the separator moves to that
 * week's first visible day instead of disappearing or relying on column index.
 */
export function isVisibleWeekBoundaryDate(
  date: Date,
  visibleWeekdays: number[],
  weekStart: unknown = DEFAULT_TIMELINE_WEEK_START,
): boolean {
  if (!isVisibleTimelineDate(date, visibleWeekdays)) return false

  const weekBeginning = startOfCalendarWeek(date, weekStart)
  const cursor = startOfCalendarDay(date)
  cursor.setDate(cursor.getDate() - 1)

  while (cursor >= weekBeginning) {
    if (isVisibleTimelineDate(cursor, visibleWeekdays)) return false
    cursor.setDate(cursor.getDate() - 1)
  }

  return true
}

export function buildVisibleDates(minDate: Date, maxDate: Date, visibleWeekdays: number[]): Date[] {
  const dates: Date[] = []
  const cursor = startOfCalendarDay(minDate)
  const end = startOfCalendarDay(maxDate)

  while (cursor <= end) {
    if (isVisibleTimelineDate(cursor, visibleWeekdays)) dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function boundaryFraction(date: Date): number {
  return date.getHours() === 12 ? 0.5 : 0
}

export function visibleUnitsBetween(origin: Date, target: Date, visibleWeekdays: number[]): number {
  const originBoundary = normalizeTimelineBoundary(origin)
  const originDay = startOfCalendarDay(originBoundary)
  const targetBoundary = normalizeTimelineBoundary(target)
  const targetDay = startOfCalendarDay(targetBoundary)
  const dayDifference = calendarDaysBetween(originDay, targetDay)
  const originFraction = isVisibleTimelineDate(originDay, visibleWeekdays) ? boundaryFraction(originBoundary) : 0
  let units = 0

  if (dayDifference >= 0) {
    const cursor = new Date(originDay)
    for (let index = 0; index < dayDifference; index += 1) {
      if (isVisibleTimelineDate(cursor, visibleWeekdays)) units += 1
      cursor.setDate(cursor.getDate() + 1)
    }
    if (isVisibleTimelineDate(targetDay, visibleWeekdays)) units += boundaryFraction(targetBoundary)
    return units - originFraction
  }

  const cursor = new Date(targetDay)
  for (let index = dayDifference; index < 0; index += 1) {
    if (isVisibleTimelineDate(cursor, visibleWeekdays)) units -= 1
    cursor.setDate(cursor.getDate() + 1)
  }
  if (isVisibleTimelineDate(targetDay, visibleWeekdays)) units += boundaryFraction(targetBoundary)
  return units - originFraction
}

function nextVisibleHalfDayBoundary(date: Date, direction: 1 | -1, visibleWeekdays: number[]): Date {
  const current = normalizeTimelineBoundary(date)

  if (direction === 1) {
    while (!isVisibleTimelineDate(current, visibleWeekdays)) {
      current.setDate(current.getDate() + 1)
      current.setHours(0)
    }
    if (current.getHours() === 0) {
      current.setHours(12)
      return current
    }
    do {
      current.setDate(current.getDate() + 1)
      current.setHours(0)
    } while (!isVisibleTimelineDate(current, visibleWeekdays))
    return current
  }

  if (isVisibleTimelineDate(current, visibleWeekdays) && current.getHours() === 12) {
    current.setHours(0)
    return current
  }
  do {
    current.setDate(current.getDate() - 1)
    current.setHours(12)
  } while (!isVisibleTimelineDate(current, visibleWeekdays))
  return current
}

export function shiftByVisibleUnits(date: Date, units: number, visibleWeekdays: number[]): Date {
  const halfSteps = Math.round(Math.abs(units) * 2)
  const direction: 1 | -1 = units >= 0 ? 1 : -1
  let result = normalizeTimelineBoundary(date)

  for (let index = 0; index < halfSteps; index += 1) {
    result = nextVisibleHalfDayBoundary(result, direction, visibleWeekdays)
  }
  return result
}

export function parseGanttDisplaySettings(value: string | null): GanttDisplaySettings {
  if (!value) return DEFAULT_GANTT_DISPLAY_SETTINGS
  try {
    const parsed = JSON.parse(value) as Partial<GanttDisplaySettings>
    const weekdays = Array.isArray(parsed.visibleWeekdays)
      ? Array.from(new Set(parsed.visibleWeekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
      : ALL_WEEKDAYS
    return {
      showGrid: typeof parsed.showGrid === 'boolean' ? parsed.showGrid : true,
      showWeekSeparators: typeof parsed.showWeekSeparators === 'boolean' ? parsed.showWeekSeparators : true,
      showGroupGrid: typeof parsed.showGroupGrid === 'boolean' ? parsed.showGroupGrid : true,
      visibleWeekdays: weekdays.length > 0 ? weekdays.sort((a, b) => a - b) : ALL_WEEKDAYS,
      snapIncrement: parsed.snapIncrement === 'half-day' ? 'half-day' : 'day',
      weekStart: normalizeTimelineWeekStart(parsed.weekStart),
    }
  } catch {
    return DEFAULT_GANTT_DISPLAY_SETTINGS
  }
}
