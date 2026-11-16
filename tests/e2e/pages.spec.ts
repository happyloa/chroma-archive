import { expect, test } from './fixtures';

test.use({ reducedMotion: 'reduce' });

test('首頁顯示最新年度色並能進入年度頁', async ({ page }) => {
  await page.goto('/');
  const title = page.locator('#hero-title');
  await expect(title).toContainText('2026');
  await expect(title).toContainText('Cloud Dancer');
  await page.getByRole('link', { name: /看 2026 年度色/ }).click();
  await expect(page).toHaveURL(/\/years\/2026\/$/);
  await expect(page.locator('h1')).toContainText('Cloud Dancer');
});

test('典藏頁列出全部 27 個年份', async ({ page }) => {
  await page.goto('/archive/');
  await expect(page.getByRole('navigation', { name: '年份' }).getByRole('link')).toHaveCount(27);
  await expect(page.locator('section[aria-label="全部年度色"] li')).toHaveCount(27);
});

test('雙色年份顯示兩個顏色的色值', async ({ page }) => {
  await page.goto('/years/2016/');
  await expect(page.locator('h1')).toContainText('Rose Quartz & Serenity');
  await expect(page.locator('#values-title + div dl')).toHaveCount(2);
});

test('複製按鈕把色值寫進剪貼簿並通知螢幕閱讀器', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', '剪貼簿權限只在 Chromium 設定');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/years/2025/');
  const button = page.getByRole('button', { name: /複製 Mocha Mousse HEX #A47864/ });
  await button.click();
  await expect(button).toContainText('已複製');
  await expect(page.locator('#announcer')).toHaveText(/已複製 Mocha Mousse HEX #A47864/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('#A47864');
});

test('年份導覽可用鍵盤操作', async ({ page }) => {
  await page.goto('/years/2020/');
  const current = page.getByRole('navigation', { name: '年份' }).locator('[aria-current="page"]');
  await expect(current).toHaveAttribute('href', '/years/2020/');
  // WebKit 和 Safari 一樣預設不用 Tab 聚焦連結，所以直接聚焦下一個年份再按 Enter
  await current.locator('xpath=../following-sibling::li[1]/a').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/years\/2021\/$/);
});

test('產品實驗室頁預設選取當年度色', async ({ page }) => {
  await page.goto('/years/2019/lab/');
  await expect(page.locator('input[name="c1"]:checked')).toHaveValue('2019-0');
  await expect(page.locator('input[name="p"]:checked')).toHaveValue('chair');
});

test('色彩空間表格列出全部 29 個顏色', async ({ page }) => {
  await page.goto('/space/');
  await expect(page.locator('tbody tr')).toHaveCount(29);
});

test('未公布的年份顯示 404 頁', async ({ page }) => {
  const res = await page.goto('/years/2027/');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('這個顏色不在色票裡');
});
