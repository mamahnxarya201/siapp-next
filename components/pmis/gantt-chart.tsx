'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, GitBranch, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { usePMISStore } from '@/lib/pmis-store'
import { workstreamConfig, type Task } from '@/lib/pmis-data'
import { GANTT_PANEL_HEADER_HEIGHT, GANTT_TIMELINE_HEADER_HEIGHT, GROUP_HEADER_HEIGHT, TASK_ROW_HEIGHT } from '@/lib/pmis-layout'

const SCALES = {
  day: { dayWidth: 60, label: 'Day' },
  week: { dayWidth: 20, label: 'Week' },
  month: { dayWidth: 6, label: 'Month' },
}

const HEADER_HEIGHT = GANTT_TIMELINE_HEADER_HEIGHT
const BAR_HEIGHT = 24
const BAR_PADDING = (TASK_ROW_HEIGHT - BAR_HEIGHT) / 2

// Helper to get days between dates
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round((date2.getTime() - date1.getTime()) / oneDay)
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

  // Create a curved path
  const midX = (fromX + toX) / 2
  const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`

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
  onDragStart,
  opacity,
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
  onDragStart: (e: React.MouseEvent) => void
  opacity: number
}) {
  const barColor = useMemo(() => {
    if (task.status === 'done') return 'fill-emerald-500/70'
    if (task.status === 'blocked') return 'fill-red-500/70'
    if (task.status === 'in-progress') return 'fill-blue-500/80'
    return 'fill-muted-foreground/40'
  }, [task.status, isCriticalPath, showCritical])

  const progressWidth = (width * task.progress) / 100

  return (
    <g
      className="cursor-pointer"
      style={{ opacity }}
      onClick={onSelect}
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

      {/* Critical path overlay accent; preserve base status fill */}
      {showCritical && isCriticalPath && (
        <>
          <rect
            x={x}
            y={y}
            width={width}
            height={BAR_HEIGHT}
            rx={4}
            fill="none"
            stroke="oklch(0.55 0.22 25)"
            strokeWidth={1.5}
            strokeOpacity={0.95}
          />
          <line
            x1={x + 2}
            y1={y + 1}
            x2={x + width - 2}
            y2={y + 1}
            stroke="oklch(0.55 0.22 25)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      )}
      
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
            onMouseDown={(e) => {
              e.stopPropagation()
              onDragStart(e)
            }}
          />
          <rect
            x={x + width - 6}
            y={y}
            width={6}
            height={BAR_HEIGHT}
            className="fill-transparent cursor-ew-resize"
          />
        </>
      )}
    </g>
  )
}

export function GanttChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  
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
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])

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

  const hoveredContextIds = useMemo(() => {
    if (!hoveredTaskId) return null
    const ids = new Set<string>([hoveredTaskId])
    const hovered = taskById.get(hoveredTaskId)
    if (!hovered) return ids
    hovered.dependencies.forEach((id) => ids.add(id))
    hovered.dependents.forEach((id) => ids.add(id))
    return ids
  }, [hoveredTaskId, taskById])

  const rowsHeight = useMemo(
    () =>
      visibleRows.reduce(
        (sum, row) => sum + (row.type === 'group-header' ? GROUP_HEADER_HEIGHT : TASK_ROW_HEIGHT),
        0
      ),
    [visibleRows]
  )
  const totalHeight = rowsHeight + HEADER_HEIGHT
  const renderedWidth = Math.max(timelineData.totalWidth, viewportWidth)

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateWidth = () => setViewportWidth(el.clientWidth)
    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(el)
    return () => resizeObserver.disconnect()
  }, [])

  const scrollTimeline = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-card" style={{ height: GANTT_PANEL_HEADER_HEIGHT }}>
        {/* Toolbar */}
        <div className="flex h-12 items-center justify-between px-4">
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
        <div className="flex h-6 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 px-4 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground" />Todo</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />In Progress</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Done</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Blocked</span>
          <span className="inline-flex items-center gap-1"><span className="h-[2px] w-4 bg-blue-400" />Dependency</span>
          <span className="inline-flex items-center gap-1"><span className="h-[2px] w-4 bg-red-400" />Critical path</span>
          <span className="inline-flex items-center gap-1"><span className="text-amber-500">◆</span>Milestone</span>
        </div>
      </div>

      {/* Chart */}
      <div 
        ref={containerRef}
        className="scrollbar-none overflow-x-auto overflow-y-visible"
        onScroll={handleScroll}
      >
        <svg
          width={renderedWidth}
          height={totalHeight}
          className="block select-none"
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
            width={renderedWidth}
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
                <g key={row.type === 'group-header' ? `row-group-${row.group}` : `row-task-${row.task.id}`}>
                  <rect
                    x={0}
                    y={yOffset}
                    width={renderedWidth}
                    height={rowHeight}
                    className={cn(
                      row.type === 'group-header' ? 'fill-card/90' : index % 2 === 0 ? 'fill-card/45' : 'fill-background',
                      row.type === 'task' && selectedTaskId === row.task.id && 'fill-primary/10',
                      row.type === 'task' && hoveredTaskId === row.task.id && selectedTaskId !== row.task.id && 'fill-accent/30'
                    )}
                  />
                  {row.type === 'group-header' && (
                    <>
                      <line x1={0} y1={yOffset + rowHeight - 1} x2={renderedWidth} y2={yOffset + rowHeight - 1} stroke="oklch(0.32 0 0)" />
                      <text x={10} y={yOffset + 15} className="fill-foreground text-[11px] font-medium opacity-90">
                        {workstreamConfig[row.group]?.label ?? row.group}
                      </text>
                      <text x={10} y={yOffset + 29} className="fill-muted-foreground text-[10px]">
                        {row.taskCount} tasks · {tasks.filter((t) => t.groupName === row.group && t.status === 'blocked').length} blocked · {tasks.filter((t) => t.groupName === row.group && t.status === 'done').length} done
                      </text>
                    </>
                  )}
                </g>
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
            const barOpacity = hoveredTaskId
              ? hoveredContextIds?.has(task.id)
                ? task.id === hoveredTaskId
                  ? 1
                  : 0.9
                : 0.4
              : 1

            return (
              <TooltipProvider key={task.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <g>
                      <GanttBar
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
                        onDragStart={() => setIsDragging(true)}
                        opacity={barOpacity}
                      />
                    </g>
                  </TooltipTrigger>
                  {task.isMilestone && (
                    <TooltipContent side="top" className="text-xs">
                      <div className="space-y-0.5">
                        <p className="font-medium">{task.name}</p>
                        <p>Due: {task.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        <p>Linked: {task.dependencies.length + task.dependents.length} tasks</p>
                        <p>Risk: {task.riskLevel}</p>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
