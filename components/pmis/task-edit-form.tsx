'use client'

import { useState } from 'react'
import { CalendarDays, GitBranch, Milestone, ShieldCheck } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  priorityConfig,
  statusConfig,
  teamConfig,
  teamMembers,
  type Priority,
  type Task,
  type TaskStatus,
  type TaskTeam,
} from '@/lib/pmis-data'
import { usePMISStore } from '@/lib/pmis-store'
import { cn } from '@/lib/utils'

const TEAM_IDS = Object.keys(teamConfig) as TaskTeam[]
const PRIORITY_IDS = Object.keys(priorityConfig) as Priority[]
const RISK_LEVELS: Task['riskLevel'][] = ['low', 'medium', 'high']

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromDateInputValue(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
}

export function TaskEditForm({
  task,
  formId,
  onSaved,
}: {
  task: Task
  formId: string
  onSaved: () => void
}) {
  const { tasks, workstreams, updateTask } = usePMISStore()
  const [name, setName] = useState(task.name)
  const [description, setDescription] = useState(task.description)
  const [startDate, setStartDate] = useState(toDateInputValue(task.startDate))
  const [endDate, setEndDate] = useState(toDateInputValue(task.endDate))
  const [workstreamId, setWorkstreamId] = useState(task.groupName)
  const [teamName, setTeamName] = useState<TaskTeam>(task.teamName)
  const [assigneeId, setAssigneeId] = useState(task.assignee.id)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [riskLevel, setRiskLevel] = useState<Task['riskLevel']>(task.riskLevel)
  const [optimisticDays, setOptimisticDays] = useState(String(task.optimisticDays))
  const [estimatedDays, setEstimatedDays] = useState(String(task.estimatedDays))
  const [pessimisticDays, setPessimisticDays] = useState(String(task.pessimisticDays))
  const [predecessorIds, setPredecessorIds] = useState([...task.dependencies])
  const [blockers, setBlockers] = useState(task.blockers.join('\n'))
  const [linkedChangeRequests, setLinkedChangeRequests] = useState(task.linkedChangeRequests.join('\n'))
  const [isMilestone, setIsMilestone] = useState(task.isMilestone)
  const [error, setError] = useState<string | null>(null)

  const statusIds: TaskStatus[] = task.actual?.confirmedAt
    ? ['done']
    : ['todo', 'in-progress', 'blocked']

  const submit = () => {
    const parsedStart = fromDateInputValue(startDate)
    const parsedEnd = fromDateInputValue(endDate)
    if (!parsedStart || !parsedEnd) {
      setError('Choose a valid start and end date.')
      return
    }

    const result = updateTask(task.id, {
      name,
      description,
      startDate: parsedStart,
      endDate: parsedEnd,
      workstreamId,
      teamName,
      assigneeId,
      status,
      priority,
      riskLevel,
      optimisticDays: Number(optimisticDays),
      estimatedDays: Number(estimatedDays),
      pessimisticDays: Number(pessimisticDays),
      predecessorIds,
      blockers: splitLines(blockers),
      linkedChangeRequests: splitLines(linkedChangeRequests),
      isMilestone,
    })

    if (!result.ok) {
      setError(result.error)
      return
    }
    onSaved()
  }

  return (
    <form
      id={formId}
      className="w-full min-w-0 space-y-5 p-4"
      onKeyDown={(event) => {
        if (event.key !== 'Tab' || event.shiftKey) return
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="combobox"]',
        ))
        if (focusable.at(-1) !== event.target) return
        const saveButton = document.getElementById(`task-save-${task.id}`)
        if (!saveButton) return
        event.preventDefault()
        saveButton.focus()
      }}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Edit user-authored task fields here. Calculated Forecast, completion confirmation, dependent links, comments, and history remain governed or derived.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-name`}>Title</Label>
        <Input id={`${formId}-name`} autoFocus value={name} onChange={(event) => setName(event.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-description`}>Description</Label>
        <Textarea id={`${formId}-description`} className="min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-medium"><CalendarDays className="h-4 w-4" /> Timeline</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-start`}>Start</Label>
            <Input id={`${formId}-start`} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-end`}>End</Label>
            <Input id={`${formId}-end`} type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Workstream</Label>
        <Select value={workstreamId} onValueChange={setWorkstreamId}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {workstreams.map((workstream) => <SelectItem key={workstream.id} value={workstream.id}>{workstream.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)} disabled={Boolean(task.actual?.confirmedAt)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusIds.map((id) => <SelectItem key={id} value={id}>{statusConfig[id].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_IDS.map((id) => <SelectItem key={id} value={id}>{priorityConfig[id].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Team</Label>
          <Select value={teamName} onValueChange={(value) => setTeamName(value as TaskTeam)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEAM_IDS.map((id) => <SelectItem key={id} value={id}>{teamConfig[id].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Assignee</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {teamMembers.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Risk level</Label>
        <Select value={riskLevel} onValueChange={(value) => setRiskLevel(value as Task['riskLevel'])}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RISK_LEVELS.map((level) => <SelectItem key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">PERT estimates</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-optimistic`} className="text-[11px]">Optimistic</Label>
            <Input id={`${formId}-optimistic`} type="number" min={1} step={1} value={optimisticDays} onChange={(event) => setOptimisticDays(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-likely`} className="text-[11px]">Most likely</Label>
            <Input id={`${formId}-likely`} type="number" min={1} step={1} value={estimatedDays} onChange={(event) => setEstimatedDays(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-pessimistic`} className="text-[11px]">Pessimistic</Label>
            <Input id={`${formId}-pessimistic`} type="number" min={1} step={1} value={pessimisticDays} onChange={(event) => setPessimisticDays(event.target.value)} />
          </div>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
        <Checkbox checked={isMilestone} onCheckedChange={(value) => setIsMilestone(value === true)} />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-medium"><Milestone className="h-3.5 w-3.5" /> Milestone</span>
          <span className="block text-xs text-muted-foreground">Show a milestone marker at this task’s end date.</span>
        </span>
      </label>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-sm font-medium"><GitBranch className="h-4 w-4" /> Predecessors</div>
        <p className="text-xs text-muted-foreground">The task start will be clamped to the latest selected predecessor end date.</p>
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {tasks.filter((candidate) => candidate.id !== task.id).map((candidate) => {
            const checked = predecessorIds.includes(candidate.id)
            return (
              <label key={candidate.id} className={cn('flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent/50')}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => setPredecessorIds((current) => value === true
                    ? Array.from(new Set([...current, candidate.id]))
                    : current.filter((id) => id !== candidate.id))}
                />
                <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-blockers`}>Blockers</Label>
        <Textarea id={`${formId}-blockers`} value={blockers} onChange={(event) => setBlockers(event.target.value)} placeholder="One blocker per line" />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-changes`}>Linked change requests</Label>
        <Textarea id={`${formId}-changes`} value={linkedChangeRequests} onChange={(event) => setLinkedChangeRequests(event.target.value)} placeholder="One change request per line" />
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  )
}
