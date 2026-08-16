# React project-view layout contract

This document defines the settled presentation geometry for the isolated Gantt
engine. It is a presentation contract only: task grouping, dependency
selection, connector routing, scheduling, and gateway boundaries remain owned by
the existing engine modules.

## Geometry ownership

The values below have two consumers and must stay synchronized:

| Concern | JavaScript source | CSS token |
| --- | --- | --- |
| Top navigation | `demo/index.html` host layout | `--top-nav-height` |
| Project toolbar | `demo/index.html` center timeline host | `--project-toolbar-height` |
| Activity pane | host grid | `--activity-width` |
| Calendar header | `src/timeline.js` `HEADER_HEIGHT` | `--header-height` |
| Workstream row | `GROUP_HEADER_HEIGHT` | `--group-height` |
| Task row | `TASK_ROW_HEIGHT` | `--task-height` |
| Task bar | `BAR_HEIGHT` and `BAR_PADDING` | bar styling in `src/styles.css` |
| Week scale | `TIMELINE_SCALES.week.dayWidth` | no CSS equivalent; SVG geometry |

The engine uses the JavaScript constants when calculating SVG coordinates. CSS
uses the matching custom properties for the DOM task list and host layout. A
change to row or header geometry therefore requires a unit-test update and a
browser check for sidebar/SVG alignment.

## Settled values

- top navigation: 56px;
- project timeline toolbar: 48px;
- activity pane: 320px by default, responsive down to 280px;
- calendar header: 72px;
- workstream row: 40px;
- task row: 36px;
- task bar: 24px with 6px vertical inset;
- week scale: 32px per visible day;
- day scale: 60px per visible day;
- month scale: 20px per visible day.

The activity pane keeps React's Tasks header, task rows, workstream rows, and
team/status metadata. Dependency edges continue to render in the SVG layer and
remain progressively disclosed; grouping does not imply a dependency hierarchy.

## Sidebar interaction contract

- Workstream headers are composed rows: the chevron is the only collapse
  control, while add/manage affordances are revealed on hover or keyboard focus.
  This avoids the nested-button structure that made the earlier experiment look
  like one large grouped control.
- Task rows expose the React metadata contract: status dot, editable task name,
  assignee avatar, team badge, status badge, and dependency count. Team and
  status badges are retained in the DOM for wide panels but collapse at the
  compact activity-pane width so the task-name column remains readable.
- Sidebar hover state is shared with the SVG renderer. The hovered task row is
  painted as one full-width horizontal cue and does not alter dependency graph
  membership or schedule calculations.
- The experiment keeps `#application-status` and `#selection-status` in the DOM
  for the mini-framework's accessible status contract, but visually clips the
  experiment-only footer so it does not consume layout space absent from the
  React project view.
- Workstream creation, rename, and deletion are routed through the existing
  command/context-menu seam. Native prompt/confirm dialogs are the documented
  vanilla fallback for React's modal primitives; deleting a non-empty lane is
  rejected, matching the React guard.
- The isolated fixture now ports the React `p3` performance shape directly: 240
  tasks, five workstreams, deterministic assignees/teams/statuses, milestones,
  blockers, and forward-scheduled dependency dates. The renderer accepts the
  same fields when a host supplies another project payload.

The experiment uses vendored Lucide SVG path geometry for workstream/action
icons because it has no React icon package at runtime. The icon boxes, colors,
dimensions, and interaction states remain token-driven; replacing the local
path map with host-provided SVG icons is a visual asset substitution, not a
layout change. See the [Bill of Manifest](./BILL_OF_MANIFEST.md) for the source,
license, and replacement strategy.

## Theme and control behavior

The top navigation and center-only timeline toolbar follow the React project
view. Delegated controls remain available for scale selection, theme toggling,
dependency disclosure, horizontal scrolling, and schedule reload. The
`data-theme` attribute remains the extension point for light, dark, and editorial
palettes; layout tokens must not be duplicated inside theme rules.

## Change checklist

When adjusting this layout:

1. Change the named JavaScript geometry constant first when SVG coordinates are
   affected.
2. Update the matching CSS custom property in `src/styles.css`.
3. Update the geometry assertions in `tests/gantt-kernel.test.mjs`.
4. Run `npm.cmd test` from this directory and inspect the standalone demo at
   its root route.

Do not move dependency logic into CSS or couple the layout to a transport,
React, or a PHP endpoint.
