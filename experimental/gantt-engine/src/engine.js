import {
  normalizeDependencyAppearance,
  selectVisibleDependencies,
} from "./dependencies.js";
import { calculateForecast } from "./forecast.js";
import { MiniApplication } from "./framework/index.mjs";
import { GanttInteractionController } from "./interaction.js";
import { normalizeGridSettings } from "./grid.js";
import { normalizeTasks } from "./model.js";
import {
  renderProjectBrand,
  renderTaskList,
  renderTimeline,
  updateConnectionPreview,
} from "./renderer.js";
import {
  ALL_WEEKDAYS,
  HEADER_HEIGHT,
  TIMELINE_EDGE_BUFFER_CELLS,
  addCalendarDays,
  buildVisibleRows,
  computeTaskPositions,
  defaultRowOrder,
  reconcileRowOrder,
  computeTimelineData,
  getTimelineScale,
  shiftByVisibleUnits,
  visibleUnitsBetween,
  snapIncrementUnits,
  startOfCalendarDay,
  xToDate,
  dateToX,
} from "./timeline.js";

const LOGO_CROP_SIZE = 144;
const LOGO_HEADER_SIZE = 32;
const LOGO_MIN_SCALE = 0.5;
const LOGO_MAX_SCALE = 3;
const TIMELINE_PAST_DAYS = 7;
const TIMELINE_VIEWPORT_GAP_PX = 20;

const logoGeometry = (image) => ({
  width: image.naturalWidth || 0,
  height: image.naturalHeight || 0,
});

const logoScaleToCover = (image) => {
  const { width, height } = logoGeometry(image);
  return width && height
    ? Math.max(LOGO_CROP_SIZE / width, LOGO_CROP_SIZE / height)
    : 1;
};

const cloneLogo = (logo) =>
  logo
    ? {
        dataUrl: logo.dataUrl,
        scale: logo.scale,
        x: logo.x,
        y: logo.y,
        naturalWidth: logo.naturalWidth,
        naturalHeight: logo.naturalHeight,
      }
    : null;

const originFromTasks = (tasks, fallback) =>
  tasks.length
    ? addCalendarDays(
        startOfCalendarDay(
          tasks.reduce(
            (min, task) =>
              task.startDate.getTime() < min.getTime() ? task.startDate : min,
            tasks[0].startDate,
          ),
        ),
        -TIMELINE_PAST_DAYS,
      )
    : fallback;

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
    timeline = requireElement(options.timelineElement, "timelineElement"),
    verticalScroll = requireElement(
      options.verticalScrollElement ??
        root.querySelector(".gantt-scroll-region"),
      "verticalScrollElement",
    ),
    timelineHeader = requireElement(
      options.timelineHeaderElement ??
        root.querySelector(".timeline-header-slot"),
      "timelineHeaderElement",
    );
  const status = options.statusElement,
    selectionStatus = options.selectionStatusElement,
    taskCount = options.taskCountElement,
    gateway = options.gateway ?? null,
    onScheduleCommit = options.onScheduleCommit ?? (() => {}),
    onSelectionChange = options.onSelectionChange ?? (() => {});
  const initialTasks = normalizeTasks(options.tasks ?? []);
  const initialOrigin = originFromTasks(initialTasks, startOfCalendarDay(new Date()));
  const initialLatest = initialTasks.reduce(
    (max, task) =>
      task.endDate.getTime() > max.getTime() ? task.endDate : max,
    initialTasks[0]?.endDate ?? initialOrigin,
  );
  const state = {
    tasks: initialTasks,
    rowOrder: defaultRowOrder(initialTasks, options.workstreams ?? []),
    rowOrderDirty: false,
    minDate: initialOrigin,
    previewResult: null,
    previewDrag: null,
    leftBufferExpanded: false,
    workstreams: options.workstreams ?? [],
    expandedWorkstreams: new Set(
      (options.workstreams ?? []).map((item) => item.id),
    ),
    selectedTaskId: null,
    hoveredTaskId: null,
    scale: options.settings?.scale ?? "week",
    theme: options.settings?.theme ?? "light",
    grid: normalizeGridSettings(options.settings?.grid),
    dependencyAppearance: normalizeDependencyAppearance(
      options.settings?.dependencyAppearance,
    ),
    showAllDependencies: false,
    showCriticalPath: false,
    visibleWeekdays: options.settings?.visibleWeekdays ?? ALL_WEEKDAYS,
    snapIncrement: options.settings?.snapIncrement ?? "half-day",
    futureDays: 90,
    timelineMaxDate: addCalendarDays(initialLatest, 90),
    projectName:
      options.projectName ??
      (root.querySelector(".project-top-nav__name")?.textContent?.trim() ||
        "Untitled project"),
    projectNameEditing: false,
    logo: options.logo ?? null,
    logoDraft: null,
    logoOpen: false,
    gridSettingsOpen: false,
    status: "Ready",
    markerScope: `gantt-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    criticalTaskIds: new Set(),
    connection: null,
    connectionLock: false,
    guide: null,
  };
  state.criticalTaskIds = criticalIds(state.tasks);
  root.dataset.theme = state.theme;
  function updateThemeControl() {
    const button = root.querySelector(".project-top-nav__theme");
    if (!button) return;
    const isDark = state.theme === "dark";
    button.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );
    button.innerHTML = isDark
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z" /></svg>';
  }
  updateThemeControl();
  const application = new MiniApplication({
    root,
    onError: (error) => {
      setStatus(`Error: ${error.message}`);
      console.error(error);
    },
  });
  const contextMenu = root.querySelector("#context-menu");
  const logoDialog = root.querySelector("#project-logo-dialog");
  const logoDialogPanel = root.querySelector("#project-logo-dialog-panel");
  const logoCropSurface = root.querySelector("#project-logo-crop");
  const logoCropImage = root.querySelector("#project-logo-preview");
  const logoCropEmpty = root.querySelector("#project-logo-empty");
  const gridSettingsDialog = root.querySelector("#grid-settings-dialog");
  const gridSettingsDialogPanel = root.querySelector("#grid-settings-dialog-panel");
  let contextMenuState = null,
    snapshot = null,
    rightLatched = false,
    lastScrollLeft = 0,
    shrinkJob = null,
    connectionPreviewFrame = null,
    disposed = false;
  function cancelConnectionPreviewFrame() {
    connectionPreviewFrame?.cancel();
    connectionPreviewFrame = null;
  }
  function scheduleConnectionPreview() {
    if (connectionPreviewFrame) return;
    connectionPreviewFrame = application.scheduler.scheduleAnimationFrame(() => {
      connectionPreviewFrame = null;
      if (!state.connection || !snapshot) return;
      updateConnectionPreview(
        timeline,
        state.connection,
        snapshot.positions,
      );
    });
  }

  const shownTasks = () => state.previewResult?.tasks ?? state.tasks;
  function leftDragBufferUnits() {
    const { dayWidth } = getTimelineScale(state.scale);
    return Math.max(1, Math.ceil(timeline.clientWidth / dayWidth));
  }
  function prependLeftDragBuffer() {
    const { dayWidth } = getTimelineScale(state.scale);
    const previousMinDate = state.minDate;
    const nextMinDate = shiftByVisibleUnits(
      previousMinDate,
      -leftDragBufferUnits(),
      state.visibleWeekdays,
    );
    const addedUnits = visibleUnitsBetween(
      nextMinDate,
      previousMinDate,
      state.visibleWeekdays,
    );
    if (addedUnits <= 0) return 0;
    state.minDate = nextMinDate;
    state.leftBufferExpanded = true;
    const addedPixels = addedUnits * dayWidth;
    const targetScrollLeft = timeline.scrollLeft + addedPixels;
    invalidate("left drag buffer prepared");
    queueMicrotask(() => {
      if (!disposed) {
        timeline.scrollLeft = targetScrollLeft;
        invalidate("left drag buffer applied");
      }
    });
    return addedPixels;
  }
  function compactTimelineToTasks(edgeDirection = 0) {
    if (state.tasks.length === 0) return false;
    if (!state.leftBufferExpanded && state.futureDays <= 90) return false;
    const { dayWidth } = getTimelineScale(state.scale);
    const earliestTaskDate = state.tasks.reduce(
      (min, task) =>
        task.startDate.getTime() < min.getTime() ? task.startDate : min,
      state.tasks[0].startDate,
    );
    const latestTaskDate = state.tasks.reduce(
      (max, task) =>
        task.endDate.getTime() > max.getTime() ? task.endDate : max,
      state.tasks[0].endDate,
    );
    const occupiedUnits = visibleUnitsBetween(
      startOfCalendarDay(earliestTaskDate),
      startOfCalendarDay(latestTaskDate),
      state.visibleWeekdays,
    );
    const minimumUnits = Math.max(
      1,
      Math.ceil((timeline.clientWidth + TIMELINE_VIEWPORT_GAP_PX) / dayWidth),
    );
    const emptyUnits = Math.max(0, minimumUnits - occupiedUnits);
    state.minDate = startOfCalendarDay(earliestTaskDate);
    if (edgeDirection > 0 && emptyUnits > 0) {
      state.minDate = shiftByVisibleUnits(
        state.minDate,
        -emptyUnits,
        state.visibleWeekdays,
      );
    }
    const nextFutureDays =
      edgeDirection > 0 ? 0 : emptyUnits > 0 ? Math.ceil(emptyUnits) : 0;
    state.futureDays = nextFutureDays;
    state.timelineMaxDate = addCalendarDays(
      startOfCalendarDay(latestTaskDate),
      nextFutureDays,
    );
    state.leftBufferExpanded = false;
    return true;
  }
  const shownOrder = () => state.previewResult?.rowOrder ?? state.rowOrder;
  function buildSnapshot() {
    const tasks = shownTasks(),
      rows = buildVisibleRows(
        tasks,
        state.workstreams,
        state.expandedWorkstreams,
        "",
        shownOrder(),
      );
    if (tasks.length > 0) {
      const earliest = tasks.reduce(
        (min, task) =>
          task.startDate.getTime() < min.getTime() ? task.startDate : min,
        tasks[0].startDate,
      );
      const earliestDay = startOfCalendarDay(earliest);
      // Preview dates use the existing rendered range. Left drag buffering is
      // performed in viewport-sized batches at drag start and at the bound,
      // rather than re-anchoring the origin once per snapped preview date.
      if (
        !state.previewResult &&
        earliestDay.getTime() < state.minDate.getTime()
      ) {
        state.minDate = earliestDay;
      }
    }
    const timelineData = computeTimelineData(tasks, {
        scale: state.scale,
        visibleWeekdays: state.visibleWeekdays,
        pastDays: TIMELINE_PAST_DAYS,
        maxDate: state.timelineMaxDate,
        minDate: state.minDate,
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
  function renderLogoDialogPreview() {
    if (!logoCropImage || !logoCropEmpty) return;
    const draft = state.logoDraft;
    if (draft?.dataUrl) {
      logoCropImage.src = draft.dataUrl;
      logoCropImage.hidden = false;
      logoCropEmpty.hidden = true;
      if (draft.naturalWidth && draft.naturalHeight) {
        logoCropImage.style.width = `${draft.naturalWidth * draft.scale}px`;
        logoCropImage.style.height = `${draft.naturalHeight * draft.scale}px`;
      } else {
        logoCropImage.style.removeProperty("width");
        logoCropImage.style.removeProperty("height");
      }
      logoCropImage.style.transform = `translate(calc(-50% + ${draft.x}px), calc(-50% + ${draft.y}px))`;
    } else {
      logoCropImage.hidden = true;
      logoCropEmpty.hidden = false;
    }
  }
  function prepareLogoDraft(logo) {
    const draft = cloneLogo(logo) ?? {
      dataUrl: null,
      scale: 1,
      x: 0,
      y: 0,
      naturalWidth: 0,
      naturalHeight: 0,
    };
    if (!draft.dataUrl) return draft;
    const image = new Image();
    image.onload = () => {
      draft.naturalWidth ||= image.naturalWidth;
      draft.naturalHeight ||= image.naturalHeight;
      if (!logo) draft.scale = logoScaleToCover(image);
      renderLogoDialogPreview();
    };
    image.src = draft.dataUrl;
    return draft;
  }
  function openLogoDialog() {
    if (!logoDialog || !logoDialogPanel) return;
    state.logoDraft = prepareLogoDraft(state.logo);
    renderLogoDialogPreview();
    logoDialog.hidden = false;
    state.logoOpen = true;
    logoDialogPanel.focus();
  }
  function closeLogoDialog() {
    if (!logoDialog) return;
    logoDialog.hidden = true;
    state.logoOpen = false;
  }
  function saveLogo() {
    state.logo = state.logoDraft?.dataUrl ? cloneLogo(state.logoDraft) : null;
    closeLogoDialog();
    invalidate("project logo updated");
    setStatus("Project logo updated");
    queueMicrotask(() => root.querySelector(".project-top-nav__logo")?.focus());
  }
  function cancelLogo() {
    closeLogoDialog();
    queueMicrotask(() => root.querySelector(".project-top-nav__logo")?.focus());
  }
  function syncGridSettingsDependencies() {
    if (!gridSettingsDialogPanel) return;
    const verticalLines = gridSettingsDialogPanel.querySelector(
      'input[data-setting="showVerticalLines"]',
    );
    const majorLines = gridSettingsDialogPanel.querySelector(
      'input[data-setting="showMajorLines"]',
    );
    if (!verticalLines || !majorLines) return;
    majorLines.disabled = !verticalLines.checked;
    majorLines
      .closest(".grid-settings-dialog__dependent")
      ?.classList.toggle("is-disabled", majorLines.disabled);
  }
  function syncDependencyAppearanceLabels() {
    if (!gridSettingsDialogPanel) return;
    gridSettingsDialogPanel
      .querySelectorAll("input[data-dependency-setting]")
      .forEach((input) => {
        const output = gridSettingsDialogPanel.querySelector(
          `[data-dependency-setting-value="${input.dataset.dependencySetting}"]`,
        );
        if (output) output.textContent = `${input.value} px`;
      });
  }
  function openGridSettingsDialog() {
    if (!gridSettingsDialog || !gridSettingsDialogPanel) return;
    const settings = state.grid;
    gridSettingsDialogPanel.querySelectorAll("[data-setting]").forEach((el) => {
      const key = el.dataset.setting;
      if (el.type === "checkbox") el.checked = !!settings[key];
      else if (el.type === "color") el.value = settings[key] ?? "";
    });
    gridSettingsDialogPanel
      .querySelectorAll("input[data-dependency-setting]")
      .forEach((input) => {
        input.value =
          state.dependencyAppearance[input.dataset.dependencySetting] ??
          input.value;
      });
    syncDependencyAppearanceLabels();
    syncGridSettingsDependencies();
    gridSettingsDialog.hidden = false;
    state.gridSettingsOpen = true;
    gridSettingsDialogPanel.focus();
  }
  function closeGridSettingsDialog() {
    if (!gridSettingsDialog) return;
    gridSettingsDialog.hidden = true;
    state.gridSettingsOpen = false;
  }
  function saveGridSettings() {
    const settings = {};
    gridSettingsDialogPanel.querySelectorAll("[data-setting]").forEach((el) => {
      const key = el.dataset.setting;
      if (el.type === "checkbox") settings[key] = el.checked;
      else if (el.type === "color") settings[key] = el.value;
    });
    state.grid = normalizeGridSettings(settings);
    const dependencyAppearance = {};
    gridSettingsDialogPanel
      .querySelectorAll("input[data-dependency-setting]")
      .forEach((input) => {
        dependencyAppearance[input.dataset.dependencySetting] = Number(
          input.value,
        );
      });
    state.dependencyAppearance = normalizeDependencyAppearance(
      dependencyAppearance,
    );
    closeGridSettingsDialog();
    invalidate("timeline settings updated");
    setStatus("Timeline settings updated");
  }
  function cancelGridSettings() {
    closeGridSettingsDialog();
  }
  const gridSettingsDialogChange = (event) => {
    if (event.target?.matches('input[data-setting="showVerticalLines"]')) {
      syncGridSettingsDependencies();
    }
  };
  const gridSettingsDialogInput = (event) => {
    if (event.target?.matches("input[data-dependency-setting]")) {
      syncDependencyAppearanceLabels();
    }
  };
  const gridSettingsDialogKeydown = (event) => {
    if (event.key !== "Tab" || !gridSettingsDialogPanel) return;
    const items = Array.from(
      gridSettingsDialogPanel.querySelectorAll(
        "button, input, select, textarea, [tabindex], pmis-button, pmis-textfield",
      ),
    ).filter(
      (element) =>
        !element.disabled &&
        !element.hasAttribute("disabled") &&
        !element.hidden &&
        element.getAttribute("tabindex") !== "-1",
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
  function beginProjectNameEdit() {
    if (state.logoOpen) return;
    state.projectNameEditing = true;
    invalidate("project name edit started");
  }
  function commitProjectName(value) {
    if (!state.projectNameEditing) return;
    const nextName = String(value ?? "").trim();
    state.projectNameEditing = false;
    if (nextName) {
      state.projectName = nextName;
      invalidate("project name renamed");
      setStatus(`Renamed project to ${nextName}`);
    } else {
      invalidate("project name edit finished");
    }
    queueMicrotask(() => root.querySelector(".project-top-nav__name")?.focus());
  }
  function cancelProjectName() {
    if (!state.projectNameEditing) return;
    state.projectNameEditing = false;
    invalidate("project name edit cancelled");
    queueMicrotask(() => root.querySelector(".project-top-nav__name")?.focus());
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
    state.rowOrder = reconcileRowOrder(
      state.rowOrder,
      state.tasks,
      state.workstreams,
    );
    invalidate(reason);
  }
  function taskId(prefix = "task") {
    return `${prefix}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  }
  function createTask({
    name = "New task",
    color = "#287984",
    startDate = state.tasks[0]?.startDate ?? new Date(),
    groupName = null,
    focusSidebarName = true,
  } = {}) {
    const start = xToDate(
      0,
      startDate,
      state.scale,
      state.visibleWeekdays,
      state.snapIncrement,
    );
    const end = shiftByVisibleUnits(start, 1, state.visibleWeekdays);
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
      color,
    };
    replaceTasks([...state.tasks, task], "task created");
    select(task.id);
    setStatus(`Created ${task.name}`);
    if (focusSidebarName)
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
  function deleteTask(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return false;
    const nextTasks = state.tasks
      .filter((item) => item.id !== taskId)
      .map((item) => ({
        ...item,
        dependencies: item.dependencies.filter((dependencyId) => dependencyId !== taskId),
        predecessorIds: item.predecessorIds.filter((dependencyId) => dependencyId !== taskId),
      }));
    replaceTasks(nextTasks, "task deleted");
    if (state.selectedTaskId === taskId) state.selectedTaskId = null;
    if (state.hoveredTaskId === taskId) state.hoveredTaskId = null;
    invalidate("task deleted");
    setStatus(`Deleted task ${task.name}`);
    return true;
  }
  function removeTaskDependencies(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return false;
    const nextTasks = state.tasks.map((item) => ({
      ...item,
      dependencies: item.dependencies.filter((dependencyId) =>
        item.id !== taskId && dependencyId !== taskId,
      ),
      predecessorIds: item.predecessorIds.filter((dependencyId) =>
        item.id !== taskId && dependencyId !== taskId,
      ),
    }));
    if (nextTasks.every((item, index) => item.dependencies.length === state.tasks[index].dependencies.length))
      return false;
    replaceTasks(nextTasks, "task dependencies removed");
    setStatus(`Removed dependencies for ${task.name}`);
    return true;
  }
  function updateTaskColor(taskId, color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return false;
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return false;
    replaceTasks(
      state.tasks.map((item) => item.id === taskId ? { ...item, color } : item),
      "task color changed",
    );
    setStatus(`Changed color for ${task.name}`);
    return true;
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
    state.rowOrder = reconcileRowOrder(
      state.rowOrder,
      state.tasks,
      state.workstreams,
    );
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
    state.rowOrder = reconcileRowOrder(
      state.rowOrder,
      state.tasks,
      state.workstreams,
    );
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
    const task = menuState.taskId
      ? state.tasks.find((item) => item.id === menuState.taskId)
      : null;
    // A fresh add-bar menu must never reuse the previous task's name.
    if (menuState.kind === "add-bar") {
      const nameInput = contextMenu.querySelector("#context-task-name");
      if (nameInput) nameInput.value = "";
    }
    menuState.color = task?.color ?? menuState.color ?? "#287984";
    for (const colorInput of contextMenu.querySelectorAll("input[type='color']"))
      colorInput.value = menuState.color;
    for (const swatch of contextMenu.querySelectorAll("[data-color]"))
      swatch.classList.toggle("is-selected", swatch.dataset.color === menuState.color);
    const taskRemoveDependency = contextMenu.querySelector('[data-action="task.remove-dependencies"]');
    if (taskRemoveDependency)
      taskRemoveDependency.hidden = menuState.kind !== "task" || !task ||
        (task.dependencies.length === 0 && !state.tasks.some((item) => item.dependencies.includes(task.id)));
    // Measure the visible menu. Hidden elements report zero dimensions, which
    // allowed menus opened from lower sidebar rows to render below the viewport.
    contextMenu.hidden = false;
    const maxX = Math.max(8, window.innerWidth - contextMenu.offsetWidth - 8),
      maxY = Math.max(8, window.innerHeight - contextMenu.offsetHeight - 8);
    contextMenu.style.left = `${Math.min(event.clientX, maxX)}px`;
    contextMenu.style.top = `${Math.min(event.clientY, maxY)}px`;
    if (menuState.kind === "add-bar")
      contextMenu.querySelector("#context-task-name")?.focus();
    else contextMenu.querySelector("button:not([hidden])")?.focus();
  }
  function timelinePoint(event) {
    const rect = timeline.getBoundingClientRect();
    const x = event.clientX - rect.left + timeline.scrollLeft;
    const y = event.clientY - rect.top + verticalScroll.scrollTop;
    const rowY = y;
    const row = snapshot?.rows.find(
      (item) => rowY >= item.y && rowY < item.y + item.height,
    );
    const groupName = row
      ? row.group ?? row.task?.groupName ?? row.task?.workstreamId ?? null
      : null;
    return {
      x,
      y,
      row,
      date: xToDate(
        x,
        snapshot.timelineData.minDate,
        state.scale,
        state.visibleWeekdays,
        state.snapIncrement,
      ),
      groupName,
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
    const sidebarTask =
      event.target instanceof Element
        ? event.target.closest("[data-task-id]")
        : null;
    if (sidebarTask && taskList.contains(sidebarTask)) {
      showContextMenu(event, {
        kind: "task",
        taskId: sidebarTask.dataset.taskId,
      });
      return;
    }
    if (taskElement) {
      showContextMenu(event, {
        kind: "task",
        taskId: taskElement.dataset.taskId,
      });
      return;
    }
    const workstreamElement =
      event.target instanceof Element
        ? event.target.closest("[data-workstream-id]") ??
          event.target.closest("[data-group-id]")
        : null;
    if (workstreamElement) {
      showContextMenu(event, {
        kind: "workstream",
        workstreamId:
          workstreamElement.dataset.workstreamId ??
          workstreamElement.dataset.groupId,
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
    scheduleConnectionPreview();
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
    cancelConnectionPreviewFrame();
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
    const nameInput = contextMenu?.querySelector("#context-task-name");
    const name = nameInput?.value?.trim() || "New task";
    const color = contextMenuState.color ?? "#287984";
    hideContextMenu();
    const created = createTask({
      name,
      color,
      startDate: point.date,
      groupName: point.groupName,
      focusSidebarName: false,
    });
    void persist({
      tasks: state.tasks,
      effects: [{ cause: "created", taskId: created.id }],
    });
  }
  async function persist(result) {
    const isReorder =
      result.kind === "reorder" ||
      result.kind === "reorder-group" ||
      result.kind === "reorder-move";
    const tasks = result.tasks ?? state.tasks;
    const effects = result.effects ?? [];
    onScheduleCommit(tasks, effects);
    if (!gateway) return;
    setStatus("Saving schedule…");
    const job = application.scheduleAsync((signal) =>
      gateway.execute(
        "schedule.commit",
        {
          tasks,
          effects,
          ...(isReorder
            ? { rowOrder: result.rowOrder, rowOrderDirty: state.rowOrderDirty }
            : {}),
        },
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
    const nextTasks = normalizeTasks(response.data.tasks);
    state.minDate = originFromTasks(nextTasks, startOfCalendarDay(new Date()));
    const latestTaskDate = nextTasks.reduce(
      (max, task) =>
        task.endDate.getTime() > max.getTime() ? task.endDate : max,
      startOfCalendarDay(new Date()),
    );
    state.futureDays = 90;
    state.timelineMaxDate = addCalendarDays(
      startOfCalendarDay(latestTaskDate),
      90,
    );
    state.leftBufferExpanded = false;
    state.rowOrder = defaultRowOrder(nextTasks, state.workstreams);
    state.rowOrderDirty = false;
    setStatus("Schedule loaded");
  }

  application.registerView("task-list", taskList, () =>
    renderTaskList(taskList, state, snapshot.rows),
  );
  application.registerView("project-brand", root, () => {
    const brand = root.querySelector(".project-top-nav__brand");
    if (brand) renderProjectBrand(brand, state);
  });
  application.registerView("timeline", timeline, () =>
    renderTimeline(
      timeline,
      snapshot,
      verticalScroll.clientHeight,
      timelineHeader,
    ),
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
      updateThemeControl();
      invalidate("theme changed");
    }
  });
  application.registerCommand("theme.toggle", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    root.dataset.theme = state.theme;
    updateThemeControl();
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
  application.registerCommand("workstream.collapse", () => {
    const id = contextMenuState?.workstreamId;
    if (!id) return;
    hideContextMenu();
    if (state.expandedWorkstreams.has(id)) state.expandedWorkstreams.delete(id);
    else state.expandedWorkstreams.add(id);
    invalidate("workstream toggled");
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
  application.registerCommand("task.delete", () => {
    const taskId = contextMenuState?.taskId;
    hideContextMenu();
    if (deleteTask(taskId))
      void persist({
        tasks: state.tasks,
        effects: [{ cause: "deleted", taskId }],
      });
  });
  application.registerCommand("task.remove-dependencies", () => {
    const taskId = contextMenuState?.taskId;
    hideContextMenu();
    if (removeTaskDependencies(taskId))
      void persist({
        tasks: state.tasks,
        effects: [{ cause: "dependencies-removed", taskId }],
      });
  });
  application.registerCommand("task.color-select", ({ source }) => {
    const color = source.dataset.color;
    if (!contextMenuState || !color) return;
    contextMenuState.color = color;
    for (const swatch of contextMenu.querySelectorAll("[data-color]"))
      swatch.classList.toggle("is-selected", swatch.dataset.color === color);
    if (contextMenuState.kind === "task") {
      const taskId = contextMenuState.taskId;
      hideContextMenu();
      if (updateTaskColor(taskId, color))
        void persist({
          tasks: state.tasks,
          effects: [{ cause: "color-changed", taskId, color }],
        });
    }
  });
  application.registerCommand("task.color-input", ({ source }) => {
    const color = source.value;
    if (!contextMenuState || !color) return;
    contextMenuState.color = color;
    for (const swatch of contextMenu.querySelectorAll("[data-color]"))
      swatch.classList.toggle("is-selected", swatch.dataset.color === color);
    if (contextMenuState.kind === "task") {
      const taskId = contextMenuState.taskId;
      hideContextMenu();
      if (updateTaskColor(taskId, color))
        void persist({
          tasks: state.tasks,
          effects: [{ cause: "color-changed", taskId, color }],
        });
    }
  });
  application.registerCommand("task.select", ({ source }) =>
    select(source.dataset.taskId),
  );
  application.registerCommand("task.create-workstream", ({ source }) => {
    const groupName = source.dataset.workstreamId ?? source.dataset.groupId;
    const workstream = state.workstreams.find((item) => item.id === groupName);
    const created = createTask({
      name: "New task",
      groupName: groupName ?? null,
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
  application.registerCommand("project.logo.open", openLogoDialog);
  application.registerCommand("project.logo.cancel", cancelLogo);
  application.registerCommand("project.logo.save", saveLogo);
  application.registerCommand("project.logo.file", ({ source }) => {
    const file = source.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const image = new Image();
      image.onload = () => {
        state.logoDraft = {
          dataUrl,
          scale: logoScaleToCover(image),
          x: 0,
          y: 0,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        };
        renderLogoDialogPreview();
      };
      image.src = dataUrl;
      source.value = "";
    };
    reader.readAsDataURL(file);
  });
  application.registerCommand("grid-settings.open", openGridSettingsDialog);
  application.registerCommand("grid-settings.save", saveGridSettings);
  application.registerCommand("grid-settings.cancel", cancelGridSettings);
  application.registerCommand("project.name.edit", beginProjectNameEdit);
  application.registerCommand("project.name.commit", ({ source }) =>
    commitProjectName(source.value),
  );
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
    getSnapshot: () => snapshot,
    getPointerRowY: (event) => {
      const rect = timeline.getBoundingClientRect();
      const y = event.clientY - rect.top + verticalScroll.scrollTop;
      return y;
    },
    onSelect: select,
    onHover: hover,
    onPreview: (result, previewDrag) => {
      state.previewResult = result;
      state.previewDrag = previewDrag ?? null;
      invalidate(result ? "schedule preview" : "schedule preview cancelled");
    },
    onLeftEdge: () => prependLeftDragBuffer(),
    onCommit: (result, release = {}) => {
      if (result.kind !== "reorder-group") state.tasks = result.tasks;
      if (result.kind === "reorder") {
        state.rowOrder = result.order;
        state.rowOrderDirty = true;
      }
      if (result.kind === "reorder-group" && result.rowOrder) {
        state.rowOrder = result.rowOrder;
        state.rowOrderDirty = true;
      }
      if (result.kind === "reorder-move") {
        state.rowOrder = result.rowOrder;
        state.rowOrderDirty = true;
      }
      const compacted =
        result.kind !== "reorder-group" &&
        compactTimelineToTasks(release.edgeDirection);
      state.previewResult = null;
      state.previewDrag = null;
      state.criticalTaskIds = criticalIds(state.tasks);
      invalidate("schedule committed");
      if (compacted) {
        queueMicrotask(() => {
          const max = Math.max(0, timeline.scrollWidth - timeline.clientWidth);
          if (release.edgeDirection < 0) timeline.scrollLeft = 0;
          else if (release.edgeDirection > 0) timeline.scrollLeft = max;
          else timeline.scrollLeft = Math.min(timeline.scrollLeft, max);
        });
      }
      void persist(result);
    },
    onNotice: setStatus,
  });
  function updateGuide(event) {
    if (taskElementFromEvent(event)) {
      if (state.guide?.visible) {
        state.guide = { visible: false };
        invalidate("guide hidden (over bar)");
      }
      return;
    }
    if (!snapshot) return;
    const point = timelinePoint(event);
    if (!point.groupName) {
      if (state.guide?.visible) {
        state.guide = { visible: false };
        invalidate("guide hidden (no lane)");
      }
      return;
    }
    const x = dateToX(
      point.date,
      snapshot.timelineData.minDate,
      state.scale,
      state.visibleWeekdays,
    );
    const y = point.row ? point.row.y + point.row.height / 2 : point.y;
    if (state.guide?.visible && state.guide.x === x && state.guide.y === y) return;
    state.guide = { x, y, visible: true };
    invalidate("guide updated");
  }
  timeline.addEventListener("pointermove", updateGuide);
  timeline.addEventListener("pointerleave", () => {
    if (state.guide?.visible) {
      state.guide = { visible: false };
      invalidate("guide hidden (left)");
    }
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
  const hScroll = root.querySelector(".timeline-hscroll");
  const hThumb = hScroll?.querySelector(".timeline-hscroll__thumb");
  let hScrollDragging = false;
  let hScrollGrabOffset = 0;
  // Reflects the timeline's horizontal scroll position onto the custom thumb.
  function syncHScroll() {
    if (!hThumb) return;
    const max = Math.max(1, timeline.scrollWidth - timeline.clientWidth);
    const track = hScroll.clientWidth;
    const thumbWidth = Math.max(24, (timeline.clientWidth / timeline.scrollWidth) * track);
    hThumb.style.width = `${thumbWidth}px`;
    const ratio = max <= 0 ? 0 : timeline.scrollLeft / max;
    hThumb.style.transform = `translateX(${ratio * Math.max(0, track - thumbWidth)}px)`;
  }
  function hScrollPointer(event, grabOffset = hScrollGrabOffset) {
    if (!hThumb) return;
    event.preventDefault();
    const trackRect = hScroll.getBoundingClientRect();
    const thumbWidth = parseFloat(hThumb.style.width) || 24;
    const trackWidth = trackRect.width;
    const max = Math.max(1, timeline.scrollWidth - timeline.clientWidth);
    const offset = Number.isFinite(grabOffset)
      ? grabOffset
      : thumbWidth / 2;
    const pos = (event.clientX - trackRect.left - offset) /
      Math.max(1, trackWidth - thumbWidth);
    timeline.scrollLeft = Math.max(0, Math.min(max, pos * max));
  }
  const hScrollDown = (event) => {
    if (!hThumb) return;
    hScrollDragging = true;
    const thumbRect = hThumb.getBoundingClientRect();
    const grabbedThumb =
      event.target === hThumb || hThumb.contains(event.target);
    hScrollGrabOffset = grabbedThumb
      ? event.clientX - thumbRect.left
      : thumbRect.width / 2;
    hThumb.classList.add("timeline-hscroll__thumb--dragging");
    hThumb.setPointerCapture?.(event.pointerId);
    hScrollPointer(event, hScrollGrabOffset);
  };
  const hScrollMove = (event) => {
    if (hScrollDragging) hScrollPointer(event);
  };
  const hScrollUp = () => {
    if (!hScrollDragging) return;
    hScrollDragging = false;
    hScrollGrabOffset = 0;
    hThumb?.classList.remove("timeline-hscroll__thumb--dragging");
  };
  function timelineScroll() {
    const previousScrollLeft = lastScrollLeft;
    const horizontalDelta = timeline.scrollLeft - previousScrollLeft;
    lastScrollLeft = timeline.scrollLeft;
    syncHScroll();
    timelineHeader.scrollLeft = timeline.scrollLeft;
    const edgeBuffer = getTimelineScale(state.scale).dayWidth * TIMELINE_EDGE_BUFFER_CELLS;
    const remaining =
      timeline.scrollWidth - timeline.clientWidth - timeline.scrollLeft;
    // Only a horizontal movement that reaches the final two cells may grow it.
    if (horizontalDelta > 0) {
      if (remaining <= edgeBuffer && !rightLatched) {
        rightLatched = true;
        state.futureDays += 180;
        state.timelineMaxDate = addCalendarDays(state.timelineMaxDate, 180);
        invalidate("timeline extended");
      }
      if (remaining > edgeBuffer * 2) rightLatched = false;
    } else if (horizontalDelta < 0 && remaining > edgeBuffer * 2) {
      rightLatched = false;
    }
    if (horizontalDelta !== 0 && timeline.scrollLeft < edgeBuffer * 2 && state.futureDays > 90) {
      shrinkJob?.cancel();
      shrinkJob = application.scheduler.scheduleDelay(() => {
        if (timeline.scrollLeft < edgeBuffer * 2) {
          state.futureDays = 90;
          const latestTaskDate = state.tasks.reduce(
            (max, task) =>
              task.endDate.getTime() > max.getTime() ? task.endDate : max,
            state.tasks[0]?.endDate ?? state.timelineMaxDate,
          );
          state.timelineMaxDate = addCalendarDays(
            startOfCalendarDay(latestTaskDate),
            90,
          );
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
      if (state.logoOpen) {
        event.preventDefault();
        cancelLogo();
        return;
      }
      if (state.gridSettingsOpen) {
        event.preventDefault();
        cancelGridSettings();
        return;
      }
      if (state.projectNameEditing) {
        event.preventDefault();
        cancelProjectName();
        return;
      }
      if (state.connection) {
        cancelConnectionPreviewFrame();
        state.connection = null;
        invalidate("dependency connection cancelled");
        setStatus("Connection cancelled.");
      } else hideContextMenu();
      return;
    }
    if (event.key !== "Enter") return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.id === "context-task-name" && contextMenuState?.kind === "add-bar") {
      event.preventDefault();
      addBarAtContext();
      return;
    }
    const action = target?.dataset?.action;
    if (action !== "task.rename" && action !== "project.name.commit") return;
    const source = target.closest("[data-action]");
    if (!source) return;
    event.preventDefault();
    if (action === "task.rename") {
      renameTask(source.dataset.editTaskId, source.value);
      void persist({
        tasks: state.tasks,
        effects: [{ cause: "renamed", taskId: source.dataset.editTaskId }],
      });
    } else {
      commitProjectName(source.value);
    }
  };
  const contextMenuHandler = (event) => openContextMenu(event);
  const logoDrag = { pointerId: null, startX: 0, startY: 0 };
  const logoWheel = (event) => {
    if (!state.logoOpen || !state.logoDraft?.dataUrl || !logoCropSurface) return;
    event.preventDefault();
    state.logoDraft.scale = Math.min(
      LOGO_MAX_SCALE,
      Math.max(LOGO_MIN_SCALE, state.logoDraft.scale - event.deltaY * 0.001),
    );
    renderLogoDialogPreview();
  };
  const logoPointerDown = (event) => {
    if (!state.logoOpen || !state.logoDraft?.dataUrl || event.button !== 0) return;
    logoDrag.pointerId = event.pointerId;
    logoDrag.startX = event.clientX - state.logoDraft.x;
    logoDrag.startY = event.clientY - state.logoDraft.y;
    logoCropSurface?.setPointerCapture(event.pointerId);
    logoCropSurface?.classList.add("project-logo-dialog__crop--dragging");
    event.preventDefault();
  };
  const logoPointerMove = (event) => {
    if (logoDrag.pointerId !== event.pointerId) return;
    state.logoDraft.x = event.clientX - logoDrag.startX;
    state.logoDraft.y = event.clientY - logoDrag.startY;
    renderLogoDialogPreview();
  };
  const logoPointerEnd = (event) => {
    if (logoDrag.pointerId !== event.pointerId) return;
    logoDrag.pointerId = null;
    if (logoCropSurface?.hasPointerCapture?.(event.pointerId))
      logoCropSurface.releasePointerCapture(event.pointerId);
    logoCropSurface?.classList.remove("project-logo-dialog__crop--dragging");
  };
  const logoBackdropClick = (event) => {
    if (event.target === logoDialog) cancelLogo();
  };
  const gridSettingsBackdropClick = (event) => {
    if (event.target === gridSettingsDialog) cancelGridSettings();
  };
  const logoDialogKeydown = (event) => {
    if (event.key !== "Tab" || !logoDialogPanel) return;
    const items = Array.from(
      logoDialogPanel.querySelectorAll(
        "button, input, select, textarea, [tabindex], pmis-button, pmis-textfield",
      ),
    ).filter(
      (element) =>
        !element.disabled &&
        !element.hasAttribute("disabled") &&
        !element.hidden &&
        element.getAttribute("tabindex") !== "-1",
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
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
    window.addEventListener("pointerdown", connectionDown, true);
    window.addEventListener("click", connectionClick, true);
    taskList.addEventListener("click", taskClick);
    taskList.addEventListener("pointerover", taskOver);
    taskList.addEventListener("pointerout", taskOut);
    timeline.addEventListener("scroll", timelineScroll);
    if (hScroll) {
      hScroll.addEventListener("pointerdown", hScrollDown);
      hScroll.addEventListener("pointermove", hScrollMove);
      hScroll.addEventListener("pointerup", hScrollUp);
      hScroll.addEventListener("pointercancel", hScrollUp);
      queueMicrotask(syncHScroll);
    }
    if (logoCropSurface) {
      logoCropSurface.addEventListener("wheel", logoWheel, { passive: false });
      logoCropSurface.addEventListener("pointerdown", logoPointerDown);
      logoCropSurface.addEventListener("pointermove", logoPointerMove);
      logoCropSurface.addEventListener("pointerup", logoPointerEnd);
      logoCropSurface.addEventListener("pointercancel", logoPointerEnd);
    }
    logoDialog?.addEventListener("click", logoBackdropClick);
    logoDialogPanel?.addEventListener("keydown", logoDialogKeydown);
    gridSettingsDialog?.addEventListener("click", gridSettingsBackdropClick);
    gridSettingsDialogPanel?.addEventListener(
      "keydown",
      gridSettingsDialogKeydown,
    );
    gridSettingsDialogPanel?.addEventListener(
      "change",
      gridSettingsDialogChange,
    );
    gridSettingsDialogPanel?.addEventListener(
      "input",
      gridSettingsDialogInput,
    );
    return api;
  }
  function dispose() {
    if (disposed) return false;
    interaction.stop();
    root.removeEventListener("contextmenu", contextMenuHandler);
    root.removeEventListener("pointerdown", rootContextMenu);
    root.removeEventListener("keydown", keydown);
    document.removeEventListener("pointermove", connectionMove, true);
    window.removeEventListener("pointerdown", connectionDown, true);
    window.removeEventListener("click", connectionClick, true);
    taskList.removeEventListener("click", taskClick);
    taskList.removeEventListener("pointerover", taskOver);
    taskList.removeEventListener("pointerout", taskOut);
    timeline.removeEventListener("scroll", timelineScroll);
    if (hScroll) {
      hScroll.removeEventListener("pointerdown", hScrollDown);
      hScroll.removeEventListener("pointermove", hScrollMove);
      hScroll.removeEventListener("pointerup", hScrollUp);
      hScroll.removeEventListener("pointercancel", hScrollUp);
    }
    if (logoCropSurface) {
      logoCropSurface.removeEventListener("wheel", logoWheel);
      logoCropSurface.removeEventListener("pointerdown", logoPointerDown);
      logoCropSurface.removeEventListener("pointermove", logoPointerMove);
      logoCropSurface.removeEventListener("pointerup", logoPointerEnd);
      logoCropSurface.removeEventListener("pointercancel", logoPointerEnd);
    }
    logoDialog?.removeEventListener("click", logoBackdropClick);
    logoDialogPanel?.removeEventListener("keydown", logoDialogKeydown);
    gridSettingsDialog?.removeEventListener("click", gridSettingsBackdropClick);
    gridSettingsDialogPanel?.removeEventListener(
      "keydown",
      gridSettingsDialogKeydown,
    );
    gridSettingsDialogPanel?.removeEventListener(
      "change",
      gridSettingsDialogChange,
    );
    gridSettingsDialogPanel?.removeEventListener(
      "input",
      gridSettingsDialogInput,
    );
    shrinkJob?.cancel();
    cancelConnectionPreviewFrame();
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
    setTasks: (tasks) => {
      const nextTasks = normalizeTasks(tasks);
      state.minDate = originFromTasks(
        nextTasks,
        startOfCalendarDay(new Date()),
      );
      const latestTaskDate = nextTasks.reduce(
        (max, task) =>
          task.endDate.getTime() > max.getTime() ? task.endDate : max,
        startOfCalendarDay(new Date()),
      );
      state.futureDays = 90;
      state.timelineMaxDate = addCalendarDays(
        startOfCalendarDay(latestTaskDate),
        90,
      );
      state.leftBufferExpanded = false;
      state.rowOrder = defaultRowOrder(nextTasks, state.workstreams);
      state.rowOrderDirty = false;
      replaceTasks(nextTasks, "tasks replaced");
    },
  };
  return api;
}
