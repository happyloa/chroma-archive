// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  // 與 wrangler.jsonc 的 auto-trailing-slash 一致，站內連結一律帶尾斜線
  trailingSlash: 'always',
  // 正式網域確定後改成實際網址（tasks.md T076）
  site: 'https://chroma-archive.example.com',
  prefetch: { prefetchAll: true },
  // 中英雙語（US-13）：繁體中文不加前綴，英文在 /en/
  i18n: {
    locales: ['zh-tw', 'en'],
    defaultLocale: 'zh-tw',
    routing: { prefixDefaultLocale: false },
  },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // three.js 的 chunk 未壓縮約 520 KB；實際預算以 gzip 計算（憲章第 3 條）
      chunkSizeWarningLimit: 700,
    },
  },
});
