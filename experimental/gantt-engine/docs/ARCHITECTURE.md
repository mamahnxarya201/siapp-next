# Vanilla Gantt engine architecture

## Purpose and status

This document describes the implemented experimental engine in this directory.
It extends the repository migration plan at
`../../../.agent/doc/migration/005-gantt-vanilla-migration.md` with the actual
framework, Gantt, bridge, and test boundaries delivered by task 006.

The implementation is isolated from the React PMIS application. No React, Zustand,
Next.js, Tailwind, Radix, or component-library code is imported. The experiment does
not include the dashboard, right inspector, task dialogs, comments, labels, checklist,
application routing, authentication, or persistence.

## Mental model for desktop-framework developers

| Desktop concept | Implemented equivalent |
| --- | --- |
| Form/application object | `src/engine.js` composition root |
| `Button.OnClick` / Qt slot | `data-action` routed by `ActionDelegator` |
| Command dispatcher | `CommandBus` |
| `Invalidate()` | `ViewHost.invalidate()` |
| `Update()` / paint pass | scheduled `ViewHost.refresh()` |
| `BeginInvoke()` / queued signal | `Scheduler.scheduleMicrotask()` |
| UI frame callback | `Scheduler.scheduleAnimationFrame()` |
| Timer | `Scheduler.scheduleDelay()` |
| Cancellable background operation | `Scheduler.scheduleAsync()` plus `AbortSignal` |
| Service interface | `Gateway.execute(operation, payload)` |
| Local service implementation | `InMemoryTransport` |
| Future PHP adapter | `FetchTransport` |
| Custom control paint | `renderer.js` DOM/SVG functions |

The control flow is event-oriented. A button click executes a named command. The
command changes application state and invalidates named views. The scheduler coalesces
invalidations, and each view refresh reads a new snapshot. No virtual DOM, component
reactivity, hooks, or transparent dependency tracking exists.

## Source tree

```text
experimental/gantt-engine/
  package.json                   local test commands; no runtime dependency
  playwright.config.mjs         Chrome project and temporary artifact location
  README.md                      operator entry point
  demo/
    index.html                   static application hosts and delegated controls
    demo.js                      composition root for the in-memory bridge
  docs/
    ARCHITECTURE.md              this file
    PHP_BRIDGE_CONTRACT.md       JS/PHP wire and responsibility contract
    TESTING.md                   verification strategy and commands
    BILL_OF_MANIFEST.md          dependency inventory and tradeoffs
    THEME_AND_INTERACTION_CONTRACT.md  Year 0 UI interaction and theme contract
  src/
    engine.js                    application state, commands, views, lifecycle
    interaction.js               pointer, keyboard, hover, and gesture lifecycle
    renderer.js                  task-list DOM and layered SVG rendering
    model.js                     task normalization and graph validation
    timeline.js                  calendar math, scales, rows, coordinates, range
    dependencies.js              progressive edge selection and connector routes
    grid.js                      normalized cell-grid presentation settings
    scheduling.js                drag/resize constraints and forward propagation
    reorder.js                   vertical row/workstream reorder geometry
    forecast.js                  PERT duration and CPM passes
    fixtures.js                  deterministic standalone demonstration data
    styles.css                   standalone visual and layout contract
    framework/
      action-delegator.mjs       one root listener for click/submit/change
      command-bus.mjs            named one-handler command registry
      mini-application.mjs       lifecycle and subsystem composition
      scheduler.mjs              cancellable queued/frame/timer/async jobs
      view-host.mjs              explicit invalidate/refresh and view registry
      index.mjs                  framework public surface
    bridge/
      index.mjs                  application-facing Gateway exports
      transports.mjs             composition-root-only concrete transports
      gateway.mjs                normalized operation execution
      protocol.mjs               request/response envelope validation
      serialization.mjs          strict JSON boundary and canonical payloads
      cancellation.mjs           timeout and caller cancellation composition
      errors.mjs                 stable error taxonomy
      in-memory-transport.mjs    deterministic demo/test handler adapter
      fetch-transport.mjs        future HTTP/PHP transport
  tests/
    framework.test.mjs           framework lifecycle and scheduling tests
    gantt-kernel.test.mjs        model/timeline/graph/schedule/forecast tests
    php-bridge.test.mjs          bridge and transport contract tests
    run-e2e.mjs                  owns server and Playwright process lifetimes
    static-server.mjs            dependency-free local test server
    e2e/gantt.spec.mjs           browser interaction scenarios
```

## Application lifecycle

`createGanttEngine()` validates all host elements, normalizes task input, calculates
initial CPM criticality, constructs `MiniApplication`, registers views and commands,
and returns an object with `start()`, `dispose()`, `reloadSchedule()`, `setTasks()`,
`getState()`, and `getSnapshot()`.

`start()` performs these operations in order:

1. Build the first immutable-style render snapshot.
2. Start the delegated action listeners.
3. Start all registered views; each queues its initial refresh.
4. Start timeline pointer and keyboard listeners.
5. Attach task-list hover listeners and the timeline's horizontal scroll listener.

`dispose()` cancels gesture work, removes every listener attached by the engine,
cancels delayed work, disposes views and commands, and rejects reuse. The engine does
not own or remove its host elements.

## Command delegation

Interactive HTML uses stable names such as:

```html
<button data-action="schedule.reload">Reload schedule</button>
<input type="radio" data-action="timeline.set-scale" value="week">
```

`ActionDelegator` installs exactly one listener for each supported browser event:

- `click` for buttons;
- `submit` for forms;
- `change` for inputs, selects, and textareas.

It walks from the event target to the root, finds the nearest supported element with
`data-action`, and executes the same-named command through `CommandBus`. The payload
contains `source`, the native `event`, `eventType`, action name, and root. The delegator
does not contain business rules or rendering calls.

Registered commands in `engine.js` are:

| Command | State/action consequence |
| --- | --- |
| `timeline.set-scale` | Set day/week/month and invalidate views. |
| `timeline.scroll-left` | Imperatively scroll the timeline 200px left. |
| `timeline.scroll-right` | Imperatively scroll the timeline 200px right. |
| `dependencies.toggle-all` | Enable or disable all visible dependency edges. |
| `dependencies.toggle-critical` | Enable or disable calculated critical emphasis. |
| `schedule.reload` | Schedule `Gateway.execute('schedule.load')`. |
| `workstream.toggle` | Change expansion without changing dependency graph. |
| `task.select` | Select the task and disclose its graph context. |
| `task.rename` | Rename a task through the activity panel. Task creation is context-menu only (`timeline.add-bar` / `task.create-workstream`). |
| `theme.set` | Apply the selected scoped visual theme. |
| `timeline.add-bar` | Create a one-snap-unit task at the context-menu date. |
| `dependency.begin-connect` / `dependency.remove` | Start a dependency preview or remove the selected edge. |
| `project.logo.open` / `project.logo.save` / `project.logo.cancel` | Open the project-logo dialog, commit the draft to the header, or discard it. |
| `project.logo.file` | Read the chosen image into the dialog crop preview via `FileReader`. |
| `project.name.edit` / `project.name.commit` | Swap the header project name to an inline textbox and commit the new name. |

The logo dialog is a hidden `<div>` host element inside the application root. It is
shown/hidden by the engine and owned directly by the composition root, in the same way
the context menu is. The dialog implements the crop preview with direct DOM writes
(pointer drag with `setPointerCapture`, wheel zoom) instead of full view refreshes so
gesture feedback stays snappy. Keyboard Tab is trapped inside the dialog and loops
Choose image → Save logo → Cancel.

## View refresh contract

Four views are registered: `task-list`, `timeline`, `status`, and `project-brand`.
`renderProjectBrand` replaces the descendants of `.project-top-nav__brand` only; it
renders the logo button (with the committed image or the fallback glyph) and the
project-name button or its editing textbox.

`invalidateAllViews(reason)` marks each dirty. `ViewHost` records reasons and schedules
one microtask. Repeated invalidations before that microtask are coalesced. `refresh()`
is explicit and runs the registered render function. A failed refresh remains dirty
but does not enter an automatic retry loop; the application error handler reports it.

The renderer owns descendants of `taskListElement` and `timelineElement` only. It may
replace those descendants during refresh, but it does not mutate application state,
execute commands, call the bridge, or apply scheduling rules.

## Scheduler contract

`Scheduler` is the only abstraction around queued work:

- microtasks coalesce view invalidation;
- animation frames throttle pointer previews;
- delayed work compacts an extended timeline after a 260ms idle period near the left edge for ordinary horizontal scrolling;
- task-release compaction removes unused outer date ranges after an expanded schedule drag;
- async jobs pass an `AbortSignal` to bridge operations.

Every returned job has cancellation and completion state. `MiniApplication.stop()` and
`dispose()` call `cancelAll()`. This makes asynchronous ownership visible to auditors
who expect queued calls, timers, or an explicit I/O scheduler.

## Gantt data and kernel boundaries

`model.js` accepts both current PMIS task fields and planning-record aliases. Internally:

- `dependencies` / `predecessorIds` are canonical predecessor IDs;
- `dependents` are derived during normalization;
- duplicate IDs, duplicate edges, self-edges, dangling IDs, invalid dates, and cycles
  are rejected before rendering;
- workstream IDs remain independent from graph edges.

`timeline.js` owns local-calendar day/noon boundaries, visible weekday compression,
day and half-day snapping, row construction, range calculation, and coordinates. It
preserves the PMIS geometry constants: 72px calendar header, 40px group header, 36px
task row, 24px task bar, and scale widths of 60/32/20 pixels. `computeTimelineRange`
accepts an optional `minDate` origin; when supplied it is kept verbatim instead of
being recomputed from the earliest task.

### Explicit row order

Row order is an explicit engine-owned concept, not a date-derived value.
`buildVisibleRows` accepts a flat `order` of `{ type: "workstream" | "task", id }`
entries that fully determines the row sequence: workstream headers, task order,
cross-workstream placement, and ungrouped rows. When `order` is omitted the function
falls back to the historical date-sort, so callers and tests that predate the order
model keep working unchanged.

`defaultRowOrder` seeds the initial order from the date-sort (headers first, then each
workstream's date-sorted tasks, ungrouped last), so a fresh engine matches the
previous deterministic layout. `reconcileRowOrder` keeps the order consistent as tasks
and workstreams are created, renamed, or deleted: it drops entries for removed items,
appends headers for new workstreams, and places new tasks after their owning header
(or as a bare row when ungrouped).

The engine stores the order on `state.rowOrder` and reconciles it on every
`replaceTasks` (task create/rename/delete, schedule load/replace) and on workstream
create/delete. Because rows come from the order rather than a date sort, a horizontal
drag that changes a task's date never re-ranks its row. `reloadSchedule` and
`setTasks` reseed the order from the replacement data's date-sort. A reorder commit
passes `rowOrder` through the existing commit/persist seam (alongside `tasks` and
`effects`) so a future persistence backend can store it without rework; in the current
in-memory demo the order is ephemeral.

`reorder.js` provides the vertical-reorder geometry: it maps a pointer row-Y over the
visible rows to a new flat order and the resulting per-task workstream. A task's
workstream is derived from its position in the order (the nearest preceding workstream
header), so dragging a bar across a header both reorders it and reassigns its group.
Dropping on an expanded header inserts into that workstream; dropping on a collapsed
header or in a collapsed block is rejected (only expanded workstreams are drop
targets); dropping below all groups makes the task ungrouped. `reorderWorkstreamToIndex`
moves a whole workstream block (header and its tasks) to reorder groups relative to
each other.

The engine keeps the timeline origin (`state.minDate`) stable during a drag preview.
It is seeded to the earliest task minus a 7-day past buffer. When a schedule-affecting
drag reaches the left low-water threshold, the controller prepends one viewport-sized
date chunk and preserves the visible pointer/date coordinate. It does not re-anchor the
origin once per snapped preview date.

On pointer release after range expansion, the engine trims only unused outer dates.
The retained scope spans the earliest task start and latest task end, but never becomes
narrower than the visible viewport. Left-edge releases align the scroll position to
zero; right-edge releases align it to the maximum scroll position. Internal empty gaps
and task-containing dates remain unchanged. `replaceTasks` (used by `reloadSchedule` and
`setTasks`) reseeds the origin from replacement data.

The renderer owns the wireframe cell grid. `settings.grid` is normalized by
`src/grid.js` and controls vertical/horizontal line visibility, major-line visibility,
minor/major/row colors, and group/task fills. This keeps later user grid preferences
at a stable settings seam instead of scattering display decisions across SVG paint
code. Horizontal row lines are drawn at row boundaries; an empty project (no rows)
falls back to the standard task-row pitch so the horizontal-grid toggle stays
visible on a bare canvas.

`dependencies.js` selects edges by precedence: all, selected chain, hovered direct,
critical path, then none. Hidden/collapsed endpoints are excluded. It returns one
continuous orthogonal route per edge. Normal routes enter the child from the left;
cramped routes enter from above. Elbow, parent-exit, top-inset, and top-gap values are
separate constants.

`scheduling.js` is pure. Dragging/resizing returns new tasks and before/after effects.
Direct child movement clamps to the latest direct predecessor end. Moving a predecessor
right pushes only violating descendants recursively and preserves their durations.
Moving a predecessor left never pulls descendants backward. Unrelated tasks retain
their dates and metadata.

`forecast.js` keeps PERT/CPM separate from drag propagation. It uses
`(optimistic + 4 * mostLikely + pessimistic) / 6`, then computes earliest/latest dates,
slack, project finish, and critical IDs.

## Pointer and scroll sequence

1. Pointer down identifies the target: a task bar (mode `move`, `resize-start`,
   `resize-end`) or a workstream group header (reorder).
2. The controller freezes the committed task snapshot, the current row order, the
   committed rows, and gesture parameters.
3. A `move` gesture is free: both axes apply simultaneously. The horizontal
   component changes the task date (with forward-only propagation) and the vertical
   component reorders the row and may reassign the workstream, all in the same drag.
   Resize gestures stay horizontal-only; a group-header drag is always a vertical
   workstream reorder.
4. Pointer moves save the latest X and the pointer row-Y.
5. Horizontal autoscroll: while a schedule-affecting task gesture (`move`,
   `resize-start`, or `resize-end`) is active, entering the 40px band inside
   either viewport edge starts one drag-owned animation loop. The target velocity
   combines elapsed dwell time and pointer penetration and is expressed in screen
   pixels per second across scales. Elapsed frame time integrates displacement.
   Reversal and neutral return decelerate through zero.
6. The same animation frame applies the scroll delta, reads the current
   `scrollLeft`, computes the snapped task preview, applies forward propagation,
   and invalidates views. This prevents pointer and viewport previews from using
   different coordinate snapshots.
7. When a left-edge drag reaches the low-water threshold, the engine prepends one
   viewport-sized date chunk. Scroll compensation preserves the visible date and
   pointer position. A latch prevents repeated per-frame expansion.
8. Pointer capture is held by the stable timeline viewport, not the task SVG node
   replaced during preview rendering. Pointer-cancel, lost capture, Escape, blur,
   stop, and dispose cancel the preview and stop the loop immediately.
9. The reorder preview renders a horizontal insertion line at the target row and
   highlights the destination workstream header. Group headers, dependency gestures,
   and scrollbar-thumb dragging do not auto-pan.
10. Pointer-up calculates the final result once and commits it atomically. If the
    drag expanded the range, release-only compaction trims unused outer dates,
    retains a viewport-sized minimum, and aligns the final scroll position with the
    release edge. Reorder commits update `state.rowOrder` and any reassigned
    workstream.

Horizontal scrolling is exposed through a custom `.timeline-hscroll` track and thumb
rendered under the grid because Chromium's `::-webkit-scrollbar` styling cannot show
only a horizontal native scrollbar. The `#timeline-viewport` remains the horizontal
scroll owner; its native scrollbar is hidden (`scrollbar-width: none`). The thumb
width and position mirror `timeline.scrollLeft`, `scrollWidth`, and `clientWidth`.

Clicking empty track space centers the thumb under the pointer. Pressing on the thumb
stores the pointer's grab offset and preserves it throughout the drag. The calendar
header is rendered in a sticky `.timeline-header-slot` and mirrors the timeline's
horizontal scroll position.

The `.gantt-scroll-region` is the only vertical scroll container. It contains the
task list and timeline columns, so both columns always use the same `scrollTop`.
The task list, timeline viewport, and timeline header do not own vertical scrolling.
The timeline renderer receives the shared viewport height and keeps row geometry in
the shared scroll coordinate system.
The timeline end date is state-owned. Task date changes do not change the rendered
range; edge scrolling extends the stored end date, and release compaction resets it
from the committed task dates while preserving a 20px viewport gap after the task
range when the compacted task span is shorter than the viewport.

The right edge grows the future range by 180 days behind a latch. The left edge grows
viewport-sized chunks at a low-water threshold during active schedule drags.
Release-only compaction trims unused outer dates while preserving task-containing dates,
internal gaps, and a minimum viewport-sized scope.

### Grid behavior and range ownership

The grid uses one vertical scroll owner and one horizontal scroll owner:

- `.gantt-scroll-region` owns vertical scrolling for the task list and timeline
  columns. The child panes keep `scrollTop` at zero, so a project with one task
  cannot expose an independent vertical grid scroll.
- `#timeline-viewport` owns horizontal scrolling. `.timeline-hscroll` controls
  its `scrollLeft`, and `.timeline-header-slot` mirrors that value for the sticky
  calendar header.

The engine stores the rendered end date in `state.timelineMaxDate`. Moving or
resizing a task changes the task preview, but it does not change the grid range.
The range changes only when an edge mechanic explicitly extends it or when
release compaction recalculates it from committed task dates. This separation
prevents the date grid from growing or shrinking as a side effect of ordinary
pointer movement.

On release, compaction calculates the occupied visible-day span and the minimum
viewport span. The minimum span is the timeline viewport width plus `20px`,
rounded up to a whole visible-day unit. If the task span is shorter, compaction
retains the remaining units after the task range. If the task span is already
longer than the viewport, compaction does not add artificial trailing range.
This keeps the viewport usable after a long bar is reduced.

## Bridge separation

Application commands may import `Gateway` from `bridge/index.mjs`. Only the composition
root may import concrete transports from `bridge/transports.mjs`. Renderer, interaction,
model, scheduling, and forecast modules do not import transport or PHP details.

The demo injects `InMemoryTransport`. A future PHP integration replaces only that
construction with `FetchTransport`; command names and view code remain unchanged. The
complete wire format, security boundary, cancellation, versioning, and idempotency
rules are in [PHP_BRIDGE_CONTRACT.md](./PHP_BRIDGE_CONTRACT.md).

## Deliberate limitations

- No general-purpose UI framework, dependency-injection container, virtual DOM,
  middleware chain, event sourcing, or persistent command log.
- No automatic fine-grained DOM diff. Three explicit view regions are small enough for
  replacement rendering; pointer previews are animation-frame coalesced.
- No actual PHP endpoint. The adapter and protocol exist for the later integration.
- No React adapter and no modification of the existing React implementation.
