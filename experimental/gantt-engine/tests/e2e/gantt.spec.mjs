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

test('previews and commits a dependency through the scoped context menu', async ({ page }) => {
  await page.locator('.gantt-task[data-task-id="performance-1"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Add dependency' }).click();
  const target = await page.locator('.gantt-task[data-task-id="performance-3"]').boundingBox();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  await expect(page.locator('.dependency-line--preview')).toHaveCount(1);
  await page.locator('.gantt-task[data-task-id="performance-3"]').click();
  await expect(page.locator('.dependency-line--preview')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().tasks.find((task) => task.id === 'performance-3').dependencies)).toContain('performance-1');
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
  const neighborAfter = await page.locator('.gantt-task[data-task-id="performance-6"] [data-interaction-mode="move"]').evaluate((el) => Math.round(parseFloat(el.getAttribute('x'))));

  // The origin must not re-anchor: the dragged bar moves on screen and the
  // nearby bar (which the origin shift used to push left) stays put.
  expect(minAfter).toBe(minBefore);
  expect(xAfter).toBeGreaterThan(xBefore);
  expect(neighborAfter).toBe(neighborBefore);
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
  const scrollAfter = await page.locator('#timeline-viewport').evaluate((el) => el.scrollLeft);

  // The viewport scrolled forward while holding the bar at the edge.
  expect(scrollAfter).toBeGreaterThan(scrollBefore);
  await page.mouse.up();
});

test('autoscroll speed scales with pointer distance past the edge (throttle)', async ({ page }) => {
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

  // One drag; move the pointer to a near-past-edge position, sample the speed,
  // then push it further past the edge and sample again. Holding the drag across
  // both phases avoids re-grabbing the bar.
  await page.mouse.move(barBounds.x + barBounds.width / 2, barBounds.y + barBounds.height / 2);
  await page.mouse.down();

  const nearX = viewport.x + viewport.width + 20;
  await page.mouse.move(nearX, barBounds.y + barBounds.height / 2, { steps: 8 });
  await page.waitForTimeout(250); // let the throttle settle toward its target
  const nearBefore = await readScroll();
  await page.waitForTimeout(120);
  const nearAfter = await readScroll();
  const nearSpeed = nearAfter - nearBefore;

  const farX = viewport.x + viewport.width + 120;
  await page.mouse.move(farX, barBounds.y + barBounds.height / 2, { steps: 8 });
  await page.waitForTimeout(250); // settle at the deeper position
  const farBefore = await readScroll();
  await page.waitForTimeout(120);
  const farAfter = await readScroll();
  const farSpeed = farAfter - farBefore;

  await page.mouse.up();

  // The deeper position scrolls faster: speed scales with pointer distance past
  // the edge (throttle), not a fixed jump.
  expect(nearSpeed).toBeGreaterThan(0);
  expect(farSpeed).toBeGreaterThan(nearSpeed);
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
    return vpr.top + 72 + header.y + 20;
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

test('creating a task lands it on the hovered grid column and the guide crosses from the left pane', async ({ page }) => {
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

  const createdX = await page.evaluate(() => {
    const task = globalThis.ganttDemo.getState().tasks.find((t) => t.name === 'Origin check task');
    const position = globalThis.ganttDemo.getSnapshot().positions.find((p) => p.taskId === task.id);
    return Math.round(position.x);
  });
  expect(createdX).toBe(colIndex * 32);

  // The origin must not re-anchor: the created bar appears where hovered and
  // the existing grid does not slide.
  const minAfter = await page.evaluate(() => globalThis.ganttDemo.getSnapshot().timelineData.minDate.toISOString().slice(0, 10));
  expect(minAfter).toBe(minBefore);
});

test('scrolling stays synchronized and the future range grows then compacts', async ({ page }) => {
  const taskList = page.locator('#task-list');
  const timeline = page.locator('#timeline-viewport');

  await taskList.evaluate((element) => {
    element.scrollTop = 20;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => timeline.evaluate((element) => element.scrollTop)).toBe(20);

  await timeline.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth - 65;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().futureDays)).toBe(90);

  await timeline.evaluate((element) => {
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
