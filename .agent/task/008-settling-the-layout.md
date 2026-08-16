# Goal
implementing the current react layout (outside experiment folder). checkup layout in "http://localhost:3000/project/timeline/p3". project already running in localhost:3000, no need to serve it again. implement all the react layout and functionality into the experiment js mini framework.
- Retain all the current react UI layout, color and UI styles
	- Make sure you use some kind of token design
	- Web component is okay,as long as you explain the usage into documentation or refer to the Bill of Manifest
- Prefer to use native workaround provided by the mini framework when facing react problem (e.g useState)
- YOU can extend the current framework codebase and feature as long you document it into the current documentation
- Navigation to other webpage is not implemented for now (focus on the current layout and feature of timeline)

# Method
- gather context via the documentation and codebase
- plan out the migration first using the given documentation and codebase result
- write out the UI using component and design token system
- write the test using playwright and unit testing if you can isolate the given function
- write the documentation afterward. if you use any workaround and hacks please write the reasoning too and explain the pitfalls of the solution
- parallelize every task with subagent

# Early stop criteria
- You cant access localhost:3000
- You cant locate both experiment folder and react codebase

# Escalate Once
- If the migration plan didnt worked out, you can research and call web access tools
- if the playwright testing failed please analyze and research it first rather than bruteforcing DOM searching, map the DOM and scenario first rather than making assumption about the DOM structure

# Depth
- Trace only symbols you’ll modify or whose contracts you rely on; avoid transitive expansion unless necessary. 

# Loop 


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
  - 2026-08-16 completion: ported the React p3 project-view shape into the isolated experiment with 240 deterministic tasks, five workstreams, React-aligned shell/sidebar/calendar geometry, Lucide SVG affordances, and full-width horizontal task hover cues.
  - 2026-08-16 verification: `npm.cmd test` passes 45 unit tests and 9 Playwright scenarios; the live root demo renders 240 task rows and bars with five groups and the three-tier month/weekday/date calendar header.
  
  EXAMPLE:
  - 2026-08-12 audit: Gantt right-click task creation already uses the shared task dialog and preserves the clicked date/workstream context.
  - Missing: a hover-revealed add-task button on each workstream header.
  - Partial: selecting either a task-list row or Gantt bar opens the read-only task inspector; inspector edit/save/cancel mode is not implemented.
  - Mandatory workstream membership is consistent with the current data model and remains independent from dependency hierarchy.
  - Clarification required: if "every field is editable" includes Calculated Forecast or completion-confirmation state, it conflicts with confirmed governed behavior.
  
  PLEASE PUT THE STATUS IN HERE, AFTER THE STATUS SUBTEXT
  STATUS:

  VERIFIED - REACT-ALIGNED P3 LAYOUT, COLORS, SIDEBAR METADATA, GROUP ACTIONS, THREE-TIER CALENDAR, LUCIDE ICONS, AND HORIZONTAL HOVER CUE IMPLEMENTED; 45 UNIT TESTS, 9 PLAYWRIGHT SCENARIOS, AND LIVE RENDER CHECK PASSED

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
  you are senior JS programmer, experienced both in react and devoted to use the platform feature, code readability and performance is your top priority. you write excellent detailed documentation so other below your skill level can pick up and learn a lot. you never make assumption and guess, instead you always take research and choices based on factual

  EXAMPLE:
  you are the react senior programmer and implementator, specialized in nextjs. you dont need to know anything else about this bussines as long as it doesn intervene with your task

  AGENT RULE:
  Write code for clarity first. Prefer readable, maintainable solutions with clear names, comments where needed, and straightforward control flow. Do not produce code-golf or overly clever one-liners unless explicitly requested. Use high verbosity for writing code and code tools.

  Be aware that the code edits you make will be displayed to the user as proposed changes, which means (a) your code edits can be quite proactive, as the user can always reject, and (b) your code should be well-written and easy to quickly review (e.g., appropriate variable names instead of single letters). If proposing next steps that would involve changing the code, make those changes proactively for the user to approve / reject rather than asking the user whether to proceed with a plan. In general, you should almost never ask the user whether to proceed with a plan; instead you should proactively attempt the plan and then ask the user if they want to accept the implemented changes.

  READ ANY FILE WITH STD-* PREFIXES, THOSE FILES ALWAYS HAVE PRECEDENCE ON THE TOP, FOR EXAMPLE:
  - STD-HCI
  - STD-DATA-RECONCILATION
  AND THEN AFTER THAT READ THIS FILE. DO NOT READ OTHER 000-* FILE UNLESS IT WAS REFERENCED
