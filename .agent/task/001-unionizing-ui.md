# What
the current state of the project UI was scattered mess with no clear user story or flow. we already discussed so much about the backend and the project ideas yet we didnt even touch the ui yet. so this document will clearly explain the vision for the UI

# Why
based on my own testing the usability of this project is staggering it even fails to be navigated by the firsttimer even for single action which is add task they already confused which button to click. which way to type, etc

# Core Mindset
this task will only discuss and talk about the timeline UI and view. please refrain from talking about anything else or suggesting something outside of the project scope creep. if the UI task was intervining with the other values or views please tell me directly and i will resolve it

# User Flow
in this flow we will skip all the UI things besides the timeline view since it is the main screen views were user spends 99% their times on. this is how it should looks like, below is the common action for user interacting with the timeline views

  - **Adding Task**

    gantt views -> user can hover at the gantt bar and then right click it. it will show context menu that user can add task based on that start date directly (this is already implemented, good)

    Task List on sidebar -> hover over workstream header name. there should be a + button that can add tasks there (using the same pop up as the timeline views)

    core rule: task should always be groupped in workstream no matter what. so if there's no workstream please refrain user for creating task. if they do the first path (gantt views). then shows a workstream creation pop up with a note that tell the user

    the task pop up itself must be designed to allow keyboard centric navigation such as tab tab enter. so by default the yes button should on the left not right.

	UPDATE:
	since add task was already implemented please delete the add task button. the one on top of the gantt chard that sit besides planning button

  - **Deleting Task**

      gantt views -> click the bar -> right click -> context menu: delete -> shows a pop up and a checkbox if they want to delete the chilld too and if the user tries to delete the only task in workstream. then shows the checkboxes telling them if they want to delete the workstream too. the checkboxes should dynamically rendered so if the condition is not satisfied dont shows the checkboxes

      second path will be clicking the task list but the rest is the same continuation

  - **Editing Task**

      gantt views -> click the bar -> right sidebar (task detail shows up) -> user click the pencil button on top of the header sidebar and then the sidebar changes into editable mode in which every field is editable. then the edit button changes into disc which indicate a save and besides it was X button to cancel it

      second path will be clicking the task list but the rest is the same continuation

      UPDATE:
      The right panel (the one for task detail) must have scroll feature, the case was if the task was to long user should have capability to scroll up and down

      in the tab operation when the selectable field reaching the bottom of the panel it should reset on the save icon (following the same mindset as the form)

 - Milestone

      i dont remember the milestone feature, if it written in .md files please analyze and investigate. show me if is the one feature we discussed. if no then please delete it

- Top Header Navigation and UI Enhancement

	 in the top header bar, above the gantt chart. there's project switcher. i want you to delete that. and then merge the project name into the Planview. replacing the planview name. the logo stay same but when it clicked it shows a pop up where user can customize the logo. make sure the logo uploader have somekind of crop feature since we limit how much size the user uploaded logo can be. since it still not connected to object storage or something, for now we store logo in the filesystem folder inside the project folder its fine. we still on early stage

     on the right side there's a undo redo button. this is used to undo and redo user action inside the gantt chart. so the position should be in gantt chart header (on the same height as "All Deps", "Day, Week" switcher). but put it on left replacing the left right arrow. left right arrow goes on right, besides the all deps with small vertical separator (check the vertical separator between theme switcher and undo redo button i like that separator)

 ![[Pasted image 20260813161608.png]]
 see picture above it got this blank space. i want it to be filled with people involved in project. it should be and icon of the user profile lined horizontally like instagram stories and then there's small button with the text "People in Project >" when it clicked it will lead user to another page. but thats outside of this task
![[Pasted image 20260813161841.png]]
 text inside the user profile circle is not centered. yet somehow it centered on firefox mac. please center it
  --------
  TASK INFO
  THIS SECTION ACT AS LIAISON FOR AGENT AND THE HUMAN
  PLEASE PUT THE UPDATES IN HERE, AFTER THE UPDATE SUBTEXT

  UPDATE:
  - 2026-08-12 audit: Gantt right-click task creation already uses the shared task dialog and preserves the clicked date/workstream context.
  - Missing: a hover-revealed add-task button on each workstream header.
  - Missing: the no-workstream creation guard and explanatory workstream-creation flow.
  - Partial: the task dialog supports autofocus, native tab order, Enter submission, and Ctrl/Cmd+Enter, but its affirmative action is still placed to the right of Cancel.
  - Missing: task deletion actions, conditional descendant/workstream checkboxes, and their confirmation dialog.
  - Partial: selecting either a task-list row or Gantt bar opens the read-only task inspector; inspector edit/save/cancel mode is not implemented.
  - Mandatory workstream membership is consistent with the current data model and remains independent from dependency hierarchy.
  - Clarification required: if "every field is editable" includes Calculated Forecast or completion-confirmation state, it conflicts with confirmed governed behavior. Forecast is derived from supported inputs, and completion requires assignee reporting plus approver confirmation. The smallest compliant interpretation is that edit mode covers user-authored task fields while these governed sections remain read-only/action-driven.
  - Existing uncommitted Planning panel work was identified and left untouched.
  - 2026-08-13 implementation: workstream headers now reveal an add-task button on hover/focus and open the shared creation dialog with the workstream selected.
  - 2026-08-13 implementation: projects without workstreams are blocked from creating ungrouped tasks and instead receive an explanatory first-workstream flow that continues into task creation.
  - 2026-08-13 implementation: task-list rows and Gantt bars now share one delete confirmation with conditionally rendered recursive-dependent and sole-task workstream options.
  - 2026-08-13 implementation: deletion is undoable and cleans dependency references for all surviving tasks.
  - 2026-08-13 implementation: the inspector now provides pencil, save, and cancel modes for user-authored task fields; governed Forecast/completion and derived/read-only sections remain outside ordinary editing.
  - 2026-08-13 implementation: affirmative dialog actions precede Cancel and creation supports keyboard Enter submission.
  - 2026-08-13 verification: 3 Vitest unit tests, 2 Playwright Chrome scenarios, strict TypeScript, git diff validation, and the production build passed. Integration testing is deferred; user manual verification is pending.
  - 2026-08-13 follow-up: the task inspector retains a constrained Radix scroll viewport for long detail content, and edit-form Tab navigation sends the final selectable field to the Save action.
  - 2026-08-13 follow-up: milestone was investigated against the product knowledge, screenshots, task model, creation/edit forms, and Gantt rendering; it is an established timeline and academic feature and is preserved.
  - 2026-08-13 correction: removed the obsolete global New Task quick-add button beside Planning in the top navigation. Contextual task creation remains available from workstream headers and the Gantt timeline.
  - 2026-08-13 implementation: removed the project switcher, replaced the Planview wordmark with the active project name, added local project-logo upload/crop customization, moved undo/redo into the Gantt toolbar, moved timeline arrows beside All Deps, added project-member avatars, and centered avatar initials.

  PLEASE PUT THE STATUS IN HERE, AFTER THE STATUS SUBTEXT
  STATUS:
  IMPLEMENTED AND AUTOMATION-VERIFIED - INSPECTOR SCROLL/FOCUS FOLLOW-UP VERIFIED; MILESTONE PRESERVED; AWAITING USER MANUAL VERIFICATION; INTEGRATION TESTING DEFERRED

  THIS DOCUMENT MIGHT CHANGES AND EDITABLE, WHEN THE USER REFINES IT AND GAVE IT TO AGENT AGAIN
  AGENT NEEDS TO:
  - VERIFY WHAT ALREADY BEEN IMPLEMENTED
  - VERIFY IF THE TASK THAT THEY READ IS THE TASK USER WANT TO IMPLEMENT
  - TELL USER HOW THEY WILL FINISH THE TASK
  - ASK USER IF THEY WILL VERIFY IT MANUALLY OR NOT
  - ASK USER IF THEY WILL SET THIS AS A CORE FEATURE, IF SO AGENT NEEDS TO ASK THE TESTING STRATEGY

  AGENT MAY:
  - USE SUBAGENT IF THERE'S MORE THAN ONE TASK
  - ASK CONFIRMATION TO USER
  - IF THE PROMPT IS VAGUE AND RESULTING IN MORE QUESTION, STOP THINKING AND ACT USER

  AGENT ARE:
  you are the react senior programmer and implementator, specialized in nextjs. you dont need to know anything else about this bussines as long as it doesn intervene with your task
  --------
