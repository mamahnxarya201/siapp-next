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
