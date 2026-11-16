import type { Stage } from '../stage/Stage';
import { initCopy } from './copy';
import { initTicker, tickerCallbackCount } from './ticker';

/**
 * 瀏覽器端進入點。Astro 打包後的模組 script 在 ClientRouter 換頁時不會重新執行，
 * 所以這裡的初始化只跑一次；每次換頁的工作放在 astro:page-load。
 */
initTicker();
initCopy();

let stage: Stage | null = null;
let StageClass: typeof Stage | null = null;
let pageLoads = 0;

async function applyPage(): Promise<void> {
  pageLoads += 1;
  const canvas = document.getElementById('stage');
  const main = document.querySelector('main');
  if (!(canvas instanceof HTMLCanvasElement) || !main) return;

  // three.js 延遲載入，不算進首頁初始 JS 預算（憲章第 3 條）
  StageClass ??= (await import('../stage/Stage')).Stage;
  stage = StageClass.get(canvas);
  stage.setScene(main.dataset.scene ?? 'none', main.dataset.color ?? '#F0EEE9');
}

document.addEventListener('astro:page-load', () => void applyPage());

declare global {
  interface Window {
    __chroma?: () => {
      stageInstances: number;
      pageLoads: number;
      tickerCallbacks: number;
      frames: number;
      sameCanvas: boolean;
      geometries: number;
      textures: number;
      programs: number;
    };
  }
}

// T005 驗證用的偵錯資訊，e2e 測試會讀取
window.__chroma = () => ({
  stageInstances: StageClass?.instances ?? 0,
  pageLoads,
  tickerCallbacks: tickerCallbackCount(),
  frames: stage?.frames ?? 0,
  sameCanvas: stage?.canvas === document.getElementById('stage'),
  geometries: stage?.renderer.info.memory.geometries ?? 0,
  textures: stage?.renderer.info.memory.textures ?? 0,
  programs: stage?.renderer.info.programs?.length ?? 0,
});
