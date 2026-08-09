# Gantt Drag and Resize Performance

## Status

Implemented and verified on 2026-08-09.

## Why this changed

The dense `API Gateway Migration` fixture contains 240 tasks and 487 dependency
edges. Previously, every snapped mouse movement updated the global Zustand task
array and recursively propagated dependent dates. That caused the task list,
Gantt bars, dependency connectors, and inspector subscribers to rerender during
the gesture. The same listener was also repeatedly recreated because its effect
depended on the changing task array.

Grid snapping was a contributing UX factor because small pointer movements can
remain within the same snap interval, but it was not the primary source of the
latency.

## What is implemented

`components/pmis/gantt-chart.tsx` now uses a preview-to-commit interaction:

1. Drag start captures a frozen task/date snapshot and displays a temporary SVG
   preview for the active bar.
2. A single window-level mouse listener remains attached for the component
   lifetime. It reads current actions through refs and schedules preview work at
   most once per animation frame.
3. Pointer movement updates only the isolated preview layer. It does not mutate
   the Zustand task collection or run recursive propagation against application
   state.
4. Pointer release calculates the final snapped dates, applies forward-only
   recursive propagation once, and commits the complete update through one
   `updateTaskDatesBatch` call.
5. The history transaction begins at release, after selection, so one completed
   gesture creates one undo entry and opening the inspector cannot resize the
   timeline during the gesture.
6. Window blur cancels the temporary preview and restores the original SVG
   element styling.

The preview layer is intentionally hybrid. React renders the preview component,
but the parent Gantt does not rerender on every pointer movement; the preview
component is updated through an imperative ref. The committed bars and
connectors remain React-owned, so the project does not need a second complete
SVG reconciliation engine.

Resize handles are 12px wide instead of 6px to make duration editing easier.
Connector task positions are also memoized once per task-position change rather
than rebuilding a full map for every dependency edge.

## Scheduling behavior preserved

- Grid snapping remains unchanged.
- Moving a predecessor can push dependents forward recursively.
- Moving a predecessor left never pulls dependents backward.
- Direct child movement and left-edge resizing remain clamped to the latest
  direct predecessor end date.
- Multiple predecessors are evaluated using the latest predecessor end date.
- Unrelated tasks remain unchanged.

The release calculation uses the frozen schedule captured at drag start. This
makes dragging right and then back left deterministic within one gesture and
avoids accumulating transient pushes from earlier pointer positions.

## Why the entire SVG was not made imperative

Directly mutating every committed SVG node would create two competing sources of
truth: React's task-derived attributes and manually assigned DOM attributes. It
would also require manual cleanup for labels, progress indicators, milestones,
resize handles, dependency connectors, project switches, cancellation, and
unmounting. The isolated preview layer keeps the high-frequency path cheap while
leaving committed rendering, lifecycle, and accessibility behavior under React.

## Verification

- Strict TypeScript check passed.
- Production build passed.
- `git diff --check` passed.
- On the 240-task/487-edge fixture, a stepped 160px drag completed in about
  0.73 seconds including pointer automation, compared with about 4.6 seconds
  before the change.
- End-resize completed in about 0.55 seconds and expanded a 32px bar to 128px.
- One undo restored the complete resize gesture atomically.
- Browser console reported no warnings or errors.

## Propagated preview extension

The preview layer now renders the full in-memory propagated update map, not only
the directly dragged bar. Affected descendant SVG groups are temporarily faded
and the preview layer draws their projected dates above them. The exact same
update map is committed once on release, so the release does not introduce a
second visual jump or a second propagation pass.
