/**
 * 瀏覽器端程式用的文字（US-13）。語系取自 <html lang>，ClientRouter 換頁後會跟著更新。
 */
const zh = {
  copied: '已複製',
  copy: '複製',
  copiedLabel: '已複製 {label}',
  clipboardDenied: '無法存取剪貼簿，請手動選取文字複製',
  pickedPrimary: '已選取主色部位',
  pickedAccent: '已選取輔色部位',
  photoUnsupported: '這台裝置沒有可用的 GPU 加速，無法使用相片級渲染。',
  photoBuilding: '相片級渲染準備中…',
  photoSamples: '相片級渲染・{samples} 次取樣',
  photoCompiling: '第一次使用相片級渲染要先編譯著色器，約需數十秒（{seconds} 秒）',
  viewNotReady: '3D 預覽還沒準備好，請稍候再試',
  reading: '正在讀取 {name}…',
  myModel: '我的模型：{name}',
  loaded: '已載入 {name}。點模型的零件可以切換主色與輔色。',
  readFailed: '無法讀取這個檔案',
  exporting: '產生中…',
  rendering: '渲染中 {percent}%',
  unsupportedType: '不支援 {ext} 檔案，請使用 {formats}',
  unsupportedTypeUnknown: '不支援這種檔案，請使用 {formats}',
  tooLarge: '檔案超過 {size} MB 上限',
  draco: '不支援 Draco 壓縮的模型，請改用未壓縮或 Meshopt 壓縮的檔案',
  gltfFailed: '無法讀取這個 glTF 檔。.gltf 必須把貼圖與 bin 內嵌在檔案裡，建議改用 .glb',
  noMesh: '檔案裡沒有可顯示的模型',
};

type ClientKey = keyof typeof zh;

const en: Record<ClientKey, string> = {
  copied: 'Copied',
  copy: 'Copy',
  copiedLabel: 'Copied {label}',
  clipboardDenied: 'Clipboard access was blocked. Select the text and copy it manually.',
  pickedPrimary: 'Primary color part selected',
  pickedAccent: 'Accent color part selected',
  photoUnsupported: 'This device has no GPU acceleration available, so photo mode is unavailable.',
  photoBuilding: 'Preparing photo mode…',
  photoSamples: 'Photo mode · {samples} samples',
  photoCompiling:
    'Compiling shaders for first use of photo mode, this can take up to a minute ({seconds}s)',
  viewNotReady: 'The 3D preview isn’t ready yet. Try again in a moment.',
  reading: 'Reading {name}…',
  myModel: 'My model: {name}',
  loaded: 'Loaded {name}. Click a part to switch it between the primary and accent color.',
  readFailed: 'Couldn’t read this file',
  exporting: 'Exporting…',
  rendering: 'Rendering {percent}%',
  unsupportedType: '{ext} files aren’t supported. Use {formats}',
  unsupportedTypeUnknown: 'This file type isn’t supported. Use {formats}',
  tooLarge: 'The file is larger than the {size} MB limit',
  draco: 'Draco-compressed models aren’t supported. Use an uncompressed or Meshopt-compressed file',
  gltfFailed:
    'Couldn’t read this glTF file. A .gltf must embed its textures and bin; a .glb is recommended',
  noMesh: 'The file has no displayable model',
};

export function clientLang(): 'zh-tw' | 'en' {
  return document.documentElement.lang.startsWith('en') ? 'en' : 'zh-tw';
}

export function ct(key: ClientKey, vars?: Record<string, string | number>): string {
  const dict = clientLang() === 'en' ? en : zh;
  return dict[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? ''));
}

export function listSeparator(): string {
  return clientLang() === 'en' ? ', ' : '、';
}
