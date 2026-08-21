import {
  applyForwardOnlyScheduleChange,
  calculateDraggedTaskDates,
} from "./scheduling.js";
import { snapIncrementUnits } from "./timeline.js";
import {
  reorderTaskToPointer,
  reorderWorkstreamToIndex,
} from "./reorder.js";

// Width of the autoscroll band measured inside the viewport edge. The viewport
// often sits flush with the browser window edge, so scrolling must start as soon
// as the pointer enters this band rather than only when it leaves the viewport.
const AUTO_SCROLL_BAND = 40;
const AUTO_SCROLL_MAX_SPEED = 900; // px/s at full dwell and penetration.
const AUTO_SCROLL_ACCELERATION = 2400; // px/s² while accelerating.
const AUTO_SCROLL_DECELERATION = 3200; // px/s² while neutralizing/reversing.
const AUTO_SCROLL_RAMP_MS = 900;
const AUTO_SCROLL_MAX_FRAME_MS = 100;
const AUTO_SCROLL_STOP_EPSILON = 0.5;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Integrates velocity in real time. A sign change always decelerates through
// zero before accelerating in the opposite direction.
export function advanceAutoScrollVelocity({
  velocity = 0,
  direction = 0,
  penetration = 0,
  heldMs = 0,
  deltaMs,
}) {
  if (!Number.isFinite(deltaMs) || deltaMs < 0)
    throw new RangeError("deltaMs must be a non-negative finite number");
  const seconds = Math.min(deltaMs, AUTO_SCROLL_MAX_FRAME_MS) / 1000;
  const target =
    direction === 0
      ? 0
      : direction *
        AUTO_SCROLL_MAX_SPEED *
        clamp(penetration, 0, 1) *
        clamp(heldMs / AUTO_SCROLL_RAMP_MS, 0, 1);
  const opposing = velocity !== 0 && target !== 0 && Math.sign(velocity) !== Math.sign(target);
  const rate = opposing || target === 0
    ? AUTO_SCROLL_DECELERATION
    : AUTO_SCROLL_ACCELERATION;
  const step = rate * seconds;
  if (opposing || target === 0) {
    const magnitude = Math.max(0, Math.abs(velocity) - step);
    return magnitude <= AUTO_SCROLL_STOP_EPSILON ? 0 : Math.sign(velocity) * magnitude;
  }
  if (Math.abs(target - velocity) <= step) return target;
  return velocity + Math.sign(target - velocity) * step;
}

const closestTask = (target, root) => {
  const el =
    target instanceof Element ? target.closest("[data-task-id]") : null;
  return el && root.contains(el) ? el : null;
};

const closestGroup = (target, root) => {
  const el =
    target instanceof Element ? target.closest("[data-group-id]") : null;
  return el && root.contains(el) ? el : null;
};

// Maps a pointer row-Y to a workstream block index. Each visible group header
// row is a boundary: the pointer lands on the block whose header row midpoint
// is nearest. Falls back to the last block when below all headers.
const groupBlockIndex = (rows, order, pointerY) => {
  const headers = rows.filter((row) => row.type === "group-header");
  if (!headers.length) return 0;
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < headers.length; index += 1) {
    const distance = Math.abs(pointerY - (headers[index].y + 20));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
};

export class GanttInteractionController {
  constructor({
    root,
    scheduler,
    getState,
    getSnapshot,
    getPointerRowY,
    onSelect,
    onHover,
    onPreview,
    onCommit,
    onLeftEdge,
    onNotice = () => {},
  }) {
    this.root = root;
    this.scheduler = scheduler;
    this.getState = getState;
    this.getSnapshot = getSnapshot;
    this.getPointerRowY = getPointerRowY;
    this.onSelect = onSelect;
    this.onHover = onHover;
    this.onPreview = onPreview;
    this.onCommit = onCommit;
    this.onLeftEdge = onLeftEdge;
    this.onNotice = onNotice;
    this.frame = null;
    this.autoScrollVelocity = 0;
    this.autoScrollHeldMs = 0;
    this.autoScrollLastTimestamp = null;
    this.autoScrollDirection = 0;
    this.autoScrollPenetration = 0;
    this.leftEdgeExtensionLatched = false;
    this.listeners = {
      pointerdown: (e) => this.down(e),
      pointerover: (e) => this.over(e),
      pointerout: (e) => this.out(e),
      keydown: (e) => this.key(e),
      pointermove: (e) => this.move(e),
      pointerup: (e) => this.up(e),
      pointercancel: () => this.cancel("Pointer interaction cancelled."),
      lostpointercapture: () => this.cancel("Pointer capture was lost."),
      blur: () => this.cancel("Window focus was lost."),
    };
  }
  start() {
    if (this.started) return false;
    for (const type of ["pointerdown", "pointerover", "pointerout", "keydown", "lostpointercapture"])
      this.root.addEventListener(type, this.listeners[type]);
    for (const type of ["pointermove", "pointerup", "pointercancel", "blur"])
      window.addEventListener(type, this.listeners[type]);
    this.started = true;
    return true;
  }
  stop() {
    if (!this.started) return false;
    this.cancel();
    for (const type of ["pointerdown", "pointerover", "pointerout", "keydown", "lostpointercapture"])
      this.root.removeEventListener(type, this.listeners[type]);
    for (const type of ["pointermove", "pointerup", "pointercancel", "blur"])
      window.removeEventListener(type, this.listeners[type]);
    this.started = false;
    return true;
  }
  down(event) {
    if (event.defaultPrevented || event.button !== 0) return;
    const state = this.getState();
    if (state.connection || state.connectionLock) return;
    const taskElement = closestTask(event.target, this.root);
    const groupElement = closestGroup(event.target, this.root);
    if (!taskElement && !groupElement) return;

    if (groupElement) {
      const groupId = groupElement.dataset.groupId;
      if (!groupId) return;
      event.preventDefault();
      this.active = {
        kind: "group",
        groupId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        pendingClientX: event.clientX,
        pendingClientY: event.clientY,
        rowOrder: state.rowOrder,
        committedRows: this.getSnapshot?.().rows ?? [],
      };
      this.root.setPointerCapture?.(event.pointerId);
      return;
    }

    const task = state.tasks.find(
      (item) => item.id === taskElement.dataset.taskId,
    );
    if (!task) return;
    const interactionElement =
      event.target instanceof Element
        ? event.target.closest("[data-interaction-mode]")
        : null;
    const mode =
      interactionElement && taskElement.contains(interactionElement)
        ? interactionElement.dataset.interactionMode
        : "move";
    event.preventDefault();
    this.onSelect(task.id);
    this.autoScrollVelocity = 0;
    this.autoScrollHeldMs = 0;
    this.autoScrollLastTimestamp = null;
    this.autoScrollDirection = 0;
    this.active = {
      kind: "task",
      taskId: task.id,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: this.root.scrollLeft,
      pendingClientX: event.clientX,
      pendingClientY: event.clientY,
      tasks: state.tasks,
      rowOrder: state.rowOrder,
      committedRows: this.getSnapshot?.().rows ?? [],
      expandedWorkstreams: state.expandedWorkstreams,
      scale: state.scale,
      snapIncrement: state.snapIncrement,
      visibleWeekdays: state.visibleWeekdays,
      lastEdgeDirection: 0,
    };
    this.root.setPointerCapture?.(event.pointerId);
  }
  move(event) {
    this.moveGesture(event);
  }
  moveGesture(event) {
    if (!this.active) return;
    const drag = this.active;
    drag.pendingClientX = event.clientX;
    drag.pendingClientY = event.clientY;
    if (this.getPointerRowY) {
      drag.pendingRowY = this.getPointerRowY(event);
    }
    this.updateAutoScrollTarget();
    this.scheduleDragFrame();
  }
  // Updates the target state only. Scroll integration and preview rendering
  // happen together in one drag-owned animation frame.
  updateAutoScrollTarget() {
    const drag = this.active;
    if (!drag || drag.kind !== "task") {
      this.autoScrollDirection = 0;
      this.autoScrollPenetration = 0;
      this.leftEdgeExtensionLatched = false;
      return;
    }
    const rect = this.root.getBoundingClientRect();
    const pointerX = drag.pendingClientX;
    let direction = 0;
    let penetration = 0;
    if (pointerX <= rect.left + AUTO_SCROLL_BAND) {
      direction = -1;
      penetration = clamp(
        (rect.left + AUTO_SCROLL_BAND - pointerX) / AUTO_SCROLL_BAND,
        0,
        1,
      );
    } else if (pointerX >= rect.right - AUTO_SCROLL_BAND) {
      direction = 1;
      penetration = clamp(
        (pointerX - (rect.right - AUTO_SCROLL_BAND)) / AUTO_SCROLL_BAND,
        0,
        1,
      );
    }
    if (direction !== this.autoScrollDirection)
      this.autoScrollHeldMs = 0;
    if (direction !== 0) drag.lastEdgeDirection = direction;
    this.autoScrollDirection = direction;
    this.autoScrollPenetration = penetration;
  }
  scheduleDragFrame() {
    if (!this.active || this.frame) return;
    this.frame = this.scheduler.scheduleAnimationFrame((timestamp) => {
      this.frame = null;
      this.tickDrag(timestamp);
    });
  }
  tickDrag(timestamp) {
    const drag = this.active;
    if (!drag) return;
    if (drag.kind === "task") {
      const now = Number.isFinite(timestamp) ? timestamp : Date.now();
      const previous = this.autoScrollLastTimestamp ?? now;
      const deltaMs = clamp(
        now - previous,
        0,
        AUTO_SCROLL_MAX_FRAME_MS,
      );
      this.autoScrollLastTimestamp = now;
      const direction = this.autoScrollDirection;
      if (direction !== 0) this.autoScrollHeldMs += deltaMs;
      else this.autoScrollHeldMs = 0;
      this.autoScrollVelocity = advanceAutoScrollVelocity({
        velocity: this.autoScrollVelocity,
        direction,
        penetration: this.autoScrollPenetration,
        heldMs: this.autoScrollHeldMs,
        deltaMs,
      });
      const max = Math.max(0, this.root.scrollWidth - this.root.clientWidth);
      const nextScrollLeft = clamp(
        this.root.scrollLeft +
          this.autoScrollVelocity * (deltaMs / 1000),
        0,
        max,
      );
      const reachedBound =
        (nextScrollLeft === 0 && this.autoScrollVelocity < 0) ||
        (nextScrollLeft === max && this.autoScrollVelocity > 0);
      this.root.scrollLeft = nextScrollLeft;
      if (
        direction === -1 &&
        this.root.scrollLeft > 0 &&
        drag.leftBufferScrollCompensation
      ) {
        drag.leftBufferScrollCompensation = 0;
      }
      if (
        direction === -1 &&
        nextScrollLeft === 0 &&
        !this.leftEdgeExtensionLatched
      ) {
        this.leftEdgeExtensionLatched = true;
        const addedPixels = this.onLeftEdge?.(drag) ?? 0;
        drag.startScrollLeft += addedPixels;
        drag.leftBufferScrollCompensation = addedPixels;
      }
      if (reachedBound) this.autoScrollVelocity = 0;
      this.preview();
      if (
        this.active &&
        (this.autoScrollDirection !== 0 ||
          Math.abs(this.autoScrollVelocity) > AUTO_SCROLL_STOP_EPSILON)
      ) {
        this.scheduleDragFrame();
      } else {
        this.autoScrollLastTimestamp = null;
      }
      return;
    }
    this.preview();
  }
  dragPreviewState() {
    const drag = this.active;
    if (!drag || drag.kind !== "task") return null;
    return {
      taskId: drag.taskId,
      mode: drag.mode,
      edgeDirection: this.autoScrollDirection,
    };
  }
  emitPreview(result) {
    this.onPreview(result, this.dragPreviewState());
    return result;
  }
  preview() {
    if (!this.active) return null;
    const drag = this.active;
    if (drag.kind === "group") {
      const blockIndex = groupBlockIndex(
        drag.committedRows,
        drag.rowOrder,
        drag.pendingRowY ?? drag.pendingClientY,
      );
      const result = reorderWorkstreamToIndex({
        order: drag.rowOrder,
        workstreamId: drag.groupId,
        targetBlockIndex: blockIndex,
      });
      if (result) {
        const payload = { rowOrder: result, kind: "reorder-group" };
        return this.emitPreview(payload);
      }
      return null;
    }

    // Horizontal date movement applies to every task gesture (move or resize).
    // During autoscroll the viewport scrolls under a stationary pointer, so the
    // timeline-space pointer delta includes the scroll movement.
    const pixelDelta =
      drag.pendingClientX -
      drag.startClientX +
      (this.root.scrollLeft +
        (drag.leftBufferScrollCompensation ?? 0) -
        drag.startScrollLeft);
    const update = calculateDraggedTaskDates({
      tasks: drag.tasks,
      taskId: drag.taskId,
      mode: drag.mode,
      pixelDelta,
      scale: drag.scale,
      snapIncrement: drag.snapIncrement,
      visibleWeekdays: drag.visibleWeekdays,
    });
    const scheduleResult = applyForwardOnlyScheduleChange(
      drag.tasks,
      drag.taskId,
      update,
      {
        mode: drag.mode,
        minimumDurationUnits: snapIncrementUnits(drag.snapIncrement),
      },
    );

    // A full move is free: the vertical component reorders the row (and may
    // reassign the workstream) while the horizontal component changes the date.
    if (drag.mode === "move") {
      const pointerY = drag.pendingRowY ?? drag.pendingClientY;
      const reorder = reorderTaskToPointer({
        order: drag.rowOrder,
        tasks: scheduleResult.tasks,
        rows: drag.committedRows,
        taskId: drag.taskId,
        pointerY,
        expanded: drag.expandedWorkstreams,
      });
      if (reorder) {
        const payload = {
          tasks: reorder.tasks,
          rowOrder: reorder.order,
          affectedTaskIds: scheduleResult.affectedTaskIds,
          insertionY: reorder.insertionY,
          targetGroup: reorder.targetGroup,
          kind: "reorder-move",
        };
        return this.emitPreview(payload);
      }
    }

    return this.emitPreview(scheduleResult);
  }
  up(event) {
    if (!this.active) return;
    const drag = this.active;
    drag.pendingClientX = event.clientX;
    drag.pendingClientY = event.clientY;
    const release = { edgeDirection: drag.lastEdgeDirection ?? 0 };
    this.stopAutoScroll();
    this.frame?.cancel();
    this.frame = null;
    if (drag.kind === "group") {
      const result = this.preview();
      this.active = null;
      if (result?.rowOrder)
        this.onCommit({ rowOrder: result.rowOrder, kind: "reorder-group" });
      return;
    }
    const result = this.preview();
    this.active = null;
    if (result) this.onCommit(result, release);
  }
  over(event) {
    if (this.active) return;
    const task = closestTask(event.target, this.root),
      related = closestTask(event.relatedTarget, this.root);
    if (task && task.dataset.taskId !== related?.dataset.taskId)
      this.onHover(task.dataset.taskId);
  }
  out(event) {
    if (this.active) return;
    const task = closestTask(event.target, this.root),
      related = closestTask(event.relatedTarget, this.root);
    if (task && task.dataset.taskId !== related?.dataset.taskId)
      this.onHover(null);
  }
  key(event) {
    if (event.key === "Escape" && this.active) {
      event.preventDefault();
      this.cancel("Interaction cancelled.");
      return;
    }
    if (!["Enter", " "].includes(event.key)) return;
    const task = closestTask(event.target, this.root);
    if (task) {
      event.preventDefault();
      this.onSelect(task.dataset.taskId);
    }
  }
  stopAutoScroll() {
    this.autoScrollVelocity = 0;
    this.autoScrollHeldMs = 0;
    this.autoScrollLastTimestamp = null;
    this.autoScrollDirection = 0;
    this.autoScrollPenetration = 0;
    this.leftEdgeExtensionLatched = false;
  }
  cancel(notice) {
    this.stopAutoScroll();
    this.frame?.cancel();
    this.frame = null;
    if (!this.active) return false;
    this.active = null;
    this.onPreview(null, null);
    if (notice) this.onNotice(notice);
    return true;
  }
}
