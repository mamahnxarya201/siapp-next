'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelLeftOpen, PanelRightOpen, ListTodo, Filter, Flag, FolderKanban, SquareCheckBig, GitBranch, ShieldAlert, MessageSquare } from 'lucide-react'
import { usePMISStore } from '@/lib/pmis-store'
import { TaskListPanel } from './task-list-panel'
import { GanttChart } from './gantt-chart'
import { ContextInspector } from './context-inspector'
import { cn } from '@/lib/utils'

const LEFT_RAIL_WIDTH = 52
const RIGHT_RAIL_WIDTH = 52
const LEFT_PANEL_DEFAULT_WIDTH = 300
const LEFT_PANEL_MIN_WIDTH = 240
const RIGHT_PANEL_DEFAULT_WIDTH = 400
const RIGHT_PANEL_MIN_WIDTH = 320
const CENTER_MIN_WIDTH = 640
const HANDLE_HIT_WIDTH = 8

type LeftRailTab = 'tasks' | 'filters' | 'milestones'
type RightRailTab = 'project' | 'task' | 'dependencies' | 'risk' | 'activity'

const LEFT_WIDTH_STORAGE = 'pmis:left-sidebar-width'
const RIGHT_WIDTH_STORAGE = 'pmis:right-sidebar-width'

export function ProjectView() {
  const { currentProjectId, projects, tasks } = usePMISStore()
  const [leftPanelWidth, setLeftPanelWidth] = useState(LEFT_PANEL_DEFAULT_WIDTH)
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_DEFAULT_WIDTH)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [leftTab, setLeftTab] = useState<LeftRailTab>('tasks')
  const [rightTab, setRightTab] = useState<RightRailTab>('project')
  const [isResizing, setIsResizing] = useState(false)
  const [resizingSide, setResizingSide] = useState<'left' | 'right' | null>(null)
  const [viewportWidth, setViewportWidth] = useState(1440)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  const beginResize = useCallback((event: React.MouseEvent<HTMLDivElement>, side: 'left' | 'right') => {
    event.preventDefault()
    resizeStartX.current = event.clientX
    resizeStartWidth.current = side === 'left' ? leftPanelWidth : rightPanelWidth
    setResizingSide(side)
    setIsResizing(true)
  }, [leftPanelWidth, rightPanelWidth])

  const clampSidebarWidths = useCallback((
    nextLeft: number,
    nextRight: number,
    nextLeftCollapsed = leftCollapsed,
    nextRightCollapsed = rightCollapsed
  ) => {
    let left = nextLeftCollapsed ? LEFT_RAIL_WIDTH : Math.max(LEFT_PANEL_MIN_WIDTH, nextLeft)
    let right = nextRightCollapsed ? RIGHT_RAIL_WIDTH : Math.max(RIGHT_PANEL_MIN_WIDTH, nextRight)

    const handles = nextLeftCollapsed && nextRightCollapsed ? 0 : nextLeftCollapsed || nextRightCollapsed ? HANDLE_HIT_WIDTH : HANDLE_HIT_WIDTH * 2
    const maxSideWidth = Math.max(0, viewportWidth - CENTER_MIN_WIDTH - handles)
    if (left + right > maxSideWidth) {
      let overflow = left + right - maxSideWidth
      if (!nextRightCollapsed && right > RIGHT_PANEL_MIN_WIDTH) {
        const reducible = right - RIGHT_PANEL_MIN_WIDTH
        const reduceBy = Math.min(reducible, overflow)
        right -= reduceBy
        overflow -= reduceBy
      }
      if (overflow > 0 && !nextLeftCollapsed && left > LEFT_PANEL_MIN_WIDTH) {
        const reducible = left - LEFT_PANEL_MIN_WIDTH
        left -= Math.min(reducible, overflow)
      }
    }

    return { left, right }
  }, [leftCollapsed, rightCollapsed, viewportWidth])

  useEffect(() => {
    const savedLeft = Number(window.localStorage.getItem(LEFT_WIDTH_STORAGE))
    const savedRight = Number(window.localStorage.getItem(RIGHT_WIDTH_STORAGE))
    if (Number.isFinite(savedLeft) && savedLeft > 0) setLeftPanelWidth(savedLeft)
    if (Number.isFinite(savedRight) && savedRight > 0) setRightPanelWidth(savedRight)
    setViewportWidth(window.innerWidth)
  }, [])

  useEffect(() => {
    const onResize = () => {
      const width = window.innerWidth
      setViewportWidth(width)
      if (width < 980) {
        setLeftCollapsed(true)
        setRightCollapsed(true)
      } else if (width < 1200) {
        setRightCollapsed(true)
      }
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handlePointerMove = (event: MouseEvent) => {
      if (!resizingSide) return
      const delta = event.clientX - resizeStartX.current
      if (resizingSide === 'left') {
        const candidate = resizeStartWidth.current + delta
        const clamped = clampSidebarWidths(candidate, rightPanelWidth)
        setLeftPanelWidth(clamped.left)
        setRightPanelWidth(clamped.right)
      } else {
        const candidate = resizeStartWidth.current - delta
        const clamped = clampSidebarWidths(leftPanelWidth, candidate)
        setLeftPanelWidth(clamped.left)
        setRightPanelWidth(clamped.right)
      }
    }

    const endResize = () => {
      setIsResizing(false)
      setResizingSide(null)
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', endResize)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', endResize)
    }
  }, [clampSidebarWidths, isResizing, leftPanelWidth, resizingSide, rightPanelWidth])

  useEffect(() => {
    window.localStorage.setItem(LEFT_WIDTH_STORAGE, String(leftPanelWidth))
  }, [leftPanelWidth])

  useEffect(() => {
    window.localStorage.setItem(RIGHT_WIDTH_STORAGE, String(rightPanelWidth))
  }, [rightPanelWidth])

  const currentProject = projects.find((project) => project.id === currentProjectId) ?? projects[0]
  const blockedTasks = tasks.filter((task) => task.status === 'blocked').length
  const pendingApprovals = currentProject?.pendingApprovals ?? 0
  const criticalPathTasks = tasks.filter((task) => task.isCriticalPath && task.status !== 'done').length
  const healthScore = currentProject?.healthScore ?? 0
  const progress = currentProject?.progress ?? 0
  const clamped = clampSidebarWidths(leftPanelWidth, rightPanelWidth, leftCollapsed, rightCollapsed)
  const leftWidth = leftCollapsed ? LEFT_RAIL_WIDTH : clamped.left
  const leftContentWidth = leftCollapsed ? 0 : Math.max(0, leftWidth - LEFT_RAIL_WIDTH)
  const rightWidth = rightCollapsed ? RIGHT_RAIL_WIDTH : clamped.right

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div>
          <p className="text-xs text-muted-foreground">Portfolio / {currentProject?.name ?? 'Project'} / Execution Plan</p>
          <h2 className="text-sm font-semibold text-foreground mt-0.5">{currentProject?.name ?? 'Execution Plan'}</h2>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-md bg-secondary/70 px-2 py-1 text-foreground">Health {healthScore}%</span>
          <span className="rounded-md bg-secondary/70 px-2 py-1 text-foreground">Progress {progress}%</span>
          <span className="rounded-md bg-secondary/70 px-2 py-1 text-red-300">{blockedTasks} blocked</span>
          <span className="rounded-md bg-secondary/70 px-2 py-1 text-amber-300">{pendingApprovals} pending approvals</span>
          <span className="rounded-md bg-secondary/70 px-2 py-1 text-blue-300">{criticalPathTasks} critical</span>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
      {/* Left Shell */}
      <div className="flex h-full w-[52px] shrink-0 flex-col items-center gap-2 border-r border-border/40 bg-card py-2">
          <button className={cn('rounded-md p-2', leftTab === 'tasks' && 'bg-accent')} title="Tasks" onClick={() => { setLeftTab('tasks'); setLeftCollapsed(false) }}><ListTodo className="h-4 w-4" /></button>
          <button className={cn('rounded-md p-2', leftTab === 'filters' && 'bg-accent')} title="Filters" onClick={() => { setLeftTab('filters'); setLeftCollapsed(false) }}><Filter className="h-4 w-4" /></button>
          <button className={cn('rounded-md p-2', leftTab === 'milestones' && 'bg-accent')} title="Milestones" onClick={() => { setLeftTab('milestones'); setLeftCollapsed(false) }}><Flag className="h-4 w-4" /></button>
          <button className="mt-auto rounded-md p-2 hover:bg-accent" title={leftCollapsed ? 'Expand' : 'Collapse'} onClick={() => setLeftCollapsed((v) => !v)}>
            <PanelLeftOpen className="h-4 w-4" />
          </button>
      </div>

      <div className="scrollbar-none flex min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        {!leftCollapsed && (
          <div className="min-h-full shrink-0 border-r border-border/40 bg-card" style={{ width: leftContentWidth }}>
            {leftTab === 'tasks' && (
              <TaskListPanel />
            )}
            {leftTab === 'filters' && <div className="h-full overflow-y-auto p-3 text-sm text-muted-foreground">Filters panel</div>}
            {leftTab === 'milestones' && <div className="h-full overflow-y-auto p-3 text-sm text-muted-foreground">Milestones panel</div>}
          </div>
        )}
      {!leftCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize left sidebar"
          className="resize-handle sticky top-0 h-full w-2 shrink-0 cursor-col-resize bg-transparent hover:bg-transparent"
          onMouseDown={(e) => beginResize(e, 'left')}
          onDoubleClick={() => setLeftPanelWidth(LEFT_PANEL_DEFAULT_WIDTH)}
        >
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/45" />
        </div>
      )}

      {/* Center Panel - Gantt Chart */}
      <div className="relative min-w-[640px] flex-1">
        <GanttChart />
      </div>
      </div>

      {!rightCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize right sidebar"
          className="resize-handle relative w-2 cursor-col-resize bg-transparent hover:bg-transparent"
          onMouseDown={(e) => beginResize(e, 'right')}
          onDoubleClick={() => setRightPanelWidth(RIGHT_PANEL_DEFAULT_WIDTH)}
        >
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/45" />
        </div>
      )}

      {/* Right Shell */}
      <div className="flex h-full border-l border-border/40 bg-card" style={{ width: rightWidth }}>
        {!rightCollapsed && (
          <div className="min-w-0 flex-1 overflow-hidden">
            <ContextInspector />
          </div>
        )}
        <div className="flex h-full w-[52px] flex-col items-center gap-2 border-l border-border/40 py-2">
          <button className={cn('rounded-md p-2', rightTab === 'project' && 'bg-accent')} title="Project" onClick={() => { setRightTab('project'); setRightCollapsed(false) }}><FolderKanban className="h-4 w-4" /></button>
          <button className={cn('rounded-md p-2', rightTab === 'task' && 'bg-accent')} title="Task" onClick={() => { rightTab !== 'task' && setRightTab('task'); setRightCollapsed(false) }}><SquareCheckBig className="h-4 w-4" /></button>
          <button className={cn('rounded-md p-2', rightTab === 'dependencies' && 'bg-accent')} title="Dependencies" onClick={() => { setRightTab('dependencies'); setRightCollapsed(false) }}><GitBranch className="h-4 w-4" /></button>
          <button className={cn('rounded-md p-2', rightTab === 'risk' && 'bg-accent')} title="Risk / Approvals" onClick={() => { setRightTab('risk'); setRightCollapsed(false) }}><ShieldAlert className="h-4 w-4" /></button>
          <button className={cn('rounded-md p-2', rightTab === 'activity' && 'bg-accent')} title="Activity" onClick={() => { setRightTab('activity'); setRightCollapsed(false) }}><MessageSquare className="h-4 w-4" /></button>
          <button className="mt-auto rounded-md p-2 hover:bg-accent" title={rightCollapsed ? 'Expand' : 'Collapse'} onClick={() => setRightCollapsed((v) => !v)}>
            <PanelRightOpen className="h-4 w-4" />
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
