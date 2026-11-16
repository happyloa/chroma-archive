import { deltaE, deriveColor, parseColorRef, type DerivedColor } from './color';
import { ColorsFileSchema, type ColorEntry, type YearContent } from './schema';

export interface YearColor extends ColorEntry, DerivedColor {}

export interface Neighbor {
  year: number;
  hex: string;
  /** 與本年第一個顏色的 CIEDE2000 色差 */
  deltaE: number;
}

export interface YearEntry {
  year: number;
  announced?: string;
  colors: YearColor[];
  content: YearContent;
  /** Markdown 內文是否有色彩故事 */
  hasStory: boolean;
  prev?: Neighbor;
  next?: Neighbor;
}

export interface ContentInput {
  /** 檔名（不含副檔名），應等於年份 */
  id: string;
  data: YearContent;
  body?: string;
}

/**
 * 合併 colors.json 與 Markdown 內容並計算衍生值。
 * 不依賴 astro:content，方便單元測試；任何資料問題都會拋錯讓建置失敗。
 */
export function buildYearEntries(
  rawColors: unknown,
  contents: readonly ContentInput[],
): YearEntry[] {
  const parsed = ColorsFileSchema.safeParse(rawColors);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => {
      const path = i.path.join('.');
      const yearIndex = i.path[1];
      const year =
        typeof yearIndex === 'number' && Array.isArray((rawColors as { years?: unknown[] })?.years)
          ? ((rawColors as { years: { year?: number }[] }).years[yearIndex]?.year ?? '?')
          : '?';
      return `  - ${year} 年 ${path}：${i.message}`;
    });
    throw new Error(`data/colors.json 格式錯誤：\n${issues.join('\n')}`);
  }

  const years = parsed.data.years;
  const errors: string[] = [];

  years.forEach((y, i) => {
    const prev = years[i - 1];
    if (prev && y.year <= prev.year)
      errors.push(`${y.year} 年：年份需遞增且不可重複（前一筆是 ${prev.year}）`);
  });

  const contentByYear = new Map<number, ContentInput>();
  for (const c of contents) {
    if (c.id !== String(c.data.year)) {
      errors.push(`${c.id}.md：檔名與 frontmatter 的 year（${c.data.year}）不一致`);
    }
    contentByYear.set(c.data.year, c);
  }

  const yearSet = new Set(years.map((y) => y.year));
  for (const y of years) {
    if (!contentByYear.has(y.year))
      errors.push(`${y.year} 年：缺少 src/content/years/${y.year}.md`);
  }
  for (const year of contentByYear.keys()) {
    if (!yearSet.has(year)) errors.push(`${year}.md：data/colors.json 沒有 ${year} 年的資料`);
  }

  // CMF 欄位裡的顏色引用都要能解析
  for (const c of contents) {
    for (const concept of c.data.concepts) {
      for (const ref of [concept.cmf.primary, concept.cmf.accent].filter(Boolean) as string[]) {
        try {
          parseColorRef(ref, years);
        } catch (e) {
          errors.push(`${c.id}.md 概念 ${concept.id}：${(e as Error).message}`);
        }
      }
    }
  }

  if (errors.length)
    throw new Error(`年度色資料檢查失敗：\n${errors.map((e) => `  - ${e}`).join('\n')}`);

  const entries = years.map<YearEntry>((y) => {
    const content = contentByYear.get(y.year)!;
    return {
      year: y.year,
      announced: y.announced,
      colors: y.colors.map((c) => ({ ...c, ...deriveColor(c.hex) })),
      content: content.data,
      hasStory: (content.body ?? '').trim().length > 0,
    };
  });

  entries.forEach((e, i) => {
    const toNeighbor = (n: YearEntry | undefined): Neighbor | undefined =>
      n && {
        year: n.year,
        hex: n.colors[0]!.hex,
        deltaE: deltaE(e.colors[0]!.hex, n.colors[0]!.hex),
      };
    e.prev = toNeighbor(entries[i - 1]);
    e.next = toNeighbor(entries[i + 1]);
  });

  return entries;
}
