'use client'

import { X, User, Calendar, Clock, GitBranch, AlertTriangle, MessageSquare, FileText, Link, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { usePMISStore } from '@/lib/pmis-store'
import { statusConfig, priorityConfig, teamConfig } from '@/lib/pmis-data'

export function ContextInspector({ width = 320 }: { width?: number }) {
  const {
    selectedTaskId,
    inspectorOpen,
    setInspectorOpen,
    selectTask,
    getTaskById,
    getTaskDependencies,
    getTaskDependents,
    getCurrentForecast,
    reportTaskCompletion,
    confirmTaskCompletion,
    workstreams,
  } = usePMISStore()

  if (!inspectorOpen || !selectedTaskId) {
    return null
  }

  const task = getTaskById(selectedTaskId)
  if (!task) return null

  const dependencies = getTaskDependencies(selectedTaskId)
  const dependents = getTaskDependents(selectedTaskId)
  const statusCfg = statusConfig[task.status]
  const priorityCfg = priorityConfig[task.priority]
  const groupCfg = workstreams.find((workstream) => workstream.id === task.groupName)
    ?? { label: task.groupName, color: 'bg-muted text-muted-foreground' }
  const teamCfg = teamConfig[task.teamName]

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const daysBetween = (date1: Date, date2: Date) => {
    const oneDay = 24 * 60 * 60 * 1000
    return Math.round((date2.getTime() - date1.getTime()) / oneDay)
  }

  const duration = daysBetween(task.startDate, task.endDate)
  const forecast = getCurrentForecast()?.tasks.find((candidate) => candidate.taskId === task.id)
  const completionReported = Boolean(task.actual?.reportedCompletionAt)
  const completionConfirmed = Boolean(task.actual?.confirmedAt)

  return (
    <div
      className="flex h-full flex-col border-l border-border bg-card"
      style={{ width, minWidth: width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">Task Details</h3>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7"
          onClick={() => {
            selectTask(null)
            setInspectorOpen(false)
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea
        className="min-w-0 flex-1"
        viewportClassName="[&>div]:!block [&>div]:!w-full [&>div]:!min-w-0"
      >
        <div className="w-full min-w-0 max-w-full space-y-6 overflow-hidden p-4">
          {/* Title and status */}
          <div className="space-y-3">
            <div className="flex min-w-0 items-start gap-2">
              {task.isMilestone && (
                <span className="mt-0.5 text-milestone">◆</span>
              )}
              <h2 className="min-w-0 flex-1 break-words text-base font-semibold leading-tight text-foreground">
                {task.name}
              </h2>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className={cn(statusCfg.bgColor, statusCfg.color)}>
                {statusCfg.label}
              </Badge>
              <Badge variant="secondary" className={cn('text-xs', groupCfg.color)}>
                {groupCfg.label}
              </Badge>
              <Badge variant="secondary" className={cn('text-xs', teamCfg.color)}>
                {teamCfg.label}
              </Badge>
              <Badge variant="outline" className={priorityCfg.color}>
                {priorityCfg.label}
              </Badge>
              {task.isCriticalPath && (
                <Badge variant="destructive" className="text-xs">
                  Critical Path
                </Badge>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {task.description}
            </p>
          </div>

          <Separator />

          {/* Assignee */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>Assignee</span>
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                  {task.assignee.initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground">{task.assignee.name}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Timeline</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Start</span>
                <p className="text-foreground">{formatDate(task.startDate)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">End</span>
                <p className="text-foreground">{formatDate(task.endDate)}</p>
              </div>
            </div>
          </div>

          {/* Duration estimates */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Duration Estimates</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-success/10 p-2 text-center">
                <span className="text-[10px] text-muted-foreground">Optimistic</span>
                <p className="text-sm font-medium text-success">{task.optimisticDays}d</p>
              </div>
              <div className="rounded-lg bg-info/10 p-2 text-center">
                <span className="text-[10px] text-muted-foreground">Estimated</span>
                <p className="text-sm font-medium text-info">{task.estimatedDays}d</p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-2 text-center">
                <span className="text-[10px] text-muted-foreground">Pessimistic</span>
                <p className="text-sm font-medium text-destructive">{task.pessimisticDays}d</p>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="text-xs font-medium text-foreground">{task.progress}%</span>
            </div>
            <Progress value={task.progress} className="h-2" />
          </div>

          {/* Calculated forecast */}
          {forecast && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span>Calculated Forecast</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Expected duration</span>
                  <p className="text-foreground">{forecast.expectedDurationDays.toFixed(1)}d</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Slack</span>
                  <p className={cn('text-foreground', forecast.critical && 'font-medium text-destructive')}>
                    {forecast.slackDays}d{forecast.critical ? ' · Critical' : ''}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Completion confirmation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Completion confirmation</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {completionConfirmed
                ? 'Completion confirmed by the task approver.'
                : completionReported
                  ? 'Completion reported by the assignee and awaiting approver confirmation.'
                  : 'The assignee must report completion before the approver can confirm it.'}
            </p>
            <div className="flex gap-2">
              {!completionReported && task.assignee.id === 'u1' && (
                <Button size="sm" variant="outline" onClick={() => reportTaskCompletion(task.id, 'u1')}>
                  Report done
                </Button>
              )}
              {completionReported && !completionConfirmed && task.approverId === 'u1' && (
                <Button size="sm" onClick={() => confirmTaskCompletion(task.id, 'u1')}>
                  Confirm done
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Dependencies */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              <span>Dependencies</span>
            </div>
            
            {dependencies.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground uppercase">Depends on</span>
                {dependencies.map(dep => (
                  <button
                    key={dep.id}
                    className="flex w-full items-center gap-2 rounded-md bg-secondary/50 px-2 py-1.5 text-left hover:bg-secondary transition-colors"
                    onClick={() => selectTask(dep.id)}
                  >
                    <div className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      dep.status === 'done' && 'bg-success',
                      dep.status === 'in-progress' && 'bg-info',
                      dep.status === 'blocked' && 'bg-destructive',
                      dep.status === 'todo' && 'bg-muted-foreground'
                    )} />
                    <span className="text-xs text-foreground truncate">{dep.name}</span>
                  </button>
                ))}
              </div>
            )}
            
            {dependents.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground uppercase">Blocking</span>
                {dependents.map(dep => (
                  <button
                    key={dep.id}
                    className="flex w-full items-center gap-2 rounded-md bg-secondary/50 px-2 py-1.5 text-left hover:bg-secondary transition-colors"
                    onClick={() => selectTask(dep.id)}
                  >
                    <div className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      dep.status === 'done' && 'bg-success',
                      dep.status === 'in-progress' && 'bg-info',
                      dep.status === 'blocked' && 'bg-destructive',
                      dep.status === 'todo' && 'bg-muted-foreground'
                    )} />
                    <span className="text-xs text-foreground truncate">{dep.name}</span>
                  </button>
                ))}
              </div>
            )}

            {dependencies.length === 0 && dependents.length === 0 && (
              <p className="text-xs text-muted-foreground">No dependencies</p>
            )}
          </div>

          {/* Blockers */}
          {task.blockers.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Blockers</span>
                </div>
                {task.blockers.map((blocker, i) => (
                  <div 
                    key={i}
                    className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2"
                  >
                    <p className="text-xs text-destructive">{blocker}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Risk indicator */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Risk Level</span>
            </div>
            <Badge 
              variant="secondary" 
              className={cn(
                task.riskLevel === 'high' && 'bg-destructive/15 text-destructive',
                task.riskLevel === 'medium' && 'bg-warning/15 text-warning',
                task.riskLevel === 'low' && 'bg-success/15 text-success'
              )}
            >
              {task.riskLevel.charAt(0).toUpperCase() + task.riskLevel.slice(1)} Risk
            </Badge>
          </div>

          {/* Linked Change Requests */}
          {task.linkedChangeRequests.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Link className="h-3.5 w-3.5" />
                  <span>Change Requests</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {task.linkedChangeRequests.map(cr => (
                    <Badge key={cr} variant="outline" className="text-xs">
                      {cr}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Comments */}
          {task.comments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Comments ({task.comments.length})</span>
                </div>
                {task.comments.map(comment => (
                  <div key={comment.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="bg-secondary text-[8px]">
                          {comment.author.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-foreground">{comment.author}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(comment.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-7">{comment.text}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
