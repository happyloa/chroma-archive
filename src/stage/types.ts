import type { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { Tier, TierSettings } from './quality';

export interface StageContext {
  renderer: WebGLRenderer;
  tier: Tier;
  settings: TierSettings;
  reducedMotion: boolean;
}

/**
 * 畫在某個 DOM 元素位置上的 3D 視窗。Stage 用 scissor 把它畫進共用的全螢幕 canvas，
 * 所以元素本身要是透明的；互動事件（拖曳旋轉）直接掛在元素上。
 */
export interface StageView {
  readonly el: HTMLElement;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  update(time: number, delta: number): void;
  /** 每次 render 前呼叫，用來設定 tone mapping 曝光這類 renderer 層級的參數 */
  beforeRender?(renderer: WebGLRenderer): void;
  /**
   * 視窗背景色；null 表示透明。由 Stage 在視窗範圍內清除，不用 scene.background，
   * 因為 three.js 算陰影時會關閉 scissor，scene.background 會蓋滿整個 canvas。
   */
  readonly clearColor: Color | null;
  resize(width: number, height: number): void;
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
}

export type ViewFactory = (el: HTMLElement, ctx: StageContext) => StageView | Promise<StageView>;

/** 元素上的 data-view 值 */
export type ViewKind = 'product';

export interface ViewReadyDetail {
  view: StageView;
}
