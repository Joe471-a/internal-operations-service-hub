// @ts-ignore - this file has no tsconfig.json of its own, so the editor can't
// see @types/node here; Playwright runs it fine regardless, this only
// silences the checker.
import { execFileSync } from 'node:child_process';
import { expect, Page, test } from '@playwright/test';

/**
 * Internal Operations Service Hub — the whole thing, once.
 *
 * Nothing in this test is a stand-in. A real browser fills in a real form,
 * the real backend applies the real authorization and lifecycle rules, and
 * a real row changes in SQLite. It is the slowest test in the project and
 * there is only one of it, because its job is to prove the parts are
 * actually connected - the faster tests already prove that each part is
 * right on its own.
 */

test.beforeAll(() => {
  // Put the database back to the five known requests. This is what makes
  // the second run of this test as green as the first.
  // shell: true - on Windows "npm" resolves to npm.cmd, which execFileSync
  // can only launch through a shell.
  execFileSync('npm', ['run', 'db:seed', '--workspace', 'backend'], {
    stdio: 'inherit',
    shell: true,
  });
});

async function logIn(page: Page, username: string, password: string) {
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function logOut(page: Page) {
  await page.locator('.session-chip').click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
}

test('an employee submits a request, and only the right department lead may assign it', async ({ page }) => {
  await page.goto('/');

  // --- An employee signs in and submits a new IT request, through the real form
  await logIn(page, 'dana', 'dana123');
  await page.getByRole('button', { name: 'New Request' }).click();

  const title = 'Printer is jammed';
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill('The 3rd floor printer is jammed and needs a technician.');
  await page.getByLabel('Department').selectOption('IT');
  await page.getByRole('button', { name: 'Submit Request' }).click();

  const row = page.locator('tr', { hasText: title });
  await expect(row).toBeVisible();
  await expect(row.locator('.status')).toContainText('Submitted');

  const requestId = (await row.locator('td').first().innerText()).trim();

  // --- HR Lead has no part in an IT request - it never even appears -------
  await logOut(page);
  await logIn(page, 'sami', 'sami123');
  await expect(page.locator('tr', { hasText: 'REQ-1005' })).toBeVisible();
  await expect(page.locator('tr', { hasText: title })).toHaveCount(0);

  // --- IT Lead succeeds -----------------------------------------------------
  await logOut(page);
  await logIn(page, 'karim', 'karim123');
  const itRow = page.locator('tr', { hasText: title });
  await itRow.getByRole('button', { name: `Assign ${requestId}` }).click();

  // This text only appears if the browser, the API, the login, the
  // authorization rule, the lifecycle rule and SQLite all agreed.
  await expect(itRow.locator('.status')).toContainText('Assigned');
});
