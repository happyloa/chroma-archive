import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import colors from '../../data/colors.json';
import { parseColorRef } from '../../src/lib/color';
import { YearContentSchema } from '../../src/lib/schema';

/** 驗證 src/content/years/*.md 的 frontmatter 與內文（撰寫內容時可單獨執行這個測試） */
const files = readdirSync('src/content/years').filter((f) => /^\d{4}\.md$/.test(f));

function read(file: string) {
  const raw = readFileSync(`src/content/years/${file}`, 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match) throw new Error(`${file}：找不到 frontmatter`);
  return { data: parse(match[1]!), body: match[2]!.trim() };
}

describe.each(files)('%s', (file) => {
  const { data, body } = read(file);

  it('符合 schema', () => {
    const result = YearContentSchema.safeParse(data);
    if (!result.success) {
      throw new Error(
        result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'),
      );
    }
  });

  it('設計發想的顏色引用都存在', () => {
    for (const c of data.concepts ?? []) {
      for (const ref of [c.cmf.primary, c.cmf.accent].filter(Boolean)) {
        expect(() => parseColorRef(ref, colors.years)).not.toThrow();
      }
    }
  });

  it('有內容時：3 個概念用不同產品，故事長度合理', () => {
    if (!data.concepts?.length) return;
    expect(data.concepts).toHaveLength(3);
    const products = data.concepts.map(
      (c: { labPreset: { product: string } }) => c.labPreset.product,
    );
    expect(new Set(products).size).toBe(3);
    expect(data.materials).toBeTruthy();
    // 中文故事 200 到 600 字
    const chars = body.replace(/\s/g, '').length;
    expect(chars).toBeGreaterThanOrEqual(200);
    expect(chars).toBeLessThanOrEqual(600);
    expect(data.en?.story?.split(/\s+/).length ?? 0).toBeGreaterThanOrEqual(60);
    for (const c of data.concepts) expect(c.en).toBeTruthy();
  });

  it('沒有 AI 寫作常見的破折號與「不是…而是」句型', () => {
    const text = `${body}\n${JSON.stringify(data)}`;
    expect(text).not.toMatch(/[—–]/);
    expect(text).not.toMatch(/不是[^。，]{1,20}而是/);
  });
});
