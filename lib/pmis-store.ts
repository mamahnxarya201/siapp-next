'use client'

import { create } from 'zustand'
import {
  projects as initialProjects,
  teamMembers,
  type Task,
  type Project,
  type TaskTeam,
  type Workstream,
  type WorkstreamGroup,
  type TaskChecklistItem,
} from './pmis-data'
import {
  cloneProjectWorkspace,
  createProjectWorkspaces,
  type ProjectWorkspace,
} from './pmis-project-fixtures'
import { calculateForecast } from './domain/forecast'
import { toActivePlan } from './domain/pmis-adapter'
import type { ForecastResult } from './domain/planning-types'
import {
  collectRecursiveDependentIds,
  removeTasksFromDependencyGraph,
  wouldCreateTaskDependencyCycle,
} from './domain/task-mutations'

const initialProjectWorkspaces = createProjectWorkspaces()
const defaultProjectId = initialProjects[0]?.id ?? ''
const initialWorkspace = cloneProjectWorkspace(
  initialProjectWorkspaces[defaultProjectId] ?? { tasks: [], workstreams: [] },
)

const WORKSTREAM_COLORS = [
  'bg-chart-1/15 text-chart-1',
  'bg-primary/15 text-primary',
  'bg-chart-2/15 text-chart-2',
  'bg-chart-3/15 text-chart-3',
  'bg-chart-5/15 text-chart-5',
  'bg-info/15 text-info',
]

const MAX_HISTORY_ENTRIES = 50

export interface TaskCreationDefaults {
  startDate?: Date
  endDate?: Date
  workstreamId?: WorkstreamGroup
  predecessorIds?: string[]
  dependentIds?: string[]
  isMilestone?: boolean
}

export interface CreateTaskInput {
  name: string
  description: string
  startDate: Date
  endDate: Date
  workstreamId: WorkstreamGroup
  teamName: TaskTeam
  assigneeId: string
  predecessorIds: string[]
  dependentIds: string[]
  isMilestone: boolean
}

export interface UpdateTaskInput {
  name: string
  description: string
  startDate: Date
  endDate: Date
  workstreamId: WorkstreamGroup
  teamName: TaskTeam
  assigneeId: string
  status: Task['status']
  priority: Task['priority']
  riskLevel: Task['riskLevel']
  optimisticDays: number
  estimatedDays: number
  pessimisticDays: number
  predecessorIds: string[]
  blockers: string[]
  linkedChangeRequests: string[]
  labels: string[]
  isMilestone: boolean
}

export interface UpdateChecklistInput {
  items: TaskChecklistItem[]
}

export interface DeleteTaskOptions {
  deleteDescendants: boolean
  deleteWorkstreamIfEmpty: boolean
}

export type PMISMutationResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export type VisibleRow =
  | { type: 'group-header'; group: WorkstreamGroup; workstream: Workstream; taskCount: number }
  | { type: 'task'; task: Task }

interface PMISHistorySnapshot {
  tasks: Task[]
  workstreams: Workstream[]
  expandedGroups: WorkstreamGroup[]
  selectedTaskId: string | null
  inspectorOpen: boolean
}

function createClientId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${randomId}`
}

function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function cloneTask(task: Task): Task {
  return {
    ...task,
    assignee: { ...task.assignee },
    approverId: task.approverId,
    actual: task.actual ? { ...task.actual } : undefined,
    startDate: new Date(task.startDate),
    endDate: new Date(task.endDate),
    plannedStart: task.plannedStart ? new Date(task.plannedStart) : undefined,
    plannedEnd: task.plannedEnd ? new Date(task.plannedEnd) : undefined,
    earliestStart: task.earliestStart ? new Date(task.earliestStart) : undefined,
    createdAt: task.createdAt ? new Date(task.createdAt) : undefined,
    dependencies: [...task.dependencies],
    dependents: [...task.dependents],
    blockers: [...task.blockers],
    linkedChangeRequests: [...task.linkedChangeRequests],
    comments: task.comments.map((comment) => ({
      ...comment,
      timestamp: new Date(comment.timestamp),
    })),
  }
}

function cloneWorkstream(workstream: Workstream): Workstream {
  return { ...workstream }
}

function captureHistorySnapshot(state: PMISHistorySnapshot): PMISHistorySnapshot {
  return {
    tasks: state.tasks.map(cloneTask),
    workstreams: state.workstreams.map(cloneWorkstream),
    expandedGroups: [...state.expandedGroups],
    selectedTaskId: state.selectedTaskId,
    inspectorOpen: state.inspectorOpen,
  }
}

function restoreHistorySnapshot(snapshot: PMISHistorySnapshot): PMISHistorySnapshot {
  return captureHistorySnapshot(snapshot)
}

function pushHistoryEntry(stack: PMISHistorySnapshot[], snapshot: PMISHistorySnapshot): PMISHistorySnapshot[] {
  return [...stack.slice(-(MAX_HISTORY_ENTRIES - 1)), snapshot]
}

function historySnapshotsMatch(left: PMISHistorySnapshot, right: PMISHistorySnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function historyFlags(undoStack: PMISHistorySnapshot[], redoStack: PMISHistorySnapshot[]) {
  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  }
}

function createsDependencyCycle(tasks: Task[], predecessorIds: string[], dependentIds: string[]): boolean {
  if (predecessorIds.some((id) => dependentIds.includes(id))) return true

  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const predecessorSet = new Set(predecessorIds)

  for (const dependentId of dependentIds) {
    const visited = new Set<string>()
    const pending = [dependentId]

    while (pending.length > 0) {
      const currentId = pending.pop()!
      if (visited.has(currentId)) continue
      visited.add(currentId)
      if (predecessorSet.has(currentId)) return true
      taskById.get(currentId)?.dependents.forEach((id) => pending.push(id))
    }
  }

  return false
}

function propagateScheduleForward(tasks: Task[], predecessorIds: string[]): Task[] {
  const taskById = new Map(tasks.map((task) => [task.id, { ...task }]))
  const pending = [...predecessorIds]
  const queued = new Set(pending)

  while (pending.length > 0) {
    const predecessorId = pending.shift()!
    queued.delete(predecessorId)
    const predecessor = taskById.get(predecessorId)
    if (!predecessor) continue

    for (const dependentId of predecessor.dependents) {
      const dependent = taskById.get(dependentId)
      if (!dependent) continue

      const minimumStart = dependent.dependencies.reduce<Date | null>((latest, dependencyId) => {
        const dependency = taskById.get(dependencyId)
        if (!dependency) return latest
        return !latest || dependency.endDate.getTime() > latest.getTime()
          ? dependency.endDate
          : latest
      }, null)

      if (!minimumStart || dependent.startDate.getTime() >= minimumStart.getTime()) continue

      const duration = Math.max(24 * 60 * 60 * 1000, dependent.endDate.getTime() - dependent.startDate.getTime())
      const shifted = {
        ...dependent,
        startDate: new Date(minimumStart),
        endDate: new Date(minimumStart.getTime() + duration),
        earliestStart: new Date(minimumStart),
      }
      taskById.set(dependentId, shifted)

      if (!queued.has(dependentId)) {
        pending.push(dependentId)
        queued.add(dependentId)
      }
    }
  }

  return tasks.map((task) => taskById.get(task.id) ?? task)
}

interface PMISState {
  // View state
  currentView: 'dashboard' | 'project'
  currentProjectId: string | null
  
  // Data
  tasks: Task[]
  projects: Project[]
  workstreams: Workstream[]
  projectWorkspaces: Record<string, ProjectWorkspace>
  
  // Selection state
  selectedTaskId: string | null
  hoveredTaskId: string | null
  
  // UI state
  timelineScale: 'day' | 'week' | 'month'
  showAllDependencies: boolean
  showCriticalPath: boolean
  expandedGroups: WorkstreamGroup[]
  inspectorOpen: boolean
  inspectorEditingTaskId: string | null
  taskCreateOpen: boolean
  taskCreateDefaults: TaskCreationDefaults
  taskDeleteTargetId: string | null
  undoStack: PMISHistorySnapshot[]
  redoStack: PMISHistorySnapshot[]
  historyTransaction: PMISHistorySnapshot | null
  canUndo: boolean
  canRedo: boolean
  
  // Filter state
  searchQuery: string
  statusFilter: string[]
  assigneeFilter: string[]
  
  // Actions
  setCurrentView: (view: 'dashboard' | 'project') => void
  setCurrentProject: (projectId: string | null) => void
  selectTask: (taskId: string | null) => void
  hoverTask: (taskId: string | null) => void
  setTimelineScale: (scale: 'day' | 'week' | 'month') => void
  toggleAllDependencies: () => void
  toggleCriticalPath: () => void
  toggleGroup: (group: WorkstreamGroup) => void
  setInspectorOpen: (open: boolean) => void
  setInspectorEditingTask: (taskId: string | null) => void
  setSearchQuery: (query: string) => void
  openTaskCreate: (defaults?: TaskCreationDefaults) => void
  closeTaskCreate: () => void
  createTask: (input: CreateTaskInput) => PMISMutationResult
  updateTask: (taskId: string, input: UpdateTaskInput) => PMISMutationResult
  updateTaskChecklist: (taskId: string, input: UpdateChecklistInput) => PMISMutationResult
  openTaskDelete: (taskId: string) => void
  closeTaskDelete: () => void
  deleteTask: (taskId: string, options: DeleteTaskOptions) => PMISMutationResult
  createWorkstream: (label: string) => PMISMutationResult
  renameWorkstream: (id: WorkstreamGroup, label: string) => PMISMutationResult
  deleteWorkstream: (id: WorkstreamGroup) => PMISMutationResult
  beginHistoryTransaction: () => void
  commitHistoryTransaction: () => void
  undo: () => void
  redo: () => void
  updateTaskDates: (taskId: string, startDate: Date, endDate: Date) => void
  updateTaskDatesBatch: (updates: { taskId: string; startDate: Date; endDate: Date }[]) => void
  updateTaskStatus: (taskId: string, status: Task['status']) => void
  reportTaskCompletion: (taskId: string, actorId?: string) => PMISMutationResult
  confirmTaskCompletion: (taskId: string, actorId?: string) => PMISMutationResult
  
  // Computed
  getTaskById: (id: string) => Task | undefined
  getTaskDependencies: (taskId: string) => Task[]
  getTaskDependents: (taskId: string) => Task[]
  getUpstreamChain: (taskId: string) => Task[]
  getDownstreamChain: (taskId: string) => Task[]
  getTasksByGroup: (group: WorkstreamGroup) => Task[]
  getCriticalPathTasks: () => Task[]
  getPortfolioTasks: () => Task[]
  getVisibleRows: () => VisibleRow[]
  getCurrentForecast: () => ForecastResult | null
}

export const usePMISStore = create<PMISState>((set, get) => ({
  // Initial state
  currentView: 'dashboard',
  currentProjectId: null,
  tasks: initialWorkspace.tasks,
  projects: initialProjects,
  workstreams: initialWorkspace.workstreams,
  projectWorkspaces: initialProjectWorkspaces,
  selectedTaskId: null,
  hoveredTaskId: null,
  timelineScale: 'week',
  showAllDependencies: false,
  showCriticalPath: false,
  expandedGroups: ['foundation', 'core-platform', 'execution-ui', 'validation', 'release'],
  inspectorOpen: true,
  inspectorEditingTaskId: null,
  taskCreateOpen: false,
  taskCreateDefaults: {},
  taskDeleteTargetId: null,
  undoStack: [],
  redoStack: [],
  historyTransaction: null,
  canUndo: false,
  canRedo: false,
  searchQuery: '',
  statusFilter: [],
  assigneeFilter: [],
  
  // Actions
  setCurrentView: (view) => set({ currentView: view }),
  
  setCurrentProject: (projectId) => set((state) => {
    const projectWorkspaces = state.currentProjectId
      ? {
          ...state.projectWorkspaces,
          [state.currentProjectId]: {
            tasks: state.tasks,
            workstreams: state.workstreams,
          },
        }
      : state.projectWorkspaces
    const workspaceId = projectId ?? defaultProjectId
    const workspace = projectWorkspaces[workspaceId] ?? { tasks: [], workstreams: [] }

    return {
      projectWorkspaces,
      currentProjectId: projectId,
      currentView: projectId ? 'project' : 'dashboard',
      tasks: workspace.tasks,
      workstreams: workspace.workstreams,
      expandedGroups: workspace.workstreams.map((workstream) => workstream.id),
      selectedTaskId: null,
      inspectorEditingTaskId: null,
      hoveredTaskId: null,
      showAllDependencies: false,
      showCriticalPath: false,
      searchQuery: '',
      taskCreateOpen: false,
      taskCreateDefaults: {},
      taskDeleteTargetId: null,
      undoStack: [],
      redoStack: [],
      historyTransaction: null,
      canUndo: false,
      canRedo: false,
    }
  }),
  
  selectTask: (taskId) => set((state) => ({
    selectedTaskId: taskId,
    inspectorOpen: taskId !== null,
    inspectorEditingTaskId: state.selectedTaskId === taskId
      ? state.inspectorEditingTaskId
      : null,
  })),
  
  hoverTask: (taskId) => set({ hoveredTaskId: taskId }),
  
  setTimelineScale: (scale) => set({ timelineScale: scale }),
  
  toggleAllDependencies: () => set((state) => ({ 
    showAllDependencies: !state.showAllDependencies 
  })),
  
  toggleCriticalPath: () => set((state) => ({ 
    showCriticalPath: !state.showCriticalPath 
  })),
  
  toggleGroup: (group) => set((state) => ({
    expandedGroups: state.expandedGroups.includes(group)
      ? state.expandedGroups.filter(g => g !== group)
      : [...state.expandedGroups, group]
  })),
  
  setInspectorOpen: (open) => set({ inspectorOpen: open }),

  setInspectorEditingTask: (taskId) => set({ inspectorEditingTaskId: taskId }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),

  openTaskCreate: (defaults = {}) => set({
    taskCreateOpen: true,
    taskCreateDefaults: defaults,
  }),

  closeTaskCreate: () => set({ taskCreateOpen: false, taskCreateDefaults: {} }),

  createTask: (input) => {
    const state = get()
    const name = input.name.trim()
    const description = input.description.trim()
    const predecessorIds = Array.from(new Set(input.predecessorIds)).filter((id) => state.tasks.some((task) => task.id === id))
    const dependentIds = Array.from(new Set(input.dependentIds)).filter((id) => state.tasks.some((task) => task.id === id))

    if (!name) return { ok: false, error: 'Task title is required.' }
    if (!state.workstreams.some((workstream) => workstream.id === input.workstreamId)) {
      return { ok: false, error: 'Choose an existing workstream.' }
    }
    if (input.endDate.getTime() <= input.startDate.getTime()) {
      return { ok: false, error: 'End date must be after start date.' }
    }
    if (createsDependencyCycle(state.tasks, predecessorIds, dependentIds)) {
      return { ok: false, error: 'Those predecessor and dependent choices would create a dependency cycle.' }
    }

    const assignee = teamMembers.find((member) => member.id === input.assigneeId) ?? teamMembers[0]
    const duration = input.endDate.getTime() - input.startDate.getTime()
    const minimumStart = predecessorIds.reduce<Date | null>((latest, predecessorId) => {
      const predecessor = state.tasks.find((task) => task.id === predecessorId)
      if (!predecessor) return latest
      return !latest || predecessor.endDate.getTime() > latest.getTime() ? predecessor.endDate : latest
    }, null)
    const startDate = minimumStart && input.startDate.getTime() < minimumStart.getTime()
      ? new Date(minimumStart)
      : new Date(input.startDate)
    const endDate = new Date(startDate.getTime() + duration)
    const durationDays = Math.max(1, Math.round(duration / (24 * 60 * 60 * 1000)))
    const taskId = createClientId('task')
    const task: Task = {
      id: taskId,
      name,
      description,
      group: input.teamName,
      groupName: input.workstreamId,
      teamName: input.teamName,
      status: 'todo',
      priority: 'medium',
      assignee,
      approverId: 'u1',
      startDate,
      endDate,
      plannedStart: new Date(startDate),
      plannedEnd: new Date(endDate),
      earliestStart: minimumStart ? new Date(minimumStart) : new Date(startDate),
      createdAt: new Date(),
      estimatedDays: durationDays,
      optimisticDays: Math.max(1, durationDays - 1),
      pessimisticDays: durationDays + 1,
      dependencies: predecessorIds,
      dependents: dependentIds,
      blockers: [],
      progress: 0,
      checklist: [],
      isMilestone: input.isMilestone,
      isCriticalPath: false,
      linkedChangeRequests: [],
      labels: [],
      comments: [],
      riskLevel: 'low',
    }

    let nextTasks = state.tasks.map((existingTask) => {
      if (predecessorIds.includes(existingTask.id)) {
        return { ...existingTask, dependents: Array.from(new Set([...existingTask.dependents, taskId])) }
      }
      if (dependentIds.includes(existingTask.id)) {
        return { ...existingTask, dependencies: Array.from(new Set([...existingTask.dependencies, taskId])) }
      }
      return existingTask
    })
    nextTasks.push(task)
    nextTasks = propagateScheduleForward(nextTasks, [taskId])
    const previousHistory = captureHistorySnapshot(state)
    const nextUndoStack = pushHistoryEntry(state.undoStack, previousHistory)

    set({
      tasks: nextTasks,
      selectedTaskId: taskId,
      inspectorOpen: true,
      inspectorEditingTaskId: null,
      taskCreateOpen: false,
      taskCreateDefaults: {},
      expandedGroups: state.expandedGroups.includes(input.workstreamId)
        ? state.expandedGroups
        : [...state.expandedGroups, input.workstreamId],
      currentProjectId: state.currentProjectId ?? state.projects[0]?.id ?? null,
      currentView: 'project',
      undoStack: nextUndoStack,
      redoStack: [],
      historyTransaction: null,
      ...historyFlags(nextUndoStack, []),
    })

    return { ok: true, id: taskId }
  },

  updateTask: (taskId, input) => {
    const state = get()
    const task = state.tasks.find((candidate) => candidate.id === taskId)
    if (!task) return { ok: false, error: 'Task not found.' }

    const name = input.name.trim()
    const description = input.description.trim()
    const predecessorIds = Array.from(new Set(input.predecessorIds))
      .filter((id) => id !== taskId && state.tasks.some((candidate) => candidate.id === id))
    const blockers = input.blockers.map((blocker) => blocker.trim()).filter(Boolean)
    const linkedChangeRequests = input.linkedChangeRequests.map((item) => item.trim()).filter(Boolean)
    const labels = input.labels.map((item) => item.trim()).filter(Boolean)

    if (!name) return { ok: false, error: 'Task title is required.' }
    if (!state.workstreams.some((workstream) => workstream.id === input.workstreamId)) {
      return { ok: false, error: 'Choose an existing workstream.' }
    }
    if (input.endDate.getTime() <= input.startDate.getTime()) {
      return { ok: false, error: 'End date must be after start date.' }
    }
    if (
      !Number.isFinite(input.optimisticDays)
      || !Number.isFinite(input.estimatedDays)
      || !Number.isFinite(input.pessimisticDays)
      || input.optimisticDays <= 0
      || input.optimisticDays > input.estimatedDays
      || input.estimatedDays > input.pessimisticDays
    ) {
      return { ok: false, error: 'PERT estimates must be positive and ordered optimistic ≤ most likely ≤ pessimistic.' }
    }
    if (input.status === 'done' && !task.actual?.confirmedAt) {
      return { ok: false, error: 'Completion must be reported and confirmed through the governed completion flow.' }
    }
    if (wouldCreateTaskDependencyCycle(state.tasks, taskId, predecessorIds)) {
      return { ok: false, error: 'Those predecessor choices would create a dependency cycle.' }
    }

    const assignee = teamMembers.find((member) => member.id === input.assigneeId) ?? task.assignee
    const duration = input.endDate.getTime() - input.startDate.getTime()
    const minimumStart = predecessorIds.reduce<Date | null>((latest, predecessorId) => {
      const predecessor = state.tasks.find((candidate) => candidate.id === predecessorId)
      if (!predecessor) return latest
      return !latest || predecessor.endDate.getTime() > latest.getTime() ? predecessor.endDate : latest
    }, null)
    const startDate = minimumStart && input.startDate.getTime() < minimumStart.getTime()
      ? new Date(minimumStart)
      : new Date(input.startDate)
    const endDate = new Date(startDate.getTime() + duration)

    let nextTasks = state.tasks.map((candidate) => {
      if (candidate.id === taskId) {
        return {
          ...candidate,
          name,
          description,
          group: input.teamName,
          groupName: input.workstreamId,
          teamName: input.teamName,
          assignee,
          status: input.status,
          priority: input.priority,
          riskLevel: input.riskLevel,
          startDate,
          endDate,
          earliestStart: minimumStart ? new Date(minimumStart) : new Date(startDate),
          optimisticDays: Math.round(input.optimisticDays),
          estimatedDays: Math.round(input.estimatedDays),
          pessimisticDays: Math.round(input.pessimisticDays),
          dependencies: predecessorIds,
          blockers,
          linkedChangeRequests,
          labels,
          isMilestone: input.isMilestone,
        }
      }

      const wasPredecessor = task.dependencies.includes(candidate.id)
      const isPredecessor = predecessorIds.includes(candidate.id)
      if (wasPredecessor === isPredecessor) return candidate
      return {
        ...candidate,
        dependents: isPredecessor
          ? Array.from(new Set([...candidate.dependents, taskId]))
          : candidate.dependents.filter((dependentId) => dependentId !== taskId),
      }
    })
    nextTasks = propagateScheduleForward(nextTasks, [taskId])

    const nextUndoStack = pushHistoryEntry(state.undoStack, captureHistorySnapshot(state))
    set({
      tasks: nextTasks,
      expandedGroups: state.expandedGroups.includes(input.workstreamId)
        ? state.expandedGroups
        : [...state.expandedGroups, input.workstreamId],
      undoStack: nextUndoStack,
      redoStack: [],
      historyTransaction: null,
      ...historyFlags(nextUndoStack, []),
    })
    return { ok: true, id: taskId }
  },

  updateTaskChecklist: (taskId, input) => {
    const state = get()
    const task = state.tasks.find((candidate) => candidate.id === taskId)
    if (!task) return { ok: false, error: 'Task not found.' }
    const items = input.items
      .map((item) => ({ ...item, text: item.text.trim(), weight: Math.max(0, Math.round(item.weight)) }))
      .filter((item) => item.text)
    if (items.some((item) => item.weight < 0) || (items.length > 0 && items.reduce((sum, item) => sum + item.weight, 0) !== 100)) {
      return { ok: false, error: 'Checklist weights must total 100%.' }
    }
    const progress = items.length === 0 ? 0 : Math.ceil(items.reduce((sum, item) => sum + (item.completed ? item.weight : 0), 0))
    const nextUndoStack = pushHistoryEntry(state.undoStack, captureHistorySnapshot(state))
    set({
      tasks: state.tasks.map((candidate) => candidate.id === taskId ? { ...candidate, checklist: items, progress } : candidate),
      undoStack: nextUndoStack,
      redoStack: [],
      ...historyFlags(nextUndoStack, []),
    })
    return { ok: true, id: taskId }
  },

  openTaskDelete: (taskId) => set({ taskDeleteTargetId: taskId }),

  closeTaskDelete: () => set({ taskDeleteTargetId: null }),

  deleteTask: (taskId, options) => {
    const state = get()
    const task = state.tasks.find((candidate) => candidate.id === taskId)
    if (!task) return { ok: false, error: 'Task not found.' }

    const taskIds = new Set([taskId])
    if (options.deleteDescendants) {
      collectRecursiveDependentIds(state.tasks, taskId).forEach((id) => taskIds.add(id))
    }

    const nextTasks = removeTasksFromDependencyGraph(state.tasks, taskIds)
    const removeWorkstream = options.deleteWorkstreamIfEmpty
      && !nextTasks.some((candidate) => candidate.groupName === task.groupName)
    const nextUndoStack = pushHistoryEntry(state.undoStack, captureHistorySnapshot(state))

    set({
      tasks: nextTasks,
      workstreams: removeWorkstream
        ? state.workstreams.filter((workstream) => workstream.id !== task.groupName)
        : state.workstreams,
      expandedGroups: removeWorkstream
        ? state.expandedGroups.filter((group) => group !== task.groupName)
        : state.expandedGroups,
      selectedTaskId: taskIds.has(state.selectedTaskId ?? '') ? null : state.selectedTaskId,
      hoveredTaskId: taskIds.has(state.hoveredTaskId ?? '') ? null : state.hoveredTaskId,
      inspectorOpen: taskIds.has(state.selectedTaskId ?? '') ? false : state.inspectorOpen,
      taskDeleteTargetId: null,
      inspectorEditingTaskId: null,
      undoStack: nextUndoStack,
      redoStack: [],
      historyTransaction: null,
      ...historyFlags(nextUndoStack, []),
    })

    return { ok: true, id: taskId }
  },

  createWorkstream: (label) => {
    const normalizedLabel = label.trim()
    if (!normalizedLabel) return { ok: false, error: 'Workstream name is required.' }
    const state = get()
    if (state.workstreams.some((workstream) => workstream.label.toLowerCase() === normalizedLabel.toLowerCase())) {
      return { ok: false, error: 'A workstream with that name already exists.' }
    }
    const id = createClientId('workstream')
    const workstream: Workstream = {
      id,
      label: normalizedLabel,
      color: WORKSTREAM_COLORS[state.workstreams.length % WORKSTREAM_COLORS.length],
    }
    const nextUndoStack = pushHistoryEntry(state.undoStack, captureHistorySnapshot(state))
    set({
      workstreams: [...state.workstreams, workstream],
      expandedGroups: [...state.expandedGroups, id],
      undoStack: nextUndoStack,
      redoStack: [],
      historyTransaction: null,
      ...historyFlags(nextUndoStack, []),
    })
    return { ok: true, id }
  },

  renameWorkstream: (id, label) => {
    const normalizedLabel = label.trim()
    if (!normalizedLabel) return { ok: false, error: 'Workstream name is required.' }
    const state = get()
    if (state.workstreams.some((workstream) => workstream.id !== id && workstream.label.toLowerCase() === normalizedLabel.toLowerCase())) {
      return { ok: false, error: 'A workstream with that name already exists.' }
    }
    if (!state.workstreams.some((workstream) => workstream.id === id)) {
      return { ok: false, error: 'Workstream not found.' }
    }
    const nextUndoStack = pushHistoryEntry(state.undoStack, captureHistorySnapshot(state))
    set({
      workstreams: state.workstreams.map((workstream) => workstream.id === id
        ? { ...workstream, label: normalizedLabel }
        : workstream),
      undoStack: nextUndoStack,
      redoStack: [],
      historyTransaction: null,
      ...historyFlags(nextUndoStack, []),
    })
    return { ok: true, id }
  },

  deleteWorkstream: (id) => {
    const state = get()
    if (state.tasks.some((task) => task.groupName === id)) {
      return { ok: false, error: 'Move this workstream\'s tasks before deleting it.' }
    }
    if (!state.workstreams.some((workstream) => workstream.id === id)) {
      return { ok: false, error: 'Workstream not found.' }
    }
    const nextUndoStack = pushHistoryEntry(state.undoStack, captureHistorySnapshot(state))
    set({
      workstreams: state.workstreams.filter((workstream) => workstream.id !== id),
      expandedGroups: state.expandedGroups.filter((group) => group !== id),
      undoStack: nextUndoStack,
      redoStack: [],
      historyTransaction: null,
      ...historyFlags(nextUndoStack, []),
    })
    return { ok: true, id }
  },

  beginHistoryTransaction: () => set((state) => (
    state.historyTransaction
      ? {}
      : { historyTransaction: captureHistorySnapshot(state) }
  )),

  commitHistoryTransaction: () => set((state) => {
    if (!state.historyTransaction) return {}
    const currentSnapshot = captureHistorySnapshot(state)
    if (historySnapshotsMatch(state.historyTransaction, currentSnapshot)) {
      return { historyTransaction: null }
    }

    const nextUndoStack = pushHistoryEntry(state.undoStack, state.historyTransaction)
    return {
      undoStack: nextUndoStack,
      redoStack: [],
      historyTransaction: null,
      ...historyFlags(nextUndoStack, []),
    }
  }),

  undo: () => set((state) => {
    if (state.historyTransaction) return {}

    const previous = state.undoStack[state.undoStack.length - 1]
    if (!previous) return {}

    const nextUndoStack = state.undoStack.slice(0, -1)
    const nextRedoStack = pushHistoryEntry(state.redoStack, captureHistorySnapshot(state))
    return {
      ...restoreHistorySnapshot(previous),
      undoStack: nextUndoStack,
      redoStack: nextRedoStack,
      historyTransaction: null,
      hoveredTaskId: null,
      taskCreateOpen: false,
      taskCreateDefaults: {},
      taskDeleteTargetId: null,
      inspectorEditingTaskId: null,
      ...historyFlags(nextUndoStack, nextRedoStack),
    }
  }),

  redo: () => set((state) => {
    if (state.historyTransaction) return {}

    const next = state.redoStack[state.redoStack.length - 1]
    if (!next) return {}

    const nextUndoStack = pushHistoryEntry(state.undoStack, captureHistorySnapshot(state))
    const nextRedoStack = state.redoStack.slice(0, -1)
    return {
      ...restoreHistorySnapshot(next),
      undoStack: nextUndoStack,
      redoStack: nextRedoStack,
      historyTransaction: null,
      hoveredTaskId: null,
      taskCreateOpen: false,
      taskCreateDefaults: {},
      taskDeleteTargetId: null,
      ...historyFlags(nextUndoStack, nextRedoStack),
    }
  }),
  
  updateTaskDates: (taskId, startDate, endDate) => set((state) => {
    const nextUndoStack = state.historyTransaction
      ? state.undoStack
      : pushHistoryEntry(state.undoStack, captureHistorySnapshot(state))

    return {
      tasks: state.tasks.map(task =>
        task.id === taskId
          ? { ...task, startDate, endDate }
          : task
      ),
      undoStack: nextUndoStack,
      redoStack: state.historyTransaction ? state.redoStack : [],
      ...historyFlags(nextUndoStack, state.historyTransaction ? state.redoStack : []),
    }
  }),

  updateTaskDatesBatch: (updates) => set((state) => {
    if (updates.length === 0) return {}
    const updatesByTaskId = new Map(updates.map((update) => [update.taskId, update]))
    const nextUndoStack = state.historyTransaction
      ? state.undoStack
      : pushHistoryEntry(state.undoStack, captureHistorySnapshot(state))
    const nextRedoStack = state.historyTransaction ? state.redoStack : []

    return {
      tasks: state.tasks.map((task) => {
        const update = updatesByTaskId.get(task.id)
        return update
          ? { ...task, startDate: update.startDate, endDate: update.endDate }
          : task
      }),
      undoStack: nextUndoStack,
      redoStack: nextRedoStack,
      ...historyFlags(nextUndoStack, nextRedoStack),
    }
  }),
  
  updateTaskStatus: (taskId, status) => set((state) => {
    const nextUndoStack = pushHistoryEntry(state.undoStack, captureHistorySnapshot(state))
    return {
      tasks: state.tasks.map(task =>
        task.id === taskId
          ? { ...task, status, progress: status === 'done' ? 100 : task.progress }
          : task
      ),
      undoStack: nextUndoStack,
      redoStack: [],
      historyTransaction: null,
      ...historyFlags(nextUndoStack, []),
    }
  }),

  reportTaskCompletion: (taskId, actorId = 'u1') => {
    const state = get()
    const task = state.tasks.find((candidate) => candidate.id === taskId)
    if (!task) return { ok: false, error: 'Task not found.' }
    if (task.assignee.id !== actorId) return { ok: false, error: 'Only the assignee can report completion.' }
    const nextUndoStack = pushHistoryEntry(state.undoStack, captureHistorySnapshot(state))
    set({
      tasks: state.tasks.map((candidate) => candidate.id === taskId
        ? {
            ...candidate,
            actual: {
              progress: 100,
              status: 'done',
              reportedAt: new Date(),
              reportedBy: actorId,
              reportedCompletionAt: new Date(),
            },
          }
        : candidate),
      undoStack: nextUndoStack,
      redoStack: [],
      ...historyFlags(nextUndoStack, []),
    })
    return { ok: true, id: taskId }
  },

  confirmTaskCompletion: (taskId, actorId = 'u1') => {
    const state = get()
    const task = state.tasks.find((candidate) => candidate.id === taskId)
    if (!task) return { ok: false, error: 'Task not found.' }
    if (!task.actual?.reportedCompletionAt) return { ok: false, error: 'The assignee must report completion first.' }
    if (task.approverId && task.approverId !== actorId) return { ok: false, error: 'Only the task approver can confirm completion.' }
    const nextUndoStack = pushHistoryEntry(state.undoStack, captureHistorySnapshot(state))
    set({
      tasks: state.tasks.map((candidate) => candidate.id === taskId
        ? { ...candidate, status: 'done', progress: 100, actual: { ...candidate.actual!, confirmedAt: new Date(), confirmedBy: actorId } }
        : candidate),
      undoStack: nextUndoStack,
      redoStack: [],
      ...historyFlags(nextUndoStack, []),
    })
    return { ok: true, id: taskId }
  },
  
  // Computed getters
  getTaskById: (id) => get().tasks.find(t => t.id === id),
  
  getTaskDependencies: (taskId) => {
    const task = get().tasks.find(t => t.id === taskId)
    if (!task) return []
    return get().tasks.filter(t => task.dependencies.includes(t.id))
  },
  
  getTaskDependents: (taskId) => {
    const task = get().tasks.find(t => t.id === taskId)
    if (!task) return []
    return get().tasks.filter(t => task.dependents.includes(t.id))
  },
  
  getUpstreamChain: (taskId) => {
    const visited = new Set<string>()
    const result: Task[] = []
    
    const traverse = (id: string) => {
      if (visited.has(id)) return
      visited.add(id)
      
      const task = get().tasks.find(t => t.id === id)
      if (!task) return
      
      task.dependencies.forEach(depId => {
        const dep = get().tasks.find(t => t.id === depId)
        if (dep) {
          result.push(dep)
          traverse(depId)
        }
      })
    }
    
    traverse(taskId)
    return result
  },
  
  getDownstreamChain: (taskId) => {
    const visited = new Set<string>()
    const result: Task[] = []
    
    const traverse = (id: string) => {
      if (visited.has(id)) return
      visited.add(id)
      
      const task = get().tasks.find(t => t.id === id)
      if (!task) return
      
      task.dependents.forEach(depId => {
        const dep = get().tasks.find(t => t.id === depId)
        if (dep) {
          result.push(dep)
          traverse(depId)
        }
      })
    }
    
    traverse(taskId)
    return result
  },
  
  getTasksByGroup: (group) => get().tasks.filter(t => t.groupName === group),
  
  getCriticalPathTasks: () => get().tasks.filter(t => t.isCriticalPath),

  getCurrentForecast: () => {
    const state = get()
    if (!state.currentProjectId) return null
    return calculateForecast(toActivePlan(state.currentProjectId, state.tasks))
  },

  getPortfolioTasks: () => {
    const { projectWorkspaces, currentProjectId, tasks } = get()
    return Object.entries(projectWorkspaces).flatMap(([projectId, workspace]) => (
      projectId === currentProjectId ? tasks : workspace.tasks
    ))
  },

  getVisibleRows: () => {
    const { tasks, workstreams, expandedGroups, searchQuery } = get()
    const query = searchQuery.trim().toLowerCase()
    const rows: VisibleRow[] = []

    const knownWorkstreamIds = new Set(workstreams.map((workstream) => workstream.id))
    const fallbackWorkstreams = Array.from(new Set(tasks.map((task) => task.groupName)))
      .filter((id) => !knownWorkstreamIds.has(id))
      .map((id) => ({ id, label: id, color: 'bg-muted text-muted-foreground' }))
    const orderedWorkstreams = [...workstreams, ...fallbackWorkstreams]

    orderedWorkstreams.forEach((workstream) => {
      const group = workstream.id
      let groupTasks = tasks.filter((task) => task.groupName === group)
      groupTasks = groupTasks.sort((a, b) => {
        const aStart = a.earliestStart ?? a.plannedStart ?? a.startDate
        const bStart = b.earliestStart ?? b.plannedStart ?? b.startDate
        const startDiff = aStart.getTime() - bStart.getTime()
        if (startDiff !== 0) return startDiff

        if (a.isCriticalPath !== b.isCriticalPath) {
          return a.isCriticalPath ? -1 : 1
        }

        const aCreated = a.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER
        const bCreated = b.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER
        if (aCreated !== bCreated) return aCreated - bCreated

        return a.id.localeCompare(b.id)
      })

      if (query) {
        groupTasks = groupTasks.filter(
          (task) =>
            task.name.toLowerCase().includes(query) ||
            task.assignee.name.toLowerCase().includes(query)
        )
      }

      if (query && groupTasks.length === 0) {
        return
      }

      rows.push({ type: 'group-header', group, workstream, taskCount: groupTasks.length })

      if (expandedGroups.includes(group)) {
        groupTasks.forEach((task) => rows.push({ type: 'task', task }))
      }
    })

    return rows
  },
}))
