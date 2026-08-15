import { normalizeTasks } from './model.js'

export const DAY_MILLISECONDS = 86_400_000
const CRITICAL_SLACK_TOLERANCE_DAYS = 1e-9

function estimate(task, fieldName, fallbackFieldName) {
  const value = task[fieldName] ?? task[fallbackFieldName]
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Task ${task.id} ${fieldName} must be a finite non-negative number`)
  }
  return value
}

/** PERT expected duration: (optimistic + 4 * most likely + pessimistic) / 6. */
export function expectedDuration(task) {
  if (!task || typeof task !== 'object') throw new TypeError('task is required')
  const optimisticDays = estimate(task, 'optimisticDays', 'optimistic')
  const mostLikelyDays = estimate(task, 'mostLikelyDays', 'estimatedDays')
  const pessimisticDays = estimate(task, 'pessimisticDays', 'pessimistic')
  return (optimisticDays + (4 * mostLikelyDays) + pessimisticDays) / 6
}

export const calculateExpectedDuration = expectedDuration

function topologicalIds(tasks) {
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const visited = new Set()
  const order = []
  const visit = (taskId) => {
    if (visited.has(taskId)) return
    const task = taskById.get(taskId)
    for (const predecessorId of task.predecessorIds) visit(predecessorId)
    visited.add(taskId)
    order.push(taskId)
  }
  for (const task of tasks) visit(task.id)
  return order
}

function latestDate(dates, fallback) {
  return dates.reduce((latest, date) => (
    date.getTime() > latest.getTime() ? date : latest
  ), fallback)
}

function earliestDate(dates, fallback) {
  return dates.reduce((earliest, date) => (
    date.getTime() < earliest.getTime() ? date : earliest
  ), fallback)
}

function freezeForecastTask(result) {
  return Object.freeze({
    ...result,
    earliestStart: Object.freeze(new Date(result.earliestStart.getTime())),
    earliestFinish: Object.freeze(new Date(result.earliestFinish.getTime())),
    latestStart: Object.freeze(new Date(result.latestStart.getTime())),
    latestFinish: Object.freeze(new Date(result.latestFinish.getTime())),
  })
}

/**
 * Calculates a precedence-aware PERT/CPM forecast. Planned task starts act as
 * release constraints during the forward pass; the backward pass runs once in
 * reverse topological order, so converging and diverging graphs are handled
 * without recursive overwrite errors.
 */
export function calculateForecast(revisionOrTasks) {
  const isTaskArray = Array.isArray(revisionOrTasks)
  const revision = isTaskArray ? { id: null, tasks: revisionOrTasks } : revisionOrTasks
  if (!revision || !Array.isArray(revision.tasks)) {
    throw new TypeError('calculateForecast requires a task array or revision with tasks')
  }

  const tasks = normalizeTasks(revision.tasks)
  if (tasks.length === 0) {
    return Object.freeze({
      revisionId: revision.id ?? null,
      projectFinish: null,
      tasks: Object.freeze([]),
      criticalTaskIds: Object.freeze([]),
    })
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const order = topologicalIds(tasks)
  const resultsById = new Map()

  for (const taskId of order) {
    const task = taskById.get(taskId)
    const duration = expectedDuration(task)
    const predecessorFinishes = task.predecessorIds.map((predecessorId) => (
      resultsById.get(predecessorId).earliestFinish
    ))
    const earliestStart = predecessorFinishes.length > 0
      ? latestDate(predecessorFinishes, task.startDate)
      : task.startDate
    const constrainedStart = new Date(Math.max(task.startDate.getTime(), earliestStart.getTime()))
    const earliestFinish = new Date(constrainedStart.getTime() + (duration * DAY_MILLISECONDS))
    resultsById.set(taskId, {
      taskId,
      expectedDurationDays: duration,
      earliestStart: constrainedStart,
      earliestFinish,
      latestStart: new Date(constrainedStart.getTime()),
      latestFinish: new Date(earliestFinish.getTime()),
      slackDays: 0,
      critical: false,
    })
  }

  const projectFinish = latestDate(
    [...resultsById.values()].map((result) => result.earliestFinish),
    resultsById.get(order[0]).earliestFinish,
  )

  for (const taskId of [...order].reverse()) {
    const task = taskById.get(taskId)
    const result = resultsById.get(taskId)
    const dependentLatestStarts = task.dependents.map((dependentId) => (
      resultsById.get(dependentId).latestStart
    ))
    const latestFinish = dependentLatestStarts.length > 0
      ? earliestDate(dependentLatestStarts, projectFinish)
      : projectFinish
    const latestStart = new Date(
      latestFinish.getTime() - (result.expectedDurationDays * DAY_MILLISECONDS),
    )
    const rawSlackDays = (latestStart.getTime() - result.earliestStart.getTime()) / DAY_MILLISECONDS
    const slackDays = Math.abs(rawSlackDays) <= CRITICAL_SLACK_TOLERANCE_DAYS
      ? 0
      : Math.max(0, rawSlackDays)

    result.latestFinish = new Date(latestFinish.getTime())
    result.latestStart = latestStart
    result.slackDays = slackDays
    result.critical = slackDays === 0
  }

  const forecastTasks = Object.freeze(tasks.map((task) => freezeForecastTask(resultsById.get(task.id))))
  return Object.freeze({
    revisionId: revision.id ?? null,
    projectFinish: Object.freeze(new Date(projectFinish.getTime())),
    tasks: forecastTasks,
    criticalTaskIds: Object.freeze(forecastTasks.filter((task) => task.critical).map((task) => task.taskId)),
  })
}
