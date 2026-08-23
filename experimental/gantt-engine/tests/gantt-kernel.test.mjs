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
  defaultRowOrder,
  normalizeTimelineBoundary,
  reconcileRowOrder,
  shiftByVisibleUnits,
  snapPixelDelta,
  visibleUnitsBetween,
  xToDate,
} from '../src/timeline.js'
import {
  dropBoundaries,
  reorderTaskToPointer,
  reorderWorkstreamToIndex,
} from '../src/reorder.js'
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
  GanttInteractionController,
  advanceAutoScrollVelocity,
} from '../src/interaction.js'
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
  assert.equal(snapPixelDelta(14, 'day', 'half-day'), 0)
  assert.equal(snapPixelDelta(15, 'day', 'half-day'), 0.5)
  assert.equal(snapPixelDelta(7, 'week', 'half-day'), 0)
  assert.equal(snapPixelDelta(8, 'week', 'half-day'), 0.5)
  assert.equal(snapPixelDelta(-7, 'week', 'half-day'), 0)
  assert.equal(snapPixelDelta(-8, 'week', 'half-day'), -0.5)
  assert.equal(snapPixelDelta(4, 'month', 'half-day'), 0)
  assert.equal(snapPixelDelta(5, 'month', 'half-day'), 0.5)
  assert.equal(
    xToDate(7, friday, 'week', ALL_WEEKDAYS, 'half-day').getTime(),
    friday.getTime(),
  )
  assert.equal(
    xToDate(16, friday, 'week', ALL_WEEKDAYS, 'half-day').getTime(),
    fridayNoon.getTime(),
  )

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

test('computeTimelineRange honors a stable minDate origin instead of re-anchoring to the earliest task', () => {
  const tasks = [
    task('backend', 2, 4, { groupName: 'backend' }),
    task('qa', 4, 5, { groupName: 'qa', dependencies: ['backend'] }),
  ]
  const anchored = computeTimelineRange(tasks, {
    minDate: localDate(0),
    pastDays: 7,
    futureDays: 90,
  })
  // The supplied origin is kept (not recomputed to earliest - 7 = localDate(-5)).
  assert.equal(anchored.minDate.getTime(), localDate(0).getTime())
  // The right edge is still derived from the latest task's future buffer.
  assert.equal(anchored.maxDate.getTime(), localDate(95).getTime())
  const fixed = computeTimelineRange(tasks, {
    minDate: localDate(0),
    maxDate: localDate(40),
  })
  assert.equal(fixed.maxDate.getTime(), localDate(40).getTime())

  // A later origin is honored too; the caller is responsible for never moving
  // the stable origin right of any task (the engine only shrinks it leftward).
  const later = computeTimelineRange(tasks, { minDate: localDate(10) })
  assert.equal(later.minDate.getTime(), localDate(10).getTime())
  assert.equal(later.maxDate.getTime(), localDate(95).getTime())
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

test('autoscroll velocity uses elapsed time and pixel-per-second units', () => {
  const run = (frameMs) => {
    let velocity = 0;
    let heldMs = 0;
    let distance = 0;
    for (let elapsed = 0; elapsed < 900; elapsed += frameMs) {
      const delta = Math.min(frameMs, 900 - elapsed);
      heldMs += delta;
      velocity = advanceAutoScrollVelocity({
        velocity,
        direction: 1,
        penetration: 1,
        heldMs,
        deltaMs: delta,
      });
      distance += velocity * delta / 1000;
    }
    return { velocity, distance };
  };

  const at60Hz = run(1000 / 60);
  const at30Hz = run(1000 / 30);
  assert.ok(Math.abs(at60Hz.velocity - at30Hz.velocity) < 1);
  assert.ok(Math.abs(at60Hz.distance - at30Hz.distance) < 20);
  assert.ok(at60Hz.velocity > 0);
});

test('autoscroll reversal decelerates through zero before changing direction', () => {
  const slowing = advanceAutoScrollVelocity({
    velocity: 400,
    direction: -1,
    penetration: 1,
    heldMs: 900,
    deltaMs: 100,
  });
  const stopped = advanceAutoScrollVelocity({
    velocity: slowing,
    direction: -1,
    penetration: 1,
    heldMs: 900,
    deltaMs: 100,
  });
  const reversed = advanceAutoScrollVelocity({
    velocity: stopped,
    direction: -1,
    penetration: 1,
    heldMs: 900,
    deltaMs: 100,
  });
  assert.ok(slowing > 0);
  assert.equal(stopped, 0);
  assert.ok(reversed < 0);
});

test('drag preview reads the current viewport scroll instead of cached scroll delta', () => {
  const sourceTask = task('scroll-preview', 1, 3)
  const root = {
    scrollLeft: 60,
    scrollWidth: 600,
    clientWidth: 300,
  }
  let preview = null
  const controller = new GanttInteractionController({
    root,
    scheduler: {},
    getState: () => ({}),
    getSnapshot: () => null,
    onSelect: () => {},
    onHover: () => {},
    onPreview: (result) => {
      preview = result
    },
    onCommit: () => {},
  })
  controller.active = {
    kind: 'task',
    taskId: sourceTask.id,
    mode: 'resize-end',
    startClientX: 0,
    pendingClientX: 0,
    pendingClientY: 0,
    startScrollLeft: 0,
    scrollDelta: 0,
    tasks: [sourceTask],
    scale: 'day',
    snapIncrement: 'day',
    visibleWeekdays: ALL_WEEKDAYS,
  }

  controller.preview()

  assert.equal(preview.tasks[0].endDate.getTime(), localDate(4).getTime())
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

  const halfDayStartResize = calculateDraggedTaskDates({
    tasks,
    taskId: 'first-parent',
    mode: 'resize-start',
    pixelDelta: 30,
    scale: 'day',
    snapIncrement: 'half-day',
  })
  assert.equal(halfDayStartResize.unitDelta, 0.5)
  assert.equal(halfDayStartResize.startDate.getTime(), localDate(1, 12).getTime())
  assert.equal(halfDayStartResize.endDate.getTime(), localDate(3).getTime())

  const halfDayEndResize = calculateDraggedTaskDates({
    tasks,
    taskId: 'first-parent',
    mode: 'resize-end',
    pixelDelta: -30,
    scale: 'day',
    snapIncrement: 'half-day',
  })
  assert.equal(halfDayEndResize.unitDelta, -0.5)
  assert.equal(halfDayEndResize.startDate.getTime(), localDate(1).getTime())
  assert.equal(halfDayEndResize.endDate.getTime(), localDate(2, 12).getTime())

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

test('half-day propagation preserves durations through noon boundaries', () => {
  const source = [
    task('a', 1, 3),
    task('b', 3, 5, { dependencies: ['a'] }),
    task('c', 5, 6, { dependencies: ['b'] }),
  ]
  const result = applyForwardOnlyScheduleChange(
    source,
    'a',
    { startDate: localDate(1, 12), endDate: localDate(3, 12) },
    { mode: 'move', minimumDurationUnits: 0.5 },
  )
  const after = datesOf(result.tasks)
  assert.deepEqual(after.a, [localDate(1, 12).getTime(), localDate(3, 12).getTime()])
  assert.deepEqual(after.b, [localDate(3, 12).getTime(), localDate(5, 12).getTime()])
  assert.deepEqual(after.c, [localDate(5, 12).getTime(), localDate(6, 12).getTime()])
  assert.deepEqual(result.affectedTaskIds, ['a', 'b', 'c'])
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

test('defaultRowOrder seeds headers then date-sorted tasks, ungrouped last', () => {
  const tasks = [
    task('late', 6, 8, { groupName: 'beta' }),
    task('early', 1, 3, { groupName: 'beta' }),
    task('alpha-first', 2, 4, { groupName: 'alpha' }),
    task('free', 5, 7, { extra: { groupName: null, workstreamId: null } }),
  ]
  const order = defaultRowOrder(tasks, [
    { id: 'alpha', label: 'Alpha' },
    { id: 'beta', label: 'Beta' },
  ])
  assert.deepEqual(order, [
    { type: 'workstream', id: 'alpha' },
    { type: 'task', id: 'alpha-first' },
    { type: 'workstream', id: 'beta' },
    { type: 'task', id: 'early' },
    { type: 'task', id: 'late' },
    { type: 'task', id: 'free' },
  ])
})

test('buildVisibleRows with an explicit order preserves that sequence and skips collapsed tasks', () => {
  const tasks = [
    task('t1', 1, 3, { groupName: 'a' }),
    task('t2', 9, 11, { groupName: 'a' }),
    task('t3', 2, 4, { groupName: 'b' }),
  ]
  const order = [
    { type: 'workstream', id: 'a' },
    { type: 'task', id: 't2' },
    { type: 'task', id: 't1' },
    { type: 'workstream', id: 'b' },
    { type: 'task', id: 't3' },
  ]
  const rows = buildVisibleRows(
    tasks,
    [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    ['a', 'b'],
    '',
    order,
  )
  assert.deepEqual(
    rows.filter((row) => row.type === 'task').map((row) => row.task.id),
    ['t2', 't1', 't3'],
  )
  // Collapsing workstream a hides t1 and t2 but keeps the headers.
  const collapsedRows = buildVisibleRows(
    tasks,
    [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    ['b'],
    '',
    order,
  )
  assert.deepEqual(
    collapsedRows
      .filter((row) => row.type === 'task')
      .map((row) => row.task.id),
    ['t3'],
  )
  assert.deepEqual(
    collapsedRows.map((row) => row.type),
    ['group-header', 'group-header', 'task'],
  )
})

test('buildVisibleRows with order appends a task missing from the order under its header', () => {
  const tasks = [
    task('t1', 1, 3, { groupName: 'a' }),
    task('new-task', 2, 4, { groupName: 'a' }),
  ]
  const order = [
    { type: 'workstream', id: 'a' },
    { type: 'task', id: 't1' },
  ]
  const rows = buildVisibleRows(
    tasks,
    [{ id: 'a', label: 'A' }],
    ['a'],
    '',
    order,
  )
  assert.deepEqual(
    rows.filter((row) => row.type === 'task').map((row) => row.task.id),
    ['t1', 'new-task'],
  )
})

test('reconcileRowOrder drops removed items, appends new workstreams and tasks', () => {
  const order = [
    { type: 'workstream', id: 'a' },
    { type: 'task', id: 'gone' },
    { type: 'task', id: 'keep' },
    { type: 'workstream', id: 'old' },
  ]
  const reconciled = reconcileRowOrder(order, [
    task('keep', 1, 3, { groupName: 'a' }),
    task('brand-new', 2, 4, { groupName: 'new-ws' }),
  ], [
    { id: 'a', label: 'A' },
    { id: 'new-ws', label: 'New' },
  ])
  assert.deepEqual(reconciled.map((entry) => entry.id), [
    'a',
    'keep',
    'new-ws',
    'brand-new',
  ])
})

test('reorderTaskToPointer reassigns workstream and reorders rows', () => {
  const tasks = [
    task('t1', 1, 3, { groupName: 'a' }),
    task('t2', 1, 3, { groupName: 'a' }),
  ]
  const order = [
    { type: 'workstream', id: 'a' },
    { type: 'task', id: 't1' },
    { type: 'task', id: 't2' },
    { type: 'workstream', id: 'b' },
  ]
  const rows = [
    { type: 'group-header', group: 'a', y: 0, height: 40 },
    { type: 'task', task: tasks[0], y: 40, height: 36 },
    { type: 'task', task: tasks[1], y: 76, height: 36 },
    { type: 'group-header', group: 'b', y: 112, height: 40 },
  ]
  // Drop t2 on the b header -> joins workstream b at its top.
  const result = reorderTaskToPointer({
    order,
    tasks,
    rows,
    taskId: 't2',
    pointerY: 122,
    expanded: new Set(['a', 'b']),
  })
  assert.ok(result?.valid)
  assert.deepEqual(result.order.map((entry) => entry.id), [
    'a',
    't1',
    'b',
    't2',
  ])
  assert.equal(result.tasks.find((item) => item.id === 't2').groupName, 'b')
  assert.equal(result.insertionY, 112)
  assert.equal(result.targetGroup, 'b')
})

test('reorderTaskToPointer refuses a collapsed destination workstream', () => {
  const tasks = [
    task('t1', 1, 3, { groupName: 'a' }),
    task('t2', 1, 3, { groupName: 'a' }),
  ]
  const order = [
    { type: 'workstream', id: 'a' },
    { type: 'task', id: 't1' },
    { type: 'task', id: 't2' },
    { type: 'workstream', id: 'b' },
  ]
  const rows = [
    { type: 'group-header', group: 'a', y: 0, height: 40 },
    { type: 'task', task: tasks[0], y: 40, height: 36 },
    { type: 'task', task: tasks[1], y: 76, height: 36 },
    { type: 'group-header', group: 'b', y: 112, height: 40 },
  ]
  const result = reorderTaskToPointer({
    order,
    tasks,
    rows,
    taskId: 't2',
    pointerY: 122,
    expanded: new Set(['a']),
  })
  assert.equal(result, null)
})

test('reorderWorkstreamToIndex moves a whole workstream block', () => {
  const order = [
    { type: 'workstream', id: 'a' },
    { type: 'task', id: 'a1' },
    { type: 'workstream', id: 'b' },
    { type: 'task', id: 'b1' },
    { type: 'workstream', id: 'c' },
  ]
  const moved = reorderWorkstreamToIndex({
    order,
    workstreamId: 'a',
    targetBlockIndex: 2,
  })
  assert.deepEqual(moved.map((entry) => entry.id), [
    'b',
    'b1',
    'c',
    'a',
    'a1',
  ])
})
