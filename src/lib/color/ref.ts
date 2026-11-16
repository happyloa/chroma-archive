/**
 * 顏色引用格式：
 * - `YYYY-N`：某年第 N 個年度色，從 0 起算，例如 `2016-1` 是 Serenity
 * - `#RRGGBB`：任意顏色
 */

export interface YearColors {
  year: number;
  colors: { hex: string }[];
}

export type ColorRef =
  { kind: 'year'; year: number; index: number; hex: string } | { kind: 'hex'; hex: string };

const YEAR_REF = /^(\d{4})-(\d)$/;
const HEX_REF = /^#[0-9a-fA-F]{6}$/;

export function parseColorRef(ref: string, years: readonly YearColors[]): ColorRef {
  const yearMatch = YEAR_REF.exec(ref);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    const index = Number(yearMatch[2]);
    const entry = years.find((y) => y.year === year);
    if (!entry) throw new Error(`顏色引用 "${ref}"：沒有 ${year} 年的資料`);
    const color = entry.colors[index];
    if (!color) throw new Error(`顏色引用 "${ref}"：${year} 年沒有第 ${index} 個顏色`);
    return { kind: 'year', year, index, hex: color.hex.toUpperCase() };
  }
  if (HEX_REF.test(ref)) return { kind: 'hex', hex: ref.toUpperCase() };
  throw new Error(`顏色引用 "${ref}" 格式錯誤，應為 YYYY-N 或 #RRGGBB`);
}

/** 解析失敗時回傳 null，給網址參數這類使用者輸入用 */
export function tryParseColorRef(ref: string, years: readonly YearColors[]): ColorRef | null {
  try {
    return parseColorRef(ref, years);
  } catch {
    return null;
  }
}

export function formatColorRef(ref: ColorRef): string {
  return ref.kind === 'year' ? `${ref.year}-${ref.index}` : ref.hex;
}
