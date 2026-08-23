import { normalizeTasks } from "./model.js";
import { BAR_HEIGHT } from "./timeline.js";

export const DEPENDENCY_ELBOW_GAP = 18;
export const DEPENDENCY_TOP_INSET = 4;
export const DEPENDENCY_CUE_MIN_SEGMENT_LENGTH = 12;
export const DEPENDENCY_LINE_WIDTH_MIN = 1;
export const DEPENDENCY_LINE_WIDTH_MAX = 3;
export const DEPENDENCY_LINE_WIDTH_STEP = 0.5;
export const DEPENDENCY_CUE_SIZE_MIN = 3;
export const DEPENDENCY_CUE_SIZE_MAX = 8;
export const DEPENDENCY_CUE_SIZE_STEP = 1;
export const DEPENDENCY_CRITICAL_WIDTH_SCALE = 1.33;

export const DEFAULT_DEPENDENCY_APPEARANCE = Object.freeze({
  lineWidth: 1.5,
  cueSize: 6,
});

function normalizeSteppedNumber(value, minimum, maximum, step, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const clamped = Math.max(minimum, Math.min(maximum, number));
  return Number(
    (minimum + Math.round((clamped - minimum) / step) * step).toFixed(2),
  );
}

export function normalizeDependencyAppearance(value = {}) {
  const appearance = value && typeof value === "object" ? value : {};
  return Object.freeze({
    lineWidth: normalizeSteppedNumber(
      appearance.lineWidth,
      DEPENDENCY_LINE_WIDTH_MIN,
      DEPENDENCY_LINE_WIDTH_MAX,
      DEPENDENCY_LINE_WIDTH_STEP,
      DEFAULT_DEPENDENCY_APPEARANCE.lineWidth,
    ),
    cueSize: normalizeSteppedNumber(
      appearance.cueSize,
      DEPENDENCY_CUE_SIZE_MIN,
      DEPENDENCY_CUE_SIZE_MAX,
      DEPENDENCY_CUE_SIZE_STEP,
      DEFAULT_DEPENDENCY_APPEARANCE.cueSize,
    ),
  });
}
export const DEPENDENCY_GEOMETRY = Object.freeze({
  elbowGap: DEPENDENCY_ELBOW_GAP,
  topInset: DEPENDENCY_TOP_INSET,
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
    topInset: finiteNonNegative(
      overrides.topInset ?? DEPENDENCY_TOP_INSET,
      "topInset",
    ),
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

function dependencyCuePoints(segment, cueSize) {
  const midpointX = (segment.from.x + segment.to.x) / 2;
  const midpointY = (segment.from.y + segment.to.y) / 2;
  const halfSize = cueSize / 2;
  const directionX = Math.sign(segment.to.x - segment.from.x);
  const directionY = Math.sign(segment.to.y - segment.from.y);
  const normalX = -directionY;
  const normalY = directionX;
  const tip = {
    x: midpointX + directionX * halfSize,
    y: midpointY + directionY * halfSize,
  };
  const base = {
    x: midpointX - directionX * halfSize,
    y: midpointY - directionY * halfSize,
  };
  return [
    tip,
    {
      x: base.x + normalX * halfSize,
      y: base.y + normalY * halfSize,
    },
    {
      x: base.x - normalX * halfSize,
      y: base.y - normalY * halfSize,
    },
  ];
}

function dependencyCuesFromCommands(commands, cueSize) {
  const segments = [];
  let point = null;
  for (const command of commands) {
    if (command.command === "M") {
      point = { x: command.x, y: command.y };
      continue;
    }
    if (!point) continue;
    const nextPoint =
      command.command === "H"
        ? { x: command.x, y: point.y }
        : { x: point.x, y: command.y };
    const length = Math.abs(nextPoint.x - point.x) + Math.abs(nextPoint.y - point.y);
    if (length > 0) {
      const axis = point.x === nextPoint.x ? "vertical" : "horizontal";
      const direction =
        axis === "horizontal"
          ? nextPoint.x > point.x
            ? "right"
            : "left"
          : nextPoint.y > point.y
            ? "down"
            : "up";
      const previous = segments.at(-1);
      if (previous?.axis === axis && previous.direction === direction) {
        previous.to = nextPoint;
        previous.length += length;
      } else {
        segments.push({
          axis,
          direction,
          from: point,
          to: nextPoint,
          length,
        });
      }
    }
    point = nextPoint;
  }

  return Object.freeze(
    segments
      .filter((segment) => segment.length >= DEPENDENCY_CUE_MIN_SEGMENT_LENGTH)
      .map((segment) =>
        Object.freeze({
          direction: segment.direction,
          length: segment.length,
          points: Object.freeze(
            dependencyCuePoints(segment, cueSize).map((pointValue) =>
              Object.freeze(pointValue),
            ),
          ),
        }),
      ),
  );
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
  const appearance = normalizeDependencyAppearance({
    cueSize: configuration.cueSize,
  });
  const fromY = fromPosition.y + fromPosition.height / 2;
  const toX = toPosition.x;
  const toY = toPosition.y + toPosition.height / 2;
  const horizontalClearance = toX - fromX;
  const canEnterFromLeft = horizontalClearance >= geometry.elbowGap * 2;

  let route;
  let commands;
  let markerDirection;
  if (canEnterFromLeft) {
    const trunkX = fromX + geometry.elbowGap;
    route = "left-entry";
    markerDirection = "right";
    commands = [
      { command: "M", x: fromX, y: fromY },
      { command: "H", x: trunkX },
      { command: "V", y: toY },
      { command: "H", x: toX },
    ];
  } else {
    const entryX = toX + geometry.topInset;
    const targetIsBelow = toY >= fromY;
    const endY = targetIsBelow
      ? toPosition.y
      : toPosition.y + toPosition.height;
    route = targetIsBelow ? "top-entry" : "bottom-entry";
    markerDirection = targetIsBelow ? "down" : "up";
    commands = [
      { command: "M", x: fromX, y: fromY },
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
    cues: dependencyCuesFromCommands(frozenCommands, appearance.cueSize),
    cueSize: appearance.cueSize,
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
