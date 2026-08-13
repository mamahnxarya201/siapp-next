'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CalendarClock, CheckCircle2, GitBranch, History, Loader2, Plus, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePMISStore } from '@/lib/pmis-store'
import { toActivePlan } from '@/lib/domain/pmis-adapter'
import type { ChangeRecord, PlanningRevision } from '@/lib/domain/planning-types'

type PlanningPanelProps = { open: boolean; onOpenChange: (open: boolean) => void }

const actionLabels: Record<string, string> = {
  task_created: 'Task created',
  task_updated: 'Task updated',
  task_scheduled: 'Task scheduled',
  task_status_changed: 'Task status changed',
  dependency_changed: 'Dependency changed',
  workstream_changed: 'Workstream changed',
  actual_progress_reported: 'Actual progress reported',
  completion_reported: 'Completion reported',
  completion_confirmed: 'Completion confirmed',
  task_change_proposed: 'Task change proposed',
  scenario_created: 'Scenario created',
  scenario_submitted: 'Scenario submitted',
  baseline_approved: 'Baseline approved',
  active_plan_activated: 'Active Plan activated',
  reconciliation_completed: 'Reconciliation completed',
}

function dateLabel(value: Date | string) {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function revisionLabel(revision: PlanningRevision) {
  if (revision.layer === 'scenario') return 'Scenario'
  if (revision.layer === 'approved-baseline') return 'Approved Baseline'
  return 'Active Plan'
}

export function PlanningPanel({ open, onOpenChange }: PlanningPanelProps) {
  const { currentProjectId, tasks, getCurrentForecast } = usePMISStore()
  const [records, setRecords] = useState<ChangeRecord[]>([])
  const [revisions, setRevisions] = useState<PlanningRevision[]>([])
  const [loading, setLoading] = useState(false)
  const [creatingScenario, setCreatingScenario] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const forecast = getCurrentForecast()

  const scenarios = useMemo(() => revisions.filter((revision) => revision.layer === 'scenario'), [revisions])
  const baselines = useMemo(() => revisions.filter((revision) => revision.layer === 'approved-baseline'), [revisions])
  const criticalCount = forecast?.tasks.filter((task) => task.critical).length ?? 0
  const projectFinish = forecast?.projectFinish

  useEffect(() => {
    if (!open || !currentProjectId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch(`/api/planning/history?projectId=${encodeURIComponent(currentProjectId)}`).then((response) => response.json()),
      fetch(`/api/planning/revisions?projectId=${encodeURIComponent(currentProjectId)}`).then((response) => response.json()),
    ]).then(([history, revisionData]) => {
      if (cancelled) return
      setRecords(history.records ?? [])
      setRevisions(revisionData.revisions ?? [])
    }).catch(() => {
      if (!cancelled) setMessage('Planning records could not be loaded.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [currentProjectId, open])

  async function createScenario() {
    if (!currentProjectId) return
    setCreatingScenario(true)
    setMessage(null)
    try {
      const response = await fetch('/api/planning/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_scenario',
          actorId: 'u1',
          revision: toActivePlan(currentProjectId, tasks),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Scenario creation failed.')
      setRevisions((current) => [...current, result])
      setMessage('Private Scenario created from the current Active Plan.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Scenario creation failed.')
    } finally {
      setCreatingScenario(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border pr-12">
          <SheetTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Planning intelligence</SheetTitle>
          <SheetDescription>
            Forecast, preserved history, and non-operational planning alternatives for the current Timeline.
          </SheetDescription>
        </SheetHeader>

        {!currentProjectId ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Open a project to inspect planning state.
          </div>
        ) : (
          <Tabs defaultValue="forecast" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border px-4 py-3">
              <TabsList className="grid h-auto w-full grid-cols-5">
                <TabsTrigger value="forecast" className="px-1 text-[11px]"><CalendarClock className="h-3.5 w-3.5" /> Forecast</TabsTrigger>
                <TabsTrigger value="history" className="px-1 text-[11px]"><History className="h-3.5 w-3.5" /> History</TabsTrigger>
                <TabsTrigger value="scenarios" className="px-1 text-[11px]"><GitBranch className="h-3.5 w-3.5" /> Scenarios</TabsTrigger>
                <TabsTrigger value="baselines" className="px-1 text-[11px]"><ShieldCheck className="h-3.5 w-3.5" /> Baselines</TabsTrigger>
                <TabsTrigger value="proposals" className="px-1 text-[11px]"><Send className="h-3.5 w-3.5" /> Proposals</TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <TabsContent value="forecast" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Forecast finish</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{projectFinish ? dateLabel(projectFinish) : '—'}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Critical tasks</p>
                    <p className="mt-1 text-lg font-semibold text-destructive">{criticalCount}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
                  Forecast is calculated from PERT duration estimates and dependency constraints. Editing supported task inputs recalculates it; the result is not manually overwritten.
                </div>
                <div className="space-y-2">
                  {forecast?.tasks.slice().sort((a, b) => a.slackDays - b.slackDays).slice(0, 8).map((task) => (
                    <div key={task.taskId} className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
                      <span className="truncate text-xs text-foreground">{tasks.find((candidate) => candidate.id === task.taskId)?.name ?? task.taskId}</span>
                      <Badge variant={task.critical ? 'destructive' : 'secondary'}>{task.critical ? 'Critical' : `${task.slackDays}d slack`}</Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0 space-y-3">
                <div className="flex items-center justify-between"><div><h3 className="text-sm font-medium">Change Records</h3><p className="text-xs text-muted-foreground">Read-only project activity grouped by initiating action.</p></div>{loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}</div>
                {records.length === 0 ? <EmptyState icon={History} title="No Change Records yet" description="Direct Timeline changes and planning lifecycle events will appear here." /> : records.slice().reverse().map((record) => <ChangeRecordCard key={record.id} record={record} />)}
              </TabsContent>

              <TabsContent value="scenarios" className="mt-0 space-y-4">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-medium">Private Scenarios</h3><p className="text-xs text-muted-foreground">Single-owner what-if plans. Shared scenarios remain read-only.</p></div><Button size="sm" onClick={createScenario} disabled={creatingScenario}><Plus className="h-3.5 w-3.5" />{creatingScenario ? 'Creating' : 'New Scenario'}</Button></div>
                {scenarios.length === 0 ? <EmptyState icon={GitBranch} title="No Scenarios" description="Create a private Scenario from the current Active Plan to explore an alternative." /> : scenarios.map((scenario) => <RevisionCard key={scenario.id} revision={scenario} />)}
              </TabsContent>

              <TabsContent value="baselines" className="mt-0 space-y-4">
                <div><h3 className="text-sm font-medium">Approved Baselines</h3><p className="text-xs text-muted-foreground">Immutable approved references. Only an Approved Baseline can become Active Plan.</p></div>
                {baselines.length === 0 ? <EmptyState icon={ShieldCheck} title="No Approved Baseline" description="A submitted Scenario will appear here after approval through the Project Authority Map." /> : baselines.map((baseline) => <RevisionCard key={baseline.id} revision={baseline} />)}
              </TabsContent>

              <TabsContent value="proposals" className="mt-0 space-y-4">
                <div><h3 className="text-sm font-medium">Task Change Proposals</h3><p className="text-xs text-muted-foreground">Bounded task-level forecast requests, separate from project Scenarios.</p></div>
                <EmptyState icon={Send} title="No pending proposals" description="Assignee date-change requests will be reviewed by the Project Manager or relevant supervisor." />
              </TabsContent>
            </div>
            {message && <div role="status" className="border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">{message}</div>}
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof History; title: string; description: string }) {
  return <div className="rounded-lg border border-dashed border-border p-6 text-center"><Icon className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-2 text-sm font-medium text-foreground">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>
}

function ChangeRecordCard({ record }: { record: ChangeRecord }) {
  return <div className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><span className="text-sm font-medium text-foreground">{actionLabels[record.action] ?? record.action}</span></div><span className="shrink-0 text-[10px] text-muted-foreground">{dateLabel(record.occurredAt)}</span></div><p className="mt-2 text-xs text-muted-foreground">{record.effects.length} direct effect{record.effects.length === 1 ? '' : 's'} · {record.automaticEffects.length} automatic effect{record.automaticEffects.length === 1 ? '' : 's'}</p></div>
}

function RevisionCard({ revision }: { revision: PlanningRevision }) {
  return <div className="rounded-lg border border-border p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-sm font-medium text-foreground">{revisionLabel(revision)}</p><p className="text-xs text-muted-foreground">Created {dateLabel(revision.createdAt)}</p></div><Badge variant="secondary">{revision.status}</Badge></div><Separator className="my-3" /><p className="text-xs text-muted-foreground">{revision.tasks.length} tasks · Owner {revision.ownerId}{revision.sourceRevisionId ? ` · Derived from ${revision.sourceRevisionId}` : ''}</p></div>
}
