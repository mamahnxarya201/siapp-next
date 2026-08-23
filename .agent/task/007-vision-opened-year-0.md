# Goal
refactoring the UI, layout and styles. first make sure we can swap out css theming easily since i want you to create two UI theming with the same layout and styles. please refer to any documentation inside the 
D:\siapp-next\experimental\gantt-engine\docs\
maintain current modern UI styles but please base the layout and the grid scheme based on @loosely-shapes-wireframe and the rendered views for that wireframe is @rendered wireframe

the standart interaction for gantt engine and task is based on tomsplanner.com please lookup from there, and you can make an assumption based on fact and cue, but for example i'll gave you a clue:
- Adding Task
	- click on the textbox cell on the left sidebar and start writing
- Adding Bar
	- hover on to the on the gantt engine and right click (disable browser context menu on this app)
	- render context menu for adding bar and make sure user can drag it freely
- Adding connection
	- click on the bar and right click, select connect and then render the line preview then as user move their mouse make an preview line before they finally click on other bar
those 3 task will be the main feature and core. for more features and how to work, if you can please gather data about usage of tomsplanner and then report back for more confirmation

i expect: 
- basic interaction works
- light theme, dark theme and editorial UI theme (check the local project skills for how to this)

# Method
- Gather info for how tomsplanner usage and then report back to user, if user acknowledge make sure to make documentation (refer to the STD-THE-PURGE)
- work in parallel, the defined action in these files can be done first without looking up, if you cant get the graps of it please wait until information gatherer done
- USE subagent so you can split your task in parallel

# Early stop criteria
- you didnt have any information about tomsplanner and the prompt is too broad and vague, if you cant name the prompt and task in single sentences please stop all the work and re ask the user

# Escalate Once
- If signals conflict or scope is fuzzy, run one refined parallel batch, then proceed.

# Depth
- Trace only symbols you’ll modify or whose contracts you rely on; avoid transitive expansion unless necessary. 

# Loop 
- Batch search → minimal plan → implement -> update task -> make sure test passes. 
- Search again only if validation fails or new unknowns appear. Prefer acting over more searching.

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
  - 2026-08-15 audit: the requested target is currently ambiguous between the main React PMIS project view and the isolated `experimental/gantt-engine` demo. The wording points to the vanilla Gantt because it explicitly references that engine's docs and task interactions; implementation target is awaiting confirmation.
  - 2026-08-15 local audit: the React application already has semantic theme tokens in `styles/themes.css`, a light theme, a dark theme, and a `next-themes` switch in the top navigation. It does not yet have an editorial-tech theme. The vanilla demo currently has hard-coded dark CSS values and no theme switch.
  - 2026-08-15 wireframe audit: `.agent/rendered wireframe.png` shows a flat spreadsheet-like Gantt with Activity/Resource/Status columns, orange group bars, a multi-level month/day header, dense calendar grid, and a bottom horizontal scrollbar. `.agent/loosely-shapes-wireframe.svg` is available as the source artifact.
  - 2026-08-15 Tom's Planner research: official documentation confirms direct entry of phase/activity names in the grid, drawing time blocks on the schedule grid, and right-clicking a task bar to add a dependency before clicking the target task. While adding a dependency, hovering the target's left/right side selects the direction. Right-clicking a dependency removes it. Sources: `plan.tomsplanner.com/documentation/manual/en/1/en/topic/a-gantt-chart-from-scratch` and `plan.tomsplanner.com/documentation/manual/en/1/en/topic/dependencies`.
  - 2026-08-15 proposed core interaction mapping: editable task-name cell in the left grid; right-click empty timeline cell to create a freely draggable bar; right-click task bar and choose Connect to enter a pointer-preview mode, then click a target bar to commit a dependency. Browser context menu must be suppressed only inside the Gantt surface. Existing forward-only propagation and grouping/dependency independence remain protected.
  - 2026-08-15 implementation assumption: because the request names the Gantt engine and its local docs, the isolated `experimental/gantt-engine` demo is the target; the React PMIS view remains untouched. The three interactions and three themes are implemented as the Year 0 slice without changing protected product rules.
  - 2026-08-15 documentation: durable behavior is recorded in `experimental/gantt-engine/docs/THEME_AND_INTERACTION_CONTRACT.md`.
  
  EXAMPLE:
  - 2026-08-12 audit: Gantt right-click task creation already uses the shared task dialog and preserves the clicked date/workstream context.
  - Missing: a hover-revealed add-task button on each workstream header.
  - Partial: selecting either a task-list row or Gantt bar opens the read-only task inspector; inspector edit/save/cancel mode is not implemented.
  - Mandatory workstream membership is consistent with the current data model and remains independent from dependency hierarchy.
  - Clarification required: if "every field is editable" includes Calculated Forecast or completion-confirmation state, it conflicts with confirmed governed behavior.
  
  PLEASE PUT THE STATUS IN HERE, AFTER THE STATUS SUBTEXT
  STATUS:
  IMPLEMENTED AND VERIFIED - VANILLA YEAR 0 INTERACTION/THEME SLICE; REACT APPLICATION UNCHANGED

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
