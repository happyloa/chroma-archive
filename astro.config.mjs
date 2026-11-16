// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  // 正式網域確定後改成實際網址（tasks.md T076）
  site: 'https://chroma-archive.example.com',
  prefetch: { prefetchAll: true },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // three.js 的 chunk 未壓縮約 520 KB；實際預算以 gzip 計算（憲章第 3 條）
      chunkSizeWarningLimit: 700,
    },
  },
});
