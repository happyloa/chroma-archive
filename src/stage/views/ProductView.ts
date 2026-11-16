import {
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderTarget,
  type MeshPhysicalMaterial,
  type WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LIGHT_LOOK, backgroundFor, getEnvironment, type LightPreset } from '../environment';
import {
  PRODUCTS,
  applyFinish,
  createFinishMaterial,
  type Finish,
  type ProductId,
} from '../products';
import type { ProductModel } from '../products/shared';
import type { StageContext, StageView } from '../types';

export interface ProductState {
  product: ProductId;
  finish: Finish;
  primary: string;
  accent: string;
  light: LightPreset;
}

const DEFAULT_STATE: ProductState = {
  product: 'chair',
  finish: 'matte',
  primary: '#A47864',
  accent: '#E8DCCB',
  light: 'studio',
};

/** 模型底下的柔和陰影，全站共用一張貼圖 */
let shadowTexture: CanvasTexture | null = null;
function getShadowTexture(): CanvasTexture {
  if (shadowTexture) return shadowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  shadowTexture = new CanvasTexture(canvas);
  return shadowTexture;
}

const shadowGeometry = new PlaneGeometry(1, 1);

/**
 * 3D 產品視窗（T048）。元素上的 data-* 決定初始狀態：
 * data-product、data-finish、data-primary、data-accent、data-light，
 * data-interactive 允許縮放，data-transparent 不畫背景（疊在頁面底色上）。
 */
export class ProductView implements StageView {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(28, 1, 0.05, 50);
  readonly el: HTMLElement;
  private readonly ctx: StageContext;
  private readonly controls: OrbitControls;
  private readonly turntable = new Group();
  private readonly primaryMat: MeshPhysicalMaterial;
  private readonly accentMat: MeshPhysicalMaterial;
  private readonly shadow: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly key = new DirectionalLight(0xffffff, 1.2);
  private readonly transparent: boolean;
  private model: ProductModel | null = null;
  private state: ProductState;
  private reducedMotion: boolean;
  private interacting = false;
  private idleSince = 0;
  private size = { w: 0, h: 0 };
  private exposure = 1;

  constructor(el: HTMLElement, ctx: StageContext) {
    this.el = el;
    this.ctx = ctx;
    this.reducedMotion = ctx.reducedMotion;
    this.transparent = 'transparent' in el.dataset;
    const d = el.dataset;
    this.state = {
      product: (d.product as ProductId) ?? DEFAULT_STATE.product,
      finish: (d.finish as Finish) ?? DEFAULT_STATE.finish,
      primary: d.primary ?? DEFAULT_STATE.primary,
      accent: d.accent ?? DEFAULT_STATE.accent,
      light: (d.light as LightPreset) ?? DEFAULT_STATE.light,
    };

    this.primaryMat = createFinishMaterial(this.state.finish, this.state.primary);
    this.accentMat = createFinishMaterial(accentFinish(this.state.finish), this.state.accent);

    this.shadow = new Mesh(
      shadowGeometry,
      new MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = -1;

    this.key.position.set(2.5, 4, 3);
    this.scene.add(this.turntable, this.shadow, this.key);

    this.controls = new OrbitControls(this.camera, el);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = 'interactive' in el.dataset;
    this.controls.minPolarAngle = Math.PI * 0.15;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.addEventListener('start', () => (this.interacting = true));
    this.controls.addEventListener('end', () => {
      this.interacting = false;
      this.idleSince = performance.now();
    });
    // 小卡片在觸控裝置上不攔截垂直滑動，讓頁面可以正常捲動
    if (!('interactive' in el.dataset) && window.matchMedia('(pointer: coarse)').matches) {
      this.controls.enabled = false;
    }

    this.setLight(this.state.light);
    this.setProduct(this.state.product);
    window.addEventListener('themechange', this.onThemeChange);
  }

  /** 網站切換深淺色時，背景跟著換 */
  private onThemeChange = (): void => {
    this.setLight(this.state.light);
  };

  getState(): ProductState {
    return { ...this.state };
  }

  set(next: Partial<ProductState>): void {
    if (next.product && next.product !== this.state.product) this.setProduct(next.product);
    if (next.light && next.light !== this.state.light) this.setLight(next.light);
    this.state = { ...this.state, ...next };
    applyFinish(this.primaryMat, this.state.finish, this.state.primary);
    applyFinish(this.accentMat, accentFinish(this.state.finish), this.state.accent);
  }

  private setProduct(id: ProductId): void {
    if (this.model) this.turntable.remove(this.model.root);
    const model = PRODUCTS[id](this.ctx.settings.detail);
    for (const m of model.primary) m.material = this.primaryMat;
    for (const m of model.accent) m.material = this.accentMat;
    this.model = model;
    this.state.product = id;

    // 依外框大小置中並取景
    const box = new Box3().setFromObject(model.root);
    const center = box.getCenter(new Vector3());
    model.root.position.x -= center.x;
    model.root.position.z -= center.z;
    model.root.position.y -= box.min.y;
    this.turntable.add(model.root);

    const size = box.getSize(new Vector3());
    const footprint = Math.max(size.x, size.z);
    this.shadow.scale.setScalar(footprint * 1.5);
    this.shadow.position.y = 0.002;

    const sphere = box.getBoundingSphere(new Sphere());
    const target = new Vector3(0, size.y * 0.45, 0);
    const distance = (sphere.radius / Math.sin((this.camera.fov * Math.PI) / 360)) * 1.08;
    const dir = new Vector3(0.62, 0.38, 1).normalize();
    this.camera.position.copy(target).addScaledVector(dir, distance);
    this.controls.target.copy(target);
    this.controls.minDistance = distance * 0.6;
    this.controls.maxDistance = distance * 1.6;
    this.controls.update();
  }

  private setLight(preset: LightPreset): void {
    const look = LIGHT_LOOK[preset];
    this.scene.environment = getEnvironment(this.ctx.renderer, preset);
    this.scene.environmentIntensity = look.envIntensity;
    this.scene.background = this.transparent ? null : new Color(backgroundFor(preset));
    this.key.intensity = preset === 'night' ? 0.3 : preset === 'daylight' ? 1 : 0.6;
    this.shadow.material.opacity = preset === 'night' ? 0.9 : 0.7;
    this.exposure = look.exposure;
    this.state.light = preset;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  beforeRender(renderer: WebGLRenderer): void {
    renderer.toneMappingExposure = this.exposure;
  }

  update(_time: number, delta: number): void {
    // 沒在拖曳、放手超過 2 秒後慢慢自轉；減少動態效果時不自轉
    if (!this.reducedMotion && !this.interacting && performance.now() - this.idleSince > 2000) {
      this.turntable.rotation.y += delta * 0.25;
    }
    this.controls.update(delta);
  }

  resize(width: number, height: number): void {
    if (width === this.size.w && height === this.size.h) return;
    this.size = { w: width, h: height };
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** 以離屏 render target 輸出正方形 PNG（FR-12），不受視窗大小影響 */
  async exportPNG(size: number, watermark: string): Promise<Blob> {
    const r = this.ctx.renderer;
    const linear = new WebGLRenderTarget(size, size, { type: HalfFloatType, samples: 4 });
    const output = new WebGLRenderTarget(size, size);
    const camera = this.camera.clone();
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    const pass = new OutputPass();

    const prevBackground = this.scene.background;
    if (!prevBackground) this.scene.background = new Color(backgroundFor(this.state.light));
    const prevTarget = r.getRenderTarget();
    const prevExposure = r.toneMappingExposure;
    r.toneMappingExposure = this.exposure;
    r.setScissorTest(false);

    r.setRenderTarget(linear);
    r.render(this.scene, camera);
    // OutputPass 套用 tone mapping 與 sRGB 轉換，結果和畫面上一致
    pass.renderToScreen = false;
    pass.render(r, output, linear, 0, false);
    const pixels = new Uint8Array(size * size * 4);
    r.readRenderTargetPixels(output, 0, 0, size, size, pixels);

    r.setRenderTarget(prevTarget);
    r.toneMappingExposure = prevExposure;
    this.scene.background = prevBackground;
    linear.dispose();
    output.dispose();
    pass.dispose();

    // WebGL 的像素由下往上排列，畫進 2D canvas 時上下翻轉
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const c2d = canvas.getContext('2d')!;
    const image = c2d.createImageData(size, size);
    const row = size * 4;
    for (let y = 0; y < size; y++) {
      image.data.set(pixels.subarray((size - 1 - y) * row, (size - y) * row), y * row);
    }
    c2d.putImageData(image, 0, 0);

    const night = this.state.light === 'night';
    c2d.font = `500 ${Math.round(size / 64)}px "Inter Variable", system-ui, sans-serif`;
    c2d.textAlign = 'right';
    c2d.fillStyle = night ? 'rgba(244,242,238,0.75)' : 'rgba(14,14,14,0.65)';
    c2d.fillText(watermark, size - size / 32, size - size / 32);

    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('無法產生圖片'))), 'image/png'),
    );
  }

  dispose(): void {
    window.removeEventListener('themechange', this.onThemeChange);
    this.controls.dispose();
    this.primaryMat.dispose();
    this.accentMat.dispose();
    this.shadow.material.dispose();
    // 幾何與固定材質是共用快取，不在這裡釋放
  }
}

/** 輔色零件的表面：金屬與半透明只用在主體，輔色改成緞面，避免整件產品都反光或透明 */
function accentFinish(finish: Finish): Finish {
  return finish === 'metallic' || finish === 'translucent' ? 'satin' : finish;
}

export function createProductView(el: HTMLElement, ctx: StageContext): ProductView {
  return new ProductView(el, ctx);
}
