# PMIS Agreed Product Direction

- Status: CONFIRMED CONCEPTUAL DIRECTION
- Confirmed by: user
- Date: 2026-08-08
- Scope: product, UX, interaction model, project-state semantics
- Implementation status: not evaluated by this document
- Canonical decision index: `.agent/handoff/DECISIONS.md`

## Purpose

This document records the product and interaction direction explicitly agreed in
the PMIS HCI discussion. It also records the alternatives that were considered
but not retained, so future work does not accidentally reintroduce them as
accepted requirements.

This document does not specify technical implementation. Details that were not
explicitly agreed remain open rather than being inferred here.

## Agreed Direction

### Primary experience

- The primary user is the project manager.
- **Timeline** is the confirmed user-facing name of the primary workspace for
  project viewing and planning.
- The product should provide substantial capability without confronting users
  with every capability simultaneously.
- Complexity should appear progressively according to the user's attention,
  current question, and the consequences of an action.
- Task information should remain connected to the timeline. A separate task view
  is appropriate for inventory, filtering, and operational triage rather than as
  a replacement for the timeline.

### Shared semantics and flexible perspectives

- Project semantics must remain consistent across the organization.
- Users may create different perspectives through grouping, filtering, zooming,
  visible fields, annotations, and saved views.
- Users may customize presentation, but must not silently redefine shared
  meanings such as completed, blocked, critical, or dependent.
- The governing principle is: users may create perspectives, but they should not
  silently create new meanings.

### Progressive consequence feedback

- Planning actions should form a feedback loop: action, immediate visible result,
  affected relationships, significant consequence summary, and an opportunity to
  keep, revise, or reverse the change.
- Feedback should be proportional to impact.
- Small isolated changes should remain fluid and reversible.
- Dependency effects should become visible when relevant.
- Changes that threaten milestones or organizational commitments should receive
  stronger consequence feedback.
- Changes to an accepted baseline must be deliberate.

### Project-state model

- The project model distinguishes baseline, current plan, actual state, forecast,
  history, and scenario.
- The confirmed user-facing state names are:
  - **Active Plan** for the current operational schedule.
  - **Approved Baseline** for the immutable, formally accepted comparison
    reference.
  - **Actual Progress** for reported or observed project events and progress.
  - **Forecast** for the currently expected future outcome.
  - **Scenario** for a non-operational alternative plan.
  - **Plan History** for Change Records, Key Moments, authorship, and rationale.
- The baseline is an accepted plan and must not change automatically.
- The current plan is the latest intended operational plan.
- Actual state represents reported or observed events.
- Forecast represents what is currently expected, not what has already happened
  or what has been formally committed.
- History preserves meaningful changes, authorship, time, and rationale.
- A scenario is an alternative planning exploration that does not automatically
  become operational reality.
- The design should preserve the distinction between observation, inference, and
  organizational commitment.

### Assignee participation

- An assigned user may interact with their own task to report progress,
  completion, blockers, and expected delay.
- Assignee updates may change actual state and inform the forecast.
- An assignee update must not silently rewrite an accepted baseline or an
  organizational commitment.
- Observed reality may update continuously, forecasts may update automatically,
  and organizational commitments should change deliberately.

### Change Records, Key Moments, and scenarios

- PMIS borrows preserved history, explicit authorship, meaningful before-and-after
  comparison, reversible decisions, protected Key Moments, and safe scenario
  exploration from version-control thinking.
- PMIS does not borrow version-control terminology or graph-management complexity
  as the ordinary user experience.
- The project has one official current planning line.
- **Change Records** form the read-only, filterable audit trail of every project
  event and direct Timeline modification. Actions use a closed, defined event
  vocabulary so records remain consistent and auditable.
- All Change Records remain available in the history list. The product does not
  hide ordinary records behind a significance judgement; users may search and
  filter the complete record.
- Change Records include authorship, time, before-and-after values, and automatic
  effects. The application does not require the user to justify every change.
- Corrections append a new Change Record rather than rewriting the earlier record.
- One initiating action and its automatic downstream effects should be grouped as
  one Change Record so cause and consequences remain understandable.
- **Key Moment** is the confirmed user-facing name for a formal historical event
  preserved for easy navigation and reference. Key Moments are produced
  automatically by defined lifecycle events rather than by asking users to judge
  whether a change was significant.
- Ordinary activity remains fully visible as Change Records without being
  promoted to Key Moments.
- Historical Change Records and Key Moments are read-only.
- Continuing work from a historical Change Record or Key Moment creates a
  Scenario rather than overwriting the live project.
- A Scenario is a private what-if laboratory with exactly one owner. Only the
  owner edits it.
- Scenarios are private by default, may be shared read-only for as long as the
  owner chooses, and are unlimited in number.
- A viewer who wants to modify a shared Scenario creates an independent Scenario
  from it. The derived Scenario records its origin but does not synchronize,
  merge, or rebase with its source.
- Scenario exploration is not required to converge or follow a prescribed path.
  PMIS facilitates promotion when the owner decides the what-if is ready.
- Restoring an older plan creates a new revision and does not erase later history
  or actual events.
- An **Approved Baseline** is a formally approved Key Moment and remains an
  immutable first-class comparison reference.
- Detailed Change Records and named Key Moments are related but distinct
  concepts.

### Scenario approval, activation, and reconciliation

- A Scenario cannot become the Active Plan directly.
- The required lifecycle is:
  1. A Scenario is submitted through the applicable Project Authority Map.
  2. Approval creates an immutable Approved Baseline.
  3. The Approved Baseline may remain inactive until the user chooses or schedules
     activation.
  4. Only an Approved Baseline may be activated as the Active Plan.
- Approval makes a plan legitimate; activation makes that approved plan
  operational.
- Activating a new Approved Baseline replaces the previous Active Plan but does
  not remove the previous plan, baseline, Actual Progress, or Change Records from
  Plan History.
- When Actual Progress already exists, activation attempts to reconcile the new
  Approved Baseline with those facts.
- Reconciliation preserves completed work and recorded facts, applies compatible
  planning changes, and identifies changes that require review or cannot be
  applied automatically.
- Before activation, the user is shown what can be applied, what requires review,
  what cannot be reconciled, and that reconciliation does not work perfectly in
  every case. The user decides whether to continue with the reconciled result.

### Forecast and direct schedule consequences

- Forecast is derived from supported project inputs and dependency analysis,
  including PERT/CPM, and is accessed as a distinct Timeline function.
- Users do not overwrite Forecast by typing an arbitrary forecast result. They
  revise supported planning inputs, after which Forecast is recalculated and the
  change is recorded.
- Direct scheduling consequences remain visible in real time. For example,
  forward dependency propagation moves affected dependent bars when a predecessor
  violates their minimum-start constraints.
- Change Records and notifications provide awareness of what changed. PMIS does
  not attempt to decide whether a user's planning judgement is organizationally
  wise.

### Task completion and task-change proposals

- Task completion uses two steps: the assignee reports the task as done, then the
  approver listed for that task confirms completion.
- An assignee may request a task-date change.
- A requested date change produces a restricted proposed forecast visible to the
  Project Manager and/or the relevant supervisor.
- This temporary task-level planning space is a **Task Change Proposal**, not a
  project Scenario branch. It exists to review a bounded task change without
  overloading the Scenario concept.
- Detailed component-level permissions, including who may perform each action,
  are intentionally deferred until the component model is complete.

### Project authority and baseline approval

- **Project Authority Map** is the confirmed name for the visible governance
  representation that explains who may propose, acknowledge, approve, and be
  informed about planning decisions.
- The Authority Map represents governance functions and relationships, not only
  organizational rank or a flat permission table.
- The default governance preset is **Standard Project Authority**:
  1. The Project Manager prepares and proposes the baseline.
  2. Affected Workstream Leads acknowledge that they reviewed its feasibility and
     impact.
  3. The Project Sponsor gives final approval and makes it an Approved Baseline.
- Workstream Lead acknowledgement is not a separate approval and does not make
  every affected lead an equal veto point. Its purpose is to prevent uninformed
  final approval while keeping final accountability clear.
- The number of people involved may vary by project. Small centralized projects
  may use an **Owner-led** preset with one final authority. Contracted or
  controlled projects may use additional specialist, client, steering, or
  compliance approval stages.
- Authority should follow the type and consequence of the decision rather than
  automatically belonging to the highest-ranking person.
- The map should be role-based, with the currently assigned person shown for each
  role. Reassigning a person does not redefine the governance function.
- Every active Authority Map must identify one final authority, which may be an
  individual role or a collective body with a defined decision rule.
- Not every task change activates baseline governance. Operational reports update
  actual state; ordinary planning adjustments may remain within the Project
  Manager's authority; commitment changes activate the applicable approval path.
- Governance begins from understandable presets and constrained changes rather
  than requiring users to construct an unrestricted authority graph before they
  can plan a project.
- Historical approvals retain the authority context that applied when they were
  made. Later Authority Map changes do not rewrite earlier decisions.

## Alternatives Not Retained

- A completely flexible drawing system in which users freely redefine colours
  and project meanings.
- A completely rigid system that permits only one way to interpret the project.
- A binary model containing only `planned` and `real` states.
- Automatically extending a task's actual duration merely because it remains
  unfinished.
- Treating baseline, actual state, forecast, history, and scenarios as equally
  branchable versions.
- Allowing a user to return to an old checkpoint and directly overwrite the
  current project.
- A full version-control graph with deep branches, rebasing, and technical merge
  operations.
- Making every small task or status update a visible Key Moment.
- Requiring blocking confirmation for every timeline adjustment.
- Allowing an automatically derived forecast to silently become an accepted
  planning commitment.
- Treating assignee reports and managerial planning decisions as the same kind of
  update.
- Requiring exactly three people to approve every baseline.
- Treating Workstream Lead feasibility acknowledgement as final approval or an
  automatic veto.
- Sending every operational task update through the baseline approval path.
- Assigning approval automatically to the highest-ranking person regardless of
  the commitment being changed.
- Requiring every project to design a free-form governance graph before planning
  can begin.
- Allowing multiple people to edit the same Scenario.
- Treating read-only Scenario sharing as collaborative editing.
- Synchronizing, rebasing, or merging a derived Scenario with its source.
- Activating a Scenario before it becomes an Approved Baseline.
- Erasing Actual Progress or Change Records when activating a new baseline.
- Requiring users to state a reason for every ordinary project action.
- Hiding ordinary Change Records because the system judged them insignificant.
- Allowing arbitrary manual entry to overwrite a calculated Forecast result.

## Interpretation Boundary

This record confirms the conceptual direction above. It does not yet define
delegation when a final authority is unavailable, collective-body quorum rules,
the exact closed vocabulary of Change Record action types, the automatic formal
events that receive Key Moment labels, forecast confidence rules, reconciliation
conflict policy, visual encoding, detailed secondary-view navigation,
notifications, or component-level RBAC. Those details require separate discussion
and confirmation.
