import { normalizeTasks } from "./model.js";
import { BAR_HEIGHT } from "./timeline.js";

export const DEPENDENCY_ELBOW_GAP = 18;
export const DEPENDENCY_PARENT_EXIT_GAP = 4;
export const DEPENDENCY_TOP_INSET = 4;
export const DEPENDENCY_TOP_GAP = 3;

export const DEPENDENCY_GEOMETRY = Object.freeze({
  elbowGap: DEPENDENCY_ELBOW_GAP,
  parentExitGap: DEPENDENCY_PARENT_EXIT_GAP,
  topInset: DEPENDENCY_TOP_INSET,
  topGap: DEPENDENCY_TOP_GAP,
});

function visibleIdSet(tasks, visibleTaskIds) {
  if (visibleTaskIds === undefined || visibleTaskIds === null) {
    return new Set(tasks.map((task) => task.id));
  }
  return new Set(visibleTaskIds);
}

function criticalIdSet(tasks, criticalTaskIds) {
  if (criticalTaskIds !== undefined && criticalTaskIds !== null)
    return new Set(criticalTaskIds);
  return new Set(
    tasks
      .filter((task) => task.isCriticalPath || task.critical)
      .map((task) => task.id),
  );
}

function collectReachable(rootTaskId, taskById, direction) {
  const reachable = new Set();
  const pending = [rootTaskId];
  while (pending.length > 0) {
    const taskId = pending.pop();
    if (reachable.has(taskId)) continue;
    const task = taskById.get(taskId);
    if (!task) continue;
    reachable.add(taskId);
    const nextIds =
      direction === "upstream" ? task.predecessorIds : task.dependents;
    for (const nextId of nextIds) pending.push(nextId);
  }
  return reachable;
}

function resolveVisibilityMode(options) {
  if (options.mode) return options.mode;
  if (options.showAllDependencies) return "all";
  if (options.selectedTaskId) return "selected";
  if (options.hoveredTaskId) return "hovered";
  if (options.showCriticalPath) return "critical";
  return "none";
}

function freezeEdge(fromTask, toTask, isCritical) {
  return Object.freeze({
    fromTaskId: fromTask.id,
    toTaskId: toTask.id,
    fromTask,
    toTask,
    isCritical,
  });
}

/**
 * Applies PMIS progressive disclosure in this precedence order:
 * all -> selected chain -> hovered direct edges -> critical path -> none.
 */
export function selectVisibleDependencies(options) {
  if (!options || typeof options !== "object")
    throw new TypeError("options are required");
  const tasks = normalizeTasks(options.tasks ?? []);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const visibleTaskIds = visibleIdSet(tasks, options.visibleTaskIds);
  const criticalTaskIds = criticalIdSet(tasks, options.criticalTaskIds);
  const mode = resolveVisibilityMode(options);
  const selectedTaskId = options.selectedTaskId ?? null;
  const hoveredTaskId = options.hoveredTaskId ?? null;

  if (!["none", "all", "selected", "hovered", "critical"].includes(mode)) {
    throw new RangeError(`Unsupported dependency visibility mode: ${mode}`);
  }
  if (mode === "none") return Object.freeze([]);

  let relevantTaskIds = null;
  if (mode === "selected") {
    if (!taskById.has(selectedTaskId)) return Object.freeze([]);
    relevantTaskIds = new Set([
      ...collectReachable(selectedTaskId, taskById, "upstream"),
      ...collectReachable(selectedTaskId, taskById, "downstream"),
    ]);
  }

  if (mode === "hovered") {
    const hoveredTask = taskById.get(hoveredTaskId);
    if (!hoveredTask) return Object.freeze([]);
    relevantTaskIds = new Set([
      hoveredTask.id,
      ...hoveredTask.predecessorIds,
      ...hoveredTask.dependents,
    ]);
  }

  const edges = [];
  for (const toTask of tasks) {
    for (const fromTaskId of toTask.predecessorIds) {
      const fromTask = taskById.get(fromTaskId);
      if (!fromTask) continue;
      if (!visibleTaskIds.has(fromTask.id) || !visibleTaskIds.has(toTask.id))
        continue;

      if (
        mode === "selected" &&
        (!relevantTaskIds.has(fromTask.id) || !relevantTaskIds.has(toTask.id))
      )
        continue;
      if (
        mode === "hovered" &&
        fromTask.id !== hoveredTaskId &&
        toTask.id !== hoveredTaskId
      )
        continue;
      if (
        mode === "critical" &&
        (!criticalTaskIds.has(fromTask.id) || !criticalTaskIds.has(toTask.id))
      )
        continue;

      const isCritical =
        criticalTaskIds.has(fromTask.id) && criticalTaskIds.has(toTask.id);
      edges.push(freezeEdge(fromTask, toTask, isCritical));
    }
  }

  return Object.freeze(edges);
}

function finiteNonNegative(value, name) {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be a finite non-negative number`);
  return value;
}

function connectorGeometry(overrides = {}) {
  return Object.freeze({
    elbowGap: finiteNonNegative(
      overrides.elbowGap ?? DEPENDENCY_ELBOW_GAP,
      "elbowGap",
    ),
    parentExitGap: finiteNonNegative(
      overrides.parentExitGap ?? DEPENDENCY_PARENT_EXIT_GAP,
      "parentExitGap",
    ),
    topInset: finiteNonNegative(
      overrides.topInset ?? DEPENDENCY_TOP_INSET,
      "topInset",
    ),
    topGap: finiteNonNegative(overrides.topGap ?? DEPENDENCY_TOP_GAP, "topGap"),
  });
}

function normalizePosition(position, name) {
  if (!position || typeof position !== "object")
    throw new TypeError(`${name} position is required`);
  const x = position.x;
  const y = position.y;
  const width = position.width ?? 0;
  const height = position.height ?? BAR_HEIGHT;
  for (const [field, value] of Object.entries({ x, y, width, height })) {
    if (!Number.isFinite(value))
      throw new TypeError(`${name}.${field} must be finite`);
  }
  if (width < 0 || height < 0)
    throw new RangeError(`${name} width and height must be non-negative`);
  return { x, y, width, height };
}

function pathFromCommands(commands) {
  return commands
    .map((command) => {
      if (command.command === "M") return `M ${command.x} ${command.y}`;
      if (command.command === "H") return `H ${command.x}`;
      return `V ${command.y}`;
    })
    .join(" ");
}

/**
 * Returns one continuous orthogonal SVG path. Styling metadata explicitly keeps
 * the stroke solid so long paths cannot turn into detached dash fragments.
 */
export function routeDependency(
  fromPositionValue,
  toPositionValue,
  configuration = {},
) {
  const fromPosition = normalizePosition(fromPositionValue, "from");
  const toPosition = normalizePosition(toPositionValue, "to");
  const geometry = connectorGeometry(configuration);

  const fromX = fromPosition.x + fromPosition.width;
  const fromY = fromPosition.y + fromPosition.height / 2;
  const toX = toPosition.x;
  const toY = toPosition.y + toPosition.height / 2;
  const horizontalClearance = toX - fromX;
  const canEnterFromLeft = horizontalClearance >= geometry.elbowGap * 2;

  let route;
  let commands;
  let markerDirection;
  if (canEnterFromLeft) {
    const midX = Math.max(
      fromX + geometry.elbowGap,
      Math.min(toX - geometry.elbowGap, (fromX + toX) / 2),
    );
    route = "left-entry";
    markerDirection = "right";
    commands = [
      { command: "M", x: fromX, y: fromY },
      { command: "H", x: midX },
      { command: "V", y: toY },
      { command: "H", x: toX },
    ];
  } else {
    const routeX = fromX + geometry.parentExitGap;
    const entryX = toX + geometry.topInset;
    const endY = toPosition.y - geometry.topGap;
    // Preserve a downward final segment even when callers tune topGap above elbowGap.
    const approachY = Math.min(toPosition.y - geometry.elbowGap, endY - 1);
    route = "top-entry";
    markerDirection = "down";
    commands = [
      { command: "M", x: fromX, y: fromY },
      { command: "H", x: routeX },
      { command: "V", y: approachY },
      { command: "H", x: entryX },
      { command: "V", y: endY },
    ];
  }

  const frozenCommands = Object.freeze(
    commands.map((command) => Object.freeze(command)),
  );
  return Object.freeze({
    route,
    path: pathFromCommands(frozenCommands),
    commands: frozenCommands,
    markerDirection,
    horizontalClearance,
    geometry,
    solid: true,
    strokeDasharray: "none",
    strokeDashoffset: 0,
    vectorEffect: "non-scaling-stroke",
  });
}

export const routeDependencyConnector = routeDependency;

function positionByTaskId(positions) {
  if (positions instanceof Map) return positions;
  if (Array.isArray(positions))
    return new Map(positions.map((position) => [position.taskId, position]));
  if (positions && typeof positions === "object")
    return new Map(Object.entries(positions));
  throw new TypeError(
    "positions must be a Map, array, or object keyed by task ID",
  );
}

export function buildDependencyRoutes(edges, positions, configuration = {}) {
  if (!Array.isArray(edges)) throw new TypeError("edges must be an array");
  const positionsByTaskId = positionByTaskId(positions);
  const routes = [];
  for (const edge of edges) {
    const fromPosition = positionsByTaskId.get(edge.fromTaskId);
    const toPosition = positionsByTaskId.get(edge.toTaskId);
    if (!fromPosition || !toPosition) continue;
    routes.push(
      Object.freeze({
        ...edge,
        geometry: routeDependency(fromPosition, toPosition, configuration),
      }),
    );
  }
  return Object.freeze(routes);
}
