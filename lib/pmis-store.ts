'use client'

import { create } from 'zustand'
import {
  tasks as initialTasks,
  projects as initialProjects,
  initialWorkstreams,
  teamMembers,
  type Task,
  type Project,
  type TaskTeam,
  type Workstream,
  type WorkstreamGroup,
} from './pmis-data'

const WORKSTREAM_COLORS = [
  'bg-chart-1/15 text-chart-1',
  'bg-primary/15 text-primary',
  'bg-chart-2/15 text-chart-2',
  'bg-chart-3/15 text-chart-3',
  'bg-chart-5/15 text-chart-5',
  'bg-info/15 text-info',
]

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

export type PMISMutationResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export type VisibleRow =
  | { type: 'group-header'; group: WorkstreamGroup; workstream: Workstream; taskCount: number }
  | { type: 'task'; task: Task }

function createClientId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${randomId}`
}

function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
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
  
  // Selection state
  selectedTaskId: string | null
  hoveredTaskId: string | null
  
  // UI state
  timelineScale: 'day' | 'week' | 'month'
  showAllDependencies: boolean
  showCriticalPath: boolean
  expandedGroups: WorkstreamGroup[]
  inspectorOpen: boolean
  taskCreateOpen: boolean
  taskCreateDefaults: TaskCreationDefaults
  
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
  setSearchQuery: (query: string) => void
  openTaskCreate: (defaults?: TaskCreationDefaults) => void
  closeTaskCreate: () => void
  createTask: (input: CreateTaskInput) => PMISMutationResult
  createWorkstream: (label: string) => PMISMutationResult
  renameWorkstream: (id: WorkstreamGroup, label: string) => PMISMutationResult
  deleteWorkstream: (id: WorkstreamGroup) => PMISMutationResult
  updateTaskDates: (taskId: string, startDate: Date, endDate: Date) => void
  updateTaskDatesBatch: (updates: { taskId: string; startDate: Date; endDate: Date }[]) => void
  updateTaskStatus: (taskId: string, status: Task['status']) => void
  
  // Computed
  getTaskById: (id: string) => Task | undefined
  getTaskDependencies: (taskId: string) => Task[]
  getTaskDependents: (taskId: string) => Task[]
  getUpstreamChain: (taskId: string) => Task[]
  getDownstreamChain: (taskId: string) => Task[]
  getTasksByGroup: (group: WorkstreamGroup) => Task[]
  getCriticalPathTasks: () => Task[]
  getVisibleRows: () => VisibleRow[]
}

export const usePMISStore = create<PMISState>((set, get) => ({
  // Initial state
  currentView: 'dashboard',
  currentProjectId: null,
  tasks: initialTasks,
  projects: initialProjects,
  workstreams: initialWorkstreams.map((workstream) => ({ ...workstream })),
  selectedTaskId: null,
  hoveredTaskId: null,
  timelineScale: 'week',
  showAllDependencies: false,
  showCriticalPath: false,
  expandedGroups: ['foundation', 'core-platform', 'execution-ui', 'validation', 'release'],
  inspectorOpen: true,
  taskCreateOpen: false,
  taskCreateDefaults: {},
  searchQuery: '',
  statusFilter: [],
  assigneeFilter: [],
  
  // Actions
  setCurrentView: (view) => set({ currentView: view }),
  
  setCurrentProject: (projectId) => set({ 
    currentProjectId: projectId, 
    currentView: projectId ? 'project' : 'dashboard',
    selectedTaskId: null,
    hoveredTaskId: null
  }),
  
  selectTask: (taskId) => set({ 
    selectedTaskId: taskId,
    inspectorOpen: taskId !== null 
  }),
  
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
      isMilestone: input.isMilestone,
      isCriticalPath: false,
      linkedChangeRequests: [],
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

    set({
      tasks: nextTasks,
      selectedTaskId: taskId,
      inspectorOpen: true,
      taskCreateOpen: false,
      taskCreateDefaults: {},
      expandedGroups: state.expandedGroups.includes(input.workstreamId)
        ? state.expandedGroups
        : [...state.expandedGroups, input.workstreamId],
      currentProjectId: state.currentProjectId ?? state.projects[0]?.id ?? null,
      currentView: 'project',
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
    set({
      workstreams: [...state.workstreams, workstream],
      expandedGroups: [...state.expandedGroups, id],
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
    set({
      workstreams: state.workstreams.map((workstream) => workstream.id === id
        ? { ...workstream, label: normalizedLabel }
        : workstream),
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
    set({
      workstreams: state.workstreams.filter((workstream) => workstream.id !== id),
      expandedGroups: state.expandedGroups.filter((group) => group !== id),
    })
    return { ok: true, id }
  },
  
  updateTaskDates: (taskId, startDate, endDate) => set((state) => ({
    tasks: state.tasks.map(task => 
      task.id === taskId 
        ? { ...task, startDate, endDate }
        : task
    )
  })),

  updateTaskDatesBatch: (updates) => set((state) => {
    const updatesByTaskId = new Map(updates.map((update) => [update.taskId, update]))

    return {
      tasks: state.tasks.map((task) => {
        const update = updatesByTaskId.get(task.id)
        return update
          ? { ...task, startDate: update.startDate, endDate: update.endDate }
          : task
      }),
    }
  }),
  
  updateTaskStatus: (taskId, status) => set((state) => ({
    tasks: state.tasks.map(task =>
      task.id === taskId
        ? { ...task, status, progress: status === 'done' ? 100 : task.progress }
        : task
    )
  })),
  
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
