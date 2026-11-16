import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { prefersReducedMotion } from './motion';

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * 文字與區塊出場（T037、T042）：
 * - [data-split]：逐字（中文）或逐詞（英文）由下往上出場
 * - [data-reveal]：整塊淡入上移
 * - [data-split-exit]：首頁主視覺的標題，進場後隨捲動逐字往上淡出（US-01-3）
 * - [data-weight]：年份數字隨捲動從 300 變到 900（Fraunces 可變字重，spec.md 第 7 節）
 * 內容本來就在 HTML 裡；沒有 JS 或減少動態效果時照常顯示。每次換頁前清掉這一頁的動畫。
 */
let context: gsap.Context | null = null;
const splits: SplitText[] = [];

export function initReveal(root: ParentNode = document): void {
  cleanupReveal();
  if (prefersReducedMotion()) {
    document.documentElement.classList.remove('motion-pending');
    return;
  }

  context = gsap.context(() => {
    for (const el of root.querySelectorAll<HTMLElement>('[data-split]')) {
      const english = el.closest('[lang]')?.getAttribute('lang')?.startsWith('en') ?? false;
      // 拆開的字對螢幕閱讀器隱藏，旁邊放一份原文；span 不能用 aria-label，所以不用 SplitText 內建的處理
      const label = document.createElement('span');
      label.className = 'sr-only';
      label.dataset.splitLabel = '';
      label.textContent = el.textContent?.trim() ?? '';
      el.before(label);
      el.setAttribute('aria-hidden', 'true');
      const split = new SplitText(el, {
        type: english ? 'words' : 'chars',
        mask: english ? 'words' : 'chars',
        aria: 'none',
      });
      splits.push(split);
      const targets = english ? split.words : split.chars;
      const hero = el.closest<HTMLElement>('[data-view="hero"]');
      const exit = el.hasAttribute('data-split-exit') && hero;
      gsap.from(targets, {
        yPercent: 110,
        opacity: 0,
        duration: 1,
        ease: 'expo.out',
        stagger: english ? 0.06 : 0.035,
        delay: hero ? 0.2 : 0,
        scrollTrigger: hero ? undefined : { trigger: el, start: 'top 85%', once: true },
        // 進場結束後才建立退場，起始值才會是進場後的位置；標題往上捲過畫面 35% 才開始淡出
        onComplete: exit
          ? () =>
              context?.add(() => {
                gsap.to(targets, {
                  yPercent: -100,
                  opacity: 0,
                  ease: 'none',
                  stagger: english ? 0.04 : 0.02,
                  scrollTrigger: {
                    trigger: el,
                    start: 'top 35%',
                    end: 'bottom top',
                    scrub: true,
                  },
                });
              })
          : undefined,
      });
    }

    for (const el of root.querySelectorAll<HTMLElement>('[data-reveal-up]')) {
      gsap.from(el, {
        y: 40,
        opacity: 0,
        duration: 1.1,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    }

    for (const el of root.querySelectorAll<HTMLElement>('[data-weight]')) {
      gsap.fromTo(
        el,
        { fontVariationSettings: '"wght" 300' },
        {
          fontVariationSettings: '"wght" 900',
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom top', scrub: true },
        },
      );
    }
  });
  // 動畫的初始狀態設好了，解除首次繪製時的隱藏
  document.documentElement.classList.remove('motion-pending');
  ScrollTrigger.refresh();
}

export function cleanupReveal(): void {
  context?.revert();
  context = null;
  for (const s of splits.splice(0)) s.revert();
  for (const label of document.querySelectorAll('[data-split-label]')) {
    label.nextElementSibling?.removeAttribute('aria-hidden');
    label.remove();
  }
}
