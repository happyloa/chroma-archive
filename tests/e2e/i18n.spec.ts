import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

test('英文首頁使用英文介面與 lang="en"', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('link', { name: /See the 2026 color/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
});

test('從中文年度頁切換到英文版，再切回來', async ({ page }) => {
  await page.goto('/years/2025/');
  await page.getByRole('link', { name: '切換為英文版' }).click();
  await expect(page).toHaveURL(/\/en\/years\/2025\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#year-title')).not.toContainText('摩卡慕斯');
  await expect(page.getByText('A soft brown with notes of cocoa and coffee').first()).toBeVisible();

  await page.getByRole('link', { name: 'Switch to Traditional Chinese' }).click();
  await expect(page).toHaveURL(/\/years\/2025\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant-TW');
  await expect(page.locator('#year-title')).toContainText('摩卡慕斯');
});

test('英文頁面的站內連結都留在 /en/ 底下', async ({ page }) => {
  await page.goto('/en/archive/');
  const hrefs = await page
    .locator('main a[href^="/"]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(20);
  for (const href of hrefs) expect(href).toMatch(/^\/en\//);
});

test('每頁都有 hreflang 對應連結', async ({ page }) => {
  await page.goto('/en/space/');
  await expect(page.locator('link[rel="alternate"][hreflang="zh-Hant-TW"]')).toHaveAttribute(
    'href',
    /\/space\/$/,
  );
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href',
    /\/en\/space\/$/,
  );
});

test('英文版產品實驗室：介面英文，切換語言保留設定', async ({ page }) => {
  await page.goto('/en/years/2025/lab/?p=vase&f=gloss');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Product lab');
  await expect(page.locator('input[name="p"]:checked')).toHaveValue('vase');
  await expect(page.getByText('Ceramic vase', { exact: true })).toBeVisible();
  const zhLink = page.getByRole('link', { name: 'Switch to Traditional Chinese' });
  await expect(zhLink).toHaveAttribute('href', /\/years\/2025\/lab\/\?.*p=vase/);
});

test('英文頁的複製按鈕顯示英文提示', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', '剪貼簿權限只在 Chromium 設定');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/en/years/2025/');
  const button = page.getByRole('button', { name: /Copy Mocha Mousse HEX #A47864/ });
  await button.click();
  await expect(button).toContainText('Copied');
  await expect(page.locator('#announcer')).toHaveText(/Copied Mocha Mousse HEX #A47864/);
});
