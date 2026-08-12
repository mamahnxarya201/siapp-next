# PMIS Technical Architecture Handoff

Date: 2026-08-12

## Implemented boundary

The Gantt interaction remains an imperative preview interaction. Pointer movement
does not write to React or Zustand on every frame. The final snapped edit is
applied once on release.

Domain rules are framework-independent and live under `lib/domain/`:

- `scheduling.ts` implements forward-only recursive propagation and direct
  predecessor minimum-start clamping.
- `forecast.ts` calculates PERT expected duration and CPM earliest/latest dates,
  slack, and critical-path membership.
- `reconciliation.ts` classifies baseline activation differences as compatible,
  requires review, or unreconcilable.
- `planning-types.ts` defines Active Plan, Approved Baseline, Scenario, Actual
  Progress, Forecast, Change Records, and Task Change Proposals.
- `pmis-adapter.ts` maps the existing mock `Task` shape to the planning domain.

Zustand remains the client session/view state owner. It now exposes forecast
calculation and two-step completion actions, but the reusable scheduling and
forecast algorithms do not depend on Zustand.

## SQLite adapter

`lib/persistence/planning-repository.ts` is the database-neutral repository port.
`lib/persistence/sqlite-planning-repository.server.ts` is the local SQLite
implementation. It uses Node 26's built-in `node:sqlite` driver and a small typed
query-builder/POJO mapper boundary. The schema stores revision payloads as JSON
while keeping project, revision, audit, and proposal indexes relational.

The adapter is intentionally isolated. A future PostgreSQL or Supabase adapter
should implement `PlanningRepository` and reuse the domain/application modules;
the React UI and domain rules should not import a database driver.

Local database path can be changed with `PMIS_SQLITE_PATH`. The default is
`pmis.local.sqlite`, which is ignored by git.

Read-only endpoints are available at:

- `GET /api/planning/history?projectId=<id>`
- `GET /api/planning/revisions?projectId=<id>`
- `POST /api/planning/commands` with `create_scenario`, `submit_scenario`,
  `approve_scenario`, `activate_baseline`, `schedule_task`, or
  `create_task_change_proposal` actions.

## Application service

`lib/application/planning-service.ts` coordinates repository writes and domain
rules for:

- private single-owner Scenario creation;
- Scenario submission;
- Scenario -> Approved Baseline approval;
- Approved Baseline -> Active Plan activation;
- Actual Progress reconciliation;
- schedule changes and grouped automatic downstream effects;
- Task Change Proposal creation with calculated proposed Forecast.

The service records the accepted closed Change Record vocabulary from DEC-008.

## Approver model

`Task.approverId` is optional and currently defaults newly created mock tasks to
`u1`. This is intentionally a temporary task-level field until the Project
Authority Map and component-level RBAC are implemented.

Completion is represented as two client actions:

1. the assignee reports completion;
2. the task approver confirms completion.

## Known follow-up work

- Connect the current fixture workspaces to `PlanningRepository` through server
  commands rather than direct client-memory mutation.
- Add completion-report/confirmation commands and authenticated actor resolution
  to the write API.
- Add integration tests against a temporary SQLite database.
- Add a PostgreSQL/Supabase adapter after DBA schema and auth decisions.
- Replace static fixture `isCriticalPath` rendering with `getCurrentForecast()`
  output throughout the Gantt and dashboard surfaces.
- Add visible Plan History, Forecast, Scenario, and baseline controls without
  changing the confirmed Timeline architecture.
