# CHROMA ARCHIVE（暫定名稱）

展示 Pantone 歷年年度代表色（Color of the Year，2000 至今）的網站，每個顏色附有產品設計發想與可即時換色的 3D 產品預覽。

技術：Astro、three.js、GSAP、Lenis，部署在 Cloudflare Workers Static Assets。

> 本站為個人作品，與 Pantone LLC 無關。網站上的色值皆為螢幕近似值，不是官方色彩標準。PANTONE® 為 Pantone LLC 的註冊商標。

## 目前狀態

規格階段，還沒有程式碼。開發依照規格驅動流程（Spec-Driven Development）：先寫規格，再寫計畫與任務，最後實作。

| 文件                                                                           | 內容                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------- |
| [docs/constitution.md](docs/constitution.md)                                   | 專案原則：效能預算、可及性、色彩資料標示 |
| [specs/001-coty-showcase/spec.md](specs/001-coty-showcase/spec.md)             | 功能規格：使用者故事、驗收條件、視覺方向 |
| [specs/001-coty-showcase/plan.md](specs/001-coty-showcase/plan.md)             | 技術計畫：選型、架構、部署               |
| [specs/001-coty-showcase/data-model.md](specs/001-coty-showcase/data-model.md) | 資料模型與新增年度色的流程               |
| [specs/001-coty-showcase/tasks.md](specs/001-coty-showcase/tasks.md)           | 任務清單                                 |
| [data/colors.json](data/colors.json)                                           | 2000 到 2026 年年度色資料（待核對）      |

## 開發

專案初始化後（tasks.md T001）會補上以下指令：

```bash
npm install
npm run dev
npm run build
npx wrangler deploy
```
