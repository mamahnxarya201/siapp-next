'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, GitBranch, AlertTriangle, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
  mode: GanttInteractionMode
  startClientX: number
  startClientY: number
  initialStartDate: Date
  initialEndDate: Date
  lastUnitDelta: number
  warnedVerticalMove: boolean
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
            width={6}
            height={BAR_HEIGHT}
            className="fill-transparent cursor-ew-resize"
            onMouseDown={(e) => onInteractionStart('resize-start', e)}
          />
          <rect
            x={x + width - 6}
            y={y}
            width={6}
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
  scrollTop,
  onVerticalScroll,
  onHorizontalScrollbarHeightChange,
}: {
  scrollTop: number
  onVerticalScroll: (next: number) => void
  onHorizontalScrollbarHeightChange: (height: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<DragState | null>(null)
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

  const {
    tasks,
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
    getTaskDependencies,
    getTaskDependents,
    getUpstreamChain,
    getDownstreamChain,
    getVisibleRows,
  } = usePMISStore()

  const scale = SCALES[timelineScale]

  const taskExtent = useMemo(() => {
    const allDates = tasks.flatMap((task) => [task.startDate, task.endDate])
    return {
      minDate: startOfCalendarDay(new Date(Math.min(...allDates.map((date) => date.getTime())))),
      maxDate: startOfCalendarDay(new Date(Math.max(...allDates.map((date) => date.getTime())))),
    }
  }, [tasks])

  useEffect(() => {
    setDisplaySettings(parseGanttDisplaySettings(window.localStorage.getItem(GANTT_DISPLAY_SETTINGS_KEY)))
    setSettingsHydrated(true)
  }, [])

  useEffect(() => {
    if (!settingsHydrated) return
    window.localStorage.setItem(GANTT_DISPLAY_SETTINGS_KEY, JSON.stringify(displaySettings))
  }, [displaySettings, settingsHydrated])

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
    const el = containerRef.current
    if (!el) return
    if (Math.abs(el.scrollTop - scrollTop) > 1) {
      el.scrollTop = scrollTop
    }
  }, [scrollTop])

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

  const beginBarInteraction = useCallback((task: Task, mode: GanttInteractionMode, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    selectTask(task.id)

    dragStateRef.current = {
      taskId: task.id,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initialStartDate: normalizeTimelineBoundary(task.startDate),
      initialEndDate: normalizeTimelineBoundary(task.endDate),
      lastUnitDelta: 0,
      warnedVerticalMove: false,
    }
    setIsDragging(true)
  }, [selectTask])

  const applyForwardSchedulePropagation = useCallback((initialUpdates: TaskDateUpdate[]) => {
    const tasksById = new Map(tasks.map((task) => [task.id, task]))
    const updatesById = new Map(initialUpdates.map((update) => [update.taskId, update]))
    const queue = initialUpdates.map((update) => update.taskId)
    let safetyCounter = 0
    const maxIterations = Math.max(1, tasks.length * tasks.length)

    const getTaskDates = (taskId: string) => {
      const update = updatesById.get(taskId)
      if (update) return update

      const task = tasksById.get(taskId)
      return task
        ? { taskId, startDate: task.startDate, endDate: task.endDate }
        : null
    }

    while (queue.length > 0 && safetyCounter < maxIterations) {
      safetyCounter += 1
      const predecessorId = queue.shift()
      if (!predecessorId) continue

      const predecessorTask = tasksById.get(predecessorId)
      const predecessorDates = getTaskDates(predecessorId)
      if (!predecessorTask || !predecessorDates) continue

      predecessorTask.dependents.forEach((dependentId) => {
        const dependentDates = getTaskDates(dependentId)
        if (!dependentDates) return

        if (predecessorDates.endDate.getTime() <= dependentDates.startDate.getTime()) {
          return
        }

        const dependentDuration = Math.max(
          displaySettings.snapIncrement === 'half-day' ? HALF_DAY_MS : HALF_DAY_MS * 2,
          dependentDates.endDate.getTime() - dependentDates.startDate.getTime()
        )
        const nextStartDate = normalizeTimelineBoundary(predecessorDates.endDate)
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
  }, [tasks, displaySettings.snapIncrement])

  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (event: MouseEvent) => {
      const drag = dragStateRef.current
      if (!drag) return

      const deltaY = Math.abs(event.clientY - drag.startClientY)
      if (deltaY > TASK_ROW_HEIGHT && !drag.warnedVerticalMove) {
        drag.warnedVerticalMove = true
        showVerticalMoveNotice()
      }

      const snapUnits = displaySettings.snapIncrement === 'half-day' ? 0.5 : 1
      const unitDelta = Math.round((event.clientX - drag.startClientX) / (scale.dayWidth * snapUnits)) * snapUnits
      if (unitDelta === drag.lastUnitDelta) return
      drag.lastUnitDelta = unitDelta

      const minimumDuration = snapUnits * 24 * 60 * 60 * 1000
      const initialDuration = Math.max(minimumDuration, drag.initialEndDate.getTime() - drag.initialStartDate.getTime())
      const draggedTask = tasks.find((task) => task.id === drag.taskId)
      const earliestStart = draggedTask?.dependencies.reduce<Date | null>((latest, dependencyId) => {
        const dependency = tasks.find((task) => task.id === dependencyId)
        if (!dependency) return latest
        const dependencyEnd = normalizeTimelineBoundary(dependency.endDate)
        return !latest || dependencyEnd.getTime() > latest.getTime()
          ? dependencyEnd
          : latest
      }, null)
      let nextStart = new Date(drag.initialStartDate)
      let nextEnd = new Date(drag.initialEndDate)

      if (drag.mode === 'move') {
        nextStart = shiftByVisibleUnits(drag.initialStartDate, unitDelta, displaySettings.visibleWeekdays)
        if (earliestStart && nextStart.getTime() < earliestStart.getTime()) {
          nextStart = new Date(earliestStart)
        }
        nextEnd = new Date(nextStart.getTime() + initialDuration)
      }

      if (drag.mode === 'resize-start') {
        nextStart = shiftByVisibleUnits(drag.initialStartDate, unitDelta, displaySettings.visibleWeekdays)
        if (nextEnd.getTime() - nextStart.getTime() < minimumDuration) {
          nextStart = new Date(nextEnd.getTime() - minimumDuration)
        }
        if (earliestStart && nextStart.getTime() < earliestStart.getTime()) {
          nextStart = new Date(earliestStart)
        }
      }

      if (drag.mode === 'resize-end') {
        nextEnd = shiftByVisibleUnits(drag.initialEndDate, unitDelta, displaySettings.visibleWeekdays)
        if (nextEnd.getTime() - nextStart.getTime() < minimumDuration) {
          nextEnd = new Date(nextStart.getTime() + minimumDuration)
        }
      }

      const updates = applyForwardSchedulePropagation([
        { taskId: drag.taskId, startDate: nextStart, endDate: nextEnd },
      ])

      updateTaskDatesBatch(updates)
    }

    const handlePointerUp = () => {
      dragStateRef.current = null
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [
    applyForwardSchedulePropagation,
    displaySettings.snapIncrement,
    displaySettings.visibleWeekdays,
    isDragging,
    scale.dayWidth,
    showVerticalMoveNotice,
    tasks,
    updateTaskDatesBatch,
  ])

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

          {/* Scroll controls */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scrollTimeline('left')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scrollTimeline('right')}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5"
                aria-label="Timeline settings"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="text-xs">Timeline</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[min(680px,calc(100vh-2rem))] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Timeline settings</DialogTitle>
                <DialogDescription>
                  Customize the timeline display without changing stored task dates.
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
        </div>
      </div>

      {/* Chart */}
      <div className="relative flex-1 overflow-hidden">
        {dragNotice && (
          <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md border border-warning/30 bg-card/95 px-3 py-2 text-xs text-warning shadow-lg backdrop-blur">
            {dragNotice}
          </div>
        )}
        <div
          ref={containerRef}
          className={cn('h-full overflow-auto', isDragging && 'cursor-ew-resize')}
          onScroll={handleScroll}
        >
        <svg
          data-testid="gantt-timeline"
          width={timelineData.totalWidth}
          height={renderHeight}
          className="select-none"
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

          {/* Timeline header background */}
          <rect
            x={0}
            y={0}
            width={timelineData.totalWidth}
            height={HEADER_HEIGHT}
            className="fill-card"
          />

          {/* Three-tier calendar header: month/year, weekday, date. */}
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
              <line
                x1={separator.x}
                y1={0}
                x2={separator.x}
                y2={HEADER_HEIGHT}
                className="stroke-border"
                strokeWidth={1.5}
                opacity={0.9}
              />
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
                taskPositions={new Map(
                  Array.from(taskPositions.entries()).map(([id, pos]) => [
                    id,
                    { ...pos, y: pos.y + HEADER_HEIGHT }
                  ])
                )}
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
          </svg>
        </div>
      </div>
    </div>
  )
}
