import {
  clampChroma,
  differenceCiede2000,
  formatHex,
  hsl,
  lab65,
  oklch,
  rgb,
  wcagContrast,
  type Oklch,
} from 'culori';

export const INK = '#0E0E0E';
export const PAPER = '#F4F2EE';

/** OKLCH 明度超過這個值就套用淺色年份規則（spec.md 第 7 節） */
export const LIGHT_THRESHOLD = 0.85;
/** WCAG AA 內文對比 */
export const MIN_CONTRAST = 4.5;
/** 彩度低於這個值視為無彩色，配色改用最低彩度產生 */
export const ACHROMATIC_CHROMA = 0.02;
const HARMONY_MIN_CHROMA = 0.06;

export type PaletteKind = 'complementary' | 'analogous' | 'triadic' | 'split' | 'mono';

export interface DerivedColor {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  oklch: { l: number; c: number; h: number };
  lab: { l: number; a: number; b: number };
  /** 放在這個顏色上的文字色 */
  ink: typeof INK | typeof PAPER;
  /** 黑白對比都不足 4.5:1，文字需要底板 */
  needsPlate: boolean;
  /** OKLCH 明度 > 0.85 */
  isLight: boolean;
  palettes: Record<PaletteKind, string[]>;
}

const round = (n: number, digits = 0): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

const normalizeHex = (hex: string): string => hex.toUpperCase();

export function toOklch(hex: string): Required<Oklch> {
  const c = oklch(hex);
  if (!c) throw new Error(`無法解析顏色：${hex}`);
  return { mode: 'oklch', l: c.l, c: c.c, h: c.h ?? 0, alpha: 1 };
}

/** 超出 sRGB 的顏色以降低彩度的方式拉回色域，輸出大寫 HEX */
export function oklchToHex(l: number, c: number, h: number): string {
  const color = clampChroma({ mode: 'oklch', l, c, h: ((h % 360) + 360) % 360 }, 'oklch');
  return normalizeHex(formatHex(color));
}

export function pickInk(hex: string): { ink: typeof INK | typeof PAPER; needsPlate: boolean } {
  const onInk = wcagContrast(hex, INK);
  const onPaper = wcagContrast(hex, PAPER);
  const ink = onInk >= onPaper ? INK : PAPER;
  return { ink, needsPlate: Math.max(onInk, onPaper) < MIN_CONTRAST };
}

export function buildPalettes(hex: string): Record<PaletteKind, string[]> {
  const { l, c, h } = toOklch(hex);
  // 白、灰這類無彩色轉色相不會有變化，配色改用最低彩度的淡色
  const hc = c < ACHROMATIC_CHROMA ? HARMONY_MIN_CHROMA : c;
  const at = (dh: number, dl = 0, chroma = hc) =>
    oklchToHex(Math.min(0.97, Math.max(0.15, l + dl)), chroma, h + dh);
  const base = normalizeHex(hex);

  return {
    complementary: [base, at(180), at(180, 0.2), oklchToHex(Math.max(0.15, l - 0.25), c, h)],
    analogous: [at(-30), base, at(30)],
    triadic: [base, at(120), at(240)],
    split: [base, at(150), at(210)],
    mono: [0.25, 0.42, 0.6, 0.78, 0.95].map((ml) => oklchToHex(ml, c, h)),
  };
}

export function deriveColor(hexInput: string): DerivedColor {
  const hex = normalizeHex(hexInput);
  const r = rgb(hex);
  const s = hsl(hex);
  const lab = lab65(hex);
  if (!r || !s || !lab) throw new Error(`無法解析顏色：${hex}`);
  const o = toOklch(hex);

  return {
    hex,
    rgb: [round(r.r * 255), round(r.g * 255), round(r.b * 255)],
    hsl: [round(s.h ?? 0), round(s.s * 100), round(s.l * 100)],
    oklch: { l: round(o.l, 3), c: round(o.c, 3), h: round(o.h, 1) },
    lab: { l: round(lab.l, 1), a: round(lab.a, 1), b: round(lab.b, 1) },
    ...pickInk(hex),
    isLight: o.l > LIGHT_THRESHOLD,
    palettes: buildPalettes(hex),
  };
}

const ciede2000 = differenceCiede2000();

/** 兩個顏色的 CIEDE2000 色差，取一位小數 */
export function deltaE(a: string, b: string): number {
  return round(ciede2000(a, b), 1);
}
