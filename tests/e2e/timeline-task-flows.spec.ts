import { expect, test, type Page } from '@playwright/test'

async function openProject(page: Page, projectName: string) {
  page.on('pageerror', (error) => console.error(`Browser page error: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`Browser console error: ${message.text()}`)
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'All Projects' }).click()
  await page.getByRole('menuitem', { name: projectName }).click()
  await expect(page.getByTestId('task-list-scroll')).toBeVisible()
}

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
  await expect.poll(async () => inspectorViewport.evaluate((element) => getComputedStyle(element).overflowY)).toMatch(/auto|scroll/)
  await page.getByLabel('Linked change requests').focus()
  await page.getByLabel('Linked change requests').press('Tab')
  await expect(page.getByRole('button', { name: 'Save task changes' })).toBeFocused()
  await page.getByLabel('Title').fill(editedName)
  await page.getByRole('button', { name: 'Save task changes' }).click()
  await expect(page.getByTestId('task-list-scroll').getByText(editedName, { exact: true })).toBeVisible()

  const editedTaskRow = page.getByTestId('task-list-scroll').locator('[data-task-id]').filter({ hasText: editedName })
  await editedTaskRow.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete task' }).click()
  await expect(page.getByRole('heading', { name: `Delete “${editedName}”?` })).toBeVisible()
  await page.getByRole('button', { name: 'Delete task' }).click()
  await expect(page.getByTestId('task-list-scroll').getByText(editedName, { exact: true })).toHaveCount(0)
})

test('requires a workstream before task creation and continues after creating one', async ({ page }) => {
  await openProject(page, 'PMIS Platform v1.0')

  const workstreams = ['Foundation', 'Core Platform', 'Execution UI', 'Validation', 'Release']
  for (const workstream of workstreams) {
    await page.getByRole('button', { name: `Manage ${workstream}` }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
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
