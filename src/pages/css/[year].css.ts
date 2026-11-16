import type { APIRoute, GetStaticPaths } from 'astro';
import { getYears, type YearEntry } from '../../lib/data';
import type { PaletteKind } from '../../lib/color';

/**
 * 年度色與五組配色的 CSS 變數檔（US-03-4）。變數名稱和配色區塊「複製」按鈕的一樣：
 * --色名-配色-序號，例如 --mocha-mousse-complementary-1。
 */
export const getStaticPaths = (async () => {
  const years = await getYears();
  return years.map((entry) => ({ params: { year: String(entry.year) }, props: { entry } }));
}) satisfies GetStaticPaths;

const KINDS: PaletteKind[] = ['complementary', 'analogous', 'triadic', 'split', 'mono'];
const slug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

export const GET: APIRoute = ({ props }) => {
  const { entry } = props as { entry: YearEntry };
  const lines = [
    `/* Chroma Archive · Pantone Color of the Year ${entry.year} · ${entry.colors.map((c) => c.name).join(' & ')} */`,
    '/* 螢幕近似色，非官方色彩標準。Screen approximations, not official color standards. */',
    ':root {',
  ];
  for (const c of entry.colors) {
    const s = slug(c.name);
    lines.push(`  --${s}: ${c.hex};`);
    for (const kind of KINDS) {
      c.palettes[kind].forEach((hex, i) => lines.push(`  --${s}-${kind}-${i + 1}: ${hex};`));
    }
  }
  lines.push('}', '');
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
};
