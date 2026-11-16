import { expect, test, type Page } from '@playwright/test';

type Debug = ReturnType<NonNullable<Window['__chroma']>>;

const readDebug = (page: Page) => page.evaluate(() => window.__chroma!()) as Promise<Debug>;

// T005：canvas 跨頁保留、renderer 不重建、ticker 不重複註冊、GPU 資源不增長
test('在年度頁之間換頁 20 次後 WebGL 舞台仍是同一個', async ({ page }) => {
  await page.goto('/years/2010/');
  await expect.poll(async () => (await readDebug(page)).frames).toBeGreaterThan(5);

  const before = await readDebug(page);
  await page.evaluate(() => {
    (document.getElementById('stage') as HTMLCanvasElement & { __marker?: number }).__marker = 42;
  });

  for (let i = 0; i < 20; i++) {
    const testId = i % 2 === 0 ? 'next-year' : 'prev-year';
    const expected = i % 2 === 0 ? '2011' : '2010';
    await page.getByTestId(testId).click();
    await expect(page).toHaveURL(new RegExp(`/years/${expected}/$`));
  }

  const after = await readDebug(page);
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
