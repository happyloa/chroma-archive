import { getYears } from './data';

/** 年度頁與產品實驗室共用的靜態路徑（中英兩個語系各一份路由檔） */
export async function yearPaths() {
  const years = await getYears();
  return years.map((entry) => ({ params: { year: String(entry.year) }, props: { entry, years } }));
}
