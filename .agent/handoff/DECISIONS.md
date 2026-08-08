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

No additional cross-agent decisions have been recorded yet.

