import { expect, test } from '@playwright/test';

test('3D 視窗就緒後隱藏替代圖、啟用匯出', async ({ page }) => {
  await page.goto('/years/2025/lab/');
  const viewport = page.locator('#lab-viewport');
  await expect(viewport).toHaveAttribute('data-stage-ready', '');
  await expect(viewport.locator('[data-fallback]').first()).toBeHidden();
  await expect(page.locator('#lab-export')).toBeEnabled();
});

test('切換選項時網址參數同步，重新整理後還原', async ({ page }) => {
  await page.goto('/years/2025/lab/');
  await expect(page.locator('#lab-viewport')).toHaveAttribute('data-stage-ready', '');
  await page.getByText('耳罩式耳機').click();
  await page.getByText('亮面').click();
  await page.locator('label[title="2019 Living Coral"]').click();
  await expect(page).toHaveURL(/p=headphones/);
  await expect(page).toHaveURL(/f=gloss/);
  await expect(page).toHaveURL(/c1=2019-0/);

  await page.reload();
  await expect(page.locator('input[name="p"]:checked')).toHaveValue('headphones');
  await expect(page.locator('input[name="f"]:checked')).toHaveValue('gloss');
  await expect(page.locator('input[name="c1"]:checked')).toHaveValue('2019-0');
});

test('情境場景、鏡頭與自轉寫進網址並還原', async ({ page }) => {
  await page.goto('/years/2025/lab/');
  await expect(page.locator('#lab-viewport')).toHaveAttribute('data-stage-ready', '');
  await page.getByText('客廳', { exact: true }).click();
  await page.getByText('俯視', { exact: true }).click();
  await page.getByText('自動旋轉').click();
  await expect(page).toHaveURL(/s=living/);
  await expect(page).toHaveURL(/cam=top/);
  await expect(page).toHaveURL(/spin=0/);

  await page.reload();
  await expect(page.locator('input[name="s"]:checked')).toHaveValue('living');
  await expect(page.locator('input[name="cam"]:checked')).toHaveValue('top');
  await expect(page.locator('input[name="spin"]')).not.toBeChecked();
});

const TETRA_STL = `solid t
facet normal 0 0 -1
outer loop
vertex 0 0 0
vertex 1 0 0
vertex 0 1 0
endloop
endfacet
facet normal 0 -1 0
outer loop
vertex 0 0 0
vertex 0 0 1
vertex 1 0 0
endloop
endfacet
facet normal -1 0 0
outer loop
vertex 0 0 0
vertex 0 1 0
vertex 0 0 1
endloop
endfacet
facet normal 1 1 1
outer loop
vertex 1 0 0
vertex 0 0 1
vertex 0 1 0
endloop
endfacet
endsolid t`;

test('上傳模型只在瀏覽器讀取，不送出任何請求', async ({ page }) => {
  await page.goto('/years/2025/lab/');
  await expect(page.locator('#lab-viewport')).toHaveAttribute('data-stage-ready', '');
  const outgoing: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET') outgoing.push(`${r.method()} ${r.url()}`);
  });

  await page.locator('#lab-upload').setInputFiles({
    name: 'tetra.stl',
    mimeType: 'model/stl',
    buffer: Buffer.from(TETRA_STL),
  });
  await expect(page.locator('#lab-upload-status')).toContainText('已載入 tetra.stl');
  await expect(page.locator('#lab-custom-option')).toBeVisible();
  await expect(page.locator('input[name="p"]:checked')).toHaveValue('custom');
  // 分享網址不帶上傳的模型
  await expect(page).not.toHaveURL(/p=custom/);
  expect(outgoing).toEqual([]);
});

test('拒絕不支援的檔案類型', async ({ page }) => {
  await page.goto('/years/2025/lab/');
  await expect(page.locator('#lab-viewport')).toHaveAttribute('data-stage-ready', '');
  await page.locator('#lab-upload').setInputFiles({
    name: 'model.fbx',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('not a model'),
  });
  await expect(page.locator('#lab-upload-status')).toContainText('不支援 .fbx');
  await expect(page.locator('#lab-custom-option')).toBeHidden();
});

test('匯出 2048 × 2048 PNG', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', '下載事件只在 Chromium 驗證');
  await page.goto('/years/2025/lab/?p=vase&f=satin');
  await expect(page.locator('#lab-export')).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#lab-export').click(),
  ]);
  expect(download.suggestedFilename()).toBe('chroma-archive-2025-0-vase-satin.png');
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const png = readFileSync(path);
  // PNG IHDR：寬高在第 16 到 23 位元組
  expect(png.readUInt32BE(16)).toBe(2048);
  expect(png.readUInt32BE(20)).toBe(2048);
});

test('換頁離開實驗室時釋放 3D 視窗', async ({ page }) => {
  await page.goto('/years/2025/lab/');
  await expect(page.locator('#lab-viewport')).toHaveAttribute('data-stage-ready', '');
  expect(await page.evaluate(() => window.__chroma!().views)).toBe(1);
  await page.getByRole('link', { name: '2025 Mocha Mousse' }).click();
  await expect(page).toHaveURL(/\/years\/2025\/$/);
  await expect.poll(() => page.evaluate(() => window.__chroma!().views)).toBe(0);
});
