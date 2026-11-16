import type { PaletteKind } from './derive';

/** 五組配色的順序，年度頁、彩蛋頁、.ase 與 CSS 變數檔共用 */
export const PALETTE_KINDS: PaletteKind[] = [
  'complementary',
  'analogous',
  'triadic',
  'split',
  'mono',
];

/** CSS 變數用的色名，例如 Mocha Mousse → mocha-mousse */
export function cssVarSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/** 配色的 CSS 變數名稱，例如 --mocha-mousse-complementary-1 */
export function paletteVar(slug: string, kind: PaletteKind, index: number): string {
  return `--${slug}-${kind}-${index + 1}`;
}
