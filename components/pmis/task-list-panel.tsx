'use client'

import { ChevronRight, ChevronDown, GitBranch } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { usePMISStore } from '@/lib/pmis-store'
import { statusConfig, teamConfig, workstreamConfig, type Task } from '@/lib/pmis-data'
import { GANTT_PANEL_HEADER_HEIGHT, GANTT_TIMELINE_HEADER_HEIGHT, GROUP_HEADER_HEIGHT, TASK_ROW_HEIGHT } from '@/lib/pmis-layout'

function TaskRow({ task }: { task: Task }) {
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
        'task-row h-full flex items-center gap-3 px-3 cursor-pointer border-b border-border/50',
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
          task.status === 'done' && 'bg-emerald-500',
          task.status === 'in-progress' && 'bg-blue-500',
          task.status === 'blocked' && 'bg-red-500',
          task.status === 'todo' && 'bg-muted-foreground'
        )} />
        <span className={cn(
          'text-sm truncate',
          task.status === 'done' && 'text-muted-foreground line-through',
          task.isMilestone && 'font-medium'
        )} title={task.name}>
          {task.isMilestone && '◆ '}
          {task.name}
        </span>
      </div>

      {/* Assignee avatar */}
      <Avatar className="h-6 w-6 flex-shrink-0">
        <AvatarFallback className="bg-secondary text-[10px] text-muted-foreground">
          {task.assignee.initials}
        </AvatarFallback>
      </Avatar>

      {/* Status chip */}
      <Badge 
        variant="secondary" 
        className={cn(
          'text-[10px] px-1.5 py-0 h-5 flex-shrink-0',
          statusCfg.bgColor,
          statusCfg.color
        )}
      >
        {statusCfg.label}
      </Badge>

      <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-5 flex-shrink-0', teamCfg.color)}>
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

function GroupHeaderRow({ group, taskCount }: { group: keyof typeof workstreamConfig; taskCount: number }) {
  const { expandedGroups, toggleGroup, tasks } = usePMISStore()
  const isExpanded = expandedGroups.includes(group)
  const config = workstreamConfig[group]
  const groupTasks = tasks.filter((t) => t.groupName === group)
  const completedCount = groupTasks.filter((t) => t.status === 'done').length
  const inProgressCount = groupTasks.filter((t) => t.status === 'in-progress').length
  const activeCount = groupTasks.filter((t) => t.status === 'in-progress' || t.status === 'blocked').length
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
      className="flex w-full items-center gap-2 px-3 hover:bg-accent/30 transition-colors border-b border-border"
      style={{ height: GROUP_HEADER_HEIGHT }}
      onClick={() => toggleGroup(group)}
    >
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
      <Badge variant="secondary" className={cn('text-xs', config.color)}>
        {config.label}
      </Badge>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {taskCount} tasks · {activeCount} active · {completedCount} done
      </span>
      {teamSummary && <span className="text-[10px] text-muted-foreground truncate max-w-44 whitespace-nowrap">{teamSummary}</span>}
      <div className="ml-auto flex items-center gap-1">
        {blockedCount > 0 && <span className="text-[10px] text-red-400">{blockedCount} blocked</span>}
        {inProgressCount > 0 && <span className="text-[10px] text-blue-400">{inProgressCount} active</span>}
        {completedCount > 0 && <span className="text-[10px] text-emerald-400">{completedCount} done</span>}
      </div>
    </button>
  )
}

export function TaskListPanel() {
  const { tasks, getVisibleRows } = usePMISStore()
  const visibleRows = getVisibleRows()

  return (
    <div className="flex min-h-full flex-col border-r border-border bg-card">
      {/* Panel header */}
      <div
        className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border bg-card px-3"
        style={{ height: GANTT_PANEL_HEADER_HEIGHT }}
      >
        <h2 className="text-sm font-medium text-foreground">Tasks</h2>
        <span className="text-xs text-muted-foreground">{tasks.length} total</span>
      </div>

      <div>
        <div style={{ height: GANTT_TIMELINE_HEADER_HEIGHT }} className="border-b border-border/60 bg-card/50" />
        {visibleRows.map((row) =>
          row.type === 'group-header' ? (
            <GroupHeaderRow key={`group-${row.group}`} group={row.group} taskCount={row.taskCount} />
          ) : (
            <div key={row.task.id} style={{ height: TASK_ROW_HEIGHT }}>
              <TaskRow task={row.task} />
            </div>
          )
        )}
      </div>
    </div>
  )
}
