# Goal
okay so i want you to do small rework on the context menu, i want this behaviour:
- remove the add task text field in the left task bar
- when user right click on the bar it should show any operation that can be done on the bar, this apply to other UI component. as the name suggest (context menu) which is a menu that appear and can be applied on the current context (mouse hover)
	- bar:
		- Delete Task (delete the bar and the task, this work both ways when user do this action on the task context menu too)
		- Change color
		- Add dependency
		- Remove dependency (also remove their dependency task)
	- Workstream:
		- Delete Workstream
		- Rename Workstream
		- Collapse Workstream (pulling all task from the workstream, if the engine prevent this. feel free to modify the engine)
	- Task (in the task list sidebar)
		- Remove dependency (also remove their dependency task)
		- Delete Task (delete the bar and the task, this work both ways when user do this action on the task context menu too)
	- Grid
		- Add Task it should change the context menu into color selection and below the color menu selection. there's small text box for inputting the task name
			- user select color
				- for color selection please make pallete color selection style but give user freedom to do hex color picker UI when they click advanced icon or something (give visual cue)
				- you can use 3rd party library for this since implementing this will be reinventing a wheel a lot
			- write task name
			- when user press enter on text box. the task on the left side appear and the bar appears too

# Method
- use subagent to parallelize the task

# Early stop criteria


# Escalate Once


# Depth
- search docs in the experiment folder or .agent gather as much info or context you need
- search web if you cant find inspiration when planning or making an assumption

# Loop 
- Gather context -> plan out -> implement -> write test for interaction and unit testing -> test passes  -> task complete


<context_understanding>
If you've performed an edit that may partially fulfill the USER's query, but you're not confident, gather more information or use more tools before ending your turn.
Bias towards not asking the user for help if you can find the answer yourself.
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
  - 2026-08-16 implementation: removed the inline Add task field from the activity sidebar. Grid right-click now opens a contextual task form with palette colors, an advanced native color picker, and Enter submission.
  - 2026-08-16 implementation: bar and sidebar task contexts now expose dependency add/remove, color change, and Delete task. Workstream context now exposes Delete, Rename, and Collapse. Task deletion removes the task/bar and cleans dependency references without silently deleting predecessor tasks.
  - 2026-08-16 verification: `npm.cmd test` passes 45 unit tests and 12 Playwright scenarios, including empty-grid creation, task color/dependency/delete actions, and both populated/empty entry points.
- 2026-08-16 audit (re-verification): the previously VERIFIED build was wrong. `styles.css` `.gantt-context-menu button { display: block }` overrode the `hidden` attribute, so the standalone context buttons (Remove dependency, Collapse/Rename/Delete workstream) never hid and the menu showed every item regardless of hover. Additionally `openContextMenu` never produced `kind: "workstream"` on right-click, so right-clicking a workstream header fell through to the add-bar form.
- 2026-08-16 fix: added `.gantt-context-menu [hidden] { display: none !important; }` (restores `hidden` semantics for all menu elements) and added workstream-header detection in `openContextMenu` (timeline `[data-workstream-id]` / sidebar `[data-group-id]` -> `kind: "workstream"`).
- 2026-08-16 verification: added E2E scenario `context menu only reveals items for the hovered surface` asserting correct items visible AND wrong items hidden for task bar, empty grid, workstream header, and dependency link. Full gate now 46 unit + 13 Playwright scenarios, all green (exit 0). Marked core feature; testing strategy = user-facing E2E scenario coverage.
- 2026-08-16 refinement (user): (1) task creation no longer steals focus to the sidebar name input; `createTask` gained `focusSidebarName` (default true) and the grid context-menu path passes `false`, so after Add task / Enter the task lands on the left list without a stray focus forcing an extra Enter. (2) drag was grabbing a neighbor bar; root cause was `.gantt-task__selection` (a rect 4px larger than the bar) capturing pointer events, so clicking its spillover over an adjacent bar started that bar instead. Fixed with `.gantt-task__selection { pointer-events: none }`. (3) grid hover target was off-by-one (next date) because `xToDate` used `Math.round`, so a column center rounded up; changed to `Math.floor` (cell-based snapping, correct for day and half-day). Also `timelinePoint` returned `groupName: null` for task rows (rows carry `task.groupName`, not `group`), which broke BOTH the landing guide and the created task's lane; now resolves via `row.task?.groupName ?? row.task?.workstreamId`. (4) added an always-on landing guide crosshair (vertical line at the snapped date column + horizontal line at the hovered workstream row) driven by a `pointermove`/`pointerleave` listener on the timeline and rendered in `renderTimeline`.
- 2026-08-16 verification: added E2E `grid hover shows a landing guide and task creation keeps focus off the sidebar` (guide crosshair appears on empty-grid hover, hides on timeline leave, created task appears on the left with no sidebar input focused). Full gate now 46 unit + 17 Playwright scenarios, all green (exit 0).
  
  EXAMPLE:
  - 2026-08-12 audit: Gantt right-click task creation already uses the shared task dialog and preserves the clicked date/workstream context.
  - Missing: a hover-revealed add-task button on each workstream header.
  - Partial: selecting either a task-list row or Gantt bar opens the read-only task inspector; inspector edit/save/cancel mode is not implemented.
  - Mandatory workstream membership is consistent with the current data model and remains independent from dependency hierarchy.
  - Clarification required: if "every field is editable" includes Calculated Forecast or completion-confirmation state, it conflicts with confirmed governed behavior.
  
  PLEASE PUT THE STATUS IN HERE, AFTER THE STATUS SUBTEXT
  STATUS:

  VERIFIED - CONTEXT-MENU TASKBAR REWORK IMPLEMENTED; SIDEBAR TASK FIELD REMOVED, GRID TASK CREATION MOVED INTO NAME/COLOR CONTEXT FORM, TASK/BAR/WORKSTREAM OPERATIONS IMPLEMENTED, CONTEXT-SCOPING BUG FIXED (CSS `hidden` OVERRIDE + WORKSTREAM RIGHT-CLICK), FOCUS-LEAK FIXED, DRAG-NEIGHBOR FIXED (SELECTION RECT POINTER-EVENTS), OFF-BY-ONE DATE FIXED (xToDate FLOOR) + LANE RESOLUTION FIXED (timelinePoint groupName), LANDING GUIDE CROSSHAIR ADDED, AND FULL TEST GATE PASSED (46 UNIT + 17 PLAYWRIGHT, EXIT 0). CORE FEATURE.

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

  EXAMPLE:
  you are the react senior programmer and implementator, specialized in nextjs. you dont need to know anything else about this bussines as long as it doesn intervene with your task

  AGENT RULE:
  Write code for clarity first. Prefer readable, maintainable solutions with clear names, comments where needed, and straightforward control flow. Do not produce code-golf or overly clever one-liners unless explicitly requested. Use high verbosity for writing code and code tools.

  Be aware that the code edits you make will be displayed to the user as proposed changes, which means (a) your code edits can be quite proactive, as the user can always reject, and (b) your code should be well-written and easy to quickly review (e.g., appropriate variable names instead of single letters). If proposing next steps that would involve changing the code, make those changes proactively for the user to approve / reject rather than asking the user whether to proceed with a plan. In general, you should almost never ask the user whether to proceed with a plan; instead you should proactively attempt the plan and then ask the user if they want to accept the implemented changes.

  READ ANY FILE WITH STD-* PREFIXES, THOSE FILES ALWAYS HAVE PRECEDENCE ON THE TOP, FOR EXAMPLE:
  - STD-HCI
  - STD-DATA-RECONCILATION
  AND THEN AFTER THAT READ THIS FILE. DO NOT READ OTHER 000-* FILE UNLESS IT WAS REFERENCED
