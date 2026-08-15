# Gantt engine migration plan — React to modern vanilla ES6

## Scope

This is a preparation package for a barebones Gantt engine. It does not modify the
React implementation and does not migrate the PMIS right inspector, top navigation,
dialogs, dashboard, or other application UI. The target contains only:

- a task-list sidebar with workstream/group headers;
- a timeline renderer;
- day/week/month scale changes;
- horizontal and vertical scrolling with row alignment;
- task selection and hover state;
- drag and start/end resize gestures;
- milestones, progress, and status colors;
- progressively disclosed dependency connectors;
- forward-only dependency schedule propagation;
- optional CPM/PERT calculation as an engine service.

## Implementation status (2026-08-15)

All 17 migration steps below are implemented in
`experimental/gantt-engine/`. Task 006 extended the original target with the smallest
event-oriented application shell needed for delegated commands, explicit view refresh,
cancellable scheduling, and a future PHP adapter boundary. This extension does not
change the migration's product scope or modify the React implementation.

Authoritative implementation guides:

- `experimental/gantt-engine/README.md` for entry points and operation;
- `experimental/gantt-engine/docs/ARCHITECTURE.md` for implemented module and lifecycle
  boundaries;
- `experimental/gantt-engine/docs/PHP_BRIDGE_CONTRACT.md` for the JS/PHP separation and
  wire protocol;
- `experimental/gantt-engine/docs/TESTING.md` for verification and process cleanup;
- `experimental/gantt-engine/docs/BILL_OF_MANIFEST.md` for the dependency inventory.

Verification completed cleanly on 2026-08-15: 45 Node tests and 6 installed-Chrome
Playwright scenarios passed, and the server/test processes exited without manual
termination. The implementation remains an isolated experiment; adopting it inside the
PMIS application requires a separate user-approved integration task.

## Evidence and current seams

| Concern | Current source | Extraction decision |
| --- | --- | --- |
| React composition and UI chrome | `components/pmis/gantt-chart.tsx` | Exclude from engine; replace with DOM mount points and callbacks. |
| Timeline constants and date math | `components/pmis/gantt-chart.tsx`, `lib/gantt-timeline.ts` | Move pure calculations into `experimental/gantt-engine/src/timeline.js`. |
| Connector route geometry | `components/pmis/gantt-chart.tsx`, `.agent/doc/GANTT_DEPENDENCY_RENDERING.md` | Preserve as a pure route function returning SVG path data. |
| Forward-only propagation | `lib/domain/scheduling.ts` | Port contract and behavior unchanged; use immutable plain objects. |
| Existing pointer preview | `components/pmis/gantt-chart.tsx` | Replace React refs/state with an interaction controller and one animation-frame preview. |
| Visible rows/group collapse | `lib/pmis-store.ts` | Reimplement as engine-owned view state; grouping remains independent of dependencies. |
| Zustand actions/history | `lib/pmis-store.ts` | Do not import. Expose `onScheduleCommit` and optional host-owned undo/redo callbacks. |
| Right-side inspector and authoring dialogs | React components/store | Explicitly out of scope. |

## Implemented architecture

```text
experimental/gantt-engine/
  README.md
  package.json
  src/
    engine.js          public orchestration and lifecycle
    model.js           normalization and ID indexes
    timeline.js        scales, dates, visible rows, coordinates
    dependencies.js    visibility selection and orthogonal routes
    scheduling.js      drag/resize constraints and propagation
    renderer.js        task-list DOM + SVG timeline rendering
    interaction.js     pointer/keyboard/scroll event controller
    forecast.js        PERT/CPM forecast calculations
    fixtures.js        deterministic standalone data
    styles.css
    framework/         commands, delegated actions, views, scheduler, lifecycle
    bridge/            gateway, protocol, serialization, cancellation, transports
  demo/
    index.html
    demo.js
  docs/
  tests/
```

The engine should render into two host elements (`taskList`, `timelineViewport`)
and own only the DOM below those elements. The host supplies task data and receives
committed date changes through a callback.

## Stable input contract

```js
createGanttEngine({
  root,
  taskListElement,
  timelineElement,
  statusElement,
  selectionStatusElement,
  taskCountElement,
  tasks,
  workstreams,
  gateway,
  settings,
  onScheduleCommit(nextTasks, effects),
  onSelectionChange(taskId),
});
```

Each task needs `id`, `name`, `groupName`, `status`, `progress`, `startDate`,
`endDate`, `dependencies`, `dependents`, and `isMilestone`. Dates may be ISO strings
at the boundary but must be normalized to `Date` objects internally. Dependencies are
graph edges, never visual grouping.

## Migration steps

1. Freeze a fixture snapshot from `lib/pmis-project-fixtures.ts`; do not import React,
   Zustand, Tailwind, Lucide, Radix, or Next from the experimental package.
2. Extract date and scale primitives from `lib/gantt-timeline.ts`: visible weekdays,
   day/week/month widths, boundary normalization, visible-unit offsets, and date labels.
3. Implement `normalizeTasks()` and ID maps. Validate missing IDs, dangling edges,
   duplicate dependencies, and cycles before rendering.
4. Implement `buildVisibleRows(tasks, workstreams, expandedWorkstreams, query)` with
   the existing group-header/task-row heights. Preserve workstream grouping separately
   from dependency traversal.
5. Implement `computeTimelineRange()` with seven days of past padding, ninety days of
   future padding, and 180-day extension when the right edge is reached. Shrink only
   after returning near the left edge and a short idle delay.
6. Implement `computeTaskPositions()` from visible rows and visible-unit offsets.
   Keep the header offset, bar height, minimum bar width, and row heights as named
   configuration values.
7. Implement `selectVisibleDependencies()` for default-none, hovered-direct,
   selected-upstream/downstream, all-edges, and critical-path modes. Build a task map
   once; avoid repeated linear `find()` calls.
8. Implement `routeDependency()` with the two existing orthogonal routes. Preserve
   independent constants for elbow clearance, parent exit, top inset, and top gap.
9. Implement SVG rendering in stable layers: grid, row backgrounds, dependency paths,
   bars, progress strips, labels, milestones, and resize handles. Use solid paths and
   `vector-effect: non-scaling-stroke`.
10. Implement the task-list DOM renderer using delegated events. Hover/select must use
    the same task IDs as the SVG bars.
11. Implement pointer gestures: move, resize-start, resize-end. Snap by configured
    visible units; clamp direct child edits to the latest predecessor end; preserve
    duration for moves and forward propagation.
12. Implement a frozen drag preview. Pointer moves update only a preview model scheduled
    through `requestAnimationFrame`; pointerup emits one atomic schedule commit.
13. Port `applyForwardOnlyScheduleChange()` from `lib/domain/scheduling.ts` into the
    engine package, or import a separately verified framework-free equivalent. Moving
    left must never pull descendants backward; recursion and multi-predecessor maximum
    end constraints must remain intact.
14. Add scroll synchronization between the task list and timeline body without putting
    scroll position in a React render cycle. Keep the calendar header sticky.
15. Add keyboard focus and Escape cancellation for active gestures. Add ARIA labels to
    task rows, bars, resize handles, and scale controls.
16. Add a minimal demo fixture and compare it against the React fixture at day/week/month
    scales, collapsed groups, long connectors, cramped connectors, milestones, and
    propagated drag previews.
17. Only after the experimental engine passes its checks should a future integration
    adapter be considered. This task does not authorize changing React files.

## Explicit non-goals

- right task inspector, task creation/edit/delete dialogs, labels, checklist, comments;
- dashboard, top navigation, project routing, auth, persistence, server actions;
- replacing the existing React Gantt or changing accepted PMIS behavior;
- canvas migration; the current dependency contract is SVG-path based;
- redesigning colors, layout architecture, or grouping semantics.

## Verification matrix

| Test | Expected result |
| --- | --- |
| Empty project | Empty task list/timeline without exceptions. |
| Collapsed workstream | Header remains; its tasks and bars disappear together. |
| Hover task | Only direct predecessor/dependent visible. |
| Select task | Full visible upstream/downstream chain visible. |
| Long edge | One continuous solid path to arrowhead. |
| Cramped edge | Above-entry route; no backward-looking arrow. |
| Parent moved right | Violated descendants push recursively, preserving durations. |
| Parent moved left | Descendants do not move backward. |
| Child moved left | Clamp to latest direct predecessor end. |
| Multiple predecessors | Latest predecessor end wins. |
| Resize | Minimum duration preserved; start resize obeys predecessor clamp. |
| Scroll/resize | Rows remain aligned; timeline width expands at right edge. |
| Scale switch | Dates, bars, labels, and connectors recompute consistently. |
| Critical mode | Critical bars/edges emphasized without changing task data. |

## Risks and decisions for the implementing agent

- The current UI task model uses `Date` values and the planning model uses nested
  `dates`; the adapter must choose one internal shape and document the conversion.
- Current fixture metadata contains `isCriticalPath`, while `lib/domain/forecast.ts`
  calculates CPM/PERT results. The barebones renderer may accept critical metadata,
  but calculated forecast integration must be a separate input adapter.
- The current Gantt includes creation context and UI notices. These must be omitted,
  not approximated with hidden application controls.
- Do not change the React implementation during this migration experiment.
