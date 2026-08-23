# Goal
Implement only the requested dependency-connector direction-cue behavior with minimum exploration and minimum scope.

# Method
- Inspect only the files needed to locate the existing connector routing/rendering implementation and its directly related tests/docs.
- Prefer the smallest local change that matches the existing architecture.
- Do not refactor unrelated code.
- Do not add abstractions, features, or cleanup that are not required by this task.

# Early stop criteria
- You can name the exact code path that owns routed connector segments and hover rendering.
- You can name the exact docs file(s) in `experimenta/gantt-engine/docs` that should describe this behavior.
- You have enough evidence to make one unambiguous implementation choice.

# Escalate Once
- If one focused search does not resolve an implementation detail, perform one narrower search.
- If the answer is still unknown, STOP and ask the user. Do not guess.

# Depth
- Trace only symbols you will modify or contracts those symbols directly rely on.
- Do not expand transitively into unrelated rendering, scheduling, task, or data-model code.

# Loop
- Locate → verify → make a minimal plan → implement → validate → document.
- Search again only when validation fails or a new unknown blocks the requested change.

<context_understanding>
Never assume missing product behavior, geometry rules, constants, ownership, or architecture.
If required information is unknown and cannot be established directly from the code or referenced standards, STOP and ask the user.
If there are two or more materially different valid implementation paths and the repository does not already establish which one to use, STOP and ask the user before choosing.
Do not silently choose a "reasonable" interpretation.
</context_understanding>

<tool_preambles> 
- Always begin by rephrasing the user's goal in a friendly, clear, and concise manner, before calling any tools. 
- Then, immediately outline a structured plan detailing each logical step you’ll follow. 
- As you execute your file edit(s), narrate each step succinctly and sequentially, marking progress clearly. 
- Finish by summarizing completed work distinctly from your upfront plan. 
</tool_preambles>


 --------
  TASK INFO
  THIS SECTION ACT AS LIAISON FOR AGENT AND THE HUMAN
  PLEASE PUT THE UPDATES IN HERE, AFTER THE UPDATE SUBTEXT
  UPDATE:
  - 2026-08-23 task definition: implement hover-revealed directional arrow cues on orthogonally routed Gantt dependency connectors.
  - Confirmed reference behavior: a straight connector segment renders at most one directional arrow cue.
  - Confirmed reference behavior: a 90-degree turn creates another straight segment; that new segment is independently eligible for its own arrow cue.
  - Confirmed reference behavior: long straight connectors do not gain additional arrows merely because they are longer.
  - Strongly supported reference behavior: an eligible segment's arrow is centered on that segment and points from predecessor toward successor.
  - Strongly supported reference behavior: arrow glyph size is visually fixed rather than proportional to segment length.
  - Not yet confirmed from source/reference measurements: the exact minimum segment length or clearance rule that determines whether a very short post-turn segment receives an arrow. The agent MUST NOT invent this value or rule.
  - Documentation is required under `experimenta/gantt-engine/docs`, using KaTeX-compatible Markdown for mathematical formulas.
  - 2026-08-23 user confirmation: cues reveal on connector hover, use a fixed 6px by 6px triangle, and require a segment length of at least 12px.
  - 2026-08-23 implementation: committed connector endpoint markers were replaced by one midpoint cue per eligible straight segment. Adjacent collinear commands are merged before eligibility is evaluated, so long uninterrupted segments do not gain repeated cues.
  - 2026-08-23 scope confirmation: this is a core connector feature with permanent kernel and Playwright coverage. The in-progress connection preview retains its endpoint arrow.
  - 2026-08-23 routing refinement: the user permanently superseded repeated-elbow connector geometry with adaptive one-elbow L routes and requested a forgiving hover target.
  - 2026-08-23 final verification: the empty demo workflow created and connected two task bars. The committed route was `M 128 18 V 54 H 320`, with exactly one elbow and two 6px cues pointing down and right. A pointer 5px from the visible stroke hit the 12px invisible interaction corridor and revealed both cues. `npm test` passed 58 Node tests and 37 Playwright scenarios with a clean exit.
  - 2026-08-23 appearance refinement: the user permanently replaced the fixed 6px cue rule with Timeline Settings preferences. Normal line width is configurable from 1px to 3px in 0.5px steps; cue size is configurable from 3px to 8px in 1px steps. Defaults remain 1.5px and 6px. Critical width is the selected normal width multiplied by 1.33.
  - 2026-08-23 appearance verification: both demo dialogs showed the confirmed ranges and live pixel labels. Saving 3px and 8px rendered a 3px committed connector and two 8px cues; Cancel restored the saved values after minimum-value drafts. `npm test` passed 59 Node tests and 37 Playwright scenarios with a clean exit.
  - 2026-08-23 Tom-style routing refinement: user-provided screenshots superseded the strict one-elbow route. Distant routes now use a short predecessor exit, vertical trunk, and horizontal target tail; cramped routes retain one vertical-entry elbow. No route exceeds two elbows.
  - 2026-08-23 half-day interaction decision: movement and both resize edges snap to the nearest half-day, context creation selects the containing half-day, and every new task retains a one-day initial duration. Short-bar resize hit zones split without overlap.
  - 2026-08-23 KaTeX documentation: `npm run docs:build` now renders inline and display equations to static HTML and MathML, with embedded KaTeX CSS and fonts for offline `file://` use.
  - 2026-08-23 final verification: empty-demo routing rendered `M 128 18 H 146 V 54 H 480`; move, start resize, and end resize each committed 12-hour changes; new tasks retained 24-hour durations. The offline portal rendered 9 display equations, 11 inline equations, 20 MathML elements, and loaded no external resources. `npm test` passed 60 Node tests and 38 Playwright scenarios.
  - 2026-08-23 endpoint refinement: removed the configurable destination gap. Cramped top-entry and bottom-entry routes now terminate exactly on the dependent bar edge.
  - 2026-08-23 preview performance fix: pointer movement no longer invalidates and rebuilds the timeline. It updates one stable preview SVG path at most once per animation frame and no longer processes duplicate compatibility `mousemove` events.
  - 2026-08-23 endpoint and performance verification: cramped route `M 256 18 H 260 V 42` ended at the target bar's `y=42`. On the 240-task fixture, a 120-event burst completed dispatch in approximately 3.7ms and two-frame settlement in 22ms, preserved the same preview node, and produced zero child-list mutations. `npm test` passed 60 Node tests and 39 Playwright scenarios.
  - 2026-08-23 drag-preview continuity fix: the selected-task halo extended 2px beyond the bar and was painted after dependency paths, covering the endpoint during active drag. Previewed tasks now hide that halo while retaining the preview bar.
  - 2026-08-23 drag-preview verification: while `performance-6` was held in an active drag, its selection halo computed to `display: none`; the incoming left-entry connector endpoint and preview bar both had `x=384`. `npm test` passed 60 Node tests and 39 Playwright scenarios.
  - 2026-08-23 edge-coordinate correction: `renderTimeline()` now derives one constrained render-position array and supplies it to both connectors and bars. During edge autoscroll, raw schedule positions remain untouched while incoming and outgoing connector attachments follow the held preview bar.
  - 2026-08-23 compaction investigation: exact SUN 23 → SAT 5 drags survived in week and day probes without navigation or task loss. A real right-edge `futureDays: 270 → 0` release compaction also preserved task identity, 24-hour duration, DOM bar, and viewport visibility. No compaction source change was made without a reproduced defect.
  - 2026-08-23 delegated coverage: a test-only subagent added cross-month, navigation-stability, release-compaction, and edge-autoscroll contracts; the parent corrected duration and compaction assumptions and integrated the tests. Final edge verification had raw `x=1088`, constrained bar `x=1034`, incoming endpoint `x=1034`, and outgoing start `x=1130`, with zero attachment gaps. `npm test` passed 60 Node tests and 41 Playwright scenarios.
  
  EXAMPLE:
  - 2026-08-12 audit: Gantt right-click task creation already uses the shared task dialog and preserves the clicked date/workstream context.
  - Missing: a hover-revealed add-task button on each workstream header.
  - Partial: selecting either a task-list row or Gantt bar opens the read-only task inspector; inspector edit/save/cancel mode is not implemented.
  - Mandatory workstream membership is consistent with the current data model and remains independent from dependency hierarchy.
  - Clarification required: if "every field is editable" includes Calculated Forecast or completion-confirmation state, it conflicts with confirmed governed behavior.
  
  PLEASE PUT THE STATUS IN HERE, AFTER THE STATUS SUBTEXT
  STATUS:
  VERIFIED - CONNECTED TOM-STYLE ROUTING, FRAME-BOUNDED PREVIEW, HALF-DAY INTERACTIONS, APPEARANCE SETTINGS, AND KATEX DOCUMENTATION IMPLEMENTED

  EXAMPLE:
  VERIFIED - AWAITING USER CONFIRMATION, MANUAL-VERIFICATION CHOICE, AND CORE-FEATURE TESTING STRATEGY

  THIS DOCUMENT MIGHT CHANGES AND EDITABLE, WHEN THE USER REFINES IT AND GAVE IT TO AGENT AGAIN
  AGENT NEEDS TO:
  - VERIFY WHAT ALREADY BEEN IMPLEMENTED
  - VERIFY IF THE TASK THAT THEY READ IS THE TASK USER WANT TO IMPLEMENT
  - TELL USER HOW THEY WILL FINISH THE TASK
  - ASK USER IF THEY WILL VERIFY IT MANUALLY OR NOT
  - ASK USER IF THEY WILL SET THIS AS A CORE FEATURE, IF SO AGENT NEEDS TO ASK THE TESTING STRATEGY

  AGENT MAY:
  - USE SUBAGENT
  - ASK CONFIRMATION TO USER
  - IF THE PROMPT IS VAGUE AND RESULTING IN MORE QUESTION, STOP THINKING AND ACT USER

  AGENT ARE:
  You are the senior frontend/graphics implementer responsible only for the Gantt dependency connector routing/rendering behavior required by this task. Work with minimum eagerness: make the smallest direct change, inspect the minimum necessary context, and do not broaden scope.

  EXAMPLE:
  you are the react senior programmer and implementator, specialized in nextjs. you dont need to know anything else about this bussines as long as it doesn intervene with your task


  --------
  TASK
  --------

  ## Objective

  Implement the hover direction cues for routed dependency connectors so the UI communicates dependency flow without changing connector routing itself.

  The requested behavior is segment-based, not total-path-distance-based.

  A routed connector is an ordered polyline:

  $$
  P = [p_0, p_1, \ldots, p_n]
  $$

  Each adjacent pair defines one straight routed segment:

  $$
  S_i = (p_i, p_{i+1})
  $$

  For an orthogonal connector, every valid segment is horizontal or vertical.

  ## Required behavior

  1. Render direction cues only in the existing hover/reveal state that owns this visual behavior. Do not change unrelated connector visibility or interaction behavior.

  2. Evaluate each routed straight segment independently.

  3. Render at most one arrow cue on any one straight segment.

  4. Do not add more arrows merely because one segment is very long.

     A 50 px eligible straight segment and a 900 px eligible straight segment still receive at most one cue each.

  5. A 90-degree turn does not directly mean "draw another arrow".

     The correct model is:

     - the turn splits the polyline into another straight segment;
     - that segment is then independently evaluated;
     - if that segment satisfies the repository's verified eligibility rule, it receives one cue.

  6. The cue direction must follow path traversal from predecessor/source toward successor/target.

  7. For every eligible segment, place the cue at the segment midpoint unless existing verified implementation/reference evidence establishes another rule.

  8. Keep arrow glyph dimensions constant in screen/render space unless the existing renderer already establishes a different verified sizing convention. Do not scale arrow dimensions proportionally with connector length.

  9. Very short segments may omit the cue. The exact eligibility threshold/clearance rule is NOT specified by this task because it has not yet been measured with enough confidence.

     Before implementing this part:
     - inspect the existing code for a threshold, marker clearance, endpoint clearance, or equivalent rule;
     - reuse the existing rule if one exists and matches the reference behavior;
     - if no rule exists and a numeric or behavioral choice is required, STOP and ask the user;
     - do not invent a threshold such as 24 px, 28 px, 30 px, or any other value.

  ## Geometry

  Let a segment start at:

  $$
  p_1 = (x_1, y_1)
  $$

  and end at:

  $$
  p_2 = (x_2, y_2)
  $$

  Define:

  $$
  \Delta x = x_2 - x_1
  $$

  $$
  \Delta y = y_2 - y_1
  $$

  Because the route is orthogonal, the segment length can be computed using Manhattan distance:

  $$
  L = |\Delta x| + |\Delta y|
  $$

  This is equivalent to the ordinary straight-line distance for an axis-aligned segment because exactly one of $\Delta x$ or $\Delta y$ is non-zero.

  The midpoint is:

  $$
  M =
  \left(
    \frac{x_1 + x_2}{2},
    \frac{y_1 + y_2}{2}
  \right)
  $$

  The direction follows the ordered segment:

  $$
  d =
  \begin{cases}
  (1, 0) & \Delta x > 0 \\
  (-1, 0) & \Delta x < 0 \\
  (0, 1) & \Delta y > 0 \\
  (0, -1) & \Delta y < 0
  \end{cases}
  $$

  If the renderer constructs the arrow triangle geometrically rather than using an existing glyph/marker, use a unit direction vector $\hat d$ and its perpendicular vector $\hat n$:

  $$
  \hat d = \frac{p_2 - p_1}{\lVert p_2 - p_1 \rVert}
  $$

  $$
  \hat n = (-\hat d_y, \hat d_x)
  $$

  Let:

  - $a$ = fixed arrow length;
  - $w$ = fixed arrow half-width;
  - $M$ = segment midpoint.

  Then:

  $$
  T = M + \hat d\frac{a}{2}
  $$

  is the arrow tip, and:

  $$
  B = M - \hat d\frac{a}{2}
  $$

  is the base center.

  The two base vertices are:

  $$
  B_1 = B + \hat n w
  $$

  $$
  B_2 = B - \hat n w
  $$

  The rendered triangle is:

  $$
  \triangle(T, B_1, B_2)
  $$

  Do not introduce this triangle math if the current renderer already has an appropriate arrow marker/glyph primitive. Reuse the current primitive when that is the smaller and more consistent implementation.

  ## Segment eligibility

  Treat eligibility as a separate decision from arrow placement.

  Conceptually:

  $$
  E(S_i) =
  \begin{cases}
  1 & \text{if segment } S_i \text{ has enough verified usable space for a cue} \\
  0 & \text{otherwise}
  \end{cases}
  $$

  Then:

  $$
  A(S_i) =
  \begin{cases}
  \text{one cue at } M_i & E(S_i)=1 \\
  \varnothing & E(S_i)=0
  \end{cases}
  $$

  The current screenshots support the existence of such an eligibility check, especially for short segments after a 90-degree turn, but they do NOT establish its exact numeric threshold.

  Do not replace this unknown with an assumption.

  ## Examples

  A single straight route:

  ```text
  source -------------------->-------------------- target
  ```

  has one straight segment and therefore at most one arrow cue, regardless of how long that segment becomes.

  A two-segment orthogonal route:

  ```text
  source
    |
    |
    v
    |
    +----------------->---------------- target
  ```

  consists of two independently evaluated segments.

  If both are eligible, it shows two cues:

  - one downward cue on the vertical segment;
  - one rightward cue on the horizontal segment.

  If the horizontal post-turn segment is too short according to the verified eligibility rule, only the vertical cue is rendered.

  ## Documentation requirement

  Update or create the smallest appropriate human-facing document under:

  `experimenta/gantt-engine/docs`

  The documentation must explain:

  - that arrow cues are evaluated per routed straight segment;
  - why a 90-degree turn can result in another cue;
  - why connector length does not create repeated arrows on one segment;
  - midpoint placement;
  - direction calculation;
  - the verified segment-eligibility rule;
  - fixed-size arrow behavior, if confirmed by the current renderer.

  Write mathematical expressions in KaTeX-compatible Markdown using `$...$` for inline math and `$$...$$` for display math.

  Keep the documentation human-readable. Explain each formula in plain language before or after presenting it. Do not dump equations without explaining what each variable means.

  Do not document an unverified threshold as fact.

  ## Scope constraints

  - Do not change dependency routing unless the current route data is insufficient to implement the cue behavior.
  - Do not refactor the whole connector renderer.
  - Do not redesign hover interactions.
  - Do not change task/dependency semantics.
  - Do not add new configuration surfaces unless already required by the existing architecture.
  - Do not touch unrelated `000-*` documents.
  - Read `STD-*` files first when relevant, as required by this task document.

  ## Mandatory stop conditions

  STOP and ask the user before editing when any of these are true:

  1. You cannot determine which code path owns the connector hover arrows.
  2. You cannot determine the existing path traversal order from predecessor to successor.
  3. The code offers two materially different implementation locations and neither is clearly established as canonical.
  4. You need to choose a new numeric short-segment threshold or clearance value.
  5. You find two plausible eligibility rules and cannot prove which one matches existing behavior.
  6. Implementing the cue requires changing connector routing or public data contracts in a way not explicitly requested.
  7. Existing `STD-*` requirements conflict with this task.
  8. Any required product behavior is ambiguous.

  Do not resolve a stop condition with intuition, convention, "best practice", or a reasonable default. Ask.

  ## Validation

  Validate, at minimum, the following existing/reference behaviors without inventing new product requirements:

  - short single straight connector: at most one cue;
  - very long single straight connector: still at most one cue;
  - long vertical segment: one midpoint cue pointing down/up according to traversal;
  - vertical + short horizontal tail: horizontal tail follows the verified eligibility rule;
  - vertical + sufficiently long horizontal tail: each eligible segment gets one cue;
  - cue direction reverses correctly if path traversal reverses;
  - hover-off state remains unchanged.

  Prefer focused tests around the existing connector renderer. Do not build a broad new test harness unless the user explicitly approves it.


  AGENT RULE:
  TASK-SPECIFIC PRECEDENCE: the mandatory stop conditions above override any generic instruction below that encourages proactive edits or discourages clarification. When this task says STOP and ask, STOP and ask.

  Write code for clarity first. Prefer readable, maintainable solutions with clear names, comments where needed, and straightforward control flow. Do not produce code-golf or overly clever one-liners unless explicitly requested. Use high verbosity for writing code and code tools.

  Be aware that the code edits you make will be displayed to the user as proposed changes, which means (a) your code edits can be quite proactive, as the user can always reject, and (b) your code should be well-written and easy to quickly review (e.g., appropriate variable names instead of single letters). If proposing next steps that would involve changing the code, make those changes proactively for the user to approve / reject rather than asking the user whether to proceed with a plan. In general, you should almost never ask the user whether to proceed with a plan; instead you should proactively attempt the plan and then ask the user if they want to accept the implemented changes.

  READ ANY FILE WITH STD-* PREFIXES, THOSE FILES ALWAYS HAVE PRECEDENCE ON THE TOP, FOR EXAMPLE:
  - STD-HCI
  - STD-DATA-RECONCILATION
  AND THEN AFTER THAT READ THIS FILE. DO NOT READ OTHER 000-* FILE UNLESS IT WAS REFERENCED