'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PanelLeftOpen } from 'lucide-react'
import { usePMISStore } from '@/lib/pmis-store'
import { TaskListPanel } from './task-list-panel'
import { GanttChart } from './gantt-chart'
import { ContextInspector } from './context-inspector'

const LEFT_PANEL_DEFAULT_WIDTH = 320
const LEFT_PANEL_MIN_WIDTH = 280
const LEFT_PANEL_MAX_WIDTH = 520
const RIGHT_PANEL_DEFAULT_WIDTH = 320
const RIGHT_PANEL_MIN_WIDTH = 280
const RIGHT_PANEL_MAX_WIDTH = 520

export function ProjectView() {
  const { inspectorOpen, selectedTaskId } = usePMISStore()
  const [leftPanelWidth, setLeftPanelWidth] = useState(LEFT_PANEL_DEFAULT_WIDTH)
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_DEFAULT_WIDTH)
  const [leftPanelHidden, setLeftPanelHidden] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isResizingRight, setIsResizingRight] = useState(false)
  const [timelineScrollbarHeight, setTimelineScrollbarHeight] = useState(0)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(LEFT_PANEL_DEFAULT_WIDTH)
  const rightResizeStartX = useRef(0)
  const rightResizeStartWidth = useRef(RIGHT_PANEL_DEFAULT_WIDTH)
  const taskListScrollerRef = useRef<HTMLDivElement>(null)
  const ganttScrollerRef = useRef<HTMLDivElement>(null)
  const verticalScrollTopRef = useRef(0)

  const syncFromTaskList = useCallback((scrollTop: number) => {
    verticalScrollTopRef.current = scrollTop
    const ganttScroller = ganttScrollerRef.current
    if (ganttScroller && Math.abs(ganttScroller.scrollTop - scrollTop) > 0.5) {
      ganttScroller.scrollTop = scrollTop
    }
  }, [])

  const syncFromGantt = useCallback((scrollTop: number) => {
    verticalScrollTopRef.current = scrollTop
    const taskListScroller = taskListScrollerRef.current
    if (taskListScroller && Math.abs(taskListScroller.scrollTop - scrollTop) > 0.5) {
      taskListScroller.scrollTop = scrollTop
    }
  }, [])

  useLayoutEffect(() => {
    if (!leftPanelHidden && taskListScrollerRef.current) {
      taskListScrollerRef.current.scrollTop = verticalScrollTopRef.current
    }
  }, [leftPanelHidden])

  const beginResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    resizeStartX.current = event.clientX
    resizeStartWidth.current = leftPanelWidth
    setIsResizing(true)
  }, [leftPanelWidth])

  useEffect(() => {
    if (!isResizing) return

    const handlePointerMove = (event: MouseEvent) => {
      const delta = event.clientX - resizeStartX.current
      const next = Math.max(LEFT_PANEL_MIN_WIDTH, Math.min(LEFT_PANEL_MAX_WIDTH, resizeStartWidth.current + delta))
      setLeftPanelWidth(next)
    }

    const endResize = () => setIsResizing(false)

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', endResize)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', endResize)
    }
  }, [isResizing])

  const beginRightResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    rightResizeStartX.current = event.clientX
    rightResizeStartWidth.current = rightPanelWidth
    setIsResizingRight(true)
  }, [rightPanelWidth])

  useEffect(() => {
    if (!isResizingRight) return

    const handlePointerMove = (event: MouseEvent) => {
      const delta = event.clientX - rightResizeStartX.current
      const next = Math.max(
        RIGHT_PANEL_MIN_WIDTH,
        Math.min(RIGHT_PANEL_MAX_WIDTH, rightResizeStartWidth.current - delta)
      )
      setRightPanelWidth(next)
    }

    const endResize = () => setIsResizingRight(false)

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', endResize)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', endResize)
    }
  }, [isResizingRight])

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Left Panel - Task List */}
      {!leftPanelHidden && (
        <>
          <div
            className="flex-shrink-0 overflow-hidden"
            style={{ width: leftPanelWidth, minWidth: LEFT_PANEL_MIN_WIDTH }}
          >
            <TaskListPanel
              scrollRef={taskListScrollerRef}
              onVerticalScroll={syncFromTaskList}
              onHide={() => setLeftPanelHidden(true)}
              panelWidth={leftPanelWidth}
              bottomScrollPadding={timelineScrollbarHeight}
            />
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize task list panel"
            className="w-1.5 cursor-col-resize bg-border/60 hover:bg-primary/50 transition-colors"
            onMouseDown={beginResize}
          />
        </>
      )}

      {/* Center Panel - Gantt Chart */}
      <div className="relative flex-1 overflow-hidden">
        {leftPanelHidden && (
          <button
            type="button"
            onClick={() => setLeftPanelHidden(false)}
            className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-md border border-border bg-card/95 px-2 py-1 text-xs text-foreground hover:bg-accent"
          >
            <PanelLeftOpen className="h-4 w-4" />
            Show Tasks
          </button>
        )}
        <GanttChart
          scrollRef={ganttScrollerRef}
          onVerticalScroll={syncFromGantt}
          onHorizontalScrollbarHeightChange={setTimelineScrollbarHeight}
        />
      </div>

      {/* Right Panel - Context Inspector */}
      {inspectorOpen && selectedTaskId && (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize task details panel"
            className="resize-handle w-1.5 flex-shrink-0 cursor-col-resize bg-border/60 transition-colors hover:bg-primary/50"
            onMouseDown={beginRightResize}
          />
          <div
            className="flex min-h-0 flex-shrink-0 overflow-hidden"
            style={{ width: rightPanelWidth, minWidth: RIGHT_PANEL_MIN_WIDTH }}
          >
            <ContextInspector width={rightPanelWidth} />
          </div>
        </>
      )}
    </div>
  )
}
