# Chroma Archive

展示 Pantone 歷年年度代表色（Color of the Year，2000 至今）的網站，每個顏色附有色值、配色組合，以及用 3D 產品模型呈現的設計發想。

網站：https://chroma-archive.piafyoyo06.workers.dev

技術：Astro、three.js、GSAP、Lenis、Tailwind CSS，部署在 Cloudflare Workers Static Assets。

> 本站為個人作品，與 Pantone LLC 無關。網站上的色值皆為螢幕近似值，不是官方色彩標準。PANTONE® 為 Pantone LLC 的註冊商標。

## 目前狀態

功能都做完了：首頁的年度色主視覺（液態顏料或雲霧 shader，淺色年份用雲霧）、3D 色卡時間軸、27 個年度頁（每年 3 個 3D 設計發想）、產品實驗室（情境場景、上傳模型、相片級渲染）、OKLCH 色彩空間，以及深色介面、中英雙語、OG 圖和 `.ase` 色票下載。

上線前還要審稿（色彩故事與設計發想目前是初稿）、做實機測試，並設定 Cloudflare 自動部署，見 [上線檢查清單](specs/001-coty-showcase/launch-checklist.md)。進度見 [tasks.md](specs/001-coty-showcase/tasks.md)。

開發依照規格驅動流程（Spec-Driven Development）：先寫規格，再寫計畫與任務，最後實作。

| 文件                                                                                       | 內容                                     |
| ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| [docs/constitution.md](docs/constitution.md)                                               | 專案原則：效能預算、可及性、色彩資料標示 |
| [specs/001-coty-showcase/spec.md](specs/001-coty-showcase/spec.md)                         | 功能規格：使用者故事、驗收條件、視覺方向 |
| [specs/001-coty-showcase/plan.md](specs/001-coty-showcase/plan.md)                         | 技術計畫：選型、架構、部署               |
| [specs/001-coty-showcase/data-model.md](specs/001-coty-showcase/data-model.md)             | 資料模型與新增年度色的流程               |
| [specs/001-coty-showcase/tasks.md](specs/001-coty-showcase/tasks.md)                       | 任務清單                                 |
| [specs/001-coty-showcase/research.md](specs/001-coty-showcase/research.md)                 | 技術驗證與品質量測結果                   |
| [specs/001-coty-showcase/launch-checklist.md](specs/001-coty-showcase/launch-checklist.md) | 上線檢查清單                             |
| [data/colors.json](data/colors.json)                                                       | 2000 到 2026 年年度色資料                |

## 開發

需要 Node.js 22.23.4 以上。

```bash
npm install
npm run dev          # 開發伺服器 http://localhost:4321
npm run build        # 建置到 dist/
npm run preview      # 用 wrangler 在本機模擬 Cloudflare 環境
npm run deploy       # 建置並部署到 Cloudflare Workers
```

檢查與測試：

```bash
npm run lint
npm run check        # 型別檢查
npm test             # 單元測試
npm run test:e2e     # Playwright e2e（Chromium、WebKit）
npm run test:visual  # 截圖比對，只在本機跑
npm run size         # 打包大小預算（先 build）
npm run lhci         # Lighthouse CI（先 build）
```

新增年度色的流程見 [data-model.md 第 5 節](specs/001-coty-showcase/data-model.md)。
