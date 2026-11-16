import { gsap } from 'gsap';
import { prefersReducedMotion } from './motion';

/**
 * Zima Blue 致敬動畫（specs/002-zima-blue US-Z2）：一小塊方形慢慢放大到蓋滿畫面，
 * 水面開始起伏，最後出現短文與出處。用原生 <dialog>：Esc 關閉、焦點留在對話框內。
 * 減少動態效果時直接顯示最後的畫面。
 */
let timeline: gsap.core.Timeline | null = null;
let returnFocus: HTMLElement | null = null;

export function openZimaReveal(): void {
  const dialog = document.getElementById('zima-reveal');
  if (!(dialog instanceof HTMLDialogElement) || dialog.open) return;
  const square = dialog.querySelector<HTMLElement>('.zima-square')!;
  const water = dialog.querySelector<HTMLElement>('.zima-water')!;
  const panel = dialog.querySelector<HTMLElement>('.zima-panel')!;

  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.addEventListener('click', onClick);
  dialog.addEventListener('close', onClose, { once: true });
  dialog.showModal();
  // 對話框在最上層（top layer），原生游標又已隱藏，自訂游標的圓點要移進對話框才看得到
  const cursor = document.querySelector('.chroma-cursor');
  if (cursor) dialog.append(cursor);

  // 方形放大到能蓋住整個畫面（含對角線）
  const cover = (Math.hypot(window.innerWidth, window.innerHeight) / square.offsetWidth) * 1.05;
  timeline?.kill();
  if (prefersReducedMotion()) {
    gsap.set(square, { scale: cover });
    gsap.set(water, { opacity: 1 });
    gsap.set(panel, { opacity: 1, y: 0 });
    return;
  }
  timeline = gsap
    .timeline()
    .fromTo(square, { scale: 0 }, { scale: 1, duration: 0.8, ease: 'power2.out' })
    .to(square, { scale: cover, duration: 2, ease: 'expo.inOut' }, '+=0.5')
    .fromTo(water, { opacity: 0 }, { opacity: 1, duration: 1.2 }, '-=0.8')
    .fromTo(
      panel,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' },
      '-=0.4',
    );
}

function onClick(event: MouseEvent): void {
  if ((event.target as Element | null)?.closest('[data-zima-close]')) {
    (event.currentTarget as HTMLDialogElement).close();
  }
}

function onClose(this: HTMLDialogElement): void {
  this.removeEventListener('click', onClick);
  const cursor = this.querySelector('.chroma-cursor');
  if (cursor) document.body.append(cursor);
  timeline?.kill();
  timeline = null;
  returnFocus?.focus();
  returnFocus = null;
}
