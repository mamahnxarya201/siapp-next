import { normalizeDate, normalizeTasks, predecessorIdsOf } from './model.js'
import {
  ALL_WEEKDAYS,
  getTimelineScale,
  normalizeTimelineBoundary,
  normalizeVisibleWeekdays,
  shiftByVisibleUnits,
  snapIncrementUnits,
  snapPixelDelta,
  visibleUnitsBetween,
} from './timeline.js'

function datePair(value, label = 'dates') {
  if (!value || typeof value !== 'object') throw new TypeError(`${label} are required`)
  const startInput = value.startDate ?? value.start ?? value.dates?.start
  const endInput = value.endDate ?? value.end ?? value.dates?.end
  if (startInput === undefined || endInput === undefined) {
    throw new TypeError(`${label} must contain start/startDate and end/endDate`)
  }
  const startDate = normalizeTimelineBoundary(normalizeDate(startInput, `${label}.start`))
  const endDate = normalizeTimelineBoundary(normalizeDate(endInput, `${label}.end`))
  if (endDate.getTime() < startDate.getTime()) {
    throw new RangeError(`${label}.end must not be before ${label}.start`)
  }
  return { startDate, endDate }
}

function taskLookup(tasksOrLookup) {
  if (tasksOrLookup instanceof Map) return tasksOrLookup
  if (Array.isArray(tasksOrLookup)) return new Map(tasksOrLookup.map((task) => [task.id, task]))
  if (tasksOrLookup && typeof tasksOrLookup === 'object') return new Map(Object.entries(tasksOrLookup))
  throw new TypeError('tasks must be an array, Map, or object keyed by task ID')
}

function taskEnd(task) {
  return normalizeTimelineBoundary(task.endDate ?? task.dates?.end)
}

export function latestPredecessorEnd(task, tasksOrLookup) {
  if (!task || typeof task !== 'object') throw new TypeError('task is required')
  const byId = taskLookup(tasksOrLookup)
  let latest = null
  for (const predecessorId of predecessorIdsOf(task)) {
    const predecessor = byId.get(predecessorId)
    if (!predecessor) throw new Error(`Task ${task.id} has dangling predecessor ID: ${predecessorId}`)
    const endDate = taskEnd(predecessor)
    if (!latest || endDate.getTime() > latest.getTime()) latest = endDate
  }
  return latest ? new Date(latest.getTime()) : null
}

function calendarDurationUnits(startDate, endDate) {
  return Math.max(0, visibleUnitsBetween(startDate, endDate, ALL_WEEKDAYS))
}

function endAfterDuration(startDate, durationUnits) {
  return shiftByVisibleUnits(startDate, durationUnits, ALL_WEEKDAYS)
}

function frozenDateUpdate(taskId, unitDelta, startDate, endDate) {
  return Object.freeze({
    taskId,
    unitDelta,
    startDate: Object.freeze(new Date(startDate.getTime())),
    endDate: Object.freeze(new Date(endDate.getTime())),
  })
}

function dragArguments(options, legacyClientX) {
  if (!options || typeof options !== 'object') throw new TypeError('drag options are required')

  if (legacyClientX !== undefined) {
    const sourceTasks = options.tasks
      ?? (options.tasksById instanceof Map ? [...options.tasksById.values()] : null)
    return {
      tasks: sourceTasks,
      taskId: options.taskId ?? options.task?.id,
      mode: options.mode,
      pixelDelta: legacyClientX - options.startClientX,
      scale: options.dayWidth,
      snapIncrement: options.snapIncrement,
      visibleWeekdays: options.visibleWeekdays,
      initialStartDate: options.initialStartDate,
      initialEndDate: options.initialEndDate,
    }
  }

  const pixelDelta = options.pixelDelta ?? (
    options.clientX !== undefined && options.startClientX !== undefined
      ? options.clientX - options.startClientX
      : undefined
  )
  return { ...options, pixelDelta }
}

/**
 * Pure move/resize calculation used by an eventual pointer controller. Whole-
 * bar movement and left-edge resizing respect the latest predecessor end.
 */
export function calculateDraggedTaskDates(options, legacyClientX) {
  const drag = dragArguments(options, legacyClientX)
  const tasks = normalizeTasks(drag.tasks ?? [])
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const task = taskById.get(drag.taskId)
  if (!task) throw new Error(`Task not found: ${drag.taskId}`)
  if (!['move', 'resize-start', 'resize-end'].includes(drag.mode)) {
    throw new RangeError(`Unsupported interaction mode: ${drag.mode}`)
  }

  const scale = getTimelineScale(drag.scale ?? 'day')
  const snapIncrement = drag.snapIncrement ?? 'day'
  const minimumDuration = snapIncrementUnits(snapIncrement)
  const visibleWeekdays = normalizeVisibleWeekdays(drag.visibleWeekdays)
  const pixelDelta = drag.pixelDelta ?? 0
  const unitDelta = drag.unitDelta ?? snapPixelDelta(pixelDelta, scale, snapIncrement)
  if (!Number.isFinite(unitDelta)) throw new TypeError('unitDelta must be finite')

  const initial = datePair({
    startDate: drag.initialStartDate ?? task.startDate,
    endDate: drag.initialEndDate ?? task.endDate,
  }, 'initial dates')
  const originalDuration = Math.max(
    minimumDuration,
    calendarDurationUnits(initial.startDate, initial.endDate),
  )
  const minimumStart = latestPredecessorEnd(task, taskById)
  let nextStart = new Date(initial.startDate.getTime())
  let nextEnd = new Date(initial.endDate.getTime())

  if (drag.mode === 'move') {
    nextStart = shiftByVisibleUnits(initial.startDate, unitDelta, visibleWeekdays)
    if (minimumStart && nextStart.getTime() < minimumStart.getTime()) {
      nextStart = new Date(minimumStart.getTime())
    }
    nextEnd = endAfterDuration(nextStart, originalDuration)
  }

  if (drag.mode === 'resize-start') {
    nextStart = shiftByVisibleUnits(initial.startDate, unitDelta, visibleWeekdays)
    const latestStartForDuration = endAfterDuration(nextEnd, -minimumDuration)
    if (nextStart.getTime() > latestStartForDuration.getTime()) nextStart = latestStartForDuration
    if (minimumStart && nextStart.getTime() < minimumStart.getTime()) {
      nextStart = new Date(minimumStart.getTime())
    }
    if (calendarDurationUnits(nextStart, nextEnd) < minimumDuration) {
      nextEnd = endAfterDuration(nextStart, minimumDuration)
    }
  }

  if (drag.mode === 'resize-end') {
    nextEnd = shiftByVisibleUnits(initial.endDate, unitDelta, visibleWeekdays)
    const minimumEnd = endAfterDuration(nextStart, minimumDuration)
    if (nextEnd.getTime() < minimumEnd.getTime()) nextEnd = minimumEnd
  }

  return frozenDateUpdate(task.id, unitDelta, nextStart, nextEnd)
}

function mutableTaskWithDates(task, startDate, endDate) {
  return {
    ...task,
    startDate: new Date(startDate.getTime()),
    endDate: new Date(endDate.getTime()),
    dates: {
      ...task.dates,
      start: new Date(startDate.getTime()),
      end: new Date(endDate.getTime()),
    },
    predecessorIds: [...task.predecessorIds],
    dependencies: [...task.predecessorIds],
    dependents: [...task.dependents],
  }
}

function topologicalIds(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const visited = new Set()
  const order = []
  const visit = (taskId) => {
    if (visited.has(taskId)) return
    const task = byId.get(taskId)
    for (const predecessorId of task.predecessorIds) visit(predecessorId)
    visited.add(taskId)
    order.push(taskId)
  }
  for (const task of tasks) visit(task.id)
  return order
}

function descendantIds(rootTaskId, taskById) {
  const descendants = new Set()
  const pending = [...taskById.get(rootTaskId).dependents]
  while (pending.length > 0) {
    const taskId = pending.pop()
    if (taskId === rootTaskId || descendants.has(taskId)) continue
    descendants.add(taskId)
    for (const dependentId of taskById.get(taskId).dependents) pending.push(dependentId)
  }
  return descendants
}

function scheduleEffect(taskId, before, after, cause) {
  return Object.freeze({
    taskId,
    cause,
    before: Object.freeze({
      startDate: Object.freeze(new Date(before.startDate.getTime())),
      endDate: Object.freeze(new Date(before.endDate.getTime())),
    }),
    after: Object.freeze({
      startDate: Object.freeze(new Date(after.startDate.getTime())),
      endDate: Object.freeze(new Date(after.endDate.getTime())),
    }),
  })
}

function datesDiffer(first, second) {
  return first.startDate.getTime() !== second.startDate.getTime()
    || first.endDate.getTime() !== second.endDate.getTime()
}

function constrainedRequestedDates(target, requestedDates, minimumStart, options) {
  const mode = options.mode ?? 'set'
  if (!['set', 'move', 'resize-start', 'resize-end'].includes(mode)) {
    throw new RangeError(`Unsupported schedule-change mode: ${mode}`)
  }

  const requested = datePair(requestedDates, 'requested dates')
  const original = datePair(target, `Task ${target.id} dates`)
  const minimumDuration = options.minimumDurationUnits ?? 0
  if (!Number.isFinite(minimumDuration) || minimumDuration < 0) {
    throw new RangeError('minimumDurationUnits must be a finite non-negative number')
  }

  let startDate = new Date(requested.startDate.getTime())
  let endDate = new Date(requested.endDate.getTime())
  let duration = calendarDurationUnits(startDate, endDate)

  if (mode === 'move') {
    duration = Math.max(minimumDuration, calendarDurationUnits(original.startDate, original.endDate))
    endDate = endAfterDuration(startDate, duration)
  }

  if (minimumStart && startDate.getTime() < minimumStart.getTime()) {
    if (mode === 'resize-start') {
      startDate = new Date(minimumStart.getTime())
      if (endDate.getTime() < startDate.getTime()
        || calendarDurationUnits(startDate, endDate) < minimumDuration) {
        endDate = endAfterDuration(startDate, minimumDuration)
      }
    } else {
      startDate = new Date(minimumStart.getTime())
      endDate = endAfterDuration(startDate, Math.max(minimumDuration, duration))
    }
  }

  if (endDate.getTime() < startDate.getTime()) {
    endDate = endAfterDuration(startDate, minimumDuration)
  }
  if (calendarDurationUnits(startDate, endDate) < minimumDuration) {
    if (mode === 'resize-start') startDate = endAfterDuration(endDate, -minimumDuration)
    else endDate = endAfterDuration(startDate, minimumDuration)
  }

  if (minimumStart && startDate.getTime() < minimumStart.getTime()) {
    startDate = new Date(minimumStart.getTime())
    endDate = endAfterDuration(startDate, Math.max(minimumDuration, duration))
  }

  return { startDate, endDate }
}

/**
 * Applies one direct schedule edit and then pushes only violating descendants.
 * Descendants are never pulled backward, and every propagated task retains its
 * local-calendar duration. Tasks outside the edited task's descendant closure
 * retain their dates and metadata.
 */
export function applyForwardOnlyScheduleChange(sourceTasks, taskId, requestedDates, options = {}) {
  const normalizedTasks = normalizeTasks(sourceTasks)
  const mutableTasks = normalizedTasks.map((task) => mutableTaskWithDates(task, task.startDate, task.endDate))
  const taskById = new Map(mutableTasks.map((task) => [task.id, task]))
  const target = taskById.get(taskId)
  if (!target) throw new Error(`Task not found: ${taskId}`)

  const effects = []
  const affectedTaskIds = [taskId]
  const affectedSet = new Set(affectedTaskIds)
  const beforeTarget = datePair(target, `Task ${taskId} dates`)
  const minimumStart = latestPredecessorEnd(target, taskById)
  const constrained = constrainedRequestedDates(target, requestedDates, minimumStart, options)
  Object.assign(target, mutableTaskWithDates(target, constrained.startDate, constrained.endDate))

  if (datesDiffer(beforeTarget, constrained)) {
    effects.push(scheduleEffect(taskId, beforeTarget, constrained, 'requested'))
  }

  const descendants = descendantIds(taskId, taskById)
  for (const descendantId of topologicalIds(mutableTasks)) {
    if (!descendants.has(descendantId)) continue
    const dependent = taskById.get(descendantId)
    const predecessorEnd = latestPredecessorEnd(dependent, taskById)
    if (!predecessorEnd || dependent.startDate.getTime() >= predecessorEnd.getTime()) continue

    const before = datePair(dependent, `Task ${dependent.id} dates`)
    const duration = calendarDurationUnits(before.startDate, before.endDate)
    const after = {
      startDate: new Date(predecessorEnd.getTime()),
      endDate: endAfterDuration(predecessorEnd, duration),
    }
    Object.assign(dependent, mutableTaskWithDates(dependent, after.startDate, after.endDate))
    effects.push(scheduleEffect(dependent.id, before, after, 'propagated'))
    if (!affectedSet.has(dependent.id)) {
      affectedSet.add(dependent.id)
      affectedTaskIds.push(dependent.id)
    }
  }

  const tasks = normalizeTasks(mutableTasks)
  const frozenEffects = Object.freeze(effects)
  return Object.freeze({
    tasks,
    affectedTaskIds: Object.freeze(affectedTaskIds),
    effects: frozenEffects,
    automaticEffects: Object.freeze(frozenEffects.filter((effect) => effect.cause === 'propagated')),
  })
}

/** Applies multiple explicit updates in order while preserving one pure result. */
export function applyForwardSchedulePropagation(sourceTasks, initialUpdates, options = {}) {
  if (!Array.isArray(initialUpdates) || initialUpdates.length === 0) {
    throw new TypeError('initialUpdates must be a non-empty array')
  }

  let tasks = normalizeTasks(sourceTasks)
  const affectedTaskIds = []
  const affectedSet = new Set()
  const effects = []

  for (const update of initialUpdates) {
    const result = applyForwardOnlyScheduleChange(
      tasks,
      update.taskId,
      update,
      { ...options, mode: update.mode ?? options.mode },
    )
    tasks = result.tasks
    for (const affectedTaskId of result.affectedTaskIds) {
      if (!affectedSet.has(affectedTaskId)) {
        affectedSet.add(affectedTaskId)
        affectedTaskIds.push(affectedTaskId)
      }
    }
    effects.push(...result.effects)
  }

  const frozenEffects = Object.freeze(effects)
  return Object.freeze({
    tasks,
    affectedTaskIds: Object.freeze(affectedTaskIds),
    effects: frozenEffects,
    automaticEffects: Object.freeze(frozenEffects.filter((effect) => effect.cause === 'propagated')),
  })
}
