import type { ViewReadyDetail } from '../stage/types';
import type { PickDetail, ProductState, ProductView } from '../stage/views/ProductView';

/**
 * 產品實驗室頁的表單控制（US-05、T049、T055）：
 * 表單 ↔ 3D 視窗 ↔ 網址參數三方同步、點選零件、匯出 PNG。
 */
const PARAMS = ['p', 'f', 'c1', 'c2', 'l', 's', 'cam'] as const;

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
    room: (checked(form, 's')?.value ?? 'studio') as ProductState['room'],
    camera: (checked(form, 'cam')?.value ?? 'hero') as ProductState['camera'],
    spin: !!checked(form, 'spin'),
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
  const spin = form.querySelector<HTMLInputElement>('input[name="spin"]');
  if (spin) {
    if (params.get('spin') === '0') spin.checked = false;
    // 減少動態效果時預設不自轉
    else if (!params.has('spin') && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      spin.checked = false;
    }
  }
}

function writeParams(form: HTMLFormElement): void {
  const params = new URLSearchParams();
  for (const name of PARAMS) {
    const v = checked(form, name)?.value;
    if (v) params.set(name, v);
  }
  if (!checked(form, 'spin')) params.set('spin', '0');
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

/** 點了 3D 產品的零件：把焦點移到對應的顏色欄位並短暫標示 */
function focusSlot(form: HTMLFormElement, slot: PickDetail['slot']): void {
  const fieldset = form.querySelector<HTMLFieldSetElement>(`fieldset[data-slot="${slot}"]`);
  if (!fieldset) return;
  for (const f of form.querySelectorAll<HTMLElement>('fieldset[data-slot]'))
    delete f.dataset.picked;
  fieldset.dataset.picked = '';
  const input =
    fieldset.querySelector<HTMLInputElement>('input:checked') ?? fieldset.querySelector('input');
  input?.focus({ preventScroll: true });
  fieldset.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const announcer = document.getElementById('announcer');
  if (announcer) announcer.textContent = slot === 'primary' ? '已選取主色部位' : '已選取輔色部位';
  window.setTimeout(() => delete fieldset.dataset.picked, 1600);
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
    // 網址帶進來的設定直接套用，不播進場動畫
    view.set(readState(form), false);
    exportButton.disabled = false;
  });

  viewport.addEventListener('product:pick', (event) => {
    focusSlot(form, (event as CustomEvent<PickDetail>).detail.slot);
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
      download(
        blob,
        `chroma-archive-${c1?.value ?? 'color'}-${state.product}-${state.finish}${state.room === 'studio' ? '' : `-${state.room}`}.png`,
      );
    } finally {
      exportButton.textContent = original;
      exportButton.disabled = false;
    }
  });
}
