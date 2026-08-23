import { normalizeDate, normalizeTasks } from "./model.js";

export const ALL_WEEKDAYS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

export const TIMELINE_SCALES = Object.freeze({
  day: Object.freeze({ id: "day", dayWidth: 60, label: "Day" }),
  week: Object.freeze({ id: "week", dayWidth: 32, label: "Week" }),
  month: Object.freeze({ id: "month", dayWidth: 20, label: "Month" }),
});

// Kept as an alias because the migration plan and existing Gantt use this name.
export const SCALES = TIMELINE_SCALES;

export const GROUP_HEADER_HEIGHT = 40;
export const TASK_ROW_HEIGHT = 36;
export const HEADER_HEIGHT = 72;
export const BAR_HEIGHT = 24;
export const BAR_PADDING = (TASK_ROW_HEIGHT - BAR_HEIGHT) / 2;
export const TIMELINE_EDGE_BUFFER_CELLS = 2;

export const DEFAULT_TIMELINE_RANGE = Object.freeze({
  pastDays: 7,
  futureDays: 90,
});

export function startOfCalendarDay(value) {
  const date = normalizeDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addCalendarDays(value, days) {
  if (!Number.isInteger(days)) throw new TypeError("days must be an integer");
  const date = normalizeDate(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function calendarDaysBetween(firstValue, secondValue) {
  const first = normalizeDate(firstValue);
  const second = normalizeDate(secondValue);
  const firstUtcDay = Date.UTC(
    first.getFullYear(),
    first.getMonth(),
    first.getDate(),
  );
  const secondUtcDay = Date.UTC(
    second.getFullYear(),
    second.getMonth(),
    second.getDate(),
  );
  return Math.round((secondUtcDay - firstUtcDay) / 86_400_000);
}

/** Normalizes all timeline boundaries to local midnight or local noon. */
export function normalizeTimelineBoundary(value) {
  const date = normalizeDate(value);
  const isExactNoon =
    date.getHours() === 12 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0;
  const boundary = startOfCalendarDay(date);
  if (isExactNoon) boundary.setHours(12);
  return boundary;
}

export function normalizeVisibleWeekdays(value = ALL_WEEKDAYS) {
  if (value === undefined || value === null) return ALL_WEEKDAYS;
  if (!Array.isArray(value) && !(value instanceof Set)) {
    throw new TypeError("visibleWeekdays must be an array or Set");
  }
  const weekdays = [
    ...new Set(
      [...value].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ].sort((first, second) => first - second);
  if (weekdays.length === 0)
    throw new RangeError("visibleWeekdays must contain at least one weekday");
  return Object.freeze(weekdays);
}

export function isVisibleTimelineDate(value, visibleWeekdays = ALL_WEEKDAYS) {
  const weekdays = normalizeVisibleWeekdays(visibleWeekdays);
  return weekdays.includes(normalizeDate(value).getDay());
}

export function buildVisibleDates(
  minValue,
  maxValue,
  visibleWeekdays = ALL_WEEKDAYS,
) {
  const weekdays = normalizeVisibleWeekdays(visibleWeekdays);
  const cursor = startOfCalendarDay(minValue);
  const end = startOfCalendarDay(maxValue);
  if (cursor.getTime() > end.getTime()) return Object.freeze([]);

  const dates = [];
  while (cursor.getTime() <= end.getTime()) {
    if (weekdays.includes(cursor.getDay()))
      dates.push(Object.freeze(new Date(cursor.getTime())));
    cursor.setDate(cursor.getDate() + 1);
  }
  return Object.freeze(dates);
}

function boundaryFraction(value, visibleWeekdays) {
  const boundary = normalizeTimelineBoundary(value);
  return visibleWeekdays.includes(boundary.getDay()) &&
    boundary.getHours() === 12
    ? 0.5
    : 0;
}

/**
 * Returns compressed timeline units between two local calendar boundaries.
 * Hidden weekdays consume zero width. Noon consumes half of a visible day.
 */
export function visibleUnitsBetween(
  originValue,
  targetValue,
  visibleWeekdays = ALL_WEEKDAYS,
) {
  const weekdays = normalizeVisibleWeekdays(visibleWeekdays);
  const origin = normalizeTimelineBoundary(originValue);
  const target = normalizeTimelineBoundary(targetValue);

  if (origin.getTime() === target.getTime()) return 0;
  if (origin.getTime() > target.getTime()) {
    return -visibleUnitsBetween(target, origin, weekdays);
  }

  const originDay = startOfCalendarDay(origin);
  const targetDay = startOfCalendarDay(target);
  let units = -boundaryFraction(origin, weekdays);
  const cursor = new Date(originDay.getTime());

  while (cursor.getTime() < targetDay.getTime()) {
    if (weekdays.includes(cursor.getDay())) units += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return units + boundaryFraction(target, weekdays);
}

function nextVisibleHalfDayBoundary(value, direction, visibleWeekdays) {
  const current = normalizeTimelineBoundary(value);

  if (direction > 0) {
    while (!visibleWeekdays.includes(current.getDay())) {
      current.setDate(current.getDate() + 1);
      current.setHours(0);
    }
    if (current.getHours() === 0) {
      current.setHours(12);
      return current;
    }
    do {
      current.setDate(current.getDate() + 1);
      current.setHours(0);
    } while (!visibleWeekdays.includes(current.getDay()));
    return current;
  }

  if (visibleWeekdays.includes(current.getDay()) && current.getHours() === 12) {
    current.setHours(0);
    return current;
  }
  do {
    current.setDate(current.getDate() - 1);
    current.setHours(12);
  } while (!visibleWeekdays.includes(current.getDay()));
  return current;
}

export function shiftByVisibleUnits(
  value,
  units,
  visibleWeekdays = ALL_WEEKDAYS,
) {
  if (!Number.isFinite(units)) throw new TypeError("units must be finite");
  const weekdays = normalizeVisibleWeekdays(visibleWeekdays);
  const halfSteps = Math.round(Math.abs(units) * 2);
  const direction = units >= 0 ? 1 : -1;
  let result = normalizeTimelineBoundary(value);

  for (let index = 0; index < halfSteps; index += 1) {
    result = nextVisibleHalfDayBoundary(result, direction, weekdays);
  }
  return result;
}

export function getTimelineScale(scale = "day") {
  if (typeof scale === "number") {
    if (!Number.isFinite(scale) || scale <= 0)
      throw new RangeError("dayWidth must be greater than zero");
    return Object.freeze({ id: "custom", dayWidth: scale, label: "Custom" });
  }
  if (
    scale &&
    typeof scale === "object" &&
    Number.isFinite(scale.dayWidth) &&
    scale.dayWidth > 0
  ) {
    return Object.freeze({
      id: scale.id ?? "custom",
      dayWidth: scale.dayWidth,
      label: scale.label ?? "Custom",
    });
  }
  const resolved = TIMELINE_SCALES[scale];
  if (!resolved) throw new RangeError(`Unsupported timeline scale: ${scale}`);
  return resolved;
}

export function snapIncrementUnits(snapIncrement = "day") {
  if (snapIncrement === "day") return 1;
  if (snapIncrement === "half-day") return 0.5;
  throw new RangeError(`Unsupported snap increment: ${snapIncrement}`);
}

export function snapPixelDelta(
  pixelDelta,
  scale = "day",
  snapIncrement = "day",
) {
  if (!Number.isFinite(pixelDelta))
    throw new TypeError("pixelDelta must be finite");
  const { dayWidth } = getTimelineScale(scale);
  const snapUnits = snapIncrementUnits(snapIncrement);
  const increments = pixelDelta / (dayWidth * snapUnits);
  const snappedIncrements = Math.round(Math.abs(increments));
  return snappedIncrements === 0
    ? 0
    : Math.sign(increments) * snappedIncrements * snapUnits;
}

function workstreamIdOf(task) {
  return task.groupName ?? task.workstreamId ?? task.group ?? null;
}

function taskSortDate(task) {
  return normalizeDate(
    task.earliestStart ?? task.plannedStart ?? task.startDate,
  );
}

function compareTasks(first, second) {
  const dateDifference =
    taskSortDate(first).getTime() - taskSortDate(second).getTime();
  if (dateDifference !== 0) return dateDifference;
  if (Boolean(first.isCriticalPath) !== Boolean(second.isCriticalPath))
    return first.isCriticalPath ? -1 : 1;

  const firstCreated = first.createdAt
    ? normalizeDate(first.createdAt).getTime()
    : Number.MAX_SAFE_INTEGER;
  const secondCreated = second.createdAt
    ? normalizeDate(second.createdAt).getTime()
    : Number.MAX_SAFE_INTEGER;
  if (firstCreated !== secondCreated) return firstCreated - secondCreated;
  return first.id.localeCompare(second.id);
}

function normalizeWorkstreams(workstreams, tasks) {
  if (!Array.isArray(workstreams))
    throw new TypeError("workstreams must be an array");
  const normalized = [];
  const knownIds = new Set();

  for (const workstream of workstreams) {
    const id = typeof workstream === "string" ? workstream : workstream?.id;
    if (typeof id !== "string" || id.trim() === "")
      throw new TypeError("Every workstream requires a non-empty ID");
    if (knownIds.has(id)) throw new Error(`Duplicate workstream ID: ${id}`);
    knownIds.add(id);
    normalized.push(
      Object.freeze({
        ...(typeof workstream === "object" ? workstream : {}),
        id,
        label:
          typeof workstream === "object" && workstream.label
            ? workstream.label
            : id,
      }),
    );
  }

  for (const task of tasks) {
    const id = workstreamIdOf(task);
    if (id === null) continue;
    if (!knownIds.has(id)) {
      knownIds.add(id);
      normalized.push(Object.freeze({ id, label: id }));
    }
  }
  return normalized;
}

const taskMatchesQuery = (task, normalizedQuery) => {
  if (!normalizedQuery) return true;
  const assigneeName = task.assignee?.name ?? "";
  return (
    String(task.name ?? task.title).toLowerCase().includes(normalizedQuery) ||
    String(assigneeName).toLowerCase().includes(normalizedQuery)
  );
};

function taskBelongsTo(task, workstreamId) {
  return workstreamIdOf(task) === workstreamId;
}

function appendTaskRows(rows, tasks, normalizedQuery) {
  let y = rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].height : 0;
  for (const task of tasks) {
    if (!taskMatchesQuery(task, normalizedQuery)) continue;
    rows.push(
      Object.freeze({ type: "task", task, y, height: TASK_ROW_HEIGHT }),
    );
    y += TASK_ROW_HEIGHT;
  }
}

/**
 * Builds deterministic group/task rows without consulting dependency edges.
 * This separation is intentional: workstream grouping is never a graph tree.
 *
 * When `order` is omitted the rows fall back to the date-sort, preserving the
 * historical default. When provided, `order` is an explicit flat sequence of
 * `{ type: "workstream" | "task", id }` entries that fully determines the row
 * sequence (workstream headers, task order, cross-workstream placement, and
 * ungrouped rows). A task that is not present in `order` is appended after its
 * owning workstream header (or as a bare row when ungrouped), so newly created
 * tasks always render even before the engine reconciles its order list.
 */
export function buildVisibleRows(
  sourceTasks,
  workstreams = [],
  expandedWorkstreams,
  query = "",
  order,
) {
  const tasks = normalizeTasks(sourceTasks);
  const orderedWorkstreams = normalizeWorkstreams(workstreams, tasks);
  const expanded =
    expandedWorkstreams === undefined || expandedWorkstreams === null
      ? new Set(orderedWorkstreams.map((workstream) => workstream.id))
      : new Set(expandedWorkstreams);
  const normalizedQuery = String(query).trim().toLowerCase();

  if (order === undefined || order === null) {
    return buildVisibleRowsByDateSort(
      tasks,
      orderedWorkstreams,
      expanded,
      normalizedQuery,
    );
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const workstreamById = new Map(
    orderedWorkstreams.map((workstream) => [workstream.id, workstream]),
  );
  const seenTaskIds = new Set();
  const rows = [];
  let y = 0;
  // Sentinel used to distinguish a collapsed header (its tasks are hidden)
  // from the ungrouped tail (bare rows are allowed).
  const COLLAPSED = Symbol("collapsed");
  let currentGroupState = null;

  for (const entry of order) {
    if (entry?.type === "workstream") {
      const workstream = workstreamById.get(entry.id);
      if (!workstream) continue;
      const groupTasks = tasks.filter((task) => taskBelongsTo(task, entry.id));
      rows.push(
        Object.freeze({
          type: "group-header",
          group: workstream.id,
          workstream,
          taskCount: groupTasks.filter((task) =>
            taskMatchesQuery(task, normalizedQuery),
          ).length,
          y,
          height: GROUP_HEADER_HEIGHT,
        }),
      );
      y += GROUP_HEADER_HEIGHT;
      currentGroupState = expanded.has(workstream.id)
        ? workstream.id
        : COLLAPSED;
      continue;
    }
    if (entry?.type === "task") {
      const task = taskById.get(entry.id);
      if (!task) continue;
      seenTaskIds.add(entry.id);
      const belongs = workstreamIdOf(task);
      if (belongs === null) {
        // Ungrouped task: bare row, hidden while inside a collapsed header's
        // block.
        if (currentGroupState === COLLAPSED) continue;
        if (!taskMatchesQuery(task, normalizedQuery)) continue;
        rows.push(
          Object.freeze({ type: "task", task, y, height: TASK_ROW_HEIGHT }),
        );
        y += TASK_ROW_HEIGHT;
        continue;
      }
      // Grouped task: only render under its own expanded header.
      if (currentGroupState !== belongs) continue;
      if (!taskMatchesQuery(task, normalizedQuery)) continue;
      rows.push(
        Object.freeze({ type: "task", task, y, height: TASK_ROW_HEIGHT }),
      );
      y += TASK_ROW_HEIGHT;
      continue;
    }
  }

  // Append any tasks not present in the order (e.g. freshly created before the
  // engine reconciles its order list). Grouped tasks land after their owning
  // header when it is expanded; ungrouped tasks land as bare rows at the end.
  const missing = tasks.filter((task) => !seenTaskIds.has(task.id));
  const missingGrouped = new Map();
  const missingUngrouped = [];
  for (const task of missing) {
    const group = workstreamIdOf(task);
    if (group === null) missingUngrouped.push(task);
    else {
      if (!missingGrouped.has(group)) missingGrouped.set(group, []);
      missingGrouped.get(group).push(task);
    }
  }
  for (const [group, groupTasks] of missingGrouped) {
    const headerIndex = rows.findIndex(
      (row) => row.type === "group-header" && row.group === group,
    );
    if (headerIndex === -1) continue;
    if (!expanded.has(group)) continue;
    // Append missing tasks after the group's existing task rows (the last row
    // owned by this header), falling back to right after the header when none.
    groupTasks.sort(compareTasks);
    let blockEnd = headerIndex;
    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      if (rows[index].type === "group-header") break;
      blockEnd = index;
    }
    const insertAt = blockEnd + 1;
    const inserted = [];
    let cursor = rows[blockEnd].y + rows[blockEnd].height;
    for (const task of groupTasks) {
      if (!taskMatchesQuery(task, normalizedQuery)) continue;
      inserted.push(
        Object.freeze({ type: "task", task, y: cursor, height: TASK_ROW_HEIGHT }),
      );
      cursor += TASK_ROW_HEIGHT;
    }
    rows.splice(insertAt, 0, ...inserted);
    let yy = rows[insertAt].y + inserted.reduce((sum, row) => sum + row.height, 0);
    for (let index = insertAt + inserted.length; index < rows.length; index += 1) {
      rows[index] = Object.freeze({ ...rows[index], y: yy });
      yy += rows[index].height;
    }
  }
  missingUngrouped.sort(compareTasks);
  appendTaskRows(rows, missingUngrouped, normalizedQuery);

  return Object.freeze(rows);
}

function buildVisibleRowsByDateSort(
  tasks,
  orderedWorkstreams,
  expanded,
  normalizedQuery,
) {
  const rows = [];
  let y = 0;

  for (const workstream of orderedWorkstreams) {
    let groupTasks = tasks
      .filter((task) => workstreamIdOf(task) === workstream.id)
      .sort(compareTasks);

    if (normalizedQuery) {
      groupTasks = groupTasks.filter((task) => taskMatchesQuery(task, normalizedQuery));
      if (groupTasks.length === 0) continue;
    }

    rows.push(
      Object.freeze({
        type: "group-header",
        group: workstream.id,
        workstream,
        taskCount: groupTasks.length,
        y,
        height: GROUP_HEADER_HEIGHT,
      }),
    );
    y += GROUP_HEADER_HEIGHT;

    if (!expanded.has(workstream.id)) continue;
    appendTaskRows(rows, groupTasks, normalizedQuery);
    y = rows[rows.length - 1].y + rows[rows.length - 1].height;
  }

  const ungroupedTasks = tasks
    .filter((task) => workstreamIdOf(task) === null)
    .sort(compareTasks);
  appendTaskRows(rows, ungroupedTasks, normalizedQuery);

  return Object.freeze(rows);
}

/**
 * Returns the default flat order (workstream headers then their date-sorted
 * tasks, ungrouped tasks last) for a task/workstream set. Used to seed the
 * engine's explicit row order so an initial state matches the date-sort.
 */
export function defaultRowOrder(sourceTasks, workstreams = []) {
  const tasks = normalizeTasks(sourceTasks);
  const orderedWorkstreams = normalizeWorkstreams(workstreams, tasks);
  const order = [];
  for (const workstream of orderedWorkstreams) {
    order.push({ type: "workstream", id: workstream.id });
    tasks
      .filter((task) => taskBelongsTo(task, workstream.id))
      .sort(compareTasks)
      .forEach((task) => order.push({ type: "task", id: task.id }));
  }
  tasks
    .filter((task) => taskBelongsTo(task, null))
    .sort(compareTasks)
    .forEach((task) => order.push({ type: "task", id: task.id }));
  return Object.freeze(order);
}

/**
 * Reconciles a flat order against the current tasks/workstreams so it always
 * contains exactly one entry per live workstream and task, preserves the
 * relative order of existing entries, drops entries for removed items, appends
 * headers for new workstreams, and places new tasks after their owning header
 * (or at the end when ungrouped). Returns a frozen copy.
 */
export function reconcileRowOrder(order, sourceTasks, workstreams = []) {
  const tasks = normalizeTasks(sourceTasks);
  const orderedWorkstreams = normalizeWorkstreams(workstreams, tasks);
  const workstreamIds = new Set(orderedWorkstreams.map((item) => item.id));
  const taskIds = new Set(tasks.map((task) => task.id));
  const seenWorkstreams = new Set();
  const seenTasks = new Set();
  const next = [];

  for (const entry of order ?? []) {
    if (entry?.type === "workstream" && workstreamIds.has(entry.id)) {
      seenWorkstreams.add(entry.id);
      next.push({ type: "workstream", id: entry.id });
    } else if (entry?.type === "task" && taskIds.has(entry.id)) {
      seenTasks.add(entry.id);
      next.push({ type: "task", id: entry.id });
    }
  }

  for (const workstream of orderedWorkstreams) {
    if (seenWorkstreams.has(workstream.id)) continue;
    seenWorkstreams.add(workstream.id);
    next.push({ type: "workstream", id: workstream.id });
  }

  const missingGrouped = new Map();
  const missingUngrouped = [];
  for (const task of tasks) {
    if (seenTasks.has(task.id)) continue;
    const group = workstreamIdOf(task);
    if (group === null) missingUngrouped.push(task);
    else {
      if (!missingGrouped.has(group)) missingGrouped.set(group, []);
      missingGrouped.get(group).push(task);
    }
  }
  for (const groupTasks of missingGrouped.values()) {
    groupTasks.sort(compareTasks);
  }
  missingUngrouped.sort(compareTasks);

  const result = [];
  for (const entry of next) {
    result.push(entry);
    if (entry.type !== "workstream") continue;
    const appended = missingGrouped.get(entry.id) ?? [];
    for (const task of appended) result.push({ type: "task", id: task.id });
    missingGrouped.delete(entry.id);
  }
  for (const task of missingUngrouped) result.push({ type: "task", id: task.id });
  for (const groupTasks of missingGrouped.values()) {
    for (const task of groupTasks) result.push({ type: "task", id: task.id });
  }

  return Object.freeze(result);
}

export function buildRowLayout(rows) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
  let y = 0;
  const layout = rows.map((row) => {
    const height =
      row.type === "group-header" ? GROUP_HEADER_HEIGHT : TASK_ROW_HEIGHT;
    const positionedRow = Object.freeze({ ...row, y, height });
    y += height;
    return positionedRow;
  });
  return Object.freeze(layout);
}

export function computeTimelineRange(sourceTasks, options = {}) {
  const tasks = normalizeTasks(sourceTasks);
  const pastDays = options.pastDays ?? DEFAULT_TIMELINE_RANGE.pastDays;
  const futureDays = options.futureDays ?? DEFAULT_TIMELINE_RANGE.futureDays;
  if (!Number.isInteger(pastDays) || pastDays < 0)
    throw new RangeError("pastDays must be a non-negative integer");
  if (!Number.isInteger(futureDays) || futureDays < 0)
    throw new RangeError("futureDays must be a non-negative integer");

  const anchor = startOfCalendarDay(options.anchorDate ?? new Date());
  const earliest = tasks.reduce(
    (current, task) =>
      task.startDate.getTime() < current.getTime() ? task.startDate : current,
    tasks[0]?.startDate ?? anchor,
  );
  const latest = tasks.reduce(
    (current, task) =>
      task.endDate.getTime() > current.getTime() ? task.endDate : current,
    tasks[0]?.endDate ?? anchor,
  );

  const minDate = options.minDate
    ? startOfCalendarDay(options.minDate)
    : addCalendarDays(startOfCalendarDay(earliest), -pastDays);
  const maxDate = options.maxDate
    ? startOfCalendarDay(options.maxDate)
    : addCalendarDays(startOfCalendarDay(latest), futureDays);
  return Object.freeze({
    minDate: Object.freeze(minDate),
    maxDate: Object.freeze(maxDate),
  });
}

export function dateToX(
  value,
  origin,
  scale = "day",
  visibleWeekdays = ALL_WEEKDAYS,
) {
  return (
    visibleUnitsBetween(origin, value, visibleWeekdays) *
    getTimelineScale(scale).dayWidth
  );
}

export function xToDate(
  x,
  origin,
  scale = "day",
  visibleWeekdays = ALL_WEEKDAYS,
  snapIncrement = "half-day",
) {
  if (!Number.isFinite(x)) throw new TypeError("x must be finite");
  const { dayWidth } = getTimelineScale(scale);
  const snapUnits = snapIncrementUnits(snapIncrement);
  const units = Math.floor(x / dayWidth / snapUnits) * snapUnits;
  return shiftByVisibleUnits(origin, units, visibleWeekdays);
}

export function computeTaskPositions(rows, options = {}) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
  const rangeStart = options.rangeStart ?? options.minDate;
  if (rangeStart === undefined) throw new TypeError("rangeStart is required");

  const scale = getTimelineScale(options.scale ?? "day");
  const visibleWeekdays = normalizeVisibleWeekdays(options.visibleWeekdays);
  const includeHeader = options.includeHeader !== false;
  const headerOffset = includeHeader ? HEADER_HEIGHT : 0;
  const positionedRows = rows.every((row) => Number.isFinite(row.y))
    ? rows
    : buildRowLayout(rows);
  const positions = [];

  for (const row of positionedRows) {
    if (row.type !== "task") continue;
    const startOffset = visibleUnitsBetween(
      rangeStart,
      row.task.startDate,
      visibleWeekdays,
    );
    const duration = visibleUnitsBetween(
      row.task.startDate,
      row.task.endDate,
      visibleWeekdays,
    );
    const width = Math.max(duration * scale.dayWidth, scale.dayWidth / 2);
    positions.push(
      Object.freeze({
        taskId: row.task.id,
        x: startOffset * scale.dayWidth,
        y: headerOffset + row.y + BAR_PADDING,
        width,
        height: BAR_HEIGHT,
        rowY: headerOffset + row.y,
        rowHeight: TASK_ROW_HEIGHT,
      }),
    );
  }

  return Object.freeze(positions);
}

export const buildTaskPositions = computeTaskPositions;

export function computeTimelineData(sourceTasks, options = {}) {
  const range = computeTimelineRange(sourceTasks, options);
  const visibleWeekdays = normalizeVisibleWeekdays(options.visibleWeekdays);
  const scale = getTimelineScale(options.scale ?? "day");
  const visibleDates = buildVisibleDates(
    range.minDate,
    range.maxDate,
    visibleWeekdays,
  );
  return Object.freeze({
    ...range,
    scale,
    visibleDates,
    totalWidth: visibleDates.length * scale.dayWidth,
  });
}
