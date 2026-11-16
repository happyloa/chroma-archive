import { expect, test } from './fixtures';

/*
 * T025：reduced-motion 下的靜態截圖基準。
 * 截圖會因作業系統字型渲染不同而有差異，所以只在本機跑（npm run test:visual），CI 不跑。
 * 版面有意改動時用 npm run test:visual -- --update-snapshots 更新基準。
 */
test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

const pages = [
  ['home', '/'],
  ['archive', '/archive/'],
  ['year-2025', '/years/2025/'],
  ['year-2016', '/years/2016/'],
  ['lab-2025', '/years/2025/lab/'],
  ['space', '/space/'],
  ['about', '/about/'],
  ['zima', '/zima/'],
] as const;

for (const [name, path] of pages) {
  test(`${name} @visual`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      // WebGL canvas 不列入比對
      mask: [page.locator('#stage')],
      maxDiffPixelRatio: 0.01,
    });
  });
}
