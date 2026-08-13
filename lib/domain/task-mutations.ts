import type { Task } from '../pmis-data'

export function collectRecursiveDependentIds(tasks: Task[], rootTaskId: string): Set<string> {
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const descendants = new Set<string>()
  const pending = [...(tasksById.get(rootTaskId)?.dependents ?? [])]

  while (pending.length > 0) {
    const taskId = pending.pop()!
    if (taskId === rootTaskId || descendants.has(taskId)) continue
    descendants.add(taskId)
    tasksById.get(taskId)?.dependents.forEach((dependentId) => pending.push(dependentId))
  }

  return descendants
}

export function removeTasksFromDependencyGraph(tasks: Task[], taskIds: ReadonlySet<string>): Task[] {
  return tasks
    .filter((task) => !taskIds.has(task.id))
    .map((task) => ({
      ...task,
      dependencies: task.dependencies.filter((taskId) => !taskIds.has(taskId)),
      dependents: task.dependents.filter((taskId) => !taskIds.has(taskId)),
    }))
}

export function wouldCreateTaskDependencyCycle(
  tasks: Task[],
  taskId: string,
  predecessorIds: string[],
): boolean {
  if (predecessorIds.includes(taskId)) return true

  const dependenciesByTaskId = new Map(
    tasks.map((task) => [task.id, task.id === taskId ? predecessorIds : task.dependencies]),
  )
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (candidateId: string): boolean => {
    if (visiting.has(candidateId)) return true
    if (visited.has(candidateId)) return false

    visiting.add(candidateId)
    for (const dependencyId of dependenciesByTaskId.get(candidateId) ?? []) {
      if (dependenciesByTaskId.has(dependencyId) && visit(dependencyId)) return true
    }
    visiting.delete(candidateId)
    visited.add(candidateId)
    return false
  }

  return tasks.some((task) => visit(task.id))
}
