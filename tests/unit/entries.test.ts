import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import colors from '../../data/colors.json';
import { buildYearEntries, type ContentInput } from '../../src/lib/entries';
import { YearContentSchema } from '../../src/lib/schema';

const content = (year: number, extra: Record<string, unknown> = {}): ContentInput => ({
  id: String(year),
  data: YearContentSchema.parse({ year, summary: 's', keywords: ['a', 'b', 'c', 'd'], ...extra }),
  body: '',
});

const allContents = () => colors.years.map((y) => content(y.year));

describe('buildYearEntries', () => {
  it('合併後數量與年份一致，並計算相鄰年份', () => {
    const entries = buildYearEntries(colors, allContents());
    expect(entries).toHaveLength(colors.years.length);
    const y2025 = entries.find((e) => e.year === 2025)!;
    expect(y2025.prev?.year).toBe(2024);
    expect(y2025.next?.year).toBe(2026);
    expect(y2025.prev!.deltaE).toBeGreaterThan(0);
    expect(entries[0]!.prev).toBeUndefined();
    expect(entries.at(-1)!.next).toBeUndefined();
  });

  it('雙色年份兩個顏色都有衍生值', () => {
    const y2016 = buildYearEntries(colors, allContents()).find((e) => e.year === 2016)!;
    expect(y2016.colors.map((c) => c.name)).toEqual(['Rose Quartz', 'Serenity']);
    expect(y2016.colors[1]!.palettes.triadic).toHaveLength(3);
  });

  it('HEX 格式錯誤時指出年份與欄位', () => {
    const bad = structuredClone(colors);
    bad.years[3]!.colors[0]!.hex = '#7bc4c4';
    expect(() => buildYearEntries(bad, allContents())).toThrow(/2003 年 years\.3\.colors\.0\.hex/);
  });

  it('缺少 Markdown 時建置失敗', () => {
    expect(() => buildYearEntries(colors, allContents().slice(1))).toThrow(
      '缺少 src/content/years/2000.md',
    );
  });

  it('年份順序錯誤時建置失敗', () => {
    const bad = structuredClone(colors);
    [bad.years[0], bad.years[1]] = [bad.years[1]!, bad.years[0]!];
    expect(() => buildYearEntries(bad, allContents())).toThrow('年份需遞增');
  });

  it('CMF 引用不存在的年份時建置失敗', () => {
    const concept = {
      id: 'x',
      title: 't',
      category: 'furniture',
      pitch: 'p',
      audience: 'a',
      cmf: { primary: '1999-0', material: 'm', finish: 'matte' },
      labPreset: { product: 'chair' },
    };
    const contents = allContents();
    contents[0] = content(2000, { concepts: [concept] });
    expect(() => buildYearEntries(colors, contents)).toThrow('沒有 1999 年');
  });
});

describe('YearContentSchema', () => {
  it('reviewed 年份缺設計發想時驗證失敗', () => {
    const r = YearContentSchema.safeParse({
      year: 2025,
      summary: 's',
      keywords: ['a', 'b', 'c', 'd'],
      status: 'reviewed',
    });
    expect(r.success).toBe(false);
  });

  it('src/content/years 每個年份檔都有對應的 colors.json 資料', () => {
    const files = readdirSync('src/content/years').filter((f) => /^\d{4}\.md$/.test(f));
    expect(files.map((f) => Number(f.slice(0, 4)))).toEqual(colors.years.map((y) => y.year));
    for (const f of files) {
      expect(readFileSync(`src/content/years/${f}`, 'utf8')).toMatch(/^---\nyear: \d{4}\n/);
    }
  });
});
