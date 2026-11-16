// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  // 正式網域確定後改成實際網址（tasks.md T076）
  site: 'https://chroma-archive.example.com',
  prefetch: { prefetchAll: true },
  devToolbar: { enabled: false },
});
