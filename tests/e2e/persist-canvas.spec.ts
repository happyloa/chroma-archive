import { expect, test, type Page } from './fixtures';

type Debug = ReturnType<NonNullable<Window['__chroma']>>;

const readDebug = (page: Page) => page.evaluate(() => window.__chroma!()) as Promise<Debug>;

/** 等這一頁的 3D 視窗都建立好、而且又畫了幾格，GPU 資源數字才穩定 */
async function settle(page: Page): Promise<Debug> {
  const views = page.locator('main [data-view]');
  await expect(views.first()).toHaveAttribute('data-stage-ready', '');
  const count = await views.count();
  await expect.poll(async () => (await readDebug(page)).views).toBe(count);
  const frames = (await readDebug(page)).frames;
  await expect.poll(async () => (await readDebug(page)).frames).toBeGreaterThan(frames + 10);
  return readDebug(page);
}

async function go(page: Page, testId: 'next-year' | 'prev-year', year: number): Promise<void> {
  await page.getByTestId(testId).click();
  await expect(page).toHaveURL(new RegExp(`/years/${year}/$`));
}

// T005：canvas 跨頁保留、renderer 不重建、ticker 不重複註冊、GPU 資源不增長
test('在年度頁之間換頁 20 次後 WebGL 舞台仍是同一個', async ({ page }) => {
  // 每次換頁有 0.9 秒轉場，加上軟體算繪建立 3D 視窗，20 次會超過預設的 30 秒
  test.setTimeout(150_000);
  await page.goto('/years/2010/');
  // 暖身一輪：產品幾何有共用快取（products/shared.ts），第一次畫到時才上傳 GPU
  await go(page, 'next-year', 2011);
  await go(page, 'prev-year', 2010);
  const before = await settle(page);
  await page.evaluate(() => {
    (document.getElementById('stage') as HTMLCanvasElement & { __marker?: number }).__marker = 42;
  });

  for (let i = 0; i < 20; i++) {
    if (i % 2 === 0) await go(page, 'next-year', 2011);
    else await go(page, 'prev-year', 2010);
  }

  const after = await settle(page);
  const marker = await page.evaluate(
    () => (document.getElementById('stage') as HTMLCanvasElement & { __marker?: number }).__marker,
  );

  expect(marker, 'canvas 元素沒有被換掉').toBe(42);
  expect(after.stageInstances).toBe(1);
  expect(after.sameCanvas).toBe(true);
  expect(after.pageLoads).toBe(before.pageLoads + 20);
  expect(after.tickerCallbacks).toBe(before.tickerCallbacks);
  expect(after.geometries).toBe(before.geometries);
  expect(after.textures).toBe(before.textures);
  expect(after.programs).toBe(before.programs);
  expect(after.frames).toBeGreaterThan(before.frames);
});

test('瀏覽器上一頁也保留舞台', async ({ page }) => {
  await page.goto('/years/2010/');
  await page.getByTestId('next-year').click();
  await expect(page).toHaveURL(/\/years\/2011\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/years\/2010\/$/);
  await expect.poll(async () => (await readDebug(page)).stageInstances).toBe(1);
  expect((await readDebug(page)).sameCanvas).toBe(true);
});
