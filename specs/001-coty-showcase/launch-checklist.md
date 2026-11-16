# 上線檢查清單（T077）

對應規格：[spec.md](./spec.md)、[docs/constitution.md](../../docs/constitution.md)

2026-11-16 對建置後的 `dist/` 檢查。打勾的項目已確認；沒打勾的需要本人操作或判斷。

## 已確認

### 標示與授權（憲章第 5 條）

- [x] 每一頁頁尾都有非官方聲明，中文版寫「與 Pantone LLC 無關」，英文版寫「not affiliated with Pantone LLC」。404 頁也有。
- [x] 年度頁色值下方標註「螢幕近似色，非官方色彩標準。」（`ColorValues.astro`）；關於頁另有一段說明螢幕、印刷與實體材料的色差。
- [x] 沒有使用 Pantone 官方圖片、商標圖形或官方文案。色彩故事和設計發想都是自己寫的。
- [x] 4 個公開模型記錄在 `public/models/LICENSES.md`。CC BY 4.0 的運動鞋（Shopify）和桌燈（Eric Chadwick、Wayfair LLC）在關於頁標註作者，並註明經過修改。
- [x] 情境場景用的 3 張 HDRI、3 組 PBR 貼圖、7 件家具都是 Poly Haven 的 CC0 素材，同樣記錄在 `LICENSES.md`；沒有公開模型的產品與家具由程式產生。

### 頁面與路由

- [x] 2000 到 2026 年的年度頁與產品實驗室頁，中英文各 27 組，全部有產生。
- [x] 尚未公布的 `/years/2027/` 回應 404 並顯示自訂 404 頁（`tests/e2e/pages.spec.ts`）。
- [x] 每個年度頁有自己的 OG 圖（`/og/2000.png` 到 `/og/2026.png`，另有預設圖）。
- [x] 每個年度頁可以下載 `.ase` 色票檔（27 個）。
- [x] `sitemap-index.xml` 列出中英文頁面並附 hreflang，不含 OG 圖；`robots.txt` 指向 sitemap。

### 品質

- [x] Lighthouse 行動版設定下四個網址的 Accessibility、Best Practices、SEO 都是 1；Performance 首頁與典藏頁 0.99，色彩空間 0.80、年度頁 0.74 還沒到 0.85（見 [research.md](./research.md)）。
- [x] 首頁初始 JS 60.14 KB、three.js 與產品實驗室 196.87 KB，都在憲章第 3 條的預算內。單一模型最大 424 KB（運動鞋），上限 1.5 MB。
- [x] axe 掃描 11 頁，沒有 serious 或 critical 等級的問題。
- [x] 單元測試 185 項通過；e2e 在 Chromium 與 WebKit 共 83 項通過，另外 15 項只在其中一個瀏覽器跑而略過；截圖比對 7 頁通過。

## 需要本人處理

- [ ] 內容審稿：27 年的色彩故事、設計發想、適合與避免的材質都還是 `status: draft`。審過的年份改成 `reviewed`（T060、T061）。
- [ ] 譯名定稿：2013 Emerald 用「翡翠綠」或「祖母綠」；2009 Mimosa 目前是「含羞草黃」。
- [ ] Cloudflare Workers Builds 連接 GitHub repo（T075）：Cloudflare 後台打開這個 Worker，在 Settings 的 Build 區塊連接 `happyloa/chroma-archive`。建置指令 `npm run build`，部署指令 `npx wrangler deploy`，非正式分支用 `npx wrangler versions upload` 產生預覽網址。連好之後推到 `main` 就會自動部署。
- [ ] 自訂網域與 Cloudflare Web Analytics（T076）。換網域時要一起改 `astro.config.mjs` 的 `site` 和 `public/robots.txt` 的 sitemap 網址。
- [ ] 實機測試（T074）：iPhone Safari 與中階 Android Chrome 的幀率、發熱。Safari 要特別試站內換頁，Windows 版 WebKit 在 View Transition 換頁時會當掉（research.md），無法確定 Safari 有沒有同樣的問題。
- [ ] 螢幕閱讀器手動測試（T073）：VoiceOver 與 NVDA 各走一次首頁、年度頁、產品實驗室。
- [ ] 投稿 Awwwards（T083）。
