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

## T072、T073：品質工具的結果

2026-11-16 在本機對建置後的 `dist/` 量測。

### Lighthouse（desktop preset，`lighthouserc.json`）

| 網址           | Performance | Accessibility | Best Practices | SEO |
| -------------- | ----------- | ------------- | -------------- | --- |
| `/`            | 1           | 1             | 1              | 1   |
| `/archive/`    | 0.89        | 1             | 1              | 1   |
| `/years/2025/` | 0.8         | 1             | 1              | 1   |
| `/en/space/`   | 0.95        | 1             | 1              | 1   |

年度頁的 Performance 最低，一頁有 4 個 3D 視窗（主視覺 shader 加 3 個設計發想模型）。CI 對 Performance 只發警告，Accessibility、SEO、LCP、CLS 不合格時會失敗。

改成只有深色介面（T068）之後重新量測：`/` 0.99、`/archive/` 0.89、`/years/2025/` 0.92、`/en/space/` 0.92，其他三項仍然都是 1。單次量測的 Performance 本來就會有幾分的起伏。

第一次跑時 Accessibility 沒有滿分，原因有兩個：

- GSAP SplitText 在拆開的 `span` 上加 `aria-label`，觸發 `aria-prohibited-attr`。改成拆字的元素設 `aria-hidden`，前面另外放一份 `sr-only` 原文（`src/app/reveal.ts`）。
- 深色模式下，色票卡片的次要文字沿用會跟著主題反轉的 `smoke`，在白色卡片上對比不足。改用固定色 `--color-stone`。

### 打包大小（size-limit，gzip）

| 項目                  | 大小      | 預算   |
| --------------------- | --------- | ------ |
| 首頁初始 JS           | 60.14 KB  | 120 KB |
| three.js 與產品實驗室 | 196.87 KB | 250 KB |

### axe

`tests/e2e/a11y.spec.ts` 用 Chromium 掃描中英文共 11 頁（減少動態效果），WCAG 2.2 AA 範圍內不能有 serious 或 critical 等級的問題。當時有淺色與深色兩種配色，只掃了淺色；改成只有深色之後，掃的就是唯一的配色。修正過的問題是 `label-content-name-mismatch`：語言切換、年份導覽、色票卡片原本用 `aria-label` 蓋掉畫面上的文字。改成可見文字留在名稱裡，補充說明放在 `sr-only` 文字。

## Playwright 的 Windows 版 WebKit 在 View Transition 換頁時當掉

2026-11-16 跑完整 e2e 時，WebKit 有兩個測試在換頁後逾時。追查後發現是分頁整個當掉（Playwright 的 `crash` 事件）。

### 現象

- 用 View Transition 從 `/about/` 換到 `/years/2025/` 或 `/archive/`，大約一半到三分之二的次數會當掉，時間點在 `astro:after-swap` 之後 100 到 150 毫秒，`astro:page-load` 還沒觸發。
- 換到 `/en/about/`、`/space/`、`/years/2025/lab/` 沒有當過。

### 排除過的原因

| 嘗試                                                           | 結果       |
| -------------------------------------------------------------- | ---------- |
| 轉場期間暫停 WebGL 繪製，3D 視窗等轉場結束才建立               | 仍會當掉   |
| 轉場期間把 canvas 設成 `visibility: hidden` 或 `display: none` | 仍會當掉   |
| 換頁前先載入全部 226 個字型檔                                  | 仍會當掉   |
| 關掉共享元素（`view-transition-name: none`）                   | 仍會當掉   |
| 關掉根元素的轉場動畫                                           | 仍會當掉   |
| 拿掉 `document.startViewTransition`，改用 Astro 自己的換頁動畫 | 4 次都沒當 |
| 同一份 HTML 改由 Playwright 的 `page.route` 回應               | 3 次都沒當 |

最後一項只改變了回應的時間點，頁面內容完全相同，所以判斷是這個 WebKit 版本的 View Transition 有時序上的問題，跟網站程式無關。暫停繪製與延後建立 3D 視窗都沒有幫助，已經還原。

### 處理

`tests/e2e/fixtures.ts` 只在「WebKit 加 Windows」這個組合拿掉 `startViewTransition`，其他測試照常進行。CI 在 Linux 上跑，WebKit 和 Chromium 都會測 View Transition。

Safari 用的是另一套繪圖架構，這次無法驗證會不會有同樣的問題，T074 實機測試時要特別試站內換頁。

## 產品實驗室切換場景卡頓

2026-11-16 使用者回報切換場景時很卡。用 CPU profile 量測（Chromium、AMD Radeon 890M）第一次從攝影棚切到客廳：

| 耗時   | 原因                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| 324 ms | 新材質第一次繪製時同步等 shader 編譯（`getProgramInfoLog`、`getProgramParameter`） |
| 70 ms  | 貼圖上傳前的狀態查詢                                                               |
| 64 ms  | 地板、牆面貼圖上傳（`texSubImage2D`）                                              |

這些成本都發生在新場景加進畫面後的第一格，鏡頭過渡因此停住。HDRI 解析只花約 5 ms。

改成先在背景準備好再換上去（`ProductView.prepareRoom`）：

1. 等家具與貼圖載入，貼圖用 `initTexture` 分幾格上傳。
2. 用 `compileAsync` 平行編譯 shader。編譯時要先套上換上去之後的狀態：場景的 HDRI（環境貼圖尺寸會影響 shader），以及主光投射陰影（攝影棚不投射，情境場景會）。少了任何一項，換上去後還是會整批重編。
3. 每個 shader 第一次讀取 uniform 時要和 GPU 程序同步查詢，也在準備階段分幾格先做。
4. HDRI 已經載入時直接套用，不先經過程式產生的燈箱。
5. 正式環境關閉 `renderer.debug.checkShaderErrors`。

結果：第一次切到客廳，最長停頓從 183 ms（3 格超過 50 ms）降到 133 ms（1 格，發生在準備階段，舊場景還在畫面上），之後的切換在 66 到 151 ms 內開始過渡，沒有掉格。
