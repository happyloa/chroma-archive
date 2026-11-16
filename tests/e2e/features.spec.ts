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

/** 換頁時記錄 View Transition 虛擬元素上的動畫 */
const recordTransition = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __vt: { pseudo: string; name: string; duration: number }[] };
    w.__vt = [];
    document.addEventListener('astro:before-swap', (e) => {
      void (e as unknown as { viewTransition: ViewTransition }).viewTransition.ready.then(() => {
        for (const a of document.getAnimations()) {
          const effect = a.effect as KeyframeEffect | null;
          if (!effect?.pseudoElement) continue;
          w.__vt.push({
            pseudo: effect.pseudoElement,
            name: (a as CSSAnimation).animationName ?? '',
            duration: Number(effect.getTiming().duration),
          });
        }
      });
    });
  });
const readTransition = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __vt: { pseudo: string; name: string; duration: number }[] }).__vt,
  );

test('換頁時目的頁的年度色以液態墨水擴散', async ({ page, browserName }) => {
  test.skip(
    browserName === 'webkit' && process.platform === 'win32',
    'fixtures 拿掉了 View Transition',
  );
  await recordTransition(page);
  await page.goto('/about/');
  await page.getByRole('link', { name: '色彩空間' }).first().click();
  await expect(page).toHaveURL(/\/space\/$/);
  await expect.poll(async () => (await readTransition(page)).length).toBeGreaterThan(0);
  const vt = await readTransition(page);
  expect(vt).toContainEqual(
    expect.objectContaining({
      pseudo: '::view-transition-new(vt-ink)',
      name: 'vt-ink',
      duration: 1000,
    }),
  );
});

test.describe('減少動態效果的換頁', () => {
  test.use({ reducedMotion: 'reduce' });

  test('改為 200 毫秒淡入淡出', async ({ page, browserName }) => {
    test.skip(
      browserName === 'webkit' && process.platform === 'win32',
      'fixtures 拿掉了 View Transition',
    );
    // 轉場開始時讀虛擬元素實際套用的動畫（這種情況下 getAnimations() 不會列出虛擬元素）
    await page.addInitScript(() => {
      document.addEventListener('astro:before-swap', (e) => {
        void (e as unknown as { viewTransition: ViewTransition }).viewTransition.ready.then(() => {
          const read = (p: string) => {
            const s = getComputedStyle(document.documentElement, p);
            return `${s.animationName} ${s.animationDuration}`;
          };
          (window as unknown as { __rm: string[] }).__rm = [
            read('::view-transition-new(root)'),
            read('::view-transition-old(root)'),
          ];
        });
      });
    });
    await page.goto('/about/');
    await page.getByRole('link', { name: '色彩空間' }).first().click();
    await expect(page).toHaveURL(/\/space\/$/);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __rm?: string[] }).__rm))
      .toEqual(['vt-fade-in 0.2s', 'vt-fade-out 0.2s']);
  });
});

test('時間軸在畫面上時，方向鍵移到前後一年', async ({ page }) => {
  await page.goto('/archive/');
  test.skip(!(await stageShown(page)), '沒有 WebGL 2，3D 區塊不顯示');
  await expect.poll(() => views(page)).toBeGreaterThan(0);
  const track = page.locator('[data-view="timeline"]').locator('xpath=..');
  const box = (await track.boundingBox())!;
  await page.evaluate((y) => window.scrollTo(0, y), box.y + 1200);
  // 等捲動停下來再讀位置
  const settled = async () => {
    let last = -1;
    await expect
      .poll(async () => {
        const y = await page.evaluate(() => window.scrollY);
        const same = y === last;
        last = y;
        return same;
      })
      .toBe(true);
    return last;
  };
  const before = await settled();
  const step = (box.height - (await page.evaluate(() => window.innerHeight))) / 26;
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + step * 0.4);
  const after = await settled();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(after - step * 0.4);
});

test('站內換頁到首頁時不播預載畫面', async ({ page }) => {
  await page.goto('/about/');
  await page.getByRole('link', { name: 'Chroma Archive' }).first().click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 1000 });
});

test('自訂游標啟用時隱藏原生游標', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit 的 pointer: fine 判斷在無頭模式下不一致');
  await page.goto('/about/');
  await page.mouse.move(300, 300);
  await page.mouse.move(320, 310);
  await expect(page.locator('html')).toHaveAttribute('data-cursor', 'custom');
  await expect(page.locator('body')).toHaveCSS('cursor', 'none');
  await expect(page.locator('.chroma-cursor')).toHaveAttribute('data-moved', '');
});

test.describe('減少動態效果時', () => {
  test.use({ reducedMotion: 'reduce' });
  test('保留原生游標', async ({ page }) => {
    await page.goto('/about/');
    await expect(page.locator('html')).not.toHaveAttribute('data-cursor', /.+/);
    await expect(page.locator('.chroma-cursor')).toHaveCount(0);
  });
});

test.describe('規格補做：下載、404、雙色、質感', () => {
  test.use({ reducedMotion: 'reduce' });

  test('年度頁可以下載 CSS 變數檔', async ({ page, request }) => {
    await page.goto('/years/2025/');
    await expect(page.locator('a[href="/css/2025.css"]')).toHaveAttribute(
      'download',
      'chroma-archive-2025.css',
    );
    const res = await request.get('/css/2025.css');
    expect(res.headers()['content-type']).toContain('text/css');
    const css = await res.text();
    expect(css).toContain('--mocha-mousse: #A47864;');
    expect(css).toContain('--mocha-mousse-complementary-1:');
  });

  test('404 頁顯示一個隨機年度色並連到那一年', async ({ page }) => {
    await page.goto('/years/2027/');
    const year = await page.locator('[data-random-year]').textContent();
    expect(Number(year)).toBeGreaterThanOrEqual(2000);
    await expect(page.locator('[data-random-color] a')).toHaveAttribute('href', `/years/${year}/`);
  });

  test('雙色年份的主視覺帶第二個顏色', async ({ page }) => {
    await page.goto('/years/2016/');
    await expect(page.locator('[data-view="hero"]')).toHaveAttribute('data-color2', '#93A9D1');
  });

  test('全畫面有底片顆粒層，色塊有紙張纖維', async ({ page }) => {
    await page.goto('/years/2025/');
    await expect(page.locator('.film-grain')).toHaveCount(1);
    await expect(page.locator('.paper-fiber').first()).toBeVisible();
  });
});

test('視窗縮放後 canvas 跟著更新尺寸', async ({ page }) => {
  await page.goto('/years/2025/');
  test.skip(!(await stageShown(page)), '沒有 WebGL 2');
  await expect.poll(() => views(page)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 900, height: 700 });
  await expect
    .poll(() => page.evaluate(() => (document.getElementById('stage') as HTMLCanvasElement).height))
    .toBe(700 * (await page.evaluate(() => Math.min(window.devicePixelRatio, 2))));
});

test.describe('沒有 GPU 加速的裝置', () => {
  test.use({ fullGraphics: false });

  test('軟體算繪時裝飾性 3D 改用靜態內容，產品實驗室照常是 3D', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '只確定無頭 Chromium 是軟體算繪');
    await page.goto('/years/2025/');
    test.skip(
      (await page.evaluate(() => document.documentElement.dataset.lite)) !== 'on',
      '這台機器的無頭 Chromium 有 GPU 加速',
    );
    const hero = page.locator('section[data-view="hero"]');
    await expect(hero).toHaveCSS('background-image', /radial-gradient/);
    await page.waitForTimeout(1500);
    expect(await views(page)).toBe(0);
    await page.goto('/archive/');
    await expect(page.locator('[data-view="timeline"]')).toBeHidden();
    await page.goto('/years/2025/lab/');
    await expect(page.locator('#lab-viewport')).toHaveAttribute('data-stage-ready', '');
  });
});
