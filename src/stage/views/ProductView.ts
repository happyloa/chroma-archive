import { gsap } from 'gsap';
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
  PointLight,
  Raycaster,
  Scene,
  Sphere,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type MeshPhysicalMaterial,
  type Object3D,
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
import { REAL_HEIGHT, createRoom, setRoomLight, type Room, type RoomId } from '../rooms';
import type { StageContext, StageView } from '../types';

export type CameraPreset = 'hero' | 'front' | 'side' | 'top' | 'detail';
export type PartSlot = 'primary' | 'accent';

export interface ProductState {
  product: ProductId;
  finish: Finish;
  primary: string;
  accent: string;
  light: LightPreset;
  room: RoomId;
  camera: CameraPreset;
  spin: boolean;
}

export interface PickDetail {
  slot: PartSlot;
}

const DEFAULT_STATE: ProductState = {
  product: 'chair',
  finish: 'matte',
  primary: '#A47864',
  accent: '#E8DCCB',
  light: 'studio',
  room: 'studio',
  camera: 'hero',
  spin: true,
};

/** 各鏡頭預設的方向與距離倍率 */
const CAMERA_PRESETS: Record<CameraPreset, { dir: Vector3; distance: number; lift: number }> = {
  hero: { dir: new Vector3(0.62, 0.38, 1), distance: 1, lift: 0.45 },
  front: { dir: new Vector3(0, 0.12, 1), distance: 1, lift: 0.5 },
  side: { dir: new Vector3(1, 0.12, 0.02), distance: 1, lift: 0.5 },
  top: { dir: new Vector3(0.05, 1, 0.3), distance: 1.05, lift: 0.3 },
  detail: { dir: new Vector3(0.7, 0.3, 1), distance: 0.55, lift: 0.65 },
};

/** 會隨狀態漸變的材質參數 */
const TWEEN_PROPS = ['roughness', 'metalness', 'clearcoat', 'sheen', 'transmission'] as const;

/** 模型底下的柔和陰影（攝影棚用），全站共用一張貼圖 */
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
 * 3D 產品視窗（T048、T054、T055）。元素上的 data-* 決定初始狀態：
 * data-product、data-finish、data-primary、data-accent、data-light、data-room，
 * data-interactive 允許縮放與點選零件，data-transparent 不畫背景（疊在頁面底色上）。
 */
export class ProductView implements StageView {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(28, 1, 0.02, 60);
  readonly el: HTMLElement;
  private readonly ctx: StageContext;
  private readonly controls: OrbitControls;
  /** 擺放位置（場景中的座標與縮放） */
  private readonly placement = new Group();
  /** 自轉用 */
  private readonly turntable = new Group();
  private readonly primaryMat: MeshPhysicalMaterial;
  private readonly accentMat: MeshPhysicalMaterial;
  private readonly shadow: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly key = new DirectionalLight(0xffffff, 1.2);
  private readonly bulbLight = new PointLight(0xffd9a0, 0, 3, 2);
  private readonly transparent: boolean;
  private readonly interactive: boolean;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  clearColor: Color | null = null;
  private model: ProductModel | null = null;
  private room: Room | null = null;
  private state: ProductState;
  private reducedMotion: boolean;
  private interacting = false;
  private idleSince = 0;
  private size = { w: 0, h: 0 };
  private exposure = 1;
  private hovered: PartSlot | null = null;
  private downAt: { x: number; y: number } | null = null;
  /** 模型原始外框（未縮放、底部在 y = 0） */
  private modelBox = new Box3();

  constructor(el: HTMLElement, ctx: StageContext) {
    this.el = el;
    this.ctx = ctx;
    this.reducedMotion = ctx.reducedMotion;
    this.transparent = 'transparent' in el.dataset;
    this.interactive = 'interactive' in el.dataset;
    const d = el.dataset;
    this.state = {
      product: (d.product as ProductId) ?? DEFAULT_STATE.product,
      finish: (d.finish as Finish) ?? DEFAULT_STATE.finish,
      primary: d.primary ?? DEFAULT_STATE.primary,
      accent: d.accent ?? DEFAULT_STATE.accent,
      light: (d.light as LightPreset) ?? DEFAULT_STATE.light,
      room: (d.room as RoomId) ?? DEFAULT_STATE.room,
      camera: DEFAULT_STATE.camera,
      spin: !ctx.reducedMotion,
    };

    this.primaryMat = createFinishMaterial(this.state.finish, this.state.primary);
    this.accentMat = createFinishMaterial(accentFinish(this.state.finish), this.state.accent);

    this.shadow = new Mesh(
      shadowGeometry,
      new MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.002;
    this.shadow.renderOrder = -1;

    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.0005;
    this.key.shadow.normalBias = 0.02;
    this.placement.add(this.turntable, this.shadow);
    this.scene.add(this.placement, this.key, this.key.target);

    this.controls = new OrbitControls(this.camera, el);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = this.interactive;
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.addEventListener('start', () => {
      this.interacting = true;
      gsap.killTweensOf(this.camera.position);
      gsap.killTweensOf(this.controls.target);
    });
    this.controls.addEventListener('end', () => {
      this.interacting = false;
      this.idleSince = performance.now();
    });
    // 小卡片在觸控裝置上不攔截垂直滑動，讓頁面可以正常捲動
    if (!this.interactive && window.matchMedia('(pointer: coarse)').matches) {
      this.controls.enabled = false;
    }

    if (this.interactive) {
      el.addEventListener('pointermove', this.onPointerMove);
      el.addEventListener('pointerleave', this.onPointerLeave);
      el.addEventListener('pointerdown', this.onPointerDown);
      el.addEventListener('pointerup', this.onPointerUp);
    }

    this.setRoom(this.state.room);
    this.setLight(this.state.light);
    this.setProduct(this.state.product, false);
    this.frame(false);
    window.addEventListener('themechange', this.onThemeChange);
  }

  getState(): ProductState {
    return { ...this.state };
  }

  /** 更新狀態；animate 為 false 或減少動態效果時直接套用 */
  set(next: Partial<ProductState>, animate = true): void {
    const motion = animate && !this.reducedMotion;
    const prev = this.state;
    this.state = { ...prev, ...next };
    let reframe = false;

    if (next.room && next.room !== prev.room) {
      this.setRoom(next.room);
      reframe = true;
    }
    if (next.light && next.light !== prev.light) this.setLight(next.light);
    if (next.product && next.product !== prev.product) {
      this.setProduct(next.product, motion);
      reframe = true;
    } else if (reframe) {
      this.placeModel();
    }
    if (next.camera && next.camera !== prev.camera) reframe = true;
    if (reframe) this.frame(motion);

    if (next.finish !== undefined || next.primary !== undefined || next.accent !== undefined) {
      this.applyMaterial(this.primaryMat, this.state.finish, this.state.primary, motion);
      this.applyMaterial(
        this.accentMat,
        accentFinish(this.state.finish),
        this.state.accent,
        motion,
      );
    }
  }

  /** 換色與換表面時漸變顏色與粗糙度等參數 */
  private applyMaterial(mat: MeshPhysicalMaterial, finish: Finish, hex: string, animate: boolean) {
    if (!animate) {
      applyFinish(mat, finish, hex);
      return;
    }
    const fromColor = mat.color.clone();
    const from = pickProps(mat);
    applyFinish(mat, finish, hex);
    const toColor = mat.color.clone();
    const to = pickProps(mat);
    mat.color.copy(fromColor);
    for (const p of TWEEN_PROPS) mat[p] = from[p];
    gsap.killTweensOf(mat.color);
    gsap.killTweensOf(mat);
    gsap.to(mat.color, {
      r: toColor.r,
      g: toColor.g,
      b: toColor.b,
      duration: 0.4,
      ease: 'power2.out',
    });
    gsap.to(mat, { ...to, duration: 0.4, ease: 'power2.out' });
  }

  private setProduct(id: ProductId, animate: boolean): void {
    if (this.model) this.turntable.remove(this.model.root);
    this.bulbLight.removeFromParent();
    const model = PRODUCTS[id](this.ctx.settings.detail);
    for (const m of model.primary) m.material = this.primaryMat;
    for (const m of model.accent) m.material = this.accentMat;
    model.root.traverse((o) => {
      if (o instanceof Mesh) o.castShadow = o.receiveShadow = true;
    });

    // 置中、底部對齊 y = 0
    const box = new Box3().setFromObject(model.root);
    const center = box.getCenter(new Vector3());
    model.root.position.x -= center.x;
    model.root.position.z -= center.z;
    model.root.position.y -= box.min.y;
    this.modelBox = new Box3().setFromObject(model.root);
    this.turntable.add(model.root);
    this.model = model;
    this.state.product = id;

    // 桌燈附一盞真的點光源，夜間場景特別明顯
    if (id === 'lamp') {
      this.bulbLight.position.set(0, this.modelBox.max.y * 0.68, 0);
      model.root.add(this.bulbLight);
      this.updateBulb();
    }

    const size = this.modelBox.getSize(new Vector3());
    this.shadow.scale.setScalar(Math.max(size.x, size.z) * 1.5);
    this.placeModel();

    if (animate) {
      // 新模型由上方落下進場
      const h = size.y;
      gsap.fromTo(
        this.turntable.position,
        { y: h * 0.35 },
        { y: 0, duration: 0.8, ease: 'bounce.out' },
      );
      gsap.fromTo(
        this.turntable.scale,
        { x: 0.85, y: 0.85, z: 0.85 },
        { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(2)' },
      );
    }
  }

  /** 依目前場景決定擺放位置與縮放 */
  private placeModel(): void {
    const id = this.state.product;
    if (this.state.room === 'studio' || !this.room) {
      this.placement.position.set(0, 0, 0);
      this.placement.rotation.set(0, 0, 0);
      this.placement.scale.setScalar(1);
      this.shadow.visible = true;
      return;
    }
    const p = this.room.place(id);
    const nativeHeight = this.modelBox.max.y - this.modelBox.min.y;
    this.placement.position.copy(p.position);
    this.placement.rotation.set(0, p.rotationY, 0);
    this.placement.scale.setScalar(REAL_HEIGHT[id] / nativeHeight);
    // 場景裡用真的陰影
    this.shadow.visible = !this.ctx.settings.shadows;
  }

  private setRoom(id: RoomId): void {
    if (this.room) {
      this.scene.remove(this.room.group);
      this.room.dispose();
      this.room = null;
    }
    if (id !== 'studio') {
      this.room = createRoom(id);
      this.scene.add(this.room.group);
    }
    this.state.room = id;
    this.setLight(this.state.light);
  }

  private setLight(preset: LightPreset): void {
    const look = LIGHT_LOOK[preset];
    const inRoom = this.state.room !== 'studio';
    this.scene.environment = getEnvironment(this.ctx.renderer, preset);
    this.scene.environmentIntensity = look.envIntensity * (inRoom ? 0.8 : 1);
    this.clearColor = this.transparent ? null : new Color(backgroundFor(preset));
    this.exposure = look.exposure;
    this.state.light = preset;

    if (inRoom) {
      // 主光從左牆的窗戶照進來
      this.key.position.set(-2.4, 2.6, -0.2);
      this.key.intensity = preset === 'night' ? 0.15 : preset === 'daylight' ? 2.6 : 1.6;
      this.key.castShadow = this.ctx.settings.shadows;
      setRoomLight(preset);
    } else {
      this.key.position.set(2.5, 4, 3);
      this.key.intensity = preset === 'night' ? 0.3 : preset === 'daylight' ? 1 : 0.6;
      this.key.castShadow = false;
    }
    this.shadow.material.opacity = preset === 'night' ? 0.9 : 0.7;
    this.updateBulb();
  }

  private updateBulb(): void {
    this.bulbLight.intensity = this.state.light === 'night' ? 1.6 : 0.25;
  }

  /** 依鏡頭預設與場景取景，可平滑移動 */
  private frame(animate: boolean): void {
    const preset = CAMERA_PRESETS[this.state.camera];
    const scale = this.placement.scale.x;
    const size = this.modelBox.getSize(new Vector3()).multiplyScalar(scale);
    const sphere = this.modelBox.getBoundingSphere(new Sphere());
    const radius = sphere.radius * scale;
    const inRoom = this.state.room !== 'studio';

    const target = this.placement.position.clone().add(new Vector3(0, size.y * preset.lift, 0));
    const fit = radius / Math.sin((this.camera.fov * Math.PI) / 360);
    // 場景裡拉遠一點，讓家具入鏡
    const distance = fit * preset.distance * (inRoom ? 2.6 : 1.08);
    const position = target.clone().addScaledVector(preset.dir.clone().normalize(), distance);

    this.controls.minDistance = fit * 0.45;
    this.controls.maxDistance = fit * (inRoom ? 4 : 1.8);
    this.key.target.position.copy(this.placement.position);
    const cam = this.key.shadow.camera;
    const extent = Math.max(1, radius * 6);
    cam.left = cam.bottom = -extent;
    cam.right = cam.top = extent;
    cam.near = 0.1;
    cam.far = 10;
    cam.updateProjectionMatrix();

    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
    if (!animate) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }
    const ease = 'power3.inOut';
    gsap.to(this.camera.position, {
      x: position.x,
      y: position.y,
      z: position.z,
      duration: 1,
      ease,
    });
    gsap.to(this.controls.target, { x: target.x, y: target.y, z: target.z, duration: 1, ease });
  }

  // —— 點選零件 ——

  private hit(event: PointerEvent): PartSlot | null {
    if (!this.model) return null;
    const rect = this.el.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets: Object3D[] = [...this.model.primary, ...this.model.accent];
    const [first] = this.raycaster.intersectObjects(targets, false);
    if (!first) return null;
    return this.model.primary.includes(first.object as Mesh) ? 'primary' : 'accent';
  }

  private setHover(slot: PartSlot | null): void {
    if (slot === this.hovered) return;
    this.hovered = slot;
    for (const [s, mat] of [
      ['primary', this.primaryMat],
      ['accent', this.accentMat],
    ] as const) {
      gsap.to(mat.emissive, {
        r: s === slot ? 0.08 : 0,
        g: s === slot ? 0.08 : 0,
        b: s === slot ? 0.08 : 0,
        duration: 0.2,
      });
    }
    this.el.style.cursor = slot ? 'pointer' : '';
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (this.interacting) return;
    this.setHover(this.hit(event));
  };

  private onPointerLeave = (): void => this.setHover(null);

  private onPointerDown = (event: PointerEvent): void => {
    this.downAt = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.downAt) return;
    const moved = Math.hypot(event.clientX - this.downAt.x, event.clientY - this.downAt.y);
    this.downAt = null;
    // 拖曳旋轉不算點選
    if (moved > 5) return;
    const slot = this.hit(event);
    if (!slot) return;
    this.el.dispatchEvent(
      new CustomEvent<PickDetail>('product:pick', { detail: { slot }, bubbles: true }),
    );
  };

  /** 網站切換深淺色時，背景跟著換 */
  private onThemeChange = (): void => {
    this.setLight(this.state.light);
  };

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) this.state.spin = false;
  }

  beforeRender(renderer: WebGLRenderer): void {
    renderer.toneMappingExposure = this.exposure;
  }

  update(_time: number, delta: number): void {
    // 開啟自轉時，沒在拖曳、放手超過 2 秒後慢慢轉；減少動態效果時不轉
    if (
      this.state.spin &&
      !this.reducedMotion &&
      !this.interacting &&
      performance.now() - this.idleSince > 2000
    ) {
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

    // 匯出時沒有 Stage 幫忙清背景，改用 scene.background
    const prevBackground = this.scene.background;
    this.scene.background = this.clearColor ?? new Color(backgroundFor(this.state.light));
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

    const dark = this.state.light === 'night' || document.documentElement.dataset.theme === 'dark';
    c2d.font = `500 ${Math.round(size / 64)}px "Inter Variable", system-ui, sans-serif`;
    c2d.textAlign = 'right';
    c2d.fillStyle = dark ? 'rgba(244,242,238,0.75)' : 'rgba(14,14,14,0.65)';
    c2d.fillText(watermark, size - size / 32, size - size / 32);

    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('無法產生圖片'))), 'image/png'),
    );
  }

  dispose(): void {
    window.removeEventListener('themechange', this.onThemeChange);
    this.el.removeEventListener('pointermove', this.onPointerMove);
    this.el.removeEventListener('pointerleave', this.onPointerLeave);
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    this.el.removeEventListener('pointerup', this.onPointerUp);
    gsap.killTweensOf([
      this.camera.position,
      this.controls.target,
      this.turntable.position,
      this.turntable.scale,
      this.primaryMat,
      this.accentMat,
      this.primaryMat.color,
      this.accentMat.color,
      this.primaryMat.emissive,
      this.accentMat.emissive,
    ]);
    this.controls.dispose();
    this.room?.dispose();
    this.primaryMat.dispose();
    this.accentMat.dispose();
    this.shadow.material.dispose();
    this.key.shadow.map?.dispose();
    // 產品幾何與固定材質是共用快取，不在這裡釋放
  }
}

function pickProps(mat: MeshPhysicalMaterial): Record<(typeof TWEEN_PROPS)[number], number> {
  return {
    roughness: mat.roughness,
    metalness: mat.metalness,
    clearcoat: mat.clearcoat,
    sheen: mat.sheen,
    transmission: mat.transmission,
  };
}

/** 輔色零件的表面：金屬與半透明只用在主體，輔色改成緞面，避免整件產品都反光或透明 */
function accentFinish(finish: Finish): Finish {
  return finish === 'metallic' || finish === 'translucent' ? 'satin' : finish;
}

export function createProductView(el: HTMLElement, ctx: StageContext): ProductView {
  return new ProductView(el, ctx);
}
