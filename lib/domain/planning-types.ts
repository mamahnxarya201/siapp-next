export type PlanLayer = 'active-plan' | 'approved-baseline' | 'scenario'

export type PlanningRevisionStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'active'
  | 'superseded'
  | 'archived'

export type ChangeRecordAction =
  | 'task_created'
  | 'task_updated'
  | 'task_scheduled'
  | 'task_status_changed'
  | 'dependency_changed'
  | 'workstream_changed'
  | 'actual_progress_reported'
  | 'completion_reported'
  | 'completion_confirmed'
  | 'task_change_proposed'
  | 'scenario_created'
  | 'scenario_submitted'
  | 'baseline_approved'
  | 'active_plan_activated'
  | 'reconciliation_completed'

export interface PlanningTaskDates {
  start: Date
  end: Date
}

export interface TaskActualProgress {
  progress: number
  status: 'todo' | 'in-progress' | 'blocked' | 'done'
  reportedAt: Date
  reportedBy: string
  reportedCompletionAt?: Date
  confirmedAt?: Date
  confirmedBy?: string
}

export interface PlanningTaskRecord {
  id: string
  projectId: string
  title: string
  description: string
  dates: PlanningTaskDates
  durationDays: number
  optimisticDays: number
  mostLikelyDays: number
  pessimisticDays: number
  predecessorIds: string[]
  workstreamId: string
  assigneeId: string
  approverId?: string
  actual?: TaskActualProgress
}

export interface PlanningRevision {
  id: string
  projectId: string
  layer: PlanLayer
  status: PlanningRevisionStatus
  ownerId: string
  sourceRevisionId?: string
  createdAt: Date
  activatedAt?: Date
  tasks: PlanningTaskRecord[]
}

export interface ScenarioRecord extends PlanningRevision {
  layer: 'scenario'
  status: 'draft' | 'submitted' | 'superseded' | 'archived'
  sharedReadOnly: boolean
}

export interface ApprovedBaselineRecord extends PlanningRevision {
  layer: 'approved-baseline'
  status: 'approved' | 'active' | 'superseded'
  approvedAt: Date
  approvedBy: string
}

export interface ActivePlanRecord extends PlanningRevision {
  layer: 'active-plan'
  status: 'active'
}

export interface ForecastTaskResult {
  taskId: string
  expectedDurationDays: number
  earliestStart: Date
  earliestFinish: Date
  latestStart: Date
  latestFinish: Date
  slackDays: number
  critical: boolean
}

export interface ForecastResult {
  revisionId: string
  projectFinish: Date | null
  tasks: ForecastTaskResult[]
}

export interface ChangeRecordEffect {
  taskId?: string
  field: string
  before: unknown
  after: unknown
}

export interface ChangeRecord {
  id: string
  projectId: string
  actorId: string
  action: ChangeRecordAction
  targetType: 'task' | 'revision' | 'project'
  targetId: string
  occurredAt: Date
  effects: ChangeRecordEffect[]
  automaticEffects: ChangeRecordEffect[]
  reason?: string
}

export interface ReconciliationItem {
  taskId: string
  classification: 'compatible' | 'requires_review' | 'unreconcilable'
  activeDates: PlanningTaskDates
  approvedDates: PlanningTaskDates
  actual?: TaskActualProgress
  explanation: string
}

export interface ReconciliationResult {
  items: ReconciliationItem[]
  canActivate: boolean
}

export interface TaskChangeProposal {
  id: string
  projectId: string
  taskId: string
  requestedBy: string
  reviewerId: string
  requestedDates: PlanningTaskDates
  proposedForecast: ForecastTaskResult
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: Date
}
