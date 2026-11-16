import { wcagContrast } from 'culori';
import { describe, expect, it } from 'vitest';
import colors from '../../data/colors.json';
import { buildPalettes, scrollbarColors } from '../../src/lib/color';

/** 捲軸滑塊與軌道的對比（WCAG 1.4.11 非文字元件至少 3:1） */
const hexes = colors.years.flatMap((y) =>
  y.colors.map((c) => ({ year: y.year, name: c.name, hex: c.hex })),
);

describe('scrollbarColors', () => {
  it('列出原本做法（滑塊＝年度色、軌道＝互補色）的對比', () => {
    const rows = hexes.map(({ year, name, hex }) => {
      const track = buildPalettes(hex).complementary[1]!;
      return `${year} ${name.padEnd(16)} ${wcagContrast(hex, track).toFixed(2)}`;
    });
    console.log(`原本做法：\n${rows.join('\n')}`);
    expect(rows.length).toBe(hexes.length);
  });

  it.each(hexes)('$year $name：滑塊與軌道對比至少 3:1，滑塊仍是年度色', ({ hex }) => {
    const { thumb, track } = scrollbarColors(hex);
    expect(thumb).toBe(hex.toUpperCase());
    expect(wcagContrast(thumb, track)).toBeGreaterThanOrEqual(3);
  });
});
