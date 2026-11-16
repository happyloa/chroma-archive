import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/** T073：axe 自動掃描，WCAG 2.2 AA 範圍內不能有 serious 或 critical 的問題 */
test.use({ reducedMotion: 'reduce' });

const pages = [
  '/',
  '/archive/',
  '/years/2025/',
  '/years/2026/',
  '/years/2016/',
  '/years/2025/lab/',
  '/space/',
  '/about/',
  '/en/',
  '/en/years/2021/',
  '/en/years/2021/lab/',
  '/zima/',
];

for (const path of pages) {
  test(`${path} 沒有嚴重的可及性問題`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '只在 Chromium 掃描一次');
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      // WebGL canvas 與隱藏的 3D 區塊只有視覺，已設 aria-hidden
      .exclude('#stage')
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    const report = serious
      .map(
        (v) =>
          `${v.id}（${v.impact}）：${v.help}\n  ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(' '))
            .join('\n  ')}`,
      )
      .join('\n');
    expect(serious, report).toEqual([]);
  });
}
