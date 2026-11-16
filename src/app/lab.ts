import { ct } from '../i18n/client';
import type { ViewReadyDetail } from '../stage/types';
import type { PhotoProgress } from '../stage/views/PhotoRenderer';
import type {
  PickDetail,
  ProductChangedDetail,
  ProductState,
  ProductView,
} from '../stage/views/ProductView';

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
    quality: checked(form, 'q') ? 'photo' : 'realtime',
  };
}

/** 網址參數套用到表單；不認得的值直接忽略，保留預設 */
function applyParams(form: HTMLFormElement): void {
  const params = new URLSearchParams(location.search);
  for (const name of PARAMS) {
    const value = params.get(name);
    if (!value || (name === 'p' && value === 'custom')) continue;
    const input = [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].find(
      (i) => i.value.toLowerCase() === value.toLowerCase(),
    );
    if (input) input.checked = true;
    else if (name === 'c2' && /^#[0-9a-f]{6}$/i.test(value))
      addAccentChoice(form, value.toUpperCase());
  }
  const photo = form.querySelector<HTMLInputElement>('input[name="q"]');
  if (photo && params.get('q') === 'photo') photo.checked = true;
  const spin = form.querySelector<HTMLInputElement>('input[name="spin"]');
  if (spin) {
    if (params.get('spin') === '0') spin.checked = false;
    // 減少動態效果時預設不自轉
    else if (!params.has('spin') && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      spin.checked = false;
    }
  }
}

/** 從年度頁設計發想帶來的輔色不在預設選項裡時，補一個選項 */
function addAccentChoice(form: HTMLFormElement, hex: string): void {
  const list = form.querySelector('fieldset[data-slot="accent"] .flex');
  const template = list?.querySelector('label');
  if (!list || !template) return;
  const label = template.cloneNode(true) as HTMLLabelElement;
  label.style.background = hex;
  label.title = hex;
  const input = label.querySelector('input')!;
  input.value = hex;
  input.checked = true;
  const text = label.querySelector('.sr-only:not(input)');
  if (text) text.textContent = hex;
  list.prepend(label);
}

function writeParams(form: HTMLFormElement): void {
  const params = new URLSearchParams();
  for (const name of PARAMS) {
    const v = checked(form, name)?.value;
    // 上傳的模型沒有存在任何地方，分享網址時不帶 p=custom
    if (v && !(name === 'p' && v === 'custom')) params.set(name, v);
  }
  if (!checked(form, 'spin')) params.set('spin', '0');
  if (checked(form, 'q')) params.set('q', 'photo');
  // 保留 Astro router 放在 history.state 的資料
  history.replaceState(history.state, '', `${location.pathname}?${params}`);
  syncLangSwitch();
}

/** 切換語言時保留目前的實驗室設定 */
function syncLangSwitch(): void {
  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-lang-switch]')) {
    const url = new URL(a.href);
    url.search = location.search;
    a.href = url.toString();
  }
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
  if (announcer) announcer.textContent = ct(slot === 'primary' ? 'pickedPrimary' : 'pickedAccent');
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
  syncLangSwitch();

  viewport.addEventListener('stage:view-ready', (event) => {
    view = (event as CustomEvent<ViewReadyDetail>).detail.view as ProductView;
    // 沒有 GPU 加速（軟體算繪）時跑不動路徑追蹤，停用開關並說明
    const photo = form.querySelector<HTMLInputElement>('input[name="q"]');
    if (photo && !view.supportsPhoto) {
      photo.checked = false;
      photo.disabled = true;
      photo.closest('label')?.classList.add('opacity-40', 'cursor-not-allowed');
      const note = document.getElementById('lab-photo-note');
      if (note) note.textContent = ct('photoUnsupported');
    }
    // 網址帶進來的設定直接套用，不播進場動畫
    view.set(readState(form), false);
    exportButton.disabled = false;
  });

  // 沒有輔色零件的產品（公開模型多半只有一種可換色材質）停用輔色欄位
  viewport.addEventListener('product:changed', (event) => {
    const { hasAccent } = (event as CustomEvent<ProductChangedDetail>).detail;
    const fieldset = form.querySelector<HTMLFieldSetElement>('fieldset[data-slot="accent"]');
    if (!fieldset) return;
    fieldset.disabled = !hasAccent;
    fieldset.classList.toggle('opacity-50', !hasAccent);
    const note = fieldset.querySelector<HTMLElement>('[data-accent-note]');
    if (note) note.hidden = hasAccent;
  });

  // 相片級渲染的進度
  const photoStatus = document.getElementById('lab-photo-status');
  viewport.addEventListener('photo:progress', (event) => {
    if (!photoStatus) return;
    const { samples, building, compiling, compileSeconds } = (event as CustomEvent<PhotoProgress>)
      .detail;
    const on = !!checked(form, 'q');
    photoStatus.hidden = !on;
    photoStatus.classList.toggle('hidden', !on);
    if (!on) return;
    const text = building
      ? ct('photoBuilding')
      : compiling
        ? ct('photoCompiling', { seconds: compileSeconds ?? 0 })
        : ct('photoSamples', { samples });
    if (photoStatus.textContent !== text) photoStatus.textContent = text;
  });

  viewport.addEventListener('product:pick', (event) => {
    focusSlot(form, (event as CustomEvent<PickDetail>).detail.slot);
  });

  form.addEventListener('change', (event) => {
    // 上傳欄位另外處理
    if ((event.target as HTMLInputElement | null)?.type === 'file') return;
    view?.set(readState(form));
    writeParams(form);
  });

  // 上傳自己的模型：只在瀏覽器裡解析，不送出到任何地方
  const upload = document.getElementById('lab-upload');
  const status = document.getElementById('lab-upload-status');
  const customOption = document.getElementById('lab-custom-option');
  upload?.addEventListener('change', async () => {
    const file = (upload as HTMLInputElement).files?.[0];
    (upload as HTMLInputElement).value = '';
    if (!file || !view || !status || !customOption) {
      if (status && !view) status.textContent = ct('viewNotReady');
      return;
    }
    status.textContent = ct('reading', { name: file.name });
    try {
      const { parseModelFile } = await import('../stage/upload');
      const root = await parseModelFile(file);
      view.setCustomModel(root);
      customOption.hidden = false;
      const name = customOption.querySelector('[data-custom-name]');
      if (name) name.textContent = ct('myModel', { name: file.name });
      const radio = customOption.querySelector<HTMLInputElement>('input');
      if (radio) radio.checked = true;
      writeParams(form);
      status.textContent = ct('loaded', { name: file.name });
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : ct('readFailed');
    }
  });

  exportButton.addEventListener('click', async () => {
    if (!view) return;
    const c1 = checked(form, 'c1');
    const label = c1?.dataset.label ?? '';
    exportButton.disabled = true;
    const original = exportButton.textContent;
    exportButton.textContent = ct('exporting');
    try {
      const blob = await view.exportPNG(2048, `${label} · chroma-archive`, (ratio) => {
        exportButton.textContent = ct('rendering', { percent: Math.round(ratio * 100) });
      });
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
