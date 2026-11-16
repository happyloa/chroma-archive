import type { ViewReadyDetail } from '../stage/types';
import type { ProductState, ProductView } from '../stage/views/ProductView';

/**
 * 產品實驗室頁的表單控制（US-05、T049）：
 * 表單 ↔ 3D 視窗 ↔ 網址參數三方同步，以及匯出 PNG。
 */
const PARAMS = ['p', 'f', 'c1', 'c2', 'l'] as const;

function checked(form: HTMLFormElement, name: string): HTMLInputElement | null {
  return form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
}

function readState(form: HTMLFormElement): ProductState {
  return {
    product: checked(form, 'p')?.value as ProductState['product'],
    finish: checked(form, 'f')?.value as ProductState['finish'],
    primary: checked(form, 'c1')?.dataset.hex ?? '#A47864',
    accent: checked(form, 'c2')?.value ?? '#E8DCCB',
    light: checked(form, 'l')?.value as ProductState['light'],
  };
}

/** 網址參數套用到表單；不認得的值直接忽略，保留預設 */
function applyParams(form: HTMLFormElement): void {
  const params = new URLSearchParams(location.search);
  for (const name of PARAMS) {
    const value = params.get(name);
    if (!value) continue;
    const input = [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].find(
      (i) => i.value.toLowerCase() === value.toLowerCase(),
    );
    if (input) input.checked = true;
  }
}

function writeParams(form: HTMLFormElement): void {
  const params = new URLSearchParams();
  for (const name of PARAMS) {
    const v = checked(form, name)?.value;
    if (v) params.set(name, v);
  }
  // 保留 Astro router 放在 history.state 的資料
  history.replaceState(history.state, '', `${location.pathname}?${params}`);
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initLab(): void {
  const form = document.getElementById('lab-form');
  const viewport = document.getElementById('lab-viewport');
  const exportButton = document.getElementById('lab-export');
  if (
    !(form instanceof HTMLFormElement) ||
    !viewport ||
    !(exportButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  let view: ProductView | null = null;
  applyParams(form);

  viewport.addEventListener('stage:view-ready', (event) => {
    view = (event as CustomEvent<ViewReadyDetail>).detail.view as ProductView;
    view.set(readState(form));
    exportButton.disabled = false;
  });

  form.addEventListener('change', () => {
    view?.set(readState(form));
    writeParams(form);
  });

  exportButton.addEventListener('click', async () => {
    if (!view) return;
    const c1 = checked(form, 'c1');
    const label = c1?.dataset.label ?? '';
    exportButton.disabled = true;
    const original = exportButton.textContent;
    exportButton.textContent = '產生中…';
    try {
      const blob = await view.exportPNG(2048, `${label} · chroma-archive`);
      const state = readState(form);
      download(blob, `chroma-archive-${c1?.value ?? 'color'}-${state.product}-${state.finish}.png`);
    } finally {
      exportButton.textContent = original;
      exportButton.disabled = false;
    }
  });
}
