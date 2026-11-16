/**
 * 換頁轉場（T035、T044、US-07）：
 * - 目的頁的年度色從點擊位置以液態邊緣擴散蓋滿畫面，再退開露出新頁，約 1 秒（樣式在 global.css）
 * - 色票卡片：典藏頁與年度頁的色票用同一個 transition:name，瀏覽器自動做共享元素轉場
 * - 3D 時間軸的色卡：點擊時在色塊位置放一塊同色方塊，和年度頁主視覺配成一組，放大成主視覺
 * 有共享元素的換頁（點色票卡、3D 色卡）不播墨水，新舊頁面平滑交叉淡化，讓色票卡飛到新位置。
 * 減少動態效果，或瀏覽器的上一頁、下一頁時，改為 200 毫秒淡入淡出。
 */
/*
 * 整頁的動畫寫在 global.css 的 ::view-transition-old(root)、new(root)。<html> 不能用 Astro 的
 * transition:animate：它會給 <html> 每頁不同的 view-transition 名稱，新舊頁面變成兩個無關的群組，
 * 新頁面的群組疊在最上面，蓋住墨水與飛行中的色票卡，針對 root 的樣式也全部失效。
 */

let origin = { x: '50%', y: '50%' };
/**
 * 這次換頁的轉場（<html data-vt>）：
 * - ink：一般連結，墨水擴散（預設，不設屬性）
 * - morph：點了有共享元素的色票卡或 3D 色卡
 * - traverse：瀏覽器的上一頁、下一頁
 */
let mode: 'ink' | 'morph' | 'traverse' = 'ink';
/** 下一次換頁要讓主視覺接手的轉場名稱與目的地（見 morphIntoHero） */
let pendingHero: { name: string; path: string } | null = null;

/**
 * 3D 色卡換頁前呼叫：在畫面上 rect 的位置放一塊顏色方塊，換頁時放大成新頁的主視覺。
 * 方塊在舊頁面裡，換頁後會跟著舊頁面一起被換掉。
 */
export function morphIntoHero(rect: DOMRect, colors: string[], name: string, href: string): void {
  const block = document.createElement('div');
  const stops = colors
    .map((c, i) => `${c} ${(i / colors.length) * 100}% ${((i + 1) / colors.length) * 100}%`)
    .join(', ');
  Object.assign(block.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    background: `linear-gradient(90deg, ${stops})`,
    pointerEvents: 'none',
    zIndex: '70',
    viewTransitionName: name,
  });
  block.setAttribute('aria-hidden', 'true');
  document.body.append(block);
  pendingHero = { name, path: new URL(href, location.href).pathname };
  // 換頁沒有發生（例如被取消）時移除
  setTimeout(() => block.remove(), 4000);
}

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
    const root = document.documentElement;
    root.style.setProperty('--vt-x', origin.x);
    root.style.setProperty('--vt-y', origin.y);
    if (mode === 'ink') delete root.dataset.vt;
    else root.dataset.vt = mode;
  };
  document.addEventListener('astro:before-preparation', (event) => {
    const link = event.sourceElement?.closest('a');
    mode =
      event.navigationType === 'traverse'
        ? 'traverse'
        : pendingHero || link?.hasAttribute('data-astro-transition-scope')
          ? 'morph'
          : 'ink';
    apply();
  });
  document.addEventListener('astro:after-swap', apply);

  // 新頁面的主視覺只在這一次換頁接手色卡方塊，轉場結束就拿掉名稱，避免之後換頁時單獨成組
  document.addEventListener('astro:before-swap', (event) => {
    const pending = pendingHero;
    pendingHero = null;
    if (!pending || event.to.pathname !== pending.path) return;
    const hero = event.newDocument.querySelector<HTMLElement>('[data-view="hero"]');
    const name = pending.name;
    if (!hero) return;
    hero.style.viewTransitionName = name;
    void event.viewTransition.finished.finally(() => {
      if (hero.style.viewTransitionName === name) hero.style.viewTransitionName = '';
    });
  });
}
