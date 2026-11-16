/**
 * 複製按鈕（FR-10）：用事件委派掛在 document 上，換頁後不必重新綁定。
 * 按鈕由 CopyButton.astro 產生，帶 data-copy 與 data-copy-label。
 */
const RESET_MS = 1600;

function announce(message: string): void {
  const el = document.getElementById('announcer');
  if (!el) return;
  // 先清空再寫入，連續複製同一個值時螢幕閱讀器也會再念一次
  el.textContent = '';
  requestAnimationFrame(() => (el.textContent = message));
}

async function copy(button: HTMLButtonElement): Promise<void> {
  const value = button.dataset.copy ?? '';
  const label = button.dataset.copyLabel ?? value;
  const text = button.querySelector<HTMLElement>('[data-copy-text]');
  try {
    await navigator.clipboard.writeText(value);
    button.dataset.copied = '';
    if (text) text.textContent = '已複製';
    announce(`已複製 ${label}`);
  } catch {
    announce('無法存取剪貼簿，請手動選取文字複製');
    return;
  }
  window.setTimeout(() => {
    delete button.dataset.copied;
    if (text) text.textContent = '複製';
  }, RESET_MS);
}

export function initCopy(): void {
  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      'button[data-copy]',
    );
    if (button) void copy(button);
  });
}
