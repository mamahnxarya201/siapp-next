# PMIS Current State

Last updated: 2026-08-19

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
- Added the globally triggerable `.agents/skills/google-developer-docs/` skill, summarizing Google's developer documentation guidance for voice, structure, procedures, formatting, accessibility, and final editorial checks.
- Documented `experimental/gantt-engine` with a Markdown source index and a generated offline HTML portal. The portal includes editorial-tech styling, section navigation, responsive layout, print styling, keyboard-accessible skip navigation, and browser `Ctrl+F` guidance. Browser verification confirmed seven rendered documents, seven navigation links, no search form, and no local search handler.
- Internal Markdown links in the generated portal now resolve to styled in-page document anchors instead of opening raw `.md` files. Browser verification confirmed the Architecture and PHP bridge links remain on the portal page, with no `.md` navigation targets. The docs index records the static-file limitation: double-click opens the rendered portal, but Markdown changes require regeneration.
- Aligned `experimental/gantt-engine/docs/` with the Google developer documentation style: corrected duplicate procedure numbering in `ARCHITECTURE.md`, promoted Playwright subsections to headings, standardized `Yes`/`No` table values, normalized sentence-case headings, and converted the migration-plan link to a repository path so the portal has no raw Markdown navigation links. Regenerated and browser-verified the styled portal with seven documents, seven navigation links, and the warm editorial-tech canvas.

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
- `.agents/skills/google-developer-docs/SKILL.md`
- `.agents/skills/google-developer-docs/agents/openai.yaml`
- `experimental/gantt-engine/README.md`
- `experimental/gantt-engine/package.json`
- `experimental/gantt-engine/docs/README.md`
- `experimental/gantt-engine/docs/build-docs.mjs`
- `experimental/gantt-engine/docs/index.html`
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
- Added `.agents/docs/PLANNING_UI_IMPLEMENTATION_HANDOFF.md` and implemented
  `components/pmis/planning-panel.tsx` with Forecast, Plan History, Scenarios,
  Approved Baselines, and Task Change Proposals tabs. The panel is opened from a
  project-scoped Planning button and does not participate in Gantt pointer-frame
  updates.
- Plan History loads read-only Change Records from the SQLite-backed API, and
  Scenario creation posts a snapshot of the current Active Plan through the
  planning command endpoint.

## Experimental engine: vertical row reorder (2026-08-18)

- The isolated `experimental/gantt-engine` gained an explicit row-order model.
  Rows are no longer derived from the date-sort; `buildVisibleRows` accepts a flat
  `{ type, id }` order (workstream headers, tasks, ungrouped) and the engine keeps
  `state.rowOrder`, seeded from `defaultRowOrder` (the old date-sort) and kept
  consistent by `reconcileRowOrder` on task/workstream changes.
- A horizontal drag that changes a task's date no longer re-ranks its row, fixing
  the "bar jumps to the top of its workstream when dragged past another bar's date"
  bug.
- `src/reorder.js` adds vertical-reorder geometry. Task bars and workstream group
  headers are draggable vertically, and a full task move is free: one gesture
  changes both the date (horizontal) and the row/workstream (vertical)
  simultaneously. A live preview shows a horizontal insertion line and highlights
  the destination workstream header in the task list; release commits the new dates
  and row order together. A task can be moved into/out of a workstream by crossing
  its header (reassigning `groupName`); collapsed workstreams are not drop targets.
  Row order flows through the existing commit/persist seam for a future persistence
  backend but is ephemeral in the current in-memory demo.
- Fixed: the add-bar context menu no longer reuses the previous task's name — the
  `#context-task-name` field is cleared each time the menu opens.
- Horizontal autoscroll: dragging a task bar into the 40px band inside the
  viewport's left or right edge scrolls the timeline continuously in both
  directions, throttle-style. The trigger is the band *inside* the edge (not the
  pointer leaving the viewport) because the viewport sits flush against the browser
  window edge — the pointer cannot travel past it, so a "past the edge" trigger
  would never fire on that side. The target speed is proportional to how deep the
  pointer is in the band (deeper = faster), and the actual speed eases toward it
  each frame (gas-motor feel). The dragged date is anchored in timeline space so the
  bar stays pinned at the viewport edge (leading edge rides the left separator or
  the right viewport edge) while content scrolls under it. The existing scroll
  listener grows/shrinks the grid range, so scrolling out to a far date and back
  does not retain wasted scroll data.
- Horizontal scrolling is exposed through a custom `.timeline-hscroll` track and
  thumb under the grid (Chromium cannot show a horizontal-only native scrollbar).
  The `#timeline-viewport` remains the horizontal scroll owner; the sticky calendar
  header mirrors its `scrollLeft`.
- Vertical scrolling now uses one `.gantt-scroll-region` containing both columns.
  The task list and timeline viewport do not own vertical scroll positions, so an
  empty or one-task project has no independent Gantt vertical overflow.
- Task creation remains context-menu only (right-click the grid → Add task); the
  sidebar does not include an inline task-entry field. The `task.create` command
  and the unused legacy renderer's create-row input were removed after a short
  experiment with a sidebar textbox, which was reverted at the user's request.
- Documentation updated in `experimental/gantt-engine/docs/ARCHITECTURE.md`.

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
- Completion-report/confirmation API commands, authenticated actor resolution,
  proposal review APIs, and full scenario/baseline/reconciliation action
  controls remain follow-up integration work.
- User-supervised product discussions remain open for scheduling conventions,
  layered project-state/domain authority, canonical grouping semantics, and
  checkpoint/scenario governance. Future implementation touching those topics
  should ask for confirmation and record the confirmed decision in writing.
- Workstream deletion remains limited to empty workstreams. Tasks can now be
  reassigned to another workstream through inspector edit mode before deletion.
- Lint cannot run until a flat ESLint configuration compatible with ESLint 10 is
  added or the lint toolchain is otherwise aligned.
- Integration testing for the unified task-authoring flow is deferred. Focused
  unit and Playwright interaction coverage now exists.

## Next Action

Wire the current fixture workspace to the repository through server actions, add
focused domain tests for scheduling/forecast/reconciliation, then replace static
critical-path rendering with calculated Forecast output. PostgreSQL/Supabase
adapter work waits for DBA schema and authentication decisions.

## Unified Timeline task authoring (2026-08-13)

- Follow-up verification confirms the inspector keeps long task details inside a
  constrained scroll viewport, and the final selectable edit field tabs to the
  keyed Save action.
- Milestones remain supported: product knowledge, task data, creation/edit
  forms, and Gantt rendering all establish this as an existing timeline and
  academic feature.

- Implemented the confirmed core task-authoring flow from
  `.agent/task/001-unionizing-ui.md` without changing the three-panel Timeline or
  dependency scheduling rules.
- Workstream headers expose a hover/focus add-task control that opens the shared
  creation dialog with the workstream selected.
- Projects without workstreams cannot create an ungrouped task. The shared dialog
  explains the rule, creates the first workstream, and then continues the task
  flow with that workstream selected.
- Creation and deletion dialogs place the affirmative action before Cancel and
  support keyboard form submission.
- Task-list rows and Gantt bars expose the same task deletion flow. Its recursive
  dependent option is shown only when descendants exist; the workstream option is
  shown only when the selected task is the workstream's sole task.
- Deletion removes selected tasks atomically, cleans both sides of surviving
  dependency references, closes deleted selections, and participates in undo/redo.
- The inspector now has pencil, save, and cancel modes. Save commits one undoable
  mutation; Cancel discards its local draft. User-authored task fields are
  editable while Forecast, completion confirmation, dependents, comments, and
  history remain governed or derived.
- Inspector edit-session identity is centralized with selection state so drafts
  cannot leak between tasks. Distinct keyed edit/save controls prevent React DOM
  reuse from turning a pencil click into an unintended form submission.
- Added Vitest and Playwright scripts/configuration. Unit tests cover recursive
  descendants, graph cleanup, and cycle rejection. Playwright covers shared
  create/edit/delete interaction, dynamic deletion controls, keyboard submission,
  and the no-workstream continuation flow.

### Files added or materially changed for this feature

- `.agent/task/001-unionizing-ui.md`
- `.agent/handoff/DECISIONS.md`
- `.agent/handoff/CURRENT_STATE.md`
- `components/pmis/context-inspector.tsx`
- `components/pmis/gantt-chart.tsx`
- `components/pmis/pmis-app.tsx`
- `components/pmis/task-create-dialog.tsx`
- `components/pmis/task-delete-dialog.tsx`
- `components/pmis/task-edit-form.tsx`
- `components/pmis/task-list-panel.tsx`
- `lib/domain/task-mutations.ts`
- `lib/pmis-store.ts`
- `package.json`
- `package-lock.json`
- `playwright.config.ts`
- `tests/e2e/timeline-task-flows.spec.ts`
- `tests/unit/task-mutations.test.ts`
- `vitest.config.mts`

### Verification

- `npm.cmd run test:unit`: passed, 3 tests.
- `npm.cmd run test:e2e`: passed, 2 Chrome scenarios.
- `node .\node_modules\typescript\bin\tsc --noEmit --incremental false`:
  passed.
- `git diff --check`: passed.
- `npm.cmd run build`: passed. Next.js still reports that build-time type
  validation is skipped by configuration; the separate strict type check passed.
- User manual verification remains pending by explicit choice. Integration tests
  remain deferred.

## Task checklist (2026-08-13)

- Added optional task-owned checklist points with text, completion state, and
  percentage weight. New points are equally weighted using integer allocation;
  manual weight edits redistribute the remaining percentage across other points.
- Added checklist CRUD controls to the right task inspector directly below
  Calculated Forecast. Checklist completion recalculates task progress using
  the weighted completed points and therefore updates the existing Gantt
  progress indicator.
- Added a Playwright scenario covering creation, equal weighting, manual 10/90
  redistribution, completion progress, deletion, and final weight normalization.
- Strict TypeScript validation, unit tests (3), and `git diff --check` pass.
- Playwright verification was attempted but the existing localhost process
  repeatedly rejected Next HMR WebSocket handshakes with
  `ERR_INVALID_HTTP_RESPONSE` before a completed test result; rerun against a
  clean dev server is pending.
- Playwright hang root cause was identified: the shared `openProject` helper
  still waited for the removed top-navigation `All Projects` button. The
  dashboard now exposes projects as directly clickable cards. The helper now
  clicks the requested project card; all three E2E scenarios completed
  successfully afterward.

## Routing (2026-08-14)

- Replaced the single SPA entry behavior with App Router routes: `/` redirects
  to `/dashboard`, and `/project/timeline/[projectId]` renders a validated
  project timeline deep link.
- Dashboard project cards now navigate with the project URL while preserving
  the existing three-panel timeline and Zustand workspace behavior.
- Added route-focused Playwright coverage and documented the current/future
  sitemap in `.agents/docs/ROUTING.md`.
- Removed build-time `next/font/google` downloads from the root layout so local
  test/server startup does not hang when outbound Google Fonts access is
  unavailable; the existing CSS fallback font stack remains active.
- Routing test runs reached passing assertions, but the local Playwright
  command still experiences Windows child-process cleanup and occasional
  retries when orphaned Next processes remain from prior runs.

## Navigation layout (2026-08-14)

- Renamed the Gantt display control to `Timeline Settings` while preserving its
  settings icon and behavior.
- Renamed the header planning action to `Planning Intelligence` and changed its
  icon to a line chart. The existing Forecast, History, Scenarios, Baselines,
  and Proposals sheet remains unchanged in scope.
- Added editable task labels with add/edit/delete controls in the existing task
  edit form; labels are stored in the same in-memory Zustand workspace and are
  shown in the read-only inspector.
- Checklist delete controls now have a destructive red border/background cue.
- Save now calls the edit form's `requestSubmit()` explicitly, fixing reliance
  on an external button `form` attribute.
- Strict TypeScript validation and unit tests pass. The focused Playwright run
  was attempted but the reused localhost dev server again emitted HMR
  `ERR_INVALID_HTTP_RESPONSE` errors before completion.

- Follow-up verification fixed the route-hydration failure (`Router action
  dispatched before initialization`) by using native project anchors, hardened
  malformed project-logo crop storage parsing, corrected label test naming, and
  made workstream-menu activation deterministic after route hydration.
- Full Playwright coverage now reports all four scenarios passed with zero
  retries: routing, task edit/save and labels, workstream continuation, and
  weighted checklist behavior. The Windows shell still retains Next child
  processes after reporting the passing scenarios, so the final summary line
  is not emitted before manual interruption.

## Isolated vanilla Gantt experiment (2026-08-15)

- Implemented migration tasks 005 and 006 under `experimental/gantt-engine/` without
  changing the React PMIS implementation.
- Added a minimal event-oriented application shell with named commands, root action
  delegation, explicit invalidation/refresh, cancellable scheduling, and deterministic
  lifecycle cleanup. Its control flow is documented for WinForms/Delphi/Qt/GTK-era
  auditors in `experimental/gantt-engine/docs/ARCHITECTURE.md`.
- Added an application-facing `Gateway` and separate in-memory/fetch transports. The
  future PHP boundary is documented in
  `experimental/gantt-engine/docs/PHP_BRIDGE_CONTRACT.md`; no PHP endpoint or
  production persistence was added.
- Implemented the task-list/DOM and timeline/SVG Gantt slice: scales, scroll sync,
  range growth/compaction, group collapse, milestones, task gestures, progressive
  dependencies, adaptive routes, forward-only recursive propagation, and PERT/CPM.
- Runtime dependencies remain zero. `@playwright/test` is the only development
  dependency and is recorded in `experimental/gantt-engine/docs/BILL_OF_MANIFEST.md`.
- Verification: `npm.cmd test` in `experimental/gantt-engine` completed cleanly with
  45 Node tests and 6 Chrome/Playwright scenarios. Unlike the main Next.js E2E issue
  above, the experiment's test wrapper owns and terminates its static server process.
- This experiment does not authorize replacing or integrating the React Gantt. That
  remains a separate user-approved task.

### Demo root-route rendering fix (2026-08-15)

- Fixed the standalone demo asset URLs in `experimental/gantt-engine/demo/index.html`.
  The test server serves the same document at `/`, so relative `./demo.js` resolved to
  a nonexistent `/demo.js` and left the shell empty even though the page had no console
  error visible in the shell.
- Stylesheet and module paths now use `/src/styles.css` and `/demo/demo.js`, which work
  from both `/` and `/demo/index.html`.
- The browser suite now opens `/` in its setup, covering the user-facing entry point.
  Both routes were manually inspected: 11 task rows, 11 Gantt bars, and no console
  warnings/errors. Unit tests (45) and browser scenarios (6) pass.

### Vanilla Year 0 interaction/theme slice (2026-08-15)

- The isolated `experimental/gantt-engine` demo now supports direct task creation
  and renaming in the activity panel, scoped right-click task-bar creation, and
  right-click dependency connect/remove with a live preview connector.
- The demo suppresses the browser context menu only inside its Gantt root and
  supports `dark`, `light`, and `editorial` themes through semantic CSS tokens.
  The layout keeps the wireframe-inspired Activity/Resource/Status grid; the React
  application was not changed.
- Dependency authoring updates both canonical `predecessorIds` and UI-facing
  `dependencies` before normalization, preserving the model contract.
- Durable behavior is documented in
  `experimental/gantt-engine/docs/THEME_AND_INTERACTION_CONTRACT.md`.
- Verification after this slice: 45 Node tests and 8 Chrome/Playwright scenarios
  pass, including task/bar creation, theme switching, dependency preview/commit,
  and the prior scheduling, scroll, and forecast coverage.

### Wireframe UI replacement (2026-08-15)

- Replaced the isolated demo’s dark product-shell presentation with the supplied
  `.agent/rendered wireframe.png` geometry: a 350px activity pane, 72px calendar
  header, orange workstream bands, white spreadsheet canvas, hairline date grid,
  and synchronized scroll surfaces.
- Kept the existing command, task authoring, drag/resize, dependency, forecast, and
  gateway behavior behind the new presentation. React PMIS remains unchanged.
- Verification: 45 unit tests and 8 browser scenarios pass against the replacement
  UI.

### Tom’s Planner-style cell grid/sidebar refinement (2026-08-15)

- Refined the wireframe replacement to match the supplied example: 454px numbered
  Activity/Resource/Status sidebar, numbered workstreams and tasks, calendar glyph,
  centered year/month/day header bands, and explicit horizontal plus vertical cell
  lines across the Gantt surface.
- Added `experimental/gantt-engine/src/grid.js` as the adjustable grid-settings seam.
  It currently controls line visibility, major/minor/row colors, and group/task
  fills through `settings.grid`.
- Verification: 45 unit tests and 8 browser scenarios pass after the refinement.

### Experiment readability refactor (2026-08-15)

- Applied a behavior-preserving Prettier formatting pass to every JavaScript and
  MJS module in `experimental/gantt-engine`, including the engine, renderer,
  scheduling, timeline, bridge, and framework layers plus the demo entrypoint.
- Verification: `npm.cmd test` passes with 45 unit tests and 8 browser scenarios;
  `git diff --check` passes.

### Ndang Lulus UI port (2026-08-15)

- Reworked the isolated experiment's presentation to follow the reference Svelte
  app at `D:/siapp-labs/ndang-lulus`: compact command strip, white spreadsheet
  canvas, 358px label pane, 64px calendar header, orange workstream bands,
  compact Activity/Resource/Status columns, and neutral Gantt bar colors.
- Kept the experiment's existing SVG renderer, progressive dependency disclosure,
  adaptive routing, drag/resize scheduling, context menus, gateway, and lifecycle
  behavior unchanged.
- Verification: `npm.cmd test` passes with 45 unit tests and 8 browser scenarios.

### Ndang Lulus exact geometry pass (2026-08-15)

- Aligned the experiment's engine geometry with the Svelte reference rather than
  only approximating it in CSS: 42px command strip, 358px label pane, 64px
  calendar header, 24px rows, 16px bars with 4px inset, and 25px default day
  cells.
- Updated the geometry assertions and the engine's header hit-testing offset to
  match the new dimensions.
- Verification: `npm.cmd test` passes with 45 unit tests and 8 browser scenarios;
  `git diff --check` passes.

### Settled spreadsheet layout contract (2026-08-16)

- Documented the finalized experiment geometry and its CSS/JavaScript token
  ownership in `experimental/gantt-engine/docs/LAYOUT_CONTRACT.md`.
- The contract records the 42px command strip, 358px activity pane, 64px
  calendar header, 24px group/task rows, 16px bars with 4px inset, and the
  50/25/20 day/week/month scale widths.

### React project-view layout alignment (2026-08-16)

- The task brief was refined to make the current React project execution view
  the visual source of truth. The experiment is being moved away from the prior
  wireframe/Ndang-Lulus presentation.
- The in-progress alignment uses React's 56px top navigation, center-only 48px
  timeline toolbar, 320px default activity pane, 72px calendar header, 40px
  workstream rows, 36px task rows, 24px bars, and 60/32/20 day/week/month
  scale widths.
- Live geometry verification confirms the experiment now places the 56px top
  navigation at y=0, the task pane directly below it at y=56, and the 48px
  timeline toolbar only over the center panel. The Tasks header is 72px and the
  default activity pane is 320px, matching the live React route at a 1280x720
  viewport.
- Verification: 45 unit tests, 8 clean Chrome/Playwright scenarios, and
  `git diff --check` pass. The experiment still intentionally keeps its own
  fixture and mini-framework boundary; navigation and the React right inspector
  remain outside this timeline-focused experiment scope.

### React hover-row parity correction (2026-08-16)

- Re-read the React task-list, project-view, Gantt chart, store, theme, and
  layout sources after visual comparison against the supplied screenshots.
- Replaced the experiment's task-panel header composition with the React Tasks
  header and removed the prior Activity/Resource/Status spreadsheet header.
- Added the missing shared hover state: hovering a task row now marks both the
  sidebar row and a full-width SVG timeline row with the React-equivalent
  accent cue. Selected rows use the separate primary tint.
- Added an E2E assertion covering the full-width `.timeline-row--hovered`
  element. The final verification remains 45 unit tests, 8 Playwright scenarios,
  and `git diff --check` passing.
- It explicitly preserves the separation between presentation grouping and SVG
  dependency rendering, and gives the required verification checklist for future
  geometry changes.
- Live visual inspection confirmed the root demo renders 11 task rows and 11
  bars with aligned sidebar/timeline rows and synchronized scroll surfaces.

### React sidebar parity implementation (2026-08-16)

- Replaced the experiment's grouped sidebar markup with React-shaped workstream
  headers and task rows. Group headers now have an isolated collapse control,
  hover/focus-revealed add/manage affordances, workstream icon boxes, task
  counts, and blocked/active/done summaries.
- Added deterministic fixture metadata for assignee initials/colors, team,
  priority, blockers, and critical-path flags. Task rows now render the status
  dot, editable name, avatar, compact dependency count, and wide-panel team and
  status badges while preserving the current task selection/rename behavior.
- Compact sidebar behavior is container-based rather than viewport-based, so
  the 280-320px panel keeps the name column readable while the same row contract
  can expose badges in a wider host panel.
- Added workstream-scoped task creation and explicit manage feedback through the
  existing delegated command bus. No dependency or schedule rules were changed.
- Live verification at the compact panel width reports five workstreams, eleven
  task rows, hidden compact team/status chips, visible avatars, and a single
  full-width SVG hover row (`width=4224px`). Verification: 45 unit tests and 9
  Playwright scenarios pass; `git diff --check` passes.
- Sidebar workstream/action icons use vendored Lucide 0.564.0 SVG path geometry;
  the experiment BOM records the ISC source, rationale, and replacement path.

### React p3 parity completion (2026-08-16)

- Completed the React `p3` fixture port in the isolated experiment: 240
  deterministic tasks across five workstreams, including assignee initials,
  teams, statuses, milestones, blockers, critical-path metadata, and
  forward-scheduled dependency dates.
- Completed the React project-view shell: 56px top navigation, center-only
  48px timeline toolbar, 320px activity pane, 72px three-tier calendar header,
  40px workstream rows, 36px task rows, 24px bars, hidden compact gutters, and
  no experiment-only footer space.
- Completed the sidebar interaction parity pass: isolated collapse control,
  hover/focus group actions, Lucide-derived SVG icons, task avatars/team and
  status metadata, dependency counts, selection, and full-width horizontal
  hover cue synchronized with the timeline row.
- The Bill of Manifest now records the vendored Lucide 0.564.0 ISC geometry,
  Playwright development dependency, and replacement strategy. The React app
  remains unchanged; this work is isolated to `experimental/gantt-engine`.
- Final verification: `npm.cmd test` passes 45 unit tests and 9 Playwright
  scenarios; `git diff --check` passes; live root demo inspection shows 240
  tasks/bars, five groups, and matching month/weekday/date header tiers.

### Separate empty demo entry point (2026-08-16)

- Added `experimental/gantt-engine/demo/empty.html` and `empty.js` as a
  separate empty-state host. It reuses the same React-aligned HTML/CSS shell,
  controls, gateway boundary, and engine, but starts with zero workstreams and
  zero tasks so the timeline contains no bars or dependency connectors.
- Added a browser regression scenario for `/demo/empty.html`; final verification
  passes 45 unit tests and 10 Playwright scenarios.

### Workstream context-menu deletion (2026-08-16)

- Fixed context-menu positioning so menus opened from lower sidebar rows are
  measured after becoming visible and clamped inside the viewport.
- Verified the Delete workstream action: empty workstreams are confirmed and
  removed from the sidebar/timeline; populated workstreams remain protected
  with the `Reassign tasks before deleting this workstream.` status message.
- Final verification: `npm.cmd test` passes 45 unit tests and 11 Playwright
  scenarios.

### Context-menu taskbar rework (2026-08-16)

- Removed the inline sidebar task-entry field. Grid right-click now opens a
  contextual task form with a task name, palette swatches, advanced native hex
  color picker, and Enter submission.
- Bar and sidebar task contexts now support Add dependency, Remove dependency,
  Change color, and Delete task. Task deletion removes the task/bar and cleans
  both incoming and outgoing dependency links; removing dependencies only
  removes links.
- Workstream context now supports Collapse, Rename, and Delete. The context
  menu continues to clamp inside the viewport for lower rows.
- Final verification: `npm.cmd test` passes 45 unit tests and 12 Playwright
  scenarios; `git diff --check` passes.

### Experimental navigation/theme refinement (2026-08-18)

- Kept the moon control as the sole theme switcher in the experimental project
  shell. Its light-mode icon is a moon and its dark-mode icon is a sun; the
  accessible action label changes between `Switch to dark mode` and `Switch to
  light mode` with the theme state.
- Replaced the settings glyph that visually resembled a sun with a distinct
  slider/settings glyph, reducing ambiguity between settings and theme control.
- Changed the top navigation to a three-column grid so the search field is
  centered independently of the unequal brand and action widths.
- Applied the same shell changes to both `demo/index.html` and
  `demo/empty.html`. Unit tests pass; the theme browser assertions pass. The
  full browser run reached 13/14 scenarios, with the remaining failure in the
  pre-existing grid-hover guide scenario rather than this refinement.

### Dark theme task highlight refinement (2026-08-18)

- Removed the enlarged SVG task selection layer in dark mode so selected or
  hovered bars no longer show a light outline. Light mode keeps its existing
  visual cue; row highlighting and task interaction behavior are unchanged.

### Project header port: name rename + logo picker (2026-08-18)

- Ported the React `components/pmis/top-nav.tsx` project image/name header to the
  isolated vanilla experiment. Both `demo/index.html` and `demo/empty.html` now
  expose a 32px project-logo button and a project-name button in the top nav.
- Clicking the project name swaps it for an inline textbox; Enter or blur commits,
  Escape cancels, and a status message confirms the rename. The name is
  session-only engine state (`state.projectName`), no persistence.
- Clicking the logo button opens a `Customize project logo` dialog that mirrors the
  React implementation: file upload via `FileReader.readAsDataURL`, a fixed 144px
  square crop frame centered over a 224px crop surface, Pointer-Events drag with
  `setPointerCapture`, and wheel zoom clamped to 0.5–3. `Save logo` applies the
  draft to the header; Cancel/Escape/backdrop discard it. The logo is session-only
  (`state.logo`), no persistence.
- Keyboard handling follows `STD-HCI.md`: the dialog traps Tab in the order Choose
  image → Save logo → Cancel and loops; Accept sits left of Decline; Escape closes
  and returns focus to the logo button. The logo/name buttons are native `<button>`
  elements reachable by Tab.
- Added the `project-brand` view (`renderProjectBrand` in `src/renderer.js`) plus
  commands `project.logo.open/save/cancel/file` and
  `project.name.edit/commit`. The Enter keydown branch now only intercepts rename
  inputs so native button activation (Enter/Space) still works for the new buttons.
- `docs/BILL_OF_MANIFEST.md` records the feature adds no dependency: the crop is a
  re-implementation of the React custom crop (FileReader + Pointer Events + wheel)
  with the Lucide upload glyph vendored. `docs/ARCHITECTURE.md` and
  `docs/THEME_AND_INTERACTION_CONTRACT.md` were updated.
- Verification: `npm.cmd test` unit suite passes 46 tests; the browser suite passes
  16/17 scenarios including the three new header scenarios (rename commit + Escape
  cancel, logo upload/drag/save/cancel, dialog tab-order loop). The single failure
  is the pre-existing grid-hover guide scenario from the prior uncommitted work
  (documented above on 2026-08-18); it is unrelated to the header port and its
  `updateGuide` instrumentation still reports the pointer target as a row rect.
  A stale `node` process on test port 4173 caused an `EADDRINUSE` server abort in
  the first E2E attempt; after terminating it, the suite ran cleanly except for that
  pre-existing scenario.

### Project logo crop refinement (2026-08-18)

- Fixed the logo picker empty-state three-line glyph so it is explicitly hidden
  after an image is selected; the `[hidden]` display rule now wins over the
  component's `display:flex` styling.
- Uploaded images now load their natural dimensions and start at a cover scale
  for the locked 144px square crop frame, preserving aspect ratio instead of
  rendering at intrinsic one-pixel or arbitrary dimensions.
- Saved crop geometry stores the image dimensions and reuses the same scale and
  position in the 32px project-header box. The header hides the fallback glyph
  once a logo is committed.
- Added browser assertions for empty-state visibility, crop dimensions,
  header sizing, and existing Save/Cancel behavior.
- Verification: `npm.cmd test` passes 46 unit tests and all 17 Playwright
  scenarios with clean exit.

### Experimental Gantt: stable timeline origin (2026-08-18)

- Root-caused two interaction bugs in `experimental/gantt-engine` to the timeline
  origin (`minDate`) being re-derived from the earliest task on every render:
  dragging the earliest task kept it frozen on screen while the grid slid (a
  nearby bar appeared to move), and creating a task earlier than the current
  earliest re-anchored the grid so the new bar appeared several columns from the
  hover point.
- `computeTimelineRange` now accepts an optional `minDate` origin that is honored
  verbatim instead of recomputed from the earliest task.
- The engine seeds `state.minDate` to the earliest task minus a 7-day buffer and
  only extends it leftward when a task is genuinely moved/created before the
  current left edge. `reloadSchedule`/`setTasks` reseed the origin from the
  replacement data; incremental mutations (create/rename/delete/color/deps) no
  longer reset it.
- The grid-hover crosshair's horizontal guide line now runs from the left activity
  pane edge to the hovered column (meeting the vertical line) instead of spanning
  the full timeline width.
- Added kernel coverage for the `minDate` override and two Playwright scenarios
  (origin stability on drag, and add-task landing on the hovered column plus the
  anchored crosshair).
- Verification: `npm.cmd test` passes 47 unit tests and 19 Playwright scenarios
  with clean exit.

### Experimental UI primitives storyboard (2026-08-18)

- Added `experimental/gantt-engine/src/ui-primitives.js` with dependency-free
  `pmis-button` and `pmis-textfield` custom elements. They mirror the narrow
  React button/input contracts for variants, sizes, disabled state, focus
  treatment, invalid fields, and native event behavior.
- Added `experimental/gantt-engine/demo/ui-primitives-storyboard.html`, showing
  the React reference markup beside the opt-in Web Component implementation.
- Existing experimental Gantt controls were not replaced; the primitives are
  available for new host surfaces.
- Updated `experimental/gantt-engine/docs/BILL_OF_MANIFEST.md`; no package was
  added.
- Verification: `node --check src/ui-primitives.js` passed. Browser smoke loaded
  the storyboard, confirmed both custom elements were registered, confirmed four
  experimental buttons rendered, toggled all experimental controls disabled,
  and observed native click event propagation without console errors.

### Logo dialog Web Component adoption (2026-08-18)

- Loaded `src/ui-primitives.js` from both experimental demo entry modules.
- Replaced the logo dialog Save and Cancel controls in `demo/index.html` and
  `demo/empty.html` with `pmis-button` elements.
- Extended action delegation and the dialog focus trap to recognize custom
  buttons while preserving command names and keyboard order.
- Verification: 47 unit tests passed. Browser verification confirmed the dialog
  renders both custom buttons and Tab order remains Choose image → Save logo →
  Cancel.

### Logo dialog primitive styling correction (2026-08-18)

- Removed legacy host-level background and hover overrides from
  `.project-logo-dialog__save`; those styles painted square corners behind the
  shadow button.
- The logo dialog now inherits the same rounded `pmis-button` surface as the
  storyboard for Save and Cancel.
- Browser visual verification confirmed both buttons render with the primitive's
  6px radius, and the custom Cancel action closes the dialog.


## Experimental engine: drag edge auto-pan (2026-08-19)

- `experimental/gantt-engine/src/interaction.js` now integrates edge auto-pan
  velocity in elapsed-time pixels per second, combining dwell time and pointer
  penetration within the 40px inside-edge activation band.
- Auto-pan covers schedule-affecting task move and start/end resize gestures.
  Reversal and neutral return decelerate through zero; release, cancellation,
  blur, unmount, and lost pointer capture stop the loop immediately.
- Pointer capture is held by the stable timeline viewport rather than the
  re-rendered task SVG node. Header/grid/rows/task preview continue to derive
  from the canonical timeline scroll position; the fixed task list remains
  vertical-only synchronized.
- Added deterministic velocity tests and browser scenarios for reversal, resize
  auto-pan, and dense-timeline overlap. Validation passed: 56 unit tests and
  29 Playwright scenarios.
- Manual verification remains for subjective throttle feel and visual tooltip
  synchronization against the supplied Tom’s Planner recording.

## Empty Gantt entry loading note (2026-08-19)

- `demo/empty.html` uses relative stylesheet/module paths so the entry resolves
  correctly when served from the experimental static server.
- Chromium blocks `empty.js` when the page is opened directly as `file://`
  because ES modules are rejected by the browser's file-origin CORS policy.
  The supported launch is `node tests/static-server.mjs`, then
  `http://127.0.0.1:4173/demo/empty.html`.

## Third-party drag research (2026-08-19)

- `interact.js` 1.10.28 was evaluated as a possible drag/resize lifecycle
  replacement. Its auto-scroll plugin uses an rAF loop and fixed
  pixels-per-second speed, not the confirmed gas curve.
- Live Chromium probes showed its delegated action lifecycle works on ordinary
  HTML elements but does not fire reliably for this re-rendered SVG task-bar
  surface. The user chose to keep the native SVG controller rather than add an
  HTML proxy or rewrite bars as HTML.
- The temporary dependency and script tags were removed. The native controller
  remains the supported interaction path.
