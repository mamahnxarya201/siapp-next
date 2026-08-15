/**
 * Framework-free task normalization and dependency-graph validation.
 *
 * The kernel accepts both the current PMIS UI shape (`startDate`, `endDate`,
 * `dependencies`) and the planning-domain shape (`dates`, `predecessorIds`).
 * Internally, predecessor IDs are canonical. Supplied `dependents` arrays are
 * deliberately ignored and rebuilt from those predecessor IDs.
 */

function cloneValue(value, seen = new WeakMap()) {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map((item) => cloneValue(item, seen));
  if (!value || typeof value !== "object") return value;

  if (seen.has(value)) return seen.get(value);

  const clone = Object.create(
    Object.getPrototypeOf(value) === null ? null : Object.prototype,
  );
  seen.set(value, clone);
  for (const [key, nestedValue] of Object.entries(value)) {
    clone[key] = cloneValue(nestedValue, seen);
  }
  return clone;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nestedValue of Object.values(value)) deepFreeze(nestedValue, seen);
  return Object.freeze(value);
}

export function normalizeDate(value, fieldName = "date") {
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(
      `${fieldName} must be a valid Date or date-compatible value`,
    );
  }
  return date;
}

function normalizeId(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

export function predecessorIdsOf(task) {
  const candidate = task?.predecessorIds ?? task?.dependencies ?? [];
  if (!Array.isArray(candidate)) {
    throw new TypeError(
      `Task ${task?.id ?? "<unknown>"} predecessorIds must be an array`,
    );
  }
  return candidate;
}

function normalizePredecessorIds(task, taskId) {
  const predecessorIds = predecessorIdsOf(task).map((predecessorId, index) =>
    normalizeId(predecessorId, `Task ${taskId} predecessorIds[${index}]`),
  );
  const uniquePredecessorIds = new Set(predecessorIds);
  if (uniquePredecessorIds.size !== predecessorIds.length) {
    throw new Error(`Task ${taskId} contains duplicate predecessor IDs`);
  }
  if (uniquePredecessorIds.has(taskId)) {
    throw new Error(`Task ${taskId} cannot depend on itself`);
  }
  return predecessorIds;
}

function taskDateInputs(task, taskId) {
  const startInput = task.startDate ?? task.dates?.start;
  const endInput = task.endDate ?? task.dates?.end;
  if (startInput === undefined)
    throw new TypeError(`Task ${taskId} is missing startDate`);
  if (endInput === undefined)
    throw new TypeError(`Task ${taskId} is missing endDate`);

  const startDate = normalizeDate(startInput, `Task ${taskId} startDate`);
  const endDate = normalizeDate(endInput, `Task ${taskId} endDate`);
  if (endDate.getTime() < startDate.getTime()) {
    throw new RangeError(`Task ${taskId} endDate must not be before startDate`);
  }
  return { startDate, endDate };
}

function topologicalOrderFromNormalizedTasks(tasks) {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set();
  const visited = new Set();
  const path = [];
  const order = [];

  const visit = (taskId) => {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) {
      const cycleStart = path.indexOf(taskId);
      const cycle = [...path.slice(cycleStart), taskId].join(" -> ");
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    visiting.add(taskId);
    path.push(taskId);
    const task = tasksById.get(taskId);
    for (const predecessorId of task.predecessorIds) visit(predecessorId);
    path.pop();
    visiting.delete(taskId);
    visited.add(taskId);
    order.push(taskId);
  };

  for (const task of tasks) visit(task.id);
  return order;
}

/**
 * Returns a fresh, deeply frozen task array. Graph validation covers duplicate
 * IDs, duplicate edges, self-dependencies, dangling predecessor IDs, and cycles.
 */
export function normalizeTasks(sourceTasks) {
  if (!Array.isArray(sourceTasks))
    throw new TypeError("tasks must be an array");

  const seenTaskIds = new Set();
  const mutableTasks = sourceTasks.map((sourceTask, index) => {
    if (!sourceTask || typeof sourceTask !== "object") {
      throw new TypeError(`tasks[${index}] must be an object`);
    }

    const id = normalizeId(sourceTask.id, `tasks[${index}].id`);
    if (seenTaskIds.has(id)) throw new Error(`Duplicate task ID: ${id}`);
    seenTaskIds.add(id);

    const { startDate, endDate } = taskDateInputs(sourceTask, id);
    const predecessorIds = normalizePredecessorIds(sourceTask, id);
    const clone = cloneValue(sourceTask);
    const groupName =
      sourceTask.groupName ??
      sourceTask.workstreamId ??
      sourceTask.group ??
      null;
    const workstreamId =
      sourceTask.workstreamId ??
      sourceTask.groupName ??
      sourceTask.group ??
      null;
    const name = sourceTask.name ?? sourceTask.title ?? id;
    const title = sourceTask.title ?? sourceTask.name ?? id;
    const mostLikelyDays =
      sourceTask.mostLikelyDays ?? sourceTask.estimatedDays;

    return {
      ...clone,
      id,
      name,
      title,
      groupName,
      workstreamId,
      startDate,
      endDate,
      dates: {
        start: new Date(startDate.getTime()),
        end: new Date(endDate.getTime()),
      },
      predecessorIds: [...predecessorIds],
      dependencies: [...predecessorIds],
      dependents: [],
      ...(mostLikelyDays === undefined
        ? {}
        : {
            mostLikelyDays,
            estimatedDays: sourceTask.estimatedDays ?? mostLikelyDays,
          }),
    };
  });

  const mutableTaskById = new Map(mutableTasks.map((task) => [task.id, task]));
  for (const task of mutableTasks) {
    for (const predecessorId of task.predecessorIds) {
      const predecessor = mutableTaskById.get(predecessorId);
      if (!predecessor) {
        throw new Error(
          `Task ${task.id} has dangling predecessor ID: ${predecessorId}`,
        );
      }
      predecessor.dependents.push(task.id);
    }
  }

  topologicalOrderFromNormalizedTasks(mutableTasks);
  return Object.freeze(mutableTasks.map((task) => deepFreeze(task)));
}

export function topologicalTaskIds(sourceTasks) {
  const tasks = normalizeTasks(sourceTasks);
  return Object.freeze(topologicalOrderFromNormalizedTasks(tasks));
}

export function dependencyEdges(sourceTasks) {
  const tasks = normalizeTasks(sourceTasks);
  const edges = [];
  for (const task of tasks) {
    for (const predecessorId of task.predecessorIds) {
      edges.push(
        Object.freeze({ fromTaskId: predecessorId, toTaskId: task.id }),
      );
    }
  }
  return Object.freeze(edges);
}

/**
 * Convenience graph snapshot for callers that need normalized tasks, a stable
 * topological order, and canonical edges without retaining mutable indexes.
 */
export function createTaskGraph(sourceTasks) {
  const tasks = normalizeTasks(sourceTasks);
  return Object.freeze({
    tasks,
    topologicalTaskIds: Object.freeze(
      topologicalOrderFromNormalizedTasks(tasks),
    ),
    edges: dependencyEdges(tasks),
  });
}
