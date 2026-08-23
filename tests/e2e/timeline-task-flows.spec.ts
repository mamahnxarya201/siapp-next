import { expect, test, type Page } from '@playwright/test'

async function openProject(page: Page, projectName: string) {
  page.on('pageerror', (error) => console.error(`Browser page error: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`Browser console error: ${message.text()}`)
  })
  await page.goto('/dashboard')
  // The dashboard now presents projects as directly clickable cards; there is
  // no longer an All Projects project-selector menu in the top navigation.
  await page.getByRole('link', { name: new RegExp(`^${projectName}`) }).click()
  await expect(page).toHaveURL(/\/project\/timeline\/[a-z0-9-]+$/)
  await expect(page.getByTestId('task-list-scroll')).toBeVisible()
}

test('uses explicit dashboard and project timeline routes', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/dashboard')
  await page.getByRole('link', { name: /^API Gateway Migration/ }).click()
  await expect(page).toHaveURL('/project/timeline/p3')
  await page.goto('/project/timeline/p4')
  await expect(page.getByTestId('task-list-scroll')).toBeVisible()
  await expect(page).toHaveURL('/project/timeline/p4')
})

test('creates from a workstream, edits in the inspector, and deletes from the task list', async ({ page }) => {
  await openProject(page, 'Mobile App Redesign')

  const rootTaskName = 'Consolidate stakeholder interviews into a mobile experience opportunity map'
  const rootTaskRow = page.getByTestId('task-list-scroll').locator('[data-task-id]').filter({ hasText: rootTaskName })
  await rootTaskRow.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete task' }).click()
  await expect(page.getByText('Delete dependent descendants too')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  const addButton = page.getByRole('button', { name: 'Add task to Discovery, Research & Stakeholder Alignment' })
  await addButton.hover()
  await addButton.click()
  await expect(page.getByRole('heading', { name: 'New task' })).toBeVisible()

  const originalName = 'Playwright timeline task'
  const editedName = 'Playwright timeline task — edited'
  await page.getByLabel('Title').fill(originalName)
  await page.getByLabel('Title').press('Enter')
  await expect(page.getByTestId('task-list-scroll').getByText(originalName, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: originalName })).toBeVisible()

  await page.getByRole('button', { name: 'Edit task' }).click()
  await expect(page.getByRole('heading', { name: 'Edit Task' })).toBeVisible()
  const inspectorViewport = page.locator('[data-radix-scroll-area-viewport]').last()
  await page.getByLabel('Description').fill('Long task detail content '.repeat(200))
  await page.getByRole('button', { name: 'Add label' }).click()
  await page.getByLabel('Task label 1').fill('release-critical')
  await expect.poll(async () => inspectorViewport.evaluate((element) => getComputedStyle(element).overflowY)).toMatch(/auto|scroll/)
  await expect(page.getByRole('button', { name: 'Save task changes' })).toBeEnabled()
  await page.getByLabel('Title').fill(editedName)
  await page.getByRole('button', { name: 'Save task changes' }).click()
  await expect(page.getByTestId('task-list-scroll').getByText(editedName, { exact: true })).toBeVisible()
  await expect(page.getByText('release-critical', { exact: true })).toBeVisible()

  const editedTaskRow = page.getByTestId('task-list-scroll').locator('[data-task-id]').filter({ hasText: editedName })
  await editedTaskRow.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete task' }).click()
  await expect(page.getByRole('heading', { name: `Delete “${editedName}”?` })).toBeVisible()
  await page.getByRole('button', { name: 'Delete task' }).click()
  await expect(page.getByTestId('task-list-scroll').getByText(editedName, { exact: true })).toHaveCount(0)
})

test('requires a workstream before task creation and continues after creating one', async ({ page }) => {
  await openProject(page, 'PMIS Platform v1.0')
  await page.waitForTimeout(750)

  const workstreams = ['Foundation', 'Core Platform', 'Execution UI', 'Validation', 'Release']
  for (const workstream of workstreams) {
    const manageButton = page.getByRole('button', { name: `Manage ${workstream}` })
    await manageButton.click({ force: true })
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
    await page.getByRole('button', { name: 'Delete workstream' }).click()
  }

  await page.getByRole('button', { name: 'New task' }).last().click()
  await expect(page.getByRole('heading', { name: 'Create a workstream first' })).toBeVisible()
  await expect(page.getByText('Every task must belong to a workstream.')).toBeVisible()

  await page.getByLabel('Workstream name').fill('First Delivery Lane')
  await page.getByLabel('Workstream name').press('Enter')
  await expect(page.getByRole('heading', { name: 'New task' })).toBeVisible()
  await expect(page.getByText('First Delivery Lane', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
})

test('manages weighted checklist points and updates task progress', async ({ page }) => {
  await openProject(page, 'Mobile App Redesign')
  const taskName = 'Consolidate stakeholder interviews into a mobile experience opportunity map'
  await page.getByTestId('task-list-scroll').getByText(taskName, { exact: true }).click()
  const checklist = page.getByTestId('task-checklist')
  await expect(checklist).toBeVisible()

  await checklist.getByLabel('New checklist item').fill('Set up environment')
  await checklist.getByRole('button', { name: 'Add checklist item' }).click()
  await checklist.getByLabel('New checklist item').fill('Verify architecture')
  await checklist.getByRole('button', { name: 'Add checklist item' }).click()
  await expect(checklist.getByText('Set up environment', { exact: true })).toBeVisible()
  await expect(checklist.getByText('Verify architecture', { exact: true })).toBeVisible()
  await expect(checklist.getByLabel('Set up environment weight')).toHaveValue('50')
  await checklist.getByLabel('Set up environment weight').fill('10')
  await checklist.getByLabel('Set up environment weight').press('Tab')
  await expect(checklist.getByLabel('Verify architecture weight')).toHaveValue('90')
  await checklist.getByRole('button', { name: 'Mark Set up environment complete' }).click()
  await expect(page.getByText('10%', { exact: true })).toBeVisible()
  await checklist.getByRole('button', { name: 'Delete Set up environment' }).click()
  await expect(checklist.getByText('Set up environment', { exact: true })).toHaveCount(0)
  await expect(checklist.getByLabel('Verify architecture weight')).toHaveValue('100')
})
