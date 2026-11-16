# 任務清單

對應規格：[spec.md](./spec.md)、[plan.md](./plan.md)

標記說明：`[P]` 表示可以和同階段其他 `[P]` 任務平行進行（不改同一批檔案）。完成時把 `[ ]` 改成 `[x]`，並在 PR 標題寫上任務編號。

## 階段 0：專案初始化

- [x] T001 用 `npm create astro@latest` 建立 Astro 7 專案（TypeScript strict、空白樣板），設定 `output: 'static'`
- [x] T002 [P] 安裝並設定 ESLint、Prettier、`@astrojs/check`，加上 `lint`、`format`、`check` 指令
- [x] T003 [P] 安裝 Vitest、Playwright，各寫一個會通過的範例測試
- [x] T004 [P] 建立 `wrangler.jsonc` 與 `public/_headers`（內容見 plan.md 5.1），本機跑 `npx wrangler dev` 確認能開
- [x] T005 技術驗證：Base layout 放一個 `transition:persist` 的 canvas，跑一個旋轉立方體，兩頁之間切換 20 次，確認 renderer 沒有重建、記憶體不增長、ticker 不重複註冊。結果寫進 `specs/001-coty-showcase/research.md`；失敗則依 plan.md 第 1 節改走單頁應用方案，並更新 plan.md
- [x] T006 [P] GitHub Actions：lint、check、test、build 四個步驟

## 階段 1：資料與色彩工具

- [ ] T010 逐筆核對 `data/colors.json` 的色號、英文名、HEX，補上 `announced` 日期；中文譯名定稿
- [ ] T011 `src/lib/color/`：HEX 轉 RGB、HSL、OKLCH、LAB；對比文字色；五種配色；色域修正；CIEDE2000。附單元測試
- [ ] T012 [P] `src/lib/color/ref.ts`：解析 `YYYY-N` 與 `#RRGGBB` 引用格式，附單元測試
- [ ] T013 `src/content.config.ts`：依 data-model.md 定義 years collection schema
- [ ] T014 `src/lib/data.ts`：合併 JSON 與 Markdown、產生 `YearEntry`、執行額外檢查
- [ ] T015 [P] 建立 `src/content/years/_template.md` 與 2000 到 2026 年的 Markdown（先放 summary 與 keywords，`status: draft`）

## 階段 2：設計系統與靜態版面

- [ ] T020 `src/styles/tokens.css`：中性色、字級（clamp 流體字級）、間距、網格、`--coty` 與 `--coty-ink`
- [ ] T021 [P] 字型：選定拉丁與中文字型，寫 `scripts/subset-fonts.ts` 依建置後 HTML 用字產生子集
- [ ] T022 `layouts/Base.astro`：ClientRouter、persist canvas、頁首導覽、頁尾非官方聲明
- [ ] T023 [P] 元件：`Swatch`（實體色票造型）、`ColorValue`（含複製）、`Palette`、`YearNav`（2D 年份刻度列）
- [ ] T024 先完成所有頁面的靜態版（不含 WebGL），內容齊全、鍵盤可操作，作為 reduced-motion 與無 WebGL 的基準版面
- [ ] T025 [P] Playwright：每頁一個 reduced-motion 截圖基準

## 階段 3：動態核心

- [ ] T030 `src/app/ticker.ts`、`scroll.ts`：GSAP ticker 驅動 Lenis 與 ScrollTrigger
- [ ] T031 `src/app/motion.ts`：reduced-motion 偵測（含執行中切換）、WebGL 可用性偵測
- [ ] T032 `src/stage/quality.ts`：detect-gpu 分級與執行期自動降級
- [ ] T033 `src/stage/Stage.ts`：renderer、composer、resize、visibility 暫停、SceneRegistry
- [ ] T034 [P] `src/stage/loader.ts`：GLTFLoader、KTX2Loader、Meshopt decoder、HDRI，含快取與載入進度
- [ ] T035 `src/app/transition.ts`：換頁液態擴散轉場，串 Astro 路由事件
- [ ] T036 [P] `src/app/cursor.ts`：自訂游標與吸色效果
- [ ] T037 [P] SplitText 文字出場的共用工具，支援中文逐字

## 階段 4：頁面與場景

- [ ] T040 預載畫面（US-01-1）
- [ ] T041 HeroScene：液態 shader；淺色年份改體積雲（US-01）
- [ ] T042 首頁捲動敘事段落（US-01-3）
- [ ] T043 ArchiveScene：樣條曲線色卡時間軸、慣性、聚焦效果、雙色卡（US-02）
- [ ] T044 時間軸到年度頁的共享元素轉場（US-02-5）
- [ ] T045 年度頁：色值、故事、配色、相鄰年份比較（US-03）
- [ ] T046 年度頁：設計發想段落與產品預覽縮圖（US-04）
- [ ] T047 [P] 準備 6 個產品模型：取得或製作、拆分材質區、Meshopt 壓縮、KTX2 貼圖、低面數版本、授權記錄
- [ ] T048 LabScene：換色、六種表面處理、三種燈光、軌道控制（US-05-1 到 5-4）
- [ ] T049 產品實驗室：網址參數同步與 PNG 匯出（US-05-5、5-6）
- [ ] T050 [P] 產品實驗室的無 WebGL 靜態圖（US-05-7）
- [ ] T051 SpaceScene 與對應 HTML 表格（US-06，P2）
- [ ] T052 [P] 404 頁、about 頁

## 階段 5：內容

- [ ] T060 撰寫 2017 到 2026 年的色彩故事與設計發想，審稿後改為 `reviewed`
- [ ] T061 撰寫 2000 到 2016 年內容（可在上線後補）
- [ ] T062 [P] 產生每年產品概念的靜態預覽圖（供無 WebGL 與 OG 使用）

## 階段 6：品質與上線

- [ ] T070 [P] `scripts/og-images.ts`：satori 產生 OG 圖（US-09）
- [ ] T071 [P] sitemap、robots.txt、meta 標籤
- [ ] T072 size-limit 與 Lighthouse CI 接進 GitHub Actions，門檻依憲章第 3 條
- [ ] T073 可及性稽核：axe 自動掃描加鍵盤與 VoiceOver／NVDA 手動測試
- [ ] T074 實機測試：iPhone、中階 Android 的幀率與發熱，必要時調整畫質檔位
- [ ] T075 Cloudflare Workers Builds 連接 GitHub repo，設定正式與 PR 預覽部署
- [ ] T076 綁定自訂網域、開啟 Cloudflare Web Analytics
- [ ] T077 上線檢查清單：非官方聲明、近似色標註、模型授權、所有年份 404 測試

## 階段 7：上線後

- [ ] T080 2027 年度色公布後依 data-model.md 第 5 節新增
- [ ] T081 英文版（P2）
- [ ] T082 配色下載 `.ase` 檔（P2）
- [ ] T083 投稿 Awwwards
