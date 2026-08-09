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
- Exact checkpoint triggers, active-scenario limits, scenario refresh behaviour,
  and adoption controls remain unconfirmed.

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
- Exact names for baseline/current-plan layers, authority delegation, collective
  quorum rules, and detailed approval triggers remain unconfirmed.
