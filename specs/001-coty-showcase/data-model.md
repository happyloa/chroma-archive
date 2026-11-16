# 資料模型

資料分兩處存放：

- `data/colors.json`：結構化的色彩資料，一年一筆。數量少、欄位固定，用 JSON 方便腳本讀寫。
- `src/content/years/[year].md`：每年的文字內容與設計發想，用 Markdown 寫作，frontmatter 放結構化欄位。

兩者以 `year` 對應。建置時 `src/lib/data.ts` 把兩邊合併，再加上 culori 算出的衍生欄位，得到頁面使用的 `YearEntry`。

## 1. `data/colors.json`

```ts
const ColorSchema = z.object({
  name: z.string(), // 英文原名，例如 "Mocha Mousse"
  nameZh: z.string(), // 本站中文譯名
  code: z.string().regex(/^\d{2}-\d{4}$/), // TCX 色號數字部分，例如 "17-1230"
  hex: z.string().regex(/^#[0-9A-F]{6}$/), // 螢幕近似值，大寫
});

const YearSchema = z.object({
  year: z.number().int().min(2000),
  colors: z.array(ColorSchema).min(1).max(2),
  announced: z.string().date().optional(), // 公布日期 YYYY-MM-DD
});

const ColorsFileSchema = z.object({
  years: z.array(YearSchema),
});
```

額外檢查（寫在 `src/lib/data.ts`，失敗就中斷建置）：

1. `year` 不可重複，且依年份遞增排列。
2. 每個 `year` 都要有對應的 Markdown；反之亦然。
3. `hex` 轉成 OKLCH 後要落在 sRGB 色域內（防止打錯字）。

## 2. `src/content/years/[year].md`

Astro content collection 用 `glob()` loader 讀取，schema 定義在 `src/content.config.ts`。

```ts
const CmfSchema = z.object({
  primary: z.string(), // 引用格式："2025-0"（年份-色序）或 "#RRGGBB"
  accent: z.string().optional(),
  material: z.string(), // 例如 "再生 PET 針織布"
  finish: z.enum(['matte', 'satin', 'gloss', 'metallic', 'velvet', 'translucent']),
});

const ConceptSchema = z.object({
  id: z.string(), // 頁面內唯一，例如 "lounge-chair"
  title: z.string(), // 產品概念名稱
  category: z.enum([
    'furniture',
    'audio',
    'lighting',
    'homeware',
    'footwear',
    'wearable',
    'packaging',
    'mobility',
    'other',
  ]),
  pitch: z.string().max(80), // 一句話描述
  audience: z.string(), // 目標使用者
  cmf: CmfSchema,
  labPreset: z.object({
    // 帶入產品實驗室的設定
    product: z.enum(['chair', 'headphones', 'vase', 'speaker', 'lamp', 'sneaker']),
    light: z.enum(['studio', 'daylight', 'night']).default('studio'),
  }),
});

const MaterialNoteSchema = z.object({
  material: z.string(),
  reason: z.string().max(60),
});

const YearContentSchema = z.object({
  year: z.number().int(),
  summary: z.string().max(120), // 卡片與 meta description 用
  keywords: z.array(z.string()).min(4).max(6), // 情緒關鍵字
  concepts: z.array(ConceptSchema).min(3),
  materials: z.object({
    good: z.array(MaterialNoteSchema).length(3),
    avoid: z.array(MaterialNoteSchema).length(3),
  }),
  status: z.enum(['draft', 'reviewed']).default('draft'),
});
```

Markdown 內文是 300 到 500 字的色彩故事。`status: draft` 的年份在正式建置時仍會出現，但頁面上不顯示設計發想段落，只顯示色值與故事；上線前要把要顯示的年份改為 `reviewed`。

範例：

```md
---
year: 2025
summary: 帶著可可與咖啡香氣的柔和棕，溫暖、不張揚。
keywords: [溫暖, 療癒, 觸感, 日常奢華, 大地]
concepts:
  - id: lounge-chair
    title: 慢午後單椅
    category: furniture
    pitch: 圓弧椅背包覆全身的閱讀單椅，布面像奶泡一樣柔軟。
    audience: 小坪數住宅的獨居上班族
    cmf:
      primary: '2025-0'
      accent: '#E8DCCB'
      material: 羊毛混紡圈圈紗
      finish: velvet
    labPreset: { product: chair, light: daylight }
  # 其餘概念略
materials:
  good:
    - { material: 胡桃木, reason: 木紋與棕色同調，增加層次 }
    - { material: 霧面陶瓷, reason: 吸光表面讓棕色顯得更柔和 }
    - { material: 植鞣皮革, reason: 使用痕跡會讓顏色更深，越用越有味道 }
  avoid:
    - { material: 高光澤塑膠, reason: 反光會讓棕色顯得廉價 }
    - { material: 鏡面不鏽鋼, reason: 冷調反射與暖棕衝突 }
    - { material: 螢光色壓克力, reason: 搶走主色 }
status: draft
---

（色彩故事內文）
```

## 3. 衍生資料 `YearEntry`

由 `src/lib/data.ts` 在建置時產生，頁面只吃這個型別。

```ts
interface DerivedColor {
  name: string;
  nameZh: string;
  code: string;
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  oklch: { l: number; c: number; h: number };
  lab: { l: number; a: number; b: number };
  ink: '#0E0E0E' | '#F4F2EE'; // 上面可讀的文字色
  needsPlate: boolean; // 黑白對比都不足時為 true
  isLight: boolean; // OKLCH L > 0.85，觸發淺色年份規則
  palettes: Record<'complementary' | 'analogous' | 'triadic' | 'split' | 'mono', string[]>;
}

interface YearEntry {
  year: number;
  announced?: string;
  colors: DerivedColor[];
  content: YearContent; // 來自 Markdown
  prev?: { year: number; hex: string; deltaE: number };
  next?: { year: number; hex: string; deltaE: number };
}
```

## 4. 色彩引用格式

產品實驗室網址參數與 CMF 欄位都會引用顏色，統一格式：

| 格式      | 意思                           | 範例                 |
| --------- | ------------------------------ | -------------------- |
| `YYYY-N`  | 某年第 N 個年度色（從 0 起算） | `2016-1` 是 Serenity |
| `#RRGGBB` | 任意顏色                       | `#E8DCCB`            |

解析函式放在 `src/lib/color/ref.ts`，引用不存在的年份時建置失敗。

## 5. 新增年度色的流程

1. 在 `data/colors.json` 的 `years` 陣列尾端加一筆。
2. 複製 `src/content/years/_template.md` 為 `[year].md`，填寫 frontmatter 與內文。
3. `npm run build`，schema 驗證通過後 PR 合併即部署。
