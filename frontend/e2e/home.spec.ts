import { test, expect } from '@playwright/test';

test('トップ画面が表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ReqTrack' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '要員一覧' })).toBeVisible();
});
