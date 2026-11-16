import { getCollection } from 'astro:content';
import colorsFile from '../../data/colors.json';
import { buildYearEntries, type YearEntry } from './entries';

let cache: Promise<YearEntry[]> | null = null;

/** 全部年度色，依年份遞增。建置期間只計算一次。 */
export function getYears(): Promise<YearEntry[]> {
  cache ??= getCollection('years').then((docs) =>
    buildYearEntries(
      colorsFile,
      docs.map((d) => ({ id: d.id, data: d.data, body: d.body })),
    ),
  );
  return cache;
}

/** 最新一年（首頁 Hero 使用） */
export async function getLatestYear(): Promise<YearEntry> {
  const years = await getYears();
  return years[years.length - 1]!;
}

export type { YearEntry, YearColor } from './entries';
