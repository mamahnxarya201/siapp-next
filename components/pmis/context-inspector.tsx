'use client'

import { User, Calendar, GitBranch, AlertTriangle, MessageSquare, Link, TrendingUp, Clock3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { usePMISStore } from '@/lib/pmis-store'
import { statusConfig, priorityConfig, workstreamConfig, teamConfig } from '@/lib/pmis-data'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </section>
  )
}

export function ContextInspector() {
  const {
    selectedTaskId,
    inspectorOpen,
    selectTask,
    tasks,
    projects,
    currentProjectId,
    getTaskById,
    getTaskDependencies,
    getTaskDependents,
  } = usePMISStore()

  if (!inspectorOpen) return null

  const currentProject = projects.find((p) => p.id === currentProjectId) ?? projects[0]
  const blockedTasks = tasks.filter((t) => t.status === 'blocked').length
  const criticalTasks = tasks.filter((t) => t.isCriticalPath && t.status !== 'done').length
  const pendingApprovals = currentProject?.pendingApprovals ?? 0
  const progress = currentProject?.progress ?? 0
  const health = currentProject?.healthScore ?? 0
  const finishForecast = tasks.reduce((max, t) => (t.endDate > max ? t.endDate : max), new Date())

  if (!selectedTaskId) {
    return (
      <div className="flex h-full w-full min-w-0 flex-col border-l border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium text-foreground">Project Insight</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground">Project Health</p>
            <p className="text-xl font-semibold text-foreground mt-1">{health}%</p>
            <Progress value={progress} className="h-2 mt-3" />
            <p className="text-[11px] text-muted-foreground mt-1">Progress {progress}%</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-secondary/40 p-2"><p className="text-muted-foreground">Blocked tasks</p><p className="text-foreground font-medium">{blockedTasks}</p></div>
            <div className="rounded-md bg-secondary/40 p-2"><p className="text-muted-foreground">Pending approvals</p><p className="text-foreground font-medium">{pendingApprovals}</p></div>
            <div className="rounded-md bg-secondary/40 p-2"><p className="text-muted-foreground">Critical path</p><p className="text-foreground font-medium">{criticalTasks}</p></div>
            <div className="rounded-md bg-secondary/40 p-2"><p className="text-muted-foreground">Finish forecast</p><p className="text-foreground font-medium">{finishForecast.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p></div>
          </div>
          <p className="text-xs text-muted-foreground">
            Select a task to inspect dependencies, PERT estimate, blockers, and change history.
          </p>
        </div>
      </div>
    )
  }

  const task = getTaskById(selectedTaskId)
  if (!task) return null

  const dependencies = getTaskDependencies(selectedTaskId)
  const dependents = getTaskDependents(selectedTaskId)
  const statusCfg = statusConfig[task.status]
  const priorityCfg = priorityConfig[task.priority]
  const groupCfg = workstreamConfig[task.groupName]
  const teamCfg = teamConfig[task.teamName]
  const pertExpected = Math.round(((task.optimisticDays + 4 * task.estimatedDays + task.pessimisticDays) / 6) * 10) / 10
  const pertVariance = Math.round((((task.pessimisticDays - task.optimisticDays) / 6) ** 2) * 100) / 100

  return (
    <div className="flex h-full w-full min-w-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">Task Inspector</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          <Section title="Task Summary">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                {task.isMilestone && <span className="text-amber-500 mt-0.5">◆</span>}
                <h2 className="text-base font-semibold text-foreground leading-tight line-clamp-2" title={task.name}>{task.name}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{task.description}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className={cn(statusCfg.bgColor, statusCfg.color)}>{statusCfg.label}</Badge>
                <Badge variant="secondary" className={cn('text-xs', groupCfg.color)}>{groupCfg.label}</Badge>
                <Badge variant="secondary" className={cn('text-xs', teamCfg.color)}>{teamCfg.label}</Badge>
                <Badge variant="outline" className={priorityCfg.color}>{priorityCfg.label}</Badge>
              </div>
            </div>
          </Section>

          <Separator />

          <Section title="Impact Summary">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-secondary/40 p-2"><p className="text-muted-foreground">Blocks</p><p className="text-foreground font-medium">{dependents.length} tasks</p></div>
              <div className="rounded-md bg-secondary/40 p-2"><p className="text-muted-foreground">Depends on</p><p className="text-foreground font-medium">{dependencies.length} tasks</p></div>
              <div className="rounded-md bg-secondary/40 p-2"><p className="text-muted-foreground">Progress</p><p className="text-foreground font-medium">{task.progress}%</p></div>
              <div className="rounded-md bg-secondary/40 p-2"><p className="text-muted-foreground">Critical</p><p className="text-foreground font-medium">{task.isCriticalPath ? 'Yes' : 'No'}</p></div>
            </div>
          </Section>

          <Separator />

          <Section title="PERT Estimate">
            <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-muted-foreground">Optimistic</p><p className="text-foreground font-medium">{task.optimisticDays}d</p></div>
                <div><p className="text-muted-foreground">Most likely</p><p className="text-foreground font-medium">{task.estimatedDays}d</p></div>
                <div><p className="text-muted-foreground">Pessimistic</p><p className="text-foreground font-medium">{task.pessimisticDays}d</p></div>
                <div><p className="text-muted-foreground">Expected</p><p className="text-blue-300 font-semibold">{pertExpected}d</p></div>
              </div>
              <p className="text-[10px] text-muted-foreground">Expected = (O + 4M + P) / 6 · Variance {pertVariance}</p>
            </div>
          </Section>

          <Separator />

          <Section title="Dependencies">
            <div className="space-y-2">
              {dependencies.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  <p className="text-[10px] text-muted-foreground uppercase">Depends on</p>
                  {dependencies.map((dep) => (
                    <button key={dep.id} className="flex w-full items-center gap-2 rounded-md bg-secondary/50 px-2 py-1.5 text-left hover:bg-secondary" onClick={() => selectTask(dep.id)}>
                      <GitBranch className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-foreground truncate">{dep.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {dependents.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  <p className="text-[10px] text-muted-foreground uppercase">Blocking</p>
                  {dependents.map((dep) => (
                    <button key={dep.id} className="flex w-full items-center gap-2 rounded-md bg-secondary/50 px-2 py-1.5 text-left hover:bg-secondary" onClick={() => selectTask(dep.id)}>
                      <GitBranch className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-foreground truncate">{dep.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {dependencies.length === 0 && dependents.length === 0 && <p className="text-xs text-muted-foreground">No dependencies</p>}
            </div>
          </Section>

          <Separator />

          <Section title="Risk & Blockers">
            <Badge
              variant="secondary"
              className={cn(
                task.riskLevel === 'high' && 'bg-red-500/20 text-red-400',
                task.riskLevel === 'medium' && 'bg-amber-500/20 text-amber-400',
                task.riskLevel === 'low' && 'bg-emerald-500/20 text-emerald-400'
              )}
            >
              {task.riskLevel.charAt(0).toUpperCase() + task.riskLevel.slice(1)} risk
            </Badge>
            {task.blockers.length > 0 ? (
              <div className="space-y-1.5 mt-2 max-h-28 overflow-y-auto pr-1">
                {task.blockers.map((blocker, i) => (
                  <div key={i} className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-300">
                    {blocker}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">No active blockers</p>
            )}
          </Section>

          <Separator />

          <Section title="Change Requests / Approvals">
            {task.linkedChangeRequests.length > 0 ? (
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {task.linkedChangeRequests.map((cr) => (
                  <Badge key={cr} variant="outline" className="text-xs">{cr}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No linked change requests.</p>
            )}
          </Section>

          <Separator />

          <Section title="Activity / Comments">
            {task.comments.length > 0 ? (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {task.comments.map((comment) => (
                  <div key={comment.id} className="rounded-md bg-secondary/30 p-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="bg-secondary text-[8px]">
                          {comment.author.split(' ').map((n) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-foreground">{comment.author}</span>
                      <span className="text-[10px] text-muted-foreground">{comment.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{comment.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            )}
          </Section>
        </div>
      </ScrollArea>
    </div>
  )
}
