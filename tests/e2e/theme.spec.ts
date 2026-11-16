import { expect, test } from '@playwright/test';

test.describe('深淺色切換', () => {
  test('沒有選過時跟隨系統設定', async ({ browser }) => {
    const dark = await browser.newContext({ colorScheme: 'dark' });
    const page = await dark.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await dark.close();
  });

  test('切換後記住選擇，換頁與重新整理都維持', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/archive/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    const toggle = page.getByRole('button', { name: '切換深淺色' });
    await expect(toggle).toBeEnabled();
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 14, 14)');

    // 站內換頁（ClientRouter 會換掉 <html> 屬性）
    await page.getByRole('link', { name: '色彩空間' }).first().click();
    await expect(page).toHaveURL(/\/space\/$/);
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('揭露動畫結束後移除疊層', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
    await page.goto('/about/');
    await page.getByRole('button', { name: '切換深淺色' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.theme-reveal-layer')).toHaveCount(0, { timeout: 3000 });
  });

  test('色票卡片在深色模式維持白色標籤與深色文字', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/archive/');
    const card = page.locator('section[aria-label="全部年度色"] li a').first();
    await expect(card).toHaveCSS('background-color', 'rgb(253, 252, 250)');
    await expect(card).toHaveCSS('color', 'rgb(14, 14, 14)');
  });
});
