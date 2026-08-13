'use client'

import { useEffect, useMemo, useState } from 'react'
import { Blocks, CalendarDays, GitBranch, Milestone, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { usePMISStore } from '@/lib/pmis-store'
import { teamConfig, teamMembers, type TaskTeam } from '@/lib/pmis-data'
import { cn } from '@/lib/utils'

const TEAM_IDS = Object.keys(teamConfig) as TaskTeam[]

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

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

function TaskRelationPicker({
  title,
  description,
  selectedIds,
  unavailableIds,
  onToggle,
}: {
  title: string
  description: string
  selectedIds: string[]
  unavailableIds: string[]
  onToggle: (taskId: string, checked: boolean) => void
}) {
  const tasks = usePMISStore((state) => state.tasks)

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div>
        <p className="text-xs font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
        {tasks.map((task) => {
          const checked = selectedIds.includes(task.id)
          const disabled = unavailableIds.includes(task.id)
          return (
            <label
              key={task.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/50',
                disabled && 'cursor-not-allowed opacity-45'
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={(value) => onToggle(task.id, value === true)}
              />
              <span className="min-w-0 flex-1 truncate">{task.name}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {task.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export function TaskCreateDialog() {
  const {
    taskCreateOpen,
    taskCreateDefaults,
    closeTaskCreate,
    createTask,
    createWorkstream,
    workstreams,
    projects,
    currentProjectId,
  } = usePMISStore()

  const today = useMemo(() => startOfLocalDay(new Date()), [])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(toDateInputValue(today))
  const [endDate, setEndDate] = useState(toDateInputValue(addLocalDays(today, 2)))
  const [workstreamId, setWorkstreamId] = useState('')
  const [teamName, setTeamName] = useState<TaskTeam>('frontend')
  const [assigneeId, setAssigneeId] = useState(teamMembers[0].id)
  const [predecessorIds, setPredecessorIds] = useState<string[]>([])
  const [dependentIds, setDependentIds] = useState<string[]>([])
  const [isMilestone, setIsMilestone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firstWorkstreamName, setFirstWorkstreamName] = useState('')
  const [workstreamError, setWorkstreamError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskCreateOpen) return
    const nextStart = startOfLocalDay(taskCreateDefaults.startDate ?? new Date())
    const nextEnd = startOfLocalDay(taskCreateDefaults.endDate ?? addLocalDays(nextStart, 2))

    setName('')
    setDescription('')
    setStartDate(toDateInputValue(nextStart))
    setEndDate(toDateInputValue(nextEnd > nextStart ? nextEnd : addLocalDays(nextStart, 1)))
    setWorkstreamId(
      workstreams.some((workstream) => workstream.id === taskCreateDefaults.workstreamId)
        ? taskCreateDefaults.workstreamId!
        : workstreams[0]?.id ?? ''
    )
    setTeamName('frontend')
    setAssigneeId(teamMembers[0].id)
    setPredecessorIds(taskCreateDefaults.predecessorIds ?? [])
    setDependentIds(taskCreateDefaults.dependentIds ?? [])
    setIsMilestone(taskCreateDefaults.isMilestone ?? false)
    setError(null)
    setFirstWorkstreamName('')
    setWorkstreamError(null)
  }, [taskCreateDefaults, taskCreateOpen, workstreams])

  const currentProject = projects.find((project) => project.id === currentProjectId) ?? projects[0]
  const selectedWorkstream = workstreams.find((workstream) => workstream.id === workstreamId)

  const toggleRelation = (
    taskId: string,
    checked: boolean,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((current) => checked
      ? Array.from(new Set([...current, taskId]))
      : current.filter((id) => id !== taskId))
  }

  const submit = () => {
    const parsedStart = fromDateInputValue(startDate)
    const parsedEnd = fromDateInputValue(endDate)
    if (!parsedStart || !parsedEnd) {
      setError('Choose a valid start and end date.')
      return
    }

    const result = createTask({
      name,
      description,
      startDate: parsedStart,
      endDate: parsedEnd,
      workstreamId,
      teamName,
      assigneeId,
      predecessorIds,
      dependentIds,
      isMilestone,
    })

    if (!result.ok) setError(result.error)
  }

  const createFirstWorkstream = () => {
    const result = createWorkstream(firstWorkstreamName)
    if (!result.ok) {
      setWorkstreamError(result.error)
      return
    }

    setWorkstreamId(result.id)
    setFirstWorkstreamName('')
    setWorkstreamError(null)
  }

  return (
    <Dialog open={taskCreateOpen} onOpenChange={(open) => !open && closeTaskCreate()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        {workstreams.length === 0 ? (
          <>
            <DialogHeader>
              <DialogTitle>Create a workstream first</DialogTitle>
              <DialogDescription>
                Every task must belong to a workstream. Create the first delivery lane, then this dialog will continue to task creation with it selected.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                createFirstWorkstream()
              }}
            >
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <Blocks className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Tasks stay grouped by delivery workstream</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Workstream membership organizes the Timeline and remains independent from task dependencies.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-workstream-name">Workstream name</Label>
                <Input
                  id="first-workstream-name"
                  autoFocus
                  value={firstWorkstreamName}
                  onChange={(event) => setFirstWorkstreamName(event.target.value)}
                  placeholder="Example: Delivery Foundation"
                />
              </div>
              {workstreamError && <p role="alert" className="text-sm text-destructive">{workstreamError}</p>}
              <DialogFooter className="flex-col sm:justify-start">
                <Button type="submit">Create workstream</Button>
                <Button type="button" variant="outline" onClick={closeTaskCreate}>Cancel</Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Create a scheduled task and place it in a workstream. Workstream membership remains separate from dependencies.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        >
          <div className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="text-foreground">{currentProject?.name ?? 'Project'}</span>
            <span className="px-1.5">›</span>
            <span className="text-foreground">{selectedWorkstream?.label ?? 'Choose workstream'}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-name">Title</Label>
            <Input
              id="task-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="What needs to be delivered?"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-start" className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Start date
              </Label>
              <Input id="task-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-end">End date</Label>
              <Input id="task-end" type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Workstream</Label>
              <Select value={workstreamId} onValueChange={setWorkstreamId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select workstream" /></SelectTrigger>
                <SelectContent>
                  {workstreams.map((workstream) => (
                    <SelectItem key={workstream.id} value={workstream.id}>{workstream.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Team</Label>
              <Select value={teamName} onValueChange={(value) => setTeamName(value as TaskTeam)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEAM_IDS.map((teamId) => <SelectItem key={teamId} value={teamId}>{teamConfig[teamId].label}</SelectItem>)}
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

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox checked={isMilestone} onCheckedChange={(value) => setIsMilestone(value === true)} />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium"><Milestone className="h-3.5 w-3.5" /> Mark as milestone</span>
              <span className="block text-xs text-muted-foreground">The milestone marker appears at this task’s end date.</span>
            </span>
          </label>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium"><GitBranch className="h-4 w-4" /> Dependency context</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TaskRelationPicker
                title="Predecessors"
                description="Tasks that must finish before this task starts."
                selectedIds={predecessorIds}
                unavailableIds={dependentIds}
                onToggle={(taskId, checked) => toggleRelation(taskId, checked, setPredecessorIds)}
              />
              <TaskRelationPicker
                title="Dependents"
                description="Existing tasks that this new task will block."
                selectedIds={dependentIds}
                unavailableIds={predecessorIds}
                onToggle={(taskId, checked) => toggleRelation(taskId, checked, setDependentIds)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Scope, acceptance notes, or delivery context"
              className="min-h-24"
            />
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="flex-col sm:justify-start">
            <Button type="submit">Create task</Button>
            <Button type="button" variant="outline" onClick={closeTaskCreate}>Cancel</Button>
          </DialogFooter>
        </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
