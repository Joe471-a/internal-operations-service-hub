// @ts-ignore - this file has no tsconfig.json of its own, so the editor can't
// see @types/node here; Playwright runs it fine regardless, this only
// silences the checker.
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

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

test('an employee submits a request, and only the right department lead may assign it', async ({ page }) => {
  await page.goto('/');

  // --- An employee submits a new IT request, through the real form -------
  const title = 'Printer is jammed';
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill('The 3rd floor printer is jammed and needs a technician.');
  await page.getByLabel('Department').selectOption('IT');
  await page.getByRole('button', { name: 'Submit Request' }).click();

  const row = page.locator('tr', { hasText: title });
  await expect(row).toBeVisible();
  await expect(row.locator('.status')).toContainText('Submitted');

  const requestId = (await row.locator('td').first().innerText()).trim();

  // --- HR Lead has no part in an IT request - refused ---------------------
  await page.getByLabel('Acting as').selectOption('hr-lead-001');
  await row.getByRole('button', { name: `Assign ${requestId}` }).click();

  await expect(page.locator('.error')).toContainText('may not move a IT request');
  // The refusal must not cost the user what they were already looking at.
  await expect(row.locator('.status')).toContainText('Submitted');

  // --- IT Lead succeeds -----------------------------------------------------
  await page.getByLabel('Acting as').selectOption('it-lead-001');
  await row.getByRole('button', { name: `Assign ${requestId}` }).click();

  // This text only appears if the browser, the API, the authorization rule,
  // the lifecycle rule and SQLite all agreed.
  await expect(row.locator('.status')).toContainText('Assigned');
});
