import { buildDependencyRoutes, routeDependency } from './dependencies.js';
import { BAR_HEIGHT, HEADER_HEIGHT } from './timeline.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (name, attrs = {}) => {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) element.setAttribute(key, String(value));
  }
  return element;
};
const svgText = (text, attrs) => {
  const element = svg('text', attrs);
  element.textContent = text;
  return element;
};
const safeStatus = (value) => ['todo', 'in-progress', 'done', 'blocked'].includes(value) ? value : 'todo';

export function renderTaskList(root, state, rows) {
  const fragment = document.createDocumentFragment();
  let groupNumber = 0;
  let taskNumber = 0;

  for (const row of rows) {
    const element = document.createElement(row.type === 'group-header' ? 'button' : 'div');
    if (row.type === 'group-header') element.type = 'button';

    if (row.type === 'group-header') {
      groupNumber += 1;
      taskNumber = 0;
      const expanded = state.expandedWorkstreams.has(row.group);
      element.className = 'task-group';
      element.dataset.action = 'workstream.toggle';
      element.dataset.workstreamId = row.group;
      element.setAttribute('aria-expanded', String(expanded));

      const index = document.createElement('span');
      index.className = 'task-group__index';
      index.textContent = String(groupNumber);
      const name = document.createElement('span');
      name.className = 'task-group__name';
      name.textContent = row.workstream.label;
      const chevron = document.createElement('span');
      chevron.className = 'task-group__chevron';
      chevron.textContent = expanded ? '⌄' : '›';
      element.append(index, name, chevron);
    } else {
      taskNumber += 1;
      const task = row.task;
      element.className = 'task-row';
      element.dataset.taskId = task.id;
      element.dataset.selected = String(state.selectedTaskId === task.id);
      element.dataset.hovered = String(state.hoveredTaskId === task.id);
      element.setAttribute('aria-label', `Task ${task.name}`);

      const index = document.createElement('span');
      index.className = 'task-row__index';
      index.textContent = `${groupNumber}.${taskNumber}`;
      const dot = document.createElement('span');
      dot.className = `task-row__status task-row__status--${safeStatus(task.status)}`;
      const name = document.createElement('input');
      name.className = 'task-row__name';
      name.type = 'text';
      name.value = `${task.isMilestone ? '◆ ' : ''}${task.name}`;
      name.dataset.action = 'task.rename';
      name.dataset.editTaskId = task.id;
      name.setAttribute('aria-label', `Task name ${task.name}`);
      const resource = document.createElement('span');
      resource.className = 'task-row__resource';
      resource.textContent = task.resource ?? task.assignee?.name ?? '—';
      const status = document.createElement('span');
      status.className = `task-row__status-label task-row__status-label--${safeStatus(task.status)}`;
      status.textContent = task.status ?? '';
      const meta = document.createElement('span');
      meta.className = 'task-row__meta';
      const links = task.dependencies.length + task.dependents.length;
      meta.textContent = links ? `⑂ ${links}` : '';
      element.append(index, dot, name, resource, status, meta);
    }
    fragment.append(element);
  }

  const createRow = document.createElement('div');
  createRow.className = 'task-create-row';
  const createInput = document.createElement('input');
  createInput.type = 'text';
  createInput.placeholder = 'Add task…';
  createInput.dataset.action = 'task.create';
  createInput.setAttribute('aria-label', 'Add task');
  createRow.append(createInput);
  fragment.append(createRow);
  root.replaceChildren(fragment);
}

function markers(defs, scope) {
  for (const [kind, color] of [['normal', '#5d85a7'], ['critical', '#bd4b3d']]) {
    const marker = svg('marker', { id: `${scope}-arrow-${kind}`, markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: 'auto', markerUnits: 'strokeWidth' });
    marker.append(svg('path', { d: 'M 0 0 L 8 4 L 0 8 z', fill: color }));
    defs.append(marker);
  }
}

function appendCalendarSegments(result, data, keyOf, labelOf, y, className) {
  let start = 0;
  for (let index = 0; index <= data.visibleDates.length; index += 1) {
    const current = index < data.visibleDates.length ? keyOf(data.visibleDates[index]) : null;
    const previous = start < data.visibleDates.length ? keyOf(data.visibleDates[start]) : null;
    if (index === data.visibleDates.length || current !== previous) {
      const width = (index - start) * data.scale.dayWidth;
      result.append(svgText(labelOf(data.visibleDates[start]), {
        x: start * data.scale.dayWidth + width / 2,
        y,
        class: `${className} timeline-segment-label`,
        'text-anchor': 'middle',
      }));
      start = index;
    }
  }
}

function header(data) {
  const result = svg('svg', { class: 'timeline-header', width: data.totalWidth, height: HEADER_HEIGHT, role: 'img', 'aria-label': `${data.scale.label} timeline calendar` });
  appendCalendarSegments(result, data, (date) => date.getFullYear(), (date) => String(date.getFullYear()), 13, 'timeline-year-label');
  appendCalendarSegments(result, data, (date) => `${date.getFullYear()}-${date.getMonth()}`, (date) => date.toLocaleDateString(undefined, { month: 'long' }), 36, 'timeline-month-label');

  data.visibleDates.forEach((date, index) => {
    const x = index * data.scale.dayWidth;
    result.append(svg('line', { x1: x, x2: x, y1: 42, y2: HEADER_HEIGHT, class: 'timeline-header-cell-line' }));
    result.append(svgText(date.toLocaleDateString(undefined, { day: '2-digit' }), {
      x: x + data.scale.dayWidth / 2,
      y: 59,
      class: 'timeline-label',
      'text-anchor': 'middle',
    }));
  });
  return result;
}

function grid(target, rows, data, height, settings) {
  for (const row of rows) {
    target.append(svg('rect', {
      x: 0,
      y: row.y,
      width: data.totalWidth,
      height: row.height,
      class: row.type === 'group-header' ? 'timeline-row--group' : 'timeline-row--task',
      fill: row.type === 'group-header' ? settings.groupFill : settings.taskFill,
    }));
  }

  if (settings.showVerticalLines) {
    data.visibleDates.forEach((date, index) => target.append(svg('line', {
      x1: index * data.scale.dayWidth,
      x2: index * data.scale.dayWidth,
      y1: 0,
      y2: height,
      class: date.getDay() === 1 && settings.showMajorLines ? 'timeline-week-line' : 'timeline-grid-line',
      stroke: date.getDay() === 1 && settings.showMajorLines ? settings.majorLineColor : settings.minorLineColor,
    })));
  }
  if (settings.showHorizontalLines) {
    target.append(svg('line', { x1: 0, x2: data.totalWidth, y1: 0, y2: 0, class: 'timeline-row-line', stroke: settings.rowLineColor }));
    for (const row of rows) {
      target.append(svg('line', { x1: 0, x2: data.totalWidth, y1: row.y + row.height, y2: row.y + row.height, class: 'timeline-row-line', stroke: settings.rowLineColor }));
    }
  }
  const now = new Date();
  const today = data.visibleDates.findIndex((date) => date.toDateString() === now.toDateString());
  if (today >= 0) {
    const x = today * data.scale.dayWidth;
    target.append(svg('line', { x1: x, x2: x, y1: 0, y2: height, class: 'timeline-today' }));
  }
}

function connectors(target, edges, positions, scope, connection) {
  for (const route of buildDependencyRoutes(edges, positions)) {
    target.append(svg('path', { d: route.geometry.path, class: `dependency-line${route.isCritical ? ' dependency-line--critical' : ''}`, 'data-from-task-id': route.fromTaskId, 'data-to-task-id': route.toTaskId, 'data-route': route.geometry.route, 'marker-end': `url(#${scope}-arrow-${route.isCritical ? 'critical' : 'normal'})`, 'stroke-dasharray': 'none', 'vector-effect': 'non-scaling-stroke' }));
  }
  if (!connection) return;
  const from = positions.find((position) => position.taskId === connection.fromTaskId);
  if (!from) return;
  const targetPosition = connection.targetTaskId ? positions.find((position) => position.taskId === connection.targetTaskId) : null;
  const geometry = targetPosition ? routeDependency(from, targetPosition) : { path: `M ${from.x + from.width} ${from.y + from.height / 2} H ${connection.pointerX} V ${connection.pointerY}` };
  target.append(svg('path', { d: geometry.path, class: 'dependency-line dependency-line--preview', 'data-connection-preview': 'true', 'data-connection-target': connection.targetTaskId ?? '', 'marker-end': `url(#${scope}-arrow-normal)`, 'stroke-dasharray': '5 4', 'vector-effect': 'non-scaling-stroke' }));
}

function bar(target, task, pos, state) {
  const selected = task.id === state.selectedTaskId;
  const hovered = task.id === state.hoveredTaskId;
  const preview = state.previewTaskIds?.has(task.id);
  const group = svg('g', { class: `gantt-task${preview ? ' gantt-preview' : ''}`, 'data-task-id': task.id, tabindex: 0, role: 'button', 'aria-label': `${task.name}, ${task.startDate.toLocaleDateString()} to ${task.endDate.toLocaleDateString()}` });
  if (selected || hovered) group.append(svg('rect', { x: pos.x - 2, y: pos.y - 2, width: pos.width + 4, height: BAR_HEIGHT + 4, rx: 4, class: 'gantt-task__selection' }));
  const critical = state.showCriticalPath && (state.criticalTaskIds?.has(task.id) || task.critical || task.isCriticalPath);
  group.append(svg('rect', { x: pos.x, y: pos.y, width: pos.width, height: BAR_HEIGHT, rx: 2, class: `gantt-bar gantt-bar--${critical ? 'critical' : safeStatus(task.status)}`, 'data-interaction-mode': 'move' }));
  if (task.progress > 0 && task.progress < 100) group.append(svg('rect', { x: pos.x, y: pos.y + BAR_HEIGHT - 3, width: pos.width * (task.progress / 100), height: 3, rx: 1.5, class: 'gantt-bar__progress' }));
  if (pos.width > 80) {
    const max = Math.max(3, Math.floor(pos.width / 8));
    group.append(svgText(task.name.length > max ? `${task.name.slice(0, max - 1)}…` : task.name, { x: pos.x + 6, y: pos.y + 15, class: 'gantt-bar__label' }));
  }
  if (task.isMilestone) {
    const x = pos.x + pos.width + 10;
    const y = pos.y + BAR_HEIGHT / 2;
    group.append(svg('polygon', { points: `${x},${y - 6} ${x + 6},${y} ${x},${y + 6} ${x - 6},${y}`, class: 'gantt-milestone' }));
  }
  if (selected) {
    group.append(svg('rect', { x: pos.x, y: pos.y, width: 10, height: BAR_HEIGHT, class: 'gantt-bar__handle', 'data-interaction-mode': 'resize-start' }));
    group.append(svg('rect', { x: pos.x + pos.width - 10, y: pos.y, width: 10, height: BAR_HEIGHT, class: 'gantt-bar__handle', 'data-interaction-mode': 'resize-end' }));
  }
  target.append(group);
}

export function renderTimeline(root, snapshot) {
  const left = root.scrollLeft;
  const top = root.scrollTop;
  const { rows, timelineData, positions, dependencies, tasks, state } = snapshot;
  const bodyHeight = Math.max(rows.reduce((height, row) => Math.max(height, row.y + row.height), 0), root.clientHeight - HEADER_HEIGHT + 240);
  const stage = document.createElement('div');
  stage.className = 'timeline-stage';
  stage.style.width = `${timelineData.totalWidth}px`;
  stage.style.minHeight = `${bodyHeight + HEADER_HEIGHT}px`;
  stage.append(header(timelineData));
  const body = svg('svg', { class: 'timeline-svg', width: timelineData.totalWidth, height: bodyHeight, role: 'img', 'aria-label': 'Task bars and dependencies' });
  const defs = svg('defs');
  markers(defs, state.markerScope);
  body.append(defs);
  grid(body, rows, timelineData, bodyHeight, snapshot.grid);
  connectors(body, dependencies, positions, state.markerScope, state.connection);
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
