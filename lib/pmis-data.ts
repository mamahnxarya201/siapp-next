// PMIS Mock Data - Realistic project management data

export type TaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskTeam = 'backend' | 'frontend' | 'qa' | 'deployment' | 'design' | 'infrastructure' | 'management'
export type WorkstreamGroup = 'foundation' | 'core-platform' | 'execution-ui' | 'validation' | 'release'

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

export const tasks: Task[] = rawTasks.map((task, index) => ({
  ...task,
  groupName: WORKSTREAM_BY_TASK_ID[task.id] ?? 'core-platform',
  teamName: task.group,
  plannedStart: task.startDate,
  plannedEnd: task.endDate,
  earliestStart: task.startDate,
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

// Workstream labels and colors (delivery lanes)
export const workstreamConfig: Record<WorkstreamGroup, { label: string; color: string }> = {
  foundation: { label: 'Foundation', color: 'bg-cyan-500/20 text-cyan-300' },
  'core-platform': { label: 'Core Platform', color: 'bg-blue-500/20 text-blue-300' },
  'execution-ui': { label: 'Execution UI', color: 'bg-emerald-500/20 text-emerald-300' },
  validation: { label: 'Validation', color: 'bg-amber-500/20 text-amber-300' },
  release: { label: 'Release', color: 'bg-purple-500/20 text-purple-300' },
}

// Team labels and colors (ownership metadata)
export const teamConfig: Record<TaskTeam, { label: string; color: string; dot: string }> = {
  backend: { label: 'Backend', color: 'bg-blue-500/20 text-blue-300', dot: 'bg-blue-400' },
  frontend: { label: 'Frontend', color: 'bg-emerald-500/20 text-emerald-300', dot: 'bg-emerald-400' },
  qa: { label: 'QA', color: 'bg-amber-500/20 text-amber-300', dot: 'bg-amber-400' },
  deployment: { label: 'Deployment', color: 'bg-purple-500/20 text-purple-300', dot: 'bg-purple-400' },
  design: { label: 'Design', color: 'bg-pink-500/20 text-pink-300', dot: 'bg-pink-400' },
  infrastructure: { label: 'Infra', color: 'bg-cyan-500/20 text-cyan-300', dot: 'bg-cyan-400' },
  management: { label: 'Management', color: 'bg-rose-500/20 text-rose-300', dot: 'bg-rose-400' },
}

// Status config
export const statusConfig: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  todo: { label: 'To Do', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  'in-progress': { label: 'In Progress', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  blocked: { label: 'Blocked', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  done: { label: 'Done', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
}

// Priority config
export const priorityConfig: Record<Priority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-muted-foreground' },
  medium: { label: 'Medium', color: 'text-blue-400' },
  high: { label: 'High', color: 'text-amber-400' },
  critical: { label: 'Critical', color: 'text-red-400' },
}
