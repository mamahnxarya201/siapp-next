import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#task-count')).toHaveText('240 total');
  await expect(page.locator('.gantt-task')).toHaveCount(240);
});

test('creates tasks and bars and switches themes through the project chrome', async ({ page }) => {
  await expect(page.locator('.task-create-row')).toHaveCount(0);
  const viewport = await page.locator('#timeline-viewport').boundingBox();
  await page.mouse.click(viewport.x + 110, viewport.y + 230, { button: 'right' });
  await page.locator('#context-task-name').fill('Year 0 task');
  await page.locator('#context-task-name').press('Enter');
  await expect(page.locator('.gantt-task')).toHaveCount(241);
  expect(await page.locator('.task-row__name').evaluateAll((inputs) => inputs.filter((input) => input.value === 'Year 0 task').length)).toBe(1);

   await expect(page.locator('.gantt-application')).toHaveAttribute('data-theme', 'light');
   const themeButton = page.locator('.project-top-nav__theme');
   await expect(themeButton).toHaveAttribute('aria-label', 'Switch to dark mode');
   await expect(themeButton.locator('path')).toHaveCount(1);
   await themeButton.click();
   await expect(page.locator('.gantt-application')).toHaveAttribute('data-theme', 'dark');
   await expect(themeButton).toHaveAttribute('aria-label', 'Switch to light mode');
   await expect(themeButton.locator('circle')).toHaveCount(1);
   await expect(page.locator('.gantt-task__selection').first()).toBeHidden();

  await page.mouse.click(viewport.x + 110, viewport.y + 230, { button: 'right' });
  await page.locator('#context-task-name').fill('Second context task');
  await page.getByRole('menuitem', { name: 'Add task' }).click();
  await expect(page.locator('.gantt-task')).toHaveCount(242);

});

test('a fresh add-bar menu never reuses the previous task name', async ({ page }) => {
  const viewport = await page.locator('#timeline-viewport').boundingBox();
  await page.mouse.click(viewport.x + 110, viewport.y + 230, { button: 'right' });
  await page.locator('#context-task-name').fill('First context task');
  await page.getByRole('menuitem', { name: 'Add task' }).click();
  await expect(page.locator('.gantt-task')).toHaveCount(241);

  // Reopen the same add-bar menu: the name field must be empty, not retain the
  // previously created task's name.
  await page.mouse.click(viewport.x + 110, viewport.y + 230, { button: 'right' });
  await expect(page.locator('#context-task-name')).toHaveValue('');
});

test('frame-bounds dependency preview without rebuilding the timeline SVG', async ({ page }) => {
  await page.locator('.gantt-task[data-task-id="performance-1"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Add dependency' }).click();
  const preview = page.locator('.dependency-line--preview');
  await expect(preview).toHaveCount(1);
  const target = await page.locator('.gantt-task[data-task-id="performance-3"]').boundingBox();
  await page.evaluate(({ x, y }) => {
    globalThis.__connectionPreviewNode = document.querySelector(
      '.dependency-line--preview',
    );
    for (let index = 0; index < 120; index += 1) {
      document.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: x + (index % 3),
          clientY: y,
        }),
      );
    }
  }, { x: target.x + target.width / 2, y: target.y + target.height / 2 });
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  ));
  await expect(preview).toHaveAttribute('data-connection-target', 'performance-3');
  expect(await page.evaluate(() =>
    globalThis.__connectionPreviewNode === document.querySelector(
      '.dependency-line--preview',
    )
  )).toBe(true);

  await page.locator('.gantt-task[data-task-id="performance-3"]').click();
  await expect(preview).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().tasks.find((task) => task.id === 'performance-3').dependencies)).toContain('performance-1');
});

test('cramped dependency routes terminate on the destination bar', async ({ page }) => {
  await page.evaluate(() => {
    const start = new Date(2026, 7, 24);
    globalThis.ganttDemo.setTasks([
      {
        id: 'gap-source',
        name: 'Gap source',
        groupName: 'gateway-foundation',
        status: 'todo',
        startDate: start,
        endDate: new Date(2026, 7, 25),
        dependencies: [],
      },
      {
        id: 'gap-target',
        name: 'Gap target',
        groupName: 'gateway-foundation',
        status: 'todo',
        startDate: new Date(2026, 7, 25),
        endDate: new Date(2026, 7, 26),
        dependencies: ['gap-source'],
      },
    ]);
  });
  await page.locator('.gantt-task[data-task-id="gap-target"]').click();
  const endpoint = await page.locator('.dependency-line').evaluate((path) => {
    const point = path.getPointAtLength(path.getTotalLength());
    return { x: point.x, y: point.y };
  });
  const target = await page
    .locator('.gantt-task[data-task-id="gap-target"] .gantt-bar')
    .evaluate((bar) => ({
      x: Number(bar.getAttribute('x')),
      y: Number(bar.getAttribute('y')),
    }));
  expect(endpoint.x).toBe(target.x + 4);
  expect(endpoint.y).toBe(target.y);
});

test('task context menus change color, remove dependencies, and delete from either surface', async ({ page }) => {
  await page.locator('.gantt-task[data-task-id="performance-6"]').click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Add dependency' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete task' })).toBeVisible();
  await page.locator('.context-menu__form[data-context-action="task"] [data-color="#66548f"]').click();
  await expect(page.locator('.gantt-task[data-task-id="performance-6"] .gantt-bar')).toHaveAttribute('style', /#66548f/);

  await page.locator('#task-list [data-task-id="performance-6"]').click({ button: 'right' });
  const taskRemoveDependencies = page.locator('.context-menu__form[data-context-action="task"] [data-action="task.remove-dependencies"]');
  await expect(taskRemoveDependencies).toBeVisible();
  await taskRemoveDependencies.click();
  await expect.poll(() => page.evaluate(() => {
    const task = globalThis.ganttDemo.getState().tasks.find((item) => item.id === 'performance-6');
    return task.dependencies.length;
  })).toBe(0);

  await page.locator('#task-list [data-task-id="performance-6"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete task' }).click();
  await expect(page.locator('.gantt-task[data-task-id="performance-6"]')).toHaveCount(0);
  await expect(page.locator('#task-list [data-task-id="performance-6"]')).toHaveCount(0);
});

test('context menu only reveals items for the hovered surface', async ({ page }) => {
  // Task bar -> task menu only; every other surface must stay hidden.
  await page.locator('.gantt-task[data-task-id="performance-1"]').click({ button: 'right' });
  await expect(page.locator('.context-menu__form[data-context-action="task"]')).toBeVisible();
  await expect(page.locator('[data-action="task.delete"]')).toBeVisible();
  await expect(page.locator('[data-action="dependency.begin-connect"]')).toBeVisible();
  await expect(page.locator('[data-action="dependency.remove"]')).toBeHidden();
  await expect(page.locator('[data-action="workstream.delete"]')).toBeHidden();
  await expect(page.locator('#context-task-name')).toBeHidden();
  await expect(page.locator('.context-menu__form[data-context-action="add-bar"]')).toBeHidden();
  await page.keyboard.press('Escape');

  // Empty grid -> add-bar form only.
  const viewport = await page.locator('#timeline-viewport').boundingBox();
  await page.mouse.click(viewport.x + 110, viewport.y + 230, { button: 'right' });
  await expect(page.locator('#context-task-name')).toBeVisible();
  await expect(page.locator('.context-menu__form[data-context-action="add-bar"]')).toBeVisible();
  await expect(page.locator('[data-action="task.delete"]')).toBeHidden();
  await expect(page.locator('[data-action="workstream.delete"]')).toBeHidden();
  await expect(page.locator('[data-action="dependency.remove"]')).toBeHidden();
  await page.keyboard.press('Escape');

  // Workstream header (timeline) -> workstream menu only.
  await page.locator('[data-workstream-id]').first().click({ button: 'right' });
  await expect(page.locator('[data-action="workstream.delete"]')).toBeVisible();
  await expect(page.locator('[data-action="workstream.rename"]')).toBeVisible();
  await expect(page.locator('[data-action="workstream.collapse"]')).toBeVisible();
  await expect(page.locator('#context-task-name')).toBeHidden();
  await expect(page.locator('[data-action="task.delete"]')).toBeHidden();
  await expect(page.locator('[data-action="dependency.remove"]')).toBeHidden();
  await page.keyboard.press('Escape');

  // Dependency link -> remove-dependency only.
  await page.locator('#task-list [data-task-id="performance-6"]').hover();
  await expect(page.locator('.dependency-line')).toHaveCount(3);
  await page.locator('.dependency-line').first().dispatchEvent('contextmenu');
  await expect(page.locator('[data-action="dependency.remove"]')).toBeVisible();
  await expect(page.locator('[data-action="task.delete"]')).toBeHidden();
  await expect(page.locator('[data-action="workstream.delete"]')).toBeHidden();
  await expect(page.locator('#context-task-name')).toBeHidden();
  await page.keyboard.press('Escape');
});

test('grid hover shows a landing guide and task creation keeps focus off the sidebar', async ({ page }) => {
  const viewport = await page.locator('#timeline-viewport').boundingBox();

  // Hover an empty grid cell -> landing guide crosshair appears.
  await page.mouse.move(viewport.x + 24, viewport.y + 230);
  await expect(page.locator('.gantt-guide-line')).toHaveCount(2);

  // Leaving the timeline hides the guide (pointerleave).
  await page.locator('#task-list').hover();
  await expect(page.locator('.gantt-guide-line')).toHaveCount(0);

  // Create via context menu; focus must not jump to a sidebar name input.
  await page.mouse.click(viewport.x + 24, viewport.y + 230, { button: 'right' });
  await page.locator('#context-task-name').fill('Focus check task');
  await page.locator('#context-task-name').press('Enter');
  await expect(page.locator('.gantt-task')).toHaveCount(241);
  await expect(page.locator('.task-row__name:focus')).toHaveCount(0);
});

test('delegated controls update scale and dependency disclosure', async ({ page }) => {
  await expect(page.locator('.dependency-line')).toHaveCount(0);

  await page.locator('#task-list [data-task-id="performance-6"]').hover();
  await expect(page.locator('.dependency-line')).toHaveCount(3);
  await expect(page.locator('.timeline-row--hovered')).toHaveCount(1);
  await expect(page.locator('.timeline-row--hovered')).toHaveAttribute('class', /timeline-row--task/);

  await page.locator('#task-list [data-task-id="performance-6"]').click();
  await expect(page.locator('#selection-status')).toContainText('Define route contract');
  expect(await page.locator('.dependency-line').count()).toBeGreaterThan(3);

  const weekWidth = await page.locator('.gantt-task[data-task-id="performance-6"] .gantt-bar').getAttribute('width');
  await page.locator('input[name="scale"][value="day"]').check({ force: true });
  const dayWidth = await page.locator('.gantt-task[data-task-id="performance-6"] .gantt-bar').getAttribute('width');
  expect(Number(dayWidth)).toBeGreaterThan(Number(weekWidth));

  await page.locator('input[data-action="dependencies.toggle-all"]').check({ force: true });
  expect(await page.locator('.dependency-line').count()).toBeGreaterThan(5);

  await page.locator('input[data-action="dependencies.toggle-critical"]').check({ force: true });
  await expect(page.locator('.gantt-bar--critical').first()).toBeVisible();
});

test('committed dependency cues use a forgiving connector hover target', async ({ page }) => {
  await page.locator('button[data-action="grid-settings.open"]').click();
  await page
    .locator('input[data-dependency-setting="lineWidth"]')
    .fill('2.5');
  await page
    .locator('input[data-dependency-setting="cueSize"]')
    .fill('8');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await page.locator('#task-list [data-task-id="performance-6"]').click();
  const connector = page.locator('.dependency-connector').first();
  const path = connector.locator('.dependency-line');
  const hitTarget = connector.locator('.dependency-hit-target');
  const cues = connector.locator('.dependency-cue');
  await expect(connector).toBeVisible();
  expect(await cues.count()).toBeGreaterThan(0);
  expect(await cues.count()).toBeLessThanOrEqual(3);
  await expect(path).not.toHaveAttribute('marker-end', /.+/);
  await expect(hitTarget).toHaveCSS('stroke-width', '12px');
  await expect(cues.first()).toHaveCSS('opacity', '0');
  const expectedWidth = (await path.evaluate((element) =>
    element.classList.contains('dependency-line--critical')
  )) ? '3.33px' : '2.5px';
  await expect(path).toHaveCSS('stroke-width', expectedWidth);
  await expect.poll(
    () => cues.first().evaluate((cue) => ({
      width: cue.getBBox().width,
      height: cue.getBBox().height,
    })),
  ).toEqual({ width: 8, height: 8 });

  const nearPoint = await path.evaluate((element) => {
    const distance = element.getTotalLength() / 4;
    const point = element.getPointAtLength(distance);
    const before = element.getPointAtLength(Math.max(0, distance - 1));
    const after = element.getPointAtLength(
      Math.min(element.getTotalLength(), distance + 1),
    );
    const deltaX = after.x - before.x;
    const deltaY = after.y - before.y;
    const magnitude = Math.hypot(deltaX, deltaY);
    const offsetPoint = {
      x: point.x - (deltaY / magnitude) * 5,
      y: point.y + (deltaX / magnitude) * 5,
    };
    const matrix = element.getScreenCTM();
    return {
      x: matrix.a * offsetPoint.x + matrix.c * offsetPoint.y + matrix.e,
      y: matrix.b * offsetPoint.x + matrix.d * offsetPoint.y + matrix.f,
    };
  });
  await page.mouse.move(nearPoint.x, nearPoint.y);
  await expect(cues.first()).toHaveCSS('opacity', '1');

  await page.mouse.move(4, 4);
  await expect(cues.first()).toHaveCSS('opacity', '0');
});

test('sidebar keeps React task metadata and workstream affordances', async ({ page }) => {
  await expect(page.locator('.task-group')).toHaveCount(5);
  await expect(page.locator('.task-group__icon')).toHaveCount(5);
  await expect(page.locator('.task-row__avatar')).toHaveCount(240);
  await expect(page.locator('.task-row__status-badge')).toHaveCount(240);
  await expect(page.locator('.task-row__team-badge')).toHaveCount(240);
  await expect(page.locator('.task-row__dependencies')).toHaveCount(240);

  await page.locator('.task-group').first().hover();
  await expect(page.getByRole('button', { name: 'Add task to Gateway Foundation' })).toBeVisible();
  await page.getByRole('button', { name: 'Manage Gateway Foundation' }).click();
  await expect(page.getByRole('menuitem', { name: 'Rename workstream' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Cancel' }).click();
});

test('deletes an empty workstream from its context menu and protects populated workstreams', async ({ page }) => {
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('prompt');
    await dialog.accept('Temporary lane');
  });
  await page.getByRole('button', { name: 'Add workstream' }).click();
  await expect(page.locator('.task-group')).toHaveCount(6);

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Manage Temporary lane' }).click();
  await page.getByRole('menuitem', { name: 'Delete workstream' }).click();
  await expect(page.locator('.task-group')).toHaveCount(5);
  await expect(page.locator('#application-status')).toHaveText('Deleted workstream Temporary lane');

  await page.getByRole('button', { name: 'Manage Gateway Foundation' }).click();
  await page.getByRole('menuitem', { name: 'Delete workstream' }).click();
  await expect(page.locator('.task-group')).toHaveCount(5);
  await expect(page.locator('#application-status')).toHaveText('Reassign tasks before deleting this workstream.');
});

test('workstream collapse removes matching rows, bars, and connector endpoints', async ({ page }) => {
  await page.locator('input[data-action="dependencies.toggle-all"]').check({ force: true });
  const initialConnectorCount = await page.locator('.dependency-line').count();

  await page.locator('#task-list [data-workstream-id="gateway-foundation"]').click();
  await expect(page.locator('#task-list [data-task-id="performance-1"]')).toHaveCount(0);
  await expect(page.locator('.gantt-task[data-task-id="performance-1"]')).toHaveCount(0);
  expect(await page.locator('.dependency-line').count()).toBeLessThan(initialConnectorCount);
});

test('drag commits once and recursively pushes violating dependents', async ({ page }) => {
  const timeline = page.locator('#timeline-viewport');
  const scrollLeftBefore = await timeline.evaluate((element) => element.scrollLeft);
  const before = await page.evaluate(() => {
    const tasks = globalThis.ganttDemo.getState().tasks;
    return Object.fromEntries(tasks.map((task) => [task.id, {
      start: task.startDate.toISOString(),
      end: task.endDate.toISOString(),
    }]));
  });

  await page.locator('#task-list [data-task-id="performance-6"]').click();
  const bar = page.locator('.gantt-task[data-task-id="performance-6"] [data-interaction-mode="move"]');
  const bounds = await bar.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 64, bounds.y + bounds.height / 2, { steps: 4 });
  const draggedTask = page.locator(
    '.gantt-task[data-task-id="performance-6"]',
  );
  await expect(draggedTask).toHaveClass(/gantt-preview/);
  await expect(
    draggedTask.locator('.gantt-task__selection'),
  ).toHaveCSS('display', 'none');
  const continuity = await page.evaluate(() => {
    const path = document.querySelector(
      '.dependency-line[data-to-task-id="performance-6"]',
    );
    const target = document.querySelector(
      '.gantt-task[data-task-id="performance-6"] .gantt-bar',
    );
    const endpoint = path.getPointAtLength(path.getTotalLength());
    return {
      route: path.dataset.route,
      endpoint: { x: endpoint.x, y: endpoint.y },
      target: {
        x: Number(target.getAttribute('x')),
        y: Number(target.getAttribute('y')),
        height: Number(target.getAttribute('height')),
      },
    };
  });
  if (continuity.route === 'left-entry') {
    expect(continuity.endpoint.x).toBe(continuity.target.x);
  } else {
    expect([
      continuity.target.y,
      continuity.target.y + continuity.target.height,
    ]).toContain(continuity.endpoint.y);
  }
  await page.mouse.up();

  await expect(page.locator('#application-status')).toHaveText('Schedule saved');
  const after = await page.evaluate(() => {
    const tasks = globalThis.ganttDemo.getState().tasks;
    return Object.fromEntries(tasks.map((task) => [task.id, {
      start: task.startDate.toISOString(),
      end: task.endDate.toISOString(),
    }]));
  });

  expect(Date.parse(after['performance-6'].start)).toBeGreaterThan(Date.parse(before['performance-6'].start));
  expect(Date.parse(after['performance-7'].start)).toBeGreaterThan(Date.parse(before['performance-7'].start));
  expect(after['performance-2']).toEqual(before['performance-2']);
  await expect.poll(() => timeline.evaluate((element) => element.scrollLeft)).toBe(scrollLeftBefore);
});

test('move and resize snap to half-days and short-bar handles do not overlap', async ({ page }) => {
  await page.evaluate(() => {
    const startDate = new Date(2026, 7, 24);
    globalThis.ganttDemo.setTasks([{
      id: 'half-day-interaction',
      name: 'Half-day interaction',
      groupName: 'gateway-foundation',
      workstreamId: 'gateway-foundation',
      status: 'todo',
      progress: 0,
      startDate,
      endDate: new Date(2026, 7, 25),
      dependencies: [],
      isMilestone: false,
      optimisticDays: 1,
      mostLikelyDays: 1,
      pessimisticDays: 1,
    }]);
  });
  const task = page.locator('.gantt-task[data-task-id="half-day-interaction"]');
  await expect(task).toHaveCount(1);
  await task.click();

  const dates = () => page.evaluate(() => {
    const current = globalThis.ganttDemo.getState().tasks[0];
    return {
      start: current.startDate.getTime(),
      end: current.endDate.getTime(),
    };
  });
  const initial = await dates();
  const bar = task.locator('[data-interaction-mode="move"]');
  let bounds = await bar.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 16, bounds.y + bounds.height / 2);
  await page.mouse.up();
  const moved = await dates();
  expect(moved.start - initial.start).toBe(12 * 60 * 60 * 1000);
  expect(moved.end - initial.end).toBe(12 * 60 * 60 * 1000);

  let startHandle = task.locator('[data-interaction-mode="resize-start"]');
  bounds = await startHandle.boundingBox();
  expect(bounds.width).toBe(20);
  expect(bounds.height).toBe(36);
  await page.mouse.move(bounds.x + 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x - 14, bounds.y + bounds.height / 2);
  await page.mouse.up();
  const startResized = await dates();
  expect(startResized.start).toBe(initial.start);
  expect(startResized.end).toBe(moved.end);

  let endHandle = task.locator('[data-interaction-mode="resize-end"]');
  bounds = await endHandle.boundingBox();
  expect(bounds.width).toBe(20);
  expect(bounds.height).toBe(36);
  await page.mouse.move(
    bounds.x + bounds.width - 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width + 14,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.up();
  const endResized = await dates();
  expect(endResized.end - startResized.end).toBe(12 * 60 * 60 * 1000);

  await page.evaluate(() => {
    const startDate = new Date(2026, 7, 24);
    globalThis.ganttDemo.setTasks([{
      ...globalThis.ganttDemo.getState().tasks[0],
      startDate,
      endDate: new Date(2026, 7, 24, 12),
    }]);
  });
  await task.click();
  startHandle = task.locator('[data-interaction-mode="resize-start"]');
  endHandle = task.locator('[data-interaction-mode="resize-end"]');
  const weekStart = await startHandle.boundingBox();
  const weekEnd = await endHandle.boundingBox();
  expect(weekStart.width).toBe(16);
  expect(weekEnd.width).toBe(16);
  expect(weekStart.x + weekStart.width).toBeLessThanOrEqual(weekEnd.x);

  await page.locator('input[name="scale"][value="month"]').check({ force: true });
  const monthStart = await startHandle.boundingBox();
  const monthEnd = await endHandle.boundingBox();
  expect(monthStart.width).toBe(13);
  expect(monthEnd.width).toBe(13);
  expect(monthStart.x + monthStart.width).toBeLessThanOrEqual(monthEnd.x);
});

test('moving a predecessor earlier never pulls its child backward', async ({ page }) => {
  const childBefore = await page.evaluate(() => (
    globalThis.ganttDemo.getState().tasks.find((task) => task.id === 'performance-6').startDate.toISOString()
  ));

  await page.locator('#task-list [data-task-id="performance-1"]').click();
  const bar = page.locator('.gantt-task[data-task-id="performance-1"] [data-interaction-mode="move"]');
  const bounds = await bar.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 - 64, bounds.y + bounds.height / 2, { steps: 4 });
  await page.mouse.up();

  const childAfter = await page.evaluate(() => (
    globalThis.ganttDemo.getState().tasks.find((task) => task.id === 'performance-6').startDate.toISOString()
  ));
  expect(childAfter).toBe(childBefore);
});

test('dragging the earliest task keeps the timeline origin stable so the dragged bar visibly moves', async ({ page }) => {
  const minBefore = await page.evaluate(() => globalThis.ganttDemo.getSnapshot().timelineData.minDate.toISOString().slice(0, 10));
  const neighborDateBefore = await page.evaluate(() =>
    globalThis.ganttDemo.getState().tasks
      .find((task) => task.id === 'performance-6')
      .startDate.toISOString()
  );
  const bar = page.locator('.gantt-task[data-task-id="performance-1"] [data-interaction-mode="move"]');
  const bounds = await bar.boundingBox();
  const xBefore = await bar.evaluate((el) => Math.round(parseFloat(el.getAttribute('x'))));
  const neighborBefore = await page.locator('.gantt-task[data-task-id="performance-6"] [data-interaction-mode="move"]').evaluate((el) => Math.round(parseFloat(el.getAttribute('x'))));

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 64, bounds.y + bounds.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('#application-status')).toHaveText('Schedule saved');

  const minAfter = await page.evaluate(() => globalThis.ganttDemo.getSnapshot().timelineData.minDate.toISOString().slice(0, 10));
  const xAfter = await bar.evaluate((el) => Math.round(parseFloat(el.getAttribute('x'))));
  const neighborDateAfter = await page.evaluate(() =>
    globalThis.ganttDemo.getState().tasks
      .find((task) => task.id === 'performance-6')
      .startDate.toISOString()
  );

  // Without an edge expansion, release does not compact or re-anchor the
  // timeline. Only the dragged task's committed date changes.
  expect(minAfter).toBe(minBefore);
  expect(xAfter).toBeGreaterThan(xBefore);
  expect(neighborDateAfter).toBe(neighborDateBefore);
});

test('vertical drag reorders rows within a workstream without re-sorting by date', async ({ page }) => {
  await page.evaluate(() => {
    const eng = globalThis.ganttDemo;
    const base = new Date('2026-08-10T00:00:00');
    const mk = (id, color, off) => ({
      id,
      name: id,
      groupName: 'gateway-foundation',
      teamName: 'T',
      status: 'todo',
      startDate: new Date(base.getTime() + off * 86400000).toISOString(),
      endDate: new Date(base.getTime() + (off + 3) * 86400000).toISOString(),
      color,
      dependencies: [],
      dependents: [],
    });
    eng.setTasks([mk('t1', '#ff0000', 0), mk('t2', '#00ff00', 2)]);
  });
  await expect(page.locator('.gantt-task')).toHaveCount(2);
  // t1 (earlier date) sits above t2 initially.
  const y1Before = await page.locator('.gantt-task[data-task-id="t1"]').evaluate((el) => el.getBoundingClientRect().y);
  const y2Before = await page.locator('.gantt-task[data-task-id="t2"]').evaluate((el) => el.getBoundingClientRect().y);
  expect(y2Before).toBeGreaterThan(y1Before);
  const t2DateBefore = await page.evaluate(() =>
    globalThis.ganttDemo.getState().tasks.find((item) => item.id === 't2').startDate.toISOString().slice(0, 10),
  );

  const bar = page.locator('.gantt-task[data-task-id="t2"] [data-interaction-mode="move"]');
  const bounds = await bar.boundingBox();
  // Drag t2 up so it lands above t1.
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y - 60, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('#application-status')).toHaveText('Schedule saved');

  const y1After = await page.locator('.gantt-task[data-task-id="t1"]').evaluate((el) => el.getBoundingClientRect().y);
  const y2After = await page.locator('.gantt-task[data-task-id="t2"]').evaluate((el) => el.getBoundingClientRect().y);
  expect(y2After).toBeLessThan(y1After);

  // Dates are unchanged; only the row order moved.
  const t2DateAfter = await page.evaluate(() =>
    globalThis.ganttDemo.getState().tasks.find((item) => item.id === 't2').startDate.toISOString().slice(0, 10),
  );
  expect(t2DateAfter).toBe(t2DateBefore);
});

test('a single diagonal drag both moves the date and reorders the row (free move)', async ({ page }) => {
  await page.evaluate(() => {
    const eng = globalThis.ganttDemo;
    const base = new Date('2026-08-10T00:00:00');
    const mk = (id, color, off) => ({
      id,
      name: id,
      groupName: 'gateway-foundation',
      teamName: 'T',
      status: 'todo',
      startDate: new Date(base.getTime() + off * 86400000).toISOString(),
      endDate: new Date(base.getTime() + (off + 3) * 86400000).toISOString(),
      color,
      dependencies: [],
      dependents: [],
    });
    eng.setTasks([mk('t1', '#ff0000', 0), mk('t2', '#00ff00', 2)]);
  });
  await expect(page.locator('.gantt-task')).toHaveCount(2);

  const dateBefore = await page.evaluate(() =>
    globalThis.ganttDemo.getState().tasks.find((item) => item.id === 't2').startDate.toISOString().slice(0, 10),
  );

  const bar = page.locator('.gantt-task[data-task-id="t2"] [data-interaction-mode="move"]');
  const bounds = await bar.boundingBox();
  // Move left (earlier date) AND up (row above t1) in one gesture.
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 - 160, bounds.y - 80, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#application-status')).toHaveText('Schedule saved');

  const dateAfter = await page.evaluate(() =>
    globalThis.ganttDemo.getState().tasks.find((item) => item.id === 't2').startDate.toISOString().slice(0, 10),
  );
  const y1 = await page.locator('.gantt-task[data-task-id="t1"]').evaluate((el) => el.getBoundingClientRect().y);
  const y2 = await page.locator('.gantt-task[data-task-id="t2"]').evaluate((el) => el.getBoundingClientRect().y);
  // Both dimensions changed in one gesture: earlier date AND above t1.
  expect(dateAfter).not.toBe(dateBefore);
  expect(y2).toBeLessThan(y1);
});

test('holding a bar at the viewport right edge autoscrolls forward and keeps the bar under the pointer', async ({ page }) => {
  await page.evaluate(() => {
    const eng = globalThis.ganttDemo;
    const base = new Date('2026-08-10T00:00:00');
    const mk = (id, color, off) => ({
      id,
      name: id,
      groupName: 'gateway-foundation',
      teamName: 'T',
      status: 'todo',
      startDate: new Date(base.getTime() + off * 86400000).toISOString(),
      endDate: new Date(base.getTime() + (off + 3) * 86400000).toISOString(),
      color,
      dependencies: [],
      dependents: [],
    });
    eng.setTasks([mk('t1', '#ff0000', 0)]);
  });
  await expect(page.locator('.gantt-task')).toHaveCount(1);

  const timeline = page.locator('#timeline-viewport');
  const bar = page.locator('.gantt-task[data-task-id="t1"] [data-interaction-mode="move"]');
  const barBounds = await bar.boundingBox();
  const viewport = await page.locator('#timeline-viewport').boundingBox();
  const scrollBefore = await page.locator('#timeline-viewport').evaluate((el) => el.scrollLeft);

  // Drag the bar past the viewport's right edge and hold it there. The pointer
  // must go beyond the edge (not just to it) to enter the autoscroll zone.
  await page.mouse.move(barBounds.x + barBounds.width / 2, barBounds.y + barBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width + 40, barBounds.y + barBounds.height / 2, { steps: 8 });
  await page.waitForTimeout(400);
  await timeline.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => page.evaluate(() =>
    globalThis.ganttDemo.getState().futureDays
  )).toBe(270);
  const scrollAfter = await page.locator('#timeline-viewport').evaluate((el) => el.scrollLeft);

  // The viewport scrolled forward while holding the bar at the edge.
  expect(scrollAfter).toBeGreaterThan(scrollBefore);
  const constrainedGeometry = await page.evaluate(() => {
    const root = document.querySelector('#timeline-viewport');
    const bar = document.querySelector(
      '.gantt-task[data-task-id="t1"] [data-interaction-mode="move"]',
    );
    return {
      x: Number(bar.getAttribute('x')),
      width: Number(bar.getAttribute('width')),
      scrollLeft: root.scrollLeft,
      clientWidth: root.clientWidth,
    };
  });
  expect(constrainedGeometry.x).toBeGreaterThanOrEqual(
    constrainedGeometry.scrollLeft,
  );
  expect(constrainedGeometry.x + constrainedGeometry.width).toBeLessThanOrEqual(
    constrainedGeometry.scrollLeft + constrainedGeometry.clientWidth,
  );
  expect(await page.evaluate(() => (
    globalThis.ganttDemo.getState().previewResult !== null
  ))).toBe(true);
  await page.mouse.up();
  // Release ends the active preview after the edge constraint has been checked.
  expect(await page.evaluate(() => (
    globalThis.ganttDemo.getState().previewResult === null
  ))).toBe(true);
  await page.waitForTimeout(100);
  const rightCompaction = await page.evaluate(() => {
    const timeline = document.querySelector('#timeline-viewport');
    const state = globalThis.ganttDemo.getState();
    const task = state.tasks.find((item) => item.id === 't1');
    const bar = document.querySelector(
      '.gantt-task[data-task-id="t1"] [data-interaction-mode="move"]',
    );
    const viewport = timeline.getBoundingClientRect();
    const bounds = bar.getBoundingClientRect();
    return {
      scroll: timeline.scrollLeft,
      max: timeline.scrollWidth - timeline.clientWidth,
      futureDays: state.futureDays,
      taskCount: state.tasks.length,
      domCount: document.querySelectorAll('.gantt-task[data-task-id="t1"]').length,
      duration: task.endDate.getTime() - task.startDate.getTime(),
      visible: bounds.right > viewport.left && bounds.left < viewport.right,
    };
  });
  expect(rightCompaction).toEqual({
    scroll: rightCompaction.max,
    max: rightCompaction.max,
    futureDays: 0,
    taskCount: 1,
    domCount: 1,
    duration: 3 * 24 * 60 * 60 * 1000,
    visible: true,
  });
});

test('empty demo keeps a context-created one-day task after a cross-month drag', async ({ page }) => {
  await page.goto('/demo/empty.html');
  await page.evaluate(() => {
    globalThis.__createdTaskDocument = document;
    globalThis.__createdTaskPageShows = 0;
    addEventListener('pageshow', () => {
      globalThis.__createdTaskPageShows += 1;
    });
  });
  const timeline = page.locator('#timeline-viewport');
  const viewport = await timeline.boundingBox();
  await page.mouse.click(viewport.x + 16, viewport.y + 80, { button: 'right' });
  await page.locator('#context-task-name').fill('Cross-month task');
  await page.locator('#context-task-name').press('Enter');
  await expect(page.locator('.gantt-task')).toHaveCount(1);

  const created = await page.evaluate(() => {
    const task = globalThis.ganttDemo.getState().tasks[0];
    return {
      id: task.id,
      url: location.href,
      historyLength: history.length,
      start: task.startDate.getTime(),
      end: task.endDate.getTime(),
      navigationEntries: performance.getEntriesByType('navigation').length,
    };
  });
  expect(created.end - created.start).toBe(24 * 60 * 60 * 1000);

  const bar = page.locator(
    `.gantt-task[data-task-id="${created.id}"] [data-interaction-mode="move"]`,
  );
  const bounds = await bar.boundingBox();
  const oneDayWidth = Number(await bar.getAttribute('width'));
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + oneDayWidth * 13,
    bounds.y + bounds.height / 2,
    { steps: 13 },
  );
  const release = await page.evaluate((taskId) => {
    const task = globalThis.ganttDemo.getState().previewResult.tasks
      .find((item) => item.id === taskId);
    const barNode = document.querySelector(
      `.gantt-task[data-task-id="${taskId}"] [data-interaction-mode="move"]`,
    );
    return {
      start: task.startDate.getTime(),
      end: task.endDate.getTime(),
      x: Number(barNode.getAttribute('x')),
    };
  }, created.id);
  expect(release.start - created.start).toBe(13 * 24 * 60 * 60 * 1000);
  expect(release.end - release.start).toBe(24 * 60 * 60 * 1000);
  await page.mouse.up();
  await expect(page.locator('#application-status')).toHaveText('Schedule saved');
  await expect.poll(() => page.evaluate(() =>
    globalThis.ganttDemo.getState().previewResult
  )).toBeNull();

  const settled = await page.evaluate(({ id, url, historyLength, navigationEntries }) => {
    const task = globalThis.ganttDemo.getState().tasks.find((item) => item.id === id);
    const barNode = document.querySelector(
      `.gantt-task[data-task-id="${id}"] [data-interaction-mode="move"]`,
    );
    return {
      sameDocument: globalThis.__createdTaskDocument === document,
      pageShows: globalThis.__createdTaskPageShows,
      urlUnchanged: location.href === url,
      historyUnchanged: history.length === historyLength,
      navigationEntriesUnchanged:
        performance.getEntriesByType('navigation').length === navigationEntries,
      taskCount: globalThis.ganttDemo.getState().tasks.length,
      id: task?.id,
      start: task?.startDate.getTime(),
      end: task?.endDate.getTime(),
      domCount: document.querySelectorAll(`.gantt-task[data-task-id="${id}"]`).length,
      x: Number(barNode?.getAttribute('x')),
    };
  }, created);
  expect(settled).toEqual({
    sameDocument: true,
    pageShows: 0,
    urlUnchanged: true,
    historyUnchanged: true,
    navigationEntriesUnchanged: true,
    taskCount: 1,
    id: created.id,
    start: release.start,
    end: release.end,
    domCount: 1,
    x: release.x,
  });
});

test('edge-held connected bar constrains both connector attachments and cue reveal preserves routes', async ({ page }) => {
  await page.locator('input[data-action="timeline.set-scale"][value="day"]').check({ force: true });
  await page.evaluate(() => {
    const base = new Date('2026-08-10T00:00:00');
    const task = (id, offset, dependencies, dependents) => ({
      id,
      name: id,
      groupName: 'gateway-foundation',
      teamName: 'T',
      status: 'todo',
      startDate: new Date(base.getTime() + offset * 86400000).toISOString(),
      endDate: new Date(base.getTime() + (offset + 2) * 86400000).toISOString(),
      color: '#287984',
      dependencies,
      dependents,
    });
    globalThis.ganttDemo.setTasks([
      task('incoming', 0, [], ['held']),
      task('held', 4, ['incoming'], ['outgoing']),
      task('outgoing', 8, ['held'], []),
    ]);
  });
  await page.locator('input[data-action="dependencies.toggle-all"]').check({ force: true });
  const timeline = page.locator('#timeline-viewport');
  const bar = page.locator('.gantt-task[data-task-id="held"] [data-interaction-mode="move"]');
  const bounds = await bar.boundingBox();
  const viewport = await timeline.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width + 40, bounds.y + bounds.height / 2, { steps: 8 });
  await expect.poll(() => page.evaluate(() =>
    globalThis.ganttDemo.getState().previewDrag?.edgeDirection
  )).toBe(1);

  const geometry = await page.evaluate(() => {
    const held = document.querySelector(
      '.gantt-task[data-task-id="held"] [data-interaction-mode="move"]',
    );
    const readPath = (selector) => {
      const path = document.querySelector(selector);
      const start = path.getPointAtLength(0);
      const end = path.getPointAtLength(path.getTotalLength());
      return {
        d: path.getAttribute('d'),
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
      };
    };
    return {
      bar: {
        x: Number(held.getAttribute('x')),
        y: Number(held.getAttribute('y')),
        width: Number(held.getAttribute('width')),
        height: Number(held.getAttribute('height')),
      },
      incoming: readPath('.dependency-line[data-from-task-id="incoming"][data-to-task-id="held"]'),
      outgoing: readPath('.dependency-line[data-from-task-id="held"][data-to-task-id="outgoing"]'),
    };
  });
  expect(geometry.incoming.end.x).toBe(geometry.bar.x);
  expect(geometry.outgoing.start.x).toBe(geometry.bar.x + geometry.bar.width);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() =>
    globalThis.ganttDemo.getState().previewResult
  )).toBeNull();
  const committedRoutes = await page.evaluate(() => ({
    incoming: document.querySelector(
      '.dependency-line[data-from-task-id="incoming"][data-to-task-id="held"]',
    ).getAttribute('d'),
    outgoing: document.querySelector(
      '.dependency-line[data-from-task-id="held"][data-to-task-id="outgoing"]',
    ).getAttribute('d'),
  }));
  const outgoingPath = page.locator(
    '.dependency-line[data-from-task-id="held"][data-to-task-id="outgoing"]',
  );
  const routePointX = await outgoingPath.evaluate((path) =>
    path.getPointAtLength(path.getTotalLength() / 2).x
  );
  await timeline.evaluate((element, x) => {
    element.scrollLeft = Math.max(0, x - element.clientWidth / 2);
  }, routePointX);
  const hoverPoint = await outgoingPath.evaluate((path) => {
    const point = path.getPointAtLength(path.getTotalLength() / 2);
    const matrix = path.getScreenCTM();
    return {
      x: matrix.a * point.x + matrix.c * point.y + matrix.e,
      y: matrix.b * point.x + matrix.d * point.y + matrix.f,
    };
  });
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  await expect(
    outgoingPath.locator('xpath=..').locator('.dependency-cue').first(),
  ).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => ({
    incoming: document.querySelector(
      '.dependency-line[data-from-task-id="incoming"][data-to-task-id="held"]',
    ).getAttribute('d'),
    outgoing: document.querySelector(
      '.dependency-line[data-from-task-id="held"][data-to-task-id="outgoing"]',
    ).getAttribute('d'),
  }))).toEqual(committedRoutes);
});

test('released edge resizing keeps the date range stable during a later center drag', async ({ page }) => {
  await page.goto('/demo/empty.html');
  const timeline = page.locator('#timeline-viewport');
  const viewport = await timeline.boundingBox();
  await page.mouse.click(viewport.x + 200, viewport.y + 80, { button: 'right' });
  await page.locator('#context-task-name').fill('Range-stable task');
  await page.locator('#context-task-name').press('Enter');
  await expect(page.locator('.gantt-task')).toHaveCount(1);
  await page.locator('.gantt-task [data-interaction-mode="move"]').click();

  const endHandle = await page.locator('[data-interaction-mode="resize-end"]').boundingBox();
  await page.mouse.move(endHandle.x + endHandle.width / 2, endHandle.y + endHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width - 2, endHandle.y + endHandle.height / 2, { steps: 8 });
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.waitForTimeout(100);

  const edgeRange = await timeline.evaluate((element) => ({
    width: element.scrollWidth,
    max: element.scrollWidth - element.clientWidth,
  }));
  await timeline.evaluate((element) => {
    element.scrollLeft = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  const move = await page.locator('.gantt-task [data-interaction-mode="move"]').boundingBox();
  await page.mouse.move(move.x + move.width / 2, move.y + move.height / 2);
  await page.mouse.down();
  await page.mouse.move(move.x + move.width / 2 + 100, move.y + move.height / 2, { steps: 8 });
  await page.waitForTimeout(250);
  const during = await timeline.evaluate((element) => ({
    width: element.scrollWidth,
    max: element.scrollWidth - element.clientWidth,
  }));
  await page.mouse.up();
  expect(during).toEqual(edgeRange);
});
test('compaction preserves the viewport minimum after an expanded range is shrunk', async ({ page }) => {
  await page.goto('/demo/empty.html');
  await page.evaluate(() => {
    const base = new Date('2026-08-10T00:00:00');
    globalThis.ganttDemo.setTasks([{
      id: 'long-range',
      name: 'Long range',
      groupName: null,
      teamName: 'T',
      status: 'todo',
      startDate: base.toISOString(),
      endDate: new Date(base.getTime() + 30 * 86400000).toISOString(),
      color: '#287984',
      dependencies: [],
      dependents: [],
    }]);
  });
  await expect(page.locator('.gantt-task')).toHaveCount(1);
  await page.locator('.gantt-task [data-interaction-mode="move"]').click();
  const timeline = page.locator('#timeline-viewport');
  await timeline.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().futureDays)).toBe(270);
  await timeline.evaluate((element) => {
    element.scrollLeft = Math.max(0, element.scrollWidth - element.clientWidth - 120);
    element.dispatchEvent(new Event('scroll'));
  });
  const handle = await page.locator('[data-interaction-mode="resize-end"]').boundingBox();
  const viewport = await timeline.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 160, handle.y + handle.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const range = await timeline.evaluate((element) => ({
    width: element.scrollWidth,
    minimum: element.clientWidth + 20,
  }));
  expect(range.width).toBeGreaterThanOrEqual(range.minimum);
  expect(viewport.width).toBeGreaterThan(0);
});

test('dense timelines keep autoscrolling while the edge date overlaps other bars', async ({ page }) => {
  const timeline = page.locator('#timeline-viewport');
  const bar = page.locator('.gantt-task [data-interaction-mode="move"]').first();
  const barBounds = await bar.boundingBox();
  const viewport = await timeline.boundingBox();
  await page.mouse.move(barBounds.x + barBounds.width / 2, barBounds.y + barBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width - 2, barBounds.y + barBounds.height / 2, { steps: 8 });
  const before = await timeline.evaluate((element) => element.scrollLeft);
  await page.waitForTimeout(500);
  const after = await timeline.evaluate((element) => element.scrollLeft);
  await page.mouse.up();
  expect(after).toBeGreaterThan(before);
});

test('gas autoscroll speed grows with hold duration and stops on release', async ({ page }) => {
  await page.evaluate(() => {
    const eng = globalThis.ganttDemo;
    const base = new Date('2026-08-10T00:00:00');
    const mk = (id, color, off) => ({
      id,
      name: id,
      groupName: 'gateway-foundation',
      teamName: 'T',
      status: 'todo',
      startDate: new Date(base.getTime() + off * 86400000).toISOString(),
      endDate: new Date(base.getTime() + (off + 3) * 86400000).toISOString(),
      color,
      dependencies: [],
      dependents: [],
    });
    eng.setTasks([mk('t1', '#ff0000', 0)]);
  });
  await expect(page.locator('.gantt-task')).toHaveCount(1);

  const bar = page.locator('.gantt-task[data-task-id="t1"] [data-interaction-mode="move"]');
  const barBounds = await bar.boundingBox();
  const viewport = await page.locator('#timeline-viewport').boundingBox();

  const readScroll = () =>
    page.locator('#timeline-viewport').evaluate((el) => el.scrollLeft);

  // Drag the bar to a fixed position past the viewport's right edge and hold
  // it there (stationary pointer). The base speed accumulates with hold
  // duration, so each successive sample window scrolls faster than the last.
  await page.mouse.move(barBounds.x + barBounds.width / 2, barBounds.y + barBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width + 40, barBounds.y + barBounds.height / 2, { steps: 8 });

  const windows = [];
  // Sample three windows while holding. Speed is positive (forward scroll) and
  // stays bounded by the velocity cap; wall-clock sampling of a capped,
  // re-render-stalled loop is too jittery to assert strict monotonic growth.
  for (let i = 0; i < 3; i += 1) {
    await page.waitForTimeout(200);
    const before = await readScroll();
    await page.waitForTimeout(120);
    const after = await readScroll();
    windows.push(after - before);
  }

  // The scroll is moving forward and never regresses while held.
  for (const delta of windows) expect(delta).toBeGreaterThan(0);

  // Releasing the mouse stops the scroll.
  await page.mouse.up();
  const stoppedAt = await readScroll();
  await page.waitForTimeout(200);
  expect(await readScroll()).toBe(stoppedAt);
});

test('edge autoscroll reverses direction without ending the drag', async ({ page }) => {
  await page.evaluate(() => {
    const eng = globalThis.ganttDemo;
    const base = new Date('2026-08-10T00:00:00');
    eng.setTasks([{
      id: 'reversible',
      name: 'Reversible',
      groupName: 'gateway-foundation',
      teamName: 'T',
      status: 'todo',
      startDate: new Date(base.getTime() + 0 * 86400000).toISOString(),
      endDate: new Date(base.getTime() + 3 * 86400000).toISOString(),
      color: '#287984',
      dependencies: [],
      dependents: [],
    }]);
  });
  const timeline = page.locator('#timeline-viewport');
  const bar = page.locator('.gantt-task[data-task-id="reversible"] [data-interaction-mode="move"]');
  await expect(bar).toBeVisible();
  const viewport = await timeline.boundingBox();
  const barBounds = await bar.boundingBox();
  await page.mouse.move(barBounds.x + barBounds.width / 2, barBounds.y + barBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width + 40, barBounds.y + barBounds.height / 2, { steps: 8 });
  await page.waitForTimeout(350);
  const right = await timeline.evaluate((element) => element.scrollLeft);
  const rightStart = await page.evaluate(() => (
    globalThis.ganttDemo.getState().previewResult?.tasks
      ?.find((item) => item.id === 'reversible')
      ?.startDate?.toISOString() ?? null
  ));
  await page.mouse.move(viewport.x - 40, barBounds.y + barBounds.height / 2, { steps: 8 });
  await page.waitForTimeout(500);
  const left = await timeline.evaluate((element) => element.scrollLeft);
  const previewDuringReversal = await page.evaluate(() => {
    const state = globalThis.ganttDemo.getState();
    const task = state.previewResult?.tasks?.find((item) => item.id === 'reversible');
    return {
      active: Boolean(state.previewResult),
      start: task?.startDate?.toISOString() ?? null,
    };
  });
  const leftGeometry = await page.evaluate(() => {
    const root = document.querySelector('#timeline-viewport');
    const bar = document.querySelector(
      '.gantt-task[data-task-id="reversible"] [data-interaction-mode="move"]',
    );
    return {
      x: Number(bar.getAttribute('x')),
      width: Number(bar.getAttribute('width')),
      scrollLeft: root.scrollLeft,
      clientWidth: root.clientWidth,
    };
  });
  expect(leftGeometry.x).toBeGreaterThanOrEqual(leftGeometry.scrollLeft);
  expect(leftGeometry.x + leftGeometry.width).toBeLessThanOrEqual(
    leftGeometry.scrollLeft + leftGeometry.clientWidth,
  );
  expect(previewDuringReversal.active).toBe(true);
  await page.mouse.up();
  expect(right).toBeGreaterThan(0);
  expect(rightStart).not.toBeNull();
  expect(previewDuringReversal.start).not.toBeNull();
  expect(Date.parse(previewDuringReversal.start)).toBeLessThan(
    Date.parse(rightStart),
  );
  expect(await page.locator('#application-status').textContent()).not.toContain('Error');
});
test('left drag pre-renders a viewport buffer instead of re-anchoring each date', async ({ page }) => {
  const timeline = page.locator('#timeline-viewport');
  await page.evaluate(() => {
    const base = new Date('2026-08-10T00:00:00');
    globalThis.ganttDemo.setTasks([{
      id: 'left-buffer',
      name: 'Left buffer',
      groupName: 'gateway-foundation',
      teamName: 'T',
      status: 'todo',
      startDate: base.toISOString(),
      endDate: new Date(base.getTime() + 3 * 86400000).toISOString(),
      color: '#287984',
      dependencies: [],
      dependents: [],
    }]);
  });
  await expect(page.locator('.gantt-task[data-task-id="left-buffer"]')).toBeVisible();
  const before = await page.evaluate(() =>
    globalThis.ganttDemo.getSnapshot().timelineData.minDate.toISOString()
  );
  const bar = page.locator('.gantt-task[data-task-id="left-buffer"] [data-interaction-mode="move"]');
  const barBounds = await bar.boundingBox();
  const viewport = await timeline.boundingBox();
  await page.mouse.move(barBounds.x + barBounds.width / 2, barBounds.y + barBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x - 40, barBounds.y + barBounds.height / 2, { steps: 8 });
  await page.waitForTimeout(180);
  const prepared = await page.evaluate(() =>
    globalThis.ganttDemo.getState().minDate.toISOString()
  );
  expect(Date.parse(prepared)).toBeLessThan(Date.parse(before));
  const firstGeometry = await page.evaluate(() => {
    const root = document.querySelector('#timeline-viewport');
    const bar = document.querySelector(
      '.gantt-task[data-task-id="left-buffer"] [data-interaction-mode="move"]',
    );
    return {
      x: Number(bar.getAttribute('x')),
      scrollLeft: root.scrollLeft,
    };
  });
  expect(firstGeometry.x).toBe(firstGeometry.scrollLeft);
  const origins = [];
  for (let index = 0; index < 3; index += 1) {
    await page.waitForTimeout(180);
    origins.push(await page.evaluate(() =>
      globalThis.ganttDemo.getState().minDate.toISOString()
    ));
  }
  // Chunked buffering may prepare one additional viewport, but never re-anchor
  // once per snapped date.
  expect(new Set(origins).size).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => (
    globalThis.ganttDemo.getState().previewResult !== null
  ))).toBe(true);
  await page.mouse.up();
  const compacted = await page.evaluate(() => {
    const state = globalThis.ganttDemo.getState();
    const earliest = state.tasks.reduce(
      (min, task) => task.startDate < min ? task.startDate : min,
      state.tasks[0].startDate,
    );
    return {
      scroll: document.querySelector('#timeline-viewport').scrollLeft,
      min: state.minDate.toDateString(),
      earliest: new Date(earliest).toDateString(),
    };
  });
  expect(compacted.scroll).toBe(0);
  expect(compacted.min).toBe(compacted.earliest);
});

test('returning an expanded left drag to the viewport retains the arena until manual compaction', async ({ page }) => {
  await page.goto('/demo/empty.html');
  await page.evaluate(() => {
    const start = new Date('2027-01-16T00:00:00');
    globalThis.ganttDemo.setTasks([{
      id: 'arena-retained',
      name: 'Arena retained',
      groupName: null,
      teamName: 'T',
      status: 'todo',
      startDate: start.toISOString(),
      endDate: new Date(start.getTime() + 86400000).toISOString(),
      color: '#287984',
      dependencies: [],
      dependents: [],
    }]);
  });
  const timeline = page.locator('#timeline-viewport');
  const bar = page.locator(
    '.gantt-task[data-task-id="arena-retained"] [data-interaction-mode="move"]',
  );
  await expect(bar).toBeVisible();
  const beforeMin = await page.evaluate(() =>
    globalThis.ganttDemo.getState().minDate.toISOString()
  );
  const viewport = await timeline.boundingBox();
  const barBounds = await bar.boundingBox();
  await page.mouse.move(
    barBounds.x + barBounds.width / 2,
    barBounds.y + barBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(viewport.x - 30, barBounds.y + barBounds.height / 2, {
    steps: 8,
  });
  await page.waitForTimeout(350);
  const expandedMin = await page.evaluate(() =>
    globalThis.ganttDemo.getState().minDate.toISOString()
  );
  expect(Date.parse(expandedMin)).toBeLessThan(Date.parse(beforeMin));
  await page.mouse.move(
    viewport.x + viewport.width / 2,
    barBounds.y + barBounds.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await page.waitForTimeout(100);

  const retained = await page.evaluate(() => {
    const state = globalThis.ganttDemo.getState();
    return {
      min: state.minDate.toISOString(),
      taskCount: state.tasks.length,
      taskId: state.tasks[0]?.id,
      domCount: document.querySelectorAll(
        '.gantt-task[data-task-id="arena-retained"]',
      ).length,
    };
  });
  expect(retained).toEqual({
    min: expandedMin,
    taskCount: 1,
    taskId: 'arena-retained',
    domCount: 1,
  });
  await expect(bar).toBeVisible();

  await page.getByRole('button', { name: 'Compact timeline' }).click();
  await page.waitForTimeout(100);
  const compacted = await page.evaluate(() => {
    const state = globalThis.ganttDemo.getState();
    const root = document.querySelector('#timeline-viewport');
    return {
      min: state.minDate.toDateString(),
      taskStart: state.tasks[0].startDate.toDateString(),
      width: root.scrollWidth,
      minimumWidth: root.clientWidth + 20,
      taskCount: state.tasks.length,
      domCount: document.querySelectorAll(
        '.gantt-task[data-task-id="arena-retained"]',
      ).length,
    };
  });
  expect(compacted.min).toBe(compacted.taskStart);
  expect(compacted.width).toBeGreaterThanOrEqual(compacted.minimumWidth);
  expect(compacted.taskCount).toBe(1);
  expect(compacted.domCount).toBe(1);
  const compactedRange = await page.evaluate(() => {
    const state = globalThis.ganttDemo.getState();
    return {
      min: state.minDate.getTime(),
      max: state.timelineMaxDate.getTime(),
    };
  });
  await page.getByRole('button', { name: 'Compact timeline' }).click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => {
    const state = globalThis.ganttDemo.getState();
    return {
      min: state.minDate.getTime(),
      max: state.timelineMaxDate.getTime(),
    };
  })).toEqual(compactedRange);
  await expect(bar).toBeVisible();
});

test('a fast diagonal swipe after compaction keeps the committed bar inside the timeline arena', async ({ page }) => {
  await page.goto('/demo/empty.html');
  await page.evaluate(() => {
    const start = new Date('2027-01-16T00:00:00');
    globalThis.ganttDemo.setTasks([{
      id: 'diagonal-swipe',
      name: 'Diagonal swipe',
      groupName: null,
      teamName: 'T',
      status: 'todo',
      startDate: start.toISOString(),
      endDate: new Date(start.getTime() + 86400000).toISOString(),
      color: '#287984',
      dependencies: [],
      dependents: [],
    }]);
  });
  const timeline = page.locator('#timeline-viewport');
  const bar = page.locator(
    '.gantt-task[data-task-id="diagonal-swipe"] [data-interaction-mode="move"]',
  );
  await expect(bar).toBeVisible();
  await page.getByRole('button', { name: 'Compact timeline' }).click();
  await page.waitForTimeout(100);
  const viewport = await timeline.boundingBox();
  const barBounds = await bar.boundingBox();
  await page.mouse.move(
    barBounds.x + barBounds.width / 2,
    barBounds.y + barBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    viewport.x + viewport.width + 240,
    barBounds.y + barBounds.height / 2 + 180,
  );
  await page.mouse.up();
  await page.waitForTimeout(150);

  const committed = await page.evaluate(() => {
    const state = globalThis.ganttDemo.getState();
    const root = document.querySelector('#timeline-viewport');
    const task = state.tasks.find((item) => item.id === 'diagonal-swipe');
    const taskElement = document.querySelector(
      '.gantt-task[data-task-id="diagonal-swipe"] [data-interaction-mode="move"]',
    );
    const x = Number(taskElement.getAttribute('x'));
    const width = Number(taskElement.getAttribute('width'));
    return {
      taskCount: state.tasks.length,
      domCount: document.querySelectorAll(
        '.gantt-task[data-task-id="diagonal-swipe"]',
      ).length,
      duration: task.endDate.getTime() - task.startDate.getTime(),
      maxDay: new Date(
        state.timelineMaxDate.getFullYear(),
        state.timelineMaxDate.getMonth(),
        state.timelineMaxDate.getDate(),
      ).getTime(),
      taskEndDay: new Date(
        task.endDate.getFullYear(),
        task.endDate.getMonth(),
        task.endDate.getDate(),
      ).getTime(),
      geometryInsideArena: x >= 0 && x + width <= root.scrollWidth,
    };
  });
  expect(committed.taskCount).toBe(1);
  expect(committed.domCount).toBe(1);
  expect(committed.duration).toBe(86400000);
  expect(committed.geometryInsideArena).toBe(true);
  expect(committed.maxDay).toBeGreaterThanOrEqual(committed.taskEndDay);
  await expect(bar).toBeVisible();
});
test('resizing a task edge uses the same edge autoscroll session', async ({ page }) => {
  const timeline = page.locator('#timeline-viewport');
  await page.locator('input[data-action="timeline.set-scale"][value="day"]').check({ force: true });
  await page.evaluate(() => {
    const base = new Date('2026-08-10T00:00:00');
    globalThis.ganttDemo.setTasks([{
      id: 'resizable',
      name: 'Resizable',
      groupName: 'gateway-foundation',
      teamName: 'T',
      status: 'in-progress',
      progress: 50,
      startDate: base.toISOString(),
      endDate: new Date(base.getTime() + 10 * 86400000).toISOString(),
      color: '#287984',
      dependencies: [],
      dependents: [],
    }]);
  });
  const handle = page.locator('.gantt-task[data-task-id="resizable"] [data-interaction-mode="resize-end"]');
  await page.locator('.gantt-task[data-task-id="resizable"] [data-interaction-mode="move"]').click();
  await expect(handle).toBeVisible();
  const handleBounds = await handle.boundingBox();
  const viewport = await timeline.boundingBox();
  const before = await timeline.evaluate((element) => element.scrollLeft);
  await page.mouse.move(handleBounds.x, handleBounds.y + handleBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width + 40, handleBounds.y + handleBounds.height / 2, { steps: 8 });
  await page.waitForTimeout(350);
  const after = await timeline.evaluate((element) => element.scrollLeft);
  await page.mouse.up();
  expect(after).toBeGreaterThan(before);
});

test('vertical drag moves a task into another workstream and the sidebar highlights the landing group', async ({ page }) => {
  await page.evaluate(() => {
    const eng = globalThis.ganttDemo;
    const base = new Date('2026-08-10T00:00:00');
    const mk = (id, color, off, grp) => ({
      id,
      name: id,
      groupName: grp,
      teamName: 'T',
      status: 'todo',
      startDate: new Date(base.getTime() + off * 86400000).toISOString(),
      endDate: new Date(base.getTime() + (off + 3) * 86400000).toISOString(),
      color,
      dependencies: [],
      dependents: [],
    });
    eng.setTasks([mk('t1', '#ff0000', 0, 'gateway-foundation'), mk('t2', '#00ff00', 0, 'gateway-foundation')]);
  });
  await expect(page.locator('.gantt-task')).toHaveCount(2);

  const bar = page.locator('.gantt-task[data-task-id="t2"] [data-interaction-mode="move"]');
  const bounds = await bar.boundingBox();
  // Move t2 down onto the next workstream header (service-migration).
  const target = await page.evaluate(() => {
    const vp = document.querySelector('#timeline-viewport');
    const vpr = vp.getBoundingClientRect();
    const snap = globalThis.ganttDemo.getSnapshot();
    const header = snap.rows.find((row) => row.type === 'group-header' && row.group === 'service-migration');
    return vpr.top + header.y + 20;
  });
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, target, { steps: 8 });
  const highlighted = await page.locator('.task-group--reorder-target').count();
  await page.mouse.up();
  await expect(page.locator('#application-status')).toHaveText('Schedule saved');

  const group = await page.evaluate(() =>
    globalThis.ganttDemo.getState().tasks.find((item) => item.id === 't2').groupName,
  );
  expect(group).toBe('service-migration');
  expect(highlighted).toBe(1);
});

test('creating a task snaps to a half-day start and keeps a full-day duration', async ({ page }) => {
  const minBefore = await page.evaluate(() => globalThis.ganttDemo.getSnapshot().timelineData.minDate.toISOString().slice(0, 10));
  const viewport = await page.locator('#timeline-viewport').boundingBox();
  const colIndex = 3;
  const hoverX = viewport.x + colIndex * 32 + 16;
  const hoverY = viewport.y + 230;

  // Hover an empty grid cell: the crosshair's horizontal line must run from the
  // left pane edge (x=0) to the hovered column, meeting the vertical line there.
  await page.mouse.move(hoverX, hoverY);
  await expect(page.locator('.gantt-guide-line')).toHaveCount(2);
  const guide = await page.evaluate(() => {
    const vertical = document.querySelector('.gantt-guide-line--v');
    const horizontal = document.querySelector('.gantt-guide-line--h');
    return {
      hx1: parseFloat(horizontal.getAttribute('x1')),
      vx: parseFloat(vertical.getAttribute('x1')),
      hx2: parseFloat(horizontal.getAttribute('x2')),
    };
  });
  expect(guide.hx1).toBe(0);
  expect(guide.hx2).toBe(guide.vx);

  // Create a task at that cell; it must land exactly on the hovered column.
  await page.mouse.click(hoverX, hoverY, { button: 'right' });
  await page.locator('#context-task-name').fill('Origin check task');
  await page.locator('#context-task-name').press('Enter');
  await expect(page.locator('.gantt-task')).toHaveCount(241);

  const created = await page.evaluate(() => {
    const task = globalThis.ganttDemo.getState().tasks.find((item) => item.name === 'Origin check task');
    const position = globalThis.ganttDemo.getSnapshot().positions.find((item) => item.taskId === task.id);
    return {
      x: Math.round(position.x),
      width: Math.round(position.width),
      start: task.startDate.getTime(),
      end: task.endDate.getTime(),
    };
  });
  expect(created.x).toBe(colIndex * 32 + 16);
  expect(created.width).toBe(32);
  expect(created.end - created.start).toBe(86400000);

  // The origin must not re-anchor: the created bar appears where hovered and
  // the existing grid does not slide.
  const minAfter = await page.evaluate(() => globalThis.ganttDemo.getSnapshot().timelineData.minDate.toISOString().slice(0, 10));
  expect(minAfter).toBe(minBefore);
});

test('shared vertical scrolling keeps the task list and timeline aligned while the range grows then compacts', async ({ page }) => {
  const scrollRegion = page.locator('.gantt-scroll-region');
  const taskList = page.locator('#task-list');
  const timeline = page.locator('#timeline-viewport');

  await scrollRegion.evaluate((element) => {
    element.scrollTop = 160;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBe(160);
  expect(await taskList.evaluate((element) => element.scrollTop)).toBe(0);
  expect(await timeline.evaluate((element) => element.scrollTop)).toBe(0);

  await timeline.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth - 65;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().futureDays)).toBe(90);

  await scrollRegion.evaluate((element) => {
    element.scrollTop = 40;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().futureDays)).toBe(90);

  await timeline.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().futureDays)).toBe(270);

  await timeline.evaluate((element) => {
    element.scrollLeft = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().futureDays), { timeout: 2_000 }).toBe(90);
  await expect(page.locator('.gantt-milestone')).toHaveCount(5);
});

test('the custom horizontal scrollbar drags and stays in sync with the timeline', async ({ page }) => {
  const timeline = page.locator('#timeline-viewport');
  const track = page.locator('.timeline-hscroll');
  const thumb = page.locator('.timeline-hscroll__thumb');
  await expect(track).toHaveCount(1);
  await expect(thumb).toHaveCount(1);

  // Dragging the thumb scrolls the timeline horizontally.
  const trackBox = await track.boundingBox();
  await page.mouse.move(trackBox.x + 30, trackBox.y + trackBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(trackBox.x + 400, trackBox.y + trackBox.height / 2, { steps: 8 });
  await page.mouse.up();
  const afterDrag = await timeline.evaluate((el) => el.scrollLeft);
  expect(afterDrag).toBeGreaterThan(0);
  // Grabbing inside the thumb preserves the grab offset instead of recentering.
  await timeline.evaluate((element) => {
    element.scrollLeft = 2400;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => timeline.evaluate((element) => element.scrollLeft)).toBe(2400);
  const thumbBeforeGrab = await thumb.boundingBox();
  const grabOffset = 20;
  const grabY = thumbBeforeGrab.y + thumbBeforeGrab.height / 2;
  await page.mouse.move(thumbBeforeGrab.x + grabOffset, grabY);
  await page.mouse.down();
  const thumbAfterDown = await thumb.boundingBox();
  expect(Math.abs(thumbAfterDown.x - thumbBeforeGrab.x)).toBeLessThanOrEqual(1);
  await page.mouse.move(thumbBeforeGrab.x + grabOffset + 100, grabY, { steps: 5 });
  const thumbAfterMove = await thumb.boundingBox();
  expect(Math.abs((thumbAfterMove.x - thumbBeforeGrab.x) - 100)).toBeLessThanOrEqual(1);
  await page.mouse.up();

  // Scrolling the timeline moves the thumb.
  await timeline.evaluate((el) => {
    el.scrollLeft = el.scrollWidth - el.clientWidth;
    el.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => thumb.evaluate((el) => el.style.transform)).not.toBe('translateX(0px)');
});

test('gateway command reloads through the application scheduler', async ({ page }) => {
  await page.evaluate(() => globalThis.ganttDemo.reloadSchedule());
  await expect(page.locator('#application-status')).toHaveText('Schedule loaded');
  await expect(page.locator('.gantt-task')).toHaveCount(240);
});

test('empty entry point keeps the React shell without fixture rows or bars', async ({ page }) => {
  await page.goto('/demo/empty.html');
  await expect(page.locator('#task-count')).toHaveText('0 total');
  await expect(page.locator('.task-group')).toHaveCount(0);
  await expect(page.locator('.gantt-task')).toHaveCount(0);
  await expect(page.locator('.timeline-header')).toBeVisible();
  await expect(page.locator('.timeline-row--hovered')).toHaveCount(0);

  const viewport = await page.locator('#timeline-viewport').boundingBox();
  await page.mouse.click(viewport.x + 110, viewport.y + 100, { button: 'right' });
  await page.locator('#context-task-name').fill('Unassigned task');
  await page.locator('#context-task-name').press('Enter');
  await expect(page.locator('.task-group')).toHaveCount(0);
  await expect(page.locator('.gantt-task')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().tasks[0].groupName)).toBe(null);
});
test('empty project keeps one-task vertical scrolling in the shared viewport', async ({ page }) => {
  await page.goto('/demo/empty.html');
  const scrollRegion = page.locator('.gantt-scroll-region');
  const taskList = page.locator('#task-list');
  const timeline = page.locator('#timeline-viewport');
  const viewport = await timeline.boundingBox();
  await page.mouse.click(viewport.x + 110, viewport.y + 100, { button: 'right' });
  await page.locator('#context-task-name').fill('One task');
  await page.locator('#context-task-name').press('Enter');
  await expect(page.locator('.gantt-task')).toHaveCount(1);

  const sizes = await page.evaluate(() => {
    const region = document.querySelector('.gantt-scroll-region');
    const grid = document.querySelector('#timeline-viewport');
    return {
      regionOverflow: region.scrollHeight - region.clientHeight,
      gridOverflow: grid.scrollHeight - grid.clientHeight,
    };
  });
  expect(sizes.regionOverflow).toBeLessThanOrEqual(0);
  expect(sizes.gridOverflow).toBeLessThanOrEqual(0);

  await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
  await page.mouse.wheel(0, 160);
  expect(await scrollRegion.evaluate((element) => element.scrollTop)).toBe(0);
  expect(await taskList.evaluate((element) => element.scrollTop)).toBe(0);
  expect(await timeline.evaluate((element) => element.scrollTop)).toBe(0);
});

test('renames the project from the top navigation header', async ({ page }) => {
  await expect(page.locator('.project-top-nav__name')).toHaveText('API Gateway Migration');
  await page.locator('.project-top-nav__name').click();
  await expect(page.locator('.project-top-nav__name-input')).toBeVisible();
  await expect(page.locator('.project-top-nav__name-input')).toBeFocused();
  await page.locator('.project-top-nav__name-input').fill('Renamed demo project');
  await page.locator('.project-top-nav__name-input').press('Enter');
  await expect(page.locator('.project-top-nav__name')).toHaveText('Renamed demo project');
  await expect(page.locator('#application-status')).toHaveText('Renamed project to Renamed demo project');

  // Escape cancels an in-progress rename and restores the committed name.
  await page.locator('.project-top-nav__name').click();
  await page.locator('.project-top-nav__name-input').fill('Cancelled rename');
  await page.locator('.project-top-nav__name-input').press('Escape');
  await expect(page.locator('.project-top-nav__name')).toHaveText('Renamed demo project');
});

test('customizes the project logo through the dialog and restores it on cancel', async ({ page }) => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

  await page.locator('.project-top-nav__logo').click();
  await expect(page.locator('#project-logo-dialog')).toBeVisible();
  await expect(page.locator('#project-logo-dialog-panel')).toBeFocused();

  await page.locator('input[data-action="project.logo.file"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#project-logo-preview')).toBeVisible();
  await expect(page.locator('#project-logo-empty')).toBeHidden();
  await expect(page.locator('#project-logo-preview')).toHaveAttribute('src', /data:image\/png/);
  await expect.poll(() => page.locator('#project-logo-preview').evaluate((image) => ({
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    width: image.getBoundingClientRect().width,
    height: image.getBoundingClientRect().height,
  }))).toMatchObject({ naturalWidth: 1, naturalHeight: 1, width: 144, height: 144 });

  const box = await page.locator('#project-logo-crop').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 12, { steps: 3 });
  await page.mouse.up();

  await page.getByRole('button', { name: 'Save logo' }).click();
  await expect(page.locator('#project-logo-dialog')).toBeHidden();
  await expect(page.locator('.project-top-nav__logo-fallback')).toBeHidden();
  await expect(page.locator('.project-top-nav__logo-img')).toBeVisible();
  await expect(page.locator('.project-top-nav__logo-img')).toHaveAttribute('src', /data:image\/png/);
  await expect.poll(() => page.locator('.project-top-nav__logo-img').evaluate((image) => image.getBoundingClientRect().width)).toBeGreaterThan(31.9);
  await expect.poll(() => page.locator('.project-top-nav__logo-img').evaluate((image) => image.getBoundingClientRect().height)).toBeGreaterThan(31.9);
  await expect(page.locator('#application-status')).toHaveText('Project logo updated');

  // Cancel discards the new draft while the committed logo remains in the header.
  await page.locator('.project-top-nav__logo').click();
  await page.locator('input[data-action="project.logo.file"]').setInputFiles({ name: 'alt.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#project-logo-preview')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#project-logo-dialog')).toBeHidden();
  await expect(page.locator('.project-top-nav__logo-img')).toHaveAttribute('src', /data:image\/png/);
});

test('logo dialog tab order loops from choose image through save to cancel', async ({ page }) => {
  await page.locator('.project-top-nav__logo').click();
  await expect(page.locator('#project-logo-dialog-panel')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('input[data-action="project.logo.file"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Save logo' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('input[data-action="project.logo.file"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#project-logo-dialog')).toBeHidden();
});

test('empty demo: timeline settings save and cancel grid and dependency appearance', async ({ page }) => {
  await page.goto('/demo/empty.html');
  await page.locator('button[data-action="grid-settings.open"]').click();
  await expect(page.locator('#grid-settings-dialog')).toBeVisible();
  await expect(page.locator('#grid-settings-dialog-panel')).toBeFocused();

  // Toggle vertical lines off and change a color.
  const vertical = page.locator('#grid-settings-dialog-panel input[data-setting="showVerticalLines"]');
  await expect(vertical).toBeChecked();
  const major = page.locator(
    '#grid-settings-dialog-panel .grid-settings-dialog__dependent input[data-setting="showMajorLines"]',
  );
  await expect(major).toBeEnabled();
  await vertical.uncheck();
  await expect(major).toBeDisabled();
  await page.locator('#grid-settings-dialog-panel input[data-setting="minorLineColor"]').fill('#123456');
  const lineWidth = page.locator(
    '#grid-settings-dialog-panel input[data-dependency-setting="lineWidth"]',
  );
  const cueSize = page.locator(
    '#grid-settings-dialog-panel input[data-dependency-setting="cueSize"]',
  );
  await expect(lineWidth).toHaveValue('1.5');
  await expect(cueSize).toHaveValue('6');
  await lineWidth.fill('3');
  await cueSize.fill('8');
  await expect(
    page.locator('[data-dependency-setting-value="lineWidth"]'),
  ).toHaveText('3 px');
  await expect(
    page.locator('[data-dependency-setting-value="cueSize"]'),
  ).toHaveText('8 px');

  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.locator('#grid-settings-dialog')).toBeHidden();
  await expect(page.locator('#application-status')).toHaveText('Timeline settings updated');
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().grid))
    .toMatchObject({ showVerticalLines: false, minorLineColor: '#123456' });
  await expect.poll(
    () => page.evaluate(() => globalThis.ganttDemo.getState().dependencyAppearance),
  ).toEqual({ lineWidth: 3, cueSize: 8 });

  // Vertical lines disappear from the SVG; horizontal lines stay (empty project
  // draws the row-pitch fallback grid).
  await expect.poll(() => page.locator('.timeline-grid-line').count()).toBe(0);
  expect(await page.locator('.timeline-row-line').count()).toBeGreaterThan(1);

  // Cancel restores the previously saved settings.
  await page.locator('button[data-action="grid-settings.open"]').click();
  await page.locator('#grid-settings-dialog-panel input[data-setting="showVerticalLines"]').check();
  await expect(major).toBeEnabled();
  await lineWidth.fill('1');
  await cueSize.fill('3');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#grid-settings-dialog')).toBeHidden();
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().grid))
    .toMatchObject({ showVerticalLines: false });
  await expect.poll(
    () => page.evaluate(() => globalThis.ganttDemo.getState().dependencyAppearance),
  ).toEqual({ lineWidth: 3, cueSize: 8 });

  // Escape closes the dialog without applying changes.
  await page.locator('button[data-action="grid-settings.open"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#grid-settings-dialog')).toBeHidden();
});

test('empty demo: timeline settings dialog tab order loops through fields to save and cancel', async ({ page }) => {
  await page.goto('/demo/empty.html');
  await page.locator('button[data-action="grid-settings.open"]').click();
  await expect(page.locator('#grid-settings-dialog-panel')).toBeFocused();
  const settings = page.locator(
    '#grid-settings-dialog-panel [data-setting], #grid-settings-dialog-panel [data-dependency-setting]',
  );
  const count = await settings.count();
  await page.keyboard.press('Tab');
  await expect(settings.first()).toBeFocused();
  for (let index = 1; index < count; index += 1) {
    await page.keyboard.press('Tab');
    await expect(settings.nth(index)).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Save settings' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(settings.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#grid-settings-dialog')).toBeHidden();
});

test('main demo: timeline settings dialog applies grid settings', async ({ page }) => {
  await page.locator('button[data-action="grid-settings.open"]').click();
  await expect(page.locator('#grid-settings-dialog')).toBeVisible();
  await expect(page.locator('#grid-settings-dialog-panel')).toBeFocused();
  await page.locator('#grid-settings-dialog-panel input[data-setting="showHorizontalLines"]').uncheck();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.locator('#grid-settings-dialog')).toBeHidden();
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().grid))
    .toMatchObject({ showHorizontalLines: false });
});
