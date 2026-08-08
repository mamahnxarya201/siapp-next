# PMIS Current State

Last updated: 2026-08-08

## Current Objective

Provide isolated, deterministic mock workspaces for each dashboard project so the
prototype can exercise empty-state authoring, long-content layout, dense Gantt
dependencies, and schedule/rendering boundaries without a database.

## Thesis Source Materials

- This repository implements the user's academic thesis project; thesis source material in the user's connected Google Drive is part of the PMIS project context.
- Use the newer Google Drive folder **Referensi Skripsi** (created May 2026) as the active reference collection: https://drive.google.com/drive/folders/1vTT8oYGGB3clhG7-MQbcIyas0bVjy4ij
- The working thesis Google Doc is **skripsi lurd**: https://docs.google.com/document/d/1kqOoOBZuE-b9MCwvWsFi7XSHTK0f4f16xHF1N90Cs0U
- The document is stored alongside, rather than inside, the newer reference folder. Do not edit it unless the user explicitly requests a specific change.

## Verified Repository State

- Repository: Next.js 16.2.6 App Router application using React 19, TypeScript,
  Tailwind CSS 4, shadcn/Radix UI components, Zustand 5, and mock in-memory data.
- Active branch: `master`, tracking `origin/master`.
- Inspected revision: `47ca2508844620fa7e04a219234d9877fb38c4d0`
  (`Update application features and supporting components`).
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
- PERT input fields are stored and displayed. Critical-path membership is
  currently static mock-data metadata; no CPM/PERT calculation engine for
  earliest/latest dates, slack, or computed critical path was found.
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

## Files Changed in Latest Work

- `.agent/handoff/CURRENT_STATE.md`
- `app/globals.css`
- `components/pmis/dashboard-view.tsx`
- `components/pmis/gantt-chart.tsx`
- `components/pmis/pmis-app.tsx`
- `components/pmis/project-view.tsx`
- `components/pmis/task-list-panel.tsx`
- `components/pmis/top-nav.tsx`
- `lib/pmis-project-fixtures.ts`
- `lib/pmis-store.ts`

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
- Academic/backend scope remains incomplete: CPM/PERT calculation and PostgreSQL
  persistence are required by product knowledge but are not implemented in the
  current frontend prototype.
- Newly created tasks and workstream mutations remain client-memory state and are
  intentionally not persisted while database design is on hold.
- Populated workstream deletion requires a future task reassignment/editing flow;
  until then, only empty workstreams can be deleted.
- Lint cannot run until a flat ESLint configuration compatible with ESLint 10 is
  added or the lint toolchain is otherwise aligned.
- Automated behavioral tests are absent.

## Next Action

Use the focused project fixtures as the manual regression matrix for future Gantt
and layout changes. Persistence still requires a confirmed domain model before
these isolated client workspaces are wired to PostgreSQL; task editing/reassignment
remains the smallest independent product step.
