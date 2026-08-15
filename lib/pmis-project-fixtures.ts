import {
  initialWorkstreams,
  teamMembers,
  type Priority,
  type Task,
  type TaskStatus,
  type TaskTeam,
  type Workstream,
} from './pmis-data'

export interface ProjectWorkspace {
  tasks: Task[]
  workstreams: Workstream[]
}

interface FixtureTask {
  id: string
  name: string
  description: string
  workstreamId: string
  team: TaskTeam
  startOffset: number
  duration: number
  dependencies?: string[]
  status?: TaskStatus
  priority?: Priority
  progress?: number
  assigneeIndex?: number
  isMilestone?: boolean
  isCriticalPath?: boolean
  blockers?: string[]
  riskLevel?: Task['riskLevel']
}

const DAY_MS = 24 * 60 * 60 * 1000

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function buildFixtureTasks(specs: FixtureTask[]): Task[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dependentsByTaskId = new Map(specs.map((spec) => [spec.id, [] as string[]]))

  for (const spec of specs) {
    for (const dependencyId of spec.dependencies ?? []) {
      const dependents = dependentsByTaskId.get(dependencyId)
      if (!dependents) throw new Error(`Unknown fixture dependency: ${dependencyId}`)
      dependents.push(spec.id)
    }
  }

  const unscheduled = new Map(specs.map((spec, index) => {
    const startDate = addDays(today, spec.startOffset)
    const endDate = addDays(startDate, Math.max(1, spec.duration))
    const estimatedDays = Math.max(1, spec.duration)
    const task: Task = {
      id: spec.id,
      name: spec.name,
      description: spec.description,
      group: spec.team,
      groupName: spec.workstreamId,
      teamName: spec.team,
      status: spec.status ?? 'todo',
      priority: spec.priority ?? 'medium',
      assignee: teamMembers[spec.assigneeIndex ?? index % teamMembers.length],
      startDate,
      endDate,
      plannedStart: new Date(startDate),
      plannedEnd: new Date(endDate),
      earliestStart: new Date(startDate),
      createdAt: addDays(today, -specs.length + index),
      estimatedDays,
      optimisticDays: Math.max(1, estimatedDays - 1),
      pessimisticDays: estimatedDays + 2,
      dependencies: [...(spec.dependencies ?? [])],
      dependents: dependentsByTaskId.get(spec.id) ?? [],
      blockers: [...(spec.blockers ?? [])],
      progress: spec.progress ?? (spec.status === 'done' ? 100 : 0),
      checklist: [],
      isMilestone: spec.isMilestone ?? false,
      isCriticalPath: spec.isCriticalPath ?? false,
      linkedChangeRequests: [],
      labels: [],
      comments: [],
      riskLevel: spec.riskLevel ?? 'low',
    }
    return [spec.id, task] as const
  }))

  const scheduled = new Map<string, Task>()
  const visiting = new Set<string>()

  function schedule(taskId: string): Task {
    const existing = scheduled.get(taskId)
    if (existing) return existing
    const task = unscheduled.get(taskId)
    if (!task) throw new Error(`Unknown fixture task: ${taskId}`)
    if (visiting.has(taskId)) throw new Error(`Circular fixture dependency: ${taskId}`)

    visiting.add(taskId)
    const predecessors = task.dependencies.map(schedule)
    visiting.delete(taskId)

    const minimumStart = predecessors.reduce<Date | null>((latest, predecessor) => {
      return !latest || predecessor.endDate > latest ? predecessor.endDate : latest
    }, null)
    const duration = Math.max(DAY_MS, task.endDate.getTime() - task.startDate.getTime())
    const startDate = minimumStart && task.startDate < minimumStart
      ? new Date(minimumStart)
      : new Date(task.startDate)
    const result = {
      ...task,
      startDate,
      endDate: new Date(startDate.getTime() + duration),
      earliestStart: minimumStart ? new Date(minimumStart) : new Date(startDate),
    }
    scheduled.set(taskId, result)
    return result
  }

  return specs.map((spec) => schedule(spec.id))
}

const performanceWorkstreams: Workstream[] = [
  { id: 'gateway-foundation', label: 'Gateway Foundation', color: 'bg-chart-1/15 text-chart-1' },
  { id: 'service-migration', label: 'Service Migration', color: 'bg-primary/15 text-primary' },
  { id: 'traffic-transition', label: 'Traffic Transition', color: 'bg-chart-2/15 text-chart-2' },
  { id: 'resilience-validation', label: 'Resilience Validation', color: 'bg-chart-3/15 text-chart-3' },
  { id: 'regional-rollout', label: 'Regional Rollout', color: 'bg-chart-5/15 text-chart-5' },
]

const performanceTaskNames = [
  'Define route contract',
  'Migrate service adapter',
  'Configure traffic policy',
  'Run resilience validation',
  'Complete regional rollout',
]

const performanceTeams: TaskTeam[] = ['infrastructure', 'backend', 'deployment', 'qa', 'management']
const PERFORMANCE_TASK_COUNT = 240

const performanceTasks = buildFixtureTasks(Array.from({ length: PERFORMANCE_TASK_COUNT }, (_, index) => {
  const lane = index % performanceWorkstreams.length
  const wave = Math.floor(index / performanceWorkstreams.length)
  const dependencies = new Set<string>()

  if (wave > 0) dependencies.add(`performance-${index - performanceWorkstreams.length + 1}`)
  if (lane > 0) dependencies.add(`performance-${index}`)
  if (wave > 1 && lane > 0 && wave % 3 === 0) {
    dependencies.add(`performance-${index - performanceWorkstreams.length}`)
  }

  const isBlocked = index > 20 && index % 47 === 0
  const status: TaskStatus = isBlocked
    ? 'blocked'
    : wave < 9
      ? 'done'
      : wave < 18
        ? 'in-progress'
        : 'todo'
  const progress = status === 'done' ? 100 : status === 'in-progress' ? 25 + (index * 7) % 70 : 0

  return {
    id: `performance-${index + 1}`,
    name: `${performanceTaskNames[lane]} — migration wave ${String(wave + 1).padStart(2, '0')}`,
    description: `Performance fixture task ${index + 1} of ${PERFORMANCE_TASK_COUNT}. It exercises deep vertical scrolling, cross-workstream row alignment, dependency rendering, and large-schedule interaction latency.`,
    workstreamId: performanceWorkstreams[lane].id,
    team: performanceTeams[lane],
    startOffset: -28 + wave * 3 + lane,
    duration: 1 + (index % 3),
    dependencies: [...dependencies],
    status,
    progress,
    priority: index % 29 === 0 ? 'critical' : index % 7 === 0 ? 'high' : 'medium',
    assigneeIndex: index % teamMembers.length,
    isMilestone: index > 0 && index % 40 === 0,
    isCriticalPath: lane === performanceWorkstreams.length - 1,
    blockers: isBlocked ? ['Migration approval is waiting on the owning service team.'] : [],
    riskLevel: isBlocked ? 'high' : index % 11 === 0 ? 'medium' : 'low',
  }
}))

const layoutWorkstreams: Workstream[] = [
  { id: 'discovery-and-research', label: 'Discovery, Research & Stakeholder Alignment', color: 'bg-chart-1/15 text-chart-1' },
  { id: 'experience-foundations', label: 'Experience Foundations & Design System', color: 'bg-primary/15 text-primary' },
  { id: 'application-surfaces', label: 'Customer-Facing Application Surfaces', color: 'bg-chart-2/15 text-chart-2' },
]

const layoutTasks = buildFixtureTasks([
  {
    id: 'layout-1',
    name: 'Consolidate stakeholder interviews into a mobile experience opportunity map',
    description: 'A deliberately long title and description used to verify truncation, wrapping, inspector readability, and narrow task-list behavior without changing the underlying task model.',
    workstreamId: 'discovery-and-research',
    team: 'design',
    startOffset: -24,
    duration: 7,
    status: 'done',
    priority: 'high',
    progress: 100,
  },
  {
    id: 'layout-2',
    name: 'Document accessibility, localization, and small-screen navigation constraints',
    description: 'Exercises long secondary copy, metadata density, and task inspector sections with realistic cross-functional requirements.',
    workstreamId: 'discovery-and-research',
    team: 'management',
    startOffset: -16,
    duration: 6,
    dependencies: ['layout-1'],
    status: 'in-progress',
    progress: 70,
  },
  {
    id: 'layout-3',
    name: 'Create the responsive typography scale and semantic token migration specification',
    description: 'Tests task-name clipping inside medium-width Gantt bars and verbose content inside the right inspector.',
    workstreamId: 'experience-foundations',
    team: 'design',
    startOffset: -12,
    duration: 12,
    dependencies: ['layout-1'],
    status: 'in-progress',
    progress: 45,
    priority: 'critical',
  },
  {
    id: 'layout-4',
    name: 'Implement reusable navigation primitives for compact, regular, and expanded viewports',
    description: 'Validates long labels across the left list, timeline bars, search results, and selection states.',
    workstreamId: 'experience-foundations',
    team: 'frontend',
    startOffset: -3,
    duration: 14,
    dependencies: ['layout-3'],
    status: 'in-progress',
    progress: 30,
    isCriticalPath: true,
  },
  {
    id: 'layout-5',
    name: 'Rebuild account onboarding with progressive disclosure for optional organization details',
    description: 'A long application-surface task for panel resizing, ellipsis behavior, and horizontal timeline scrolling.',
    workstreamId: 'application-surfaces',
    team: 'frontend',
    startOffset: 12,
    duration: 16,
    dependencies: ['layout-4'],
    priority: 'high',
    isCriticalPath: true,
  },
  {
    id: 'layout-6',
    name: 'Validate destructive-action confirmation copy with legal and customer-support reviewers',
    description: 'Provides a blocked, high-risk row with long wording and a visible blocker in the context inspector.',
    workstreamId: 'application-surfaces',
    team: 'qa',
    startOffset: 8,
    duration: 8,
    dependencies: ['layout-2'],
    status: 'blocked',
    priority: 'high',
    blockers: ['Awaiting the approved retention-policy wording from legal counsel.'],
    riskLevel: 'high',
  },
  {
    id: 'layout-7',
    name: 'Responsive layout acceptance review across supported device classes',
    description: 'Milestone fixture used to check diamond placement after a long task label and across timeline scales.',
    workstreamId: 'application-surfaces',
    team: 'qa',
    startOffset: 29,
    duration: 2,
    dependencies: ['layout-5', 'layout-6'],
    isMilestone: true,
    priority: 'critical',
    isCriticalPath: true,
  },
])

const boundaryWorkstreams: Workstream[] = [
  { id: 'audit-evidence', label: 'Evidence Collection', color: 'bg-chart-1/15 text-chart-1' },
  { id: 'control-remediation', label: 'Control Remediation', color: 'bg-primary/15 text-primary' },
  { id: 'independent-validation', label: 'Independent Validation', color: 'bg-chart-3/15 text-chart-3' },
  { id: 'audit-release', label: 'Audit Release', color: 'bg-chart-5/15 text-chart-5' },
]

const boundaryTasks = buildFixtureTasks([
  {
    id: 'boundary-1',
    name: 'Historical evidence sampling window',
    description: 'Starts far in the past to exercise initial range calculation and long horizontal navigation.',
    workstreamId: 'audit-evidence',
    team: 'management',
    startOffset: -75,
    duration: 28,
    status: 'done',
    progress: 100,
  },
  {
    id: 'boundary-2',
    name: 'Identity control evidence review',
    description: 'A completed predecessor with a long gap before its dependent, exercising normal left-entry routing.',
    workstreamId: 'audit-evidence',
    team: 'qa',
    startOffset: -38,
    duration: 7,
    dependencies: ['boundary-1'],
    status: 'done',
    progress: 100,
    isCriticalPath: true,
  },
  {
    id: 'boundary-3',
    name: 'Access review exception remediation',
    description: 'Starts exactly at the predecessor boundary so the dependency uses cramped top-entry routing.',
    workstreamId: 'control-remediation',
    team: 'backend',
    startOffset: -31,
    duration: 9,
    dependencies: ['boundary-2'],
    status: 'blocked',
    priority: 'critical',
    blockers: ['Two privileged service accounts have no confirmed business owner.'],
    riskLevel: 'high',
    isCriticalPath: true,
  },
  {
    id: 'boundary-4',
    name: 'Deployment logging control remediation',
    description: 'A parallel predecessor used to verify multi-parent minimum-start constraints.',
    workstreamId: 'control-remediation',
    team: 'infrastructure',
    startOffset: -27,
    duration: 14,
    dependencies: ['boundary-2'],
    status: 'in-progress',
    progress: 55,
    isCriticalPath: true,
  },
  {
    id: 'boundary-5',
    name: 'Remediation complete',
    description: 'A compact milestone after parallel remediation paths.',
    workstreamId: 'control-remediation',
    team: 'management',
    startOffset: -10,
    duration: 1,
    dependencies: ['boundary-3', 'boundary-4'],
    isMilestone: true,
    priority: 'critical',
    isCriticalPath: true,
  },
  {
    id: 'boundary-6',
    name: 'Independent operating-effectiveness retest',
    description: 'Tests a multi-predecessor dependent and cross-workstream connector routing.',
    workstreamId: 'independent-validation',
    team: 'qa',
    startOffset: 1,
    duration: 12,
    dependencies: ['boundary-3', 'boundary-4', 'boundary-5'],
    status: 'todo',
    priority: 'high',
    riskLevel: 'medium',
    isCriticalPath: true,
  },
  {
    id: 'boundary-7',
    name: 'Management representation approval',
    description: 'An approval milestone intentionally scheduled with a visible gap after validation.',
    workstreamId: 'audit-release',
    team: 'management',
    startOffset: 22,
    duration: 1,
    dependencies: ['boundary-6'],
    isMilestone: true,
    priority: 'high',
  },
  {
    id: 'boundary-8',
    name: 'SOC 2 report publication',
    description: 'A far-future terminal milestone for timeline extension and long connector continuity checks.',
    workstreamId: 'audit-release',
    team: 'deployment',
    startOffset: 55,
    duration: 1,
    dependencies: ['boundary-7'],
    isMilestone: true,
    priority: 'critical',
  },
])

const fixtureTemplates: Record<string, ProjectWorkspace> = {
  p1: { tasks: [], workstreams: initialWorkstreams },
  p2: { tasks: layoutTasks, workstreams: layoutWorkstreams },
  p3: { tasks: performanceTasks, workstreams: performanceWorkstreams },
  p4: { tasks: boundaryTasks, workstreams: boundaryWorkstreams },
}

export function cloneProjectWorkspace(workspace: ProjectWorkspace): ProjectWorkspace {
  return {
    workstreams: workspace.workstreams.map((workstream) => ({ ...workstream })),
    tasks: workspace.tasks.map((task) => ({
      ...task,
      assignee: { ...task.assignee },
      startDate: new Date(task.startDate),
      endDate: new Date(task.endDate),
      plannedStart: task.plannedStart ? new Date(task.plannedStart) : undefined,
      plannedEnd: task.plannedEnd ? new Date(task.plannedEnd) : undefined,
      earliestStart: task.earliestStart ? new Date(task.earliestStart) : undefined,
      createdAt: task.createdAt ? new Date(task.createdAt) : undefined,
      dependencies: [...task.dependencies],
      dependents: [...task.dependents],
      blockers: [...task.blockers],
      checklist: (task.checklist ?? []).map((item) => ({ ...item })),
      linkedChangeRequests: [...task.linkedChangeRequests],
      labels: [...(task.labels ?? [])],
      comments: task.comments.map((comment) => ({
        ...comment,
        timestamp: new Date(comment.timestamp),
      })),
    })),
  }
}

export function createProjectWorkspaces(): Record<string, ProjectWorkspace> {
  return Object.fromEntries(
    Object.entries(fixtureTemplates).map(([projectId, workspace]) => [
      projectId,
      cloneProjectWorkspace(workspace),
    ]),
  )
}
