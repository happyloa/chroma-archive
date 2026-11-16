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
  console.log(`  long tasks: ${long}`);
}
