# Experimental barebones vanilla Gantt engine

This package is the completed isolated implementation for PMIS migration tasks 005,
006, and the Year 0 interaction slice. It provides a framework-free DOM/SVG Gantt, a small event-oriented
application shell, and a clean adapter boundary for a future PHP host. The existing
React PMIS application is unchanged and remains the production implementation.

## Run it

Serve this directory with any static HTTP server and open `demo/index.html`. The
automated browser suite includes a dependency-free server, so the complete verification
gate is simply:

```powershell
cd experimental/gantt-engine
npm.cmd test
```

The package has no runtime dependencies. `@playwright/test` is the only development
dependency and is documented in [Bill of Manifest](./docs/BILL_OF_MANIFEST.md).

## What is implemented

- delegated button, form, and field actions backed by named commands;
- explicit view invalidation and coalesced refresh passes;
- cancellable microtask, animation-frame, timer, and async scheduling;
- a strict `Gateway` port with in-memory and future HTTP/PHP transports;
- React-aligned p3 workstream/task sidebar with 240 deterministic tasks,
  compact metadata, hover-revealed group actions, and an SVG day/week/month
  timeline;
- milestones, progress, selection, hover, collapse, and critical-path display;
- progressive dependency disclosure and adaptive continuous connector routes;
- move/start-resize/end-resize preview with one atomic commit;
- direct-predecessor clamps and recursive forward-only propagation;
- two-way vertical scroll sync and dynamic future-range extension/compaction;
- PERT expected duration and CPM earliest/latest/slack/critical calculations;
- editable task creation and renaming from the activity panel;
- scoped right-click task-bar creation and dependency connect/remove flows;
- swappable dark, light, and editorial visual themes;
- Node contract tests and real Chrome/Playwright interaction tests.

The right inspector, authoring dialogs, comments, labels, checklist, dashboard,
navigation, authentication, persistence, and React replacement are explicit non-goals.

## Navigate the codebase

| Area | Entry point | Responsibility |
| --- | --- | --- |
| Composition | `src/engine.js` | Engine state, commands, views, lifecycle, callbacks. |
| Mini-framework | `src/framework/index.mjs` | Commands, delegation, refresh, scheduling, application lifecycle. |
| Host bridge | `src/bridge/index.mjs` | Application-facing gateway and stable result contract. |
| Transport adapters | `src/bridge/transports.mjs` | In-memory demo/test adapter and future fetch/PHP adapter. |
| Pure Gantt kernel | `src/model.js`, `timeline.js`, `dependencies.js`, `scheduling.js`, `forecast.js` | Validation, geometry, routing, propagation, and forecast calculations. |
| Browser UI | `src/renderer.js`, `interaction.js`, `styles.css` | DOM/SVG paint and pointer/scroll/keyboard control. |
| Standalone host | `demo/index.html`, `demo/demo.js` | Deterministic fixture and injected in-memory gateway. |
| Verification | `tests/` | Framework, kernel, bridge, and browser behavior. |

Start with [Architecture](./docs/ARCHITECTURE.md), then read the
[PHP bridge contract](./docs/PHP_BRIDGE_CONTRACT.md) before adding a PHP endpoint.
The [theme and interaction contract](./docs/THEME_AND_INTERACTION_CONTRACT.md)
defines the Year 0 authoring and context-menu behavior.
The [spreadsheet layout contract](./docs/LAYOUT_CONTRACT.md) defines the settled
geometry, design-token seam, and sidebar/SVG alignment rules.
The [testing manual](./docs/TESTING.md) defines the clean-exit completion rule.

## Public engine boundary

```js
const engine = createGanttEngine({
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
  onScheduleCommit,
  onSelectionChange,
});

engine.start();
// engine.setTasks(nextTasks)
// engine.reloadSchedule()
// engine.getState()
// engine.getSnapshot()
// engine.dispose()
```

Concrete transports are selected only by the composition root. Renderer, interaction,
model, scheduling, dependency, and forecast modules must not import transport or PHP
details.

## Source documents

- [Task 005 migration plan](../../.agent/doc/migration/005-gantt-vanilla-migration.md)
- [Task 006 framework and integration goal](../../.agent/task/006-road-to-the-year-0.md)
- [Authoritative dependency rendering contract](../../.agent/doc/GANTT_DEPENDENCY_RENDERING.md)
