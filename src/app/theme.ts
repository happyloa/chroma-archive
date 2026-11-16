import { createThemeReveal } from './themeReveal';

/**
 * 深淺色切換（US-10）。主題寫在 <html data-theme>，選擇存在 localStorage；
 * 沒有選過時跟隨系統設定。首次繪製前的套用由 Base layout 的 inline script 處理，避免閃爍。
 */
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'chroma-theme';
const MOTION_QUERY = '(prefers-reduced-motion: no-preference) and (forced-colors: none)';

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // 儲存空間被封鎖時，仍可切換本次瀏覽的配色
  }
  syncButtons();
  window.dispatchEvent(new CustomEvent<Theme>('themechange', { detail: theme }));
}

function syncButtons(): void {
  const dark = currentTheme() === 'dark';
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    button.setAttribute('aria-pressed', String(dark));
    button.disabled = false;
  }
}

type SnapshotProvider = () => string | undefined;
let snapshot: SnapshotProvider = () => undefined;

/** 由 boot.ts 提供 WebGL 畫面快照，揭露動畫的舊配色層才看得到 3D 內容 */
export function setCanvasSnapshotProvider(provider: SnapshotProvider): void {
  snapshot = provider;
}

export function initTheme(): void {
  const reveal = createThemeReveal();
  const cancel = () => reveal.cancel();

  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      '[data-theme-toggle]',
    );
    if (!button) {
      // 點了連結、按鈕等互動元素時，結束還在跑的揭露動畫
      if ((event.target as Element | null)?.closest('a, button, input, select, textarea')) cancel();
      return;
    }
    if (window.matchMedia(MOTION_QUERY).matches) {
      reveal.start(button.getBoundingClientRect(), snapshot());
    } else {
      cancel();
    }
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  // 換頁、縮放視窗、切到背景時結束動畫，避免疊層和真實頁面對不上
  document.addEventListener('astro:before-swap', cancel);
  window.addEventListener('resize', cancel);
  document.addEventListener('visibilitychange', cancel);
  document.addEventListener('astro:page-load', syncButtons);
  syncButtons();
}
