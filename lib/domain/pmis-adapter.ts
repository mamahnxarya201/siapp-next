import type { Task } from '@/lib/pmis-data'
import type { PlanningRevision, PlanningTaskRecord } from './planning-types'

export function toPlanningTask(task: Task, projectId: string): PlanningTaskRecord {
  return {
    id: task.id,
    projectId,
    title: task.name,
    description: task.description,
    dates: { start: new Date(task.startDate), end: new Date(task.endDate) },
    durationDays: Math.max(1, task.estimatedDays),
    optimisticDays: task.optimisticDays,
    mostLikelyDays: task.estimatedDays,
    pessimisticDays: task.pessimisticDays,
    predecessorIds: [...task.dependencies],
    workstreamId: task.groupName,
    assigneeId: task.assignee.id,
    approverId: task.approverId,
    actual: task.actual,
  }
}

export function toActivePlan(projectId: string, tasks: Task[], ownerId = 'u1'): PlanningRevision {
  return {
    id: `active-plan-${projectId}`,
    projectId,
    layer: 'active-plan',
    status: 'active',
    ownerId,
    createdAt: new Date(),
    tasks: tasks.map((task) => toPlanningTask(task, projectId)),
  }
}
