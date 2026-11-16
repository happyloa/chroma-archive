import { describe, expect, it } from 'vitest';
import data from '../../data/colors.json';

// 正式的 schema 驗證在 src/lib/schema.ts 與 src/lib/entries.ts；這裡先確認資料的基本形狀
describe('data/colors.json', () => {
  it('年份從 2000 開始連續遞增、不重複', () => {
    const years = data.years.map((y) => y.year);
    expect(years[0]).toBe(2000);
    years.forEach((year, i) => expect(year).toBe(2000 + i));
  });

  it('每年有 1 到 2 個顏色，HEX 與色號格式正確', () => {
    for (const entry of data.years) {
      expect(entry.colors.length).toBeGreaterThanOrEqual(1);
      expect(entry.colors.length).toBeLessThanOrEqual(2);
      for (const c of entry.colors) {
        expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
        expect(c.code).toMatch(/^\d{2}-\d{4}$/);
      }
    }
  });
});
