# PMIS Decision Ledger

This ledger records decisions that must survive across ChatGPT and Codex conversations.

## Rules

- Keep old entries; supersede them instead of deleting history.
- `CONFIRMED` requires explicit user approval.
- Link implementation evidence when status becomes `IMPLEMENTED` or `VERIFIED`.
- Do not copy every implementation detail here. Record choices that affect product behavior, architecture, thesis scope, data meaning, or future work.

## Entry Template

```md
### DEC-XXX — Short title

- Status: PROPOSED | CONFIRMED | IMPLEMENTED | VERIFIED | SUPERSEDED
- Date: YYYY-MM-DD
- Confirmed by: user | not yet confirmed
- Scope: product | UX | domain | architecture | data | implementation
- Supersedes: none | DEC-XXX
- Source: conversation or document reference

Decision:
Precise statement of the choice.

Rationale:
Why this choice exists.

Consequences:
- What implementations must do.
- What implementations must not do.

Evidence:
- Code, test, screenshot, or document references when applicable.

Open questions:
- None, or unresolved details that do not invalidate the decision.
```

## Existing Accepted Baseline

The baseline product rules already documented in `.agent/doc/AGENT_PRODUCT_KNOWLEDGE.md` remain authoritative and do not need to be duplicated as individual entries here. New entries override that baseline only when they explicitly name the affected rule and are `CONFIRMED`.

## Decisions

### DEC-001 -- Canvas-first project-manager workspace

- Status: CONFIRMED
- Date: 2026-08-08
- Confirmed by: user
- Scope: product | UX
- Supersedes: none
- Source: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`

Decision:
The project timeline is the primary project-manager workspace. Task information
remains connected to it, complexity is progressively disclosed, and a separate
task-oriented view serves inventory and operational triage rather than replacing
the timeline.

Rationale:
Project managers need substantial viewing and planning capability without the
simultaneous menu and navigation burden associated with heavier project tools.

Consequences:
- Keep the project representation visually and interactively primary.
- Match feedback and disclosed complexity to the user's current action and its
  significance.
- Do not turn the product into either a generic multi-module dashboard or an
  oversimplified single-purpose utility.

Evidence:
- User confirmation in the 2026-08-08 HCI discussion.
- Detailed record: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`.

Open questions:
- Exact navigation labels, secondary views, density controls, and role-specific
  experiences remain unconfirmed.

### DEC-002 -- Stable semantics with flexible viewing perspectives

- Status: CONFIRMED
- Date: 2026-08-08
- Confirmed by: user
- Scope: product | UX | domain
- Supersedes: none
- Source: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`

Decision:
Shared project meanings remain stable while users may create flexible viewing
perspectives. Presentation customization must not silently redefine operational
meanings such as completed, blocked, critical, or dependent.

Rationale:
Unbounded drawing flexibility damages shared understanding, while one rigid view
cannot represent every legitimate managerial question.

Consequences:
- Preserve system-owned operational semantics across views.
- Allow alternative grouping, filtering, emphasis, and saved perspectives within
  that shared semantic grammar.
- Do not assign conflicting personal and operational meanings to the same visual
  channel without a clear distinction.

Evidence:
- User confirmation in the 2026-08-08 HCI discussion.
- Detailed record: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`.

Open questions:
- The exact boundary between system-owned and user-controlled visual semantics
  remains unconfirmed.

### DEC-003 -- Layered project state and update authority

- Status: CONFIRMED
- Date: 2026-08-08
- Confirmed by: user
- Scope: product | UX | domain | data
- Supersedes: none
- Source: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`

Decision:
PMIS distinguishes baseline, current plan, actual state, forecast, history, and
scenario. Assignee reports may update actual state and inform forecasts, but
automatic or assignee-originated updates must not silently rewrite accepted
baselines or organizational commitments.

Rationale:
Observed events, inferred outcomes, intended plans, and accepted commitments have
different meanings and require different update rules.

Consequences:
- Keep observation, inference, intention, and commitment distinguishable.
- Allow current operational facts and derived forecasts to update without
  pretending they are approved plan revisions.
- Require deliberate action to change accepted planning commitments.
- Do not represent an unfinished task as continuously active merely by extending
  its actual bar to the present.

Evidence:
- User confirmation in the 2026-08-08 HCI discussion.
- Detailed record: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`.

Open questions:
- Exact permissions, verification policy, forecast-confidence treatment, and
  approval workflow remain unconfirmed.

### DEC-004 -- Linear official history with bounded scenarios

- Status: CONFIRMED
- Date: 2026-08-08
- Confirmed by: user
- Scope: product | UX | domain | data
- Supersedes: none
- Source: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`

Decision:
The project has one official current planning line with meaningful immutable
checkpoints. Historical checkpoints are read-only; continuing from one creates a
bounded scenario. Adopting or restoring a scenario creates a new official
checkpoint without erasing later history or actual events.

Rationale:
Preserved history and safe alternative planning are valuable, but a full branching
graph, rebasing, and technical merge model would add unnecessary cognitive and
governance complexity.

Consequences:
- Separate detailed activity history from user-facing planning checkpoints.
- Keep scenarios shallow, limited, and visibly non-operational until adopted.
- Compare consequences before a scenario becomes the current plan.
- Record adoption, restoration, authorship, and rationale as new history rather
  than rewriting existing history.
- Do not expose deep branching, rebasing, or literal version-control merging as
  ordinary PMIS operations.

Evidence:
- User confirmation in the 2026-08-08 HCI discussion.
- Detailed record: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`.

Open questions:
- Scenario quantity and ownership are resolved by DEC-009. Scenario refresh
  behaviour and detailed adoption controls remain unconfirmed. The term
  `checkpoint` is refined to `Key Moment` by DEC-007. DEC-010 clarifies that
  adoption must pass through Approved Baseline before Active Plan activation.

### DEC-005 -- Timeline naming and configurable Project Authority Map

- Status: CONFIRMED
- Date: 2026-08-09
- Confirmed by: user
- Scope: product | UX | domain
- Supersedes: none
- Source: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`

Decision:
`Timeline` is the user-facing name of the primary project viewing and planning
workspace. Baseline governance is represented by a `Project Authority Map`. Its
default `Standard Project Authority` path is: the Project Manager proposes,
affected Workstream Leads acknowledge feasibility and impact, and the Project
Sponsor gives final approval.

The acknowledgement step is informative and accountable but is not a separate
approval or automatic veto. Projects may select simpler owner-led governance or
add appropriate specialist, client, steering, or compliance stages while keeping
one clearly identified final authority.

Rationale:
A visible authority relationship explains who may do what and why without relying
on a dense permission table. A default prevents governance configuration from
becoming mandatory setup, while constrained variations support projects with
different accountability structures.

Consequences:
- Use `Timeline` consistently for the primary workspace.
- Use `Project Authority Map` for the project-level governance representation.
- Apply Standard Project Authority by default instead of requiring users to build
  a governance graph from scratch.
- Treat affected Workstream Lead review as acknowledgement, not approval.
- Route approval according to the kind and consequence of the commitment, not
  organizational rank alone.
- Do not send ordinary assignee reports or every task adjustment through baseline
  approval.
- Preserve the authority context of historical approvals when the current map is
  later changed.

Evidence:
- User confirmation in the 2026-08-09 HCI discussion.
- Detailed record: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`.

Open questions:
- Authority delegation, collective quorum rules, and detailed approval triggers
  remain unconfirmed.

### DEC-006 -- Timeline state names

- Status: CONFIRMED
- Date: 2026-08-12
- Confirmed by: user
- Scope: product | UX | domain
- Supersedes: none
- Source: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`

Decision:
The confirmed user-facing project-state names are `Active Plan`, `Approved
Baseline`, `Actual Progress`, `Forecast`, `Scenario`, and `Plan History`.

Rationale:
Consistent names distinguish the schedule currently being followed, the formal
comparison reference, observed or reported work, expected future outcomes,
non-operational alternatives, and recorded project memory.

Consequences:
- Use these names consistently when presenting project-state layers in Timeline
  and other views.
- Do not collapse these states into a binary planned/real model.
- Do not imply that Actual Progress, Forecast, or a Scenario is an approved
  organizational commitment.

Evidence:
- User confirmation in the 2026-08-12 HCI discussion.
- Detailed record: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`.

Open questions:
- The visual encoding and interaction treatment of these states remain
  unconfirmed.

### DEC-007 -- Read-only Change Records and named Key Moments

- Status: CONFIRMED
- Date: 2026-08-12
- Confirmed by: user
- Scope: product | UX | domain | data
- Supersedes: none; refines the user-facing `checkpoint` wording in DEC-004
- Source: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`

Decision:
`Plan History` contains read-only, filterable `Change Records`. An important,
named Change Record preserved for navigation and reference is called a `Key
Moment`. An `Approved Baseline` is a formally approved Key Moment.

One initiating action and its automatic downstream effects are grouped as one
Change Record. Corrections append a new record rather than modifying historical
records. Users may inspect the project at a historical record or Key Moment, but
continuing from history requires creating a Scenario.

Rationale:
The transaction-record model supports auditability and detailed investigation,
while Key Moments prevent users from navigating an overwhelming sequence of
minor changes. The names are more understandable than exposing versions or
checkpoints as competing concepts.

Consequences:
- Use `Change Record` for an audit entry and `Key Moment` for an important named
  historical reference.
- Treat earlier user-facing references to `checkpoint` in DEC-004 as `Key
  Moment`; DEC-009 separately refines Scenario ownership and quantity.
- Keep historical records read-only and filterable.
- Preserve corrections and automatic consequences as traceable history.
- Do not expose every small update as a Key Moment.

Evidence:
- User confirmation in the 2026-08-12 HCI discussion.
- Detailed record: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`.

Open questions:
- The exact closed action vocabulary and the formal lifecycle events that receive
  automatic Key Moment labels remain unconfirmed.

### DEC-008 -- Complete automatic Change Record history

- Status: CONFIRMED
- Date: 2026-08-12
- Confirmed by: user
- Scope: product | UX | domain | data
- Supersedes: none; refines DEC-007
- Source: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`

Decision:
Every project event and direct Timeline modification automatically creates a
read-only Change Record using a closed action vocabulary. Plan History exposes the
complete searchable and filterable record rather than hiding actions according to
an inferred significance threshold. Users are not required to justify every
ordinary action.

Key Moments are automatic labels for defined formal lifecycle events; they do not
replace or hide ordinary Change Records.

Rationale:
Complete transaction-like recording supports audit and investigation without
requiring the application to infer which ordinary actions matter to a particular
team.

Consequences:
- Record direct changes and automatic downstream effects consistently.
- Group one initiating action and its automatic consequences into one record.
- Append corrections rather than rewriting prior history.
- Make the full record searchable and filterable.
- Do not require manual history creation or a reason for every ordinary action.

Evidence:
- User confirmation in the 2026-08-12 HCI discussion.

Open questions:
- The exact action vocabulary and automatic Key Moment event list remain to be
  defined with the component model.

### DEC-009 -- Single-owner private Scenarios

- Status: CONFIRMED
- Date: 2026-08-12
- Confirmed by: user
- Scope: product | UX | domain | data
- Supersedes: DEC-004 only where `bounded scenarios` implied a quantity limit;
  the single official line and no-merge/no-rebase boundaries remain in force
- Source: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`

Decision:
A Scenario is an unlimited, private-by-default what-if laboratory with exactly one
owner and editor. It may be shared read-only indefinitely. A viewer who wants to
modify it creates a new independently owned Scenario based on the shared state.

Derived Scenarios preserve their origin but do not synchronize, merge, or rebase
with their source. PMIS facilitates promotion but does not prescribe how users
explore or compare alternatives.

Rationale:
Single ownership preserves the authorship and integrity of a planning argument.
Read-only sharing supports review without allowing another person to unexpectedly
rewrite the owner's Timeline.

Consequences:
- Do not provide multi-author Scenario editing.
- Keep sharing read-only.
- Allow unlimited private Scenarios and independent derivation from a shared
  Scenario.
- Preserve source attribution without creating a version-control graph.

Evidence:
- User confirmation in the 2026-08-12 HCI discussion.

Open questions:
- None for the core ownership and sharing model; detailed access control is
  deferred to component-level RBAC.

### DEC-010 -- Approved Baseline required before Active Plan activation

- Status: CONFIRMED
- Date: 2026-08-12
- Confirmed by: user
- Scope: product | UX | domain | data
- Supersedes: none; clarifies DEC-003 and DEC-004
- Source: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`

Decision:
A Scenario cannot become the Active Plan directly. It must first pass through the
Project Authority Map and become an Approved Baseline. An Approved Baseline may
remain inactive; only an Approved Baseline can be activated as the Active Plan.

If Actual Progress exists, activation attempts to reconcile the new baseline with
recorded facts. The system explains compatible, review-required, and unreconcilable
changes and warns that automatic reconciliation is not universally successful.
The user chooses whether to continue with the reconciled result. Actual Progress,
previous plans, baselines, and Change Records remain preserved.

Rationale:
Approval establishes legitimacy before a plan becomes operational, while
reconciliation allows an approved alternative to be introduced without pretending
that recorded project reality did not happen.

Consequences:
- Enforce Scenario -> Approved Baseline -> Active Plan ordering.
- Keep approval and activation as distinct actions.
- Preserve inactive Approved Baselines.
- Reconcile against Actual Progress before activation and disclose limitations.
- Never erase factual or audit history as a side effect of activation.

Evidence:
- User correction and confirmation in the 2026-08-12 HCI discussion.

Open questions:
- Exact reconciliation conflict handling and effective-date behaviour remain
  unconfirmed.

### DEC-011 -- Calculated Forecast and bounded task-change proposals

- Status: CONFIRMED
- Date: 2026-08-12
- Confirmed by: user
- Scope: product | UX | domain
- Supersedes: none
- Source: `.agents/docs/PMIS_AGREED_PRODUCT_DIRECTION.md`

Decision:
Forecast is derived from supported planning inputs and dependency analysis,
including PERT/CPM, and is presented as a distinct Timeline function. Users revise
Forecast through supported inputs rather than arbitrary manual replacement of the
calculated result.

Task completion requires an assignee report followed by confirmation from the
task's listed approver. An assignee may request a date change; that request creates
a restricted Task Change Proposal and proposed forecast visible to the Project
Manager and/or relevant supervisor. It is not a project Scenario branch.

Direct dependency consequences remain visible in real time, while Change Records
and notifications provide awareness. PMIS does not judge whether a user's planning
choice is organizationally wise.

Rationale:
This keeps calculated schedule intelligence distinct from arbitrary opinion,
supports accountable completion, and gives task-level change requests a bounded
review space without multiplying project Scenarios.

Consequences:
- Recalculate Forecast when supported inputs change and record the update.
- Keep PERT/CPM Forecast access distinct within Timeline.
- Require confirmation of reported completion.
- Treat requested task-date changes as Task Change Proposals.
- Preserve existing real-time dependency propagation as the immediate schedule
  consequence feedback.

Evidence:
- User confirmation in the 2026-08-12 HCI discussion.

Open questions:
- Forecast confidence presentation, task approver assignment, and detailed action
  permissions remain deferred.

### DEC-012 -- Unified Timeline task authoring interactions

- Status: VERIFIED
- Date: 2026-08-12
- Confirmed by: user
- Scope: product | UX | implementation
- Supersedes: none; applies DEC-001 and preserves DEC-011
- Source: `.agent/task/001-unionizing-ui.md` and user confirmation in the
  2026-08-12 implementation conversation

Decision:
Timeline task creation, editing, and deletion are core features. Every task must
belong to a workstream. Users may create a task from its Timeline date context or
from a hover-revealed action on a workstream header; if no workstream exists, the
creation flow first explains and creates the required workstream.

Task deletion is available from both Timeline bars and task-list rows through one
confirmation flow. Deleting recursive dependent descendants is explicit and
optional. When the selected task is the workstream's only task, deleting the
workstream is also an explicit optional choice.

The task inspector uses pencil, save, and cancel controls. Edit mode covers
user-authored task fields. Calculated Forecast, completion confirmation,
dependent links, comments, and history remain derived, governed, or read-only in
accordance with DEC-011. Affirmative dialog actions precede cancellation actions
for keyboard-centric operation.

The core automated strategy is focused unit testing plus Playwright interaction
testing. Broader integration testing is deferred.

Rationale:
The Timeline is the primary workspace and must provide discoverable, consistent
task-authoring paths without weakening workstream grouping or governed planning
semantics.

Consequences:
- Reuse shared creation and deletion flows across Timeline and task-list entry
  points.
- Keep workstream membership mandatory and independent from dependency hierarchy.
- Treat "children" in task deletion as all recursive dependent descendants.
- Clean dependency references after deletion and make each mutation undoable.
- Keep Forecast and completion state outside ordinary inspector editing.
- Maintain focused unit and Playwright coverage; integration coverage may be
  added later.

Evidence:
- `components/pmis/task-create-dialog.tsx`
- `components/pmis/task-delete-dialog.tsx`
- `components/pmis/task-edit-form.tsx`
- `components/pmis/context-inspector.tsx`
- `components/pmis/task-list-panel.tsx`
- `components/pmis/gantt-chart.tsx`
- `lib/pmis-store.ts`
- `lib/domain/task-mutations.ts`
- `tests/unit/task-mutations.test.ts`
- `tests/e2e/timeline-task-flows.spec.ts`
- 2026-08-13 verification: 3 unit tests and 2 Playwright scenarios passed;
  strict TypeScript, `git diff --check`, and the production build passed.

Open questions:
- Integration testing remains deferred by explicit user choice.

### DEC-013 -- One-elbow adaptive dependency routing

- Status: SUPERSEDED
- Date: 2026-08-23
- Confirmed by: user
- Scope: UX | implementation
- Supersedes: the previous multi-elbow geometry within the protected adaptive
  dependency connector routing rule
- Source: user confirmation during experimental Gantt connector refinement

Decision:
Every committed dependency connector uses one orthogonal L route: exactly two
straight segments joined by one 90-degree elbow. With sufficient horizontal
clearance, the route travels vertically and then enters the dependent from the
left. In cramped layouts, it travels horizontally and then approaches the nearest
vertical edge: the top when the dependent is below, or the bottom when it is
above.

Connector strokes retain a forgiving invisible hover corridor. Hover-revealed
direction cues remain segment-based, so an L route can display at most two cues.

Timeline Settings exposes normal connector width from 1px to 3px in 0.5px steps
and direction cue size from 3px to 8px in 1px steps. Defaults remain 1.5px and
6px. Critical connectors render at 1.33 times the selected normal width.
Appearance preferences do not change routing, cue eligibility, or the 12px
invisible hover corridor.

Rationale:
Repeated elbows make connector direction harder to parse and create repeated cue
arrows. A one-elbow L preserves adaptive entry while reducing visual noise. A
wider invisible hit target removes the need to position the pointer precisely on
the visible thin stroke.

Consequences:
- Do not render committed dependency routes with more than one elbow.
- Keep route traversal ordered from predecessor to dependent.
- Use the nearest top or bottom edge for cramped vertical entry.
- Keep the visible connector stroke thin while using a wider invisible hit area.
- Preserve progressive disclosure, continuous strokes, and dependency semantics.
- Treat line width and cue size as saved timeline appearance preferences.
- Preserve the 12px cue-eligibility threshold at every allowed cue size.
- Scale critical connector width by 1.33 and round to two decimal places.

Evidence:
- User confirmation on 2026-08-23.
- `experimental/gantt-engine/src/dependencies.js`
- `experimental/gantt-engine/src/renderer.js`
- `experimental/gantt-engine/tests/gantt-kernel.test.mjs`
- `experimental/gantt-engine/tests/e2e/gantt.spec.mjs`
- 2026-08-23 empty-demo browser verification: one-elbow
  `M 128 18 V 54 H 320` route, two direction cues, and successful cue reveal
  from 5px outside the visible stroke.
- 2026-08-23 completion gate: 58 Node tests and 37 Playwright scenarios passed
  with a clean exit.
- 2026-08-23 appearance verification: **Timeline Settings** saved 3px line
  width and 8px cue size, the committed SVG rendered those dimensions, and
  cancelling 1px and 3px drafts preserved the saved values.
- 2026-08-23 appearance completion gate: 59 Node tests and 37 Playwright
  scenarios passed with a clean exit.

Open questions:
- None. DEC-014 supersedes the one-elbow route limit while carrying forward the
  appearance preferences and hover corridor. The React PMIS Gantt renderer still
  requires migration; it is outside the current experimental-engine task.
 
### DEC-014 -- Tom-style adaptive dependency routing

- Status: VERIFIED
- Date: 2026-08-23
- Confirmed by: user
- Scope: UX | implementation
- Supersedes: DEC-013 route geometry; preserves its appearance preferences and
  hover corridor
- Source: user-provided Tom's Planner screenshots and current conversation

Decision:
Committed dependency connectors use at most two elbows. Distant dependents use a
short predecessor exit, a vertical trunk, and a horizontal tail that enters the
dependent from the left. Cramped dependents omit the tail and use one elbow to
approach the nearest top or bottom edge.
Vertical-entry routes terminate exactly on the dependent bar. A visual endpoint
gap is not part of the connector contract.

Rationale:
The Tom's Planner pattern keeps the predecessor exit stable, makes long vertical
relationships easy to trace, and removes unnecessary repeated bends. A strict
one-elbow route cannot reproduce distant left-entry examples.

Consequences:
- Use `DEPENDENCY_ELBOW_GAP` for the predecessor exit and route-selection
  clearance.
- Render no more than three straight segments and two elbows.
- Keep at most one direction cue on each eligible segment.
- Preserve configurable line width, configurable cue size, the 12px hover
  corridor, progressive disclosure, and scheduling semantics.
- Terminate committed connectors on the destination bar edge without a gap.

Evidence:
- User-provided close, distant, long-vertical, and wide-route screenshots.
- `experimental/gantt-engine/src/dependencies.js`
- `experimental/gantt-engine/tests/gantt-kernel.test.mjs`
- 2026-08-23 empty-demo browser verification:
  `M 128 18 H 146 V 54 H 480` rendered the confirmed predecessor exit,
  vertical trunk, and target tail.
- 2026-08-23 completion gate: 60 Node tests and 38 Playwright scenarios passed
  with a clean exit.
- 2026-08-23 endpoint verification: cramped route
  `M 256 18 H 260 V 42` and its destination bar shared the exact `y=42`
  boundary.
- 2026-08-23 preview verification: a 120-event burst on the 240-task fixture
  retained one preview node, caused zero child-list mutations, and settled in
  22ms across two animation frames.
- 2026-08-23 completion gate: 60 Node tests and 39 Playwright scenarios passed
  with a clean exit.

Open questions:
- None.

### DEC-015 -- Half-day timeline interaction grid

- Status: VERIFIED
- Date: 2026-08-23
- Confirmed by: user
- Scope: UX | scheduling | implementation
- Supersedes: the previous one-day default snap increment
- Source: user confirmation in the current conversation

Decision:
Task movement, start resizing, and end resizing snap to the nearest half-day.
Context creation selects the half-day region containing the pointer. New tasks
always receive a one-day initial duration. The minimum resized duration is one
half-day.

Day, week, and month views remain available. Resize hit zones shrink to half the
bar width when a half-day bar is narrower than 20px, preventing start and end
targets from overlapping.

Rationale:
Half-day snapping matches the Tom's Planner reference without removing existing
timeline scales or silently reducing the initial duration of newly created tasks.

Consequences:
- Resolve positive and negative half-step ties symmetrically.
- Preserve exact noon timestamps through dependency clamping and recursive
  forward propagation.
- Keep new-task duration independent from snap increment.
- Verify movement, both resize edges, creation, propagation, and short-bar
  handles with permanent unit and Playwright coverage.

Evidence:
- `experimental/gantt-engine/src/timeline.js`
- `experimental/gantt-engine/src/scheduling.js`
- `experimental/gantt-engine/src/engine.js`
- `experimental/gantt-engine/src/renderer.js`
- `experimental/gantt-engine/tests/gantt-kernel.test.mjs`
- `experimental/gantt-engine/tests/e2e/gantt.spec.mjs`
- 2026-08-23 browser verification: movement, start resize, and end resize each
  committed a 12-hour change; context creation retained a 24-hour duration.
- 2026-08-23 completion gate: 60 Node tests and 38 Playwright scenarios passed
  with a clean exit.

Open questions:
- None.
