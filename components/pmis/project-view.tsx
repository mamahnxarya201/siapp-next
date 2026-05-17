'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelLeftOpen } from 'lucide-react'
import { usePMISStore } from '@/lib/pmis-store'
import { TaskListPanel } from './task-list-panel'
import { GanttChart } from './gantt-chart'
import { ContextInspector } from './context-inspector'

const LEFT_PANEL_DEFAULT_WIDTH = 320
const LEFT_PANEL_MIN_WIDTH = 280
const LEFT_PANEL_MAX_WIDTH = 520

export function ProjectView() {
  const { inspectorOpen, selectedTaskId } = usePMISStore()
  const [verticalScrollTop, setVerticalScrollTop] = useState(0)
  const [leftPanelWidth, setLeftPanelWidth] = useState(LEFT_PANEL_DEFAULT_WIDTH)
  const [leftPanelHidden, setLeftPanelHidden] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(LEFT_PANEL_DEFAULT_WIDTH)

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

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel - Task List */}
      {!leftPanelHidden && (
        <>
          <div
            className="flex-shrink-0 overflow-hidden"
            style={{ width: leftPanelWidth, minWidth: LEFT_PANEL_MIN_WIDTH }}
          >
            <TaskListPanel
              scrollTop={verticalScrollTop}
              onVerticalScroll={setVerticalScrollTop}
              onHide={() => setLeftPanelHidden(true)}
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
          scrollTop={verticalScrollTop}
          onVerticalScroll={setVerticalScrollTop}
        />
      </div>

      {/* Right Panel - Context Inspector */}
      {inspectorOpen && selectedTaskId && (
        <div className="flex-shrink-0">
          <ContextInspector />
        </div>
      )}
    </div>
  )
}
