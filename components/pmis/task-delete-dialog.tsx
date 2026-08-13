'use client'

import { useEffect, useMemo, useState } from 'react'
import { GitBranch, Trash2 } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { collectRecursiveDependentIds } from '@/lib/domain/task-mutations'
import { usePMISStore } from '@/lib/pmis-store'

export function TaskDeleteDialog() {
  const {
    tasks,
    workstreams,
    taskDeleteTargetId,
    closeTaskDelete,
    deleteTask,
  } = usePMISStore()
  const [deleteDescendants, setDeleteDescendants] = useState(false)
  const [deleteWorkstream, setDeleteWorkstream] = useState(false)

  const task = tasks.find((candidate) => candidate.id === taskDeleteTargetId)
  const descendantIds = useMemo(
    () => taskDeleteTargetId
      ? collectRecursiveDependentIds(tasks, taskDeleteTargetId)
      : new Set<string>(),
    [taskDeleteTargetId, tasks],
  )
  const workstream = task
    ? workstreams.find((candidate) => candidate.id === task.groupName)
    : undefined
  const isOnlyTaskInWorkstream = task
    ? tasks.filter((candidate) => candidate.groupName === task.groupName).length === 1
    : false

  useEffect(() => {
    setDeleteDescendants(false)
    setDeleteWorkstream(false)
  }, [taskDeleteTargetId])

  if (!task) return null

  return (
    <AlertDialog
      open={taskDeleteTargetId !== null}
      onOpenChange={(open) => !open && closeTaskDelete()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{task.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The task will be removed from the Timeline. Surviving tasks will keep their dates, and references to deleted tasks will be removed from the dependency graph.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {(descendantIds.size > 0 || isOnlyTaskInWorkstream) && (
          <div className="space-y-3">
            {descendantIds.size > 0 && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                <Checkbox
                  checked={deleteDescendants}
                  onCheckedChange={(value) => setDeleteDescendants(value === true)}
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <GitBranch className="h-3.5 w-3.5" />
                    Delete dependent descendants too
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Also delete {descendantIds.size} recursively dependent task{descendantIds.size === 1 ? '' : 's'}.
                  </span>
                </span>
              </label>
            )}

            {isOnlyTaskInWorkstream && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                <Checkbox
                  checked={deleteWorkstream}
                  onCheckedChange={(value) => setDeleteWorkstream(value === true)}
                />
                <span>
                  <span className="text-sm font-medium text-foreground">Delete the empty workstream too</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Remove {workstream?.label ?? task.groupName} after its only task is deleted.
                  </span>
                </span>
              </label>
            )}
          </div>
        )}

        <AlertDialogFooter className="flex-col sm:justify-start">
          <AlertDialogAction
            autoFocus
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => deleteTask(task.id, {
              deleteDescendants,
              deleteWorkstreamIfEmpty: deleteWorkstream,
            })}
          >
            <Trash2 className="h-4 w-4" />
            Delete task
          </AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
