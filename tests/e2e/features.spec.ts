import { expect, test, type Page } from './fixtures';

// 階段 3、4 加上的功能：設計發想 3D、典藏時間軸、色彩空間、.ase、OG 圖、sitemap、預載畫面

const views = (page: Page) => page.evaluate(() => window.__chroma?.().views ?? 0);
// 3D 區塊只在有 WebGL 2 且沒有減少動態效果時顯示（global.css 的 .webgl-only）
const stageShown = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.dataset.webgl === 'on' &&
      document.documentElement.dataset.motion === 'full',
  );

test.describe('減少動態效果', () => {
  test.use({ reducedMotion: 'reduce' });

  test('年度頁的設計發想有 3 個產品視窗，每個都有替代剪影與名稱', async ({ page }) => {
    await page.goto('/years/2025/');
    const products = page.locator('section[aria-labelledby="ideas-title"] [data-view="product"]');
    await expect(products).toHaveCount(3);
    for (const product of await products.all()) {
      await expect(product).toHaveAttribute('role', 'img');
      await expect(product).toHaveAttribute('aria-label', /.+：.+/);
      await expect(product).toHaveAttribute('data-primary', /^#[0-9A-F]{6}$/i);
    }
    await expect(page.locator('section[aria-labelledby="ideas-title"] ul > li > h3')).toHaveCount(
      3,
    );
  });

  test('典藏頁的 3D 時間軸只做視覺，減少動態效果時不顯示', async ({ page }) => {
    await page.goto('/archive/');
    const timeline = page.locator('[data-view="timeline"]');
    const section = timeline.locator('xpath=ancestor::section[1]');
    await expect(section).toHaveAttribute('aria-hidden', 'true');
    await expect(section).toBeHidden();
    const items = JSON.parse((await timeline.getAttribute('data-items')) ?? '[]') as {
      hexes: string[];
    }[];
    expect(items).toHaveLength(27);
    expect(items.flatMap((i) => i.hexes)).toHaveLength(29);
    // 鍵盤與螢幕閱讀器改用下方的色票格
    await expect(page.locator('section[aria-label="全部年度色"] li a')).toHaveCount(27);
  });

  test('色彩空間表格可依欄位排序並更新 aria-sort', async ({ page }) => {
    await page.goto('/space/');
    const rows = page.locator('tbody tr');
    const yearHeader = page.locator('th:has([data-sort-key="year"])');
    await expect(yearHeader).toHaveAttribute('aria-sort', 'ascending');

    // 年份再點一次變成由新到舊
    await page.locator('[data-sort-key="year"]').click();
    await expect(yearHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(rows.first()).toHaveAttribute('data-year', '2026');

    // 依明度由暗到亮
    await page.locator('[data-sort-key="l"]').click();
    await expect(page.locator('th:has([data-sort-key="l"])')).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expect(yearHeader).not.toHaveAttribute('aria-sort', /.+/);
    const lightness = await rows.evaluateAll((trs) =>
      trs.map((tr) => Number((tr as HTMLElement).dataset.l)),
    );
    expect(lightness).toEqual([...lightness].sort((a, b) => a - b));
  });

  test('年度頁可以下載 Adobe 色票檔（.ase）', async ({ page, request }) => {
    await page.goto('/years/2016/');
    const link = page.locator('a[href="/ase/2016.ase"]');
    await expect(link).toHaveAttribute('download', 'chroma-archive-2016.ase');
    const res = await request.get('/ase/2016.ase');
    expect(res.ok()).toBe(true);
    const body = await res.body();
    expect(body.subarray(0, 4).toString('latin1')).toBe('ASEF');
  });

  test('每個年度頁有自己的 OG 圖', async ({ page, request }) => {
    await page.goto('/years/2025/');
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og).toMatch(/\/og\/2025\.png$/);
    const res = await request.get('/og/2025.png');
    expect(res.ok()).toBe(true);
    const body = await res.body();
    expect(body.subarray(1, 4).toString('latin1')).toBe('PNG');
  });

  test('sitemap 列出兩種語系的頁面，不含 OG 圖', async ({ request }) => {
    const index = await request.get('/sitemap-index.xml');
    expect(index.ok()).toBe(true);
    const xml = await (await request.get('/sitemap-0.xml')).text();
    expect(xml).toContain('/years/2025/</loc>');
    expect(xml).toContain('hreflang="en"');
    expect(xml).toContain('/en/years/2025/');
    expect(xml).not.toContain('/og/');
  });

  test('減少動態效果時不顯示預載畫面', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#preloader')).toHaveCount(0);
  });
});

test('典藏頁捲動時間軸會建立 3D 視窗', async ({ page }) => {
  await page.goto('/archive/');
  test.skip(!(await stageShown(page)), '沒有 WebGL 2，3D 區塊不顯示');
  await expect(page.locator('[data-view="timeline"]')).toBeVisible();
  await expect.poll(() => views(page)).toBeGreaterThan(0);
});

test('色彩空間的排列按鈕切換 aria-pressed', async ({ page }) => {
  await page.goto('/space/');
  test.skip(!(await stageShown(page)), '沒有 WebGL 2，3D 區塊不顯示');
  await expect.poll(() => views(page)).toBeGreaterThan(0);
  const spiral = page.locator('[data-space-layout="spiral"]');
  await spiral.click();
  await expect(spiral).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-space-layout="space"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('預載畫面只在同一個分頁第一次進站時播放', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const preloader = page.locator('#preloader');
  await expect(preloader).toBeAttached();
  // 約 2.5 秒播完後自己移除
  await expect(preloader).toHaveCount(0, { timeout: 8000 });
  await page.reload();
  await expect(preloader).toHaveCount(0);
});

test.describe('減少動態效果的靜態替代內容', () => {
  test.use({ reducedMotion: 'reduce' });

  test('主視覺改成靜態漸層，設計發想顯示靜態圖，不建立 3D 視窗', async ({ page }) => {
    await page.goto('/years/2025/');
    const hero = page.locator('section[data-view="hero"]');
    await expect(hero).toHaveCSS('background-image', /radial-gradient/);
    await expect(hero).not.toHaveAttribute('data-stage-ready', '');
    await expect(page.locator('[data-view="product"] [data-fallback]').first()).toBeVisible();
    await page.waitForTimeout(1000);
    expect(await views(page)).toBe(0);
  });
});

test('預載畫面總長不超過約 2.2 秒', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const start = Date.now();
  await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 8000 });
  // 測試環境載入較慢，多留一點餘裕
  expect(Date.now() - start).toBeLessThan(3200);
});

test('首頁往下捲時主視覺標題逐字淡出', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 8000 });
  const title = page.locator('#hero-title [data-split-exit]').first();
  // SplitText 會把每個字包一層遮罩，取所有字裡最低的不透明度
  const minOpacity = () =>
    title.evaluate((el) =>
      Math.min(...[...el.querySelectorAll('div')].map((d) => Number(getComputedStyle(d).opacity))),
    );
  await expect.poll(minOpacity, { timeout: 5000 }).toBe(1);
  await page.mouse.wheel(0, 900);
  await expect.poll(minOpacity).toBeLessThan(0.5);
});

test('年度頁的大年份隨捲動變粗', async ({ page }) => {
  await page.goto('/years/2025/');
  const year = page.locator('#year-title [data-weight]');
  await page.mouse.wheel(0, 700);
  await expect
    .poll(async () => year.evaluate((e) => getComputedStyle(e).fontVariationSettings))
    .toMatch(/"wght" (?!300)\d+/);
});
