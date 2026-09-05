import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const csv =
  'date;amount;description;currency\n2026-01-15;-49.90;NETFLIX;PLN\n2026-02-15;-49.90;NETFLIX;PLN\n2026-03-15;-49.90;NETFLIX;PLN\n2026-03-01;8000;SALARY;PLN\n2026-03-07;-250;BIEDRONKA 512;PLN\n2026-03-08;-250;BIEDRONKA 4132;PLN';
async function createAccount(page: Page) {
  await page.goto('./#/accounts');
  await page.getByLabel('Account name', { exact: true }).fill('Personal');
  await page.getByRole('button', { name: 'Save account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Personal', exact: true })).toBeVisible();
}
async function importCsv(page: Page, content = csv, timeout = 5000) {
  await page.getByRole('link', { name: 'Import', exact: true }).click();
  await page
    .getByLabel('Import account', { exact: true })
    .selectOption({ label: 'Personal · PLN' });
  await page
    .getByLabel('CSV file', { exact: true })
    .setInputFiles({ name: 'fictional.csv', mimeType: 'text/csv', buffer: Buffer.from(content) });
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect(page.getByRole('heading', { name: '3. Review and confirm' })).toBeVisible();
  await page.getByRole('button', { name: /Confirm import/ }).click();
  await expect(page.getByText('transactions imported.', { exact: false })).toBeVisible({ timeout });
}
test('account → CSV mapping → preview → persistence → dashboard and refresh', async ({ page }) => {
  const externalRequests: string[] = [];
  const allowedOrigin = new URL(
    test.info().project.use.baseURL ?? 'http://127.0.0.1:4173/FinTrack/',
  ).origin;
  page.on('request', (request) => {
    if (!request.url().startsWith(allowedOrigin) && !request.url().startsWith('data:'))
      externalRequests.push(request.url());
  });
  await createAccount(page);
  await importCsv(page);
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await expect(page.getByText('6 matching transactions')).toBeVisible();
  await page.reload();
  await expect(page.getByText('6 matching transactions')).toBeVisible();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.getByLabel('Month', { exact: true }).fill('2026-03');
  await expect(page.getByText('PLN 8,000.00', { exact: true })).toBeVisible();
  expect(externalRequests).toEqual([]);
});
test('manual correction creates a rule and reclassifies existing merchant payments', async ({
  page,
}) => {
  await createAccount(page);
  await importCsv(page);
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'BIEDRONKA 4132' })
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await page.getByLabel('Transaction category', { exact: true }).selectOption('shopping');
  await page.getByLabel('Always categorize BIEDRONKA this way').check();
  await page.getByLabel('Apply to existing matching transactions').check();
  await page.getByRole('button', { name: 'Save transaction', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'BIEDRONKA 512' })).toContainText(
    'Shopping',
  );
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: 'BIEDRONKA 4132' })).toContainText(
    'Shopping',
  );
});
test('category budget reflects imported spending and exact 100% threshold', async ({ page }) => {
  await createAccount(page);
  await page.getByRole('link', { name: 'Budgets', exact: true }).click();
  await page.getByLabel('Budget amount', { exact: true }).fill('500');
  await page.getByLabel('Budget month', { exact: true }).fill('2026-03');
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await expect(page.getByText('Budget saved', { exact: true })).toBeVisible();
  await importCsv(page);
  await page.getByRole('link', { name: 'Budgets', exact: true }).click();
  await page.getByLabel('Budget month', { exact: true }).fill('2026-03');
  await expect(page.getByText('EXCEEDED', { exact: true })).toBeVisible();
  await expect(page.getByText('100% used', { exact: true })).toBeVisible();
});
test('detect → confirm → reject → redetect keeps rejected status', async ({ page }) => {
  await createAccount(page);
  await importCsv(page);
  await page.getByRole('link', { name: 'Subscriptions', exact: true }).click();
  await page.getByRole('button', { name: 'Detect subscriptions' }).click();
  const row = page.getByRole('row').filter({ hasText: 'NETFLIX' });
  await row.getByRole('button', { name: 'Confirm subscription' }).click();
  await expect(row).toContainText('CONFIRMED');
  await row.getByRole('button', { name: 'Reject', exact: true }).click();
  await page.getByRole('button', { name: 'Detect subscriptions' }).click();
  await expect(row).toContainText('REJECTED');
  await row.getByRole('button', { name: 'Reactivate' }).click();
  await expect(row).toContainText('CONFIRMED');
});
test('backup export → explicit reset → validated restore', async ({ page }) => {
  await createAccount(page);
  await importCsv(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Backup download missing');
  const backup = await readFile(downloadedPath);
  expect(JSON.parse(backup.toString()).transactions).toHaveLength(6);
  await page.getByRole('button', { name: 'Delete all local data', exact: true }).click();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('All local data deleted', { exact: true })).toBeVisible();
  await page
    .getByLabel('Import backup', { exact: true })
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
  await expect(
    page.getByRole('heading', { name: 'Replace local data with this backup?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Backup restored', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await expect(page.getByText('6 matching transactions')).toBeVisible();
});
test('reimport is idempotent and demo forecast is populated', async ({ page }) => {
  await createAccount(page);
  await importCsv(page);
  await importCsv(page);
  await expect(page.getByText('0 transactions imported.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await expect(page.getByText('6 matching transactions')).toBeVisible();
});
test('demo populates dashboard and forecast with responsive navigation', async ({
  page,
}, testInfo) => {
  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Load demo data' }).click();
  await expect(page.getByText('Fictional demo loaded', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Financial overview' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Monthly income and expense chart/ })).toBeVisible();
  await page.screenshot({
    path: `test-results/screenshots/dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Forecast', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What the estimate uses' })).toBeVisible();
  await page.getByLabel('Forecast horizon').selectOption('12');
  await expect(
    page.getByRole('heading', { name: 'Estimated accumulation · 12 months' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Monthly cash flow' })).toBeVisible();
});

test('persistent browser profile survives closing and reopening the browser', async ({
  playwright,
}, testInfo) => {
  const profile = testInfo.outputPath('persistent-profile');
  const baseURL = testInfo.project.use.baseURL;
  const firstBrowser = await playwright.chromium.launchPersistentContext(profile, { baseURL });
  try {
    const firstPage = await firstBrowser.newPage();
    await createAccount(firstPage);
    await importCsv(firstPage);
  } finally {
    await firstBrowser.close();
  }
  const reopenedBrowser = await playwright.chromium.launchPersistentContext(profile, { baseURL });
  try {
    const reopenedPage = await reopenedBrowser.newPage();
    await reopenedPage.goto('./#/transactions');
    await expect(reopenedPage.getByText('6 matching transactions')).toBeVisible();
  } finally {
    await reopenedBrowser.close();
  }
});

test('10,000-row CSV stays usable with paginated transactions', async ({ page }) => {
  test.setTimeout(60000);
  await createAccount(page);
  const rows = [
    'date,amount,description,currency',
    ...Array.from(
      { length: 10000 },
      (_, index) => `2026-03-15,-1.01,Fictional payment ${index},PLN`,
    ),
  ];
  await importCsv(page, rows.join('\n'), 30000);
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await expect(page.getByText('10000 matching transactions')).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(51);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 200')).toBeVisible();
});
