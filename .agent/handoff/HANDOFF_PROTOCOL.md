# PMIS Cross-Agent Handoff Protocol

## Goal

Keep ChatGPT, Codex, and future agents aligned without pretending that separate conversations share one reliable memory.

Repository files are the portable project memory. Conversations may supply context, but they do not silently override the repository's accepted decisions.

## Start of Work

Before substantive planning or implementation:

1. Read the repository `AGENTS.md`.
2. Read the required project documents it names.
3. Read `DECISIONS.md` and `CURRENT_STATE.md`.
4. Inspect the relevant code and tests.
5. State any material mismatch between the request, the documents, and the code.

No confirmation is needed when the sources are compatible and the requested work stays within accepted scope.

## Decision Classes

| Class | Meaning | May an agent apply it without asking? |
| --- | --- | --- |
| Implementation fact | What the repository currently does | Yes, after verification |
| Implementation detail | A reversible choice that preserves all accepted behavior | Yes |
| Proposal | A possible product, architecture, data, or UX choice | No, not as binding truth |
| Protected-rule change | Changes a rule listed as protected in `AGENTS.md` | No |
| Conflict resolution | Chooses between incompatible authoritative sources | No |
| Temporary experiment | Reversible exploration that does not become product truth | Only when the user clearly requested an experiment |

## Confirmation Gate

Ask the user before:

- changing product intent or thesis scope;
- changing a protected behavior;
- selecting between conflicting authoritative documents;
- promoting a proposal into an accepted architecture or UX rule;
- converting a workaround into permanent behavior;
- changing a decision previously marked `CONFIRMED`.

The question must name:

1. the exact sources or rules in conflict;
2. the practical consequence of each option;
3. the recommended option, if evidence supports one;
4. whether the result should be temporary or permanent.

## Decision Lifecycle

Use these statuses in `DECISIONS.md`:

```text
PROPOSED -> CONFIRMED -> IMPLEMENTED -> VERIFIED
                  \-> SUPERSEDED
```

- `PROPOSED`: suggested by an agent or user, not binding.
- `CONFIRMED`: explicitly accepted by the user; binding even if not implemented.
- `IMPLEMENTED`: reflected in repository code or documentation.
- `VERIFIED`: validated by tests, inspection, or agreed acceptance evidence.
- `SUPERSEDED`: replaced by a later confirmed decision; retain history and link the replacement.

Only explicit user approval can move a product or architecture proposal to `CONFIRMED`.

An implementation agent may move `CONFIRMED` to `IMPLEMENTED` or `VERIFIED` when evidence exists, without changing the substance of the decision.

## Handoff Note

At the end of material work, update `CURRENT_STATE.md` with:

- objective;
- completed changes;
- files changed;
- checks performed and their results;
- unresolved questions;
- proposed but unconfirmed choices;
- the next smallest actionable step.

Do not paste a full chat transcript. Record durable facts and decisions only.

## ChatGPT-to-Codex Transfer

When ChatGPT develops a new proposal:

1. Label it as a proposal unless the user explicitly confirms it.
2. Add it to `DECISIONS.md` as `PROPOSED`, or provide a ready-to-apply decision entry.
3. Do not instruct Codex to implement it as accepted truth before confirmation.

When the user confirms it, record the exact accepted wording, scope, and consequences as `CONFIRMED`.

## Codex-to-ChatGPT Transfer

When Codex discovers an implementation constraint:

1. Record the observed fact and evidence in `CURRENT_STATE.md`.
2. Separate the constraint from any proposed product compromise.
3. If compliance requires changing a protected rule, leave the compromise `PROPOSED` and ask the user.

Codex must not present “the current code works this way” as evidence that the product should work that way.

## Conflict Example

If a screenshot suggests an always-visible dependency line but the product knowledge requires progressive disclosure:

- screenshot authority applies to visible composition;
- product knowledge applies to dependency visibility behavior;
- the agent should first determine whether the screenshot captures a hover, selection, or critical-path state;
- if the state cannot be established and implementation would differ materially, ask the user instead of choosing.

