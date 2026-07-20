'use client'

import { useEffect, useRef } from 'react'
import {
  Activity,
  Blocks,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  GitBranch,
  ListTodo,
  PanelLeftClose,
  PanelsTopLeft,
  Rocket,
  ServerCog,
  ShieldCheck,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { usePMISStore } from '@/lib/pmis-store'
import { statusConfig, teamConfig, workstreamConfig, type Task } from '@/lib/pmis-data'
import { GANTT_TIMELINE_HEADER_HEIGHT, GROUP_HEADER_HEIGHT, TASK_ROW_HEIGHT } from '@/lib/pmis-layout'

function TaskRow({ task, compact }: { task: Task; compact: boolean }) {
  const { 
    selectedTaskId, 
    hoveredTaskId, 
    selectTask, 
    hoverTask 
  } = usePMISStore()

  const isSelected = selectedTaskId === task.id
  const isHovered = hoveredTaskId === task.id
  const statusCfg = statusConfig[task.status]
  const dependencyCount = task.dependencies.length + task.dependents.length
  const teamCfg = teamConfig[task.teamName]

  return (
    <div
      className={cn(
        'task-row flex h-full cursor-pointer items-center border-b border-border/50',
        compact ? 'gap-2 px-2' : 'gap-3 px-3',
        'hover:bg-accent/50',
        isSelected && 'task-selected bg-primary/10',
        isHovered && !isSelected && 'bg-accent/30'
      )}
      onClick={() => selectTask(task.id)}
      onMouseEnter={() => hoverTask(task.id)}
      onMouseLeave={() => hoverTask(null)}
    >
      {/* Task name with status indicator */}
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <div className={cn(
          'h-1.5 w-1.5 rounded-full flex-shrink-0',
          task.status === 'done' && 'bg-success',
          task.status === 'in-progress' && 'bg-info',
          task.status === 'blocked' && 'bg-destructive',
          task.status === 'todo' && 'bg-muted-foreground'
        )} />
        <span className={cn(
          'text-sm truncate',
          task.status === 'done' && 'text-muted-foreground line-through',
          task.isMilestone && 'font-medium'
        )}>
          {task.isMilestone && '◆ '}
          {task.name}
        </span>
      </div>

      {/* Assignee avatar */}
      <Avatar className={cn('h-6 w-6 flex-shrink-0', compact && 'h-5 w-5')}>
        <AvatarFallback className="bg-secondary text-[10px] text-muted-foreground">
          {task.assignee.initials}
        </AvatarFallback>
      </Avatar>

      {/* Status chip */}
      <Badge 
        variant="secondary" 
        className={cn(
          'text-[10px] px-1.5 py-0 h-5 flex-shrink-0',
          compact && 'hidden',
          statusCfg.bgColor,
          statusCfg.color
        )}
      >
        {statusCfg.label}
      </Badge>

      <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-5 flex-shrink-0', compact && 'hidden', teamCfg.color)}>
        {teamCfg.label}
      </Badge>

      {/* Dependency count */}
      {dependencyCount > 0 && (
        <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
          <GitBranch className="h-3 w-3" />
          <span className="text-[10px]">{dependencyCount}</span>
        </div>
      )}
    </div>
  )
}

const workstreamIcons = {
  foundation: Blocks,
  'core-platform': ServerCog,
  'execution-ui': PanelsTopLeft,
  validation: ShieldCheck,
  release: Rocket,
} satisfies Record<keyof typeof workstreamConfig, typeof Blocks>

function GroupHeaderRow({
  group,
  taskCount,
  compact,
  showTeamSummary,
}: {
  group: keyof typeof workstreamConfig
  taskCount: number
  compact: boolean
  showTeamSummary: boolean
}) {
  const { expandedGroups, toggleGroup, tasks } = usePMISStore()
  const isExpanded = expandedGroups.includes(group)
  const config = workstreamConfig[group]
  const WorkstreamIcon = workstreamIcons[group]
  const groupTasks = tasks.filter((t) => t.groupName === group)
  const completedCount = groupTasks.filter((t) => t.status === 'done').length
  const inProgressCount = groupTasks.filter((t) => t.status === 'in-progress').length
  const blockedCount = groupTasks.filter((t) => t.status === 'blocked').length
  const teamCounts = groupTasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.teamName] = (acc[task.teamName] ?? 0) + 1
    return acc
  }, {})
  const teamSummary = Object.entries(teamCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([team, count]) => `${teamConfig[team as keyof typeof teamConfig].label} ${count}`)
    .join(' · ')

  return (
    <button
      className={cn(
        'flex w-full items-center border-b border-border transition-colors hover:bg-accent/30',
        compact ? 'gap-1.5 px-2' : 'gap-2 px-3'
      )}
      style={{ height: GROUP_HEADER_HEIGHT }}
      onClick={() => toggleGroup(group)}
    >
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      {compact ? (
        <span
          className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', config.color)}
          title={config.label}
          aria-label={config.label}
        >
          <WorkstreamIcon className="h-3.5 w-3.5" />
        </span>
      ) : (
        <Badge variant="secondary" className={cn('shrink-0 text-xs', config.color)}>
          {config.label}
        </Badge>
      )}
      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground" title={`${taskCount} tasks`}>
        <ListTodo className="h-3 w-3" />
        {taskCount}
      </span>
      {showTeamSummary && teamSummary && (
        <span className="min-w-0 max-w-44 truncate text-[10px] text-muted-foreground" title={teamSummary}>
          {teamSummary}
        </span>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {blockedCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive" title={`${blockedCount} blocked`} aria-label={`${blockedCount} blocked`}>
            <CircleAlert className="h-3 w-3" />
            {blockedCount}
          </span>
        )}
        {inProgressCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-info" title={`${inProgressCount} active`} aria-label={`${inProgressCount} active`}>
            <Activity className="h-3 w-3" />
            {inProgressCount}
          </span>
        )}
        {completedCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-success" title={`${completedCount} done`} aria-label={`${completedCount} done`}>
            <CheckCircle2 className="h-3 w-3" />
            {completedCount}
          </span>
        )}
      </div>
    </button>
  )
}

export function TaskListPanel({
  scrollTop,
  onVerticalScroll,
  onHide,
  panelWidth,
}: {
  scrollTop: number
  onVerticalScroll: (next: number) => void
  onHide: () => void
  panelWidth: number
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const { tasks, getVisibleRows } = usePMISStore()
  const visibleRows = getVisibleRows()
  const compact = panelWidth < 360
  const showTeamSummary = panelWidth >= 440

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    if (Math.abs(el.scrollTop - scrollTop) > 1) {
      el.scrollTop = scrollTop
    }
  }, [scrollTop])

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h2 className="text-sm font-medium text-foreground">Tasks</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{tasks.length} total</span>
          <button
            type="button"
            onClick={onHide}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            aria-label="Hide task list"
            title="Hide task list"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        onScroll={(e) => onVerticalScroll(e.currentTarget.scrollTop)}
      >
        <div style={{ height: GANTT_TIMELINE_HEADER_HEIGHT }} className="border-b border-border/60 bg-card/50" />
        {visibleRows.map((row) =>
          row.type === 'group-header' ? (
            <GroupHeaderRow
              key={`group-${row.group}`}
              group={row.group}
              taskCount={row.taskCount}
              compact={compact}
              showTeamSummary={showTeamSummary}
            />
          ) : (
            <div key={row.task.id} style={{ height: TASK_ROW_HEIGHT }}>
              <TaskRow task={row.task} compact={compact} />
            </div>
          )
        )}
      </div>
    </div>
  )
}
