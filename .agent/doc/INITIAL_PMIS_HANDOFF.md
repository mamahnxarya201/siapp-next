# PMIS (Project Management Information System) - Implementation Documentation

## Overview

A production-grade interactive prototype for a modern Project Management Information System with Gantt planning, CPM/PERT dependency intelligence, and enterprise PM observability.

**NOT**: a generic dashboard, a pure Jira clone, a pure Linear clone, or a spreadsheet-looking ERP.

**IS**: A hybrid of Linear (modern aesthetics), serious Gantt planning, CPM/PERT dependency intelligence, and enterprise PM observability.

---

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v4, shadcn/ui components
- **State Management**: Zustand
- **Styling**: Dark mode by default, CSS design tokens

---

## Architecture

### File Structure

```
/app
├── globals.css          # Design tokens, dark theme, animations
├── layout.tsx           # Root layout with Inter font
├── page.tsx             # Entry point - renders PMISApp

/components/pmis
├── pmis-app.tsx         # Main app wrapper (Dashboard/Project view switch)
├── top-nav.tsx          # Top navigation bar
├── dashboard-view.tsx   # Portfolio overview (entry screen)
├── project-view.tsx     # Three-panel layout orchestrator
├── task-list-panel.tsx  # Left panel - task hierarchy
├── gantt-chart.tsx      # Center panel - interactive timeline
├── context-inspector.tsx # Right panel - task details

/lib
├── pmis-data.ts         # Type definitions + mock data
├── pmis-store.ts        # Zustand store - centralized state
```

---

## Core Data Types

```typescript
// Task statuses
type TaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done'

// Priority levels
type Priority = 'low' | 'medium' | 'high' | 'critical'

// Team groupings (NOT dependency hierarchy)
type TaskGroup = 'backend' | 'frontend' | 'qa' | 'deployment' | 'design' | 'infrastructure'

// Full task interface
interface Task {
  id: string
  name: string
  description: string
  group: TaskGroup                    // Team assignment (visual grouping only)
  status: TaskStatus
  priority: Priority
  assignee: { id, name, avatar, initials }
  startDate: Date
  endDate: Date
  estimatedDays: number               // PERT estimate
  optimisticDays: number              // PERT optimistic
  pessimisticDays: number             // PERT pessimistic
  dependencies: string[]              // Task IDs this depends ON
  dependents: string[]                // Task IDs that depend ON this
  blockers: string[]                  // Text blockers
  progress: number                    // 0-100
  isMilestone: boolean
  isCriticalPath: boolean
  linkedChangeRequests: string[]
  comments: { id, author, text, timestamp }[]
  riskLevel: 'low' | 'medium' | 'high'
}
```

---

## State Management (Zustand Store)

### Key State

```typescript
interface PMISState {
  // Navigation
  currentView: 'dashboard' | 'project'
  currentProjectId: string | null
  
  // Data
  tasks: Task[]
  projects: Project[]
  
  // Selection/Interaction
  selectedTaskId: string | null       // Full dependency chain shown
  hoveredTaskId: string | null        // Direct deps only shown
  
  // Gantt Controls
  timelineScale: 'day' | 'week' | 'month'
  showAllDependencies: boolean        // Toggle for railway-mode
  showCriticalPath: boolean           // Highlight critical tasks
  
  // Panel Sync
  expandedGroups: TaskGroup[]         // Which groups are collapsed/expanded
  verticalScrollTop: number           // Synced scroll position
  inspectorOpen: boolean
}
```

### Critical Computed Functions

```typescript
// Returns ordered list of visible rows (groups + tasks)
// BOTH panels use this for synchronized layout
getVisibleRows(): RowType[]

// Dependency traversal for visualization
getUpstreamChain(taskId): Task[]      // All ancestors
getDownstreamChain(taskId): Task[]    // All descendants
getTaskDependencies(taskId): Task[]   // Direct dependencies only
getTaskDependents(taskId): Task[]     // Direct dependents only
```

---

## Three-Panel Layout

### Critical: Row Synchronization

The LEFT PANEL (TaskListPanel) and CENTER PANEL (GanttChart) MUST be vertically aligned row-by-row.

**Implementation**:
1. Both panels call `getVisibleRows()` from the store
2. Both use identical row heights:
   - `GROUP_HEADER_HEIGHT = 40px`
   - `ROW_HEIGHT = 36px`
3. Scroll position is synced via `scrollTop` state in ProjectView
4. When a group expands/collapses, both panels re-render with updated rows

```typescript
// Row type union - used by both panels
type RowType = 
  | { type: 'group-header'; group: TaskGroup; taskCount: number }
  | { type: 'task'; task: Task }
```

**Group collapse behavior**:
- When `toggleGroup(group)` is called, the group is removed from `expandedGroups`
- `getVisibleRows()` excludes tasks from collapsed groups
- Both panels re-render with fewer rows
- Gantt bars for hidden tasks disappear
- Vertical positions of all subsequent rows shift up

---

## Dependency Visualization (CRITICAL UX)

**DO NOT always show all dependency lines.** This creates visual clutter.

### Visibility Rules

| State | What's Shown |
|-------|--------------|
| Default (nothing hovered/selected) | No lines |
| Task HOVERED | Direct deps only (A→D if D depends on A) |
| Task SELECTED | Full upstream + downstream chain |
| "All Deps" toggle ON | All dependencies |
| "Critical Path" toggle ON | Critical path tasks + their dependencies |

### Implementation in GanttChart

```typescript
const visibleDependencies = useMemo(() => {
  // 1. Only include deps between VISIBLE tasks
  const visibleTaskIds = new Set(visibleRows.filter(r => r.type === 'task').map(...))
  
  // 2. Apply visibility rules
  if (showAllDependencies) { /* all deps */ }
  else if (selectedTaskId) { /* full chain */ }
  else if (hoveredTaskId) { /* direct only */ }
  else if (showCriticalPath) { /* critical deps only */ }
  
  return deps
}, [tasks, visibleRows, selectedTaskId, hoveredTaskId, ...])
```

**Dependency line rendering**:
- Orthogonal paths from predecessor end to dependent start
- Arrow markers at destination
- Critical path deps are red/thicker
- Normal deps are blue/thinner
- With sufficient clearance, arrows enter the dependent's left-center edge
- With insufficient clearance, arrows approach from above near the dependent's upper-left edge
- Cramped routing must never produce a backward-looking arrowhead
- Parent exit length, elbow clearance, top inset, and top gap are independently adjustable constants

---

## Gantt Chart Implementation

### Timeline Calculation

```typescript
const timelineData = useMemo(() => {
  // Find min/max dates across all tasks
  // Add padding (7 days before, 14 days after)
  // Calculate total width based on scale
  // Generate date markers for grid
  // Calculate "today" line position
}, [tasks, timelineScale])
```

### Scale Settings

```typescript
const SCALES = {
  day:   { dayWidth: 60, label: 'Day' },   // 60px per day
  week:  { dayWidth: 20, label: 'Week' },  // 20px per day (week view)
  month: { dayWidth: 6,  label: 'Month' }, // 6px per day (month view)
}
```

### Task Bar Positioning

```typescript
// For each visible task row
const taskPositions = useMemo(() => {
  for (const { row, y, height } of rowPositions) {
    if (row.type === 'task') {
      const startOffset = daysBetween(timelineData.minDate, task.startDate)
      const duration = daysBetween(task.startDate, task.endDate)
      
      positions.set(task.id, {
        x: startOffset * scale.dayWidth,
        y: HEADER_HEIGHT + y + (height - BAR_HEIGHT) / 2,
        width: Math.max(duration * scale.dayWidth, 20)
      })
    }
  }
}, [rowPositions, timelineData, scale])
```

### Bar Colors

- `done` → emerald
- `in-progress` → blue
- `blocked` → red
- `todo` → muted gray
- Critical path (when toggled) → red

### Forward-Only Schedule Propagation

This is a core product behavior. Do not change it without explicit user permission.

When a predecessor/parent task is moved or resized in the Gantt chart, dependent tasks are treated as having a minimum start-date constraint:

1. If the predecessor ends before the dependent starts, the dependent stays unchanged.
2. If the predecessor's new end date overlaps or passes the dependent's start date, push the dependent forward so it starts at the predecessor's end date.
3. Preserve the dependent task's original duration when pushing it.
4. Moving a predecessor left must never pull dependents backward.
5. Apply the same rule recursively down the dependency chain.
6. Unrelated tasks must remain unchanged.

Important: this is not fixed-offset dragging. Children/dependents only move forward when the dependency constraint is violated.

### Direct Dependent Movement Constraint

Dependency dates are also enforced when users directly edit a child/dependent task:

1. Determine the latest end date among all direct predecessors.
2. Treat that date as the dependent's minimum start date.
3. Clamp horizontal movement so the dependent cannot start earlier than that boundary.
4. Clamp left-edge resizing to the same boundary.
5. Preserve task duration when a whole-bar movement is clamped.
6. If a task has multiple predecessors, the latest predecessor end date is authoritative.

Together with forward-only propagation, this prevents dependents from crossing backward through their predecessors while still allowing valid schedule gaps.

### Milestones

Rendered as diamonds (`◆`) after the task bar end position.

---

## Task List Panel

### Row Components

1. **GroupHeaderRow**: Collapsible section header
   - Shows group name, task count, status summary
   - Click toggles group expansion
   
2. **TaskRow**: Individual task entry
   - Status indicator dot
   - Task name (with milestone diamond if applicable)
   - Assignee avatar
   - Status badge
   - Dependency count indicator

### Interaction

- Click row → selects task (opens inspector, shows dependency chain)
- Hover row → highlights task, shows direct deps in Gantt
- Click group header → toggles expand/collapse

---

## Context Inspector (Right Panel)

Displays full task details when a task is selected:

- Task title + milestone indicator
- Status, group, priority, critical path badges
- Description
- Assignee with avatar
- Timeline (start/end dates)
- PERT estimates (optimistic/estimated/pessimistic)
- Progress bar
- Dependencies (clickable to navigate)
- Blockers (if any)
- Risk level
- Linked change requests
- Comments with author and timestamp

---

## Dashboard View

Entry screen showing project portfolio:

### KPI Cards
- Active Projects count
- Delayed Projects count
- Pending Approvals count
- Health Score average

### Quick Stats Row
- Tasks In Progress
- Blocked Tasks
- Critical Path Items
- Upcoming Milestones

### Project Cards
- Project name, status badge
- Progress bar
- Health score indicator
- Risk score
- Team size
- Delayed milestones count

### Side Panels
- High Risk Items list
- Upcoming Milestones list

---

## Design Tokens (globals.css)

```css
:root {
  --background: oklch(0.13 0.015 260);
  --foreground: oklch(0.95 0.01 260);
  --card: oklch(0.16 0.015 260);
  --primary: oklch(0.65 0.2 250);
  --destructive: oklch(0.55 0.22 25);
  --muted: oklch(0.25 0.015 260);
  --border: oklch(0.25 0.02 260);
  /* ... etc */
}
```

Color palette: Deep blue-gray backgrounds, blue primary accent, red for critical/blocked, emerald for success, amber for warnings.

---

## Key UX Behaviors to Preserve

1. **Row Sync**: Task list and Gantt MUST stay vertically aligned
2. **Dependency Visibility**: Progressive disclosure (hover → direct, select → chain)
3. **Scroll Sync**: Both panels scroll together vertically
4. **Group Collapse**: Affects both panels simultaneously
5. **Critical Path Mode**: Visual emphasis without cluttering normal view
6. **Dark Mode**: This is the default and only mode
7. **No Spreadsheet Feel**: Rounded bars, subtle grids, soft separators
8. **Forward-Only Propagation**: Moving/resizing predecessors may push dependents forward, but must never pull them backward
9. **Dependent Start Boundary**: Directly moving/resizing a dependent must not place it before the latest predecessor end date
10. **Adaptive Connector Routing**: Cramped dependency arrows enter from above near the dependent's upper-left edge instead of reversing direction

---

## Extension Points

### Adding New Task Groups
1. Add to `TaskGroup` type in `pmis-data.ts`
2. Add entry to `groupConfig` with label and color
3. Add to `GROUP_ORDER` in `pmis-store.ts`

### Adding Task Fields
1. Extend `Task` interface in `pmis-data.ts`
2. Update mock data
3. Add to ContextInspector display

### Custom Dependency Logic
1. Modify `getVisibleDependencies` in `gantt-chart.tsx`
2. Add new toggle to store if needed

### Timeline Features
1. Drag-to-resize is partially implemented (handlers exist)
2. Full implementation would update `updateTaskDates` in store

---

## Performance Considerations

- All computed values use `useMemo` with proper deps
- Scroll sync uses refs to avoid re-renders
- Dependency lines only calculated for visible tasks
- SVG rendering is optimized with grouped elements

---

## Testing Checklist

- [ ] Groups expand/collapse correctly in both panels
- [ ] Scroll sync works in both directions
- [ ] Hovering shows direct dependencies only
- [ ] Selecting shows full dependency chain
- [ ] Critical path toggle highlights correct tasks
- [ ] Timeline scale changes reposition all bars
- [ ] Inspector shows all task details
- [ ] Clicking dependency in inspector navigates to that task
- [ ] Today line is positioned correctly
- [ ] Milestones render as diamonds
- [ ] Moving a dependent left stops at the latest predecessor end date
- [ ] Left-resizing a dependent stops at the latest predecessor end date
- [ ] Clamped dependent moves preserve duration
- [ ] Cramped dependency connectors use top-entry routing without backward arrowheads
