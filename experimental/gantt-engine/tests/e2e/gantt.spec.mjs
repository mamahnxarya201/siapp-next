import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#task-count')).toHaveText('11 total');
  await expect(page.locator('.gantt-task')).toHaveCount(11);
});

test('creates tasks and bars and switches themes through the scoped controls', async ({ page }) => {
  const taskInput = page.locator('[data-action="task.create"]');
  await taskInput.fill('Year 0 task');
  await taskInput.press('Enter');
  await expect(page.locator('.gantt-task')).toHaveCount(12);
  expect(await page.locator('.task-row__name').evaluateAll((inputs) => inputs.filter((input) => input.value === 'Year 0 task').length)).toBe(1);

  await page.getByLabel('Editorial').check();
  await expect(page.locator('.gantt-application')).toHaveAttribute('data-theme', 'editorial');

  const viewport = await page.locator('#timeline-viewport').boundingBox();
  await page.mouse.click(viewport.x + 110, viewport.y + 230, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Add task bar here' }).click();
  await expect(page.locator('.gantt-task')).toHaveCount(13);

});

test('previews and commits a dependency through the scoped context menu', async ({ page }) => {
  await page.locator('.gantt-task[data-task-id="foundation-schema"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Connect to another task' }).click();
  const target = await page.locator('.gantt-task[data-task-id="core-forecast"]').boundingBox();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  await expect(page.locator('.dependency-line--preview')).toHaveCount(1);
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
  await expect(page.locator('.dependency-line--preview')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => globalThis.ganttDemo.getState().tasks.find((task) => task.id === 'core-forecast').dependencies)).toContain('foundation-schema');
});

test('delegated controls update scale and dependency disclosure', async ({ page }) => {
  await expect(page.locator('.dependency-line')).toHaveCount(0);

  await page.locator('#task-list [data-task-id="ui-svg"]').hover();
  await expect(page.locator('.dependency-line')).toHaveCount(3);

  await page.locator('#task-list [data-task-id="ui-svg"]').click();
  await expect(page.locator('#selection-status')).toContainText('SVG timeline renderer');
  expect(await page.locator('.dependency-line').count()).toBeGreaterThan(3);

  const weekWidth = await page.locator('.gantt-task[data-task-id="ui-svg"] .gantt-bar').getAttribute('width');
  await page.locator('input[name="scale"][value="day"]').check();
  const dayWidth = await page.locator('.gantt-task[data-task-id="ui-svg"] .gantt-bar').getAttribute('width');
  expect(Number(dayWidth)).toBeGreaterThan(Number(weekWidth));

  await page.locator('input[data-action="dependencies.toggle-all"]').check();
  expect(await page.locator('.dependency-line').count()).toBeGreaterThan(5);

  await page.locator('input[data-action="dependencies.toggle-critical"]').check();
  await expect(page.locator('.gantt-bar--critical').first()).toBeVisible();
});

test('workstream collapse removes matching rows, bars, and connector endpoints', async ({ page }) => {
  await page.locator('input[data-action="dependencies.toggle-all"]').check();
  const initialConnectorCount = await page.locator('.dependency-line').count();

  await page.locator('#task-list [data-workstream-id="foundation"]').click();
  await expect(page.locator('#task-list [data-task-id="foundation-schema"]')).toHaveCount(0);
  await expect(page.locator('.gantt-task[data-task-id="foundation-schema"]')).toHaveCount(0);
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

  await page.locator('#task-list [data-task-id="core-scheduling"]').click();
  const bar = page.locator('.gantt-task[data-task-id="core-scheduling"] [data-interaction-mode="move"]');
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

  expect(Date.parse(after['core-scheduling'].start)).toBeGreaterThan(Date.parse(before['core-scheduling'].start));
  expect(Date.parse(after['ui-svg'].start)).toBeGreaterThan(Date.parse(before['ui-svg'].start));
  expect(Date.parse(after['ui-interaction'].start)).toBeGreaterThanOrEqual(Date.parse(after['ui-svg'].end));
  expect(after['core-forecast']).toEqual(before['core-forecast']);
});

test('moving a predecessor earlier never pulls its child backward', async ({ page }) => {
  const childBefore = await page.evaluate(() => (
    globalThis.ganttDemo.getState().tasks.find((task) => task.id === 'foundation-adapter').startDate.toISOString()
  ));

  await page.locator('#task-list [data-task-id="foundation-schema"]').click();
  const bar = page.locator('.gantt-task[data-task-id="foundation-schema"] [data-interaction-mode="move"]');
  const bounds = await bar.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 - 64, bounds.y + bounds.height / 2, { steps: 4 });
  await page.mouse.up();

  const childAfter = await page.evaluate(() => (
    globalThis.ganttDemo.getState().tasks.find((task) => task.id === 'foundation-adapter').startDate.toISOString()
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
  await expect(page.locator('.gantt-milestone')).toHaveCount(1);
});

test('gateway command reloads through the application scheduler', async ({ page }) => {
  await page.getByRole('button', { name: 'Reload schedule' }).click();
  await expect(page.locator('#application-status')).toHaveText('Schedule loaded');
  await expect(page.locator('.gantt-task')).toHaveCount(11);
});
