You are a senior product designer + frontend architect building a production-grade interactive prototype for a Project Management Information System (PMIS).

Use TASK protocol.

T = Think about system goals, personas, interaction constraints, and architecture before implementation.
A = Analyze UX tradeoffs and avoid simplistic cloning.
S = Structure the interface as a scalable product.
K = Keep implementation focused on prototype realism and interaction quality.

GOAL:
Build a modern PMIS prototype focused on project planning, dependency awareness, and observability.

NOT a generic dashboard.
NOT a pure Jira clone.
NOT a pure Linear clone.
NOT a spreadsheet-looking ERP.

TARGET PRODUCT VISION:
Hybrid of:

- Linear (modern aesthetics)
- serious Gantt planning
- CPM/PERT dependency intelligence
- enterprise PM observability

PRIMARY PERSONAS:

1. Project Manager
   Needs:

- planning timeline
- task dependencies
- milestone tracking
- delay risk awareness
- approvals

2. Technical team member
   Needs:

- assigned tasks
- blockers
- dependency awareness
- status visibility

3. Executive / management
   Needs:

- project health visibility
- KPI snapshot
- delayed milestones
- risk overview

CORE UX PRINCIPLES:

- Clean modern UI
- Dark mode aesthetic
- Minimal spreadsheet feeling
- Dense information but readable
- Product-quality interactions
- Contextual complexity, not always-visible chaos

MAIN LAYOUT:
Three-panel application layout.

LEFT PANEL:
Task / project structure.
Grouped by team or category.
Examples:

- Backend
- Frontend
- QA
- Deployment

Each task row should show:

- task name
- owner/avatar
- status chip
- dependency count
- expand/collapse groups

CENTER PANEL:
Interactive Gantt timeline.

Requirements:

- draggable task bars
- resizable task durations
- timeline scale (day/week/month)
- milestone markers
- zoom controls
- horizontal scroll
- smooth interactions

Visual style:

- rounded bars
- subtle grid
- reduced spreadsheet appearance
- modern SaaS aesthetic
- soft separators instead of harsh table borders

RIGHT PANEL:
Context inspector.

When task selected:
show:

- task title
- description
- assignee
- status
- estimated duration
- optimistic estimate
- pessimistic estimate
- dependencies
- blockers
- linked change requests
- comments/history
- risk indicator

DEPENDENCY INTERACTION (CRITICAL):
DO NOT always show all dependency lines.

That creates visual clutter like a railway dispatch control room.

Instead:

DEFAULT:
No visible dependency lines.

ON TASK HOVER:
Show ONLY direct dependency relationships relevant to hovered task.

Examples:
If task D depends on A and C:
show:
A → D
C → D

ON TASK SELECT:
Show expanded upstream/downstream dependency chain.

OPTIONAL TOGGLE:
"Show all dependencies"

OPTIONAL TOGGLE:
"Highlight critical path"

Critical path mode:

- highlight critical tasks visually
- show critical dependency chain only
- use strong visual emphasis

IMPORTANT:
Task grouping is NOT dependency hierarchy.

Do NOT fake dependency trees.

A QA task depending on backend should remain in QA group while dependency overlays connect logically.

TOP NAVIGATION:
Include:

- project selector
- search
- filter
- quick add task
- view mode selector
- notifications
- user profile

OPTIONAL DASHBOARD ENTRY VIEW:
Before entering project:
show:

- active projects
- delayed projects
- pending approvals
- KPI snapshot
- risk summary

TECH STACK TARGET:
React + Tailwind + shadcn style acceptable for prototype.

FOCUS:
Prototype realism and interaction fidelity over backend correctness.

OUTPUT:
A visually polished interactive PMIS prototype UI.
