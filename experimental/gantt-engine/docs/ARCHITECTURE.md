# Vanilla Gantt engine architecture

## Purpose and status

This document describes the implemented experimental engine in this directory.
It extends [the migration plan](../../../.agent/doc/migration/005-gantt-vanilla-migration.md)
with the actual framework, Gantt, bridge, and test boundaries delivered by task 006.

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
5. Attach task-list hover and two-way scroll synchronization listeners.

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
| `task.create` / `task.rename` | Create or rename a task through the activity panel. |
| `theme.set` | Apply the selected scoped visual theme. |
| `timeline.add-bar` | Create a one-snap-unit task at the context-menu date. |
| `dependency.begin-connect` / `dependency.remove` | Start a dependency preview or remove the selected edge. |

## View refresh contract

Three views are registered: `task-list`, `timeline`, and `status`.

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
- delayed work compacts an extended timeline after 260ms idle at the left edge;
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
task row, 24px task bar, and scale widths of 60/32/20 pixels.

The renderer owns the wireframe cell grid. `settings.grid` is normalized by
`src/grid.js` and controls vertical/horizontal line visibility, major-line visibility,
minor/major/row colors, and group/task fills. This keeps later user grid preferences
at a stable settings seam instead of scattering display decisions across SVG paint
code.

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

1. Pointer down identifies task and mode (`move`, `resize-start`, `resize-end`).
2. The controller freezes the committed task snapshot and gesture parameters.
3. Pointer moves save only the latest X coordinate.
4. One animation-frame job calculates snapped dates and forward propagation.
5. The engine stores the result as a preview and invalidates views.
6. Pointer up calculates the final result once, commits it atomically, recalculates
   criticality, and invokes the host callback/bridge.
7. Escape, blur, pointer cancellation, stop, or dispose cancels the preview.

Task-list and timeline scroll containers synchronize `scrollTop` through guarded DOM
writes. Horizontal timeline scrolling remains native. Near the right edge, the range
grows by 180 days behind a latch. Returning near the left edge schedules compaction to
the default 90-day future buffer.

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
