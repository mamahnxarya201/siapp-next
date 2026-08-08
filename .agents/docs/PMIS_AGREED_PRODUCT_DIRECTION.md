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
- The project timeline is the primary workspace for project viewing and planning.
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

### Checkpoints, history, and scenarios

- PMIS borrows preserved history, explicit authorship, meaningful before-and-after
  comparison, reversible decisions, protected checkpoints, and safe scenario
  exploration from version-control thinking.
- PMIS does not borrow version-control terminology or graph-management complexity
  as the ordinary user experience.
- The project has one official current planning line.
- Meaningful checkpoints preserve important plan states; ordinary activity
  updates do not each become a user-facing checkpoint.
- Historical checkpoints are initially read-only.
- Continuing work from an old checkpoint creates a scenario rather than
  overwriting the live project.
- Scenarios should be shallow, bounded, and visibly separate from operational
  reality.
- Adopting a scenario creates a new official checkpoint after comparison and
  review.
- Restoring an older plan creates a new revision and does not erase later history
  or actual events.
- Detailed activity history and restorable planning checkpoints are related but
  distinct concepts.

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
- Making every small task or status update a visible project checkpoint.
- Requiring blocking confirmation for every timeline adjustment.
- Allowing an automatically derived forecast to silently become an accepted
  planning commitment.
- Treating assignee reports and managerial planning decisions as the same kind of
  update.

## Interpretation Boundary

This record confirms the conceptual direction above. It does not yet define exact
terminology, role permissions, checkpoint triggers, scenario limits, forecast
confidence rules, approval policy, visual encoding, or consequence thresholds.
Those details require separate discussion and confirmation.
