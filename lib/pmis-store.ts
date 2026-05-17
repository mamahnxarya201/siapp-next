'use client'

import { create } from 'zustand'
import { tasks as initialTasks, projects as initialProjects, type Task, type Project, type WorkstreamGroup } from './pmis-data'

const GROUP_ORDER: WorkstreamGroup[] = ['foundation', 'core-platform', 'execution-ui', 'validation', 'release']

export type VisibleRow =
  | { type: 'group-header'; group: WorkstreamGroup; taskCount: number }
  | { type: 'task'; task: Task }

interface PMISState {
  // View state
  currentView: 'dashboard' | 'project'
  currentProjectId: string | null
  
  // Data
  tasks: Task[]
  projects: Project[]
  
  // Selection state
  selectedTaskId: string | null
  hoveredTaskId: string | null
  
  // UI state
  timelineScale: 'day' | 'week' | 'month'
  showAllDependencies: boolean
  showCriticalPath: boolean
  expandedGroups: WorkstreamGroup[]
  inspectorOpen: boolean
  
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
  updateTaskDates: (taskId: string, startDate: Date, endDate: Date) => void
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
  selectedTaskId: null,
  hoveredTaskId: null,
  timelineScale: 'week',
  showAllDependencies: false,
  showCriticalPath: false,
  expandedGroups: ['foundation', 'core-platform', 'execution-ui', 'validation', 'release'],
  inspectorOpen: true,
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
  
  updateTaskDates: (taskId, startDate, endDate) => set((state) => ({
    tasks: state.tasks.map(task => 
      task.id === taskId 
        ? { ...task, startDate, endDate }
        : task
    )
  })),
  
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
    const { tasks, expandedGroups, searchQuery } = get()
    const query = searchQuery.trim().toLowerCase()
    const rows: VisibleRow[] = []

    const allGroups = Array.from(new Set(tasks.map((task) => task.groupName)))
    const orderedGroups = [
      ...GROUP_ORDER.filter((group) => allGroups.includes(group)),
      ...allGroups
        .filter((group) => !GROUP_ORDER.includes(group))
        .sort((a, b) => {
          const aFirst = tasks
            .filter((task) => task.groupName === a)
            .map((task) => task.earliestStart ?? task.plannedStart ?? task.startDate)
            .sort((x, y) => x.getTime() - y.getTime())[0]
          const bFirst = tasks
            .filter((task) => task.groupName === b)
            .map((task) => task.earliestStart ?? task.plannedStart ?? task.startDate)
            .sort((x, y) => x.getTime() - y.getTime())[0]
          return (aFirst?.getTime() ?? 0) - (bFirst?.getTime() ?? 0)
        }),
    ]

    orderedGroups.forEach((group) => {
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

      rows.push({ type: 'group-header', group, taskCount: groupTasks.length })

      if (expandedGroups.includes(group)) {
        groupTasks.forEach((task) => rows.push({ type: 'task', task }))
      }
    })

    return rows
  },
}))
