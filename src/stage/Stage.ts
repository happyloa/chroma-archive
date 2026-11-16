import {
  NeutralToneMapping,
  NoToneMapping,
  SRGBColorSpace,
  VSMShadowMap,
  WebGLRenderer,
} from 'three';
import { onTick } from '../app/ticker';
import { FpsGuard, TIERS, detectTier, lowerTier, type Tier } from './quality';
import type { StageContext, StageView, ViewFactory, ViewKind, ViewReadyDetail } from './types';

/** data-view 對應的工廠，延遲載入（plan.md 2.1） */
const REGISTRY: Record<ViewKind, () => Promise<ViewFactory>> = {
  product: () => import('./views/ProductView').then((m) => m.createProductView),
  hero: () => import('./views/HeroView').then((m) => m.createHeroView),
  timeline: () => import('./views/TimelineView').then((m) => m.createTimelineView),
  space: () => import('./views/SpaceView').then((m) => m.createSpaceView),
};

/**
 * 全站共用的 WebGL 舞台（T033）。canvas 透過 transition:persist 跨頁保留，
 * renderer 只建立一次；每頁的 3D 視窗在 mount 時建立、unmount 時釋放。
 */
export class Stage {
  static instances = 0;
  private static current: Stage | null = null;

  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;
  private tier: Tier;
  private readonly views = new Map<HTMLElement, StageView>();
  private readonly visible = new Set<HTMLElement>();
  private readonly seen = new WeakSet<HTMLElement>();
  private observer: IntersectionObserver | null = null;
  /** 還沒建立的視窗，捲近時才建立 */
  private lazy: IntersectionObserver | null = null;
  private running = true;
  private reducedMotion = false;
  private mountToken = 0;
  private readonly fps = new FpsGuard(() => this.downgrade());
  /** canvas 尺寸變化時更新 renderer，節流 100 毫秒（spec.md 第 8 節） */
  private resizeTimer = 0;
  private readonly resizeObserver = new ResizeObserver(() => {
    if (this.resizeTimer) return;
    this.resizeTimer = window.setTimeout(() => {
      this.resizeTimer = 0;
      this.resize();
    }, 100);
  });
  frames = 0;

  static get(canvas: HTMLCanvasElement): Stage {
    if (Stage.current && Stage.current.canvas === canvas) return Stage.current;
    // canvas 被換掉代表 persist 失效；釋放舊的 renderer，避免洩漏
    Stage.current?.dispose();
    Stage.current = new Stage(canvas);
    return Stage.current;
  }

  private constructor(canvas: HTMLCanvasElement) {
    Stage.instances += 1;
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    // shader 錯誤檢查會同步等編譯結果，只在開發時開啟
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    // Khronos PBR Neutral：盡量保留產品的原色，色票顏色才不會被洗淡
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    // 每個視窗的背景由下面的 render 自己清除（見 StageView.clearColor）
    this.renderer.autoClear = false;
    // 柔和陰影
    this.renderer.shadowMap.type = VSMShadowMap;
    this.tier = detectTier(this.renderer);
    this.applyTier();

    this.resize();
    this.resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', this.onVisibility);
    onTick(this.render);
  }

  get context(): StageContext {
    return {
      renderer: this.renderer,
      tier: this.tier,
      settings: TIERS[this.tier],
      reducedMotion: this.reducedMotion,
    };
  }

  get viewCount(): number {
    return this.views.size;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    for (const v of this.views.values()) v.setReducedMotion(reduced);
  }

  /** 換頁後呼叫：為頁面上每個 [data-view] 建立 3D 視窗 */
  async mount(root: ParentNode): Promise<void> {
    const token = ++this.mountToken;
    const els = [...root.querySelectorAll<HTMLElement>('[data-view]')];
    if (!els.length) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) {
            this.visible.add(el);
            if (!this.seen.has(el)) {
              this.seen.add(el);
              this.views.get(el)?.onFirstVisible?.();
            }
          } else this.visible.delete(el);
        }
      },
      { rootMargin: '10% 0px' },
    );

    // 離畫面一個視窗高度以內才建立；更遠的（例如年度頁下方的設計發想）捲近時才建立，進站時不必一次付出成本
    this.lazy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          this.lazy?.unobserve(e.target);
          void this.create(e.target as HTMLElement, token);
        }
      },
      { rootMargin: '100% 0px' },
    );
    // 只在完整動態效果時建立的視窗（主視覺、設計發想、時間軸、色彩空間），減少動態效果時保留靜態替代內容；
    // 沒有 GPU 加速的裝置（<html data-lite>，進站時判定）也一樣
    const lite = document.documentElement.dataset.lite === 'on';
    for (const el of els) {
      if ((this.reducedMotion || lite) && el.hasAttribute('data-motion-only')) continue;
      if (!REGISTRY[el.dataset.view as ViewKind]) continue;
      this.lazy.observe(el);
    }
  }

  private async create(el: HTMLElement, token: number): Promise<void> {
    const factory = await REGISTRY[el.dataset.view as ViewKind]();
    // 載入期間使用者已經換頁，就不再建立
    if (token !== this.mountToken) return;
    const view = await factory(el, this.context);
    // 先平行編譯 shader 再開始繪製，第一格才不會同步等編譯（行動裝置上會卡住主執行緒）
    await this.renderer.compileAsync(view.scene, view.camera).catch(() => undefined);
    if (token !== this.mountToken) {
      view.dispose();
      return;
    }
    this.views.set(el, view);
    this.observer?.observe(el);
    el.dataset.stageReady = '';
    el.dispatchEvent(
      new CustomEvent<ViewReadyDetail>('stage:view-ready', { detail: { view }, bubbles: true }),
    );
  }

  /** 換頁前呼叫：釋放這一頁的 3D 視窗 */
  unmount(): void {
    this.mountToken += 1;
    this.observer?.disconnect();
    this.observer = null;
    this.lazy?.disconnect();
    this.lazy = null;
    for (const [el, view] of this.views) {
      view.dispose();
      // 元素可能還在頁面上（例如中途切換動態偏好時重建），拿掉就緒標記，靜態替代內容才會回來
      delete el.dataset.stageReady;
      el.removeAttribute('aria-busy');
    }
    this.views.clear();
    this.visible.clear();
    this.renderer.clear();
  }

  private applyTier(): void {
    const settings = TIERS[this.tier];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.maxDpr));
    this.renderer.shadowMap.enabled = settings.shadows;
    this.canvas.dataset.tier = this.tier;
  }

  private downgrade(): void {
    const next = lowerTier(this.tier);
    if (next === this.tier) return;
    this.tier = next;
    this.applyTier();
    this.resize();
  }

  private resize = (): void => {
    const { innerWidth: w, innerHeight: h } = window;
    this.renderer.setSize(w, h, false);
  };

  private onVisibility = (): void => {
    this.running = document.visibilityState === 'visible';
    this.fps.reset();
  };

  private render = (time: number, delta: number): void => {
    if (!this.running) return;
    const r = this.renderer;
    const h = window.innerHeight;

    r.setScissorTest(false);
    r.setClearColor(0x000000, 0);
    r.clear();

    if (this.visible.size) {
      r.setScissorTest(true);
      for (const el of this.visible) {
        const view = this.views.get(el);
        if (!view) continue;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > h || rect.width === 0 || rect.height === 0) continue;
        view.resize(rect.width, rect.height);
        view.update(time, delta);
        const y = h - rect.bottom;
        r.setViewport(rect.left, y, rect.width, rect.height);
        r.setScissor(rect.left, y, rect.width, rect.height);
        r.setScissorTest(true);
        if (view.clearColor) {
          r.setClearColor(view.clearColor, 1);
          r.clear();
        } else {
          r.clearDepth();
        }
        view.beforeRender?.(r);
        r.render(view.scene, view.camera);
      }
      r.setScissorTest(false);
      this.fps.sample(delta);
    }
    this.frames += 1;
  };

  private dispose(): void {
    this.unmount();
    this.resizeObserver.disconnect();
    window.clearTimeout(this.resizeTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.dispose();
  }
}
