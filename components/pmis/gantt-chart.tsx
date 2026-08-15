'use client'

import { forwardRef, useRef, useState, useEffect, useCallback, useMemo, useImperativeHandle } from 'react'
import { ChevronLeft, ChevronRight, GitBranch, AlertTriangle, Settings2, Plus, Milestone, ListTodo, Trash2, Undo2, Redo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { usePMISStore } from '@/lib/pmis-store'
import type { Task } from '@/lib/pmis-data'
import {
  GANTT_TIMELINE_HEADER_HEIGHT,
  GROUP_HEADER_HEIGHT,
  PROJECT_PANEL_TOOLBAR_HEIGHT,
  TASK_ROW_HEIGHT,
} from '@/lib/pmis-layout'
import {
  DEFAULT_GANTT_DISPLAY_SETTINGS,
  GANTT_DISPLAY_SETTINGS_KEY,
  addCalendarDays,
  buildVisibleDates,
  calendarWeekKey,
  isVisibleWeekBoundaryDate,
  normalizeTimelineBoundary,
  normalizeTimelineWeekStart,
  parseGanttDisplaySettings,
  shiftByVisibleUnits,
  startOfCalendarDay,
  visibleUnitsBetween,
  type GanttDisplaySettings,
} from '@/lib/gantt-timeline'

const SCALES = {
  day: { dayWidth: 60, label: 'Day' },
  week: { dayWidth: 32, label: 'Week' },
  month: { dayWidth: 20, label: 'Month' },
}

const HEADER_HEIGHT = GANTT_TIMELINE_HEADER_HEIGHT
const BAR_HEIGHT = 24
const BAR_PADDING = (TASK_ROW_HEIGHT - BAR_HEIGHT) / 2
const DEPENDENCY_ELBOW_GAP = 18
// Adjust this to control the short horizontal line leaving a parent bar.
const DEPENDENCY_PARENT_EXIT_GAP = 4
// A 4px inset aligns the 8px arrowhead's left edge with the child bar.
const DEPENDENCY_TOP_INSET = 4
const DEPENDENCY_TOP_GAP = 3
const INITIAL_FUTURE_DAYS = 90
const INITIAL_PAST_DAYS = 7
const TIMELINE_EXTENSION_DAYS = 180
const TIMELINE_EXTENSION_THRESHOLD_PX = 400
const TIMELINE_SHRINK_DELAY_MS = 260

type GanttInteractionMode = 'move' | 'resize-start' | 'resize-end'

interface TaskDateUpdate {
  taskId: string
  startDate: Date
  endDate: Date
}

interface DragState {
  taskId: string
  task: Task
  mode: GanttInteractionMode
  startClientX: number
  startClientY: number
  initialStartDate: Date
  initialEndDate: Date
  previewY: number
  tasksById: Map<string, Task>
  taskCount: number
  snapIncrement: GanttDisplaySettings['snapIncrement']
  visibleWeekdays: number[]
  dayWidth: number
  timelineMinDate: Date
  showCriticalPath: boolean
  originalElement: SVGGElement | null
  previewPositions: Map<string, { x: number; y: number; width: number }>
  taskElements: Map<string, SVGGElement>
  previewElements: Map<string, SVGGElement>
  pendingClientX: number
  pendingClientY: number
  lastUnitDelta: number
  warnedVerticalMove: boolean
}

interface DragPreviewItem {
  task: Task
  x: number
  y: number
  width: number
}

interface DragPreviewSnapshot {
  items: DragPreviewItem[]
  showCriticalPath: boolean
}

interface DragPreviewHandle {
  show: (preview: DragPreviewSnapshot) => void
  hide: () => void
}

interface GanttCreateContext {
  date: Date
  workstreamId: string
  workstreamLabel: string
  taskId: string | null
}

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

const HALF_DAY_MS = 12 * 60 * 60 * 1000

function calculateDraggedTaskDates(drag: DragState, clientX: number) {
  const snapUnits = drag.snapIncrement === 'half-day' ? 0.5 : 1
  const unitDelta = Math.round((clientX - drag.startClientX) / (drag.dayWidth * snapUnits)) * snapUnits
  const minimumDuration = snapUnits * 24 * 60 * 60 * 1000
  const initialDuration = Math.max(
    minimumDuration,
    drag.initialEndDate.getTime() - drag.initialStartDate.getTime()
  )
  const earliestStart = drag.task.dependencies.reduce<Date | null>((latest, dependencyId) => {
    const dependency = drag.tasksById.get(dependencyId)
    if (!dependency) return latest
    const dependencyEnd = normalizeTimelineBoundary(dependency.endDate)
    return !latest || dependencyEnd.getTime() > latest.getTime()
      ? dependencyEnd
      : latest
  }, null)

  let nextStart = new Date(drag.initialStartDate)
  let nextEnd = new Date(drag.initialEndDate)

  if (drag.mode === 'move') {
    nextStart = shiftByVisibleUnits(drag.initialStartDate, unitDelta, drag.visibleWeekdays)
    if (earliestStart && nextStart.getTime() < earliestStart.getTime()) {
      nextStart = new Date(earliestStart)
    }
    nextEnd = new Date(nextStart.getTime() + initialDuration)
  }

  if (drag.mode === 'resize-start') {
    nextStart = shiftByVisibleUnits(drag.initialStartDate, unitDelta, drag.visibleWeekdays)
    if (nextEnd.getTime() - nextStart.getTime() < minimumDuration) {
      nextStart = new Date(nextEnd.getTime() - minimumDuration)
    }
    if (earliestStart && nextStart.getTime() < earliestStart.getTime()) {
      nextStart = new Date(earliestStart)
    }
  }

  if (drag.mode === 'resize-end') {
    nextEnd = shiftByVisibleUnits(drag.initialEndDate, unitDelta, drag.visibleWeekdays)
    if (nextEnd.getTime() - nextStart.getTime() < minimumDuration) {
      nextEnd = new Date(nextStart.getTime() + minimumDuration)
    }
  }

  return { unitDelta, startDate: nextStart, endDate: nextEnd }
}

function applyForwardSchedulePropagation(
  drag: DragState,
  initialUpdates: TaskDateUpdate[]
) {
  const updatesById = new Map(initialUpdates.map((update) => [update.taskId, update]))
  const queue = initialUpdates.map((update) => update.taskId)
  let safetyCounter = 0
  const maxIterations = Math.max(1, drag.taskCount * drag.taskCount)

  const getTaskDates = (taskId: string) => {
    const update = updatesById.get(taskId)
    if (update) return update

    const task = drag.tasksById.get(taskId)
    return task
      ? { taskId, startDate: task.startDate, endDate: task.endDate }
      : null
  }

  while (queue.length > 0 && safetyCounter < maxIterations) {
    safetyCounter += 1
    const predecessorId = queue.shift()
    if (!predecessorId) continue

    const predecessorTask = drag.tasksById.get(predecessorId)
    if (!predecessorTask) continue

    predecessorTask.dependents.forEach((dependentId) => {
      const dependentTask = drag.tasksById.get(dependentId)
      const dependentDates = getTaskDates(dependentId)
      if (!dependentTask || !dependentDates) return

      const latestPredecessorEnd = dependentTask.dependencies.reduce<Date | null>((latest, dependencyId) => {
        const dependencyDates = getTaskDates(dependencyId)
        if (!dependencyDates) return latest
        return !latest || dependencyDates.endDate.getTime() > latest.getTime()
          ? dependencyDates.endDate
          : latest
      }, null)

      if (!latestPredecessorEnd || latestPredecessorEnd.getTime() <= dependentDates.startDate.getTime()) {
        return
      }

      const dependentDuration = Math.max(
        drag.snapIncrement === 'half-day' ? HALF_DAY_MS : HALF_DAY_MS * 2,
        dependentDates.endDate.getTime() - dependentDates.startDate.getTime()
      )
      const nextStartDate = normalizeTimelineBoundary(latestPredecessorEnd)
      const nextEndDate = new Date(nextStartDate.getTime() + dependentDuration)

      updatesById.set(dependentId, {
        taskId: dependentId,
        startDate: nextStartDate,
        endDate: nextEndDate,
      })
      queue.push(dependentId)
    })
  }

  return Array.from(updatesById.values())
}

const DragPreviewLayer = forwardRef<DragPreviewHandle>(function DragPreviewLayer(_, ref) {
  const [preview, setPreview] = useState<DragPreviewSnapshot | null>(null)

  useImperativeHandle(ref, () => ({
    show: setPreview,
    hide: () => setPreview(null),
  }), [])

  if (!preview) return null

  return (
    <g data-testid="gantt-drag-preview" className="pointer-events-none">
      {preview.items.map(({ task, x, y, width }) => {
        const isCritical = preview.showCriticalPath && task.isCriticalPath
        const barColor = isCritical
          ? 'fill-destructive'
          : task.status === 'done'
            ? 'fill-success'
            : task.status === 'blocked'
              ? 'fill-destructive'
              : task.status === 'in-progress'
                ? 'fill-info'
                : 'fill-muted-foreground/40'
        const labelColor = isCritical || task.status !== 'todo' ? 'fill-background' : 'fill-foreground'
        const progressWidth = (width * task.progress) / 100

        return (
          <g key={task.id}>
            <rect
              x={x - 2}
              y={y - 2}
              width={width + 4}
              height={BAR_HEIGHT + 4}
              rx={6}
              className="fill-primary/25"
            />
            <rect x={x} y={y} width={width} height={BAR_HEIGHT} rx={4} className={cn('gantt-bar', barColor)} />
            {task.progress > 0 && task.progress < 100 && (
              <rect
                x={x}
                y={y + BAR_HEIGHT - 3}
                width={progressWidth}
                height={3}
                rx={1.5}
                className="fill-background/65"
              />
            )}
            {width > 80 && (
              <text
                x={x + 8}
                y={y + BAR_HEIGHT / 2 + 4}
                className={cn('text-[11px] font-semibold', labelColor)}
              >
                {task.name.length > Math.floor(width / 8)
                  ? `${task.name.slice(0, Math.floor(width / 8))}...`
                  : task.name}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
})

interface DependencyLineProps {
  fromTask: Task
  toTask: Task
  taskPositions: Map<string, { x: number; y: number; width: number }>
  isCritical: boolean
  opacity?: number
}

function DependencyLine({ fromTask, toTask, taskPositions, isCritical, opacity = 1 }: DependencyLineProps) {
  const fromPos = taskPositions.get(fromTask.id)
  const toPos = taskPositions.get(toTask.id)

  if (!fromPos || !toPos) return null

  const fromX = fromPos.x + fromPos.width
  const fromY = fromPos.y + BAR_HEIGHT / 2
  const toX = toPos.x
  const toY = toPos.y + BAR_HEIGHT / 2

  const horizontalClearance = toX - fromX
  const canEnterFromLeft = horizontalClearance >= DEPENDENCY_ELBOW_GAP * 2

  // A short final horizontal run makes the SVG marker look as though it points
  // backwards. In cramped cases, approach the child vertically and place the
  // arrow just above its upper-left edge instead.
  const path = canEnterFromLeft
    ? (() => {
        const midX = Math.max(
          fromX + DEPENDENCY_ELBOW_GAP,
          Math.min(toX - DEPENDENCY_ELBOW_GAP, (fromX + toX) / 2)
        )
        return `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`
      })()
    : (() => {
        const routeX = fromX + DEPENDENCY_PARENT_EXIT_GAP
        const entryX = toX + DEPENDENCY_TOP_INSET
        const approachY = toPos.y - DEPENDENCY_ELBOW_GAP
        const endY = toPos.y - DEPENDENCY_TOP_GAP
        return `M ${fromX} ${fromY} H ${routeX} V ${approachY} H ${entryX} V ${endY}`
      })()

  return (
    <g style={{ opacity }}>
      <path
        d={path}
        fill="none"
        strokeWidth={isCritical ? 2 : 1.5}
        style={{
          strokeDasharray: 'none',
          strokeDashoffset: 0,
        }}
        className={cn(
          'dependency-line',
          isCritical ? 'stroke-destructive' : 'stroke-primary'
        )}
        markerEnd={`url(#arrow-${isCritical ? 'critical' : 'normal'})`}
      />
    </g>
  )
}

function GanttBar({
  task,
  x,
  y,
  width,
  isSelected,
  isHovered,
  isCriticalPath,
  showCritical,
  onSelect,
  onHover,
  onInteractionStart,
}: {
  task: Task
  x: number
  y: number
  width: number
  isSelected: boolean
  isHovered: boolean
  isCriticalPath: boolean
  showCritical: boolean
  onSelect: () => void
  onHover: (hover: boolean) => void
  onInteractionStart: (mode: GanttInteractionMode, e: React.MouseEvent) => void
}) {
  const barColor = useMemo(() => {
    if (showCritical && isCriticalPath) return 'fill-destructive'
    if (task.status === 'done') return 'fill-success'
    if (task.status === 'blocked') return 'fill-destructive'
    if (task.status === 'in-progress') return 'fill-info'
    return 'fill-muted-foreground/40'
  }, [task.status, isCriticalPath, showCritical])

  const labelColor = useMemo(() => {
    const hasColoredBar = (showCritical && isCriticalPath) || task.status !== 'todo'
    return hasColoredBar ? 'fill-background' : 'fill-foreground'
  }, [task.status, isCriticalPath, showCritical])

  const progressWidth = (width * task.progress) / 100

  return (
    <g
      data-task-id={task.id}
      className="cursor-grab active:cursor-grabbing"
      onClick={onSelect}
      onMouseDown={(e) => onInteractionStart('move', e)}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Selection highlight */}
      {(isSelected || isHovered) && (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={BAR_HEIGHT + 4}
          rx={6}
          className="fill-primary/20"
        />
      )}

      {/* Background bar */}
      <rect
        x={x}
        y={y}
        width={width}
        height={BAR_HEIGHT}
        rx={4}
        className={cn('gantt-bar', barColor)}
        style={{ filter: isHovered ? 'brightness(1.15)' : undefined }}
      />

      {/* Slim progress indicator; keeping it short avoids obscuring the label. */}
      {task.progress > 0 && task.progress < 100 && (
        <rect
          x={x}
          y={y + BAR_HEIGHT - 3}
          width={progressWidth}
          height={3}
          rx={1.5}
          className="fill-background/65 pointer-events-none"
        />
      )}

      {/* Task name (if bar is wide enough) */}
      {width > 80 && (
        <text
          x={x + 8}
          y={y + BAR_HEIGHT / 2 + 4}
          className={cn(
            'pointer-events-none text-[11px] font-semibold',
            labelColor
          )}
        >
          {task.name.length > Math.floor(width / 8)
            ? task.name.slice(0, Math.floor(width / 8)) + '...'
            : task.name}
        </text>
      )}

      {/* Milestone diamond */}
      {task.isMilestone && (
        <polygon
          points={`${x + width + 8},${y + BAR_HEIGHT / 2} ${x + width + 14},${y + BAR_HEIGHT / 2 - 6} ${x + width + 20},${y + BAR_HEIGHT / 2} ${x + width + 14},${y + BAR_HEIGHT / 2 + 6}`}
          className="fill-milestone"
        />
      )}

      {/* Resize handles */}
      {isSelected && (
        <>
          <rect
            x={x}
            y={y}
            width={12}
            height={BAR_HEIGHT}
            className="fill-transparent cursor-ew-resize"
            onMouseDown={(e) => onInteractionStart('resize-start', e)}
          />
          <rect
            x={x + width - 12}
            y={y}
            width={12}
            height={BAR_HEIGHT}
            className="fill-transparent cursor-ew-resize"
            onMouseDown={(e) => onInteractionStart('resize-end', e)}
          />
        </>
      )}
    </g>
  )
}

export function GanttChart({
  scrollRef,
  onVerticalScroll,
  onHorizontalScrollbarHeightChange,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
  onVerticalScroll: (next: number) => void
  onHorizontalScrollbarHeightChange: (height: number) => void
}) {
  const containerRef = scrollRef
  const dragStateRef = useRef<DragState | null>(null)
  const dragPreviewRef = useRef<DragPreviewHandle | null>(null)
  const dragAnimationFrameRef = useRef<number | null>(null)
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shrinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastScrollLeftRef = useRef(0)
  const rightGrowthLatchRef = useRef(false)
  const rangeInitializedRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragNotice, setDragNotice] = useState<string | null>(null)
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [displaySettings, setDisplaySettings] = useState<GanttDisplaySettings>(DEFAULT_GANTT_DISPLAY_SETTINGS)
  const [settingsHydrated, setSettingsHydrated] = useState(false)
  const [createContext, setCreateContext] = useState<GanttCreateContext | null>(null)

  const {
    tasks,
    projects,
    currentProjectId,
    selectedTaskId,
    hoveredTaskId,
    timelineScale,
    showAllDependencies,
    showCriticalPath,
    setTimelineScale,
    toggleAllDependencies,
    toggleCriticalPath,
    selectTask,
    hoverTask,
    updateTaskDatesBatch,
    beginHistoryTransaction,
    commitHistoryTransaction,
    getTaskDependencies,
    getTaskDependents,
    getUpstreamChain,
    getDownstreamChain,
    getVisibleRows,
    workstreams,
    openTaskCreate,
    openTaskDelete,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePMISStore()

  const scale = SCALES[timelineScale]
  const currentProject = projects.find((project) => project.id === currentProjectId)
  const projectTimelineSettingsKey = currentProjectId
    ? `${GANTT_DISPLAY_SETTINGS_KEY}:${currentProjectId}`
    : GANTT_DISPLAY_SETTINGS_KEY

  const taskExtent = useMemo(() => {
    if (tasks.length === 0) {
      const today = startOfCalendarDay(new Date())
      return { minDate: today, maxDate: today }
    }
    const allDates = tasks.flatMap((task) => [task.startDate, task.endDate])
    return {
      minDate: startOfCalendarDay(new Date(Math.min(...allDates.map((date) => date.getTime())))),
      maxDate: startOfCalendarDay(new Date(Math.max(...allDates.map((date) => date.getTime())))),
    }
  }, [tasks])

  useEffect(() => {
    setDisplaySettings(parseGanttDisplaySettings(window.localStorage.getItem(projectTimelineSettingsKey)))
    setSettingsHydrated(true)
  }, [projectTimelineSettingsKey])

  useEffect(() => {
    if (!settingsHydrated) return
    window.localStorage.setItem(projectTimelineSettingsKey, JSON.stringify(displaySettings))
  }, [displaySettings, projectTimelineSettingsKey, settingsHydrated])

  useEffect(() => {
    const minimumStart = addCalendarDays(taskExtent.minDate, -INITIAL_PAST_DAYS)
    const minimumEnd = addCalendarDays(taskExtent.maxDate, INITIAL_FUTURE_DAYS)

    if (!rangeInitializedRef.current) {
      rangeInitializedRef.current = true
      setRangeStart(minimumStart)
      setRangeEnd(minimumEnd)
      return
    }

    setRangeStart((current) => current && current <= minimumStart ? current : minimumStart)
    setRangeEnd((current) => current && current >= minimumEnd ? current : minimumEnd)
  }, [taskExtent.minDate, taskExtent.maxDate])

  const toggleVisibleWeekday = useCallback((weekday: number) => {
    setDisplaySettings((current) => {
      const isVisible = current.visibleWeekdays.includes(weekday)
      if (isVisible && current.visibleWeekdays.length === 1) return current
      return {
        ...current,
        visibleWeekdays: isVisible
          ? current.visibleWeekdays.filter((day) => day !== weekday)
          : [...current.visibleWeekdays, weekday].sort((a, b) => a - b),
      }
    })
  }, [])

  // Calculate the compressed calendar axis from the stable absolute range.
  const timelineData = useMemo(() => {
    const minDate = rangeStart ?? addCalendarDays(taskExtent.minDate, -INITIAL_PAST_DAYS)
    const maxDate = rangeEnd ?? addCalendarDays(taskExtent.maxDate, INITIAL_FUTURE_DAYS)

    const visibleDates = buildVisibleDates(minDate, maxDate, displaySettings.visibleWeekdays)
    const totalWidth = visibleDates.length * scale.dayWidth
    const monthSegments = visibleDates.reduce<{ key: string; label: string; x: number; width: number }[]>((segments, date, index) => {
      const key = `${date.getFullYear()}-${date.getMonth()}`
      const previous = segments[segments.length - 1]
      if (previous?.key === key) {
        previous.width += scale.dayWidth
      } else {
        segments.push({
          key,
          label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          x: index * scale.dayWidth,
          width: scale.dayWidth,
        })
      }
      return segments
    }, [])

    const weekSeparators = visibleDates
      .filter((date) => isVisibleWeekBoundaryDate(date, displaySettings.visibleWeekdays, displaySettings.weekStart))
      .map((date) => ({ date, x: visibleDates.findIndex((candidate) => candidate.getTime() === date.getTime()) * scale.dayWidth }))

    // Today marker
    const today = startOfCalendarDay(new Date())
    const todayX = visibleUnitsBetween(minDate, today, displaySettings.visibleWeekdays) * scale.dayWidth
    const todayVisible = displaySettings.visibleWeekdays.includes(today.getDay())

    return { minDate, maxDate, totalWidth, visibleDates, monthSegments, weekSeparators, todayX, todayVisible }
  }, [rangeStart, rangeEnd, taskExtent, scale.dayWidth, displaySettings.visibleWeekdays, displaySettings.weekStart])

  useEffect(() => {
    if (!viewportSize.width || timelineData.totalWidth >= viewportSize.width + scale.dayWidth * 8) return
    setRangeEnd((current) => current ? addCalendarDays(current, TIMELINE_EXTENSION_DAYS) : current)
  }, [scale.dayWidth, timelineData.totalWidth, viewportSize.width])

  const visibleRows = getVisibleRows()
  const visibleTasks = useMemo(
    () => visibleRows.filter((row) => row.type === 'task').map((row) => row.task),
    [visibleRows]
  )
  const visibleTaskIds = useMemo(() => new Set(visibleTasks.map((task) => task.id)), [visibleTasks])
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])

  const prepareCreateContext = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const containerBounds = event.currentTarget.getBoundingClientRect()
    if (event.clientY - containerBounds.top < HEADER_HEIGHT) {
      setCreateContext(null)
      return
    }

    const svg = event.currentTarget.querySelector<SVGSVGElement>('[data-testid="gantt-timeline"]')
    if (!svg) {
      setCreateContext(null)
      return
    }

    const bounds = svg.getBoundingClientRect()
    const timelineX = event.clientX - bounds.left
    const timelineY = event.clientY - bounds.top
    const dateIndex = Math.floor(timelineX / scale.dayWidth)
    const date = timelineData.visibleDates[dateIndex]

    if (!date || timelineY < HEADER_HEIGHT) {
      setCreateContext(null)
      return
    }

    let rowOffset = HEADER_HEIGHT
    const row = visibleRows.find((candidate) => {
      const height = candidate.type === 'group-header' ? GROUP_HEADER_HEIGHT : TASK_ROW_HEIGHT
      const containsPoint = timelineY >= rowOffset && timelineY < rowOffset + height
      rowOffset += height
      return containsPoint
    })

    if (!row) {
      setCreateContext(null)
      return
    }

    const workstreamId = row.type === 'group-header' ? row.group : row.task.groupName
    const workstreamLabel = workstreams.find((workstream) => workstream.id === workstreamId)?.label ?? workstreamId
    const taskElement = (event.target as Element).closest<SVGGElement>('[data-task-id]')

    setCreateContext({
      date: new Date(date),
      workstreamId,
      workstreamLabel,
      taskId: taskElement?.dataset.taskId ?? null,
    })
  }, [scale.dayWidth, timelineData.visibleDates, visibleRows, workstreams])

  // Calculate task positions
  const taskPositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; width: number }>()

    let yOffset = 0

    visibleRows.forEach((row) => {
      if (row.type === 'group-header') {
        yOffset += GROUP_HEADER_HEIGHT
        return
      }

      const task = row.task
      const startOffset = visibleUnitsBetween(timelineData.minDate, task.startDate, displaySettings.visibleWeekdays)
      const duration = visibleUnitsBetween(task.startDate, task.endDate, displaySettings.visibleWeekdays)

      if (duration <= 0) {
        yOffset += TASK_ROW_HEIGHT
        return
      }

      positions.set(task.id, {
        x: startOffset * scale.dayWidth,
        y: yOffset + BAR_PADDING,
        width: Math.max(duration * scale.dayWidth, scale.dayWidth / 2)
      })
      yOffset += TASK_ROW_HEIGHT
    })

    return positions
  }, [visibleRows, timelineData.minDate, scale.dayWidth, displaySettings.visibleWeekdays])

  const connectorTaskPositions = useMemo(
    () => new Map(
      Array.from(taskPositions.entries()).map(([id, position]) => [
        id,
        { ...position, y: position.y + HEADER_HEIGHT },
      ])
    ),
    [taskPositions]
  )

  // Get visible dependency lines
  const visibleDependencies = useMemo(() => {
    const deps: { from: Task; to: Task; isCritical: boolean }[] = []

    if (showAllDependencies) {
      // Show all
      tasks.forEach(task => {
        task.dependencies.forEach(depId => {
          const depTask = tasks.find(t => t.id === depId)
          if (depTask && visibleTaskIds.has(depTask.id)) {
            deps.push({
              from: depTask,
              to: task,
              isCritical: task.isCriticalPath && depTask.isCriticalPath
            })
          }
        })
      })
    } else if (selectedTaskId) {
      // Show full upstream/downstream chain for selected task
      const selectedTask = tasks.find(t => t.id === selectedTaskId)
      if (selectedTask) {
        const upstream = getUpstreamChain(selectedTaskId)
        const downstream = getDownstreamChain(selectedTaskId)
        const relevantTasks = new Set([selectedTaskId, ...upstream.map(t => t.id), ...downstream.map(t => t.id)])

        tasks.forEach(task => {
          if (relevantTasks.has(task.id)) {
            task.dependencies.forEach(depId => {
              if (relevantTasks.has(depId)) {
                const depTask = tasks.find(t => t.id === depId)
                if (depTask && visibleTaskIds.has(depTask.id)) {
                  deps.push({
                    from: depTask,
                    to: task,
                    isCritical: showCriticalPath && task.isCriticalPath && depTask.isCriticalPath
                  })
                }
              }
            })
          }
        })
      }
    } else if (hoveredTaskId) {
      // Show only direct dependencies for hovered task
      const hoveredTask = tasks.find(t => t.id === hoveredTaskId)
      if (hoveredTask) {
        // Upstream (tasks this depends on)
        hoveredTask.dependencies.forEach(depId => {
          const depTask = tasks.find(t => t.id === depId)
          if (depTask && visibleTaskIds.has(depTask.id)) {
            deps.push({
              from: depTask,
              to: hoveredTask,
              isCritical: showCriticalPath && hoveredTask.isCriticalPath && depTask.isCriticalPath
            })
          }
        })
        // Downstream (tasks that depend on this)
        hoveredTask.dependents.forEach(depId => {
          const depTask = tasks.find(t => t.id === depId)
          if (depTask && visibleTaskIds.has(depTask.id)) {
            deps.push({
              from: hoveredTask,
              to: depTask,
              isCritical: showCriticalPath && hoveredTask.isCriticalPath && depTask.isCriticalPath
            })
          }
        })
      }
    } else if (showCriticalPath) {
      // Show only critical path
      const criticalTasks = tasks.filter(t => t.isCriticalPath)
      criticalTasks.forEach(task => {
        task.dependencies.forEach(depId => {
          const depTask = tasks.find(t => t.id === depId && t.isCriticalPath)
          if (depTask && visibleTaskIds.has(depTask.id)) {
            deps.push({ from: depTask, to: task, isCritical: true })
          }
        })
      })
    }

    return deps
  }, [tasks, selectedTaskId, hoveredTaskId, showAllDependencies, showCriticalPath, getUpstreamChain, getDownstreamChain, visibleTaskIds])

  const rowsHeight = useMemo(
    () =>
      visibleRows.reduce(
        (sum, row) => sum + (row.type === 'group-header' ? GROUP_HEADER_HEIGHT : TASK_ROW_HEIGHT),
        0
      ),
    [visibleRows]
  )
  const totalHeight = rowsHeight + HEADER_HEIGHT
  const renderHeight = Math.max(totalHeight, viewportSize.height || totalHeight)

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget
    const previousScrollLeft = lastScrollLeftRef.current
    const horizontalDelta = element.scrollLeft - previousScrollLeft
    onVerticalScroll(element.scrollTop)
    lastScrollLeftRef.current = element.scrollLeft

    // Grow only after horizontal movement reaches the future edge. A latch keeps
    // vertical scrolling and repeated edge events from appending endlessly.
    if (horizontalDelta > 0) {
      const rightRemaining = element.scrollWidth - element.clientWidth - element.scrollLeft
      if (rightRemaining < TIMELINE_EXTENSION_THRESHOLD_PX && !rightGrowthLatchRef.current) {
        rightGrowthLatchRef.current = true
        setRangeEnd((current) => current ? addCalendarDays(current, TIMELINE_EXTENSION_DAYS) : current)
      }
      if (rightRemaining > TIMELINE_EXTENSION_THRESHOLD_PX * 2) {
        rightGrowthLatchRef.current = false
      }
    } else if (horizontalDelta < 0) {
      const rightRemaining = element.scrollWidth - element.clientWidth - element.scrollLeft
      if (rightRemaining > TIMELINE_EXTENSION_THRESHOLD_PX * 2) {
        rightGrowthLatchRef.current = false
      }
    }

    // Once the user returns to the left edge and stops, remove unused future
    // horizon while retaining the task range plus the initial planning buffer.
    if (horizontalDelta !== 0 && element.scrollLeft < TIMELINE_EXTENSION_THRESHOLD_PX) {
      if (shrinkTimeoutRef.current) clearTimeout(shrinkTimeoutRef.current)
      shrinkTimeoutRef.current = setTimeout(() => {
        const currentElement = containerRef.current
        if (!currentElement || currentElement.scrollLeft >= TIMELINE_EXTENSION_THRESHOLD_PX || isDragging) return
        const safeEnd = addCalendarDays(taskExtent.maxDate, INITIAL_FUTURE_DAYS)
        setRangeEnd((current) => current && current > safeEnd ? safeEnd : current)
      }, TIMELINE_SHRINK_DELAY_MS)
    }
  }, [isDragging, onVerticalScroll, taskExtent.maxDate])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const reportScrollbarHeight = () => {
      onHorizontalScrollbarHeightChange(Math.max(0, element.offsetHeight - element.clientHeight))
      setViewportSize({ width: element.clientWidth, height: element.clientHeight })
    }
    reportScrollbarHeight()
    const observer = new ResizeObserver(reportScrollbarHeight)
    observer.observe(element)
    return () => observer.disconnect()
  }, [onHorizontalScrollbarHeightChange, timelineData.totalWidth])

  const scrollTimeline = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  const showVerticalMoveNotice = useCallback(() => {
    setDragNotice('Bars only move horizontally by date. Move tasks between groups from the task details/workstream controls.')
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current)
    noticeTimeoutRef.current = setTimeout(() => setDragNotice(null), 3200)
  }, [])

  const interactionActionsRef = useRef({
    selectTask,
    beginHistoryTransaction,
    updateTaskDatesBatch,
    commitHistoryTransaction,
    showVerticalMoveNotice,
  })
  interactionActionsRef.current = {
    selectTask,
    beginHistoryTransaction,
    updateTaskDatesBatch,
    commitHistoryTransaction,
    showVerticalMoveNotice,
  }

  const beginBarInteraction = useCallback((task: Task, mode: GanttInteractionMode, event: React.MouseEvent) => {
    if (event.button !== 0) return
    const position = taskPositions.get(task.id)
    if (!position) return

    event.preventDefault()
    event.stopPropagation()

    const originalElement = (event.currentTarget as Element).closest<SVGGElement>('[data-task-id]')
    if (originalElement) originalElement.style.opacity = '0.2'
    const taskElements = new Map<string, SVGGElement>()
    containerRef.current?.querySelectorAll<SVGGElement>('[data-task-id]').forEach((element) => {
      const taskId = element.dataset.taskId
      if (taskId) taskElements.set(taskId, element)
    })
    if (originalElement) taskElements.set(task.id, originalElement)

    dragStateRef.current = {
      taskId: task.id,
      task,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initialStartDate: normalizeTimelineBoundary(task.startDate),
      initialEndDate: normalizeTimelineBoundary(task.endDate),
      previewY: HEADER_HEIGHT + position.y,
      tasksById,
      taskCount: tasks.length,
      snapIncrement: displaySettings.snapIncrement,
      visibleWeekdays: displaySettings.visibleWeekdays,
      dayWidth: scale.dayWidth,
      timelineMinDate: timelineData.minDate,
      showCriticalPath,
      originalElement,
      previewPositions: taskPositions,
      taskElements,
      previewElements: originalElement ? new Map([[task.id, originalElement]]) : new Map(),
      pendingClientX: event.clientX,
      pendingClientY: event.clientY,
      lastUnitDelta: 0,
      warnedVerticalMove: false,
    }
    dragPreviewRef.current?.show({
      items: [{
        task,
        x: position.x,
        y: HEADER_HEIGHT + position.y,
        width: position.width,
      }],
      showCriticalPath,
    })
    setIsDragging(true)
  }, [
    displaySettings.snapIncrement,
    displaySettings.visibleWeekdays,
    scale.dayWidth,
    showCriticalPath,
    taskPositions,
    tasks,
    tasksById,
    timelineData.minDate,
  ])

  useEffect(() => {
    const renderDragPreview = (drag: DragState, clientX: number) => {
      const result = calculateDraggedTaskDates(drag, clientX)
      if (result.unitDelta === drag.lastUnitDelta) return
      drag.lastUnitDelta = result.unitDelta

      const updates = applyForwardSchedulePropagation(drag, [{
        taskId: drag.taskId,
        startDate: result.startDate,
        endDate: result.endDate,
      }])
      const nextPreviewIds = new Set(updates.map((update) => update.taskId))

      for (const [taskId, element] of drag.previewElements) {
        if (!nextPreviewIds.has(taskId)) {
          element.style.opacity = ''
          drag.previewElements.delete(taskId)
        }
      }

      const items = updates.flatMap((update) => {
        const task = drag.tasksById.get(update.taskId)
        const position = drag.previewPositions.get(update.taskId)
        if (!task || !position) return []

        const element = drag.taskElements.get(update.taskId)
        if (element && !drag.previewElements.has(update.taskId)) {
          element.style.opacity = '0.2'
          drag.previewElements.set(update.taskId, element)
        }

        const startOffset = visibleUnitsBetween(
          drag.timelineMinDate,
          update.startDate,
          drag.visibleWeekdays
        )
        const duration = visibleUnitsBetween(
          update.startDate,
          update.endDate,
          drag.visibleWeekdays
        )

        return [{
          task,
          x: startOffset * drag.dayWidth,
          y: HEADER_HEIGHT + position.y,
          width: Math.max(duration * drag.dayWidth, drag.dayWidth / 2),
        }]
      })

      dragPreviewRef.current?.show({
        items,
        showCriticalPath: drag.showCriticalPath,
      })
    }

    const cancelPendingFrame = () => {
      if (dragAnimationFrameRef.current === null) return
      window.cancelAnimationFrame(dragAnimationFrameRef.current)
      dragAnimationFrameRef.current = null
    }

    const clearDragVisuals = (drag: DragState) => {
      for (const element of drag.previewElements.values()) {
        element.style.opacity = ''
      }
      drag.previewElements.clear()
      dragPreviewRef.current?.hide()
      dragStateRef.current = null
      setIsDragging(false)
    }

    const handlePointerMove = (event: MouseEvent) => {
      const drag = dragStateRef.current
      if (!drag) return

      drag.pendingClientX = event.clientX
      drag.pendingClientY = event.clientY

      const deltaY = Math.abs(drag.pendingClientY - drag.startClientY)
      if (deltaY > TASK_ROW_HEIGHT && !drag.warnedVerticalMove) {
        drag.warnedVerticalMove = true
        interactionActionsRef.current.showVerticalMoveNotice()
      }

      if (dragAnimationFrameRef.current !== null) return
      dragAnimationFrameRef.current = window.requestAnimationFrame(() => {
        dragAnimationFrameRef.current = null
        const latestDrag = dragStateRef.current
        if (latestDrag) renderDragPreview(latestDrag, latestDrag.pendingClientX)
      })
    }

    const handlePointerUp = (event: MouseEvent) => {
      const drag = dragStateRef.current
      if (!drag) return

      cancelPendingFrame()
      const result = calculateDraggedTaskDates(drag, event.clientX)
      const datesChanged = result.startDate.getTime() !== drag.initialStartDate.getTime()
        || result.endDate.getTime() !== drag.initialEndDate.getTime()

      clearDragVisuals(drag)

      const actions = interactionActionsRef.current
      actions.selectTask(drag.taskId)
      if (!datesChanged) return

      const updates = applyForwardSchedulePropagation(drag, [{
        taskId: drag.taskId,
        startDate: result.startDate,
        endDate: result.endDate,
      }])

      actions.beginHistoryTransaction()
      actions.updateTaskDatesBatch(updates)
      actions.commitHistoryTransaction()
    }

    const handleWindowBlur = () => {
      const drag = dragStateRef.current
      if (!drag) return
      cancelPendingFrame()
      clearDragVisuals(drag)
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      cancelPendingFrame()
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current)
      if (shrinkTimeoutRef.current) clearTimeout(shrinkTimeoutRef.current)
    }
  }, [])

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4"
        style={{ height: PROJECT_PANEL_TOOLBAR_HEIGHT }}
      >
        <div className="flex items-center gap-2">
          {/* Scale selector */}
          <div className="flex items-center rounded-lg border border-border bg-secondary p-0.5">
            {(['day', 'week', 'month'] as const).map((s) => (
              <Button
                key={s}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-3 text-xs capitalize',
                  timelineScale === s && 'bg-card shadow-sm'
                )}
                onClick={() => setTimelineScale(s)}
              >
                {s}
              </Button>
            ))}
          </div>

          {/* Workspace history */}
          <div className="flex items-center gap-1 border-l border-border pl-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={!canUndo} aria-label="Undo last workspace change" title="Undo">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={!canRedo} aria-label="Redo last workspace change" title="Redo">
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

        </div>

        <div className="flex items-center gap-2">
          {/* Toggle all dependencies */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={showAllDependencies}
                  onPressedChange={toggleAllDependencies}
                  className="h-8 gap-1.5 px-3 data-[state=on]:bg-primary/20"
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  <span className="text-xs">All Deps</span>
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>Show all dependency lines</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Timeline scroll controls */}
          <div className="flex items-center gap-1 border-l border-border pl-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scrollTimeline('left')} aria-label="Scroll timeline left" title="Scroll timeline left">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scrollTimeline('right')} aria-label="Scroll timeline right" title="Scroll timeline right">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Toggle critical path */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={showCriticalPath}
                  onPressedChange={toggleCriticalPath}
                  className="h-8 gap-1.5 px-3 data-[state=on]:bg-destructive/15 data-[state=on]:text-destructive"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs">Critical Path</span>
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>Highlight critical path</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5"
                aria-label="Project timeline settings"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="text-xs">Timeline Settings</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[min(680px,calc(100vh-2rem))] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Timeline Settings</DialogTitle>
                <DialogDescription>
                  These display preferences apply only to {currentProject?.name ?? 'this project'} and do not change stored task dates.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 text-sm">
                <section className="space-y-3">
                  <div>
                    <h3 className="font-medium">Grid and separators</h3>
                    <p className="text-xs text-muted-foreground">Use lighter daily lines and stronger week boundaries to read the calendar.</p>
                  </div>
                  {[
                    ['showGrid', 'Show grid lines', 'Draw daily vertical lines through the chart.'],
                    ['showWeekSeparators', 'Show week separators', 'Emphasize the start of each calendar week.'],
                    ['showGroupGrid', 'Show grid through group rows', 'Keep grid lines visible across group header bands.'],
                  ].map(([key, label, description]) => (
                    <label key={key} className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 p-3 hover:bg-accent/30">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-primary"
                        checked={displaySettings[key as 'showGrid' | 'showWeekSeparators' | 'showGroupGrid']}
                        onChange={(event) => setDisplaySettings((current) => ({ ...current, [key]: event.target.checked }))}
                      />
                      <span>
                        <span className="block font-medium">{label}</span>
                        <span className="block text-xs text-muted-foreground">{description}</span>
                      </span>
                    </label>
                  ))}
                </section>

                <section className="space-y-3">
                  <div>
                    <h3 className="font-medium">Calendar</h3>
                    <p className="text-xs text-muted-foreground">Hidden weekdays are compressed visually; task dates stay unchanged.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {WEEKDAY_OPTIONS.map((weekday) => (
                      <label key={weekday.value} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={displaySettings.visibleWeekdays.includes(weekday.value)}
                          disabled={displaySettings.visibleWeekdays.length === 1 && displaySettings.visibleWeekdays.includes(weekday.value)}
                          onChange={() => toggleVisibleWeekday(weekday.value)}
                        />
                        <span>{weekday.label}</span>
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                    <span>
                      <span className="block font-medium">Week starts on</span>
                      <span className="block text-xs text-muted-foreground">Used for separator placement.</span>
                    </span>
                    <select
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      value={String(displaySettings.weekStart)}
                      onChange={(event) => setDisplaySettings((current) => ({
                        ...current,
                        weekStart: normalizeTimelineWeekStart(Number(event.target.value)),
                      }))}
                    >
                      <option value="1">Monday</option>
                      <option value="0">Sunday</option>
                    </select>
                  </label>
                </section>

                <section className="space-y-3">
                  <div>
                    <h3 className="font-medium">Bar snapping</h3>
                    <p className="text-xs text-muted-foreground">Choose the smallest movement when dragging or resizing a task.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['day', 'half-day'] as const).map((increment) => (
                      <label key={increment} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2">
                        <input
                          type="radio"
                          name="timeline-snap-increment"
                          className="h-4 w-4 accent-primary"
                          checked={displaySettings.snapIncrement === increment}
                          onChange={() => setDisplaySettings((current) => ({ ...current, snapIncrement: increment }))}
                        />
                        <span>{increment === 'day' ? 'One day' : 'Half day'}</span>
                      </label>
                    ))}
                  </div>
                </section>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDisplaySettings(DEFAULT_GANTT_DISPLAY_SETTINGS)}>
                  Reset defaults
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Chart */}
      <div className="relative flex-1 overflow-hidden">
        {dragNotice && (
          <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md border border-warning/30 bg-card/95 px-3 py-2 text-xs text-warning shadow-lg backdrop-blur">
            {dragNotice}
          </div>
        )}
        {tasks.length === 0 ? (
          <Empty className="h-full gap-4 rounded-none border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon"><ListTodo /></EmptyMedia>
              <EmptyTitle>No schedule yet</EmptyTitle>
              <EmptyDescription>
                PMIS Platform v1.0 starts as a clean project. Create its first task to begin the plan.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={() => openTaskCreate()}>
                <Plus className="h-4 w-4" />
                Create first task
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={containerRef}
              data-testid="gantt-scroll"
              className={cn('pmis-hidden-vertical-scrollbar h-full overflow-auto', isDragging && 'cursor-ew-resize')}
              onScroll={handleScroll}
              onContextMenu={prepareCreateContext}
            >
            <div
              className="relative"
              style={{ width: timelineData.totalWidth, height: renderHeight }}
            >
              <div
                data-testid="timeline-sticky-header"
                className="sticky top-0 z-20 bg-card"
                style={{ width: timelineData.totalWidth, height: HEADER_HEIGHT }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
              >
                <svg width={timelineData.totalWidth} height={HEADER_HEIGHT} className="block select-none">
                  <rect x={0} y={0} width={timelineData.totalWidth} height={HEADER_HEIGHT} className="fill-card" />

                  <g data-timeline-tier="month">
                    {timelineData.monthSegments.map((segment) => (
                      <g key={segment.key}>
                        <line x1={segment.x} y1={0} x2={segment.x} y2={24} className="stroke-border" opacity={0.8} />
                        <text
                          x={segment.x + segment.width / 2}
                          y={16}
                          textAnchor="middle"
                          className="fill-foreground text-[11px] font-medium"
                        >
                          {segment.label}
                        </text>
                      </g>
                    ))}
                  </g>
                  <line x1={0} y1={24} x2={timelineData.totalWidth} y2={24} className="stroke-border" opacity={0.7} />

                  <g data-timeline-tier="weekday">
                    {timelineData.visibleDates.map((date, index) => {
                      const x = index * scale.dayWidth
                      const weekday = date.toLocaleDateString('en-US', {
                        weekday: scale.dayWidth >= 32 ? 'short' : 'narrow',
                      })
                      return (
                        <g key={`weekday-${date.toISOString()}`}>
                          <line x1={x} y1={24} x2={x} y2={HEADER_HEIGHT} className="stroke-border" opacity={0.35} />
                          <text
                            x={x + scale.dayWidth / 2}
                            y={40}
                            textAnchor="middle"
                            className="fill-muted-foreground text-[10px] uppercase"
                          >
                            {weekday}
                          </text>
                        </g>
                      )
                    })}
                  </g>
                  <line x1={0} y1={48} x2={timelineData.totalWidth} y2={48} className="stroke-border" opacity={0.55} />

                  <g data-timeline-tier="date">
                    {timelineData.visibleDates.map((date, index) => (
                      <text
                        key={`date-${date.toISOString()}`}
                        x={index * scale.dayWidth + scale.dayWidth / 2}
                        y={65}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[10px]"
                      >
                        {date.getDate()}
                      </text>
                    ))}
                  </g>

                  {displaySettings.showWeekSeparators && timelineData.weekSeparators.map((separator) => (
                    <line
                      key={`header-week-separator-${calendarWeekKey(separator.date, displaySettings.weekStart)}`}
                      x1={separator.x}
                      y1={0}
                      x2={separator.x}
                      y2={HEADER_HEIGHT}
                      className="stroke-border"
                      strokeWidth={1.5}
                      opacity={0.9}
                    />
                  ))}
                </svg>
              </div>
            <svg
          data-testid="gantt-timeline"
          width={timelineData.totalWidth}
          height={renderHeight}
          className="absolute inset-0 select-none"
        >
          <defs>
            {/* Arrow markers */}
            <marker
              id="arrow-normal"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" className="fill-primary" />
            </marker>
            <marker
              id="arrow-critical"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" className="fill-destructive" />
            </marker>
          </defs>

          {/* Row backgrounds */}
          {(() => {
            let yOffset = HEADER_HEIGHT
            return visibleRows.map((row, index) => {
              const rowHeight = row.type === 'group-header' ? GROUP_HEADER_HEIGHT : TASK_ROW_HEIGHT
              const rect = (
                <rect
                  data-row-key={row.type === 'group-header' ? `group-${row.group}` : `task-${row.task.id}`}
                  key={
                    row.type === 'group-header'
                      ? `row-group-${row.group}`
                      : `row-task-${row.task.id}`
                  }
                  x={0}
                  y={yOffset}
                  width={timelineData.totalWidth}
                  height={rowHeight}
                  className={cn(
                    row.type === 'group-header' ? 'fill-card' : index % 2 === 0 ? 'fill-card/50' : 'fill-background',
                    row.type === 'task' && selectedTaskId === row.task.id && 'fill-primary/10',
                    row.type === 'task' && hoveredTaskId === row.task.id && selectedTaskId !== row.task.id && 'fill-accent/30'
                  )}
                />
              )
              yOffset += rowHeight
              return rect
            })
          })()}

          {/* Grid is painted over row backgrounds so it remains continuous. */}
          {displaySettings.showGrid && timelineData.visibleDates.map((date, index) => (
            <line
              key={`grid-${date.toISOString()}`}
              x1={index * scale.dayWidth}
              y1={HEADER_HEIGHT}
              x2={index * scale.dayWidth}
              y2={renderHeight}
              className="stroke-border"
              strokeWidth={1}
              opacity={0.5}
            />
          ))}

          {displaySettings.showWeekSeparators && timelineData.weekSeparators.map((separator) => (
            <g key={`week-separator-${calendarWeekKey(separator.date, displaySettings.weekStart)}`}>
              {displaySettings.showGrid && (
                <line
                  x1={separator.x}
                  y1={HEADER_HEIGHT}
                  x2={separator.x}
                  y2={renderHeight}
                  className="stroke-border"
                  strokeWidth={1.5}
                  opacity={0.85}
                />
              )}
            </g>
          ))}

          {!displaySettings.showGroupGrid && (() => {
            let yOffset = HEADER_HEIGHT
            return visibleRows.map((row) => {
              const rowHeight = row.type === 'group-header' ? GROUP_HEADER_HEIGHT : TASK_ROW_HEIGHT
              const overlay = row.type === 'group-header' ? (
                <rect
                  key={`group-grid-overlay-${row.group}`}
                  x={0}
                  y={yOffset}
                  width={timelineData.totalWidth}
                  height={rowHeight}
                  className="fill-card"
                />
              ) : null
              yOffset += rowHeight
              return overlay
            })
          })()}

          {/* Today marker */}
          {timelineData.todayVisible && (
            <>
              <line
                x1={timelineData.todayX}
                y1={HEADER_HEIGHT}
                x2={timelineData.todayX}
                y2={renderHeight}
                className="stroke-chart-2"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
              <text
                x={timelineData.todayX + 4}
                y={HEADER_HEIGHT + 12}
                className="fill-success text-[9px] font-medium"
              >
                Today
              </text>
            </>
          )}

          {/* Dependency lines (rendered behind bars) */}
          <g>
            {visibleDependencies.map((dep, i) => (
              <DependencyLine
                key={`dep-${i}`}
                fromTask={dep.from}
                toTask={dep.to}
                taskPositions={connectorTaskPositions}
                isCritical={dep.isCritical}
              />
            ))}
          </g>

          {/* Task bars */}
          {visibleTasks.map((task) => {
            const pos = taskPositions.get(task.id)
            if (!pos) return null

            return (
              <GanttBar
                key={task.id}
                task={task}
                x={pos.x}
                y={HEADER_HEIGHT + pos.y}
                width={pos.width}
                isSelected={selectedTaskId === task.id}
                isHovered={hoveredTaskId === task.id}
                isCriticalPath={task.isCriticalPath}
                showCritical={showCriticalPath}
                onSelect={() => selectTask(task.id)}
                onHover={(hover) => hoverTask(hover ? task.id : null)}
                onInteractionStart={(mode, event) => beginBarInteraction(task, mode, event)}
              />
            )
          })}
          <DragPreviewLayer ref={dragPreviewRef} />
            </svg>
            </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-64">
            <ContextMenuLabel className="text-xs font-normal text-muted-foreground">
              {createContext
                ? `${createContext.workstreamLabel} · ${createContext.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Right-click a task row to create'}
            </ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={!createContext}
              onSelect={() => createContext && openTaskCreate({
                startDate: createContext.date,
                endDate: addCalendarDays(createContext.date, 2),
                workstreamId: createContext.workstreamId,
              })}
            >
              <Plus className="h-4 w-4" />
              New task here
            </ContextMenuItem>
            <ContextMenuItem
              disabled={!createContext}
              onSelect={() => createContext && openTaskCreate({
                startDate: createContext.date,
                endDate: addCalendarDays(createContext.date, 1),
                workstreamId: createContext.workstreamId,
                isMilestone: true,
              })}
            >
              <Milestone className="h-4 w-4" />
              New milestone here
            </ContextMenuItem>
            {createContext?.taskId && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => {
                    const predecessor = tasks.find((task) => task.id === createContext.taskId)
                    if (!predecessor) return
                    openTaskCreate({
                      startDate: predecessor.endDate,
                      endDate: addCalendarDays(predecessor.endDate, 2),
                      workstreamId: predecessor.groupName,
                      predecessorIds: [predecessor.id],
                    })
                  }}
                >
                  <GitBranch className="h-4 w-4" />
                  Add dependent task
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => createContext.taskId && openTaskDelete(createContext.taskId)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete task
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
        )}
      </div>
    </div>
  )
}
