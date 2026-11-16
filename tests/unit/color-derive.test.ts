import { describe, expect, it } from 'vitest';
import { rgb } from 'culori';
import {
  buildPalettes,
  deltaE,
  deriveColor,
  INK,
  PAPER,
  pickInk,
  toOklch,
} from '../../src/lib/color';

const inGamut = (hex: string) => {
  const c = rgb(hex)!;
  return [c.r, c.g, c.b].every((v) => v >= -1e-6 && v <= 1 + 1e-6);
};

describe('deriveColor', () => {
  it('Mocha Mousse 的各色彩空間數值', () => {
    const d = deriveColor('#a47864');
    expect(d.hex).toBe('#A47864');
    expect(d.rgb).toEqual([164, 120, 100]);
    expect(d.hsl).toEqual([19, 26, 52]);
    expect(d.lab).toEqual({ l: 54.3, a: 14.5, b: 17.7 });
    expect(d.oklch.l).toBeCloseTo(0.6, 1);
    expect(d.isLight).toBe(false);
  });

  it('Cloud Dancer 觸發淺色年份規則，文字用深色', () => {
    const d = deriveColor('#F0EEE9');
    expect(d.isLight).toBe(true);
    expect(d.ink).toBe(INK);
    expect(d.needsPlate).toBe(false);
  });

  it('Classic Blue 文字用淺色', () => {
    expect(deriveColor('#0F4C81').ink).toBe(PAPER);
  });
});

describe('pickInk', () => {
  it('中間調灰色黑白對比都不足時要求底板', () => {
    // #777777 對近黑約 4.1、對紙白約 4.1
    const { needsPlate } = pickInk('#777777');
    expect(needsPlate).toBe(true);
  });
});

describe('buildPalettes', () => {
  const hexes = ['#A47864', '#BB2649', '#F0EEE9', '#939597', '#FF6F61', '#009473'];

  it.each(hexes)('%s 的配色數量正確且都在 sRGB 內', (hex) => {
    const p = buildPalettes(hex);
    expect(p.complementary).toHaveLength(4);
    expect(p.analogous).toHaveLength(3);
    expect(p.triadic).toHaveLength(3);
    expect(p.split).toHaveLength(3);
    expect(p.mono).toHaveLength(5);
    for (const color of Object.values(p).flat()) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
      expect(inGamut(color)).toBe(true);
    }
  });

  it('互補色相差約 180 度', () => {
    const [, comp] = buildPalettes('#BB2649').complementary;
    const a = toOklch('#BB2649').h;
    const b = toOklch(comp!).h;
    const diff = Math.abs(((((b - a) % 360) + 360) % 360) - 180);
    expect(diff).toBeLessThan(8);
  });

  it('無彩色（白、灰）的配色仍有可分辨的色相', () => {
    const p = buildPalettes('#F0EEE9');
    expect(new Set(p.triadic).size).toBe(3);
    expect(toOklch(p.triadic[1]!).c).toBeGreaterThan(0.03);
  });

  it('單色配色明度遞增', () => {
    const ls = buildPalettes('#6667AB').mono.map((h) => toOklch(h).l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeGreaterThan(ls[i - 1]!);
  });
});

describe('deltaE', () => {
  it('相同顏色為 0，不同顏色為正數', () => {
    expect(deltaE('#A47864', '#A47864')).toBe(0);
    expect(deltaE('#A47864', '#FFBE98')).toBeCloseTo(22.6, 1);
  });
});
