import { buildDependencyRoutes, routeDependency } from "./dependencies.js";
import { BAR_HEIGHT, HEADER_HEIGHT } from "./timeline.js";

const NS = "http://www.w3.org/2000/svg";
const svg = (name, attrs = {}) => {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null)
      element.setAttribute(key, String(value));
  }
  return element;
};
const svgText = (text, attrs) => {
  const element = svg("text", attrs);
  element.textContent = text;
  return element;
};
const safeStatus = (value) =>
  ["todo", "in-progress", "done", "blocked"].includes(value) ? value : "todo";

function renderTaskListLegacy(root, state, rows) {
  const fragment = document.createDocumentFragment();
  let groupNumber = 0;
  let taskNumber = 0;

  for (const row of rows) {
    const element = document.createElement(
      row.type === "group-header" ? "button" : "div",
    );
    if (row.type === "group-header") element.type = "button";

    if (row.type === "group-header") {
      groupNumber += 1;
      taskNumber = 0;
      const expanded = state.expandedWorkstreams.has(row.group);
      element.className = "task-group";
      element.dataset.action = "workstream.toggle";
      element.dataset.workstreamId = row.group;
      element.setAttribute("aria-expanded", String(expanded));

      const index = document.createElement("span");
      index.className = "task-group__index";
      index.textContent = String(groupNumber);
      const name = document.createElement("span");
      name.className = "task-group__name";
      name.textContent = row.workstream.label;
      const chevron = document.createElement("span");
      chevron.className = "task-group__chevron";
      chevron.textContent = expanded ? "⌄" : "›";
      element.append(index, name, chevron);
    } else {
      taskNumber += 1;
      const task = row.task;
      element.className = "task-row";
      element.dataset.taskId = task.id;
      element.dataset.selected = String(state.selectedTaskId === task.id);
      element.dataset.hovered = String(state.hoveredTaskId === task.id);
      element.setAttribute("aria-label", `Task ${task.name}`);

      const index = document.createElement("span");
      index.className = "task-row__index";
      index.textContent = `${groupNumber}.${taskNumber}`;
      const dot = document.createElement("span");
      dot.className = `task-row__status task-row__status--${safeStatus(task.status)}`;
      const name = document.createElement("input");
      name.className = "task-row__name";
      name.type = "text";
      name.value = `${task.isMilestone ? "◆ " : ""}${task.name}`;
      name.dataset.action = "task.rename";
      name.dataset.editTaskId = task.id;
      name.setAttribute("aria-label", `Task name ${task.name}`);
      const resource = document.createElement("span");
      resource.className = "task-row__resource";
      resource.textContent = task.resource ?? task.assignee?.name ?? "—";
      const status = document.createElement("span");
      status.className = `task-row__status-label task-row__status-label--${safeStatus(task.status)}`;
      status.textContent = task.status ?? "";
      const meta = document.createElement("span");
      meta.className = "task-row__meta";
      const links = task.dependencies.length + task.dependents.length;
      meta.textContent = links ? `⑂ ${links}` : "";
      element.append(index, dot, name, resource, status, meta);
    }
    fragment.append(element);
  }

  const createRow = document.createElement("div");
  createRow.className = "task-create-row";
  const createInput = document.createElement("input");
  createInput.type = "text";
  createInput.placeholder = "Add task…";
  createInput.dataset.action = "task.create";
  createInput.setAttribute("aria-label", "Add task");
  createRow.append(createInput);
  fragment.append(createRow);
  root.replaceChildren(fragment);
}

const sidebarStatusLabels = {
  todo: "To Do",
  "in-progress": "In Progress",
  blocked: "Blocked",
  done: "Done",
};

const sidebarWorkstreamIcons = {
  foundation: "blocks",
  "core-platform": "server-cog",
  "execution-ui": "panels",
  validation: "shield",
  release: "rocket",
};

const sidebarTeamColors = {
  Infra: "#287984",
  Backend: "#287984",
  Deployment: "#66548f",
  QA: "#287984",
  Management: "#60747c",
};

function sidebarElement(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const sidebarIconPaths = {
  "chevron-down": ["M6 9l6 6 6-6"],
  "chevron-right": ["M9 18l6-6-6-6"],
  plus: ["M5 12h14", "M12 5v14"],
  "more-horizontal": ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  "git-branch": ["M6 3v12", "M18 9a3 3 0 1 0-3-3", "M6 15a3 3 0 1 0 3 3", "M15 6H9a3 3 0 0 0-3 3"],
  "list-todo": ["M13 5h8", "M13 12h8", "M13 19h8", "M3 5h.01", "M3 12h.01", "M3 19h.01"],
  "circle-alert": ["M12 8v4", "M12 16h.01", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  activity: ["M3 12h4l3-9 4 18 3-9h4"],
  "check-circle": ["m9 12 2 2 4-4", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  blocks: [
    "M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2",
    "M14 2h8v8h-8z",
  ],
  "server-cog": [
    "m10.852 14.772-.383.923",
    "M13.148 14.772a3 3 0 1 0-2.296-5.544l-.383-.923",
    "m13.148 9.228.383-.923",
    "m13.53 15.696-.382-.924a3 3 0 1 1-2.296-5.544",
    "m14.772 10.852.923-.383",
    "m14.772 13.148.923.383",
    "M4.5 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-.5",
    "M4.5 14H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-.5",
    "M6 18h.01",
    "M6 6h.01",
    "m9.228 10.852-.923-.383",
    "m9.228 13.148-.923.383",
  ],
  panels: ["M3 3h18v18H3z", "M3 9h18", "M9 21V9"],
  shield: ["M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z", "m9 12 2 2 4-4"],
  rocket: ["M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z", "m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z", "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0", "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"],
};

function sidebarSvgIcon(name) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "14");
  icon.setAttribute("height", "14");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.8");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  for (const path of sidebarIconPaths[name] ?? []) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
    node.setAttribute("d", path);
    icon.append(node);
  }
  return icon;
}

function sidebarButton(action, label, text, dataset = {}) {
  const button = sidebarElement("button", "task-panel__icon-button");
  button.type = "button";
  button.dataset.action = action;
  Object.assign(button.dataset, dataset);
  button.setAttribute("aria-label", label);
  const iconName = action === "workstream.toggle"
    ? text === "⌄" ? "chevron-down" : "chevron-right"
    : action === "task.create-workstream" ? "plus" : "more-horizontal";
  button.append(sidebarSvgIcon(iconName));
  return button;
}

function sidebarStatusSummary(tasks) {
  return [
    ["blocked", "circle-alert"],
    ["in-progress", "activity"],
    ["done", "check-circle"],
  ].map(([status, symbol]) => ({
    status,
    symbol,
    count: tasks.filter((task) => safeStatus(task.status) === status).length,
  }));
}

export function renderTaskList(root, state, rows) {
  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    if (row.type === "group-header") {
      const expanded = state.expandedWorkstreams.has(row.group);
      const group = sidebarElement("div", "task-group");
      group.dataset.groupId = row.group;
      group.dataset.expanded = String(expanded);

      const toggle = sidebarButton(
        "workstream.toggle",
        `${expanded ? "Collapse" : "Expand"} ${row.workstream.label}`,
        expanded ? String.fromCharCode(0x2304) : String.fromCharCode(0x203a),
        { workstreamId: row.group },
      );
      toggle.classList.add("task-group__chevron");
      toggle.setAttribute("aria-expanded", String(expanded));

      const body = sidebarElement("div", "task-group__body");
      const icon = sidebarElement(
        "span",
        "task-group__icon",
      );
      const iconName = sidebarWorkstreamIcons[row.workstream.icon] ?? sidebarWorkstreamIcons[row.group] ?? row.workstream.icon ?? "blocks";
      icon.append(sidebarSvgIcon(iconName));
      icon.style.setProperty(
        "--workstream-color",
        row.workstream.color ?? "var(--primary)",
      );
      icon.setAttribute("aria-hidden", "true");
      const name = sidebarElement("span", "task-group__name", row.workstream.label);
      const taskIcon = sidebarElement("span", "task-group__task-icon");
      taskIcon.append(sidebarSvgIcon("list-todo"));
      const count = sidebarElement("span", "task-group__count", String(row.taskCount));
      count.setAttribute("aria-label", `${row.taskCount} tasks`);
      body.append(icon, name, taskIcon, count);

      const groupTasks = state.tasks.filter(
        (task) => (task.groupName ?? task.workstreamId ?? task.group) === row.group,
      );
      const summary = sidebarElement("span", "task-group__summary");
      for (const item of sidebarStatusSummary(groupTasks)) {
        if (!item.count) continue;
        const status = sidebarElement(
          "span",
          `task-group__summary-item task-group__summary-item--${item.status}`,
        );
        status.append(
          sidebarElement("span", "task-group__summary-symbol"),
          sidebarElement("span", "task-group__summary-count", String(item.count)),
        );
        status.querySelector(".task-group__summary-symbol").append(sidebarSvgIcon(item.symbol));
        status.setAttribute(
          "aria-label",
          `${item.count} ${sidebarStatusLabels[item.status]} tasks`,
        );
        summary.append(status);
      }

      const actions = sidebarElement("span", "task-group__actions");
      actions.append(
        sidebarButton(
          "task.create-workstream",
          `Add task to ${row.workstream.label}`,
          "+",
          { groupId: row.group },
        ),
        sidebarButton(
          "workstream.manage",
          `Manage ${row.workstream.label}`,
          "...",
          { groupId: row.group },
        ),
      );
      group.append(toggle, body, summary, actions);
      fragment.append(group);
      continue;
    }

    const task = row.task;
    const taskRow = sidebarElement("div", "task-row");
    taskRow.dataset.taskId = task.id;
    taskRow.dataset.selected = String(state.selectedTaskId === task.id);
    taskRow.dataset.hovered = String(state.hoveredTaskId === task.id);
    taskRow.setAttribute("aria-label", `Task ${task.name}`);

    const main = sidebarElement("div", "task-row__main");
    const statusName = safeStatus(task.status);
    const dot = sidebarElement("span", `task-row__status task-row__status--${statusName}`);
    dot.setAttribute("aria-label", sidebarStatusLabels[statusName]);
    const name = document.createElement("input");
    name.className = "task-row__name";
    name.type = "text";
    name.value = task.isMilestone ? "M " + task.name : task.name;
    name.value = `${task.isMilestone ? "\\u25c6 " : ""}${task.name}`;
    name.dataset.action = "task.rename";
    name.value = task.isMilestone ? String.fromCharCode(0x25c6) + " " + task.name : task.name;
    name.dataset.editTaskId = task.id;
    name.setAttribute("aria-label", `Task name ${task.name}`);
    if (statusName === "done") name.classList.add("task-row__name--done");
    main.append(dot, name);

    const assignee = task.assignee ?? {};
    const avatar = sidebarElement("span", "task-row__avatar", assignee.initials ?? "--");
    avatar.style.setProperty("--avatar-color", assignee.color ?? "var(--muted)");
    avatar.setAttribute("aria-label", assignee.name ? `Assignee ${assignee.name}` : "Unassigned");
    const teamName = task.teamLabel ?? task.resource ?? task.teamName ?? "Unassigned";
    const team = sidebarElement("span", "task-row__team-badge", teamName);
    team.style.setProperty("--team-color", sidebarTeamColors[teamName] ?? "var(--muted-foreground)");
    const status = sidebarElement(
      "span",
      `task-row__status-badge task-row__status-badge--${statusName}`,
      sidebarStatusLabels[statusName],
    );
    const links = (task.dependencies?.length ?? 0) + (task.dependents?.length ?? 0);
    const dependencies = sidebarElement(
      "span",
      "task-row__dependencies",
      links ? `\\u2318 ${links}` : "",
    );
    if (links) dependencies.setAttribute("aria-label", `${links} dependencies`);
    dependencies.textContent = "";
    if (links) {
      dependencies.append(
        sidebarSvgIcon("git-branch"),
        sidebarElement("span", "task-row__dependency-count", String(links)),
      );
    }
    taskRow.append(main, avatar, team, status, dependencies);
    fragment.append(taskRow);
  }

  const createRow = sidebarElement("div", "task-create-row");
  const createInput = document.createElement("input");
  createInput.type = "text";
  createInput.placeholder = "Add task...";
  createInput.dataset.action = "task.create";
  createInput.setAttribute("aria-label", "Add task");
  createRow.append(createInput);
  fragment.append(createRow);
  root.replaceChildren(fragment);
}

function markers(defs, scope) {
  for (const [kind, color] of [
    ["normal", "#5d85a7"],
    ["critical", "#bd4b3d"],
  ]) {
    const marker = svg("marker", {
      id: `${scope}-arrow-${kind}`,
      markerWidth: 8,
      markerHeight: 8,
      refX: 7,
      refY: 4,
      orient: "auto",
      markerUnits: "strokeWidth",
    });
    marker.append(svg("path", { d: "M 0 0 L 8 4 L 0 8 z", fill: color }));
    defs.append(marker);
  }
}

function appendCalendarSegments(result, data, keyOf, labelOf, y, className) {
  let start = 0;
  for (let index = 0; index <= data.visibleDates.length; index += 1) {
    const current =
      index < data.visibleDates.length ? keyOf(data.visibleDates[index]) : null;
    const previous =
      start < data.visibleDates.length ? keyOf(data.visibleDates[start]) : null;
    if (index === data.visibleDates.length || current !== previous) {
      const width = (index - start) * data.scale.dayWidth;
      result.append(
        svgText(labelOf(data.visibleDates[start]), {
          x: start * data.scale.dayWidth + width / 2,
          y,
          class: `${className} timeline-segment-label`,
          "text-anchor": "middle",
        }),
      );
      start = index;
    }
  }
}

function headerLegacy(data) {
  const result = svg("svg", {
    class: "timeline-header",
    width: data.totalWidth,
    height: HEADER_HEIGHT,
    role: "img",
    "aria-label": `${data.scale.label} timeline calendar`,
  });
  appendCalendarSegments(
    result,
    data,
    (date) => date.getFullYear(),
    (date) => String(date.getFullYear()),
    13,
    "timeline-year-label",
  );
  appendCalendarSegments(
    result,
    data,
    (date) => `${date.getFullYear()}-${date.getMonth()}`,
    (date) => date.toLocaleDateString(undefined, { month: "long" }),
    36,
    "timeline-month-label",
  );

  data.visibleDates.forEach((date, index) => {
    const x = index * data.scale.dayWidth;
    result.append(
      svg("line", {
        x1: x,
        x2: x,
        y1: 42,
        y2: HEADER_HEIGHT,
        class: "timeline-header-cell-line",
      }),
    );
    result.append(
      svgText(date.toLocaleDateString(undefined, { day: "2-digit" }), {
        x: x + data.scale.dayWidth / 2,
        y: 59,
        class: "timeline-label",
        "text-anchor": "middle",
      }),
    );
  });
  return result;
}

function header(data) {
  const result = svg("svg", {
    class: "timeline-header",
    width: data.totalWidth,
    height: HEADER_HEIGHT,
    role: "img",
    "aria-label": data.scale.label + " timeline calendar",
  });
  let segmentStart = 0;
  for (let index = 0; index <= data.visibleDates.length; index += 1) {
    const current = index < data.visibleDates.length
      ? data.visibleDates[index].getFullYear() + "-" + data.visibleDates[index].getMonth()
      : null;
    const previous = segmentStart < data.visibleDates.length
      ? data.visibleDates[segmentStart].getFullYear() + "-" + data.visibleDates[segmentStart].getMonth()
      : null;
    if (index === data.visibleDates.length || current !== previous) {
      const width = (index - segmentStart) * data.scale.dayWidth;
      const startDate = data.visibleDates[segmentStart];
      result.append(
        svg("line", {
          x1: segmentStart * data.scale.dayWidth,
          x2: segmentStart * data.scale.dayWidth,
          y1: 0,
          y2: 24,
          class: "timeline-header-cell-line",
        }),
        svgText(startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }), {
          x: segmentStart * data.scale.dayWidth + width / 2,
          y: 16,
          class: "timeline-month-label",
          "text-anchor": "middle",
        }),
      );
      segmentStart = index;
    }
  }
  result.append(svg("line", { x1: 0, x2: data.totalWidth, y1: 24, y2: 24, class: "timeline-header-row-line" }));
  data.visibleDates.forEach((date, index) => {
    const x = index * data.scale.dayWidth;
    const weekday = date.toLocaleDateString("en-US", {
      weekday: data.scale.dayWidth >= 32 ? "short" : "narrow",
    }).toUpperCase();
    result.append(
      svg("line", { x1: x, x2: x, y1: 24, y2: HEADER_HEIGHT, class: "timeline-header-cell-line" }),
      svgText(weekday, { x: x + data.scale.dayWidth / 2, y: 40, class: "timeline-weekday-label", "text-anchor": "middle" }),
      svgText(String(date.getDate()), { x: x + data.scale.dayWidth / 2, y: 65, class: "timeline-label", "text-anchor": "middle" }),
    );
  });
  result.append(svg("line", { x1: 0, x2: data.totalWidth, y1: 48, y2: 48, class: "timeline-header-row-line" }));
  return result;
}

function grid(target, rows, data, height, settings, state) {
  for (const row of rows) {
    target.append(
      svg("rect", {
        x: 0,
        y: row.y,
        width: data.totalWidth,
        height: row.height,
        class: [
          row.type === "group-header"
            ? "timeline-row--group"
            : "timeline-row--task",
          row.type === "task" && row.task.id === state.selectedTaskId
            ? "timeline-row--selected"
            : "",
          row.type === "task" &&
          row.task.id === state.hoveredTaskId &&
          row.task.id !== state.selectedTaskId
            ? "timeline-row--hovered"
            : "",
        ].filter(Boolean).join(" "),
        fill:
          row.type === "group-header" ? settings.groupFill : settings.taskFill,
      }),
    );
  }

  if (settings.showVerticalLines) {
    data.visibleDates.forEach((date, index) =>
      target.append(
        svg("line", {
          x1: index * data.scale.dayWidth,
          x2: index * data.scale.dayWidth,
          y1: 0,
          y2: height,
          class:
            date.getDay() === 1 && settings.showMajorLines
              ? "timeline-week-line"
              : "timeline-grid-line",
          stroke:
            date.getDay() === 1 && settings.showMajorLines
              ? settings.majorLineColor
              : settings.minorLineColor,
        }),
      ),
    );
  }
  if (settings.showHorizontalLines) {
    target.append(
      svg("line", {
        x1: 0,
        x2: data.totalWidth,
        y1: 0,
        y2: 0,
        class: "timeline-row-line",
        stroke: settings.rowLineColor,
      }),
    );
    for (const row of rows) {
      target.append(
        svg("line", {
          x1: 0,
          x2: data.totalWidth,
          y1: row.y + row.height,
          y2: row.y + row.height,
          class: "timeline-row-line",
          stroke: settings.rowLineColor,
        }),
      );
    }
  }
  const now = new Date();
  const today = data.visibleDates.findIndex(
    (date) => date.toDateString() === now.toDateString(),
  );
  if (today >= 0) {
    const x = today * data.scale.dayWidth;
    target.append(
      svg("line", { x1: x, x2: x, y1: 0, y2: height, class: "timeline-today" }),
    );
  }
}

function connectors(target, edges, positions, scope, connection) {
  for (const route of buildDependencyRoutes(edges, positions)) {
    target.append(
      svg("path", {
        d: route.geometry.path,
        class: `dependency-line${route.isCritical ? " dependency-line--critical" : ""}`,
        "data-from-task-id": route.fromTaskId,
        "data-to-task-id": route.toTaskId,
        "data-route": route.geometry.route,
        "marker-end": `url(#${scope}-arrow-${route.isCritical ? "critical" : "normal"})`,
        "stroke-dasharray": "none",
        "vector-effect": "non-scaling-stroke",
      }),
    );
  }
  if (!connection) return;
  const from = positions.find(
    (position) => position.taskId === connection.fromTaskId,
  );
  if (!from) return;
  const targetPosition = connection.targetTaskId
    ? positions.find((position) => position.taskId === connection.targetTaskId)
    : null;
  const geometry = targetPosition
    ? routeDependency(from, targetPosition)
    : {
        path: `M ${from.x + from.width} ${from.y + from.height / 2} H ${connection.pointerX} V ${connection.pointerY}`,
      };
  target.append(
    svg("path", {
      d: geometry.path,
      class: "dependency-line dependency-line--preview",
      "data-connection-preview": "true",
      "data-connection-target": connection.targetTaskId ?? "",
      "marker-end": `url(#${scope}-arrow-normal)`,
      "stroke-dasharray": "5 4",
      "vector-effect": "non-scaling-stroke",
    }),
  );
}

function bar(target, task, pos, state) {
  const selected = task.id === state.selectedTaskId;
  const hovered = task.id === state.hoveredTaskId;
  const preview = state.previewTaskIds?.has(task.id);
  const group = svg("g", {
    class: `gantt-task${preview ? " gantt-preview" : ""}`,
    "data-task-id": task.id,
    tabindex: 0,
    role: "button",
    "aria-label": `${task.name}, ${task.startDate.toLocaleDateString()} to ${task.endDate.toLocaleDateString()}`,
  });
  if (selected || hovered)
    group.append(
      svg("rect", {
        x: pos.x - 2,
        y: pos.y - 2,
        width: pos.width + 4,
        height: BAR_HEIGHT + 4,
        rx: 4,
        class: "gantt-task__selection",
      }),
    );
  const critical =
    state.showCriticalPath &&
    (state.criticalTaskIds?.has(task.id) ||
      task.critical ||
      task.isCriticalPath);
  group.append(
    svg("rect", {
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: BAR_HEIGHT,
      rx: 2,
      class: `gantt-bar gantt-bar--${critical ? "critical" : safeStatus(task.status)}`,
      "data-interaction-mode": "move",
    }),
  );
  if (task.progress > 0 && task.progress < 100)
    group.append(
      svg("rect", {
        x: pos.x,
        y: pos.y + BAR_HEIGHT - 3,
        width: pos.width * (task.progress / 100),
        height: 3,
        rx: 1.5,
        class: "gantt-bar__progress",
      }),
    );
  if (pos.width > 80) {
    const max = Math.max(3, Math.floor(pos.width / 8));
    group.append(
      svgText(
        task.name.length > max ? `${task.name.slice(0, max - 1)}…` : task.name,
        { x: pos.x + 6, y: pos.y + 15, class: "gantt-bar__label" },
      ),
    );
  }
  if (task.isMilestone) {
    const x = pos.x + pos.width + 10;
    const y = pos.y + BAR_HEIGHT / 2;
    group.append(
      svg("polygon", {
        points: `${x},${y - 6} ${x + 6},${y} ${x},${y + 6} ${x - 6},${y}`,
        class: "gantt-milestone",
      }),
    );
  }
  if (selected) {
    group.append(
      svg("rect", {
        x: pos.x,
        y: pos.y,
        width: 10,
        height: BAR_HEIGHT,
        class: "gantt-bar__handle",
        "data-interaction-mode": "resize-start",
      }),
    );
    group.append(
      svg("rect", {
        x: pos.x + pos.width - 10,
        y: pos.y,
        width: 10,
        height: BAR_HEIGHT,
        class: "gantt-bar__handle",
        "data-interaction-mode": "resize-end",
      }),
    );
  }
  target.append(group);
}

export function renderTimeline(root, snapshot) {
  const left = root.scrollLeft;
  const top = root.scrollTop;
  const { rows, timelineData, positions, dependencies, tasks, state } =
    snapshot;
  const bodyHeight = Math.max(
    rows.reduce((height, row) => Math.max(height, row.y + row.height), 0),
    root.clientHeight - HEADER_HEIGHT + 240,
  );
  const stage = document.createElement("div");
  stage.className = "timeline-stage";
  stage.style.width = `${timelineData.totalWidth}px`;
  stage.style.minHeight = `${bodyHeight + HEADER_HEIGHT}px`;
  stage.append(header(timelineData));
  const body = svg("svg", {
    class: "timeline-svg",
    width: timelineData.totalWidth,
    height: bodyHeight,
    role: "img",
    "aria-label": "Task bars and dependencies",
  });
  const defs = svg("defs");
  markers(defs, state.markerScope);
  body.append(defs);
  grid(body, rows, timelineData, bodyHeight, snapshot.grid, state);
  connectors(
    body,
    dependencies,
    positions,
    state.markerScope,
    state.connection,
  );
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const pos of positions) {
    const task = byId.get(pos.taskId);
    if (task) bar(body, task, pos, state);
  }
  stage.append(body);
  root.replaceChildren(stage);
  root.scrollLeft = left;
  root.scrollTop = top;
}
