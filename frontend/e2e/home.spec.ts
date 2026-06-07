import { test, expect } from '@playwright/test';

test('ランディングから各入口へ遷移できる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'ReqTrack' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ようこそ' })).toBeVisible();

  // 新規作成系へ
  await page.getByRole('link', { name: /新規作成/ }).click();
  await expect(page.getByRole('heading', { name: '新規プロジェクト' })).toBeVisible();

  // 進捗管理系へ(左ペインメニュー)
  await page.goto('/manage');
  await expect(page.getByRole('navigation', { name: '進捗管理メニュー' })).toBeVisible();
});
