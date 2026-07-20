'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, GitBranch, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { usePMISStore } from '@/lib/pmis-store'
import type { Task } from '@/lib/pmis-data'
import { GANTT_TIMELINE_HEADER_HEIGHT, GROUP_HEADER_HEIGHT, TASK_ROW_HEIGHT } from '@/lib/pmis-layout'

const SCALES = {
  day: { dayWidth: 60, label: 'Day' },
  week: { dayWidth: 20, label: 'Week' },
  month: { dayWidth: 6, label: 'Month' },
}

const HEADER_HEIGHT = GANTT_TIMELINE_HEADER_HEIGHT
const BAR_HEIGHT = 24
const BAR_PADDING = (TASK_ROW_HEIGHT - BAR_HEIGHT) / 2

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
  lastDayDelta: number
  warnedVerticalMove: boolean
}

// Helper to get days between dates
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round((date2.getTime() - date1.getTime()) / oneDay)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

// Format date for header
function formatDate(date: Date, scale: 'day' | 'week' | 'month'): string {
  if (scale === 'day') {
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
  } else if (scale === 'week') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

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

  const elbowGap = 18
  const midX = fromX <= toX
    ? Math.max(fromX + elbowGap, Math.min(toX - elbowGap, (fromX + toX) / 2))
    : fromX + elbowGap
  const endX = fromX <= toX ? toX : toX - elbowGap
  const path = fromX <= toX
    ? `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`
    : `M ${fromX} ${fromY} H ${midX} V ${toY} H ${endX} H ${toX}`

  return (
    <g style={{ opacity }}>
      <path
        d={path}
        fill="none"
        stroke={isCritical ? 'oklch(0.55 0.22 25)' : 'oklch(0.65 0.2 250)'}
        strokeWidth={isCritical ? 2 : 1.5}
        className="dependency-line"
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
    if (showCritical && isCriticalPath) return 'fill-red-500/80'
    if (task.status === 'done') return 'fill-emerald-500/70'
    if (task.status === 'blocked') return 'fill-red-500/70'
    if (task.status === 'in-progress') return 'fill-blue-500/80'
    return 'fill-muted-foreground/40'
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
      
      {/* Progress fill */}
      {task.progress > 0 && task.progress < 100 && (
        <rect
          x={x}
          y={y}
          width={progressWidth}
          height={BAR_HEIGHT}
          rx={4}
          className="fill-primary/60"
        />
      )}

      {/* Task name (if bar is wide enough) */}
      {width > 80 && (
        <text
          x={x + 8}
          y={y + BAR_HEIGHT / 2 + 4}
          className="fill-foreground text-[11px] font-medium pointer-events-none"
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
          className="fill-amber-500"
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
}: {
  scrollTop: number
  onVerticalScroll: (next: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragNotice, setDragNotice] = useState<string | null>(null)
  
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

  // Calculate timeline range
  const timelineData = useMemo(() => {
    const allDates = tasks.flatMap(t => [t.startDate, t.endDate])
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
    
    // Add padding
    minDate.setDate(minDate.getDate() - 7)
    maxDate.setDate(maxDate.getDate() + 14)
    
    const totalDays = daysBetween(minDate, maxDate)
    const totalWidth = totalDays * scale.dayWidth
    
    // Generate date markers
    const markers: { date: Date; x: number }[] = []
    const currentDate = new Date(minDate)
    let step = 1
    if (timelineScale === 'week') step = 7
    if (timelineScale === 'month') step = 30
    
    while (currentDate <= maxDate) {
      const dayOffset = daysBetween(minDate, currentDate)
      markers.push({
        date: new Date(currentDate),
        x: dayOffset * scale.dayWidth
      })
      currentDate.setDate(currentDate.getDate() + step)
    }

    // Today marker
    const today = new Date()
    const todayOffset = daysBetween(minDate, today)
    const todayX = todayOffset * scale.dayWidth

    return { minDate, maxDate, totalDays, totalWidth, markers, todayX }
  }, [tasks, timelineScale, scale.dayWidth])

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
      const startOffset = daysBetween(timelineData.minDate, task.startDate)
      const duration = daysBetween(task.startDate, task.endDate)
      
      positions.set(task.id, {
        x: startOffset * scale.dayWidth,
        y: yOffset + BAR_PADDING,
        width: Math.max(duration * scale.dayWidth, 20) // Minimum width
      })
      yOffset += TASK_ROW_HEIGHT
    })
    
    return positions
  }, [visibleRows, timelineData.minDate, scale.dayWidth])

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

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    onVerticalScroll(e.currentTarget.scrollTop)
    setScrollLeft(e.currentTarget.scrollLeft)
  }, [onVerticalScroll])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (Math.abs(el.scrollTop - scrollTop) > 1) {
      el.scrollTop = scrollTop
    }
  }, [scrollTop])

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
      initialStartDate: new Date(task.startDate),
      initialEndDate: new Date(task.endDate),
      lastDayDelta: 0,
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

        const dependentDuration = Math.max(1, daysBetween(dependentDates.startDate, dependentDates.endDate))
        const nextStartDate = new Date(predecessorDates.endDate)
        const nextEndDate = addDays(nextStartDate, dependentDuration)

        updatesById.set(dependentId, {
          taskId: dependentId,
          startDate: nextStartDate,
          endDate: nextEndDate,
        })
        queue.push(dependentId)
      })
    }

    return Array.from(updatesById.values())
  }, [tasks])

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

      const dayDelta = Math.round((event.clientX - drag.startClientX) / scale.dayWidth)
      if (dayDelta === drag.lastDayDelta) return
      drag.lastDayDelta = dayDelta

      const initialDuration = Math.max(1, daysBetween(drag.initialStartDate, drag.initialEndDate))
      let nextStart = new Date(drag.initialStartDate)
      let nextEnd = new Date(drag.initialEndDate)

      if (drag.mode === 'move') {
        nextStart = addDays(drag.initialStartDate, dayDelta)
        nextEnd = addDays(drag.initialEndDate, dayDelta)
      }

      if (drag.mode === 'resize-start') {
        const maxDelta = initialDuration - 1
        nextStart = addDays(drag.initialStartDate, Math.min(dayDelta, maxDelta))
      }

      if (drag.mode === 'resize-end') {
        const minDelta = 1 - initialDuration
        nextEnd = addDays(drag.initialEndDate, Math.max(dayDelta, minDelta))
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
  }, [applyForwardSchedulePropagation, isDragging, scale.dayWidth, showVerticalMoveNotice, updateTaskDatesBatch])

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current)
    }
  }, [])

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
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
                  className="h-8 gap-1.5 px-3 data-[state=on]:bg-red-500/20 data-[state=on]:text-red-400"
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
          <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-xs text-amber-100 shadow-lg backdrop-blur">
            {dragNotice}
          </div>
        )}
        <div 
          ref={containerRef}
          className={cn('h-full overflow-auto', isDragging && 'cursor-ew-resize')}
          onScroll={handleScroll}
        >
        <svg
          width={timelineData.totalWidth}
          height={totalHeight}
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
              <path d="M0,0 L8,4 L0,8 Z" fill="oklch(0.65 0.2 250)" />
            </marker>
            <marker
              id="arrow-critical"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="oklch(0.55 0.22 25)" />
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

          {/* Grid lines and date headers */}
          {timelineData.markers.map((marker, i) => (
            <g key={i}>
              {/* Vertical grid line */}
              <line
                x1={marker.x}
                y1={HEADER_HEIGHT}
                x2={marker.x}
                y2={totalHeight}
                className="stroke-border"
                strokeWidth={1}
                opacity={0.5}
              />
              {/* Date label */}
              <text
                x={marker.x + 4}
                y={HEADER_HEIGHT - 10}
                className="fill-muted-foreground text-[11px]"
              >
                {formatDate(marker.date, timelineScale)}
              </text>
            </g>
          ))}

          {/* Today marker */}
          <line
            x1={timelineData.todayX}
            y1={HEADER_HEIGHT}
            x2={timelineData.todayX}
            y2={totalHeight}
            stroke="oklch(0.7 0.18 165)"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
          <text
            x={timelineData.todayX + 4}
            y={HEADER_HEIGHT - 26}
            className="fill-emerald-400 text-[10px] font-medium"
          >
            Today
          </text>

          {/* Row backgrounds */}
          {(() => {
            let yOffset = HEADER_HEIGHT
            return visibleRows.map((row, index) => {
              const rowHeight = row.type === 'group-header' ? GROUP_HEADER_HEIGHT : TASK_ROW_HEIGHT
              const rect = (
                <rect
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
