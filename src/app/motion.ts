/**
 * 動態偏好與 WebGL 可用性。
 * 結果寫在 <html data-motion data-webgl> 上，CSS 可以依此切換靜態替代內容。
 */

type Listener = (reduced: boolean) => void;

const query = window.matchMedia('(prefers-reduced-motion: reduce)');
const listeners = new Set<Listener>();

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

export const webglAvailable = detectWebGL();

export function prefersReducedMotion(): boolean {
  return query.matches;
}

/** 使用者在瀏覽中途切換系統設定也會通知 */
export function onMotionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function apply(): void {
  const root = document.documentElement;
  root.dataset.motion = query.matches ? 'reduce' : 'full';
  root.dataset.webgl = webglAvailable ? 'on' : 'off';
}

export function initMotion(): void {
  apply();
  query.addEventListener('change', () => {
    apply();
    for (const l of listeners) l(query.matches);
  });
  // ClientRouter 換頁會換掉 <html> 的屬性，換頁後重新套用
  document.addEventListener('astro:after-swap', apply);
}
