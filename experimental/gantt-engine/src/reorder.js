/**
 * Vertical-reorder geometry for the Gantt.
 *
 * The flat `order` list is the source of truth for row sequence. A task's
 * workstream is derived from its position in that list (the nearest preceding
 * workstream header), so moving a task across a header both reorders it AND
 * reassigns its group. This module maps a pointer Y over the visible rows to a
 * new flat order plus the resulting per-task groupName, and provides the
 * workstream-header reorder used to reorder whole groups.
 */

const WORKSTREAM = "workstream";
const TASK = "task";

function taskEntry(taskId) {
  return { type: TASK, id: taskId };
}

function workstreamEntry(workstreamId) {
  return { type: WORKSTREAM, id: workstreamId };
}

/**
 * Computes the visible drop boundaries (flat insertion indices) from the
 * current order and the rendered rows. Each visible row contributes one
 * boundary at its flat index: inserting at `boundary` places the dragged entry
 * immediately before that row. Collapsed workstream headers and rows in the
 * dragged task's own removed slot are excluded as targets.
 *
 * Returns an array of `{ flatIndex, y, isHeader, group }` candidates sorted by
 * y, where `group` is the workstream whose block the insertion would land in
 * (null for the ungrouped tail).
 */
export function dropBoundaries({ order, rows, expanded }) {
  // Build a map from visible row to its flat order index. Both headers and
  // tasks appear in `order`; visible rows mirror it (minus collapsed headers'
  // hidden tasks).
  const flatByRowKey = new Map();
  for (let index = 0; index < order.length; index += 1) {
    const entry = order[index];
    flatByRowKey.set(entry.id, index);
  }

  const candidates = [];
  let lastWorkstream = null;
  for (const row of rows) {
    if (row.type === "group-header") {
      lastWorkstream = row.group;
      const flatIndex = flatByRowKey.get(row.group);
      if (flatIndex === undefined) continue;
      // A collapsed header is a boundary, but never a destination group.
      // Dropping on an expanded header inserts INTO that group (right after
      // the header), matching "release under a workstream's task list".
      const collapsed = !(expanded?.has(row.group) ?? true);
      candidates.push({
        flatIndex: collapsed ? flatIndex : flatIndex + 1,
        y: row.y,
        isHeader: true,
        group: collapsed ? null : row.group,
        collapsed,
      });
      continue;
    }
    if (row.type === "task") {
      const flatIndex = flatByRowKey.get(row.task.id);
      if (flatIndex === undefined) continue;
      candidates.push({
        flatIndex,
        y: row.y,
        isHeader: false,
        group: lastWorkstream,
        collapsed: false,
      });
    }
  }
  return candidates;
}

/**
 * Picks the target boundary for a pointer Y over the rows (row coords in the
 * same space as `rows[].y`, i.e. below the calendar header). The closest row
 * midpoint wins; the ungrouped tail (past the last visible row) maps to the
 * end of the list.
 */
export function targetBoundary(candidates, pointerY) {
  if (!candidates.length) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = Math.abs(pointerY - (candidate.y + 18));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/**
 * Applies a vertical reorder of a task to the pointer position.
 *
 * @param {object} params
 * @param {Array}  params.order     Current flat order.
 * @param {Array}  params.tasks     Normalized tasks.
 * @param {Array}  params.rows      Rendered rows (from the snapshot).
 * @param {string} params.taskId    Dragged task id.
 * @param {number} params.pointerY  Pointer Y in row space.
 * @param {Set}    params.expanded  Set of expanded workstream ids.
 * @returns {{ order: Array, tasks: Array, valid: boolean } | null} null when no
 *          valid target (e.g. pointer over a collapsed header only).
 */
export function reorderTaskToPointer({
  order,
  tasks,
  rows,
  taskId,
  pointerY,
  expanded,
}) {
  const candidates = dropBoundaries({ order, rows, expanded });
  const boundary = targetBoundary(candidates, pointerY);
  if (!boundary) return null;
  if (boundary.isHeader && boundary.collapsed) return null;

  // Derive the destination group from the flat position: the nearest preceding
  // workstream header in the NEW order.
  const fromIndex = order.findIndex(
    (entry) => entry.type === TASK && entry.id === taskId,
  );
  if (fromIndex === -1) return null;

  // Remove the dragged entry, then insert before the boundary's flat index.
  const withoutDragged = order.filter(
    (entry) => !(entry.type === TASK && entry.id === taskId),
  );
  // The boundary index refers to the order BEFORE removal; shift by -1 when the
  // removed entry sat before it.
  let insertAt = boundary.flatIndex;
  if (fromIndex < boundary.flatIndex) insertAt -= 1;
  const clamp = Math.max(0, Math.min(insertAt, withoutDragged.length));
  const nextOrder = [...withoutDragged];
  nextOrder.splice(clamp, 0, taskEntry(taskId));

  // Recompute the dragged task's workstream from its new flat position.
  let group = null;
  for (let index = clamp - 1; index >= 0; index -= 1) {
    if (nextOrder[index].type === WORKSTREAM) {
      group = nextOrder[index].id;
      break;
    }
  }
  if (group !== null && !expanded.has(group)) return null;

  const nextTasks = tasks.map((task) =>
    task.id === taskId ? { ...task, groupName: group, workstreamId: group } : task,
  );
  return {
    order: Object.freeze(nextOrder),
    tasks: nextTasks,
    valid: true,
    insertionY: boundary.y,
    targetGroup: group,
  };
}

/**
 * Reorders a whole workstream block relative to the other workstream blocks by
 * moving its header (and all of its tasks) to a target block position.
 *
 * @param {Array}  order     Current flat order.
 * @param {Array}  tasks     Normalized tasks.
 * @param {string} workstreamId Dragged header id.
 * @param {number} targetBlockIndex 0-based position among workstream blocks.
 */
export function reorderWorkstreamToIndex({
  order,
  workstreamId,
  targetBlockIndex,
}) {
  const blocks = [];
  let current = null;
  for (const entry of order) {
    if (entry.type === WORKSTREAM) {
      current = { header: entry, tasks: [] };
      blocks.push(current);
    } else if (current) {
      current.tasks.push(entry);
    }
  }
  const from = blocks.findIndex(
    (block) => block.header.id === workstreamId,
  );
  if (from === -1) return null;
  const [moved] = blocks.splice(from, 1);
  const clamp = Math.max(0, Math.min(targetBlockIndex, blocks.length));
  blocks.splice(clamp, 0, moved);
  const nextOrder = blocks.flatMap((block) => [block.header, ...block.tasks]);
  return Object.freeze(nextOrder);
}
