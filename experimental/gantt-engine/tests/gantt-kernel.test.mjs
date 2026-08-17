import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createTaskGraph,
  dependencyEdges,
  normalizeTasks,
} from '../src/model.js'
import {
  ALL_WEEKDAYS,
  BAR_HEIGHT,
  BAR_PADDING,
  GROUP_HEADER_HEIGHT,
  HEADER_HEIGHT,
  SCALES,
  TASK_ROW_HEIGHT,
  buildVisibleDates,
  buildVisibleRows,
  calendarDaysBetween,
  computeTaskPositions,
  computeTimelineRange,
  dateToX,
  normalizeTimelineBoundary,
  shiftByVisibleUnits,
  snapPixelDelta,
  visibleUnitsBetween,
  xToDate,
} from '../src/timeline.js'
import {
  DEPENDENCY_ELBOW_GAP,
  DEPENDENCY_PARENT_EXIT_GAP,
  DEPENDENCY_TOP_GAP,
  DEPENDENCY_TOP_INSET,
  routeDependency,
  selectVisibleDependencies,
} from '../src/dependencies.js'
import {
  applyForwardOnlyScheduleChange,
  calculateDraggedTaskDates,
  latestPredecessorEnd,
} from '../src/scheduling.js'
import {
  calculateForecast,
  expectedDuration,
} from '../src/forecast.js'

function localDate(day, hour = 0, month = 0, year = 2025) {
  return new Date(year, month, day, hour, 0, 0, 0)
}

function task(id, startDay, endDay, options = {}) {
  const dependencies = options.dependencies ?? options.predecessorIds ?? []
  return {
    id,
    name: options.name ?? id,
    groupName: options.groupName ?? 'delivery',
    startDate: localDate(startDay),
    endDate: localDate(endDay),
    dependencies,
    dependents: options.dependents ?? [],
    optimisticDays: options.optimisticDays ?? 1,
    estimatedDays: options.estimatedDays ?? options.mostLikelyDays ?? 1,
    pessimisticDays: options.pessimisticDays ?? 1,
    isCriticalPath: options.isCriticalPath ?? false,
    ...options.extra,
  }
}

function edgeNames(edges) {
  return edges.map((edge) => `${edge.fromTaskId}->${edge.toTaskId}`).sort()
}

function datesOf(tasks) {
  return Object.fromEntries(tasks.map((item) => [item.id, [
    item.startDate.getTime(),
    item.endDate.getTime(),
  ]]))
}

test('model normalizes both PMIS shapes and derives dependents from canonical predecessors', () => {
  const sourceStart = localDate(1)
  const source = [
    {
      ...task('foundation', 1, 3, {
        groupName: 'platform',
        dependents: ['stale-dependent'],
      }),
      startDate: sourceStart,
    },
    task('cross-workstream', 3, 5, {
      groupName: 'quality',
      dependencies: ['foundation'],
      dependents: ['also-stale'],
    }),
    {
      id: 'release',
      title: 'Release',
      workstreamId: 'operations',
      dates: { start: localDate(5), end: localDate(6) },
      predecessorIds: ['cross-workstream'],
      optimisticDays: 1,
      mostLikelyDays: 1,
      pessimisticDays: 1,
    },
  ]

  const normalized = normalizeTasks(source)
  assert.deepEqual(normalized[0].dependents, ['cross-workstream'])
  assert.deepEqual(normalized[1].predecessorIds, ['foundation'])
  assert.deepEqual(normalized[1].dependencies, ['foundation'])
  assert.deepEqual(normalized[1].dependents, ['release'])
  assert.equal(normalized[1].groupName, 'quality')
  assert.equal(normalized[2].groupName, 'operations')
  assert.equal(normalized[2].name, 'Release')
  assert.equal(normalized[2].estimatedDays, 1)
  assert.notStrictEqual(normalized[0].startDate, sourceStart)
  assert.equal(source[0].dependents[0], 'stale-dependent')
  assert.ok(Object.isFrozen(normalized))
  assert.ok(Object.isFrozen(normalized[0]))

  const graph = createTaskGraph(source)
  assert.deepEqual(graph.topologicalTaskIds, ['foundation', 'cross-workstream', 'release'])
  assert.deepEqual(edgeNames(dependencyEdges(source)), [
    'cross-workstream->release',
    'foundation->cross-workstream',
  ])
})

test('model rejects duplicate IDs, duplicate edges, self references, dangling IDs, and cycles', () => {
  assert.throws(() => normalizeTasks([task('a', 1, 2), task('a', 2, 3)]), /Duplicate task ID/)
  assert.throws(() => normalizeTasks([
    task('a', 1, 2),
    task('b', 2, 3, { dependencies: ['a', 'a'] }),
  ]), /duplicate predecessor/i)
  assert.throws(() => normalizeTasks([task('a', 1, 2, { dependencies: ['a'] })]), /depend on itself/)
  assert.throws(() => normalizeTasks([task('a', 1, 2, { dependencies: ['missing'] })]), /dangling predecessor/)
  assert.throws(() => normalizeTasks([
    task('a', 1, 2, { dependencies: ['b'] }),
    task('b', 2, 3, { dependencies: ['a'] }),
  ]), /Circular dependency/)
})

test('timeline exposes the accepted scale and row geometry constants', () => {
  assert.equal(SCALES.day.dayWidth, 60)
  assert.equal(SCALES.week.dayWidth, 32)
  assert.equal(SCALES.month.dayWidth, 20)
  assert.equal(GROUP_HEADER_HEIGHT, 40)
  assert.equal(TASK_ROW_HEIGHT, 36)
  assert.equal(HEADER_HEIGHT, 72)
  assert.equal(BAR_HEIGHT, 24)
  assert.equal(BAR_PADDING, 6)
})

test('visible weekday math compresses hidden weekends and supports half-day boundaries and snapping', () => {
  const weekdays = [1, 2, 3, 4, 5]
  const friday = localDate(3) // 2025-01-03
  const fridayNoon = localDate(3, 12)
  const monday = localDate(6)

  assert.equal(friday.getDay(), 5)
  assert.equal(monday.getDay(), 1)
  assert.equal(calendarDaysBetween(friday, monday), 3)
  assert.equal(visibleUnitsBetween(friday, fridayNoon, weekdays), 0.5)
  assert.equal(visibleUnitsBetween(friday, monday, weekdays), 1)
  assert.equal(visibleUnitsBetween(monday, friday, weekdays), -1)
  assert.equal(shiftByVisibleUnits(friday, 0.5, weekdays).getTime(), fridayNoon.getTime())
  assert.equal(shiftByVisibleUnits(friday, 1, weekdays).getTime(), monday.getTime())
  assert.equal(shiftByVisibleUnits(monday, -0.5, weekdays).getTime(), fridayNoon.getTime())
  assert.equal(snapPixelDelta(31, 'day', 'day'), 1)
  assert.equal(snapPixelDelta(20, 'day', 'half-day'), 0.5)

  const visibleDates = buildVisibleDates(friday, monday, weekdays)
  assert.deepEqual(visibleDates.map((date) => date.getDay()), [5, 1])
  assert.equal(normalizeTimelineBoundary(new Date(2025, 0, 3, 10, 30)).getHours(), 0)
  assert.equal(normalizeTimelineBoundary(fridayNoon).getHours(), 12)
  assert.throws(() => visibleUnitsBetween(friday, monday, []), /at least one weekday/)
})

test('row building keeps workstreams independent from dependency edges and positions rows and bars deterministically', () => {
  const tasks = [
    task('backend', 2, 4, { groupName: 'backend' }),
    task('qa', 4, 5, { groupName: 'qa', dependencies: ['backend'] }),
  ]
  const rows = buildVisibleRows(
    tasks,
    [{ id: 'qa', label: 'Quality' }, { id: 'backend', label: 'Backend' }],
    ['qa'],
  )

  assert.deepEqual(rows.map((row) => row.type === 'task' ? row.task.id : `group:${row.group}`), [
    'group:qa',
    'qa',
    'group:backend',
  ])
  assert.deepEqual(rows.map((row) => row.y), [0, 40, 76])
  assert.equal(rows[1].task.groupName, 'qa')
  assert.deepEqual(rows[1].task.predecessorIds, ['backend'])

  const positions = computeTaskPositions(rows, {
    rangeStart: localDate(1),
    scale: 'day',
    visibleWeekdays: ALL_WEEKDAYS,
  })
  assert.equal(positions.length, 1)
  assert.deepEqual(positions[0], {
    taskId: 'qa',
    x: 180,
    y: 118,
    width: 60,
    height: 24,
    rowY: 112,
    rowHeight: 36,
  })
  assert.equal(computeTaskPositions(rows, {
    rangeStart: localDate(1),
    scale: 'week',
  })[0].width, 32)
  assert.equal(computeTaskPositions(rows, {
    rangeStart: localDate(1),
    scale: 'month',
  })[0].width, 20)
  assert.equal(dateToX(localDate(4), localDate(1), 'week'), 96)
  assert.equal(xToDate(96, localDate(1), 'week').getTime(), localDate(4).getTime())

  const range = computeTimelineRange(tasks)
  assert.equal(range.minDate.getTime(), localDate(-5).getTime())
  assert.equal(range.maxDate.getTime(), localDate(95).getTime())
})

test('ungrouped tasks remain bare rows without a synthetic ungrouped workstream', () => {
  const tasks = [
    task('grouped', 2, 4, { groupName: 'delivery' }),
    task('free', 4, 5, { extra: { groupName: null, workstreamId: null } }),
  ]
  const rows = buildVisibleRows(tasks, [{ id: 'delivery', label: 'Delivery' }], ['delivery'])

  assert.deepEqual(rows.map((row) => row.type === 'group-header' ? `group:${row.group}` : row.task.id), [
    'group:delivery',
    'grouped',
    'free',
  ])
  assert.equal(rows.filter((row) => row.type === 'group-header').length, 1)
})

test('progressive dependency visibility handles default, hover, selection, all, critical, and hidden endpoints', () => {
  const tasks = [
    task('a', 1, 2, { isCriticalPath: true }),
    task('b', 2, 3, { dependencies: ['a'], isCriticalPath: true }),
    task('c', 3, 4, { dependencies: ['b'] }),
    task('side', 2, 4, { dependencies: ['a'] }),
  ]

  assert.deepEqual(selectVisibleDependencies({ tasks }), [])
  assert.deepEqual(edgeNames(selectVisibleDependencies({ tasks, hoveredTaskId: 'b' })), ['a->b', 'b->c'])
  assert.deepEqual(edgeNames(selectVisibleDependencies({ tasks, selectedTaskId: 'b' })), ['a->b', 'b->c'])
  assert.deepEqual(edgeNames(selectVisibleDependencies({ tasks, showAllDependencies: true })), [
    'a->b',
    'a->side',
    'b->c',
  ])
  assert.deepEqual(edgeNames(selectVisibleDependencies({ tasks, showCriticalPath: true })), ['a->b'])
  assert.deepEqual(edgeNames(selectVisibleDependencies({
    tasks,
    showAllDependencies: true,
    selectedTaskId: 'missing',
  })), ['a->b', 'a->side', 'b->c'])
  assert.deepEqual(edgeNames(selectVisibleDependencies({
    tasks,
    showAllDependencies: true,
    visibleTaskIds: ['a', 'b'],
  })), ['a->b'])
})

test('dependency routing produces continuous normal and cramped orthogonal paths with independent geometry', () => {
  assert.equal(DEPENDENCY_ELBOW_GAP, 18)
  assert.equal(DEPENDENCY_PARENT_EXIT_GAP, 4)
  assert.equal(DEPENDENCY_TOP_INSET, 4)
  assert.equal(DEPENDENCY_TOP_GAP, 3)

  const from = { x: 0, y: 100, width: 40, height: 24 }
  const normal = routeDependency(from, { x: 100, y: 150, width: 30, height: 24 })
  assert.equal(normal.route, 'left-entry')
  assert.equal(normal.path, 'M 40 112 H 70 V 162 H 100')
  assert.equal(normal.markerDirection, 'right')
  assert.equal(normal.solid, true)
  assert.equal(normal.strokeDasharray, 'none')
  assert.equal(normal.strokeDashoffset, 0)

  const cramped = routeDependency(from, { x: 60, y: 150, width: 30, height: 24 }, {
    elbowGap: 22,
    parentExitGap: 7,
    topInset: 11,
    topGap: 5,
  })
  assert.equal(cramped.route, 'top-entry')
  assert.equal(cramped.path, 'M 40 112 H 47 V 128 H 71 V 145')
  assert.equal(cramped.markerDirection, 'down')
  assert.deepEqual(cramped.geometry, {
    elbowGap: 22,
    parentExitGap: 7,
    topInset: 11,
    topGap: 5,
  })
})

test('drag calculations support day and half-day snapping and clamp a child to the latest direct predecessor', () => {
  const tasks = [
    task('first-parent', 1, 3),
    task('latest-parent', 1, 5),
    task('child', 6, 8, { dependencies: ['first-parent', 'latest-parent'] }),
  ]

  const childMove = calculateDraggedTaskDates({
    tasks,
    taskId: 'child',
    mode: 'move',
    pixelDelta: -600,
    scale: 'day',
    snapIncrement: 'day',
  })
  assert.equal(childMove.startDate.getTime(), localDate(5).getTime())
  assert.equal(childMove.endDate.getTime(), localDate(7).getTime())

  const childStartResize = calculateDraggedTaskDates({
    tasks,
    taskId: 'child',
    mode: 'resize-start',
    pixelDelta: -600,
    scale: 'day',
    snapIncrement: 'day',
  })
  assert.equal(childStartResize.startDate.getTime(), localDate(5).getTime())
  assert.equal(childStartResize.endDate.getTime(), localDate(8).getTime())

  const minimumEndResize = calculateDraggedTaskDates({
    tasks,
    taskId: 'first-parent',
    mode: 'resize-end',
    pixelDelta: -600,
    scale: 'day',
    snapIncrement: 'day',
  })
  assert.equal(minimumEndResize.startDate.getTime(), localDate(1).getTime())
  assert.equal(minimumEndResize.endDate.getTime(), localDate(2).getTime())

  const halfDayMove = calculateDraggedTaskDates({
    tasks,
    taskId: 'first-parent',
    mode: 'move',
    pixelDelta: 20,
    scale: 'day',
    snapIncrement: 'half-day',
  })
  assert.equal(halfDayMove.unitDelta, 0.5)
  assert.equal(halfDayMove.startDate.getTime(), localDate(1, 12).getTime())
  assert.equal(halfDayMove.endDate.getTime(), localDate(3, 12).getTime())

  const normalized = normalizeTasks(tasks)
  const lookup = new Map(normalized.map((item) => [item.id, item]))
  assert.equal(latestPredecessorEnd(lookup.get('child'), lookup).getTime(), localDate(5).getTime())
})

test('forward propagation pushes a recursive chain, preserves durations, and leaves unrelated tasks unchanged', () => {
  const source = [
    task('a', 1, 3, { dependents: [] }),
    task('b', 4, 6, { dependencies: ['a'], dependents: [] }),
    task('c', 7, 8, { dependencies: ['b'], dependents: [] }),
    task('unrelated', 2, 9, { groupName: 'another-workstream', extra: { note: 'unchanged' } }),
  ]
  const before = datesOf(source)

  const result = applyForwardOnlyScheduleChange(
    source,
    'a',
    { startDate: localDate(5), endDate: localDate(7) },
    { mode: 'move' },
  )
  const after = datesOf(result.tasks)

  assert.deepEqual(after.a, [localDate(5).getTime(), localDate(7).getTime()])
  assert.deepEqual(after.b, [localDate(7).getTime(), localDate(9).getTime()])
  assert.deepEqual(after.c, [localDate(9).getTime(), localDate(10).getTime()])
  assert.deepEqual(after.unrelated, before.unrelated)
  assert.equal(result.tasks.find((item) => item.id === 'unrelated').note, 'unchanged')
  assert.deepEqual(result.affectedTaskIds, ['a', 'b', 'c'])
  assert.deepEqual(result.effects.map((effect) => effect.cause), ['requested', 'propagated', 'propagated'])
  assert.deepEqual(source[0].dependents, [])
  assert.ok(Object.isFrozen(result))
  assert.ok(Object.isFrozen(result.tasks))
})

test('moving a predecessor earlier never pulls descendants backward', () => {
  const source = [
    task('a', 3, 5),
    task('b', 7, 9, { dependencies: ['a'] }),
    task('c', 10, 12, { dependencies: ['b'] }),
  ]
  const before = datesOf(source)
  const result = applyForwardOnlyScheduleChange(
    source,
    'a',
    { startDate: localDate(1), endDate: localDate(3) },
    { mode: 'move' },
  )
  const after = datesOf(result.tasks)
  assert.deepEqual(after.b, before.b)
  assert.deepEqual(after.c, before.c)
  assert.deepEqual(result.affectedTaskIds, ['a'])
})

test('direct edits and converging propagation use the latest of multiple predecessor ends', () => {
  const source = [
    task('edited-parent', 1, 4),
    task('later-parent', 1, 8),
    task('child', 5, 7, { dependencies: ['edited-parent', 'later-parent'] }),
  ]
  const result = applyForwardOnlyScheduleChange(
    source,
    'child',
    { startDate: localDate(2), endDate: localDate(4) },
    { mode: 'move' },
  )
  const child = result.tasks.find((item) => item.id === 'child')
  assert.equal(child.startDate.getTime(), localDate(8).getTime())
  assert.equal(child.endDate.getTime(), localDate(10).getTime())

  const converging = applyForwardOnlyScheduleChange(
    source,
    'edited-parent',
    { startDate: localDate(4), endDate: localDate(7) },
    { mode: 'move' },
  )
  const pushedChild = converging.tasks.find((item) => item.id === 'child')
  assert.equal(pushedChild.startDate.getTime(), localDate(8).getTime())
  assert.equal(pushedChild.endDate.getTime(), localDate(10).getTime())
})

test('PERT expected duration and CPM passes calculate earliest/latest dates, slack, and critical path', () => {
  assert.equal(expectedDuration({
    id: 'estimate',
    optimisticDays: 1,
    mostLikelyDays: 4,
    pessimisticDays: 7,
  }), 4)

  const projectStart = localDate(1)
  const forecastTasks = [
    task('a', 1, 2, {
      optimisticDays: 2,
      estimatedDays: 2,
      pessimisticDays: 2,
    }),
    task('b', 1, 2, {
      dependencies: ['a'],
      optimisticDays: 4,
      estimatedDays: 4,
      pessimisticDays: 4,
    }),
    task('c', 1, 2, {
      dependencies: ['a'],
      optimisticDays: 1,
      estimatedDays: 1,
      pessimisticDays: 1,
    }),
    task('d', 1, 2, {
      dependencies: ['b', 'c'],
      optimisticDays: 2,
      estimatedDays: 2,
      pessimisticDays: 2,
    }),
  ]
  const sourceDates = datesOf(forecastTasks)
  const forecast = calculateForecast({ id: 'revision-1', tasks: forecastTasks })
  const byId = new Map(forecast.tasks.map((item) => [item.taskId, item]))

  assert.equal(forecast.revisionId, 'revision-1')
  assert.equal(byId.get('a').earliestStart.getTime(), projectStart.getTime())
  assert.equal(byId.get('a').earliestFinish.getTime(), projectStart.getTime() + (2 * 86_400_000))
  assert.equal(byId.get('d').earliestFinish.getTime(), projectStart.getTime() + (8 * 86_400_000))
  assert.equal(forecast.projectFinish.getTime(), byId.get('d').earliestFinish.getTime())
  assert.equal(byId.get('c').slackDays, 3)
  assert.equal(byId.get('c').critical, false)
  assert.deepEqual(forecast.criticalTaskIds, ['a', 'b', 'd'])
  assert.deepEqual(datesOf(forecastTasks), sourceDates)
  assert.ok(Object.isFrozen(forecast.tasks))
})

test('forecast handles an empty project and reuses graph validation for malformed inputs', () => {
  const empty = calculateForecast({ id: 'empty', tasks: [] })
  assert.equal(empty.projectFinish, null)
  assert.deepEqual(empty.tasks, [])

  assert.throws(() => calculateForecast({
    id: 'dangling',
    tasks: [task('a', 1, 2, { dependencies: ['missing'] })],
  }), /dangling predecessor/)
})
