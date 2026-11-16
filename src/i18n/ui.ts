/**
 * 介面文字（US-13）。繁體中文是預設語系，網址不加前綴；英文放在 /en/ 底下。
 * 頁面與元件用 useT(lang) 取字串，{name} 形式的佔位符會換成傳入的值。
 */
export const LANGS = ['zh-tw', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'zh-tw';

export const HTML_LANG: Record<Lang, string> = { 'zh-tw': 'zh-Hant-TW', en: 'en' };
export const OG_LOCALE: Record<Lang, string> = { 'zh-tw': 'zh_TW', en: 'en_US' };

export function getLang(locale: string | undefined): Lang {
  return locale === 'en' ? 'en' : 'zh-tw';
}

/** 加上語系前綴：localePath('en', '/archive/') → '/en/archive/' */
export function localePath(lang: Lang, path: string): string {
  return lang === 'en' ? `/en${path}` : path;
}

/** 去掉語系前綴，得到兩種語系共用的路徑 */
export function stripLocale(pathname: string): string {
  const stripped = pathname.replace(/^\/en(?=\/|$)/, '');
  return stripped === '' ? '/' : stripped;
}

const zh = {
  'site.description': 'Pantone 歷年年度代表色與產品設計發想。',
  'site.disclaimer':
    '本站為個人作品，與 Pantone LLC 無關。色值皆為螢幕近似值，非官方色彩標準。PANTONE® 為 Pantone LLC 的註冊商標。',
  'site.tagline': '收錄 {from} 到 {to} 年的 Pantone 年度代表色，以及每個顏色的產品設計參考。',
  'a11y.skip': '跳到主要內容',
  'a11y.announcer': '',
  'nav.main': '主要導覽',
  'nav.footer': '頁尾導覽',
  'nav.archive': '典藏',
  'nav.space': '色彩空間',
  'nav.about': '關於',
  'nav.aboutSite': '關於本站',
  'nav.github': 'GitHub 原始碼（另開新視窗）',
  'nav.githubShort': 'GitHub 原始碼',
  'nav.newTab': '（另開新視窗）',
  'nav.years': '年份',
  'nav.adjacent': '相鄰年份',
  'lang.switch': 'English',
  'lang.switchLabel': '切換為英文版',
  'lang.switchHint': '（切換為英文版）',

  'copy.button': '複製',
  'copy.label': '複製 {label}',

  'home.eyebrow': 'Pantone Color of the Year {year}',
  'home.description': 'Pantone {year} 年度色 {name}，以及 {from} 年起歷年年度色與產品設計發想。',
  'home.cta': '看 {year} 年度色',
  'home.introTitle': '關於年度色',
  'home.introLead': 'Pantone 從 {from} 年開始，每年選一個顏色代表接下來的一年。',
  'home.introBody':
    '這裡收錄 {from} 到 {to} 年共 {count} 個年度色，其中 2016 和 2021 年各選了兩色。每個顏色都附上色值、配色組合，以及適合的產品、材質與表面處理，給做提案的設計師參考。',
  'home.spectrumTitle': '{count} 年的顏色',
  'home.enterArchive': '進入典藏',
  'home.spectrumLabel': '歷年年度色',
  'home.recent': '近年年度色',

  'archive.title': '歷年年度色',
  'archive.metaTitle': '典藏',
  'archive.description': '{from} 到 {to} 年 Pantone 年度代表色一覽。',
  'archive.lead':
    '從 {from} 年的 Cerulean 到 {to} 年的 {name}，點任一張色票看它的色值、配色與設計發想。',
  'archive.all': '全部年度色',

  'year.description': 'Pantone {year} 年度色 {names}：{summary}',
  'year.announced': '{date} 公布',
  'year.values': '色值',
  'year.valuesNote': '螢幕近似色，非官方色彩標準。',
  'year.story': '色彩故事',
  'year.keywords': '情緒關鍵字',
  'year.storyPending': '完整的色彩故事還在撰寫中。',
  'year.palettes': '配色',
  'year.downloadAse': '下載 .ase 色票',
  'year.downloadAseNote': '年度色與五組配色，可匯入 Illustrator、Photoshop、InDesign。',
  'year.downloadCss': '下載 CSS 變數',
  'notFound.random': '隨機一個年度色',
  'year.ideas': '設計發想',
  'year.ideasPending':
    '這個顏色的產品概念與材質建議還在整理中。可以先到產品實驗室，把 {names} 套到 3D 產品上試試看。',
  'year.audience': '使用者',
  'year.material': '材質',
  'year.finish': '表面',
  'year.tryInLab': '在實驗室試色',
  'year.goodMaterials': '適合的材質',
  'year.avoidMaterials': '避免的材質',
  'year.lab': '產品實驗室',
  'year.prev': '← 前一年',
  'year.next': '下一年 →',
  'year.deltaE': '與 {year} 年色差 ΔE {value}',
  'year.swatchLabel': '{year} 年 {names}',

  'palette.complementary': '互補',
  'palette.complementary.note': '色相相差 180°，對比最強',
  'palette.analogous': '類似',
  'palette.analogous.note': '色相左右各 30°，和諧柔順',
  'palette.triadic': '三角',
  'palette.triadic.note': '色相每 120° 一色，活潑平衡',
  'palette.split': '分裂互補',
  'palette.split.note': '互補色左右各 30°，對比較溫和',
  'palette.mono': '單色',
  'palette.mono.note': '同色相，明度由深到淺',
  'palette.cssVars': '{name}配色 CSS 變數',

  'lab.title': '產品實驗室',
  'lab.metaTitle': '{year} {names} 產品實驗室',
  'lab.description': '把 Pantone {year} 年度色 {names} 套到 3D 產品上，切換材質、場景與燈光。',
  'lab.form': '產品實驗室設定',
  'lab.scenes': '情境場景',
  'lab.viewport': '{names} 套用在 3D 產品上的預覽，可拖曳旋轉、滾輪縮放',
  'lab.noWebgl': '3D 預覽需要支援 WebGL 的瀏覽器',
  'lab.hint': '拖曳旋轉・滾輪縮放・點產品零件選擇要換色的部位',
  'lab.cameras': '鏡頭角度',
  'lab.spin': '自動旋轉',
  'lab.product': '產品',
  'lab.myModel': '我的模型',
  'lab.upload': '上傳自己的模型',
  'lab.uploadNote':
    '支援 {formats}，{size} MB 以內。檔案只在你的瀏覽器裡讀取，不會上傳或儲存到伺服器，關掉頁面就消失。上傳後點模型的零件可以在主色、輔色之間切換。',
  'lab.finish': '表面處理',
  'lab.primary': '主色',
  'lab.accent': '輔色',
  'lab.accentNone': '這個產品沒有獨立的輔色部位，換主色就會改變整件產品。',
  'lab.light': '燈光',
  'lab.export': '匯出圖片',

  'product.chair': '單椅',
  'product.headphones': '耳罩式耳機',
  'product.vase': '陶瓷花瓶',
  'product.speaker': '智慧音箱',
  'product.lamp': '桌燈',
  'product.sneaker': '運動鞋',
  'finish.matte': '霧面',
  'finish.satin': '緞面',
  'finish.gloss': '亮面',
  'finish.metallic': '金屬',
  'finish.velvet': '絨布',
  'finish.translucent': '半透明',
  'light.studio': '棚燈',
  'light.daylight': '自然光',
  'light.night': '夜間',
  'room.studio': '純色背景',
  'room.living': '客廳',
  'room.bedroom': '臥室',
  'room.office': '辦公室',
  'camera.hero': '斜側',
  'camera.front': '正面',
  'camera.side': '側面',
  'camera.top': '俯視',
  'camera.detail': '特寫',

  'space.metaTitle': '色彩空間',
  'space.description': '所有 Pantone 年度色在 OKLCH 色彩空間中的位置。',
  'space.title': '色彩空間',
  'space.lead':
    'OKLCH 用明度（L）、彩度（C）、色相（H）描述顏色，數值的差距接近人眼感受到的差距。下表列出每個年度色的座標。',
  'space.tableLabel': '年度色 OKLCH 數值',
  'space.caption': '歷年年度色的 OKLCH 數值',
  'space.year': '年份',
  'space.color': '顏色',
  'space.l': 'L 明度',
  'space.c': 'C 彩度',
  'space.h': 'H 色相',
  'space.layoutSpace': 'OKLCH 色彩空間',
  'space.layoutSpiral': '時間螺旋',
  'space.layoutWheel': '色相環',
  'space.sortHint': '點欄位名稱可以排序',

  'about.metaTitle': '關於',
  'about.description': '關於 Chroma Archive、資料來源與非官方聲明。',
  'about.title': '關於本站',
  'about.whatTitle': '這是什麼',
  'about.what':
    'Chroma Archive 收錄 Pantone 從 {from} 到 {to} 年的年度代表色。每個顏色有色值、配色組合和產品設計參考，產品實驗室可以把顏色套到 3D 模型上，換材質、場景和燈光看效果。',
  'about.valuesTitle': '關於色值',
  'about.values1':
    '頁面上的 HEX、RGB、OKLCH 等數值都是螢幕近似值，不是 Pantone 的官方色彩標準。螢幕、印刷與實體材料呈現的顏色都會不同，正式打樣請以 Pantone 實體色票為準。',
  'about.values2':
    '配色組合在 OKLCH 色彩空間計算：互補色相差 180°，類似色左右各 30°，三角每 120° 一色。超出螢幕色域的顏色會降低彩度拉回。',
  'about.legalTitle': '非官方聲明',
  'about.legal':
    '本站為個人作品，與 Pantone LLC 沒有任何關係，也未獲其授權或贊助。PANTONE® 及 Pantone Color of the Year 為 Pantone LLC 的商標。各年度色的介紹文字由本站自行撰寫。',
  'about.toolsTitle': '使用的工具',
  'about.tools':
    '以 Astro、three.js、GSAP、Lenis、Tailwind CSS 製作，色彩計算使用 culori。字型為 Fraunces、Inter、思源宋體與思源黑體，皆採 SIL Open Font License。網站部署在 Cloudflare。',
  'about.modelsTitle': '3D 模型與場景素材',
  'about.modelsLead': '產品實驗室的部分模型來自公開素材，經過重新上色與壓縮：',
  'about.modelsProcedural': '耳罩式耳機與智慧音箱由本站以程式產生。',
  'about.scenes':
    '情境場景的環境光（HDRI）、地板與牆面貼圖、家具模型來自 {link}，授權為 CC0，完整清單見原始碼中的 public/models/LICENSES.md。',

  'notFound.metaTitle': '找不到頁面',
  'zima.eyebrow': '彩蛋',
  'zima.notCoty': '不是 Pantone 年度色',
  'zima.description': 'Zima Blue：向《愛×死×機器人》〈Zima Blue〉致敬的隱藏顏色。',
  'zima.values': '色值',
  'zima.palettes': '配色',
  'zima.story': '這片藍',
  'zima.credit': '出處',
  'zima.enter': '進入 Zima Blue',
  'zima.close': '關閉',
  'zima.dialogLabel': 'Zima Blue 彩蛋',
  'space.hidden': '？',
  'notFound.title': '這個顏色不在色票裡。',
  'notFound.lead': '網址可能打錯了，或這一年的年度色還沒公布。',
  'notFound.home': '回首頁',
  'notFound.archive': '看歷年年度色',
};

export type UiKey = keyof typeof zh;

const en: Record<UiKey, string> = {
  'site.description': 'Every Pantone Color of the Year, with palettes and product design ideas.',
  'site.disclaimer':
    'A personal project, not affiliated with Pantone LLC. All color values are screen approximations, not official color standards. PANTONE® is a registered trademark of Pantone LLC.',
  'site.tagline':
    'Every Pantone Color of the Year from {from} to {to}, with product design references for each color.',
  'a11y.skip': 'Skip to main content',
  'a11y.announcer': '',
  'nav.main': 'Main navigation',
  'nav.footer': 'Footer navigation',
  'nav.archive': 'Archive',
  'nav.space': 'Color space',
  'nav.about': 'About',
  'nav.aboutSite': 'About this site',
  'nav.github': 'Source code on GitHub (opens in a new tab)',
  'nav.githubShort': 'Source on GitHub',
  'nav.newTab': ' (opens in a new tab)',
  'nav.years': 'Years',
  'nav.adjacent': 'Adjacent years',
  'lang.switch': '中文',
  'lang.switchLabel': 'Switch to Traditional Chinese',
  'lang.switchHint': ' (switch to Traditional Chinese)',

  'copy.button': 'Copy',
  'copy.label': 'Copy {label}',

  'home.eyebrow': 'Pantone Color of the Year {year}',
  'home.description':
    'Pantone Color of the Year {year}, {name}, and every Color of the Year since {from}, with product design ideas.',
  'home.cta': 'See the {year} color',
  'home.introTitle': 'About Color of the Year',
  'home.introLead':
    'Since {from}, Pantone has picked one color each year to set the tone for the year ahead.',
  'home.introBody':
    'This archive collects all {count} colors from {from} to {to}; 2016 and 2021 each had two. Every color comes with its values, palettes, and suggested products, materials and finishes for designers putting together a proposal.',
  'home.spectrumTitle': '{count} years of color',
  'home.enterArchive': 'Open the archive',
  'home.spectrumLabel': 'Colors of the Year',
  'home.recent': 'Recent colors',

  'archive.title': 'Every Color of the Year',
  'archive.metaTitle': 'Archive',
  'archive.description': 'Every Pantone Color of the Year from {from} to {to}.',
  'archive.lead':
    'From Cerulean in {from} to {name} in {to}. Pick a swatch to see its values, palettes and design ideas.',
  'archive.all': 'All colors',

  'year.description': 'Pantone Color of the Year {year}, {names}: {summary}',
  'year.announced': 'Announced {date}',
  'year.values': 'Values',
  'year.valuesNote': 'Screen approximation, not an official color standard.',
  'year.story': 'Story',
  'year.keywords': 'Mood keywords',
  'year.storyPending': 'The full story for this color is still being written.',
  'year.palettes': 'Palettes',
  'year.downloadAse': 'Download .ase swatches',
  'year.downloadCss': 'Download CSS variables',
  'notFound.random': 'A random Color of the Year',
  'year.downloadAseNote':
    'The color and all five palettes, ready for Illustrator, Photoshop and InDesign.',
  'year.ideas': 'Design ideas',
  'year.ideasPending':
    'Product concepts and material notes for this color are on the way. In the meantime, try {names} on 3D products in the lab.',
  'year.audience': 'For',
  'year.material': 'Material',
  'year.finish': 'Finish',
  'year.tryInLab': 'Try it in the lab',
  'year.goodMaterials': 'Works well with',
  'year.avoidMaterials': 'Best avoided',
  'year.lab': 'Product lab',
  'year.prev': '← Previous year',
  'year.next': 'Next year →',
  'year.deltaE': 'ΔE {value} from {year}',
  'year.swatchLabel': '{year} {names}',

  'palette.complementary': 'Complementary',
  'palette.complementary.note': 'Hue rotated 180°, the strongest contrast',
  'palette.analogous': 'Analogous',
  'palette.analogous.note': 'Hues 30° to either side, calm and cohesive',
  'palette.triadic': 'Triadic',
  'palette.triadic.note': 'Three hues 120° apart, lively but balanced',
  'palette.split': 'Split complementary',
  'palette.split.note': '30° to either side of the complement, softer contrast',
  'palette.mono': 'Monochrome',
  'palette.mono.note': 'Same hue, from dark to light',
  'palette.cssVars': '{name} palette as CSS variables',

  'lab.title': 'Product lab',
  'lab.metaTitle': '{year} {names} product lab',
  'lab.description':
    'Apply Pantone Color of the Year {year}, {names}, to 3D products and switch finishes, scenes and lighting.',
  'lab.form': 'Product lab settings',
  'lab.scenes': 'Scene',
  'lab.viewport': '{names} applied to a 3D product. Drag to rotate, scroll to zoom',
  'lab.noWebgl': 'The 3D preview needs a browser with WebGL',
  'lab.hint': 'Drag to rotate · Scroll to zoom · Click a part to pick which color it uses',
  'lab.cameras': 'Camera angle',
  'lab.spin': 'Auto-rotate',
  'lab.product': 'Product',
  'lab.myModel': 'My model',
  'lab.upload': 'Upload your own model',
  'lab.uploadNote':
    'Supports {formats}, up to {size} MB. The file is read in your browser only. It is never uploaded or stored on a server and is gone when you close the page. After uploading, click a part to switch it between the primary and accent color.',
  'lab.finish': 'Finish',
  'lab.primary': 'Primary color',
  'lab.accent': 'Accent color',
  'lab.accentNone':
    'This product has no separate accent part; the primary color covers the whole product.',
  'lab.light': 'Lighting',
  'lab.export': 'Export image',

  'product.chair': 'Armchair',
  'product.headphones': 'Headphones',
  'product.vase': 'Ceramic vase',
  'product.speaker': 'Smart speaker',
  'product.lamp': 'Table lamp',
  'product.sneaker': 'Sneaker',
  'finish.matte': 'Matte',
  'finish.satin': 'Satin',
  'finish.gloss': 'Gloss',
  'finish.metallic': 'Metallic',
  'finish.velvet': 'Velvet',
  'finish.translucent': 'Translucent',
  'light.studio': 'Studio',
  'light.daylight': 'Daylight',
  'light.night': 'Night',
  'room.studio': 'Plain backdrop',
  'room.living': 'Living room',
  'room.bedroom': 'Bedroom',
  'room.office': 'Office',
  'camera.hero': 'Three-quarter',
  'camera.front': 'Front',
  'camera.side': 'Side',
  'camera.top': 'Top',
  'camera.detail': 'Close-up',

  'space.metaTitle': 'Color space',
  'space.description': 'Where every Pantone Color of the Year sits in the OKLCH color space.',
  'space.title': 'Color space',
  'space.lead':
    'OKLCH describes a color by lightness (L), chroma (C) and hue (H), and its distances track what the eye perceives. The table lists the coordinates of every Color of the Year.',
  'space.tableLabel': 'OKLCH values of each Color of the Year',
  'space.caption': 'OKLCH values of every Color of the Year',
  'space.year': 'Year',
  'space.color': 'Color',
  'space.l': 'L lightness',
  'space.c': 'C chroma',
  'space.h': 'H hue',
  'space.layoutSpace': 'OKLCH space',
  'space.layoutSpiral': 'Timeline spiral',
  'space.layoutWheel': 'Hue wheel',
  'space.sortHint': 'Select a column name to sort',

  'about.metaTitle': 'About',
  'about.description': 'About Chroma Archive, its sources and the non-affiliation notice.',
  'about.title': 'About this site',
  'about.whatTitle': 'What this is',
  'about.what':
    'Chroma Archive collects every Pantone Color of the Year from {from} to {to}. Each color has its values, palettes and product design references, and the product lab lets you apply it to 3D models with different finishes, scenes and lighting.',
  'about.valuesTitle': 'About the color values',
  'about.values1':
    'HEX, RGB, OKLCH and the other values on this site are screen approximations, not Pantone’s official color standards. Screens, print and physical materials all render color differently; use a physical Pantone guide for production work.',
  'about.values2':
    'Palettes are computed in OKLCH: complements are 180° apart, analogous colors 30° to either side, triadic colors every 120°. Colors outside the screen gamut have their chroma reduced to fit.',
  'about.legalTitle': 'Non-affiliation notice',
  'about.legal':
    'This is a personal project with no connection to Pantone LLC, and it is not licensed or sponsored by Pantone. PANTONE® and Pantone Color of the Year are trademarks of Pantone LLC. The descriptions of each color are written for this site.',
  'about.toolsTitle': 'Built with',
  'about.tools':
    'Built with Astro, three.js, GSAP, Lenis and Tailwind CSS, with culori for color math. Typefaces are Fraunces, Inter, Noto Serif TC and Noto Sans TC, all under the SIL Open Font License. Hosted on Cloudflare.',
  'about.modelsTitle': '3D models and scene assets',
  'about.modelsLead':
    'Some product lab models come from public sources and have been recolored and compressed:',
  'about.modelsProcedural': 'The headphones and smart speaker are generated in code.',
  'about.scenes':
    'Scene lighting (HDRIs), floor and wall textures and furniture come from {link} under CC0. The full list is in public/models/LICENSES.md in the source code.',

  'notFound.metaTitle': 'Page not found',
  'zima.eyebrow': 'Easter egg',
  'zima.notCoty': 'Not a Pantone Color of the Year',
  'zima.description':
    'Zima Blue: a hidden color in tribute to “Zima Blue” from Love, Death & Robots.',
  'zima.values': 'Values',
  'zima.palettes': 'Palettes',
  'zima.story': 'The blue',
  'zima.credit': 'Credits',
  'zima.enter': 'Enter Zima Blue',
  'zima.close': 'Close',
  'zima.dialogLabel': 'Zima Blue easter egg',
  'space.hidden': '?',
  'notFound.title': 'This color isn’t in the swatch book.',
  'notFound.lead': 'The address may be mistyped, or this year’s color hasn’t been announced yet.',
  'notFound.home': 'Home',
  'notFound.archive': 'See every color',
};

const dictionaries: Record<Lang, Record<UiKey, string>> = { 'zh-tw': zh, en };

export type Translate = (key: UiKey, vars?: Record<string, string | number>) => string;

export function useT(lang: Lang): Translate {
  const dict = dictionaries[lang];
  return (key, vars) =>
    dict[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`));
}

/** 兩種語系的日期格式：2024.12.05 與 Dec 5, 2024 */
export function formatDate(lang: Lang, iso: string): string {
  if (lang === 'zh-tw') return iso.replaceAll('-', '.');
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
