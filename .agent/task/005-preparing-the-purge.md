# Goal
Get enough context & information about the gantt chart and engine fast. Parallelize discovery and stop as soon as you can act. Save the output into a .agent/doc/migration and make sure you list every step and migration details. i want the migration be done in paralell using multiple subagent and outputed into the {project_folder}/experimental folder 

DO NOT, migrate the UI such as right sidebar etc i want the barebones gantt engine, UI and layout and other gantt capabilities such as zoom, scroll and the left sidebar for task

DO NOT modify the react implementation. your task is to gather and search and then plan out

USE subagent so your job 
# Method
- Start broad, then fan out to focused gantt chart interaction
- decoupling anything from react and the rendering method that use react renderer

# Early stop criteria
- You can name exact content to change. 
- You can generate the migration from react to pure modern and vanila ES6 Javascript

# Escalate Once
- If signals conflict or scope is fuzzy, run one refined parallel batch, then proceed.

# Depth
- Trace only symbols you’ll modify or whose contracts you rely on; avoid transitive expansion unless necessary. 

# Loop 
- Batch search → minimal plan → complete task. 
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

- 2026-08-15 audit: The current Gantt engine is concentrated in `components/pmis/gantt-chart.tsx` and couples React hooks, Zustand selectors/actions, SVG rendering, pointer gestures, localStorage settings, timeline range growth, and PMIS authoring controls.
- 2026-08-15 audit: Framework-independent scheduling already exists in `lib/domain/scheduling.ts`; it preserves predecessor clamping, recursive forward-only propagation, dependent duration, and before/after effects.
- 2026-08-15 audit: Framework-independent CPM/PERT exists in `lib/domain/forecast.ts`; it calculates expected duration, earliest/latest dates, slack, and criticality, but the UI still consumes stored `Task.isCriticalPath` metadata in some paths.
- 2026-08-15 audit: The vanilla target must retain 40px group headers, 36px task rows, progressive dependency disclosure, adaptive orthogonal connector routing, solid continuous SVG paths, day/week/month scales, horizontal timeline extension, milestones, and atomic drag preview/commit behavior.
- 2026-08-15 output: Migration details and ordered implementation steps are documented in `.agent/doc/migration/005-gantt-vanilla-migration.md`; the isolated target boundary is reserved in `experimental/gantt-engine/README.md`.
  
  EXAMPLE:
  - 2026-08-12 audit: Gantt right-click task creation already uses the shared task dialog and preserves the clicked date/workstream context.
  - Missing: a hover-revealed add-task button on each workstream header.
  - Partial: selecting either a task-list row or Gantt bar opens the read-only task inspector; inspector edit/save/cancel mode is not implemented.
  - Mandatory workstream membership is consistent with the current data model and remains independent from dependency hierarchy.
  - Clarification required: if "every field is editable" includes Calculated Forecast or completion-confirmation state, it conflicts with confirmed governed behavior.
  
  PLEASE PUT THE STATUS IN HERE, AFTER THE STATUS SUBTEXT
STATUS:

READY FOR EXPERIMENTAL VANILLA-ES6 IMPLEMENTATION — REACT IMPLEMENTATION UNCHANGED; MIGRATION PLAN AND EXTRACTION CONTRACT DOCUMENTED

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
  you are the react senior programmer and have long experience in modern es6 javascript, you always optimize code performance and then the code readability. you always create migration plan and gather much information and context needed for other agent/worker to work. you never writes vague or broad phrases, instead you write direct factual and doesnt make any assumption
  
  EXAMPLE:
  you are the react senior programmer and implementator, specialized in nextjs. you dont need to know anything else about this bussines as long as it doesn intervene with your task

  AGENT RULE:
  Write code for clarity first. Prefer readable, maintainable solutions with clear names, comments where needed, and straightforward control flow. Do not produce code-golf or overly clever one-liners unless explicitly requested. Use high verbosity for writing code and code tools.

  Be aware that the code edits you make will be displayed to the user as proposed changes, which means (a) your code edits can be quite proactive, as the user can always reject, and (b) your code should be well-written and easy to quickly review (e.g., appropriate variable names instead of single letters). If proposing next steps that would involve changing the code, make those changes proactively for the user to approve / reject rather than asking the user whether to proceed with a plan. In general, you should almost never ask the user whether to proceed with a plan; instead you should proactively attempt the plan and then ask the user if they want to accept the implemented changes.

  READ ANY FILE WITH STD-* PREFIXES, THOSE FILES ALWAYS HAVE PRECEDENCE ON THE TOP, FOR EXAMPLE:
  - STD-HCI
  - STD-DATA-RECONCILATION
  AND THEN AFTER THAT READ THIS FILE. DO NOT READ OTHER 000-* FILE UNLESS IT WAS REFERENCED
