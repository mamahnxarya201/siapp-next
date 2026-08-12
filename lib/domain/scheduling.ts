import type { PlanningTaskDates, PlanningTaskRecord } from './planning-types'

export interface ScheduleChangeResult {
  tasks: PlanningTaskRecord[]
  affectedTaskIds: string[]
  effects: Array<{ taskId: string; before: PlanningTaskDates; after: PlanningTaskDates }>
}

function cloneTask(task: PlanningTaskRecord): PlanningTaskRecord {
  return {
    ...task,
    dates: { ...task.dates },
    predecessorIds: [...task.predecessorIds],
    actual: task.actual ? { ...task.actual } : undefined,
  }
}

export function latestPredecessorEnd(task: PlanningTaskRecord, taskById: Map<string, PlanningTaskRecord>): Date | null {
  return task.predecessorIds.reduce<Date | null>((latest, predecessorId) => {
    const predecessor = taskById.get(predecessorId)
    if (!predecessor) return latest
    return !latest || predecessor.dates.end.getTime() > latest.getTime()
      ? new Date(predecessor.dates.end)
      : latest
  }, null)
}

export function applyForwardOnlyScheduleChange(
  sourceTasks: PlanningTaskRecord[],
  taskId: string,
  requestedDates: PlanningTaskDates,
): ScheduleChangeResult {
  const taskById = new Map(sourceTasks.map((task) => [task.id, cloneTask(task)]))
  const target = taskById.get(taskId)
  if (!target) throw new Error(`Task not found: ${taskId}`)

  const duration = Math.max(1, target.dates.end.getTime() - target.dates.start.getTime())
  const minimumStart = latestPredecessorEnd(target, taskById)
  const start = minimumStart && requestedDates.start.getTime() < minimumStart.getTime()
    ? new Date(minimumStart)
    : new Date(requestedDates.start)
  const end = new Date(Math.max(start.getTime() + duration, requestedDates.end.getTime()))
  target.dates = { start, end }
  taskById.set(taskId, target)

  const effects: ScheduleChangeResult['effects'] = []
  const affectedTaskIds = new Set<string>([taskId])
  const pending = [taskId]
  while (pending.length) {
    const predecessorId = pending.shift()!
    const predecessor = taskById.get(predecessorId)
    if (!predecessor) continue
    for (const dependent of taskById.values()) {
      if (!dependent.predecessorIds.includes(predecessorId)) continue
      const minimum = latestPredecessorEnd(dependent, taskById)
      if (!minimum || dependent.dates.start.getTime() >= minimum.getTime()) continue
      const before = { ...dependent.dates }
      const dependentDuration = Math.max(1, dependent.dates.end.getTime() - dependent.dates.start.getTime())
      dependent.dates = {
        start: new Date(minimum),
        end: new Date(minimum.getTime() + dependentDuration),
      }
      effects.push({ taskId: dependent.id, before, after: { ...dependent.dates } })
      affectedTaskIds.add(dependent.id)
      pending.push(dependent.id)
    }
  }

  return {
    tasks: sourceTasks.map((task) => taskById.get(task.id) ?? task),
    affectedTaskIds: [...affectedTaskIds],
    effects,
  }
}
