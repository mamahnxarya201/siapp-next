import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#task-count')).toHaveText('240 total');
  await expect(page.locator('.gantt-task')).toHaveCount(240);
});

test('creates tasks and bars and switches themes through the project chrome', async ({ page }) => {
  const taskInput = page.locator('[data-action="task.create"]');
  await taskInput.fill('Year 0 task');
  await taskInput.press('Enter');
  await expect(page.locator('.gantt-task')).toHaveCount(241);
  expect(await page.locator('.task-row__name').evaluateAll((inputs) => inputs.filter((input) => input.value === 'Year 0 task').length)).toBe(1);

  await expect(page.locator('.gantt-application')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch theme' }).click();
  await expect(page.locator('.gantt-application')).toHaveAttribute('data-theme', 'dark');

  const viewport = await page.locator('#timeline-viewport').boundingBox();
  await page.mouse.click(viewport.x + 110, viewport.y + 230, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Add task bar here' }).click();
  await expect(page.locator('.gantt-task')).toHaveCount(242);

});

test('previews and commits a dependency through the scoped context menu', async ({ page }) => {
  await page.locator('.gantt-task[data-task-id="performance-1"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Connect to another task' }).click();
  const target = await page.locator('.gantt-task[data-task-id="performance-3"]').boundingBox();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  await expect(page.locator('.dependency-line--preview')).toHaveCount(1);
  await page.locator('.gantt-task[data-task-id="performance-3"]').click();
  await expect(page.locator('.dependency-line--preview')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().tasks.find((task) => task.id === 'performance-3').dependencies)).toContain('performance-1');
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

test('workstream collapse removes matching rows, bars, and connector endpoints', async ({ page }) => {
  await page.locator('input[data-action="dependencies.toggle-all"]').check({ force: true });
  const initialConnectorCount = await page.locator('.dependency-line').count();

  await page.locator('#task-list [data-workstream-id="gateway-foundation"]').click();
  await expect(page.locator('#task-list [data-task-id="performance-1"]')).toHaveCount(0);
  await expect(page.locator('.gantt-task[data-task-id="performance-1"]')).toHaveCount(0);
  expect(await page.locator('.dependency-line').count()).toBeLessThan(initialConnectorCount);
});

test('drag commits once and recursively pushes violating dependents', async ({ page }) => {
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
