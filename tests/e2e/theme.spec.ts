import { expect, test } from './fixtures';

// 全站只有深色介面
test.describe('深色介面', () => {
  test('系統設定為淺色時也維持深色，頁首沒有切換按鈕', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/archive/');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 14, 14)');
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(244, 242, 238)');
    await expect(page.locator('[data-theme-toggle]')).toHaveCount(0);

    // 站內換頁後仍是深色
    await page.getByRole('link', { name: '色彩空間' }).first().click();
    await expect(page).toHaveURL(/\/space\/$/);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 14, 14)');
  });

  test('色票卡片維持白色標籤與深色文字', async ({ page }) => {
    await page.goto('/archive/');
    const card = page.locator('section[aria-label="全部年度色"] li a').first();
    await expect(card).toHaveCSS('background-color', 'rgb(253, 252, 250)');
    await expect(card).toHaveCSS('color', 'rgb(14, 14, 14)');
  });
});
