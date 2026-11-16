import type { APIRoute, GetStaticPaths } from 'astro';
import { encodeAse, type AseGroup } from '../../lib/ase';
import { getYears, type YearEntry } from '../../lib/data';
import { PALETTE_KINDS, type PaletteKind } from '../../lib/color';

/** 建置時產生每年的 .ase 色票檔（T082）：年度色本身加上五組配色，每組一個群組 */
const KINDS = PALETTE_KINDS;
const KIND_NAMES: Record<PaletteKind, string> = {
  complementary: 'Complementary',
  analogous: 'Analogous',
  triadic: 'Triadic',
  split: 'Split complementary',
  mono: 'Monochrome',
};

export const getStaticPaths = (async () => {
  const years = await getYears();
  return years.map((entry) => ({ params: { year: String(entry.year) }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { entry } = props as { entry: YearEntry };
  const groups: AseGroup[] = [
    {
      name: `${entry.year} Color of the Year`,
      colors: entry.colors.map((c) => ({ name: `${c.name} ${c.code}`, hex: c.hex })),
    },
  ];
  for (const c of entry.colors) {
    for (const kind of KINDS) {
      groups.push({
        name: `${c.name} · ${KIND_NAMES[kind]}`,
        colors: c.palettes[kind].map((hex, i) => ({
          name: `${KIND_NAMES[kind]} ${i + 1} ${hex}`,
          hex,
        })),
      });
    }
  }
  return new Response(new Uint8Array(encodeAse(groups)).buffer as ArrayBuffer, {
    headers: { 'Content-Type': 'application/octet-stream' },
  });
};
