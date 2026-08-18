import {
  applyForwardOnlyScheduleChange,
  calculateDraggedTaskDates,
} from "./scheduling.js";
import { snapIncrementUnits } from "./timeline.js";
import {
  reorderTaskToPointer,
  reorderWorkstreamToIndex,
} from "./reorder.js";

const AUTO_SCROLL_GAIN = 0.5;
const AUTO_SCROLL_MAX = 60;
// Width of the autoscroll band measured INSIDE the viewport edge. The viewport
// often sits flush against the browser window edge (no room for the pointer to
// travel past it), so scrolling must start as soon as the pointer enters this
// band rather than only when it leaves the viewport.
const AUTO_SCROLL_BAND = 40;
// Exponential ease applied toward the target speed each frame. 1 = instant.
const AUTO_SCROLL_EASE = 0.28;

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
    this.onNotice = onNotice;
    this.active = null;
    this.frame = null;
    this.started = false;
    this.listeners = {
      pointerdown: (e) => this.down(e),
      pointerover: (e) => this.over(e),
      pointerout: (e) => this.out(e),
      keydown: (e) => this.key(e),
      pointermove: (e) => this.move(e),
      pointerup: (e) => this.up(e),
      pointercancel: () => this.cancel("Pointer interaction cancelled."),
      blur: () => this.cancel("Window focus was lost."),
    };
  }
  start() {
    if (this.started) return false;
    for (const type of ["pointerdown", "pointerover", "pointerout", "keydown"])
      this.root.addEventListener(type, this.listeners[type]);
    for (const type of ["pointermove", "pointerup", "pointercancel", "blur"])
      window.addEventListener(type, this.listeners[type]);
    this.started = true;
    return true;
  }
  stop() {
    if (!this.started) return false;
    this.cancel();
    for (const type of ["pointerdown", "pointerover", "pointerout", "keydown"])
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
      groupElement.setPointerCapture?.(event.pointerId);
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
    };
    taskElement.setPointerCapture?.(event.pointerId);
  }
  move(event) {
    if (!this.active) return;
    const drag = this.active;
    drag.pendingClientX = event.clientX;
    drag.pendingClientY = event.clientY;
    if (this.getPointerRowY) {
      drag.pendingRowY = this.getPointerRowY(event);
    }
    this.updateAutoScroll();
    if (this.frame) return;
    this.frame = this.scheduler.scheduleAnimationFrame(() => {
      this.frame = null;
      this.preview();
    });
  }
  // Continuous viewport autoscroll while dragging a task bar. The scroll speed
  // is a throttle: the target speed is proportional to how far the pointer is
  // past the viewport edge, and the actual speed eases toward it every frame
  // (gas-motor feel). When the pointer leaves the edge zone the speed eases
  // back down to zero before the loop stops. The date follows via scrollDelta
  // (timeline-space pointer), so the bar stays pinned at the viewport edge
  // while the content scrolls under it. Group headers and resize handles do not
  // autoscroll.
  updateAutoScroll() {
    const drag = this.active;
    if (!drag || drag.kind !== "task" || drag.mode !== "move") {
      this.autoScrollVelocity = 0;
      return;
    }
    const rect = this.root.getBoundingClientRect();
    const pointerX = drag.pendingClientX;
    let direction = 0;
    // The band sits INSIDE the viewport edge, so scrolling starts as soon as the
    // pointer reaches the edge even when the viewport is flush with the window.
    if (pointerX <= rect.left + AUTO_SCROLL_BAND) direction = -1;
    else if (pointerX >= rect.right - AUTO_SCROLL_BAND) direction = 1;
    if (direction === 0) {
      // Out of the band: ease to a stop rather than stopping abruptly.
      if (!this.autoScrollJob && (this.autoScrollVelocity ?? 0) !== 0) {
        this.autoScrollJob = this.scheduler.scheduleAnimationFrame(() => {
          this.autoScrollJob = null;
          this.tickAutoScroll(0);
        });
      }
      return;
    }
    if (!this.autoScrollJob) {
      this.autoScrollJob = this.scheduler.scheduleAnimationFrame(() => {
        this.autoScrollJob = null;
        this.tickAutoScroll(direction);
      });
    }
  }
  tickAutoScroll(direction) {
    const drag = this.active;
    if (!drag || drag.kind !== "task" || drag.mode !== "move") {
      this.autoScrollVelocity = 0;
      return;
    }
    const rect = this.root.getBoundingClientRect();
    const pointerX = drag.pendingClientX;
    // Distance from the inner edge of the band toward the viewport edge. At the
    // band's inner boundary it is 0; deeper into the band (closer to the edge)
    // it grows up to AUTO_SCROLL_BAND, so the deeper the pointer, the faster.
    const depth =
      direction < 0 ? rect.left + AUTO_SCROLL_BAND - pointerX : pointerX - (rect.right - AUTO_SCROLL_BAND);
    const target = direction === 0 ? 0 : Math.min(
      AUTO_SCROLL_MAX,
      Math.max(0, depth * AUTO_SCROLL_GAIN),
    );
    const velocity = this.autoScrollVelocity ?? 0;
    this.autoScrollVelocity = velocity + (target - velocity) * AUTO_SCROLL_EASE;
    if (Math.abs(this.autoScrollVelocity) < 0.5 && direction === 0) {
      this.autoScrollVelocity = 0;
      this.preview();
      return;
    }
    this.root.scrollLeft += direction * this.autoScrollVelocity;
    // The date is anchored in timeline space: the scroll movement is added to
    // the pixel delta so the bar stays pinned at the viewport edge.
    drag.scrollDelta = this.root.scrollLeft - drag.startScrollLeft;
    this.preview();
    this.updateAutoScroll();
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
        this.onPreview(payload);
        return payload;
      }
      return null;
    }

    // Horizontal date movement applies to every task gesture (move or resize).
    // During autoscroll the viewport scrolls under a stationary pointer, so the
    // timeline-space pointer delta includes the scroll movement.
    const pixelDelta =
      drag.pendingClientX -
      drag.startClientX +
      (drag.scrollDelta ?? (this.root.scrollLeft - drag.startScrollLeft));
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
        this.onPreview(payload);
        return payload;
      }
    }

    this.onPreview(scheduleResult);
    return scheduleResult;
  }
  stopAutoScroll() {
    if (this.autoScrollJob) {
      this.autoScrollJob.cancel();
      this.autoScrollJob = null;
    }
    this.autoScrollVelocity = 0;
  }
  up(event) {
    if (!this.active) return;
    const drag = this.active;
    drag.pendingClientX = event.clientX;
    drag.pendingClientY = event.clientY;
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
    if (result) this.onCommit(result);
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
  cancel(notice) {
    this.stopAutoScroll();
    this.frame?.cancel();
    this.frame = null;
    if (!this.active) return false;
    this.active = null;
    this.onPreview(null);
    if (notice) this.onNotice(notice);
    return true;
  }
}
