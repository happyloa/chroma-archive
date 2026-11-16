import { expect, test, type Page } from './fixtures';

// specs/002-zima-blue：色彩空間的隱藏球、致敬動畫、隱藏頁

const openReveal = (page: Page) =>
  page.evaluate(() => document.dispatchEvent(new CustomEvent('chroma:zima')));

test.describe('隱藏頁', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const [path, notCoty] of [
    ['/zima/', '不是 Pantone 年度色'],
    ['/en/zima/', 'Not a Pantone Color of the Year'],
  ] as const) {
    test(`${path} 顯示色值與出處，不讓搜尋引擎收錄`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveText('Zima Blue');
      await expect(page.locator('section[aria-labelledby="zima-title"] .eyebrow')).toContainText(
        notCoty,
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      await expect(page.locator('dl code').first()).toHaveText('#17B5F0');
      await expect(page.getByText('Alastair Reynolds')).toBeVisible();
      // 沒有設計發想與產品實驗室
      await expect(page.locator('[data-view="product"]')).toHaveCount(0);
      await expect(page.locator('a[href*="/lab/"]')).toHaveCount(0);
    });
  }

  test('不在 sitemap 與任何導覽裡', async ({ page, request }) => {
    const xml = await (await request.get('/sitemap-0.xml')).text();
    expect(xml).not.toContain('/zima/');
    await page.goto('/archive/');
    await expect(page.locator('a[href*="zima"]')).toHaveCount(0);
  });

  test('有自己的 OG 圖', async ({ page, request }) => {
    await page.goto('/zima/');
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og).toMatch(/\/og\/zima\.png$/);
    expect((await request.get('/og/zima.png')).ok()).toBe(true);
  });

  test('色彩空間的表格沒有 Zima Blue，3D 資料裡有', async ({ page }) => {
    await page.goto('/space/');
    await expect(page.locator('tbody tr')).toHaveCount(29);
    await expect(page.locator('tbody')).not.toContainText('Zima');
    const zima = JSON.parse(
      (await page.locator('[data-view="space"]').getAttribute('data-zima')) ?? '{}',
    ) as { hex: string };
    expect(zima.hex).toBe('#17B5F0');
  });

  test('減少動態效果時直接顯示動畫最後的畫面', async ({ page }) => {
    await page.goto('/space/');
    await openReveal(page);
    const dialog = page.locator('#zima-reveal');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.zima-panel')).toHaveCSS('opacity', '1');
    await expect(dialog.getByRole('link', { name: /進入 Zima Blue/ })).toHaveAttribute(
      'href',
      '/zima/',
    );
  });
});

test('致敬動畫可以用 Esc 或關閉按鈕關掉', async ({ page }) => {
  await page.goto('/space/');
  const layout = page.locator('[data-space-layout="spiral"]');
  await openReveal(page);
  const dialog = page.locator('#zima-reveal');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('open', '');
  // 約 4 秒後出現短文與按鈕
  await expect(dialog.locator('.zima-panel')).toHaveCSS('opacity', '1', { timeout: 8000 });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toHaveAttribute('open', '');

  await openReveal(page);
  await expect(dialog).toHaveAttribute('open', '');
  await dialog.getByRole('button', { name: '關閉' }).click();
  await expect(dialog).not.toHaveAttribute('open', '');
  // 關閉後頁面照常操作
  await expect(layout).toHaveCount(1);
});
