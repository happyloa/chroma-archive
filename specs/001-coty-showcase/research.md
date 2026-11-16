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

## 行動版 Lighthouse（spec.md 第 6 節：Performance 85 以上）

spec.md 要求的是行動版，但 CI 一直用 desktop preset 量。2026-11-16 改用 Lighthouse 預設的行動版設定（模擬中階手機，CPU 降速 4 倍、節流網路）在本機量測：

| 網址           | 改善前 | 改善後 | 改善後的 TBT |
| -------------- | ------ | ------ | ------------ |
| `/`            | 0.82   | 0.99   | 15 ms        |
| `/archive/`    | 0.70   | 0.99   | 108 ms       |
| `/en/space/`   | 0.66   | 0.80   | 871 ms       |
| `/years/2025/` | 0.71   | 0.74   | 1318 ms      |

四頁的 Accessibility、Best Practices、SEO 都是 1，LCP 約 1.06 秒，CLS 低於 0.003。

改善項目：

- 典藏頁原本的 LCP 是 12 秒：LCP 元素是頁首的說明文字，它在 JS 載入前被隱藏，之後才淡入。首屏的說明文字改成一開始就顯示，不做淡入。
- 首頁的色帶在手機上 27 格並排，每格太窄，Accessibility 的 target-size 不合格。手機上改成 9 欄 3 行。
- 第一次載入時等瀏覽器閒置（最多 1.2 秒）才載入 three.js、建立 3D。
- 3D 視窗建立後、產品模型載入後，都先用 `compileAsync` 平行編譯 shader 再開始繪製。
- 3D 視窗改成接近畫面（一個視窗高度以內）才建立。年度頁下方的 3 個設計發想不再在進站時建立。
- Meshopt 模型解碼移到 2 個 worker。
- 沒有 GPU 加速的裝置（軟體算繪、省流量模式、記憶體 2 GB 以下）在首次繪製前判定（`<html data-lite>`）。主視覺、設計發想、時間軸、色彩空間改用靜態內容，產品實驗室照常是 3D。判定規則和 `src/stage/quality.ts` 的低畫質檔位相同。

色彩空間與年度頁剩下的是「無法歸屬」的長任務（約 0.8 到 0.9 秒）。這台機器的 Lighthouse 有 GPU，所以沒有進入靜態模式，這些長任務發生在 CPU 被節流時第一次繪製主視覺 shader 與色彩空間的環境光。CI 的機器沒有 GPU，會進入靜態模式。

E2E 測試在無頭瀏覽器裡也是軟體算繪，所以 `tests/e2e/fixtures.ts` 預設設定 `__chromaForceFull`，強制完整 3D；另有一項測試用 `fullGraphics: false` 確認靜態模式。

`lighthouserc.json` 改用行動版設定。Performance 仍然只發警告。

## 換頁轉場閃一下、色票卡飛到一半消失

2026-11-16 使用者回報從典藏頁點色票換到年度頁時卡卡的、會閃一下。用 CDP screencast 逐格錄下換頁，量每格的平均亮度：轉場進行到一半時，亮度從 200 直接掉到 55，飛行中的色票卡也在落地前消失。

原因是 `<html>` 用了 Astro 的 `transition:animate`。Astro 會給 `<html>` 一個依頁面而不同的 view-transition 名稱（典藏頁 `astro-gyrtbwwo-28`、年度頁 `astro-gyrtbwwo-2`），瀏覽器把新舊頁面當成兩個無關的群組。只出現在新頁面的群組排在最上層，於是：

- 新頁面淡入時蓋住墨水，墨水在一半突然不見，看起來是硬切。
- 新頁面淡入時也蓋住飛行中的色票卡。
- 針對 `::view-transition-old(root)`、`::view-transition-new(root)` 寫的樣式全部沒有作用，包括上一頁、減少動態效果的 200 毫秒淡入淡出。先前的測試讀的是這兩個虛擬元素的計算樣式，虛擬元素即使不存在也讀得到值，所以沒有抓到。

修正：拿掉 `<html>` 的 `transition:animate`，名稱回到預設的 `root`，整頁動畫直接寫在 global.css。另外，點色票卡、3D 色卡這類有共享元素的換頁不播墨水，新舊頁面 0.5 秒交叉淡化，色票卡 0.7 秒飛到新位置；一般換頁的新舊頁面也從 50% 瞬間切換改成在 35% 到 65% 之間交叉淡化。修正後相鄰兩格的亮度差最多 5（原本 145）。`tests/e2e/features.spec.ts` 檢查 `<html>` 的名稱是 `root`。

## 拿掉相片級渲染

2026-11-16 使用者決定拿掉產品實驗室的「相片級渲染」開關（原本的 US-12 第 3 到 6 項、T063）。理由：

- 路徑追蹤的 shader 很大。在 Windows 的 Chrome（ANGLE D3D11）上，第一次開啟要編譯約 77 秒，期間取樣數一直是 0。
- three-gpu-pathtracer 的 `WebGLPathTracer` 已經標為 deprecated，作者改做 WebGPU 版本。專案規定套件用最新版，之後升級很可能要整段重寫。
- 和即時算繪共用 renderer 要處理不少細節：分塊算繪會改掉全域 viewport 與 scissor、Meshopt 量化的頂點屬性要先轉回 Float32、多 group 的幾何要先清掉 group，匯出 2048 尺寸還得呼叫套件內部的 `_pathTracer.setSize`。這段程式約 300 行，前幾輪修過的 bug 有好幾個出在這裡。
- 即時畫面已經有實拍 HDRI、PBR 材質與 VSM 柔和陰影。

拿掉之後少了路徑追蹤才有的全域光照、物體間的互相反射，以及攝影棚背景板上的真實落地陰影，匯出圖片改用即時算繪（原本開啟時是 128 次取樣）。

## 閒置時不重畫、沒有 3D 的頁面不載入 three.js

2026-11-16 用 Playwright 量正式站：

- 直接開 about 頁會下載 `Stage` 與 `three.core`（gzip 後約 155 KB），並建立 WebGL context，但這一頁沒有任何 3D 視窗。改成頁面上沒有 `[data-view]`、也還沒建立過舞台時不載入。
- Stage 原本每一格都清除整個 canvas、重畫所有看得到的視窗。實驗室關掉自轉、放著不動時，或從 3D 頁換到 about 頁後，GPU 仍然每秒清 60 次全螢幕。

改法：視窗新增可選的 `needsRender()`，產品視窗在自轉、鏡頭移動（OrbitControls 的 change，包含慣性減速）、GSAP 動畫進行中、狀態改變或載入完成時回報要重畫。看得到的視窗都沒有變化、位置與尺寸也和上一次畫的一樣時，Stage 整格跳過，連清除都不做；WebGL canvas 那一格沒被畫過，瀏覽器就繼續顯示上一格。只要有一個視窗要重畫就清掉整個 canvas、全部重畫，因為 `preserveDrawingBuffer` 為 false，畫新的一格時不能假設上一格的內容還在。主視覺、時間軸、色彩空間一直在動，沒有實作 `needsRender()`，行為和原本一樣。

Fraunces 原本引入 `full.css`（wght、opsz、SOFT、WONK 四個軸），程式只用到 wght，SOFT、WONK 維持預設值。改用 `opsz.css`（wght 與 opsz），拉丁字檔從 121 KB 降到 67 KB，瀏覽器的自動光學尺寸照常有效。

## CI 首頁 LCP 超標（預載標題字型）

2026-11-16 推送 T094 到 T096 之後，CI 的 Lighthouse 首頁 LCP 兩次超標（2,672 毫秒與 6,771 毫秒，門檻 2,500），其他頁面都在 1.0 到 1.6 秒。第二次的 FCP 只有 1,061 毫秒，LCP 元素是預載畫面的大年份（Fraunces）。本機用模擬節流、devtools 節流、CPU 放慢 6 到 10 倍都重現不了：Fraunces 在第一次繪製前就到了，LCP 都等於 FCP。

推測是 CI 機器上年份先用備用字型畫出來，Fraunces 之後才換上，字變大，瀏覽器把換字那一刻記成新的 LCP；模擬節流再把那之前的所有請求算進去，估計值就被拉長。T095 把 Fraunces 換成較小的 opsz 字檔，字型到達的時間因此提前，可能剛好落在預載畫面還沒移除的時候。

處理：

- 在 `<head>` 預載 Fraunces 的拉丁字檔（plan.md 風險表原本就寫了「標題字型預載」，先前沒有做）。預載之後本機量到字型在 16 毫秒開始下載，首頁仍是 0.99。
- CI 原本沒有上傳 Lighthouse 報告：`actions/upload-artifact` 預設略過以 `.` 開頭的資料夾，所以加上 `include-hidden-files`。
- `scripts/lhci-summary.mjs` 多列出實測（未經模擬）的 FCP、LCP，以及 Fraunces、Inter 的請求時間。下次再超標時，可以直接看出 LCP 是不是在字型換上的時候發生。
