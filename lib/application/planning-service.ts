import type { PlanningRepository } from '@/lib/persistence/planning-repository'
import { calculateForecast } from '@/lib/domain/forecast'
import { reconcileBaseline } from '@/lib/domain/reconciliation'
import { applyForwardOnlyScheduleChange } from '@/lib/domain/scheduling'
import type {
  ActivePlanRecord,
  ApprovedBaselineRecord,
  ChangeRecord,
  ChangeRecordAction,
  PlanningRevision,
  ScenarioRecord,
  TaskChangeProposal,
} from '@/lib/domain/planning-types'

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

function record(
  projectId: string,
  actorId: string,
  action: ChangeRecordAction,
  targetType: ChangeRecord['targetType'],
  targetId: string,
  effects: ChangeRecord['effects'] = [],
  automaticEffects: ChangeRecord['automaticEffects'] = [],
): ChangeRecord {
  return {
    id: id('change'),
    projectId,
    actorId,
    action,
    targetType,
    targetId,
    occurredAt: new Date(),
    effects,
    automaticEffects,
  }
}

export class PlanningService {
  constructor(private readonly repository: PlanningRepository) {}

  async createScenario(input: {
    projectId: string
    ownerId: string
    sourceRevision: PlanningRevision
  }): Promise<ScenarioRecord> {
    const scenario: ScenarioRecord = {
      id: id('scenario'),
      projectId: input.projectId,
      layer: 'scenario',
      status: 'draft',
      ownerId: input.ownerId,
      sourceRevisionId: input.sourceRevision.id,
      createdAt: new Date(),
      sharedReadOnly: false,
      tasks: input.sourceRevision.tasks.map((task) => ({
        ...task,
        dates: { ...task.dates },
        predecessorIds: [...task.predecessorIds],
      })),
    }
    await this.repository.saveRevision(scenario)
    await this.repository.appendChangeRecord(record(input.projectId, input.ownerId, 'scenario_created', 'revision', scenario.id))
    return scenario
  }

  async submitScenario(scenario: ScenarioRecord, actorId: string) {
    if (scenario.status !== 'draft') throw new Error('Only draft scenarios can be submitted.')
    const submitted = { ...scenario, status: 'submitted' as const }
    await this.repository.saveRevision(submitted)
    await this.repository.appendChangeRecord(record(scenario.projectId, actorId, 'scenario_submitted', 'revision', scenario.id))
    return submitted
  }

  async approveScenario(scenario: ScenarioRecord, actorId: string): Promise<ApprovedBaselineRecord> {
    if (scenario.status !== 'submitted') throw new Error('Only submitted scenarios can become baselines.')
    const baseline: ApprovedBaselineRecord = {
      ...scenario,
      id: id('baseline'),
      layer: 'approved-baseline',
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: actorId,
    }
    await this.repository.saveRevision(baseline)
    await this.repository.appendChangeRecord(record(scenario.projectId, actorId, 'baseline_approved', 'revision', baseline.id))
    return baseline
  }

  async activateBaseline(input: {
    activePlan: ActivePlanRecord
    baseline: ApprovedBaselineRecord
    actorId: string
  }) {
    if (input.baseline.status !== 'approved') throw new Error('Only an approved baseline can be activated.')
    const reconciliation = reconcileBaseline(input.activePlan, input.baseline)
    if (!reconciliation.canActivate) return { ok: false as const, reconciliation }
    const active: ActivePlanRecord = {
      ...input.baseline,
      id: id('active-plan'),
      layer: 'active-plan',
      status: 'active',
      activatedAt: new Date(),
      createdAt: new Date(),
    }
    await this.repository.saveRevision(active)
    await this.repository.appendChangeRecord(record(input.baseline.projectId, input.actorId, 'active_plan_activated', 'revision', active.id))
    await this.repository.appendChangeRecord(record(input.baseline.projectId, input.actorId, 'reconciliation_completed', 'revision', active.id,
      reconciliation.items.map((item) => ({ taskId: item.taskId, field: 'reconciliation', before: item.activeDates, after: item.approvedDates }))))
    return { ok: true as const, active, reconciliation }
  }

  async scheduleTask(input: {
    revision: PlanningRevision
    taskId: string
    requestedStart: Date
    requestedEnd: Date
    actorId: string
  }) {
    const result = applyForwardOnlyScheduleChange(input.revision.tasks, input.taskId, {
      start: input.requestedStart,
      end: input.requestedEnd,
    })
    const revision = { ...input.revision, tasks: result.tasks }
    await this.repository.saveRevision(revision)
    await this.repository.appendChangeRecord(record(
      revision.projectId,
      input.actorId,
      'task_scheduled',
      'task',
      input.taskId,
      [{ taskId: input.taskId, field: 'dates', before: input.revision.tasks.find((task) => task.id === input.taskId)?.dates, after: result.tasks.find((task) => task.id === input.taskId)?.dates }],
      result.effects.map((effect) => ({ taskId: effect.taskId, field: 'dates', before: effect.before, after: effect.after })),
    ))
    return { revision, propagation: result }
  }

  async createTaskChangeProposal(input: {
    activePlan: ActivePlanRecord
    taskId: string
    requestedStart: Date
    requestedEnd: Date
    requestedBy: string
    reviewerId: string
  }): Promise<TaskChangeProposal> {
    const task = input.activePlan.tasks.find((candidate) => candidate.id === input.taskId)
    if (!task) throw new Error('Task not found.')
    const proposedTasks = applyForwardOnlyScheduleChange(input.activePlan.tasks, input.taskId, {
      start: input.requestedStart,
      end: input.requestedEnd,
    }).tasks
    const forecast = calculateForecast({ ...input.activePlan, tasks: proposedTasks })
    const proposedForecast = forecast.tasks.find((candidate) => candidate.taskId === input.taskId)
    if (!proposedForecast) throw new Error('Unable to calculate proposed forecast.')
    const proposal: TaskChangeProposal = {
      id: id('proposal'),
      projectId: input.activePlan.projectId,
      taskId: input.taskId,
      requestedBy: input.requestedBy,
      reviewerId: input.reviewerId,
      requestedDates: { start: input.requestedStart, end: input.requestedEnd },
      proposedForecast,
      status: 'pending',
      createdAt: new Date(),
    }
    await this.repository.saveTaskChangeProposal(proposal)
    await this.repository.appendChangeRecord(record(input.activePlan.projectId, input.requestedBy, 'task_change_proposed', 'task', input.taskId))
    return proposal
  }
}
