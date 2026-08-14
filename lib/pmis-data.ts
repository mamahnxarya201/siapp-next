// PMIS Mock Data - Realistic project management data
import type { TaskActualProgress } from './domain/planning-types'

export type TaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskTeam = 'backend' | 'frontend' | 'qa' | 'deployment' | 'design' | 'infrastructure' | 'management'
export type WorkstreamGroup = string

export interface Workstream {
  id: WorkstreamGroup
  label: string
  color: string
}

export interface Task {
  id: string
  name: string
  description: string
  group: TaskTeam
  groupName: WorkstreamGroup
  teamName: TaskTeam
  status: TaskStatus
  priority: Priority
  assignee: {
    id: string
    name: string
    avatar: string
    initials: string
  }
  approverId?: string
  actual?: TaskActualProgress
  startDate: Date
  endDate: Date
  plannedStart?: Date
  plannedEnd?: Date
  earliestStart?: Date
  createdAt?: Date
  estimatedDays: number
  optimisticDays: number
  pessimisticDays: number
  dependencies: string[] // Task IDs this task depends on
  dependents: string[] // Task IDs that depend on this task
  blockers: string[]
  progress: number // 0-100
  checklist?: TaskChecklistItem[]
  isMilestone: boolean
  isCriticalPath: boolean
  linkedChangeRequests: string[]
  comments: {
    id: string
    author: string
    text: string
    timestamp: Date
  }[]
  riskLevel: 'low' | 'medium' | 'high'
}

export interface Project {
  id: string
  name: string
  description: string
  status: 'active' | 'delayed' | 'on-hold' | 'completed'
  startDate: Date
  endDate: Date
  progress: number
  healthScore: number // 0-100
  delayedMilestones: number
  pendingApprovals: number
  riskScore: number // 0-100
  teamSize: number
}

// Team members
export const teamMembers = [
  { id: 'u1', name: 'Alex Chen', avatar: '', initials: 'AC' },
  { id: 'u2', name: 'Sarah Miller', avatar: '', initials: 'SM' },
  { id: 'u3', name: 'James Wilson', avatar: '', initials: 'JW' },
  { id: 'u4', name: 'Emma Davis', avatar: '', initials: 'ED' },
  { id: 'u5', name: 'Michael Brown', avatar: '', initials: 'MB' },
  { id: 'u6', name: 'Lisa Johnson', avatar: '', initials: 'LJ' },
  { id: 'u7', name: 'David Kim', avatar: '', initials: 'DK' },
  { id: 'u8', name: 'Rachel Green', avatar: '', initials: 'RG' },
]

// Helper to create dates relative to today
const today = new Date()
const addDays = (days: number) => {
  const date = new Date(today)
  date.setDate(date.getDate() + days)
  return date
}

// Project tasks - realistic software development scenario
const rawTasks: Omit<Task, 'groupName' | 'teamName' | 'plannedStart' | 'plannedEnd' | 'earliestStart' | 'createdAt'>[] = [
  // Infrastructure tasks
  {
    id: 't1',
    name: 'Setup CI/CD Pipeline',
    description: 'Configure GitHub Actions for automated testing and deployment. Includes staging and production environments.',
    group: 'infrastructure',
    status: 'done',
    priority: 'high',
    assignee: teamMembers[6],
    startDate: addDays(-14),
    endDate: addDays(-10),
    estimatedDays: 4,
    optimisticDays: 3,
    pessimisticDays: 6,
    dependencies: [],
    dependents: ['t2', 't3', 't8'],
    blockers: [],
    progress: 100,
    isMilestone: false,
    isCriticalPath: true,
    linkedChangeRequests: ['CR-001'],
    comments: [
      { id: 'c1', author: 'David Kim', text: 'Pipeline configured with caching for faster builds', timestamp: addDays(-11) }
    ],
    riskLevel: 'low'
  },
  {
    id: 't2',
    name: 'Database Schema Design',
    description: 'Design and implement PostgreSQL schema for user management, projects, and analytics.',
    group: 'backend',
    status: 'done',
    priority: 'critical',
    assignee: teamMembers[0],
    startDate: addDays(-12),
    endDate: addDays(-7),
    estimatedDays: 5,
    optimisticDays: 4,
    pessimisticDays: 7,
    dependencies: ['t1'],
    dependents: ['t4', 't5'],
    blockers: [],
    progress: 100,
    isMilestone: false,
    isCriticalPath: true,
    linkedChangeRequests: ['CR-002'],
    comments: [],
    riskLevel: 'low'
  },
  {
    id: 't3',
    name: 'Design System Setup',
    description: 'Establish component library, design tokens, and style guidelines for consistent UI.',
    group: 'design',
    status: 'done',
    priority: 'high',
    assignee: teamMembers[7],
    startDate: addDays(-12),
    endDate: addDays(-8),
    estimatedDays: 4,
    optimisticDays: 3,
    pessimisticDays: 5,
    dependencies: ['t1'],
    dependents: ['t6', 't7'],
    blockers: [],
    progress: 100,
    isMilestone: false,
    isCriticalPath: false,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'low'
  },
  {
    id: 't4',
    name: 'User Authentication API',
    description: 'Implement JWT-based authentication with OAuth2 support for Google and GitHub.',
    group: 'backend',
    status: 'done',
    priority: 'critical',
    assignee: teamMembers[0],
    startDate: addDays(-7),
    endDate: addDays(-3),
    estimatedDays: 4,
    optimisticDays: 3,
    pessimisticDays: 6,
    dependencies: ['t2'],
    dependents: ['t9', 't10'],
    blockers: [],
    progress: 100,
    isMilestone: true,
    isCriticalPath: true,
    linkedChangeRequests: ['CR-003'],
    comments: [
      { id: 'c2', author: 'Alex Chen', text: 'OAuth integration complete, testing with QA', timestamp: addDays(-4) }
    ],
    riskLevel: 'low'
  },
  {
    id: 't5',
    name: 'Project CRUD API',
    description: 'REST endpoints for creating, reading, updating, and deleting projects with proper validation.',
    group: 'backend',
    status: 'in-progress',
    priority: 'high',
    assignee: teamMembers[2],
    startDate: addDays(-5),
    endDate: addDays(2),
    estimatedDays: 7,
    optimisticDays: 5,
    pessimisticDays: 9,
    dependencies: ['t2'],
    dependents: ['t11', 't12'],
    blockers: [],
    progress: 65,
    isMilestone: false,
    isCriticalPath: true,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'medium'
  },
  {
    id: 't6',
    name: 'Login/Signup UI',
    description: 'Build authentication screens with form validation, error handling, and loading states.',
    group: 'frontend',
    status: 'done',
    priority: 'high',
    assignee: teamMembers[1],
    startDate: addDays(-6),
    endDate: addDays(-2),
    estimatedDays: 4,
    optimisticDays: 3,
    pessimisticDays: 5,
    dependencies: ['t3'],
    dependents: ['t9'],
    blockers: [],
    progress: 100,
    isMilestone: false,
    isCriticalPath: false,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'low'
  },
  {
    id: 't7',
    name: 'Dashboard Layout',
    description: 'Main application shell with navigation, sidebar, and responsive layout.',
    group: 'frontend',
    status: 'in-progress',
    priority: 'high',
    assignee: teamMembers[1],
    startDate: addDays(-4),
    endDate: addDays(1),
    estimatedDays: 5,
    optimisticDays: 4,
    pessimisticDays: 7,
    dependencies: ['t3'],
    dependents: ['t11', 't13'],
    blockers: [],
    progress: 75,
    isMilestone: false,
    isCriticalPath: true,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'low'
  },
  {
    id: 't8',
    name: 'Monitoring Setup',
    description: 'Configure application monitoring, error tracking, and performance metrics.',
    group: 'infrastructure',
    status: 'in-progress',
    priority: 'medium',
    assignee: teamMembers[6],
    startDate: addDays(-3),
    endDate: addDays(3),
    estimatedDays: 6,
    optimisticDays: 4,
    pessimisticDays: 8,
    dependencies: ['t1'],
    dependents: ['t18'],
    blockers: [],
    progress: 45,
    isMilestone: false,
    isCriticalPath: false,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'low'
  },
  {
    id: 't9',
    name: 'Auth Integration',
    description: 'Connect login UI with authentication API, handle token storage and refresh.',
    group: 'frontend',
    status: 'in-progress',
    priority: 'critical',
    assignee: teamMembers[3],
    startDate: addDays(-2),
    endDate: addDays(2),
    estimatedDays: 4,
    optimisticDays: 3,
    pessimisticDays: 5,
    dependencies: ['t4', 't6'],
    dependents: ['t14'],
    blockers: [],
    progress: 55,
    isMilestone: false,
    isCriticalPath: true,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'medium'
  },
  {
    id: 't10',
    name: 'Auth Unit Tests',
    description: 'Comprehensive test coverage for authentication endpoints and edge cases.',
    group: 'qa',
    status: 'in-progress',
    priority: 'high',
    assignee: teamMembers[4],
    startDate: addDays(-1),
    endDate: addDays(3),
    estimatedDays: 4,
    optimisticDays: 3,
    pessimisticDays: 5,
    dependencies: ['t4'],
    dependents: ['t15'],
    blockers: [],
    progress: 40,
    isMilestone: false,
    isCriticalPath: false,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'low'
  },
  {
    id: 't11',
    name: 'Project List View',
    description: 'Build project listing with filtering, sorting, and pagination.',
    group: 'frontend',
    status: 'todo',
    priority: 'high',
    assignee: teamMembers[1],
    startDate: addDays(2),
    endDate: addDays(6),
    estimatedDays: 4,
    optimisticDays: 3,
    pessimisticDays: 6,
    dependencies: ['t5', 't7'],
    dependents: ['t16'],
    blockers: [],
    progress: 0,
    isMilestone: false,
    isCriticalPath: true,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'medium'
  },
  {
    id: 't12',
    name: 'Task Management API',
    description: 'Endpoints for task CRUD, status updates, and dependency management.',
    group: 'backend',
    status: 'blocked',
    priority: 'critical',
    assignee: teamMembers[2],
    startDate: addDays(3),
    endDate: addDays(8),
    estimatedDays: 5,
    optimisticDays: 4,
    pessimisticDays: 7,
    dependencies: ['t5'],
    dependents: ['t16', 't17'],
    blockers: ['Waiting for schema review approval'],
    progress: 0,
    isMilestone: false,
    isCriticalPath: true,
    linkedChangeRequests: ['CR-004'],
    comments: [
      { id: 'c3', author: 'James Wilson', text: 'Schema review meeting scheduled for tomorrow', timestamp: addDays(0) }
    ],
    riskLevel: 'high'
  },
  {
    id: 't13',
    name: 'User Settings Page',
    description: 'Profile management, notification preferences, and account settings.',
    group: 'frontend',
    status: 'todo',
    priority: 'medium',
    assignee: teamMembers[3],
    startDate: addDays(3),
    endDate: addDays(7),
    estimatedDays: 4,
    optimisticDays: 3,
    pessimisticDays: 5,
    dependencies: ['t7'],
    dependents: [],
    blockers: [],
    progress: 0,
    isMilestone: false,
    isCriticalPath: false,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'low'
  },
  {
    id: 't14',
    name: 'E2E Auth Tests',
    description: 'End-to-end testing for complete authentication flow.',
    group: 'qa',
    status: 'todo',
    priority: 'high',
    assignee: teamMembers[4],
    startDate: addDays(4),
    endDate: addDays(7),
    estimatedDays: 3,
    optimisticDays: 2,
    pessimisticDays: 4,
    dependencies: ['t9'],
    dependents: ['t18'],
    blockers: [],
    progress: 0,
    isMilestone: false,
    isCriticalPath: false,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'low'
  },
  {
    id: 't15',
    name: 'Security Audit - Auth',
    description: 'Security review of authentication implementation.',
    group: 'qa',
    status: 'todo',
    priority: 'critical',
    assignee: teamMembers[5],
    startDate: addDays(5),
    endDate: addDays(8),
    estimatedDays: 3,
    optimisticDays: 2,
    pessimisticDays: 4,
    dependencies: ['t10'],
    dependents: ['t18'],
    blockers: [],
    progress: 0,
    isMilestone: true,
    isCriticalPath: false,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'medium'
  },
  {
    id: 't16',
    name: 'Gantt Chart Component',
    description: 'Interactive timeline visualization with drag-and-drop support.',
    group: 'frontend',
    status: 'todo',
    priority: 'critical',
    assignee: teamMembers[7],
    startDate: addDays(7),
    endDate: addDays(14),
    estimatedDays: 7,
    optimisticDays: 5,
    pessimisticDays: 10,
    dependencies: ['t11', 't12'],
    dependents: ['t17'],
    blockers: [],
    progress: 0,
    isMilestone: false,
    isCriticalPath: true,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'high'
  },
  {
    id: 't17',
    name: 'Dependency Visualization',
    description: 'Visual representation of task dependencies with critical path highlighting.',
    group: 'frontend',
    status: 'todo',
    priority: 'high',
    assignee: teamMembers[7],
    startDate: addDays(15),
    endDate: addDays(19),
    estimatedDays: 4,
    optimisticDays: 3,
    pessimisticDays: 6,
    dependencies: ['t12', 't16'],
    dependents: ['t19'],
    blockers: [],
    progress: 0,
    isMilestone: false,
    isCriticalPath: true,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'medium'
  },
  {
    id: 't18',
    name: 'Production Deployment',
    description: 'Deploy to production environment with rollback procedures.',
    group: 'management',
    status: 'todo',
    priority: 'critical',
    assignee: teamMembers[6],
    startDate: addDays(20),
    endDate: addDays(22),
    estimatedDays: 2,
    optimisticDays: 1,
    pessimisticDays: 3,
    dependencies: ['t8', 't14', 't15'],
    dependents: ['t19'],
    blockers: [],
    progress: 0,
    isMilestone: true,
    isCriticalPath: false,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'high'
  },
  {
    id: 't19',
    name: 'MVP Launch',
    description: 'Official MVP release with documentation and user onboarding.',
    group: 'deployment',
    status: 'todo',
    priority: 'critical',
    assignee: teamMembers[5],
    startDate: addDays(23),
    endDate: addDays(25),
    estimatedDays: 2,
    optimisticDays: 1,
    pessimisticDays: 3,
    dependencies: ['t17', 't18'],
    dependents: [],
    blockers: [],
    progress: 0,
    isMilestone: true,
    isCriticalPath: true,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'high'
  },
]

const WORKSTREAM_BY_TASK_ID: Record<string, WorkstreamGroup> = {
  t1: 'foundation',
  t2: 'foundation',
  t3: 'foundation',
  t4: 'core-platform',
  t5: 'core-platform',
  t6: 'execution-ui',
  t7: 'execution-ui',
  t8: 'core-platform',
  t9: 'execution-ui',
  t10: 'validation',
  t11: 'execution-ui',
  t12: 'core-platform',
  t13: 'execution-ui',
  t14: 'validation',
  t15: 'validation',
  t16: 'execution-ui',
  t17: 'execution-ui',
  t18: 'release',
  t19: 'release',
}

function applyFinishToStartConstraints(
  sourceTasks: typeof rawTasks
): typeof rawTasks {
  const taskById = new Map(sourceTasks.map((task) => [task.id, task]))
  const scheduled = new Map<string, (typeof sourceTasks)[number]>()
  const visiting = new Set<string>()

  const schedule = (taskId: string): (typeof sourceTasks)[number] => {
    const existing = scheduled.get(taskId)
    if (existing) return existing

    const task = taskById.get(taskId)
    if (!task) throw new Error(`Unknown mock task dependency: ${taskId}`)
    if (visiting.has(taskId)) throw new Error(`Circular mock task dependency involving: ${taskId}`)

    visiting.add(taskId)
    const dependencies = task.dependencies.map(schedule)
    visiting.delete(taskId)

    const earliestStart = dependencies.reduce(
      (latest, dependency) => dependency.endDate.getTime() > latest.getTime() ? dependency.endDate : latest,
      task.startDate
    )
    const durationDays = Math.max(0, Math.round(
      (task.endDate.getTime() - task.startDate.getTime()) / (24 * 60 * 60 * 1000)
    ))
    const constrainedTask = earliestStart.getTime() > task.startDate.getTime()
      ? { ...task, startDate: new Date(earliestStart), endDate: addDaysFrom(earliestStart, durationDays) }
      : task

    scheduled.set(taskId, constrainedTask)
    return constrainedTask
  }

  return sourceTasks.map((task) => schedule(task.id))
}

export interface TaskChecklistItem {
  id: string
  text: string
  weight: number
  completed: boolean
}

const addDaysFrom = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

const scheduledTasks = applyFinishToStartConstraints(rawTasks)

export const tasks: Task[] = scheduledTasks.map((task, index) => ({
  ...task,
  checklist: [],
  groupName: WORKSTREAM_BY_TASK_ID[task.id] ?? 'core-platform',
  teamName: task.group,
  plannedStart: task.startDate,
  plannedEnd: task.endDate,
  earliestStart: task.dependencies.reduce<Date>((latest, dependencyId) => {
    const dependency = scheduledTasks.find((candidate) => candidate.id === dependencyId)
    return dependency && dependency.endDate.getTime() > latest.getTime() ? dependency.endDate : latest
  }, task.startDate),
  createdAt: addDays(-30 + index),
}))

// Projects for dashboard view
export const projects: Project[] = [
  {
    id: 'p1',
    name: 'PMIS Platform v1.0',
    description: 'Project Management Information System with Gantt charts and dependency tracking',
    status: 'active',
    startDate: addDays(-14),
    endDate: addDays(25),
    progress: 42,
    healthScore: 78,
    delayedMilestones: 1,
    pendingApprovals: 2,
    riskScore: 35,
    teamSize: 8
  },
  {
    id: 'p2',
    name: 'Mobile App Redesign',
    description: 'Complete overhaul of the mobile application UI/UX',
    status: 'delayed',
    startDate: addDays(-30),
    endDate: addDays(10),
    progress: 65,
    healthScore: 45,
    delayedMilestones: 3,
    pendingApprovals: 1,
    riskScore: 72,
    teamSize: 5
  },
  {
    id: 'p3',
    name: 'API Gateway Migration',
    description: 'Migrate legacy REST APIs to new gateway architecture',
    status: 'active',
    startDate: addDays(-7),
    endDate: addDays(35),
    progress: 18,
    healthScore: 92,
    delayedMilestones: 0,
    pendingApprovals: 0,
    riskScore: 15,
    teamSize: 4
  },
  {
    id: 'p4',
    name: 'Security Compliance Audit',
    description: 'SOC 2 Type II compliance preparation and documentation',
    status: 'on-hold',
    startDate: addDays(-21),
    endDate: addDays(45),
    progress: 30,
    healthScore: 60,
    delayedMilestones: 0,
    pendingApprovals: 5,
    riskScore: 50,
    teamSize: 3
  },
]

// Workstreams are delivery lanes. Their IDs stay stable when labels are renamed.
export const initialWorkstreams: Workstream[] = [
  { id: 'foundation', label: 'Foundation', color: 'bg-chart-1/15 text-chart-1' },
  { id: 'core-platform', label: 'Core Platform', color: 'bg-primary/15 text-primary' },
  { id: 'execution-ui', label: 'Execution UI', color: 'bg-chart-2/15 text-chart-2' },
  { id: 'validation', label: 'Validation', color: 'bg-chart-3/15 text-chart-3' },
  { id: 'release', label: 'Release', color: 'bg-chart-5/15 text-chart-5' },
]

// Compatibility lookup for read-only consumers. Runtime CRUD uses store.workstreams.
export const workstreamConfig: Record<WorkstreamGroup, { label: string; color: string }> =
  Object.fromEntries(initialWorkstreams.map(({ id, label, color }) => [id, { label, color }]))

// Team labels and colors (ownership metadata)
export const teamConfig: Record<TaskTeam, { label: string; color: string; dot: string }> = {
  backend: { label: 'Backend', color: 'bg-chart-1/15 text-chart-1', dot: 'bg-chart-1' },
  frontend: { label: 'Frontend', color: 'bg-chart-2/15 text-chart-2', dot: 'bg-chart-2' },
  qa: { label: 'QA', color: 'bg-chart-3/15 text-chart-3', dot: 'bg-chart-3' },
  deployment: { label: 'Deployment', color: 'bg-chart-5/15 text-chart-5', dot: 'bg-chart-5' },
  design: { label: 'Design', color: 'bg-milestone/15 text-milestone', dot: 'bg-milestone' },
  infrastructure: { label: 'Infra', color: 'bg-info/15 text-info', dot: 'bg-info' },
  management: { label: 'Management', color: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
}

// Status config
export const statusConfig: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  todo: { label: 'To Do', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  'in-progress': { label: 'In Progress', color: 'text-info', bgColor: 'bg-info/15' },
  blocked: { label: 'Blocked', color: 'text-destructive', bgColor: 'bg-destructive/15' },
  done: { label: 'Done', color: 'text-success', bgColor: 'bg-success/15' },
}

// Priority config
export const priorityConfig: Record<Priority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-muted-foreground' },
  medium: { label: 'Medium', color: 'text-info' },
  high: { label: 'High', color: 'text-warning' },
  critical: { label: 'Critical', color: 'text-destructive' },
}
