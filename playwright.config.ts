import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // WebGL 測試在軟體算繪下很吃 CPU，同時跑太多會互相拖慢而逾時
  workers: process.env.CI ? 2 : 3,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // 3D 視窗在軟體算繪（無 GPU）下初始化較慢，平行跑多個瀏覽器時需要較長的等待
  expect: { timeout: 15_000 },
  // CI 沒有 GPU，情境場景在軟體算繪下每秒只有十幾格，整個測試的時限也放寬
  timeout: process.env.CI ? 60_000 : 30_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // 對建置後的靜態檔測試，行為和正式環境一致
  webServer: {
    command: `npm run build && npx astro preview --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
