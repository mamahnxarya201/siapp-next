# PMIS Current State

Last updated: 2026-08-12

## Current Objective

Keep dense Gantt interactions responsive while preserving grid snapping,
dependency constraints, recursive forward-only propagation, and atomic undo/redo.

## Thesis Source Materials

- This repository implements the user's academic thesis project; thesis source material in the user's connected Google Drive is part of the PMIS project context.
- Use the newer Google Drive folder **Referensi Skripsi** (created May 2026) as the active reference collection: https://drive.google.com/drive/folders/1vTT8oYGGB3clhG7-MQbcIyas0bVjy4ij
- The working thesis Google Doc is **skripsi lurd**: https://docs.google.com/document/d/1kqOoOBZuE-b9MCwvWsFi7XSHTK0f4f16xHF1N90Cs0U
- The document is stored alongside, rather than inside, the newer reference folder. Do not edit it unless the user explicitly requests a specific change.
- Citation audit and edit (2026-08-09): BAB I now includes verified author-year citations to Daraojimba et al. (2024), Carreno (2024), Gledson et al. (2024), Bagshaw (2021), and Jouda & Shiker (2024), all sourced from PDFs in **Referensi Skripsi** and already represented in the document's bibliography. BAB II already contained multiple folder-backed CPM/PERT citations and was left substantively unchanged.

## Verified Repository State

- Repository: Next.js 16.2.6 App Router application using React 19, TypeScript,
  Tailwind CSS 4, shadcn/Radix UI components, Zustand 5, and mock in-memory data.
- Active branch: `master`, tracking `origin/master`.
- Inspected revision: `9258cfbae0080797d9d2ea4b218b30e2f2c03841`
  (`Implement isolated project workspaces and Gantt improvements`).
- Working tree at initialization: tracked implementation files were clean.
  `AGENTS.md`, `.agent/handoff/`, and `PMIS-handoff-pack.zip` were already
  present as untracked files and were preserved.
- Application entry point: `app/page.tsx` renders
  `components/pmis/pmis-app.tsx`.
- The implemented UI includes the portfolio dashboard and the three-panel
  project execution view: task list, interactive Gantt timeline, and task
  inspector.
- `lib/pmis-store.ts` centralizes navigation, selection/hover state, timeline
  controls, visible-row generation, task-date updates, and dependency traversal.
- The task list currently groups tasks by delivery workstream
  (`foundation`, `core-platform`, `execution-ui`, `validation`, `release`).
  Delivery team remains separate task metadata.
- The Gantt implementation includes day/week/month scales, progressive
  dependency disclosure, all-dependencies and critical-path modes, adaptive
  connector routing, continuous dependency strokes, task move/start-resize/end-resize
  interactions, direct-predecessor minimum-start clamping, and recursive
  forward-only dependent propagation.
- Task creation is now available from the global `New Task` button and from a
  scoped Gantt context menu. Both entry points use the same dialog; Gantt entry
  pre-fills date/workstream context, and right-clicking a bar also offers an
  `Add dependent task` variant with the predecessor preselected.
- The creation dialog captures title, description, date range, workstream, team,
  assignee, milestone state, predecessors, and existing dependents. Workstream
  placement is shown as `Project > Workstream` and remains independent from the
  dependency graph.
- Creating a task maintains bidirectional dependency references, rejects proposed
  cycles, clamps the new task to its latest predecessor end while preserving
  duration, and recursively pushes selected existing dependents forward when the
  new minimum-start constraint is violated.
- Workstreams are runtime records with stable IDs and editable labels. The left
  panel supports create, rename, and safe delete; deletion is limited to empty
  workstreams so tasks are never silently removed or reclassified.
- Compact task-list headers retain the workstream icon and a flexible, truncated
  text label, so workstream names remain visible at the default and minimum panel
  widths without widening the three-panel workspace.
- Undo/redo is available from the top navigation and keyboard shortcuts
  (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, and `Ctrl+Y`). History stores bounded
  in-memory snapshots of the active mock workspace covering tasks, workstreams,
  expanded workstreams, selection, and inspector state. Gantt drag/resize uses a
  transaction so one drag gesture creates one undo entry instead of one entry per
  mousemove.
- Undoing a propagated Gantt edit restores the snapshot that existed before the
  user gesture. This may visually move dependents back during undo, but it does
  not change the forward-only propagation rule used when calculating new schedule
  edits.
- Schedule state and project data are prototype mock data. No API routes,
  database schema/ORM, PostgreSQL integration, authentication, or persistence
  layer were found.
- Dashboard project selection now swaps isolated in-memory workspaces instead of
  reusing one global task array. Runtime task/workstream changes are retained when
  switching away from a project and back during the same browser session.
- `PMIS Platform v1.0` is intentionally empty and renders explicit task-list and
  Gantt authoring states. `Mobile App Redesign` contains seven long-content layout
  fixtures; `API Gateway Migration` contains a generated 240-task, 487-edge
  performance graph; `Security Compliance Audit` contains eight schedule-boundary
  fixtures with ten edges, one cramped top-entry route, multi-predecessor tasks,
  blocked work, long gaps, and three milestones.
- Portfolio task KPIs now aggregate all project workspaces instead of reflecting
  only the most recently selected project.
- Left-list and Gantt vertical scrolling now synchronize imperatively before
  paint instead of round-tripping through React state and post-render effects.
  Both panes share the same maximum scroll range, including horizontal-scrollbar
  compensation.
- The 72px calendar header and matching left-list spacer remain sticky during
  deep vertical scrolling. Header rendering stays on the browser's sticky-layout
  path and does not introduce scroll-driven React renders.
- The dashboard/Gantt view-mode switcher was removed from the top navigation.
  Timeline settings now sit beside All Dependencies and Critical Path, are labeled
  `Project timeline`, identify the active project in the dialog, and persist under
  a project-specific browser key.
- The task-list and Gantt vertical scrollbar tracks are visually hidden while
  wheel/touch scrolling, frame-synchronous vertical movement, and the Gantt's
  horizontal scrollbar remain available.
- Gantt move and resize now use an isolated SVG preview updated at most once per
  animation frame. Mouse movement does not mutate the Zustand task array; the
  final snapped dates and recursive schedule propagation commit once on mouseup.
  The window listeners are attached once and read current actions through refs.
- The isolated preview now includes the full in-memory propagated update map:
  affected descendant SVG groups are faded while projected child bars move with
  the parent, then the same update map is committed once on release.
- Task selection/inspector opening occurs after a click or completed gesture, so
  the 320px inspector no longer changes the timeline width during pointer
  movement. Resize hit targets are 12px wide instead of 6px.
- Dependency connector coordinates are shifted into calendar-header space once
  per task-position change instead of rebuilding a complete position map for
  every rendered edge. Recursive propagation also evaluates the latest end date
  across all direct predecessors before pushing a dependent.
- The right task-details inspector is resizable from a 280px minimum to a 520px
  maximum through a dedicated vertical separator. Its live width is passed into
  `ContextInspector`, matching the existing task-list panel resize behavior.
- The task-details inspector now constrains Radix ScrollArea's intrinsic content
  wrapper to the live viewport width, so long task titles reflow while the panel
  is dragged instead of retaining a wider stale layout. The Planview header logo
  is a keyboard-accessible dashboard action that returns to the portfolio view.
- PERT input fields are stored and displayed. Critical-path membership is
  currently static mock-data metadata; no CPM/PERT calculation engine for
  earliest/latest dates, slack, or computed critical path was found.
- Type check (2026-08-09): `node .\node_modules\typescript\bin\tsc --noEmit
  --incremental false` passed after undo/redo implementation.
- Interactive browser verification (2026-08-09): loaded `localhost:3000`, created
  a temporary mock task through the task dialog, verified toolbar undo removed it
  and toolbar redo restored it. Dragged a Gantt bar from SVG x=224 to x=352,
  verified one toolbar undo restored x=224, toolbar redo restored x=352, and
  keyboard `Ctrl+Z` / `Ctrl+Shift+Z` repeated the same reversal/restoration.
  Browser console reported no warnings or errors during this smoke test.
- Gantt performance verification (2026-08-09): on the 240-task/487-edge API
  Gateway fixture, a stepped 160px drag completed in about 0.73s including the
  automation's pointer timing (about 4.6s before this change). A stepped end
  resize completed in about 0.55s, expanded a 32px bar to 128px, and one undo
  restored the original 32px duration. The browser console reported no warnings
  or errors. Strict TypeScript validation, `git diff --check`, and the production
  build passed.
- Propagated-preview verification (2026-08-09): moving `performance-21` in the
  dense fixture moved its inspected downstream chain; `performance-26` began at
  the moved parent's new end, the preview layer was removed after release, one
  undo restored the original positions, and browser logs contained no warnings
  or errors.
- Right-inspector resize verification (2026-08-12): selected a task in the
  Mobile App Redesign fixture, expanded the task-details panel from 320px to
  418px, and verified its minimum clamp at 280px. The inspector content matched
  the live panel width and browser logs contained no warnings or errors. Strict
  TypeScript validation and `git diff --check` passed.
- Issue regression verification (2026-08-12): resized the task-details panel
  between its 480px expanded width and 280px minimum while inspecting a long
  task title. The title reflowed from two lines to three, and the viewport had no
  horizontal overflow. Clicking the Planview logo returned to Project Overview
  and reset the project selector to All Projects. Browser logs contained no
  warnings or errors.
- Workstream-sidebar regression verification (2026-08-12): at both the default
  320px task-list width and its 280px minimum, all Mobile App Redesign workstream
  names remained present beside their icons, long labels truncated within the
  available space, and each header's scroll width matched its rendered width.
  Browser logs contained no warnings or errors.
- Type check (2026-08-08): `node.exe .\node_modules\typescript\bin\tsc --noEmit
  --incremental false` passed.
- Production build (2026-08-08): `npm.cmd run build` passed after network access was allowed
  for the configured Google Geist font downloads. Next.js reports that build-time
  type validation is skipped because `next.config.mjs` sets
  `typescript.ignoreBuildErrors: true`; the separate strict type check passed.
- Lint: `npm.cmd run lint` failed before analyzing source because ESLint 10.8.0
  could not find an `eslint.config.js`, `.mjs`, or `.cjs` configuration.
- Tests: no test script or dedicated test/spec files were found, so no automated
  test suite was run.
- Interactive browser verification passed for opening the reusable dialog,
  creating a predecessor-constrained task, automatic date clamping, rendering the
  new left-list row and Gantt state, workstream create/rename/delete, populated
  workstream deletion protection, Gantt context creation, and dependent-task
  defaults. No browser console warnings or errors were reported.
- Per-project fixture verification (2026-08-08): switching through all four
  dashboard projects produced task counts of 0, 7, 240, and 8 respectively;
  enabling all dependencies rendered 487 connectors in the performance fixture
  and 10 in the boundary fixture; switching back to PMIS restored the empty state.
  The browser reported no console warnings or errors.
- Deep-scroll verification (2026-08-08): both panes reported matching positions
  at 4,200px, 2,500px in the reverse direction, and their shared 8,304px bottom
  boundary. The sticky calendar header remained at the same viewport coordinate.
  Project-specific settings were verified by changing API Gateway, switching to
  Mobile App Redesign, and confirming its independent default before switching
  back and restoring API Gateway's saved value.
- Production build (2026-08-08): `npm.cmd run build` passed after network access
  was allowed for the existing Google Geist font download. A separate strict
  `tsc --noEmit --incremental false` check also passed.

## Completed Work

- Read the repository operating contract, product knowledge, dependency-rendering
  rules, initial implementation handoff, decision ledger, and handoff protocol.
- Audited BAB I and BAB II of the working thesis against the active Google Drive
  reference collection; added four source-grounded citation callouts to BAB I and
  verified the existing folder-backed citations in BAB II.
- Inspected the active revision, working tree, package configuration, application
  structure, PMIS state/data modules, and core UI implementation.
- Initialized this file from verified repository evidence without modifying
  implementation or accepted product behavior.
- Implemented local task creation and workstream management while preserving
  group/dependency independence and forward-only schedule propagation.
- Implemented per-project mock workspaces, deterministic focused fixtures,
  portfolio aggregation, project-switch state reset, and an empty Gantt/task-list
  authoring state.
- Expanded the performance fixture, removed scroll synchronization from React's
  render path, added the sticky calendar architecture, simplified the top bar,
  and made timeline preferences explicitly project-scoped.
- Implemented in-memory undo/redo for task/workstream workspace mutations and
  Gantt scheduling gestures without changing the dependency propagation rules.
- Replaced per-mousemove global schedule mutations with an animation-frame drag
  preview and one atomic release commit; widened resize handles and removed a
  dense connector-map allocation from the render loop.
- Extended the isolated preview to render propagated child bars from the same
  frozen schedule used by the final release commit.
- Added a matching resizable right inspector separator and width constraints to
  the three-panel project view.
- Fixed task-title reflow in the resizable inspector and made the header logo a
  semantic, keyboard-accessible return-to-dashboard action.
- Kept workstream names visible in the task list's compact-width header layout
  without changing panel dimensions or removing task and status summaries.
- Added `.agents/docs/GANTT_DRAG_PERFORMANCE.md` with the rationale, interaction
  model, preserved scheduling rules, and verification evidence for this change.

## Files Changed in Latest Work

- `.agents/docs/PMIS_TECHNICAL_ARCHITECTURE.md`
- `app/api/planning/history/route.ts`
- `app/api/planning/revisions/route.ts`
- `lib/application/planning-service.ts`
- `lib/domain/forecast.ts`
- `lib/domain/pmis-adapter.ts`
- `lib/domain/planning-types.ts`
- `lib/domain/reconciliation.ts`
- `lib/domain/scheduling.ts`
- `lib/persistence/planning-repository.ts`
- `lib/persistence/sqlite-planning-repository.server.ts`
- `types/node-sqlite.d.ts`
- `lib/pmis-data.ts`
- `lib/pmis-store.ts`
- `.gitignore`
- `.agents/docs/GANTT_DRAG_PERFORMANCE.md`
- `.agent/handoff/CURRENT_STATE.md`
- `components/pmis/gantt-chart.tsx`
- `components/pmis/context-inspector.tsx`
- `components/pmis/project-view.tsx`
- `components/pmis/top-nav.tsx`
- `components/pmis/task-list-panel.tsx`
- `components/ui/scroll-area.tsx`
- `lib/pmis-store.ts`

## Planning-domain implementation (2026-08-12)

- Added framework-independent planning types for Active Plan, Approved Baseline,
  Scenario, Actual Progress, Forecast, Change Records, reconciliation, and Task
  Change Proposals.
- Extracted forward-only dependency schedule propagation into
  `lib/domain/scheduling.ts` and added PERT/CPM forecast calculation in
  `lib/domain/forecast.ts`.
- Added baseline activation reconciliation and an application service covering
  Scenario creation/submission, baseline approval, activation, schedule changes,
  and task-date proposals.
- Added the accepted closed Change Record action vocabulary and grouped automatic
  downstream scheduling effects in the application service.
- Added optional `Task.approverId`, defaulting newly created mock tasks to `u1`,
  plus client actions for assignee completion reporting and approver confirmation.
- Added a repository port and a local SQLite implementation using Node 26's
  built-in `node:sqlite`, with a typed SQL query-builder/POJO row-mapper boundary.
  This avoids coupling the domain to a database driver and leaves a direct path
  for a PostgreSQL or Supabase adapter.
- Added read-only revision and Change Record API endpoints.
- Added a POST planning command endpoint for Scenario creation/submission,
  baseline approval/activation, schedule changes, and Task Change Proposals.
- Added `.agents/docs/PMIS_TECHNICAL_ARCHITECTURE.md` as the durable handoff for
  the adapter boundary and remaining integration work.

## Confirmed Decisions Awaiting Implementation

- None recorded.

## Proposed but Unconfirmed

- None recorded.

## Known Issues or Blockers

- Documentation/implementation mismatch: product documentation describes the
  left grouped task list using delivery teams, while the implementation groups
  by workstreams and shows team ownership as metadata. This initialization does
  not decide whether the implementation should change.
- Stale implementation snapshot: `.agent/doc/INITIAL_PMIS_HANDOFF.md` describes
  drag-to-resize as partially implemented, while the current Gantt code includes
  move and both resize interactions plus dependency-aware scheduling constraints.
- Documentation/implementation mismatch: the initial handoff describes dark mode
  as the default and only mode, while `app/layout.tsx` currently uses the system
  theme.
- PostgreSQL/Supabase persistence is intentionally not implemented pending the
  DBA agent's schema/auth decisions. SQLite persistence exists behind the
  repository port, but the current fixture workspace is not yet hydrated from
  SQLite on page load.
- The current Timeline still renders fixture `isCriticalPath` metadata; the
  calculated Forecast API is available but has not yet replaced every visual
  critical-path consumer.
- Completion-report/confirmation API commands and visible Plan History, Forecast,
  Scenario, and baseline controls remain follow-up integration work.
- User-supervised product discussions remain open for scheduling conventions,
  layered project-state/domain authority, canonical grouping semantics, and
  checkpoint/scenario governance. Future implementation touching those topics
  should ask for confirmation and record the confirmed decision in writing.
- Populated workstream deletion requires a future task reassignment/editing flow;
  until then, only empty workstreams can be deleted. The user clarified that mock
  workstream deletion may later allow deleting child/member tasks or keeping them
  parentless/unassigned, but that behavior is not implemented yet.
- Lint cannot run until a flat ESLint configuration compatible with ESLint 10 is
  added or the lint toolchain is otherwise aligned.
- Automated behavioral tests are absent.

## Next Action

Wire the current fixture workspace to the repository through server actions, add
focused domain tests for scheduling/forecast/reconciliation, then replace static
critical-path rendering with calculated Forecast output. PostgreSQL/Supabase
adapter work waits for DBA schema and authentication decisions.
