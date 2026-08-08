'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Blocks,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  GitBranch,
  MoreHorizontal,
  Pencil,
  Plus,
  ListTodo,
  PanelLeftClose,
  PanelsTopLeft,
  Rocket,
  ServerCog,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { usePMISStore } from '@/lib/pmis-store'
import { statusConfig, teamConfig, type Task, type Workstream } from '@/lib/pmis-data'
import {
  GANTT_TIMELINE_HEADER_HEIGHT,
  GROUP_HEADER_HEIGHT,
  PROJECT_PANEL_TOOLBAR_HEIGHT,
  TASK_ROW_HEIGHT,
} from '@/lib/pmis-layout'

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
      data-row-key={`task-${task.id}`}
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

const workstreamIcons: Record<string, typeof Blocks> = {
  foundation: Blocks,
  'core-platform': ServerCog,
  'execution-ui': PanelsTopLeft,
  validation: ShieldCheck,
  release: Rocket,
}

function GroupHeaderRow({
  workstream,
  taskCount,
  compact,
  showTeamSummary,
  onRename,
  onDelete,
}: {
  workstream: Workstream
  taskCount: number
  compact: boolean
  showTeamSummary: boolean
  onRename: (workstream: Workstream) => void
  onDelete: (workstream: Workstream) => void
}) {
  const { expandedGroups, toggleGroup, tasks } = usePMISStore()
  const group = workstream.id
  const isExpanded = expandedGroups.includes(group)
  const WorkstreamIcon = workstreamIcons[group] ?? Blocks
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
    <div
      data-row-key={`group-${group}`}
      className={cn(
        'flex w-full items-center border-b border-border transition-colors hover:bg-accent/30',
        compact ? 'pr-1' : 'pr-2'
      )}
      style={{ height: GROUP_HEADER_HEIGHT }}
    >
      <button
        type="button"
        className={cn('flex h-full min-w-0 flex-1 items-center', compact ? 'gap-1.5 px-2' : 'gap-2 px-3')}
        onClick={() => toggleGroup(group)}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        {compact ? (
          <span
            className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', workstream.color)}
            title={workstream.label}
            aria-label={workstream.label}
          >
            <WorkstreamIcon className="h-3.5 w-3.5" />
          </span>
        ) : (
          <Badge variant="secondary" className={cn('shrink-0 text-xs', workstream.color)}>
            {workstream.label}
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
        <span className="ml-auto flex shrink-0 items-center gap-2">
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
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Manage ${workstream.label}`}>
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onRename(workstream)}><Pencil className="h-4 w-4" /> Rename</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(workstream)}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function TaskListPanel({
  scrollTop,
  onVerticalScroll,
  onHide,
  panelWidth,
  bottomScrollPadding,
}: {
  scrollTop: number
  onVerticalScroll: (next: number) => void
  onHide: () => void
  panelWidth: number
  bottomScrollPadding: number
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const {
    tasks,
    getVisibleRows,
    createWorkstream,
    renameWorkstream,
    deleteWorkstream,
  } = usePMISStore()
  const [workstreamDialogMode, setWorkstreamDialogMode] = useState<'create' | 'rename' | null>(null)
  const [workstreamTarget, setWorkstreamTarget] = useState<Workstream | null>(null)
  const [workstreamName, setWorkstreamName] = useState('')
  const [workstreamError, setWorkstreamError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Workstream | null>(null)
  const visibleRows = getVisibleRows()
  const compact = panelWidth < 360
  const showTeamSummary = panelWidth >= 440
  const deleteTargetTaskCount = deleteTarget
    ? tasks.filter((task) => task.groupName === deleteTarget.id).length
    : 0

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    if (Math.abs(el.scrollTop - scrollTop) > 1) {
      el.scrollTop = scrollTop
    }
  }, [scrollTop])

  const openCreateWorkstream = () => {
    setWorkstreamTarget(null)
    setWorkstreamName('')
    setWorkstreamError(null)
    setWorkstreamDialogMode('create')
  }

  const openRenameWorkstream = (workstream: Workstream) => {
    setWorkstreamTarget(workstream)
    setWorkstreamName(workstream.label)
    setWorkstreamError(null)
    setWorkstreamDialogMode('rename')
  }

  const saveWorkstream = () => {
    const result = workstreamDialogMode === 'rename' && workstreamTarget
      ? renameWorkstream(workstreamTarget.id, workstreamName)
      : createWorkstream(workstreamName)

    if (!result.ok) {
      setWorkstreamError(result.error)
      return
    }

    setWorkstreamDialogMode(null)
    setWorkstreamTarget(null)
    setWorkstreamName('')
    setWorkstreamError(null)
  }

  return (
    <>
      <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Panel header */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-border px-3"
        style={{ height: PROJECT_PANEL_TOOLBAR_HEIGHT }}
      >
        <h2 className="text-sm font-medium text-foreground">Tasks</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{tasks.length} total</span>
          <button
            type="button"
            onClick={openCreateWorkstream}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            aria-label="Add workstream"
            title="Add workstream"
          >
            <Plus className="h-4 w-4" />
          </button>
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
              workstream={row.workstream}
              taskCount={row.taskCount}
              compact={compact}
              showTeamSummary={showTeamSummary}
              onRename={openRenameWorkstream}
              onDelete={setDeleteTarget}
            />
          ) : (
            <div key={row.task.id} style={{ height: TASK_ROW_HEIGHT }}>
              <TaskRow task={row.task} compact={compact} />
            </div>
          )
        )}
        {bottomScrollPadding > 0 && <div aria-hidden="true" style={{ height: bottomScrollPadding }} />}
      </div>
      </div>

      <Dialog
        open={workstreamDialogMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setWorkstreamDialogMode(null)
            setWorkstreamError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{workstreamDialogMode === 'rename' ? 'Rename workstream' : 'New workstream'}</DialogTitle>
            <DialogDescription>
              Workstreams organize delivery lanes. They do not create task dependencies.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              saveWorkstream()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="workstream-name">Name</Label>
              <Input
                id="workstream-name"
                autoFocus
                value={workstreamName}
                onChange={(event) => setWorkstreamName(event.target.value)}
                placeholder="Example: Data Migration"
              />
            </div>
            {workstreamError && <p role="alert" className="text-sm text-destructive">{workstreamError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWorkstreamDialogMode(null)}>Cancel</Button>
              <Button type="submit">{workstreamDialogMode === 'rename' ? 'Save' : 'Create workstream'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetTaskCount > 0
                ? `This workstream contains ${deleteTargetTaskCount} task${deleteTargetTaskCount === 1 ? '' : 's'}. Reassign them before deleting the workstream.`
                : 'This removes the empty workstream from the current project view.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{deleteTargetTaskCount > 0 ? 'Close' : 'Cancel'}</AlertDialogCancel>
            {deleteTargetTaskCount === 0 && (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteTarget) deleteWorkstream(deleteTarget.id)
                  setDeleteTarget(null)
                }}
              >
                Delete workstream
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
