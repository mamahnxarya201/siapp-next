import type { PlanningRevision, ReconciliationResult } from './planning-types'

export function reconcileBaseline(activePlan: PlanningRevision, approvedBaseline: PlanningRevision): ReconciliationResult {
  const activeById = new Map(activePlan.tasks.map((task) => [task.id, task]))
  const items = approvedBaseline.tasks.map((approvedTask) => {
    const activeTask = activeById.get(approvedTask.id)
    if (!activeTask) return {
      taskId: approvedTask.id,
      classification: 'compatible' as const,
      activeDates: approvedTask.dates,
      approvedDates: approvedTask.dates,
      explanation: 'New task can be introduced into the active plan.',
    }
    if (activeTask.actual?.status === 'done' && approvedTask.dates.end < activeTask.dates.end) return {
      taskId: approvedTask.id,
      classification: 'unreconcilable' as const,
      activeDates: activeTask.dates,
      approvedDates: approvedTask.dates,
      actual: activeTask.actual,
      explanation: 'Approved dates would contradict completed actual progress.',
    }
    if (activeTask.actual && approvedTask.dates.start < activeTask.actual.reportedAt) return {
      taskId: approvedTask.id,
      classification: 'requires_review' as const,
      activeDates: activeTask.dates,
      approvedDates: approvedTask.dates,
      actual: activeTask.actual,
      explanation: 'Approved planning dates overlap recorded actual progress.',
    }
    return {
      taskId: approvedTask.id,
      classification: 'compatible' as const,
      activeDates: activeTask.dates,
      approvedDates: approvedTask.dates,
      actual: activeTask.actual,
      explanation: 'No recorded fact prevents applying the approved dates.',
    }
  })
  return { items, canActivate: !items.some((item) => item.classification === 'unreconcilable') }
}
