import { describe, expect, it } from 'vitest'
import type { Task } from '../../lib/pmis-data'
import {
  collectRecursiveDependentIds,
  removeTasksFromDependencyGraph,
  wouldCreateTaskDependencyCycle,
} from '../../lib/domain/task-mutations'

function makeTask(id: string, dependencies: string[] = [], dependents: string[] = []): Task {
  return {
    id,
    name: id,
    description: '',
    group: 'frontend',
    groupName: 'delivery',
    teamName: 'frontend',
    status: 'todo',
    priority: 'medium',
    assignee: { id: 'u1', name: 'Alex Chen', avatar: '', initials: 'AC' },
    startDate: new Date('2026-08-01T00:00:00'),
    endDate: new Date('2026-08-02T00:00:00'),
    estimatedDays: 1,
    optimisticDays: 1,
    pessimisticDays: 2,
    dependencies,
    dependents,
    blockers: [],
    progress: 0,
    isMilestone: false,
    isCriticalPath: false,
    linkedChangeRequests: [],
    comments: [],
    riskLevel: 'low',
  }
}

const diamondGraph = [
  makeTask('a', [], ['b', 'c']),
  makeTask('b', ['a'], ['d']),
  makeTask('c', ['a'], ['d']),
  makeTask('d', ['b', 'c'], []),
]

describe('task dependency mutations', () => {
  it('collects recursive descendants once across converging dependency paths', () => {
    expect([...collectRecursiveDependentIds(diamondGraph, 'a')].sort()).toEqual(['b', 'c', 'd'])
  })

  it('removes tasks and cleans both directions of surviving dependency references', () => {
    const result = removeTasksFromDependencyGraph(diamondGraph, new Set(['b', 'd']))

    expect(result.map((task) => task.id)).toEqual(['a', 'c'])
    expect(result.find((task) => task.id === 'a')?.dependents).toEqual(['c'])
    expect(result.find((task) => task.id === 'c')?.dependencies).toEqual(['a'])
    expect(result.find((task) => task.id === 'c')?.dependents).toEqual([])
  })

  it('rejects an edited predecessor relation that closes a cycle', () => {
    expect(wouldCreateTaskDependencyCycle(diamondGraph, 'a', ['d'])).toBe(true)
    expect(wouldCreateTaskDependencyCycle(diamondGraph, 'd', ['a'])).toBe(false)
  })
})
