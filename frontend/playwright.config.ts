import { defineConfig, devices } from '@playwright/test';

// E2E は e2e/ 配下のみ。Vite dev server を自動起動して検証する。
// backend 未起動でも画面は描画され API エラー表示になる(初期構成の最小 E2E)。
// ポートは E2E_PORT で上書き可能(他プロジェクトと衝突する場合に変更する)。
const port = Number(process.env.E2E_PORT ?? 5174);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm dev --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
