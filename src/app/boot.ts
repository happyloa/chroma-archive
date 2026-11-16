import type { Stage } from '../stage/Stage';
import { initCopy } from './copy';
import { initCursor } from './cursor';
import { cleanupReveal, initReveal } from './reveal';
import { initSortTable } from './sortTable';
import { initTransitions } from './transitions';
import { initLab } from './lab';
import { initMotion, onMotionChange, prefersReducedMotion, webglAvailable } from './motion';
import { initTicker, tickerCallbackCount } from './ticker';

/**
 * 瀏覽器端進入點。Astro 打包後的模組 script 在 ClientRouter 換頁時不會重新執行，
 * 所以這裡的初始化只跑一次；每次換頁的工作放在 astro:page-load。
 */
initMotion();
initTicker();
initCopy();
initCursor();
initTransitions();
initSortTable();

let stage: Stage | null = null;
let StageClass: typeof Stage | null = null;
let pageLoads = 0;

async function applyPage(): Promise<void> {
  pageLoads += 1;
  const page = pageLoads;
  initLab();
  // 不支援 WebGL 時不載入 three.js，頁面維持靜態版
  if (!webglAvailable) return;
  const canvas = document.getElementById('stage');
  const main = document.querySelector('main');
  if (!(canvas instanceof HTMLCanvasElement) || !main) return;
  // 這一頁沒有 3D 視窗（例如 about、404），而且還沒建立過舞台：不必下載 three.js、建立 WebGL
  if (!StageClass && !main.querySelector('[data-view]')) return;

  // three.js 延遲載入，不算進首頁初始 JS 預算
  if (!StageClass) {
    // 第一次載入：等瀏覽器閒置（最多 1.2 秒）才載入 three.js、建立 3D，首屏文字先畫出來
    await new Promise<void>((resolve) =>
      'requestIdleCallback' in window
        ? requestIdleCallback(() => resolve(), { timeout: 1200 })
        : setTimeout(resolve, 300),
    );
    StageClass = (await import('../stage/Stage')).Stage;
  }
  // 等待期間已經換頁：新頁面的 applyPage 會處理，舊的 <main> 不再建立
  if (page !== pageLoads || !main.isConnected) return;
  stage = StageClass.get(canvas);
  stage.setReducedMotion(prefersReducedMotion());
  await stage.mount(main);
}

// Zima Blue 彩蛋：色彩空間的隱藏球發出這個事件，動畫程式第一次觸發時才載入
document.addEventListener('chroma:zima', () => {
  void import('./zima').then((m) => m.openZimaReveal());
});

document.addEventListener('astro:page-load', () => {
  initReveal();
  void applyPage();
});
document.addEventListener('astro:before-swap', cleanupReveal);
document.addEventListener('astro:before-swap', () => stage?.unmount());
// 瀏覽中途切換動態偏好：重建這一頁的 3D 視窗，靜態替代內容與 3D 互換
onMotionChange((reduced) => {
  if (!stage) return;
  const main = document.querySelector('main');
  stage.unmount();
  stage.setReducedMotion(reduced);
  if (main) void stage.mount(main);
});

declare global {
  interface Window {
    /** Base layout 的 inline script 在首次繪製前寫入的旗標 */
    __chromaWebgl?: boolean;
    __chromaLite?: boolean;
    __chromaForceFull?: boolean;
    __chromaNavigated?: boolean;
    __chromaHeadInit?: boolean;
    __chroma?: () => {
      stageInstances: number;
      pageLoads: number;
      tickerCallbacks: number;
      frames: number;
      sameCanvas: boolean;
      views: number;
      geometries: number;
      textures: number;
      programs: number;
      /** renderer 實際畫過幾次（畫面沒變化時 Stage 不畫） */
      draws: number;
    };
  }
}

// 偵錯資訊，e2e 測試會讀取
window.__chroma = () => ({
  stageInstances: StageClass?.instances ?? 0,
  pageLoads,
  tickerCallbacks: tickerCallbackCount(),
  frames: stage?.frames ?? 0,
  sameCanvas: stage?.canvas === document.getElementById('stage'),
  views: stage?.viewCount ?? 0,
  geometries: stage?.renderer.info.memory.geometries ?? 0,
  textures: stage?.renderer.info.memory.textures ?? 0,
  programs: stage?.renderer.info.programs?.length ?? 0,
  draws: stage?.renderer.info.render.frame ?? 0,
});
