import { test as base, expect } from '@playwright/test';

/**
 * Playwright 的 WebKit 在 Windows（WinCairo 版本）上，View Transition 換頁時偶爾會讓分頁當掉，
 * 跟頁面內容、WebGL、字型都無關（research.md R-09）。只在這個組合拿掉 startViewTransition，
 * Astro 會改用自己的換頁動畫；CI 的 Linux WebKit 和 Chromium 照常測 View Transition。
 */
export const test = base.extend<{ webkitWindowsWorkaround: void }>({
  webkitWindowsWorkaround: [
    async ({ page, browserName }, use) => {
      if (browserName === 'webkit' && process.platform === 'win32') {
        await page.addInitScript(() => {
          delete (Document.prototype as { startViewTransition?: unknown }).startViewTransition;
        });
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
export type { Page } from '@playwright/test';
