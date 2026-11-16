import type { YearEntry } from '../lib/data';
import type { Lang } from './ui';

/** 依語系取年度內容的摘要與關鍵字；英文缺漏時退回中文 */
export function localizedContent(entry: YearEntry, lang: Lang) {
  const en = lang === 'en' ? entry.content.en : undefined;
  return {
    summary: en?.summary ?? entry.content.summary,
    keywords: en?.keywords ?? entry.content.keywords,
  };
}

/** 色名：中文頁用「英文名」加「中文譯名」，英文頁只用英文名 */
export function colorNames(entry: YearEntry) {
  return {
    names: entry.colors.map((c) => c.name).join(' & '),
    namesZh: entry.colors.map((c) => c.nameZh).join('、'),
  };
}
