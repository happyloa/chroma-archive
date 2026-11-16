# 技術計畫：Pantone 年度色展示站

對應規格：[spec.md](./spec.md)
資料模型：[data-model.md](./data-model.md)
任務清單：[tasks.md](./tasks.md)

## 1. 技術選型

所有套件一律使用最新穩定版，新增套件前先用 `npm view <套件> version` 確認。版本號是 2026-11-16 查詢的結果；因相容性無法用最新版的，在表格裡寫明原因。

| 用途        | 套件                                                        | 版本     | 選用理由                                                                                                                                                  |
| ----------- | ----------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 網站框架    | Astro                                                       | 7.x      | 預設輸出靜態 HTML，內容集合（content collections）適合一年一篇的資料；ClientRouter 支援 View Transitions 與 `transition:persist`，可以在換頁時保留 canvas |
| 語言        | TypeScript                                                  | 6.0.x    | 資料 schema 與場景介面都需要型別。最新版是 7.x，但 typescript-eslint 與 @astrojs/check 還不支援，等兩者支援後再升級                                       |
| CSS         | Tailwind CSS（@tailwindcss/vite）                           | 4.3.x    | 設計 token 寫在 `src/styles/global.css` 的 `@theme`，元件用 utility class；`--coty` 等執行期變數也透過 `@theme` 對應成 `bg-coty` 這類 class               |
| 3D          | three                                                       | 0.187.x  | 生態成熟、文件與範例多；先用 WebGLRenderer，WebGPU 不列入第一版                                                                                           |
| 後製        | postprocessing（pmndrs）                                    | 6.x      | 把 bloom、noise、色差合併成單一 pass，比 three 內建 EffectComposer 省效能                                                                                 |
| 動畫        | gsap                                                        | 3.15.x   | 含 ScrollTrigger、SplitText、Flip、CustomEase，3.13 起全部外掛免費                                                                                        |
| 平滑捲動    | lenis                                                       | 1.3.x    | 與 ScrollTrigger 整合簡單，原生捲動條仍可用                                                                                                               |
| 色彩計算    | culori                                                      | 4.x      | 支援 OKLCH、LAB、WCAG 對比，能在建置時與瀏覽器兩邊執行                                                                                                    |
| GPU 分級    | detect-gpu                                                  | 5.x      | 用 GPU 名稱查基準分數，決定畫質檔位                                                                                                                       |
| Shader 載入 | vite-plugin-glsl                                            | 最新     | 支援 `#include`，shader 拆檔管理                                                                                                                          |
| 資料驗證    | zod（Astro 內建）                                           | 隨 Astro | content collection schema                                                                                                                                 |
| OG 圖       | satori + @resvg/resvg-js                                    | 最新     | 建置時把 JSX 版面轉 PNG                                                                                                                                   |
| 測試        | Vitest、Playwright                                          | 最新     | 單元測試色彩工具；E2E 測換頁、鍵盤操作、截圖                                                                                                              |
| 品質檢查    | ESLint、Prettier、@astrojs/check、Lighthouse CI、size-limit | 最新     | 對應憲章第 3 條預算                                                                                                                                       |
| 部署        | wrangler                                                    | 4.x      | Cloudflare Workers Static Assets                                                                                                                          |

### 為什麼選 Astro 而不是單頁應用

這個站有 27 個以上的年度頁，每頁都需要被搜尋引擎收錄、有自己的 OG 圖，靜態預渲染是必要的。Awwwards 類網站常見的痛點是換頁時 WebGL 重建造成閃爍，Astro 的 ClientRouter 加上 `transition:persist` 可以讓 canvas 元素跨頁保留。

風險：`transition:persist` 保留的是 DOM 元素，模組層級的 JS 狀態也要能跨頁存活，需要在第一階段做技術驗證（任務 T005）。驗證失敗的備案是改用 Vite + 自製路由的單頁應用，搭配建置時預渲染（vite-ssg 或自寫腳本）。

## 2. 系統架構

```
┌──────────────────────── 瀏覽器 ─────────────────────────┐
│                                                         │
│  Astro 頁面（靜態 HTML，內容與色值都在 DOM）             │
│     │ 透過 data-scene 屬性宣告要用的場景與參數           │
│     ▼                                                   │
│  App（單例，跨頁存活）                                   │
│   ├─ Ticker：gsap.ticker 驅動 Lenis 與 render loop      │
│   ├─ ScrollBridge：Lenis ↔ ScrollTrigger                │
│   ├─ Router 監聽：astro:before-preparation / after-swap │
│   ├─ Transition：液態擴散轉場（全螢幕 shader pass）      │
│   ├─ Cursor：自訂游標                                   │
│   └─ Stage（WebGL，transition:persist）                 │
│        ├─ Renderer + Composer（依 GPU 檔位設定）        │
│        ├─ AssetLoader（GLTF、KTX2、Draco，有快取）      │
│        └─ SceneRegistry                                 │
│             ├─ HeroScene      首頁                      │
│             ├─ ArchiveScene   時間軸                    │
│             ├─ YearScene      年度頁背景                │
│             ├─ LabScene       產品實驗室                │
│             └─ SpaceScene     色彩空間                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
        ▲ 靜態檔
┌───────┴──────── Cloudflare Workers Static Assets ───────┐
│  dist/（HTML、JS、CSS、模型、OG 圖）                    │
│  _headers：雜湊檔案長快取，HTML 短快取                   │
└─────────────────────────────────────────────────────────┘
```

### 2.1 場景生命週期

每個場景實作同一個介面：

```ts
interface StageScene {
  readonly id: SceneId;
  init(ctx: StageContext): Promise<void>; // 第一次使用時載入資源
  enter(params: SceneParams, from?: SceneId): gsap.core.Timeline; // 進場動畫
  leave(to: SceneId): gsap.core.Timeline; // 離場動畫
  update(time: number, delta: number): void; // 每幀呼叫
  resize(size: StageSize): void;
  dispose(): void; // 記憶體壓力大時才呼叫
}
```

換頁流程：

1. `astro:before-preparation`：Transition 開始播放擴散動畫，同時呼叫目前場景的 `leave()`。
2. 新頁 HTML 載入並交換（`astro:after-swap`）。
3. 讀取新頁 `<main data-scene="archive" data-year="2025">`，從 SceneRegistry 取場景，必要時 `init()`。
4. `astro:page-load`：Transition 退場，呼叫新場景的 `enter()`，重建該頁的 ScrollTrigger。
5. 舊場景保留在記憶體，除非 GPU 檔位為低，才呼叫 `dispose()`。

### 2.2 捲動與時鐘

GSAP ticker 是唯一的時鐘。Lenis 在 ticker 裡呼叫 `raf()`，ScrollTrigger 透過 `lenis.on('scroll', ScrollTrigger.update)` 同步，Stage 的 render 也掛在同一個 ticker 上，避免三個 requestAnimationFrame 互相錯拍。分頁切到背景時 ticker 會自動降頻，Stage 另外在 `visibilitychange` 時停止 render。

### 2.3 畫質檔位

| 檔位 | 判定                         | DPR 上限 | 後製               | 陰影 | 模型   |
| ---- | ---------------------------- | -------- | ------------------ | ---- | ------ |
| 高   | detect-gpu tier 3            | 2        | bloom、noise、色差 | 有   | 原始   |
| 中   | tier 2                       | 1.5      | noise              | 有   | 原始   |
| 低   | tier 0、1 或行動裝置省電模式 | 1        | 無                 | 無   | 低面數 |

執行期再加一層保護：連續 2 秒平均幀率低於 40，自動降一檔。

### 2.4 Shader 清單

| Shader             | 用途          | 技術要點                                                            |
| ------------------ | ------------- | ------------------------------------------------------------------- |
| `liquid.frag`      | Hero 液態顏料 | domain-warped simplex noise，滑鼠位置寫進一張低解析度 velocity 貼圖 |
| `cloud.frag`       | 淺色年份 Hero | raymarch 體積雲，步數依檔位調整                                     |
| `swatch.vert/frag` | 時間軸色卡    | 捲動速度帶動頂點彎曲；聚焦時加菲涅耳邊光                            |
| `transition.frag`  | 換頁擴散      | 以點擊點為圓心的 SDF 加 noise 邊緣                                  |
| `grain.frag`       | 全畫面顆粒    | 合併進 postprocessing 的 EffectPass                                 |

### 2.5 產品實驗室

- 模型格式：glTF Binary（`.glb`），幾何用 Meshopt 壓縮，貼圖轉 KTX2（Basis Universal）。
- 每個模型的網格依「主色區」「輔色區」「固定材質區」命名（`mat_primary`、`mat_accent`、`mat_fixed_*`），換色時只改前兩者。
- 六種表面處理用同一個 `MeshPhysicalMaterial`，切換參數：

| 表面處理 | roughness | metalness | 其他                                |
| -------- | --------- | --------- | ----------------------------------- |
| 霧面     | 0.9       | 0         |                                     |
| 緞面     | 0.45      | 0         | `clearcoat` 0.2                     |
| 亮面     | 0.1       | 0         | `clearcoat` 1                       |
| 金屬     | 0.3       | 1         |                                     |
| 絨布     | 1         | 0         | `sheen` 1，`sheenColor` 取主色提亮  |
| 半透明   | 0.2       | 0         | `transmission` 0.9，`thickness` 0.5 |

- 燈光預設用三張 HDRI（攝影棚、戶外、夜間），以 PMREMGenerator 預先處理，低檔位改用 RoomEnvironment。
- 匯出：建立 2048 × 2048 的 WebGLRenderTarget，渲染一次後讀回像素，在 2D canvas 疊上浮水印，再轉 Blob 下載。
- 網址參數：`?p=chair&f=satin&c1=2025-0&c2=2019-0&l=studio`，`c1`、`c2` 用「年份-色序」引用年度色，也接受 `hex`。

## 3. 目錄結構

```
.
├─ data/
│  └─ colors.json               年度色主資料
├─ docs/
│  └─ constitution.md
├─ specs/001-coty-showcase/     本規格
├─ public/
│  ├─ models/                   .glb 與 LICENSES.md
│  ├─ hdri/
│  ├─ fonts/                    子集化後的字型
│  └─ _headers                  Cloudflare 快取標頭
├─ scripts/
│  ├─ subset-fonts.ts           依頁面用字產生中文字型子集
│  └─ og-images.ts              產生 OG 圖
├─ src/
│  ├─ content.config.ts         content collection schema
│  ├─ content/
│  │  └─ years/2025.md …        每年一篇
│  ├─ lib/
│  │  ├─ color/                 culori 包裝：衍生色值、配色、對比
│  │  └─ data.ts                讀取並合併 colors.json 與 content
│  ├─ app/                      瀏覽器端單例
│  │  ├─ App.ts
│  │  ├─ ticker.ts
│  │  ├─ scroll.ts
│  │  ├─ cursor.ts
│  │  ├─ transition.ts
│  │  └─ motion.ts              reduced-motion 與 GPU 檔位偵測
│  ├─ stage/
│  │  ├─ Stage.ts
│  │  ├─ loader.ts
│  │  ├─ quality.ts
│  │  ├─ scenes/                Hero、Archive、Year、Lab、Space
│  │  └─ shaders/
│  ├─ components/               Astro 元件（Swatch、ColorValue、Palette …）
│  ├─ layouts/Base.astro        含 ClientRouter 與 persist canvas
│  ├─ pages/
│  │  ├─ index.astro
│  │  ├─ archive.astro
│  │  ├─ space.astro
│  │  ├─ about.astro
│  │  ├─ 404.astro
│  │  └─ years/[year]/index.astro, lab.astro
│  └─ styles/
│     └─ global.css             Tailwind 進入點與 @theme 設計 token
├─ tests/
│  ├─ unit/
│  └─ e2e/
├─ astro.config.mjs
├─ wrangler.jsonc
└─ package.json
```

## 4. 色彩計算

全部在建置時算好，以 props 傳進元件，瀏覽器端只有產品實驗室需要即時計算。

| 輸出                 | 算法                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| RGB、HSL             | culori 由 HEX 轉換                                                        |
| OKLCH、CIELAB（D65） | culori `oklch`、`lab65`                                                   |
| 文字色               | 分別算黑、白對年度色的 WCAG 對比，取較高者；兩者都低於 4.5 時加半透明底板 |
| 互補                 | OKLCH 色相 +180°                                                          |
| 類似                 | 色相 ±30°                                                                 |
| 三角                 | 色相 +120°、+240°                                                         |
| 分裂互補             | 色相 +150°、+210°                                                         |
| 單色                 | 固定色相，明度 0.25 到 0.95 取 5 階                                       |
| 相鄰年份差距         | CIEDE2000（culori `differenceCiede2000`）                                 |

在 OKLCH 調整色相後，結果可能超出 sRGB 色域，用 culori `clampChroma(color, 'oklch')` 降彩度拉回色域內。

白色、灰色這類彩度低於 0.02 的顏色，轉色相不會產生可分辨的顏色，所以互補、類似、三角、分裂互補四組配色改用 0.06 的彩度產生淡色；單色配色維持原彩度。

## 5. 部署

### 5.1 Cloudflare 設定

`wrangler.jsonc`：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "chroma-archive",
  "compatibility_date": "2026-11-16",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page",
    "html_handling": "auto-trailing-slash",
  },
}
```

純靜態站不需要 `main` 欄位，所以沒有 Worker 程式，請求直接由 Static Assets 回應，不計 Worker 呼叫次數。

`public/_headers`：

```
/_astro/*
  Cache-Control: public, max-age=31536000, immutable
/models/*
  Cache-Control: public, max-age=2592000
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

### 5.2 CI/CD

用 Cloudflare Workers Builds 連接 GitHub repo：

- 推到 `main`：執行 `npm ci && npm run build`，再 `npx wrangler deploy` 上正式環境。
- 開 PR：`npx wrangler versions upload` 產生預覽網址，貼回 PR。

GitHub Actions 只跑品質檢查（不負責部署）：

1. `npm run lint`、`npm run check`、`npm run test`
2. `npm run build` 後跑 size-limit
3. Playwright E2E（Chromium、WebKit）
4. Lighthouse CI 跑 `/`、`/archive`、`/years/2025`，低於憲章預算就失敗

## 6. 測試策略

| 層級 | 工具                         | 範圍                                                                                            |
| ---- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| 單元 | Vitest                       | 色彩衍生計算、配色、對比選色、資料 schema、網址參數序列化                                       |
| 元件 | Vitest + Astro container API | ColorValue、Palette、Swatch 的 HTML 輸出                                                        |
| E2E  | Playwright                   | 首頁進站、時間軸鍵盤操作、換頁後 canvas 仍是同一個元素、產品實驗室網址還原、reduced-motion 模式 |
| 視覺 | Playwright 截圖              | 每個頁面在 reduced-motion 下的靜態截圖比對                                                      |
| 效能 | Lighthouse CI、size-limit    | 憲章第 3 條                                                                                     |
| 手動 | 實機                         | iPhone（Safari）、中階 Android（Chrome）各測一輪幀率與發熱                                      |

## 7. 風險

| 風險                                         | 影響                   | 對策                                                         |
| -------------------------------------------- | ---------------------- | ------------------------------------------------------------ |
| `transition:persist` 無法滿足跨頁 WebGL 狀態 | 換頁閃爍，轉場做不出來 | T005 先做技術驗證，失敗改單頁應用                            |
| 中文字型太大                                 | LCP 超標               | 建置時依實際用字子集化，標題字型 `font-display: swap` 並預載 |
| 3D 模型授權不清                              | 法律風險               | 只用 CC0 或自製模型，授權記在 `public/models/LICENSES.md`    |
| Pantone 商標與色值授權                       | 法律風險               | 依憲章第 5 條：非官方聲明、近似值標註、不用官方圖文          |
| 行動裝置過熱、掉幀                           | 體驗差                 | 畫質檔位與執行期自動降級                                     |
| 27 年份內容撰寫量大                          | 上線延後               | 先上線近 10 年完整內容，其餘年份先放色值與短介紹             |
