import { selectVisibleDependencies } from "./dependencies.js";
import { calculateForecast } from "./forecast.js";
import { MiniApplication } from "./framework/index.mjs";
import { GanttInteractionController } from "./interaction.js";
import { normalizeGridSettings } from "./grid.js";
import { normalizeTasks } from "./model.js";
import { renderTaskList, renderTimeline } from "./renderer.js";
import {
  ALL_WEEKDAYS,
  HEADER_HEIGHT,
  buildVisibleRows,
  computeTaskPositions,
  computeTimelineData,
  shiftByVisibleUnits,
  snapIncrementUnits,
  xToDate,
} from "./timeline.js";

const requireElement = (value, name) => {
  if (!(value instanceof Element))
    throw new TypeError(`${name} must be a DOM element.`);
  return value;
};
const criticalIds = (tasks) => {
  try {
    return new Set(calculateForecast(tasks).criticalTaskIds);
  } catch {
    return new Set(
      tasks.filter((task) => task.isCriticalPath).map((task) => task.id),
    );
  }
};

export function createGanttEngine(options) {
  const root = requireElement(options.root, "root"),
    taskList = requireElement(options.taskListElement, "taskListElement"),
    timeline = requireElement(options.timelineElement, "timelineElement");
  const status = options.statusElement,
    selectionStatus = options.selectionStatusElement,
    taskCount = options.taskCountElement,
    gateway = options.gateway ?? null,
    onScheduleCommit = options.onScheduleCommit ?? (() => {}),
    onSelectionChange = options.onSelectionChange ?? (() => {});
  const state = {
    tasks: normalizeTasks(options.tasks ?? []),
    previewResult: null,
    workstreams: options.workstreams ?? [],
    expandedWorkstreams: new Set(
      (options.workstreams ?? []).map((item) => item.id),
    ),
    selectedTaskId: null,
    hoveredTaskId: null,
    scale: options.settings?.scale ?? "week",
    theme: options.settings?.theme ?? "light",
    grid: normalizeGridSettings(options.settings?.grid),
    showAllDependencies: false,
    showCriticalPath: false,
    visibleWeekdays: options.settings?.visibleWeekdays ?? ALL_WEEKDAYS,
    snapIncrement: options.settings?.snapIncrement ?? "day",
    futureDays: 90,
    status: "Ready",
    markerScope: `gantt-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    criticalTaskIds: new Set(),
    connection: null,
    connectionLock: false,
  };
  state.criticalTaskIds = criticalIds(state.tasks);
  root.dataset.theme = state.theme;
  const application = new MiniApplication({
    root,
    onError: (error) => {
      setStatus(`Error: ${error.message}`);
      console.error(error);
    },
  });
  const contextMenu = root.querySelector("#context-menu");
  let contextMenuState = null,
    snapshot = null,
    rightLatched = false,
    shrinkJob = null,
    syncing = false,
    disposed = false;

  const shownTasks = () => state.previewResult?.tasks ?? state.tasks;
  function buildSnapshot() {
    const tasks = shownTasks(),
      rows = buildVisibleRows(
        tasks,
        state.workstreams,
        state.expandedWorkstreams,
      ),
      timelineData = computeTimelineData(tasks, {
        scale: state.scale,
        visibleWeekdays: state.visibleWeekdays,
        pastDays: 7,
        futureDays: state.futureDays,
      }),
      positions = computeTaskPositions(rows, {
        rangeStart: timelineData.minDate,
        scale: state.scale,
        visibleWeekdays: state.visibleWeekdays,
        includeHeader: false,
      }),
      visibleTaskIds = rows
        .filter((row) => row.type === "task")
        .map((row) => row.task.id),
      dependencies = selectVisibleDependencies({
        tasks,
        visibleTaskIds,
        selectedTaskId: state.selectedTaskId,
        hoveredTaskId: state.hoveredTaskId,
        showAllDependencies: state.showAllDependencies,
        showCriticalPath: state.showCriticalPath,
        criticalTaskIds: state.criticalTaskIds,
      });
    return {
      tasks,
      rows,
      timelineData,
      positions,
      dependencies,
      grid: state.grid,
      state: {
        ...state,
        previewTaskIds: state.previewResult
          ? new Set(state.previewResult.affectedTaskIds)
          : null,
      },
    };
  }
  function invalidate(reason) {
    snapshot = buildSnapshot();
    application.invalidateAllViews(reason);
  }
  function setStatus(message) {
    state.status = message;
    if (application.state === "running")
      application.invalidateView("status", "status changed");
  }
  function select(taskId) {
    state.selectedTaskId = taskId;
    onSelectionChange(taskId);
    invalidate("selection changed");
  }
  function hover(taskId) {
    if (state.hoveredTaskId === taskId) return;
    state.hoveredTaskId = taskId;
    invalidate("hover changed");
  }
  function replaceTasks(tasks, reason) {
    state.tasks = normalizeTasks(tasks);
    state.previewResult = null;
    state.criticalTaskIds = criticalIds(state.tasks);
    invalidate(reason);
  }
  function taskId(prefix = "task") {
    return `${prefix}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  }
  function createTask({
    name = "New task",
    startDate = state.tasks[0]?.startDate ?? new Date(),
    groupName = state.workstreams[0]?.id ?? "ungrouped",
  } = {}) {
    const start = xToDate(
      0,
      startDate,
      state.scale,
      state.visibleWeekdays,
      state.snapIncrement,
    );
    const end = shiftByVisibleUnits(
      start,
      snapIncrementUnits(state.snapIncrement),
      state.visibleWeekdays,
    );
    const task = {
      id: taskId("task"),
      name: name.trim() || "New task",
      groupName,
      workstreamId: groupName,
      status: "todo",
      progress: 0,
      startDate: start,
      endDate: end,
      dependencies: [],
      isMilestone: false,
      optimisticDays: 1,
      estimatedDays: 1,
      pessimisticDays: 2,
      resource: "Unassigned",
    };
    replaceTasks([...state.tasks, task], "task created");
    select(task.id);
    setStatus(`Created ${task.name}`);
    queueMicrotask(() =>
      taskList
        .querySelector(`[data-task-id="${task.id}"] .task-row__name`)
        ?.focus(),
    );
    return task;
  }
  function renameTask(taskId, name) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const nextName = name.trim() || task.name;
    replaceTasks(
      state.tasks.map((item) =>
        item.id === taskId
          ? { ...item, name: nextName, title: nextName }
          : item,
      ),
      "task renamed",
    );
    setStatus(`Renamed ${nextName}`);
  }
  function createWorkstream(label) {
    const normalizedLabel = String(label ?? "").trim();
    if (!normalizedLabel) return false;
    const idBase = normalizedLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workstream";
    let id = idBase;
    let suffix = 2;
    while (state.workstreams.some((item) => item.id === id)) id = `${idBase}-${suffix++}`;
    const colors = ["#287984", "#32765e", "#8a5a0a", "#ad4848", "#66548f"];
    state.workstreams = [
      ...state.workstreams,
      { id, label: normalizedLabel, color: colors[state.workstreams.length % colors.length], icon: "foundation" },
    ];
    state.expandedWorkstreams.add(id);
    invalidate("workstream created");
    setStatus(`Created workstream ${normalizedLabel}`);
    return id;
  }
  function renameWorkstream(id, label) {
    const normalizedLabel = String(label ?? "").trim();
    if (!normalizedLabel) return false;
    const workstream = state.workstreams.find((item) => item.id === id);
    if (!workstream) return false;
    state.workstreams = state.workstreams.map((item) =>
      item.id === id ? { ...item, label: normalizedLabel } : item,
    );
    invalidate("workstream renamed");
    setStatus(`Renamed workstream ${normalizedLabel}`);
    return true;
  }
  function deleteWorkstream(id) {
    const workstream = state.workstreams.find((item) => item.id === id);
    if (!workstream) return false;
    if (state.tasks.some((task) => (task.groupName ?? task.workstreamId) === id)) {
      setStatus("Reassign tasks before deleting this workstream.");
      return false;
    }
    state.workstreams = state.workstreams.filter((item) => item.id !== id);
    state.expandedWorkstreams.delete(id);
    invalidate("workstream deleted");
    setStatus(`Deleted workstream ${workstream.label}`);
    return true;
  }
  function addDependency(fromTaskId, toTaskId) {
    if (!fromTaskId || !toTaskId || fromTaskId === toTaskId) return false;
    const target = state.tasks.find((task) => task.id === toTaskId);
    if (!target || target.dependencies.includes(fromTaskId)) return false;
    try {
      const dependencies = [...target.dependencies, fromTaskId];
      const nextTasks = state.tasks.map((task) =>
        task.id === toTaskId
          ? { ...task, dependencies, predecessorIds: dependencies }
          : task,
      );
      replaceTasks(nextTasks, "dependency added");
      setStatus("Dependency added");
      return true;
    } catch (error) {
      setStatus(error.message);
      console.error("dependency add failed", error);
      return false;
    }
  }
  function removeDependency(fromTaskId, toTaskId) {
    const target = state.tasks.find((task) => task.id === toTaskId);
    if (!target) return;
    replaceTasks(
      state.tasks.map((task) =>
        task.id === toTaskId
          ? {
              ...task,
              dependencies: task.dependencies.filter((id) => id !== fromTaskId),
            }
          : task,
      ),
      "dependency removed",
    );
    setStatus("Dependency removed");
  }
  function hideContextMenu() {
    if (!contextMenu) return;
    contextMenu.hidden = true;
    contextMenuState = null;
  }
  function showContextMenu(event, menuState) {
    if (!contextMenu) return;
    contextMenuState = menuState;
    for (const button of contextMenu.querySelectorAll("[data-context-action]"))
      button.hidden =
        button.dataset.contextAction !== menuState.kind &&
        button.dataset.contextAction !== "cancel";
    const maxX = Math.max(8, window.innerWidth - contextMenu.offsetWidth - 8),
      maxY = Math.max(8, window.innerHeight - contextMenu.offsetHeight - 8);
    contextMenu.style.left = `${Math.min(event.clientX, maxX)}px`;
    contextMenu.style.top = `${Math.min(event.clientY, maxY)}px`;
    contextMenu.hidden = false;
    contextMenu.querySelector("button:not([hidden])")?.focus();
  }
  function timelinePoint(event) {
    const rect = timeline.getBoundingClientRect();
    const x = event.clientX - rect.left + timeline.scrollLeft;
    const y = event.clientY - rect.top + timeline.scrollTop;
    const rowY = y - HEADER_HEIGHT;
    const row = snapshot?.rows.find(
      (item) => rowY >= item.y && rowY < item.y + item.height,
    );
    return {
      x,
      y,
      date: xToDate(
        x,
        snapshot.timelineData.minDate,
        state.scale,
        state.visibleWeekdays,
        state.snapIncrement,
      ),
      groupName: row?.group ?? state.workstreams[0]?.id ?? "ungrouped",
    };
  }
  function taskElementFromEvent(event) {
    const element =
      event.target instanceof Element
        ? event.target.closest("[data-task-id]")
        : null;
    return element && timeline.contains(element) ? element : null;
  }
  function taskIdAtPoint(point) {
    const position = snapshot?.positions.find(
      (item) =>
        point.x >= item.x &&
        point.x <= item.x + item.width &&
        point.y >= item.y &&
        point.y <= item.y + item.height,
    );
    return position?.taskId ?? null;
  }
  function openContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    const taskElement = taskElementFromEvent(event);
    const dependencyElement =
      event.target instanceof Element
        ? event.target.closest("[data-from-task-id][data-to-task-id]")
        : null;
    if (dependencyElement) {
      showContextMenu(event, {
        kind: "remove",
        fromTaskId: dependencyElement.dataset.fromTaskId,
        toTaskId: dependencyElement.dataset.toTaskId,
      });
      return;
    }
    if (taskElement) {
      showContextMenu(event, {
        kind: "connect",
        taskId: taskElement.dataset.taskId,
      });
      return;
    }
    showContextMenu(event, { kind: "add-bar", ...timelinePoint(event) });
  }
  function beginConnection() {
    if (!contextMenuState?.taskId) return;
    state.connection = {
      fromTaskId: contextMenuState.taskId,
      pointerX: 0,
      pointerY: 0,
      targetTaskId: null,
    };
    hideContextMenu();
    setStatus("Move over a task, then click to connect.");
    invalidate("dependency connection started");
  }
  function updateConnectionPointer(event) {
    if (!state.connection) return;
    const point = timelinePoint(event);
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const target = taskElementFromEvent({ target: hit });
    state.connection = {
      ...state.connection,
      pointerX: point.x,
      pointerY: point.y,
      targetTaskId: target?.dataset.taskId ?? taskIdAtPoint(point),
    };
    invalidate("dependency connection preview");
  }
  function commitConnection(event) {
    if (!state.connection || event.button !== 0) return;
    const point = timelinePoint(event);
    const target = taskElementFromEvent(event);
    const targetId =
      target?.dataset.taskId ??
      state.connection.targetTaskId ??
      taskIdAtPoint(point);
    if (!targetId || targetId === state.connection.fromTaskId) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    interaction.cancel();
    const from = state.connection.fromTaskId;
    const to = targetId;
    state.connectionLock = true;
    state.connection = null;
    if (addDependency(from, to))
      void persist({
        tasks: state.tasks,
        effects: [
          { cause: "dependency-added", fromTaskId: from, toTaskId: to },
        ],
      });
    else invalidate("dependency connection cancelled");
    queueMicrotask(() => {
      state.connectionLock = false;
    });
  }
  function addBarAtContext() {
    if (!contextMenuState) return;
    const point = contextMenuState;
    hideContextMenu();
    const created = createTask({
      startDate: point.date,
      groupName: point.groupName,
    });
    void persist({
      tasks: state.tasks,
      effects: [{ cause: "created", taskId: created.id }],
    });
  }
  async function persist(result) {
    onScheduleCommit(result.tasks, result.effects);
    if (!gateway) return;
    setStatus("Saving schedule…");
    const job = application.scheduleAsync((signal) =>
      gateway.execute(
        "schedule.commit",
        { tasks: result.tasks, effects: result.effects },
        { signal, idempotencyKey: `schedule-${Date.now()}` },
      ),
    );
    const response = await job.promise;
    setStatus(
      response.ok ? "Schedule saved" : `Save failed: ${response.error.message}`,
    );
  }
  async function reloadSchedule() {
    if (!gateway) {
      setStatus("No schedule gateway configured");
      return;
    }
    setStatus("Loading schedule…");
    const job = application.scheduleAsync((signal) =>
      gateway.execute("schedule.load", {}, { signal }),
    );
    const response = await job.promise;
    if (!response.ok) {
      setStatus(`Load failed: ${response.error.message}`);
      return;
    }
    replaceTasks(response.data.tasks, "schedule loaded");
    setStatus("Schedule loaded");
  }

  application.registerView("task-list", taskList, () =>
    renderTaskList(taskList, state, snapshot.rows),
  );
  application.registerView("timeline", timeline, () =>
    renderTimeline(timeline, snapshot),
  );
  application.registerView("status", status ?? root, () => {
    if (status) status.textContent = state.status;
    if (taskCount) taskCount.textContent = `${state.tasks.length} total`;
    if (selectionStatus) {
      const task = state.tasks.find((item) => item.id === state.selectedTaskId);
      selectionStatus.textContent = task
        ? `Selected: ${task.name}`
        : "No task selected";
    }
  });
  application.registerCommand("timeline.set-scale", ({ source }) => {
    if (source.checked) {
      state.scale = source.value;
      invalidate("scale changed");
    }
  });
  application.registerCommand("theme.set", ({ source }) => {
    if (source.checked) {
      state.theme = source.value;
      root.dataset.theme = state.theme;
      invalidate("theme changed");
    }
  });
  application.registerCommand("theme.toggle", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    root.dataset.theme = state.theme;
    invalidate("theme toggled");
  });
  application.registerCommand("timeline.scroll-left", () =>
    timeline.scrollBy({ left: -200, behavior: "smooth" }),
  );
  application.registerCommand("timeline.scroll-right", () =>
    timeline.scrollBy({ left: 200, behavior: "smooth" }),
  );
  application.registerCommand("dependencies.toggle-all", ({ source }) => {
    state.showAllDependencies = source.checked;
    invalidate("all dependencies toggled");
  });
  application.registerCommand("dependencies.toggle-critical", ({ source }) => {
    state.showCriticalPath = source.checked;
    invalidate("critical path toggled");
  });
  application.registerCommand("schedule.reload", reloadSchedule);
  application.registerCommand("workstream.toggle", ({ source }) => {
    const id = source.dataset.workstreamId;
    if (state.expandedWorkstreams.has(id)) state.expandedWorkstreams.delete(id);
    else state.expandedWorkstreams.add(id);
    invalidate("workstream toggled");
  });
  application.registerCommand("workstream.create", () => {
    const label = window.prompt("New workstream name");
    if (label !== null) createWorkstream(label);
  });
  application.registerCommand("workstream.manage", ({ source, event }) => {
    showContextMenu(event, {
      kind: "workstream",
      workstreamId: source.dataset.workstreamId ?? source.dataset.groupId,
    });
  });
  application.registerCommand("workstream.rename", () => {
    if (!contextMenuState?.workstreamId) return;
    const workstream = state.workstreams.find((item) => item.id === contextMenuState.workstreamId);
    if (!workstream) return;
    const label = window.prompt("Rename workstream", workstream.label);
    hideContextMenu();
    if (label !== null) renameWorkstream(workstream.id, label);
  });
  application.registerCommand("workstream.delete", () => {
    if (!contextMenuState?.workstreamId) return;
    const workstream = state.workstreams.find((item) => item.id === contextMenuState.workstreamId);
    hideContextMenu();
    if (!workstream) return;
    if (state.tasks.some((task) => (task.groupName ?? task.workstreamId) === workstream.id)) {
      setStatus("Reassign tasks before deleting this workstream.");
      return;
    }
    if (window.confirm(`Delete ${workstream.label}?`)) deleteWorkstream(workstream.id);
  });
  application.registerCommand("task.select", ({ source }) =>
    select(source.dataset.taskId),
  );
  application.registerCommand("task.create", ({ source }) => {
    if (source.value.trim()) {
      const created = createTask({
        name: source.value,
        groupName: state.workstreams[0]?.id ?? "ungrouped",
      });
      source.value = "";
      void persist({
        tasks: state.tasks,
        effects: [{ cause: "created", taskId: created.id }],
      });
    }
  });
  application.registerCommand("task.create-workstream", ({ source }) => {
    const groupName = source.dataset.workstreamId ?? source.dataset.groupId;
    const workstream = state.workstreams.find((item) => item.id === groupName);
    const created = createTask({
      name: "New task",
      groupName: groupName ?? state.workstreams[0]?.id ?? "ungrouped",
    });
    setStatus(`Created task in ${workstream?.label ?? "workstream"}`);
    void persist({
      tasks: state.tasks,
      effects: [{ cause: "created", taskId: created.id, groupName }],
    });
  });
  application.registerCommand("task.rename", ({ source }) => {
    renameTask(source.dataset.editTaskId, source.value);
    void persist({
      tasks: state.tasks,
      effects: [{ cause: "renamed", taskId: source.dataset.editTaskId }],
    });
  });
  application.registerCommand("timeline.add-bar", addBarAtContext);
  application.registerCommand("dependency.begin-connect", beginConnection);
  application.registerCommand("dependency.remove", () => {
    if (contextMenuState) {
      removeDependency(contextMenuState.fromTaskId, contextMenuState.toTaskId);
      hideContextMenu();
    }
  });
  application.registerCommand("context.cancel", hideContextMenu);

  const interaction = new GanttInteractionController({
    root: timeline,
    scheduler: application.scheduler,
    getState: () => state,
    onSelect: select,
    onHover: hover,
    onPreview: (result) => {
      state.previewResult = result;
      invalidate(result ? "schedule preview" : "schedule preview cancelled");
    },
    onCommit: (result) => {
      state.tasks = result.tasks;
      state.previewResult = null;
      state.criticalTaskIds = criticalIds(state.tasks);
      invalidate("schedule committed");
      void persist(result);
    },
    onNotice: setStatus,
  });
  const taskClick = (event) => {
    const row =
      event.target instanceof Element
        ? event.target.closest("[data-task-id]")
        : null;
    if (row && taskList.contains(row)) select(row.dataset.taskId);
  };
  const taskOver = (event) => {
    const row =
      event.target instanceof Element
        ? event.target.closest("[data-task-id]")
        : null;
    if (row && taskList.contains(row)) hover(row.dataset.taskId);
  };
  const taskOut = (event) => {
    const row =
        event.target instanceof Element
          ? event.target.closest("[data-task-id]")
          : null,
      related =
        event.relatedTarget instanceof Element
          ? event.relatedTarget.closest("[data-task-id]")
          : null;
    if (row && row.dataset.taskId !== related?.dataset.taskId) hover(null);
  };
  function sync(source, target) {
    if (syncing) return;
    syncing = true;
    if (Math.abs(target.scrollTop - source.scrollTop) > 0.5)
      target.scrollTop = source.scrollTop;
    queueMicrotask(() => {
      syncing = false;
    });
  }
  const taskScroll = () => sync(taskList, timeline);
  function timelineScroll() {
    sync(timeline, taskList);
    const remaining =
      timeline.scrollWidth - timeline.clientWidth - timeline.scrollLeft;
    if (remaining < 400 && !rightLatched) {
      rightLatched = true;
      state.futureDays += 180;
      invalidate("timeline extended");
    } else if (remaining > 800) rightLatched = false;
    if (timeline.scrollLeft < 400 && state.futureDays > 90) {
      shrinkJob?.cancel();
      shrinkJob = application.scheduler.scheduleDelay(() => {
        if (timeline.scrollLeft < 400) {
          state.futureDays = 90;
          rightLatched = false;
          invalidate("timeline compacted");
        }
      }, 260);
    }
  }
  const rootContextMenu = (event) => {
    if (event.target instanceof Node && !contextMenu?.contains(event.target))
      hideContextMenu();
  };
  const keydown = (event) => {
    if (event.key === "Escape") {
      if (state.connection) {
        state.connection = null;
        invalidate("dependency connection cancelled");
        setStatus("Connection cancelled.");
      } else hideContextMenu();
      return;
    }
    if (event.key !== "Enter") return;
    const source =
      event.target instanceof Element
        ? event.target.closest("[data-action]")
        : null;
    if (!source) return;
    event.preventDefault();
    if (source.dataset.action === "task.create" && source.value?.trim()) {
      const created = createTask({
        name: source.value,
        groupName: state.workstreams[0]?.id ?? "ungrouped",
      });
      source.value = "";
      void persist({
        tasks: state.tasks,
        effects: [{ cause: "created", taskId: created.id }],
      });
    }
    if (source.dataset.action === "task.rename") {
      renameTask(source.dataset.editTaskId, source.value);
      void persist({
        tasks: state.tasks,
        effects: [{ cause: "renamed", taskId: source.dataset.editTaskId }],
      });
    }
  };
  const contextMenuHandler = (event) => openContextMenu(event);
  const connectionMove = (event) => updateConnectionPointer(event);
  const connectionDown = (event) => commitConnection(event);
  const connectionClick = (event) => {
    if (state.connection) commitConnection(event);
  };
  function start() {
    if (disposed) throw new Error("The Gantt engine has been disposed.");
    snapshot = buildSnapshot();
    application.start();
    interaction.start();
    root.addEventListener("contextmenu", contextMenuHandler);
    root.addEventListener("pointerdown", rootContextMenu);
    root.addEventListener("keydown", keydown);
    document.addEventListener("pointermove", connectionMove, true);
    document.addEventListener("mousemove", connectionMove, true);
    window.addEventListener("pointerdown", connectionDown, true);
    window.addEventListener("click", connectionClick, true);
    taskList.addEventListener("click", taskClick);
    taskList.addEventListener("pointerover", taskOver);
    taskList.addEventListener("pointerout", taskOut);
    taskList.addEventListener("scroll", taskScroll);
    timeline.addEventListener("scroll", timelineScroll);
    return api;
  }
  function dispose() {
    if (disposed) return false;
    interaction.stop();
    root.removeEventListener("contextmenu", contextMenuHandler);
    root.removeEventListener("pointerdown", rootContextMenu);
    root.removeEventListener("keydown", keydown);
    document.removeEventListener("pointermove", connectionMove, true);
    document.removeEventListener("mousemove", connectionMove, true);
    window.removeEventListener("pointerdown", connectionDown, true);
    window.removeEventListener("click", connectionClick, true);
    taskList.removeEventListener("click", taskClick);
    taskList.removeEventListener("pointerover", taskOver);
    taskList.removeEventListener("pointerout", taskOut);
    taskList.removeEventListener("scroll", taskScroll);
    timeline.removeEventListener("scroll", timelineScroll);
    shrinkJob?.cancel();
    application.dispose();
    disposed = true;
    return true;
  }
  const api = {
    start,
    dispose,
    reloadSchedule,
    getState: () => state,
    getSnapshot: () => snapshot,
    setTasks: (tasks) => replaceTasks(tasks, "tasks replaced"),
  };
  return api;
}
