# Planning UI Implementation Handoff

Date: 2026-08-12

This document is now present in the repository as the durable UI handoff. The
initial user-provided link referred to this filename, but it did not exist at
the start of the UI implementation. It has been created from the confirmed
decision ledger, current state, and existing planning architecture.

## Implemented UI

`components/pmis/planning-panel.tsx` provides a right-side progressive-disclosure
panel opened from the project-scoped `Planning` button in the top navigation.
The Timeline remains the primary workspace; planning intelligence is secondary
and contextual.

Tabs:

- `Forecast`: calculated finish, critical-task count, slack, and PERT/CPM
  explanation.
- `Plan History`: read-only Change Records loaded from
  `/api/planning/history?projectId=...`.
- `Scenarios`: private Scenario list and `New Scenario`, which snapshots the
  current Active Plan through `/api/planning/commands`.
- `Approved Baselines`: immutable baseline list and lifecycle explanation.
- `Task Change Proposals`: bounded task-level proposal surface and explanation.

The task inspector continues to expose task-level Forecast details and the
assignee-report/approver-confirm completion flow.

## Visual and interaction contract

- Active Plan remains the main Gantt editing surface.
- Forecast is represented in the planning panel and task inspector; it is
  derived, not manually editable.
- History is read-only and displays initiating effects separately from automatic
  downstream effects.
- Scenario creation is private-by-default and single-owner.
- Baselines are presented as approved, immutable references.
- Proposal UI is intentionally informational until proposal list/review API
  endpoints exist.
- The planning panel is a Sheet so it does not change the existing three-panel
  layout width during Gantt dragging.

## Data/API dependencies

- `GET /api/planning/history?projectId=<id>`
- `GET /api/planning/revisions?projectId=<id>`
- `POST /api/planning/commands` action `create_scenario`

The current SQLite database is empty unless commands have been executed. The UI
therefore provides explicit empty states rather than fabricating history or
approval records.

## Follow-up UI work

- Add scenario editing/derivation and read-only sharing controls.
- Add scenario submission and authority acknowledgement/approval actions.
- Add reconciliation result review before activation.
- Add baseline activation action and conflict summary.
- Add proposal list/review endpoints and approve/reject controls.
- Add authenticated current-user and Authority Map data instead of the current
  `u1` prototype actor.
- Add a calculated Forecast rendering layer to Gantt bars when the visual encoding
  is explicitly confirmed; do not alter the imperative drag preview path.
