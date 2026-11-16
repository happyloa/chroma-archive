// CI 用：列出 Lighthouse 每頁的分數、LCP 元素與最長的任務，失敗時不必下載報告也能看出原因
import { readdirSync, readFileSync } from 'node:fs';

const dir = '.lighthouseci';
for (const file of readdirSync(dir).filter((f) => /^lhr-.*\.json$/.test(f))) {
  const r = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
  const a = r.audits;
  const path = new URL(r.finalDisplayedUrl ?? r.finalUrl).pathname;
  const lcp = JSON.stringify(a['lcp-breakdown-insight']?.details ?? {}).match(
    /"snippet":"(.{0,160}?)","nodeLabel":"(.{0,80})/,
  );
  const long = (a['long-tasks']?.details?.items ?? [])
    .slice(0, 5)
    .map(
      (i) =>
        `${(i.url ?? '').split('/').pop() || '(page)'}@${Math.round(i.startTime)}+${Math.round(i.duration)}`,
    )
    .join(' ');
  console.log(
    `${path} perf=${r.categories.performance.score} FCP=${Math.round(a['first-contentful-paint'].numericValue)} LCP=${Math.round(a['largest-contentful-paint'].numericValue)} TBT=${Math.round(a['total-blocking-time'].numericValue)}`,
  );
  console.log(`  LCP element: ${lcp ? `${lcp[1]} | ${lcp[2]}` : '(unknown)'}`);
  // 實際量到的時間（上面是模擬節流後的估計值）；兩者差很多時，看是哪個請求拖慢了 LCP
  const m = a.metrics?.details?.items?.[0] ?? {};
  console.log(
    `  observed: FCP=${Math.round(m.observedFirstContentfulPaint ?? 0)} LCP=${Math.round(m.observedLargestContentfulPaint ?? 0)}`,
  );
  const fonts = (a['network-requests']?.details?.items ?? [])
    .filter((i) => /fraunces|inter/i.test(i.url))
    .map(
      (i) =>
        `${i.url.split('/').pop()?.slice(0, 28)}@${Math.round(i.networkRequestTime ?? 0)}-${Math.round(i.networkEndTime ?? 0)}`,
    )
    .join(' ');
  console.log(`  latin fonts: ${fonts || '(none)'}`);
  console.log(`  long tasks: ${long}`);
}
