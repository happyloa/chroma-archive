import { z } from 'astro/zod';
import raw from '../../data/zima.json';
import { buildPalettes, deriveColor } from './color';

/**
 * Zima Blue 彩蛋。不是 Pantone 年度色，所以不放進 data/colors.json，
 * 也不出現在典藏、年份導覽與色彩空間的表格。
 */
const Localized = z.object({ zh: z.string().min(1), en: z.string().min(1) });

const ZimaSchema = z.object({
  name: z.string(),
  hex: z.string().regex(/^#[0-9A-F]{6}$/),
  hexSource: z.url(),
  credit: Localized,
  reveal: z.object({ zh: z.string().max(60), en: z.string() }),
  story: z.object({ zh: z.array(z.string()).min(1), en: z.array(z.string()).min(1) }),
});

const data = ZimaSchema.parse(raw);

export const zima = {
  ...data,
  color: { ...deriveColor(data.hex), name: data.name },
  palettes: buildPalettes(data.hex),
};
