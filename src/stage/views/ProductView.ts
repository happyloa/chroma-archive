import { gsap } from 'gsap';
import {
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  FrontSide,
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
  Texture,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type MeshPhysicalMaterial,
  type MeshStandardMaterial,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  HDRI_INTENSITY,
  LIGHT_LOOK,
  backgroundFor,
  getEnvironment,
  hdriFor,
  loadHDRI,
  peekHDRI,
  type LightPreset,
} from '../environment';
import { PhotoRenderer, type PhotoProgress } from './PhotoRenderer';
import {
  loadProduct,
  applyFinish,
  createFinishMaterial,
  type Finish,
  type ProductId,
} from '../products';
import type { LoadedProduct } from '../products';
import type { ProductModel } from '../products/shared';
import { REAL_HEIGHT, createRoom, setRoomLight, type Room, type RoomId } from '../rooms';
import type { StageContext, StageView } from '../types';
import { disposeGeometries, releaseOriginalMaterials } from '../upload';

export type Quality = 'realtime' | 'photo';
export type ProductChoice = ProductId | 'custom';
export type CameraPreset = 'hero' | 'front' | 'side' | 'top' | 'detail';
export type PartSlot = 'primary' | 'accent';

export interface ProductState {
  /** custom 是使用者上傳的模型 */
  product: ProductChoice;
  finish: Finish;
  primary: string;
  accent: string;
  light: LightPreset;
  room: RoomId;
  camera: CameraPreset;
  spin: boolean;
  /** 即時算繪或相片級渲染（路徑追蹤） */
  quality: Quality;
}

export interface ProductChangedDetail {
  product: ProductChoice;
  hasAccent: boolean;
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
  quality: 'realtime',
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
/** 這一格已經忙超過 8 毫秒就等下一格再繼續 */
let sliceStart = 0;
async function yieldIfBusy(): Promise<void> {
  const now = performance.now();
  if (sliceStart === 0) sliceStart = now;
  if (now - sliceStart < 8) return;
  await new Promise((r) => requestAnimationFrame(r));
  sliceStart = performance.now();
}

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
  private readonly photo: PhotoRenderer;
  /** 目前燈光對應的 HDRI 載入工作 */
  private hdriTask: Promise<void> = Promise.resolve();
  /** 目前產品模型的載入工作 */
  private productReady: Promise<void> = Promise.resolve();
  private model: ProductModel | null = null;
  /** 使用者上傳的模型，切到其他產品時保留，換新檔或視窗釋放時才釋放 */
  private custom: ProductModel | null = null;
  private productToken = 0;
  private disposed = false;
  /** data-reveal：捲到畫面時才進場，數字是第幾個（用來錯開時間） */
  private readonly revealIndex: number | null;
  private revealed = false;

  onFirstVisible(): void {
    if (this.revealIndex === null || this.revealed) return;
    this.revealed = true;
    if (this.reducedMotion) {
      this.turntable.scale.setScalar(1);
      return;
    }
    const delay = this.revealIndex * 0.15;
    gsap.fromTo(
      this.turntable.position,
      { y: 0.25 },
      { y: 0, duration: 1.1, delay, ease: 'bounce.out' },
    );
    gsap.fromTo(
      this.turntable.scale,
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1, duration: 0.8, delay, ease: 'back.out(1.6)' },
    );
  }

  /** 軟體算繪（低畫質檔位）跑不動路徑追蹤 */
  get supportsPhoto(): boolean {
    return this.ctx.tier !== 'low';
  }

  /** 目前的產品有沒有輔色零件 */
  hasAccent = true;
  private room: Room | null = null;
  private roomToken = 0;
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
    this.revealIndex = el.dataset.reveal !== undefined ? Number(el.dataset.reveal) : null;
    // 等到捲進畫面才進場
    if (this.revealIndex !== null && !ctx.reducedMotion) this.turntable.scale.setScalar(0);
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
      quality: 'realtime',
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

    // 柔和陰影（Stage 使用 VSM 陰影）
    const shadowSize = ctx.tier === 'high' ? 2048 : 1024;
    this.key.shadow.mapSize.set(shadowSize, shadowSize);
    this.key.shadow.radius = 8;
    this.key.shadow.blurSamples = 16;
    this.key.shadow.bias = -0.0005;
    this.key.shadow.normalBias = 0.02;
    this.placement.add(this.turntable, this.shadow);
    this.scene.add(this.placement, this.key, this.key.target);

    this.photo = new PhotoRenderer(ctx.renderer, this.scene, this.camera, (p) =>
      el.dispatchEvent(
        new CustomEvent<PhotoProgress>('photo:progress', { detail: p, bubbles: true }),
      ),
    );

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
    // 鏡頭一動，相片級渲染就重新累積
    this.controls.addEventListener('change', () => this.photo.updateCamera());
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
    this.productReady = this.setProduct(this.state.product, false);
  }

  getState(): ProductState {
    return { ...this.state };
  }

  /** 更新狀態；animate 為 false 或減少動態效果時直接套用 */
  set(next: Partial<ProductState>, animate = true): void {
    const prev = this.state;
    // 相片級渲染時不播過渡動畫：每個中間畫面都會讓路徑追蹤重新累積
    const photo = (next.quality ?? prev.quality) === 'photo';
    const motion = animate && !this.reducedMotion && !photo;
    this.state = { ...prev, ...next };
    let reframe = false;

    // 場景準備好才換上去並取景（見 setRoom）
    if (next.room && next.room !== prev.room) this.setRoom(next.room, motion);
    if (next.light && next.light !== prev.light) this.setLight(next.light);
    if (next.camera && next.camera !== prev.camera) reframe = true;
    if (next.product && next.product !== prev.product) {
      // 載入完成後才取景（見 setProduct）
      this.productReady = this.setProduct(next.product, motion);
    } else if (reframe) {
      this.placeModel();
      this.frame(motion);
    }

    if (next.finish !== undefined || next.primary !== undefined || next.accent !== undefined) {
      this.applyMaterial(this.primaryMat, this.state.finish, this.state.primary, motion);
      this.applyMaterial(
        this.accentMat,
        accentFinish(this.state.finish),
        this.state.accent,
        motion,
      );
      this.photo.updateMaterials();
    }

    if (next.quality === 'photo' && !this.supportsPhoto) this.state.quality = 'realtime';
    if (next.quality && this.state.quality !== prev.quality) {
      if (this.state.quality === 'photo') void this.rebuildPhoto();
      else this.photo.disable();
      this.placeModel();
    }
  }

  /** 開啟或重建相片級渲染：等 HDRI 與家具都載入後才建立場景 */
  private async rebuildPhoto(): Promise<void> {
    if (this.state.quality !== 'photo' || this.disposed) return;
    await Promise.all([this.hdriTask, this.room?.ready, this.productReady]);
    if (this.state.quality !== 'photo' || this.disposed) return;
    const studio = this.state.room === 'studio';
    const bg = new Color(backgroundFor(this.state.light));
    if (this.photo.enabled) await this.photo.rebuild(studio, bg);
    else await this.photo.enable(studio, bg);
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

  /** 載入產品模型（glTF 需要下載），完成後掛上並取景；載入期間舊模型繼續顯示 */
  private async setProduct(id: ProductChoice, animate: boolean): Promise<void> {
    if (id === 'custom' && !this.custom) id = 'chair';
    const token = ++this.productToken;
    const model: LoadedProduct =
      id === 'custom' ? this.custom! : await loadProduct(id, this.ctx.settings.detail);
    // 載入期間又換了產品，或視窗已經釋放
    if (token !== this.productToken || this.disposed) return;
    this.mountModel(model, id, animate);
    this.frame(animate);
    if (this.photo.enabled) void this.rebuildPhoto();
    this.el.dispatchEvent(
      new CustomEvent<ProductChangedDetail>('product:changed', {
        detail: { product: id, hasAccent: model.accent.length > 0 },
        bubbles: true,
      }),
    );
  }

  /**
   * glTF 模型的主色材質貼圖（灰階細節圖、法線、粗糙度）接到視窗自己的主色材質上；
   * 程式產生的模型沒有貼圖，全部清空。金屬度貼圖不接，讓「金屬」表面處理維持有效。
   */
  private bindPrimaryMaps(source?: MeshStandardMaterial): void {
    const m = this.primaryMat;
    m.map = source?.map ?? null;
    m.normalMap = source?.normalMap ?? null;
    if (source?.normalMap) m.normalScale.copy(source.normalScale);
    m.roughnessMap = source?.roughnessMap ?? null;
    // 沿用原模型的單雙面設定，有些模型（例如桌燈燈罩）只靠雙面材質才看得到外側
    m.side = source?.side ?? FrontSide;
    // AO 貼圖不接：公開模型的 AO 多半烘在整張貼圖上，乘上年度色後局部會過暗
    m.aoMap = null;
    m.needsUpdate = true;
  }

  private mountModel(model: LoadedProduct, id: ProductChoice, animate: boolean): void {
    if (this.model) this.turntable.remove(this.model.root);
    this.bulbLight.removeFromParent();
    this.bindPrimaryMaps(model.primarySource);
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
    this.hasAccent = model.accent.length > 0;

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
      // 相片級渲染有真實的落地陰影，不需要假陰影
      this.shadow.visible = this.state.quality !== 'photo';
      return;
    }
    // 上傳的模型尺寸未知，放在單椅的位置，高度當作 0.6 公尺
    const p = this.room.place(id === 'custom' ? 'chair' : id);
    const nativeHeight = this.modelBox.max.y - this.modelBox.min.y;
    this.placement.position.copy(p.position);
    this.placement.rotation.set(0, p.rotationY, 0);
    this.placement.scale.setScalar((id === 'custom' ? 0.6 : REAL_HEIGHT[id]) / nativeHeight);
    // 場景裡用真的陰影
    this.shadow.visible = !this.ctx.settings.shadows && this.state.quality !== 'photo';
  }

  /**
   * 換場景：新場景先在背景載入家具與貼圖、上傳貼圖、平行編譯 shader，準備好才換上去。
   * 直接加進畫面的話，第一次繪製會同步等 shader 編譯與貼圖上傳，鏡頭過渡會卡住半秒以上。
   * 準備期間舊場景照常顯示；連續切換時只採用最後一次。
   */
  private setRoom(id: RoomId, motion = false): void {
    const token = ++this.roomToken;
    this.state.room = id;
    if (id === 'studio') {
      this.showRoom(null, motion);
      return;
    }
    const room = createRoom(id, { lite: this.ctx.tier === 'low' });
    this.el.setAttribute('aria-busy', 'true');
    void this.prepareRoom(room).then(
      () => {
        if (token !== this.roomToken || this.disposed) room.dispose();
        else this.showRoom(room, motion);
      },
      (e) => {
        console.warn('場景準備失敗，直接顯示', e);
        if (token === this.roomToken && !this.disposed) this.showRoom(room, motion);
      },
    );
  }

  private async prepareRoom(room: Room): Promise<void> {
    const renderer = this.ctx.renderer;
    const preset = this.state.light;
    // 換上去之後要用的環境光；低畫質檔位不載 HDRI
    const env =
      this.ctx.tier === 'low'
        ? getEnvironment(renderer, preset)
        : await loadHDRI(hdriFor(preset, true)).catch(() => getEnvironment(renderer, preset));
    await room.ready;
    const textures = new Set<Texture>();
    room.group.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      for (const m of [o.material].flat())
        for (const v of Object.values(m)) if (v instanceof Texture) textures.add(v);
    });
    // 分幾格上傳貼圖，避免一次卡住太久；已經上傳過的貼圖幾乎不花時間
    for (const t of textures) {
      if (this.disposed) return;
      renderer.initTexture(t);
      await yieldIfBusy();
    }
    // 用換上去之後的環境光編譯整個場景：環境貼圖會影響 shader，HDRI 也在這時先轉成 PMREM
    // 主光在情境場景會投射陰影（見 setLight），有沒有陰影也會影響 shader
    const prevEnv = this.scene.environment;
    const prevCast = this.key.castShadow;
    this.scene.environment = env;
    this.key.castShadow = this.ctx.settings.shadows;
    this.scene.add(room.group);
    const compiling = renderer.compileAsync(this.scene, this.camera);
    this.scene.remove(room.group);
    this.scene.environment = prevEnv;
    this.key.castShadow = prevCast;
    await compiling;
    // 每個 shader 第一次使用時要向 GPU 同步查詢 uniform，分幾格先查好，避免全部擠在換上場景的那一格
    for (const program of renderer.info.programs ?? []) {
      if (this.disposed) return;
      program.getUniforms();
      await yieldIfBusy();
    }
  }

  private showRoom(room: Room | null, motion: boolean): void {
    if (this.room) {
      this.scene.remove(this.room.group);
      this.room.dispose();
    }
    this.room = room;
    if (room) this.scene.add(room.group);
    this.el.removeAttribute('aria-busy');
    this.setLight(this.state.light);
    this.placeModel();
    this.frame(motion);
    if (this.photo.enabled) void this.rebuildPhoto();
  }

  private setLight(preset: LightPreset): void {
    const look = LIGHT_LOOK[preset];
    const inRoom = this.state.room !== 'studio';
    // 先用程式產生的燈箱，實拍 HDRI 載入後替換
    this.scene.environment = getEnvironment(this.ctx.renderer, preset);
    this.scene.environmentIntensity = look.envIntensity * (inRoom ? 0.8 : 1);
    const hdri = hdriFor(preset, inRoom);
    // HDRI 已經載好就直接套用：先換成燈箱再換 HDRI，環境貼圖尺寸不同，會多編一次 shader
    const ready = this.ctx.tier === 'low' ? undefined : peekHDRI(hdri);
    if (ready) {
      this.scene.environment = ready;
      this.scene.environmentIntensity = HDRI_INTENSITY[hdri];
      this.photo.updateEnvironment();
    }
    // 低畫質檔位（軟體算繪、低記憶體裝置）不下載 HDRI：1.4 MB 的檔案轉環境貼圖會卡住主執行緒好幾秒
    this.hdriTask =
      this.ctx.tier === 'low' || ready
        ? Promise.resolve()
        : loadHDRI(hdri).then(
            (texture) => {
              if (this.disposed || hdriFor(this.state.light, this.state.room !== 'studio') !== hdri)
                return;
              this.scene.environment = texture;
              this.scene.environmentIntensity = HDRI_INTENSITY[hdri];
              this.photo.updateEnvironment();
            },
            (e) => console.warn('HDRI 載入失敗，沿用程式產生的環境光', e),
          );
    this.clearColor = this.transparent ? null : new Color(backgroundFor(preset));
    this.photo.setCycColor(new Color(backgroundFor(preset)));
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
    this.photo.updateEnvironment();
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

  private hit(event: PointerEvent): { slot: PartSlot; mesh: Mesh } | null {
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
    const mesh = first.object as Mesh;
    return { slot: this.model.primary.includes(mesh) ? 'primary' : 'accent', mesh };
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
    this.setHover(this.hit(event)?.slot ?? null);
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
    const result = this.hit(event);
    if (!result) return;
    let { slot } = result;
    // 上傳的模型沒有預先分好主色、輔色零件：點一下就在兩者之間切換
    if (this.state.product === 'custom' && this.model) {
      slot = this.toggleSlot(result.mesh, slot);
    }
    this.el.dispatchEvent(
      new CustomEvent<PickDetail>('product:pick', { detail: { slot }, bubbles: true }),
    );
  };

  private toggleSlot(mesh: Mesh, current: PartSlot): PartSlot {
    const model = this.model!;
    const from = current === 'primary' ? model.primary : model.accent;
    const to = current === 'primary' ? model.accent : model.primary;
    from.splice(from.indexOf(mesh), 1);
    to.push(mesh);
    const next: PartSlot = current === 'primary' ? 'accent' : 'primary';
    mesh.material = next === 'primary' ? this.primaryMat : this.accentMat;
    return next;
  }

  /**
   * 換上使用者上傳的模型：所有零件先套主色，點零件可切換成輔色。
   * 原本的材質與貼圖會釋放，模型縮放到和內建產品差不多的大小。
   */
  setCustomModel(root: Group): void {
    const primary: Mesh[] = [];
    root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      releaseOriginalMaterials(o);
      o.material = this.primaryMat;
      o.castShadow = o.receiveShadow = true;
      primary.push(o);
    });
    const size = new Box3().setFromObject(root).getSize(new Vector3());
    root.scale.multiplyScalar(1.2 / Math.max(size.x, size.y, size.z, 1e-6));
    const wrapper = new Group();
    wrapper.add(root);

    const old = this.custom;
    this.custom = { root: wrapper, primary, accent: [] };
    this.state.product = 'custom';
    this.productToken += 1;
    this.mountModel(this.custom, 'custom', !this.reducedMotion);
    this.frame(!this.reducedMotion);
    this.el.dispatchEvent(
      new CustomEvent<ProductChangedDetail>('product:changed', {
        detail: { product: 'custom', hasAccent: true },
        bubbles: true,
      }),
    );
    if (old) disposeGeometries(old.root);
  }

  /** 網站切換深淺色時，背景跟著換 */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) this.state.spin = false;
  }

  beforeRender(renderer: WebGLRenderer): void {
    renderer.toneMappingExposure = this.exposure;
  }

  /** Stage 設好 viewport、scissor 後呼叫；相片級渲染就緒時改畫路徑追蹤的結果 */
  render(renderer: WebGLRenderer, viewHeight: number): void {
    if (!this.photo.render(viewHeight)) renderer.render(this.scene, this.camera);
  }

  update(_time: number, delta: number): void {
    // 開啟自轉時，沒在拖曳、放手超過 2 秒後慢慢轉；減少動態效果時不轉
    if (
      this.state.spin &&
      this.state.quality !== 'photo' &&
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
  async exportPNG(
    size: number,
    watermark: string,
    onProgress?: (ratio: number) => void,
  ): Promise<Blob> {
    const camera = this.camera.clone();
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    const background = this.clearColor ?? new Color(backgroundFor(this.state.light));
    const pixels =
      this.state.quality === 'photo' && this.photo.enabled
        ? await this.photo.exportPixels(size, 128, camera, background, onProgress ?? (() => {}))
        : this.rasterPixels(size, camera, background);
    return this.encodePNG(pixels, size, watermark);
  }

  /** 一般算繪的離屏輸出 */
  private rasterPixels(size: number, camera: PerspectiveCamera, background: Color): Uint8Array {
    const r = this.ctx.renderer;
    const linear = new WebGLRenderTarget(size, size, { type: HalfFloatType, samples: 4 });
    const output = new WebGLRenderTarget(size, size);
    const pass = new OutputPass();

    // 匯出時沒有 Stage 幫忙清背景，改用 scene.background
    const prevBackground = this.scene.background;
    this.scene.background = background;
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
    return pixels;
  }

  /** 像素轉 PNG 並加上浮水印 */
  private encodePNG(pixels: Uint8Array, size: number, watermark: string): Promise<Blob> {
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

    c2d.font = `500 ${Math.round(size / 64)}px "Inter Variable", system-ui, sans-serif`;
    c2d.textAlign = 'right';
    // 背景都是深色，浮水印用淺色
    c2d.fillStyle = 'rgba(244,242,238,0.75)';
    c2d.fillText(watermark, size - size / 32, size - size / 32);

    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('無法產生圖片'))), 'image/png'),
    );
  }

  dispose(): void {
    this.disposed = true;
    this.photo.dispose();
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
    if (this.custom) disposeGeometries(this.custom.root);
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
