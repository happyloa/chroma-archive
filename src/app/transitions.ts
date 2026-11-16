import type { TransitionDirectionalAnimations } from 'astro';

/**
 * 換頁轉場（T035、T044、US-07）：
 * - 整頁：新頁面從點擊位置以圓形擴散出現，舊頁面留在底下，約 0.9 秒
 * - 色票卡片：典藏頁與年度頁的色票用同一個 transition:name，瀏覽器自動做共享元素轉場
 * 減少動態效果時由 global.css 關掉動畫。
 */
const reveal = {
  old: { name: 'vt-hold', duration: '0.9s', easing: 'linear', fillMode: 'both' },
  new: {
    name: 'vt-reveal',
    duration: '0.9s',
    easing: 'cubic-bezier(0.7, 0, 0.2, 1)',
    fillMode: 'both',
  },
};

export const rootTransition: TransitionDirectionalAnimations = {
  forwards: reveal,
  backwards: reveal,
};

let origin = { x: '50%', y: '50%' };

/** 記住最後一次點擊的位置；換頁後 <html> 的 style 會被換掉，所以在 after-swap 再寫一次 */
export function initTransitions(): void {
  document.addEventListener(
    'pointerdown',
    (e) => {
      origin = { x: `${e.clientX}px`, y: `${e.clientY}px` };
    },
    { capture: true },
  );
  // 鍵盤操作或上一頁：從畫面中央擴散
  document.addEventListener('keydown', () => (origin = { x: '50%', y: '50%' }), { capture: true });
  window.addEventListener('popstate', () => (origin = { x: '50%', y: '50%' }));
  const apply = () => {
    document.documentElement.style.setProperty('--vt-x', origin.x);
    document.documentElement.style.setProperty('--vt-y', origin.y);
  };
  document.addEventListener('astro:before-preparation', apply);
  document.addEventListener('astro:after-swap', apply);
}
