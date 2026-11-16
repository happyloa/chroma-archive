# 技術驗證紀錄

## T005：`transition:persist` 能否保留 WebGL 舞台

日期：2026-11-16
結論：可行，維持 Astro 方案。

### 環境

Astro 7.4.12、three 0.187.0、gsap 3.15.1、lenis 1.3.27。Playwright 1.65 測 Chromium 與 WebKit，對 `astro build` 後的靜態檔測試。

### 做法

- `src/layouts/Base.astro` 放 `<canvas id="stage" transition:persist="stage">`，並載入 `src/app/boot.ts`。
- `boot.ts` 是打包後的模組 script，ClientRouter 換頁時不會重新執行，所以 ticker 與 Lenis 只初始化一次。
- 每次 `astro:page-load` 讀 `<main data-scene data-color>`，交給 `Stage.get(canvas)`。`Stage` 是單例，如果發現 canvas 被換掉，會釋放舊的 renderer 再建新的（保險機制，測試中沒有觸發）。
- 測試頁 `/spike/a/`、`/spike/b/` 互相連結，各自設定不同的立方體顏色。

### 測試結果

`tests/e2e/persist-canvas.spec.ts`，兩個瀏覽器全部通過：

| 檢查項目                                                   | 結果 |
| ---------------------------------------------------------- | ---- |
| 換頁 20 次後，canvas 上手動掛的屬性還在（同一個 DOM 元素） | 通過 |
| `Stage` 只建立 1 次                                        | 通過 |
| ticker callback 數量不變                                   | 通過 |
| `renderer.info` 的 geometry、texture、program 數量不變     | 通過 |
| 換頁後仍持續 render（frame 數增加）                        | 通過 |
| 瀏覽器上一頁後舞台仍是同一個                               | 通過 |

### 打包大小（gzip）

| 檔案                                                                | 大小      | 預算   |
| ------------------------------------------------------------------- | --------- | ------ |
| 初始 JS（boot、GSAP、ScrollTrigger、Lenis、ClientRouter、prefetch） | 約 56 KB  | 120 KB |
| `Stage`（three.js，延遲載入）                                       | 約 130 KB | 250 KB |

第一版把 `Stage` 直接 import，three.js 被打包進初始 JS，達 179 KB。改成在 `astro:page-load` 時 `import()` 後就分成獨立 chunk。之後新增場景也要維持這個做法。

### 後續注意

- 模組層級的狀態會跨頁保留，所以每頁的 ScrollTrigger 要在 `astro:before-swap` 時 `kill()`，否則會累積。T030 實作時處理。
- `astro preview` 和 `wrangler dev` 都能正確提供靜態檔；`wrangler dev` 下 `/spike/a` 會 307 轉到 `/spike/a/`，未知路徑回傳自訂 404 頁。
- 驗證頁 `src/pages/spike/` 在 T024 做出正式頁面後刪除，e2e 測試改指向正式頁面。
