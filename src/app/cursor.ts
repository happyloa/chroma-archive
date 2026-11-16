import { gsap } from 'gsap';
import { onMotionChange, prefersReducedMotion } from './motion';

/**
 * 自訂游標（T036、FR-09）：跟著滑鼠的圓點，滑到連結、按鈕會放大成外框；
 * 滑到帶 data-cursor-color 的色塊時吸取那個顏色。啟用時隱藏原生游標（<html data-cursor="custom">），
 * 所以圓點中心緊貼滑鼠位置，只有放大、吸色的變化有動畫。
 * 觸控裝置與減少動態效果時不啟用，保留原生游標。
 */
let dot: HTMLElement | null = null;

function enabled(): boolean {
  return window.matchMedia('(pointer: fine)').matches && !prefersReducedMotion();
}

export function initCursor(): void {
  const setup = () => {
    if (!enabled() || dot) return;
    dot = document.createElement('div');
    dot.className = 'chroma-cursor';
    dot.setAttribute('aria-hidden', 'true');
    document.body.append(dot);
    document.documentElement.dataset.cursor = 'custom';

    window.addEventListener('pointermove', (e) => {
      if (!dot) return;
      gsap.set(dot, { x: e.clientX, y: e.clientY });
      dot.dataset.moved = '';
      const target = e.target as Element | null;
      const colored = target?.closest<HTMLElement>('[data-cursor-color]');
      const interactive = target?.closest('a, button, label, input, [data-view]');
      if (colored) {
        dot.style.setProperty('--cursor-fill', colored.dataset.cursorColor!);
        dot.dataset.state = 'color';
      } else if (interactive) {
        dot.dataset.state = 'hover';
      } else {
        delete dot.dataset.state;
      }
    });
    document.addEventListener('pointerleave', () => dot && (dot.style.opacity = '0'));
    document.addEventListener('pointerenter', () => dot && (dot.style.opacity = ''));
  };

  setup();
  // ClientRouter 換頁會換掉 body 內容，把圓點加回去
  // <html> 的屬性也會被換掉，重新標記
  document.addEventListener('astro:after-swap', () => {
    if (!dot) return;
    if (!dot.isConnected) document.body.append(dot);
    document.documentElement.dataset.cursor = 'custom';
  });
  onMotionChange(() => {
    if (!enabled()) {
      dot?.remove();
      dot = null;
      delete document.documentElement.dataset.cursor;
    } else setup();
  });
}
