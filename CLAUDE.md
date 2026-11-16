# CLAUDE.md

給在這個 repo 工作的 Claude Code 看的說明。專案原則、效能預算、資料格式、新增年度色的步驟和待辦都在 README，動手前先讀。

## 規則

- 樣式用 Tailwind CSS 4。元件裡不寫死顏色，只用 `src/styles/global.css` 的 `@theme` 定義的 `ink`、`paper`、`coty`、`coty-ink`（例如 `bg-coty text-coty-ink`）。
- 套件一律用最新穩定版，新增前先 `npm view <套件> version`；有相容性問題無法升級時，寫進 README 的「暫時無法升級的套件」。
- 每個動畫都要處理 `prefers-reduced-motion`。
- 文字內容一律輸出成 HTML，WebGL 只做視覺。
- 色彩衍生值用 `src/lib/color/` 計算，不手寫。
- 不使用 Pantone 官方圖片、商標圖形或官方文案原文。
- 新增套件前確認 gzip 後大小，對照 README 的效能預算。
- 3D 模型只用 CC0、CC BY 4.0（要在 about 頁標註作者）或自製，來源寫進 `public/models/LICENSES.md`。原始檔用 `scripts/optimize-models.mjs` 壓縮，單一模型不超過 1.5 MB。
- 要違反 README 的專案原則或效能預算時，先停下來說明，經使用者同意再改。

## 部署

`npm run deploy` 建置並部署到正式環境；推到 `main` 也會跑 CI。推送與部署前都先向使用者確認。
