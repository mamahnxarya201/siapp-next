# Goal
read .agent/migation/005-gantt-vanilla-migration
- provide mini framework for javascript and html. mainly those framework will sets:
	- how the button delegates the action
	- how the html view will get updated
	- how the php function will be called
		- in the near future another agent will comes and integrate the php into the vanilla codebase, before the code get smelly and leaky abstraction where the access for js and php joined together, please provide:
			- common adapter or bridge
			- clear separation contract written in .md (put in the docs folder alongside the vanilla js codebase)
	- target user or auditor for the codebase was someone experienced the era of winform, delphi, QT and GTK framework so their mindset its not f(x) => update instead they thinks in button.onClicked => do something. or like command bus and event delegation. for async they always think "oh this must be triggered via somekind of scheduler or something like io_uring"
		- they have good experience and readability to read enterprise software architecture like DDD, CQRS
	- how playwright and E2E will test it along with the integration test
- DO NOT create full blown framework or more scope creep features if its not there to achieve the common goals sets by previous bullet point
- IF YOU MUST create and API abstraction layer to defer or re render per component
- DO NOT reach for 3rd party solution unless its for testing or something that lot of programmer will agree, for example E2E test => playwright, Unit Test => Jest
	- assume the NIH will always take precedence and if you need to reach the 3rd party solution write "Bill of Manifest" for the dependency in separate .md files and write the reasoning, the advantage and the disadvantage
	- YOU CAN take inspiration for 3rd party framework or library if you only need to steal or use one to 3 features, example:
		- i need the ability to re render and take granular control
			- WRONG -> i will use preact
			- CORRECT -> i will read morphdom from their repo and take what i need and re implemented
- ALWAYS document the entire structure, the document itself will be read and audited by human and used as source for other agent so always write the factual, dont make assumption, direct and provide the guide to navigate the codebase
- UPDATE the gantt vanila migration or create new file that link to that file if you wish to extend or re write the current proposed solution for the migration
- YOU WILL implement those written in .agent/migation/005-gantt-vanilla-migration after you done with the foundational framework and codebase
	- if the referenced document does not provide the knowledge you need about the previous react implementation, feel free to re read and analyze react source or other .md files inside the .agent folder
# Method
- USE subagent
- executes all task in parallel if it can be parallelized

# Early stop criteria
- you had reasoning or bad pratices that the current goal that needs to be discussed

# Escalate Once
- .

# Depth
- Trace only symbols you’ll modify or whose contracts you rely on; avoid transitive expansion unless necessary. 
- USE web search tools if you need to access 3rd party website or reference
- analyze previous source code and search common pitfalls and edge cases that can be solved with your current proposed task

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
  - 2026-08-15 implementation: added an isolated event-oriented mini-framework under `experimental/gantt-engine/src/framework/` with named commands, root action delegation, explicit coalesced view refresh, cancellable queued/frame/timer/async scheduling, and lifecycle cleanup.
  - Added a ports-and-adapters bridge under `src/bridge/`. Application code consumes `Gateway`; only composition roots select `InMemoryTransport` or the future `FetchTransport`. The factual JS/PHP wire, ownership, security, error, cancellation, versioning, and idempotency contract is documented in `docs/PHP_BRIDGE_CONTRACT.md`.
  - Implemented the complete task-005 barebones Gantt scope: workstream/task rows, DOM/SVG timeline, day/week/month scales, milestones/progress, collapse/hover/select, progressive and adaptive dependency rendering, move/start-resize/end-resize previews, atomic commits, direct-child clamps, recursive forward-only propagation, scroll synchronization, range extension/compaction, and PERT/CPM calculation.
  - Added architecture, testing, and Bill of Manifest manuals. The runtime has no third-party dependencies; `@playwright/test` is the sole development dependency.
  - Verification: `npm.cmd test` completed and exited normally with 45 Node tests and 6 installed-Chrome Playwright scenarios passing. No React implementation files were changed for this task.
  - Optional follow-up: user visual review of the standalone demo. PHP endpoint implementation and adoption by the PMIS application remain separate future tasks.
  
  EXAMPLE:
  - 2026-08-12 audit: Gantt right-click task creation already uses the shared task dialog and preserves the clicked date/workstream context.
  - Missing: a hover-revealed add-task button on each workstream header.
  - Partial: selecting either a task-list row or Gantt bar opens the read-only task inspector; inspector edit/save/cancel mode is not implemented.
  - Mandatory workstream membership is consistent with the current data model and remains independent from dependency hierarchy.
  - Clarification required: if "every field is editable" includes Calculated Forecast or completion-confirmation state, it conflicts with confirmed governed behavior.
  
  PLEASE PUT THE STATUS IN HERE, AFTER THE STATUS SUBTEXT
  STATUS:
  IMPLEMENTED AND AUTOMATICALLY VERIFIED - OPTIONAL USER VISUAL REVIEW REMAINS

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
  you are senior architect and have long and detailed experience to convert some scratch file into long detailed and directed document on how to implement. you provide the document and the workflow for how to work on it and then you can always provide the technical manual for the user and other agent on how to work on your codebase. you never afraid to write your reasoning accompanied by source in the documentation. rather than making assumption you always show the "Why" "what" "how" "where" in your document

  EXAMPLE:
  you are the react senior programmer and implementator, specialized in nextjs. you dont need to know anything else about this bussines as long as it doesn intervene with your task

  AGENT RULE:
  Write code for clarity first. Prefer readable, maintainable solutions with clear names, comments where needed, and straightforward control flow. Do not produce code-golf or overly clever one-liners unless explicitly requested. Use high verbosity for writing code and code tools.

  Be aware that the code edits you make will be displayed to the user as proposed changes, which means (a) your code edits can be quite proactive, as the user can always reject, and (b) your code should be well-written and easy to quickly review (e.g., appropriate variable names instead of single letters). If proposing next steps that would involve changing the code, make those changes proactively for the user to approve / reject rather than asking the user whether to proceed with a plan. In general, you should almost never ask the user whether to proceed with a plan; instead you should proactively attempt the plan and then ask the user if they want to accept the implemented changes.

  READ ANY FILE WITH STD-* PREFIXES, THOSE FILES ALWAYS HAVE PRECEDENCE ON THE TOP, FOR EXAMPLE:
  - STD-HCI
  - STD-DATA-RECONCILATION
  AND THEN AFTER THAT READ THIS FILE. DO NOT READ OTHER 000-* FILE UNLESS IT WAS REFERENCED
