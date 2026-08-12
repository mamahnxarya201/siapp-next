import type { ForecastResult, ForecastTaskResult, PlanningRevision, PlanningTaskRecord } from './planning-types'

const DAY_MS = 24 * 60 * 60 * 1000

function expectedDuration(task: PlanningTaskRecord): number {
  return (task.optimisticDays + (4 * task.mostLikelyDays) + task.pessimisticDays) / 6
}

export function calculateForecast(revision: PlanningRevision): ForecastResult {
  const tasks = revision.tasks
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const results = new Map<string, ForecastTaskResult>()
  const visiting = new Set<string>()

  const forward = (taskId: string): ForecastTaskResult => {
    const existing = results.get(taskId)
    if (existing) return existing
    if (visiting.has(taskId)) throw new Error(`Circular dependency detected at ${taskId}`)
    const task = byId.get(taskId)
    if (!task) throw new Error(`Unknown dependency: ${taskId}`)
    visiting.add(taskId)
    const duration = expectedDuration(task)
    const predecessorResults = task.predecessorIds.map(forward)
    const predecessorFinish = predecessorResults.reduce<Date | null>((latest, predecessor) => (
      !latest || predecessor.earliestFinish > latest ? predecessor.earliestFinish : latest
    ), null)
    const earliestStart = new Date(Math.max(
      task.dates.start.getTime(),
      predecessorFinish?.getTime() ?? Number.MIN_SAFE_INTEGER,
    ))
    const earliestFinish = new Date(earliestStart.getTime() + duration * DAY_MS)
    const result: ForecastTaskResult = {
      taskId,
      expectedDurationDays: duration,
      earliestStart,
      earliestFinish,
      latestStart: new Date(earliestStart),
      latestFinish: new Date(earliestFinish),
      slackDays: 0,
      critical: false,
    }
    results.set(taskId, result)
    visiting.delete(taskId)
    return result
  }

  tasks.forEach((task) => forward(task.id))
  const projectFinish = [...results.values()].reduce<Date | null>((latest, result) => (
    !latest || result.earliestFinish > latest ? result.earliestFinish : latest
  ), null)

  const dependents = new Map<string, PlanningTaskRecord[]>()
  tasks.forEach((task) => task.predecessorIds.forEach((predecessorId) => {
    dependents.set(predecessorId, [...(dependents.get(predecessorId) ?? []), task])
  }))

  const backward = (taskId: string) => {
    const result = results.get(taskId)!
    const children = dependents.get(taskId) ?? []
    const latestFinish = children.length
      ? children.reduce((earliest, child) => {
          const childResult = results.get(child.id)!
          return childResult.latestStart < earliest ? childResult.latestStart : earliest
        }, projectFinish ?? result.earliestFinish)
      : projectFinish ?? result.earliestFinish
    result.latestFinish = new Date(latestFinish)
    result.latestStart = new Date(latestFinish.getTime() - result.expectedDurationDays * DAY_MS)
    result.slackDays = Math.max(0, Math.round((result.latestStart.getTime() - result.earliestStart.getTime()) / DAY_MS))
    result.critical = result.slackDays === 0
    tasks.filter((task) => task.predecessorIds.includes(taskId)).forEach((child) => backward(child.id))
  }
  tasks.filter((task) => !(dependents.has(task.id))).forEach((task) => backward(task.id))

  return { revisionId: revision.id, projectFinish, tasks: [...results.values()] }
}
