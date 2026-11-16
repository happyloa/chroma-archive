import {
  BufferAttribute,
  Color,
  type BufferGeometry,
  type InterleavedBufferAttribute,
  ExtrudeGeometry,
  Mesh,
  MeshStandardMaterial,
  Shape,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { WebGLPathTracer } from 'three-gpu-pathtracer';

/**
 * 相片級渲染（T060、US-12）：用 three-gpu-pathtracer 做路徑追蹤，停止操作後畫面逐步收斂成
 * 有全域光照、真實軟陰影與玻璃折射的畫面。套件很大，第一次開啟時才載入。
 *
 * 路徑追蹤需要「等距柱狀」的環境貼圖（HDRI），程式產生的 PMREM 燈箱不能用，
 * 所以呼叫端要在 HDRI 載入完成後才 rebuild。
 */
export type PhotoProgress = { samples: number; building: boolean };

/** 攝影棚用的無接縫背景（cyc）：地板以圓弧接到後牆，路徑追蹤時才有真實的落地陰影 */
function createCyc(): Mesh<ExtrudeGeometry, MeshStandardMaterial> {
  const r = 3;
  const shape = new Shape();
  shape.moveTo(12, 0);
  shape.lineTo(-6 + r, 0);
  shape.absarc(-6 + r, r, r, -Math.PI / 2, Math.PI, true);
  shape.lineTo(-6, 12);
  shape.lineTo(-6.01, 12);
  shape.lineTo(-6.01, -0.01);
  shape.lineTo(12, -0.01);
  const geometry = new ExtrudeGeometry(shape, {
    depth: 30,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geometry.translate(0, 0, -15);
  // 繞 Y 軸轉 -90°：剖面的 x 軸變成 z 軸，後牆落在產品後方（-z），地板往鏡頭方向（+z）延伸
  geometry.rotateY(-Math.PI / 2);
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ roughness: 0.95 }));
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Meshopt 壓縮的 glTF 會把頂點屬性量化成整數（KHR_mesh_quantization）或交錯排列。
 * 即時算繪會自動還原，路徑追蹤的幾何產生器卻直接讀原始陣列，模型會變得極大或錯位，
 * 所以先轉回一般的 Float32 屬性。幾何是共用快取，轉一次之後就不再處理。
 */
function dequantize(geometry: BufferGeometry): void {
  if (geometry.userData.dequantized) return;
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    const interleaved = (attr as InterleavedBufferAttribute).isInterleavedBufferAttribute === true;
    if (!interleaved && attr.array instanceof Float32Array && !attr.normalized) continue;
    const { count, itemSize } = attr;
    const array = new Float32Array(count * itemSize);
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < itemSize; c++) array[i * itemSize + c] = attr.getComponent(i, c);
    }
    geometry.setAttribute(name, new BufferAttribute(array, itemSize));
  }
  geometry.userData.dequantized = true;
}

export class PhotoRenderer {
  private tracer: WebGLPathTracer | null = null;
  private loading: Promise<void> | null = null;
  private building = false;
  private exporting = false;
  private buildToken = 0;
  private readonly cyc = createCyc();
  private readonly buffer = new Vector2();
  private readonly viewport = new Vector4();
  private readonly scissor = new Vector4();

  private restoreViewport(): void {
    this.renderer.setViewport(this.viewport);
    this.renderer.setScissor(this.scissor);
    this.renderer.setScissorTest(true);
  }
  enabled = false;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly onProgress: (p: PhotoProgress) => void,
  ) {}

  get samples(): number {
    return this.tracer?.samples ?? 0;
  }

  private async load(): Promise<void> {
    this.loading ??= import('three-gpu-pathtracer').then(({ WebGLPathTracer }) => {
      const t = new WebGLPathTracer(this.renderer);
      t.bounces = 6;
      t.transmissiveBounces = 6;
      t.filterGlossyFactor = 0.5;
      t.minSamples = 2;
      t.renderDelay = 120;
      t.fadeDuration = 400;
      t.tiles.set(2, 2);
      // 低解析度預覽會直接貼到 canvas、不經過下面的 callback，在多視窗 canvas 上位置會錯，所以關掉
      t.dynamicLowRes = false;
      t.rasterizeScene = true;
      // 分塊算繪會改掉 renderer 的全域 viewport 與 scissor，貼回畫面前還原成這個視窗的範圍
      t.rasterizeSceneCallback = (scene, camera) => {
        this.restoreViewport();
        this.renderer.render(scene, camera);
      };
      t.renderToCanvasCallback = (_target, renderer, quad) => {
        this.restoreViewport();
        const autoClear = renderer.autoClear;
        renderer.autoClear = false;
        quad.render(renderer);
        renderer.autoClear = autoClear;
      };
      this.tracer = t;
    });
    return this.loading;
  }

  /** 開啟並建立場景；studio 為 true 時加上無接縫背景，讓產品有真實的落地陰影 */
  async enable(studio: boolean, background: Color): Promise<void> {
    this.enabled = true;
    await this.load();
    await this.rebuild(studio, background);
  }

  disable(): void {
    this.enabled = false;
    this.buildToken += 1;
    this.cyc.removeFromParent();
    this.onProgress({ samples: 0, building: false });
  }

  /** 場景結構改變（換產品、換場景）後重建 BVH */
  async rebuild(studio: boolean, background: Color): Promise<void> {
    if (!this.enabled || !this.tracer) return;
    const token = ++this.buildToken;
    if (studio) {
      this.cyc.material.color.copy(background);
      this.scene.add(this.cyc);
    } else {
      this.cyc.removeFromParent();
    }
    this.building = true;
    this.onProgress({ samples: 0, building: true });
    // 讓「準備中」的狀態先畫出來
    await new Promise(requestAnimationFrame);
    if (token !== this.buildToken) return;
    // setSceneAsync 需要另外設定 BVH Worker；場景三角面不多，同步建立只需要一瞬間
    // Box、Cylinder、Extrude 等幾何自帶多個 group（材質索引 0、1、2…）。即時算繪只有單一材質時會忽略，
    // 路徑追蹤卻會照索引對應到別的物件的材質，所以單一材質的物件先清掉 group
    this.scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      if (!Array.isArray(o.material) && o.geometry.groups.length) o.geometry.clearGroups();
      dequantize(o.geometry);
    });
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld();
    this.tracer.setScene(this.scene, this.camera);
    if (token !== this.buildToken) return;
    this.building = false;
    this.onProgress({ samples: 0, building: false });
  }

  updateCamera(): void {
    if (!this.enabled || this.building || !this.tracer) return;
    // matrixWorld 要到下一次算繪才會更新，路徑追蹤讀取前先手動更新
    this.camera.updateMatrixWorld();
    this.tracer.updateCamera();
  }

  updateMaterials(): void {
    if (this.enabled && !this.building) this.tracer?.updateMaterials();
  }

  updateEnvironment(): void {
    if (this.enabled && !this.building) {
      this.tracer?.updateEnvironment();
      this.tracer?.updateLights();
    }
  }

  setCycColor(color: Color): void {
    this.cyc.material.color.copy(color);
    this.updateMaterials();
  }

  /**
   * 在 Stage 設好的 viewport、scissor 內畫一個樣本。回傳 false 表示還不能用路徑追蹤，
   * 呼叫端改用一般算繪。
   */
  render(viewHeight: number): boolean {
    const t = this.tracer;
    if (!this.enabled || !t || this.building || this.exporting) return false;
    // 路徑追蹤的解析度跟著 canvas，依視窗高度縮小，避免算整個 canvas
    const buffer = this.renderer.getDrawingBufferSize(this.buffer);
    const dpr = this.renderer.getPixelRatio();
    t.renderScale = Math.min(1, (viewHeight * dpr) / Math.max(1, buffer.y));
    // 記下 Stage 為這個視窗設定的 viewport 與 scissor（CSS 像素）
    this.renderer.getViewport(this.viewport);
    this.renderer.getScissor(this.scissor);
    t.renderSample();
    this.restoreViewport();
    this.onProgress({ samples: Math.floor(t.samples), building: false });
    return true;
  }

  /**
   * 離屏輸出正方形圖片：累積 samples 個樣本後經 OutputPass 套用色調，回傳由上往下排列的像素。
   * three-gpu-pathtracer 沒有公開設定輸出尺寸的 API，這裡用它內部的 _pathTracer.setSize。
   */
  async exportPixels(
    size: number,
    samples: number,
    camera: PerspectiveCamera,
    background: Color,
    onProgress: (ratio: number) => void,
  ): Promise<Uint8Array> {
    const t = this.tracer;
    if (!t) throw new Error('相片級渲染尚未啟用');
    const inner = (
      t as unknown as {
        _pathTracer: { setSize(w: number, h: number): void; target: WebGLRenderTarget };
      }
    )._pathTracer;
    this.exporting = true;
    const prevBackground = this.scene.background;
    this.scene.background = background;
    t.updateEnvironment();
    t.synchronizeRenderSize = false;
    t.renderToCanvas = false;
    inner.setSize(size, size);
    t.setCamera(camera);
    t.reset();
    try {
      // 用 setTimeout 讓出主執行緒：分頁在背景時 requestAnimationFrame 會被降頻，匯出會慢很多
      const start = performance.now();
      while (t.samples < samples) {
        // renderDelay 期間 renderSample 不會累積，等它過去
        for (let i = 0; i < 4; i++) t.renderSample();
        onProgress(Math.min(1, t.samples / samples));
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (performance.now() - start > 180_000) break;
      }
      const r = this.renderer;
      const output = new WebGLRenderTarget(size, size);
      const pass = new OutputPass();
      const prevTarget = r.getRenderTarget();
      pass.render(r, output, inner.target, 0, false);
      const pixels = new Uint8Array(size * size * 4);
      r.readRenderTargetPixels(output, 0, 0, size, size, pixels);
      r.setRenderTarget(prevTarget);
      output.dispose();
      pass.dispose();
      return pixels;
    } finally {
      this.scene.background = prevBackground;
      t.synchronizeRenderSize = true;
      t.renderToCanvas = true;
      t.setCamera(this.camera);
      t.updateEnvironment();
      t.reset();
      this.exporting = false;
    }
  }

  dispose(): void {
    this.buildToken += 1;
    this.tracer?.dispose();
    this.cyc.geometry.dispose();
    this.cyc.material.dispose();
  }
}
