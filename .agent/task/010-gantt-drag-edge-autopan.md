# Goal
Implement the Gantt task-bar dragging behavior shown in the Tom's Planner reference video: edge-triggered horizontal auto-pan that begins slowly, accelerates while the drag is held, and can reverse direction seamlessly without ending the active drag.

The first goal of this document is not immediate implementation. The agent must first verify the current implementation, restate the intended behavior, expose every unresolved UX decision, and ask the user for confirmation. The agent must not silently invent interaction behavior or tuning values.

# Method
- Start broad, then fan out to focused subqueries.
- Read every applicable `STD-*` file first because those files have higher precedence than this task.
- Inspect the existing Gantt timeline, task-bar drag logic, horizontal scrolling model, date-to-pixel conversion, snapping rules, pointer-capture lifecycle, and relevant tests.
- Compare the current behavior with the interaction contract described below.
- Separate verified facts, observations from the reference video, implementation constraints found in the repository, and unanswered product decisions.
- Ask the user one concise, consolidated batch of blocking questions before editing code.
- After the user confirms the behavior, implement only the confirmed scope and validate it.

# Early stop criteria
- You can name the exact components, hooks, state, and tests that would need to change.
- You can explain the current drag and horizontal-scroll lifecycle without guessing.
- You can list which parts of the requested interaction are already implemented, missing, conflicting, or still ambiguous.
- You have asked the user about every ambiguity that could materially change the UX or architecture.

# Escalate Once
- If repository signals conflict or scope remains fuzzy, run one refined investigation batch.
- If ambiguity remains after that investigation, stop and ask the user. Do not choose a convenient default.
- If an applicable `STD-*` rule conflicts with this task, quote or summarize the conflict and ask the user which behavior should win before editing.

# Depth
- Trace only the Gantt symbols involved in task-bar dragging, horizontal auto-pan, date projection, snapping, drag previews/tooltips, pointer capture, and their direct contracts.
- Avoid unrelated Gantt features and transitive expansion unless required to explain or validate this interaction.

# Loop
- Batch search -> inspect current behavior -> report findings -> ask blocking questions -> wait for user confirmation -> minimal plan -> implement -> validate.
- Search again only if validation fails or a new unknown appears.
- A new product ambiguity is a reason to ask the user, not a reason to improvise.

<context_understanding>
If an answer can be established objectively from the repository, tests, standards, or supplied reference, investigate it yourself.

If the answer requires a product choice, UX preference, numerical tuning value, scope decision, or interpretation not explicitly confirmed by the user, ask the user before editing code.

Do not treat uncertainty as permission to make a reasonable assumption. Do not implement a partial interpretation merely to show progress. Stop at the decision boundary, explain the alternatives and their visible consequences, and wait for the user's choice.
</context_understanding>

<tool_preambles>
- Always begin by rephrasing the user's goal in a friendly, clear, and concise manner before calling tools.
- Immediately outline the investigation steps you will follow.
- Narrate inspection and later implementation progress succinctly and sequentially.
- Before any code edit, distinctly summarize what was verified, what remains uncertain, and which answers are required from the user.
- Finish by separating completed work, validation evidence, and anything still awaiting user verification.
</tool_preambles>

--------

## TASK INFO

THIS SECTION ACTS AS THE LIAISON BETWEEN THE AGENT AND THE HUMAN.

### UPDATE:

- 2026-08-19 reference-video analysis: the interaction is an edge-triggered horizontal auto-pan performed while a Gantt task bar remains actively dragged.
- The draggable blue task bar remains grabbed throughout the interaction; the user does not release and re-grab it to continue scrolling or to reverse direction.
- When the pointer is driven past the left edge of the scrollable timeline, the task bar is visually constrained at the timeline boundary while the date grid pans toward earlier dates behind it.
- Auto-pan starts gently and gains speed while the pointer remains in the active edge/outside region, producing a throttle-like feeling rather than a fixed-speed scroll.
- The same mechanism works on the right edge, panning toward later dates.
- The user can move from the left side to the right side during the same drag session and reverse the pan direction without dropping the task bar, restarting the drag, or causing a discontinuous date jump.
- The visible month/year header, day cells, grid, dragged-bar projection, and date tooltip must remain synchronized as the viewport pans.
- The fixed activity/resource/status table must not horizontally pan with the date timeline.
- 2026-08-19 confirmed overlap behavior: auto-pan continues when the projected edge date overlaps other task bars; the active edge command is not suppressed by visual bar overlap.
- 2026-08-19 confirmed scope: apply auto-pan to all schedule-affecting task gestures (move, resize-start, resize-end); do not extend it to vertical reorder, scrollbar dragging, or non-schedule gestures.
- 2026-08-19 confirmed tuning: activate in the inside edge zone; combine elapsed dwell time with pointer penetration; use screen pixels per second across zooms; decelerate through zero on reversal and neutral return; stop immediately on release/cancel; clamp and hold at bounds; add no new feedback.
- 2026-08-19 supplied reference video: `D:\siapp-next\.agent\task\Tom's Planner - (new document) - Brave 2026-08-19 02-28-00.mp4`.
- 2026-08-21 investigation confirmed the left-edge lag was caused by updating `state.minDate` once per snapped preview date. Each update rebuilt visible dates, task positions, and the full timeline SVG. When the earlier dates were already rendered, the origin stayed stable and the drag was smooth.
- 2026-08-21 implementation keeps the confirmed left-bound behavior without adding a 180-day past horizon. The first left-edge activation prepares one viewport-derived past render buffer, preserves the current drag coordinate, and prevents per-date origin re-anchoring during the active gesture.
- 2026-08-21 implementation retains the unified drag-owned frame, current `scrollLeft` projection, render-only active-bar clamp, direction reversal, and atomic release commit.
- 2026-08-21 follow-up fixed the first-buffer compensation regression that could place the dragged bar at the opposite edge. The temporary prepended-scroll compensation is cleared after the buffered scroll is applied, and the active bar remains aligned with the left viewport boundary.
- 2026-08-21 scrollbar refinement reproduced and fixed: dragging the custom horizontal thumb now preserves the pointer's grab offset, while clicking empty track space retains centered track-jump behavior.
 
### STATUS:
IMPLEMENTED - AUTOMATED VALIDATION PASSED; MANUAL VERIFICATION PENDING

### COMPLETION:
- Automated validation after the left-buffer implementation: 57 unit tests passed; 30 Playwright browser scenarios passed.
- Added browser coverage for left-edge viewport buffering and stable origin during the active left drag.
- Live smoke verification in a fresh `localhost:5173` browser context showed stable `minDate`, active preview, pointer capture, and continuously changing proposed task dates while entering the left edge.
- Manual verification remains required for subjective throttle feel, left-edge smoothness against the supplied recordings, reversal, and tooltip/header synchronization.
- 2026-08-21 added a regression assertion that the first left-edge preview uses the current content boundary instead of spawning the bar from the opposite side.
- 2026-08-21 scrollbar regression coverage verifies thumb offset preservation during drag; the full 30-scenario browser suite remains passing.

AGENT MAY:
- USE A SUBAGENT when doing so is permitted and useful.
- ASK THE USER FOR CONFIRMATION.
- RUN READ-ONLY INSPECTION, EXISTING TESTS, OR A LOCAL PREVIEW TO UNDERSTAND CURRENT BEHAVIOR.
- IF THE PROMPT IS VAGUE AND PRODUCES PRODUCT QUESTIONS, STOP AND ASK THE USER.

AGENT MUST NOT:
- EDIT CODE BEFORE THE FIRST VERIFICATION REPORT AND USER CONFIRMATION.
- TURN AN UNANSWERED UX QUESTION INTO AN IMPLEMENTATION ASSUMPTION.
- PICK ARBITRARY THRESHOLDS, SPEEDS, EASING CURVES, OR TIMING CONSTANTS.
- EXPAND THE FEATURE TO OTHER DRAG OPERATIONS WITHOUT CONFIRMATION.
- CLAIM THAT THE VIDEO PROVES A DETAIL THAT CANNOT ACTUALLY BE DISTINGUISHED FROM THE VIDEO.

### AGENT ROLE

You are a senior frontend interaction engineer and implementer specialized in Gantt timelines, pointer-driven drag systems, coordinate transforms, scrolling, and deterministic UI testing. You do not need unrelated business-domain knowledge unless it changes this interaction's contract.

### AGENT RULE

Write code for clarity first. Prefer readable, maintainable solutions with explicit names, comments where the interaction math needs explanation, and straightforward control flow. Do not produce code-golf or overly clever one-liners. Use high verbosity for code and code-tool output when it materially helps review.

The general preference for proactive edits does not apply before clarification in this task. This task's question-first protocol has precedence: inspect proactively, but do not make code edits until the user confirms the behavior and scope.

Read any file with an `STD-*` prefix before this file. Those files always take precedence, for example:
- `STD-HCI`
- `STD-DATA-RECONCILIATION`

After reading applicable standards, read this file. Do not read unrelated `000-*` task files unless this document or an applicable standard references them.

--------

# Requested Interaction

## Plain-language intent

While the user is dragging a task bar horizontally, the timeline should behave as if the pointer controls a bidirectional throttle at the viewport edges.

Moving the pointer into or beyond one horizontal edge should make the date timeline auto-pan in that direction. The pan should not immediately jump to a constant high speed. It should begin slowly and progressively accelerate while the edge command is sustained. The task bar must remain part of the same uninterrupted drag operation.

The user must also be able to reverse direction fluidly: while still holding the same task bar, they can move the pointer away from one edge and toward the other edge, after which the timeline pans in the opposite direction without requiring mouse-up, another pointer-down, or a reset of the task-bar drag.

This is not merely a scrollbar replacement and not merely momentum scrolling. It is drag-coupled, edge-triggered, continuously updated horizontal auto-pan.

## What is visibly established by the reference

1. The interaction begins with a normal pointer-down drag on a Gantt task bar.
2. Inside the usable timeline viewport, the bar follows the horizontal drag normally according to the timeline's date mapping and snapping rules.
3. When the pointer moves past a horizontal timeline boundary, the dragged bar cannot continue rendering into the fixed table or outside the usable timeline area, so its visible position is constrained at the nearest timeline edge.
4. Pointer capture remains active even when the pointer is outside the timeline grid.
5. While the pointer remains at that side, the timeline pans horizontally and reveals additional dates.
6. The auto-pan begins relatively slowly, then covers progressively larger date ranges as the edge command remains sustained. The perceived model is a throttle or progressive acceleration, not a single fixed scroll step repeated forever.
7. As the timeline moves, the dragged bar's proposed semantic date continues to update from the moving date coordinate system.
8. The date tooltip/preview follows the proposed task date; it must not remain stale while the grid moves underneath the constrained bar.
9. The month/year headers, individual date cells, timeline rows, and bar preview move as one coherent coordinate system.
10. The non-timeline columns on the left remain stationary.
11. The user can bring the pointer back into the viewport and continue ordinary dragging without beginning a new interaction.
12. The user can cross to the opposite edge during that same drag, causing the timeline to auto-pan in the opposite direction.
13. Direction reversal does not cause the dragged bar to teleport, detach from the pointer interaction, commit prematurely, or lose its date preview.
14. Releasing or cancelling the pointer ends both the drag and its auto-pan loop; no timer or animation may continue moving the timeline afterward.

## Interaction state model

Treat the behavior as one drag session with multiple movement states, not as separate drag and scroll operations:

| State | Pointer condition | Timeline velocity target | Drag behavior |
| --- | --- | --- | --- |
| Idle | No active bar drag | Zero | No preview and no drag-coupled auto-pan |
| Direct drag | Active drag inside the confirmed neutral region | Zero | Bar follows normal date hit-testing and snapping |
| Left auto-pan | Active drag in the confirmed left activation region | Negative | Bar remains grabbed and constrained as needed; earlier dates are revealed |
| Right auto-pan | Active drag in the confirmed right activation region | Positive | Bar remains grabbed and constrained as needed; later dates are revealed |
| Direction transition | Active drag moves between left, neutral, and right regions | Moves toward the newly confirmed target behavior | No drag restart, commit, jump, or loss of pointer capture |
| End/cancel | Pointer-up, pointer-cancel, lost capture, blur, unmount, or equivalent termination | Zero immediately unless the user explicitly confirms otherwise | Stop the loop and clean up every listener/frame handle |

This table defines responsibilities, not the unresolved numerical curve.

## Throttle-like motion contract

The auto-pan must have a time-based velocity model so it behaves consistently across frame rates and machine performance.

Conceptually:

- `direction` is `-1` on the left, `0` in the neutral region, and `+1` on the right.
- `targetSpeed` is derived from confirmed UX inputs.
- `currentSpeed` evolves over elapsed time instead of being applied as a fixed number of pixels per rendered frame.
- Every animation frame integrates displacement using real `deltaTime` and applies it to the canonical horizontal timeline viewport.
- After scrolling, the drag preview and semantic date are recomputed using the updated scroll position and the original active pointer session.
- Speed must be clamped to a confirmed maximum.
- Scroll bounds must be respected without accumulating hidden velocity or leaving a runaway loop.

The video supports progressive acceleration over sustained edge activation. It does not, by itself, establish whether speed is controlled by dwell time, pointer penetration distance, distance inside an edge zone, or a combination. The agent must not decide this silently.

## Coordinate and rendering invariants

- There must be one canonical horizontal viewport position. Header dates, grid cells, row content, and task bars must derive from it.
- The fixed left-hand table must not share the timeline's horizontal transform.
- Pointer coordinates, viewport coordinates, content coordinates, and semantic dates must be converted explicitly; do not mix them implicitly.
- The dragged bar's visible x-position may be constrained to the timeline viewport edge while its semantic date continues changing because the viewport is moving.
- Existing date snapping, working-day rules, zoom scale, minimum duration, and task constraints must remain authoritative unless the user explicitly changes them.
- Auto-pan must not accidentally commit intermediate task dates.
- A direction change must preserve the same drag origin, task identity, duration, and pointer-capture session.
- Native/manual horizontal scrollbar behavior must remain available unless the user explicitly requests its replacement.
- Cleanup must be deterministic on pointer-up, pointer-cancel, lost pointer capture, component unmount, window blur, and error paths relevant to the current framework.

# Mandatory clarification checkpoint

After inspecting the repository and before editing code, report:

1. The files and symbols currently responsible for task-bar dragging.
2. The files and symbols currently responsible for horizontal scrolling and date projection.
3. Whether pointer capture and an animation-frame loop already exist.
4. What already matches the requested interaction.
5. What is missing or conflicts with it.
6. Which current tests cover drag, scrolling, snapping, cancellation, or pointer lifecycle.
7. A minimal proposed implementation boundary.

Then ask the user to confirm every unresolved item. At minimum, ask only the questions that the repository and supplied standards do not already answer from this set:

- Scope: should accelerated auto-pan apply only when moving a whole task bar, or also when resizing either edge, creating a bar, dragging milestones/dependencies, or multi-select dragging?
- Trigger geometry: should panning begin only after the pointer crosses the timeline boundary, inside a near-edge activation zone, or in both regions?
- Throttle input: should acceleration depend on time held near/outside the edge, distance beyond the edge, or both?
- Reversal: when crossing to the opposite side, should velocity reverse immediately, decelerate through zero, or follow another confirmed response?
- Neutral return: when the pointer returns inside the neutral region, should auto-pan stop immediately or decelerate?
- Release/cancel: should timeline motion stop immediately, with no inertial coast?
- Tuning: should the agent visually tune the behavior to the reference video, or should the user supply initial zone width, acceleration time, minimum speed, and maximum speed?
- Scale: should speed feel constant in screen pixels, date units, or be normalized across timeline zoom levels?
- Bounds: what should happen when the earliest/latest allowed date is reached while the pointer remains at an edge?
- Feedback: should the UI show an edge-zone cue, direction cue, cursor change, clamped bar, or only the existing task/date tooltip?
- Verification: will the user manually verify feel and direction reversal?
- Feature criticality: is this a core interaction, and if so should tests use fake time plus mocked animation frames, integration-level pointer simulation, end-to-end browser tests, or a user-confirmed combination?

Ask these in one compact batch with the options and consequences made clear. Do not ask questions already answered by code or standards. Do not begin editing while waiting.

# Implementation constraints after confirmation

- Prefer a single drag-owned auto-pan controller/state machine over multiple independent timers.
- Prefer `requestAnimationFrame` or the framework's equivalent animation scheduler, with elapsed-time integration.
- Do not tie acceleration to render count.
- Do not create a second source of truth for timeline offset.
- Recompute the dragged task's proposed date after each applied scroll delta.
- Preserve established snapping and validation logic instead of duplicating it inside the auto-pan controller.
- Keep numerical tuning values named, centralized, documented, and testable.
- Do not modify unrelated scrolling, task editing, or calendar behavior.
- If the repository architecture makes any constraint inappropriate, explain that conflict and ask before substituting a different design.

# Acceptance behavior to validate after confirmation

The exact numbers depend on the user's answers, but validation must demonstrate the following confirmed behavior:

1. A normal in-viewport task drag still works unchanged.
2. Holding an active drag at the left trigger reveals earlier dates.
3. Holding an active drag at the right trigger reveals later dates.
4. Initial auto-pan is controllable rather than jumping immediately to maximum speed.
5. Sustained activation increases speed according to the confirmed throttle rule and stops increasing at the confirmed cap.
6. The motion rate is stable under different animation-frame cadences.
7. The dragged bar remains in the same pointer session while the timeline moves.
8. The date tooltip/preview updates continuously and corresponds to the current proposed task date.
9. Header, grid, rows, and task projections remain horizontally aligned.
10. The fixed left table does not move horizontally.
11. Returning to the neutral region follows the confirmed stop/deceleration behavior.
12. Moving from one activation side to the other reverses direction according to the confirmed rule without mouse-up or re-grab.
13. No visible teleport, stale tooltip, premature task commit, or one-frame jump occurs during direction change.
14. Pointer-up commits only the final valid drag result and stops auto-pan.
15. Pointer-cancel/lost capture/unmount/blur follows existing cancellation semantics and leaves no active animation or listener.
16. Reaching a horizontal date bound remains stable and does not accumulate motion that later explodes when the bound changes.
17. Existing manual scrollbar, zoom, snapping, task constraints, and unrelated drag behavior do not regress.

# Non-goals unless separately confirmed

- Replacing the native/manual horizontal scrollbar.
- Adding inertial scrolling after pointer release.
- Redesigning the Gantt visual style.
- Changing date snapping, calendar arithmetic, task duration, dependency, or workstream rules.
- Applying the behavior to vertical scrolling.
- Applying the behavior to every draggable object in the application.
- Introducing new edge indicators, cursor art, or animations.
- Refactoring unrelated Gantt architecture merely because the drag code is nearby.

# Completion report

After implementation, update `UPDATE` and `STATUS` in this file and report:

- What was verified before editing.
- Which user-confirmed choices were implemented.
- Exact files and interaction contracts changed.
- Tests added or updated and what each proves.
- Automated validation results.
- Manual checks still required, especially subjective throttle feel and seamless reversal.
- Any difference from the reference behavior and why it was explicitly accepted.
