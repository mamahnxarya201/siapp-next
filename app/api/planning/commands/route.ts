import { NextResponse } from 'next/server'
import { PlanningService } from '@/lib/application/planning-service'
import type {
  ActivePlanRecord,
  ApprovedBaselineRecord,
  PlanningRevision,
  ScenarioRecord,
} from '@/lib/domain/planning-types'
import { getSqlitePlanningRepository } from '@/lib/persistence/sqlite-planning-repository.server'

function hydrateRevision(input: PlanningRevision): PlanningRevision {
  return {
    ...input,
    createdAt: new Date(input.createdAt),
    activatedAt: input.activatedAt ? new Date(input.activatedAt) : undefined,
    tasks: input.tasks.map((task) => ({
      ...task,
      dates: { start: new Date(task.dates.start), end: new Date(task.dates.end) },
      actual: task.actual
        ? {
            ...task.actual,
            reportedAt: new Date(task.actual.reportedAt),
            reportedCompletionAt: task.actual.reportedCompletionAt ? new Date(task.actual.reportedCompletionAt) : undefined,
            confirmedAt: task.actual.confirmedAt ? new Date(task.actual.confirmedAt) : undefined,
          }
        : undefined,
    })),
  }
}

export async function POST(request: Request) {
  const body = await request.json() as {
    action: string
    actorId: string
    revision?: PlanningRevision
    scenario?: ScenarioRecord
    activePlan?: ActivePlanRecord
    baseline?: ApprovedBaselineRecord
    taskId?: string
    requestedStart?: string
    requestedEnd?: string
    requestedBy?: string
    reviewerId?: string
  }
  const repository = getSqlitePlanningRepository()
  await repository.initialize()
  const service = new PlanningService(repository)

  try {
    switch (body.action) {
      case 'create_scenario':
        if (!body.revision) throw new Error('revision is required.')
        return NextResponse.json(await service.createScenario({
          projectId: body.revision.projectId,
          ownerId: body.actorId,
          sourceRevision: hydrateRevision(body.revision),
        }))
      case 'submit_scenario':
        if (!body.scenario) throw new Error('scenario is required.')
        return NextResponse.json(await service.submitScenario(hydrateRevision(body.scenario) as ScenarioRecord, body.actorId))
      case 'approve_scenario':
        if (!body.scenario) throw new Error('scenario is required.')
        return NextResponse.json(await service.approveScenario(hydrateRevision(body.scenario) as ScenarioRecord, body.actorId))
      case 'activate_baseline':
        if (!body.activePlan || !body.baseline) throw new Error('activePlan and baseline are required.')
        return NextResponse.json(await service.activateBaseline({
          activePlan: hydrateRevision(body.activePlan) as ActivePlanRecord,
          baseline: hydrateRevision(body.baseline) as ApprovedBaselineRecord,
          actorId: body.actorId,
        }))
      case 'schedule_task':
        if (!body.revision || !body.taskId || !body.requestedStart || !body.requestedEnd) throw new Error('revision, taskId, and requested dates are required.')
        return NextResponse.json(await service.scheduleTask({
          revision: hydrateRevision(body.revision),
          taskId: body.taskId,
          requestedStart: new Date(body.requestedStart),
          requestedEnd: new Date(body.requestedEnd),
          actorId: body.actorId,
        }))
      case 'create_task_change_proposal':
        if (!body.activePlan || !body.taskId || !body.requestedStart || !body.requestedEnd || !body.requestedBy || !body.reviewerId) throw new Error('activePlan, task, dates, requester, and reviewer are required.')
        return NextResponse.json(await service.createTaskChangeProposal({
          activePlan: hydrateRevision(body.activePlan) as ActivePlanRecord,
          taskId: body.taskId,
          requestedStart: new Date(body.requestedStart),
          requestedEnd: new Date(body.requestedEnd),
          requestedBy: body.requestedBy,
          reviewerId: body.reviewerId,
        }))
      default:
        return NextResponse.json({ error: `Unknown planning action: ${body.action}` }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Planning command failed.' }, { status: 400 })
  }
}
