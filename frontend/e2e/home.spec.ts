import { test, expect } from '@playwright/test';

test('トップ画面が表示されナビできる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ReqTrack' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();

  // 要件画面へ遷移
  await page.getByRole('navigation').getByRole('link', { name: '要件' }).click();
  await expect(page.getByRole('heading', { name: '要件', exact: true })).toBeVisible();
});
