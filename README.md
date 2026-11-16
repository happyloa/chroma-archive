# Chroma Archive

Pantone 歷年年度代表色（2000 至今）的展示網站：色值、配色，以及 3D 產品設計發想。

網站：https://chroma-archive.piafyoyo06.workers.dev

技術：Astro、three.js、GSAP、Lenis、Tailwind CSS，部署在 Cloudflare Workers。

> 本站為個人作品，與 Pantone LLC 無關。色值皆為螢幕近似值，不是官方色彩標準。PANTONE® 為 Pantone LLC 的註冊商標。

## 開發

需要 Node.js 22.23.4 以上。

```bash
npm install
npm run dev          # http://localhost:4321
npm run build
npm run deploy       # 建置並部署到 Cloudflare Workers
```

```bash
npm run lint
npm run check        # 型別檢查
npm test             # 單元測試
npm run test:e2e     # Playwright（Chromium、WebKit）
npm run test:visual  # 截圖比對，只在本機跑
npm run size         # 打包大小（先 build）
npm run lhci         # Lighthouse（先 build）
```

## 原則

- 介面只用中性色，元件的顏色只用 `ink`、`paper`、`coty`、`coty-ink`。
- 文字內容都是 HTML，WebGL 只做視覺；沒有 WebGL 或開啟減少動態效果時退回靜態版面。
- 每個動畫都處理 `prefers-reduced-motion`。
- 不使用 Pantone 官方圖片、商標圖形或官方文案。
- 新增一年只加資料，不寫特例程式碼。
- WCAG 2.2 AA。

效能預算：首頁初始 JS 120 KB、three.js 與場景 250 KB（gzip，CI 超標就失敗）；單一 3D 模型 1.5 MB；CLS 0.05；LCP 2.5 秒（CI 只警告，因為共用機器量測不穩）。

## 新增年度色

1. `data/colors.json` 的 `years` 尾端加一筆。
2. 複製 `src/content/years/_template.md` 成 `[year].md` 並填寫。
3. `npm run build`，schema 檢查通過就能部署。

顏色引用：`2016-1` 是 2016 年第 2 個年度色（從 0 起算），也可以直接寫 `#E8DCCB`。

## 暫時無法升級的套件

- TypeScript 停在 6.0：typescript-eslint 與 @astrojs/check 還不支援 7。

## 待辦

- 內容審稿（目前都是 `status: draft`）；譯名定稿：2013 翡翠綠或祖母綠、2009 含羞草黃。
- 決定草稿年份要不要顯示設計發想（目前有就顯示）。
- Cloudflare Workers Builds、自訂網域、Web Analytics。換網域時一起改 `astro.config.mjs` 的 `site` 和 `public/robots.txt`。
- 實機測試（iPhone Safari 換頁、中階 Android 幀率）與 VoiceOver、NVDA。
- 2027 年度色公布後新增；投稿 Awwwards。
