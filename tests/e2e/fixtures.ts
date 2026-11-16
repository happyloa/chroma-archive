import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ fullGraphics: boolean; testHooks: void }>({
  /**
   * 無頭瀏覽器用軟體算繪，網站會判定成沒有 GPU 加速，裝飾性 3D 改用靜態內容（Base layout 的 data-lite）。
   * 測試預設強制完整 3D，才測得到 3D 視窗；要測靜態內容時用 test.use({ fullGraphics: false })。
   */
  fullGraphics: [true, { option: true }],
  testHooks: [
    async ({ page, browserName, fullGraphics }, use) => {
      if (fullGraphics) {
        await page.addInitScript(() => {
          (window as unknown as { __chromaForceFull: boolean }).__chromaForceFull = true;
        });
      }
      /**
       * Playwright 的 WebKit 在 Windows（WinCairo 版本）上，View Transition 換頁時偶爾會讓分頁當掉，
       * 跟頁面內容、WebGL、字型都無關（research.md）。只在這個組合拿掉 startViewTransition，
       * Astro 會改用自己的換頁動畫；CI 的 Linux WebKit 和 Chromium 照常測 View Transition。
       */
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
