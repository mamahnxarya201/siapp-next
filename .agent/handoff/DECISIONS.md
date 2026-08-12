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
