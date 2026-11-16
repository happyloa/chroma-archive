# CLAUDE.md

給在這個 repo 工作的 Claude Code 看的說明。

## 先讀哪些文件

1. `docs/constitution.md`：不能違反的原則。
2. `specs/001-coty-showcase/spec.md`：要做什麼、驗收條件。
3. `specs/001-coty-showcase/plan.md`：怎麼做、目錄結構。
4. `specs/001-coty-showcase/tasks.md`：目前做到哪裡。

## 工作方式

- 一次做一個任務（或一組 `[P]` 任務），完成後在 tasks.md 打勾。
- 實作和規格不一致時，先停下來說明差異，經使用者同意後改規格，再改程式。
- 新功能先在 `specs/` 開新資料夾寫規格，不要直接寫程式。
- 技術驗證的結果寫進對應規格資料夾的 `research.md`。

## 規則

- 樣式用 Tailwind CSS 4。元件裡不寫死顏色，只用 `src/styles/global.css` 的 `@theme` 定義的 `ink`、`paper`、`coty`、`coty-ink`（例如 `bg-coty text-coty-ink`）。
- 套件一律用最新穩定版，新增前先 `npm view <套件> version`；有相容性問題無法升級時，寫進 plan.md 的選型表。
- 每個動畫都要處理 `prefers-reduced-motion`。
- 文字內容一律輸出成 HTML，WebGL 只做視覺。
- 色彩衍生值用 `src/lib/color/` 計算，不手寫。
- 不使用 Pantone 官方圖片、商標圖形或官方文案原文。
- 新增套件前確認 gzip 後大小，對照憲章第 3 條的預算。
- 3D 模型只用 CC0、CC BY 4.0（要在 about 頁標註作者）或自製，來源寫進 `public/models/LICENSES.md`。原始檔用 `scripts/optimize-models.mjs` 壓縮，單一模型不超過 1.5 MB。

## 部署

推到 `main` 會由 Cloudflare Workers Builds 自動部署到正式環境。推送前先向使用者確認。
