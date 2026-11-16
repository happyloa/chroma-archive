/**
 * 切換配色時的圓形揭露，移植自作者作品集網站（personal-portfolio 的 utils/themeReveal.ts）。
 *
 * 做法：把舊配色的頁面複製成一層疊在最上面（放在 Shadow DOM 裡，避免重複 id 與樣式互相影響），
 * 再用 CSS mask 從按鈕位置挖出越來越大的圓，讓底下已經換好配色的真實頁面露出來。
 * 疊層不接收事件，所以動畫進行中頁面仍可操作。
 *
 * 這個網站多了 WebGL canvas：複製出來的 canvas 是空白的，所以先把目前畫面存成圖片放進疊層。
 */
export interface ThemeReveal {
  start(origin: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, canvasSnapshot?: string): void;
  cancel(): void;
}

export function createThemeReveal(): ThemeReveal {
  const layers = new Map<HTMLElement, { viewport: HTMLElement; animation: Animation }>();
  let container: HTMLElement | undefined;
  let stylesheet: CSSStyleSheet | undefined;

  const syncScroll = () => {
    for (const { viewport } of layers.values()) viewport.scrollTo(window.scrollX, window.scrollY);
  };
  const reset = () => {
    container?.remove();
    container = undefined;
    stylesheet = undefined;
    window.removeEventListener('scroll', syncScroll);
  };
  const remove = (layer: HTMLElement) => {
    layers.delete(layer);
    layer.remove();
    if (!layers.size) reset();
  };
  const cancel = () => {
    for (const [layer, { animation }] of layers) {
      animation.cancel();
      remove(layer);
    }
    reset();
  };

  return {
    cancel,
    start(origin, canvasSnapshot) {
      // 不支援動畫 mask 的瀏覽器直接切換
      if (
        typeof CSSStyleSheet === 'undefined' ||
        typeof CSSStyleSheet.prototype.replaceSync !== 'function' ||
        typeof CSS.registerProperty !== 'function' ||
        typeof Element.prototype.animate !== 'function' ||
        !CSS.supports('mask-image', 'radial-gradient(transparent, #000)')
      ) {
        return;
      }

      let layer: HTMLElement | undefined;
      try {
        if (!stylesheet) {
          // 同步建立的樣式表，複製出來的畫面不會閃出無樣式的瞬間
          stylesheet = new CSSStyleSheet();
          stylesheet.replaceSync(
            Array.from(document.styleSheets, (sheet) => {
              try {
                return Array.from(sheet.cssRules, (rule) => rule.cssText)
                  .join('\n')
                  .replace(
                    /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/g,
                    (match, double?: string, single?: string, bare?: string) => {
                      const url = (double ?? single ?? bare ?? '').trim();
                      if (url.startsWith('#') || url.startsWith('data:')) return match;
                      return `url("${new URL(url, sheet.href ?? document.baseURI).href}")`;
                    },
                  );
              } catch {
                return '';
              }
            }).join('\n'),
          );
        }

        const root = document.documentElement;
        const body = document.body.cloneNode(false) as HTMLBodyElement;
        // 根元素上的 CSS 變數（含舊配色）抄到複製出來的 body，之後真實頁面換色也不受影響
        const computed = getComputedStyle(root);
        for (let i = 0; i < computed.length; i++) {
          const property = computed.item(i);
          if (property.startsWith('--')) {
            body.style.setProperty(property, computed.getPropertyValue(property));
          }
        }
        body.style.background = getComputedStyle(document.body).backgroundColor;
        body.style.color = getComputedStyle(document.body).color;
        body.style.colorScheme = computed.colorScheme;

        for (const child of document.body.children) {
          if (child === container || child.matches('script, style, link')) continue;
          body.append(child.cloneNode(true));
        }
        body.querySelectorAll('script, style, link, iframe, dialog').forEach((n) => n.remove());

        // WebGL canvas 換成目前畫面的快照
        const canvas = body.querySelector<HTMLCanvasElement>('#stage');
        if (canvas) {
          if (canvasSnapshot) {
            const img = document.createElement('img');
            img.src = canvasSnapshot;
            img.alt = '';
            img.className = canvas.className;
            img.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;';
            canvas.replaceWith(img);
          } else {
            canvas.remove();
          }
        }
        body.style.minHeight = `${root.scrollHeight}px`;

        layer = document.createElement('div');
        layer.className = 'theme-reveal-layer';
        const shadow = layer.attachShadow({ mode: 'closed' });
        shadow.adoptedStyleSheets = [stylesheet];
        const viewport = document.createElement('div');
        viewport.style.cssText = 'height:100%;overflow:hidden;scroll-behavior:auto';
        viewport.append(body);
        shadow.append(viewport);

        if (!container) {
          container = document.createElement('div');
          container.className = 'theme-reveal-overlays';
          container.inert = true;
          container.setAttribute('aria-hidden', 'true');
          document.body.append(container);
          window.addEventListener('scroll', syncScroll, { passive: true });
        }
        // 新的舊配色層放在較早的波紋底下，先前的動畫繼續跑
        container.prepend(layer);
        viewport.scrollTo(window.scrollX, window.scrollY);

        const x = origin.left + origin.width / 2;
        const y = origin.top + origin.height / 2;
        const radius =
          Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 2;
        layer.style.setProperty('--theme-x', `${x}px`);
        layer.style.setProperty('--theme-y', `${y}px`);
        layer.style.width = `${root.clientWidth}px`;
        const animation = layer.animate(
          { '--theme-reveal-radius': ['0px', `${radius}px`] },
          { duration: 800, easing: 'ease', fill: 'forwards' },
        );
        layers.set(layer, { viewport, animation });
        const finished = layer;
        void animation.finished.then(
          () => remove(finished),
          () => remove(finished),
        );
      } catch {
        // 任何失敗都不能擋住配色切換
        if (layer) remove(layer);
        cancel();
      }
    },
  };
}
