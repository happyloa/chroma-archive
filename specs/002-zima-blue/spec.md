# 功能規格：Zima Blue 彩蛋

對應原則：[docs/constitution.md](../../docs/constitution.md)。主規格：[001-coty-showcase/spec.md](../001-coty-showcase/spec.md)。

## 1. 背景

〈Zima Blue〉是 Alastair Reynolds 的短篇小說，首次刊在 _Postscripts_ 雜誌第 4 期。Netflix 動畫選集《愛×死×機器人》第一季第 14 集改編了這篇小說，2019 年 3 月 15 日上線，導演 Robert Valley，Passion Animation Studios 製作，劇本 Philip Gelatt。故事裡的藝術家 Zima，作品中一再出現同一種藍色。

這個彩蛋放一個 Pantone 年度色以外的顏色，給認得這部作品的人一點驚喜。

Zima Blue 沒有官方色值。本站採用 `#17B5F0`，這是色彩參考網站列出的近似值之一（[hexcolorpedia](https://hexcolorpedia.com/color/17b5f0)），頁面上會標明是近似值。

## 2. 版權與標示

- 不使用 Netflix 的畫面截圖、影片、音樂、角色造型或標誌，也不引用小說或劇本的台詞原文。
- 視覺（方塊、水面）與文字都自己製作。
- 動畫與隱藏頁都寫上原著作者、動畫集數與製作團隊，並註明這是粉絲致敬，與 Netflix、原著作者無關。
- 和年度色一樣，色值標示為螢幕近似色。

## 3. 使用者故事與驗收條件

### US-Z1 在色彩空間找到彩蛋

1. `/space/` 的 3D 色彩空間多一顆 Zima Blue 的球，比年度色的球小一半，放在它的 OKLCH 座標上。時間螺旋排列時放在螺旋最外圈之後，色環排列時放在對應的色相位置。
2. 滑鼠懸停時提示框只顯示「？」，不顯示名稱。
3. 點擊後播放全螢幕致敬動畫（US-Z2）。
4. 這顆球不列進色彩空間的 HTML 表格。3D 區塊只在有 WebGL 且沒有減少動態效果時顯示，所以這些情況下找不到彩蛋；隱藏頁仍可直接用網址開啟，內容完整。

### US-Z2 全螢幕致敬動畫

1. 畫面變暗，中央出現一小塊 Zima Blue 方塊，慢慢放大到蓋滿畫面，表面像水面一樣輕微起伏。總長約 4 秒。
2. 動畫最後顯示一段自己寫的短文（中文 60 字以內，英文 40 字以內）與一行出處。
3. 出現兩個按鈕：「進入 Zima Blue」連到隱藏頁，另一個關閉動畫。Esc 或點擊背景也能關閉。
4. 以 `role="dialog"`、`aria-modal="true"` 呈現；開啟時焦點移到對話框內，關閉後回到原本的位置。
5. 減少動態效果時不播動畫，直接顯示最後的畫面。

### US-Z3 隱藏頁 `/zima/`

1. 這是一個特別的彩蛋頁，版面自成一格，不比照年度頁：滿版的 Zima Blue 液態主視覺、色值（HEX、RGB、HSL、OKLCH、CIELAB，可複製）、五組配色（可複製）、一段短文與出處。不放產品設計發想、產品實驗室連結與 `.ase` 下載。
2. 頁首標示「彩蛋」，並寫明 Zima Blue 不是 Pantone 年度色。
3. 一段自己寫的短文（中文 200 字以內），談這個顏色在作品中的角色，不重述劇情細節，也不引用台詞。
4. 中英雙語：`/zima/` 與 `/en/zima/`。
5. 不列入 sitemap、頁尾導覽、典藏頁與年份導覽，頁面加上 `<meta name="robots" content="noindex">`。
6. 有自己的 OG 圖（`/og/zima.png`）。

## 4. 技術做法

| 項目         | 做法                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 資料         | `data/zima.json` 放色值、短文與出處（中英文），以 Zod 驗證；不放進 `data/colors.json`                                   |
| 隱藏的球     | `SpaceView.ts` 依 `data-zima` 屬性多建一顆球，點擊時發出 `chroma:zima` 事件                                             |
| 動畫         | `src/components/ZimaReveal.astro` 放對話框的 HTML，`src/app/zima.ts` 用 GSAP 播動畫；水面起伏用 SVG `feTurbulence` 濾鏡 |
| 隱藏頁       | `src/views/ZimaView.astro`，主視覺重用 HeroView，色值與配色重用 ColorValues、Palette                                    |
| OG 圖        | 沿用 `src/pages/og/[slug].png.ts`，增加 `zima` 這個 slug                                                                |
| sitemap 排除 | `astro.config.mjs` 的 sitemap filter 排除 `/zima/`                                                                      |
| 打包大小     | 動畫程式在第一次觸發時才 `import()`，不計入首頁初始 JS                                                                  |

## 5. 測試

- e2e：`/zima/` 與 `/en/zima/` 能開啟、有 noindex、不在 sitemap；色彩空間在有 WebGL 時多一顆球；觸發事件後對話框開啟、Esc 關閉且焦點回到原處；減少動態效果時直接顯示最後畫面。
- axe 掃描 `/zima/`。
- 截圖基準加上 `/zima/`。

## 6. 待決問題

1. 色值是否改用其他近似值（例如 `#13BEEF`）。
2. 短文與色彩故事由我起稿，需要你審稿。
