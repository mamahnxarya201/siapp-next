# PMIS Current State

Last updated: 2026-08-08

## Current Objective

Implement the first local-prototype task authoring workflow without committing to a
database design: reusable task creation, dependency-aware scheduling, optional
Gantt-context defaults, and safe workstream CRUD.

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

## Completed Work

- Read the repository operating contract, product knowledge, dependency-rendering
  rules, initial implementation handoff, decision ledger, and handoff protocol.
- Inspected the active revision, working tree, package configuration, application
  structure, PMIS state/data modules, and core UI implementation.
- Initialized this file from verified repository evidence without modifying
  implementation or accepted product behavior.
- Implemented local task creation and workstream management while preserving
  group/dependency independence and forward-only schedule propagation.

## Files Changed in Latest Work

- `.agent/handoff/CURRENT_STATE.md`
- `components/pmis/context-inspector.tsx`
- `components/pmis/gantt-chart.tsx`
- `components/pmis/pmis-app.tsx`
- `components/pmis/task-create-dialog.tsx`
- `components/pmis/task-list-panel.tsx`
- `components/pmis/top-nav.tsx`
- `lib/pmis-data.ts`
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

Discuss and confirm the persistence/domain model before wiring these client actions
to PostgreSQL. A smaller independent next step is task editing/reassignment so
populated workstreams can be safely deleted or consolidated.
