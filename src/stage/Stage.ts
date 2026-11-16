import {
  BoxGeometry,
  Color,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  DirectionalLight,
  AmbientLight,
  Scene,
  WebGLRenderer,
} from 'three';
import { onTick } from '../app/ticker';

/**
 * 全站共用的 WebGL 舞台。canvas 透過 transition:persist 跨頁保留，
 * Stage 只建立一次（plan.md 2.1）。T005 技術驗證先放一個旋轉立方體。
 */
export class Stage {
  static instances = 0;
  private static current: Stage | null = null;

  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(40, 1, 0.1, 100);
  private readonly cube: Mesh<BoxGeometry, MeshStandardMaterial>;
  private running = true;
  frames = 0;

  static get(canvas: HTMLCanvasElement): Stage {
    if (Stage.current && Stage.current.canvas === canvas) return Stage.current;
    // canvas 被換掉代表 persist 失效；舊的 renderer 釋放掉，避免洩漏
    Stage.current?.dispose();
    Stage.current = new Stage(canvas);
    return Stage.current;
  }

  private constructor(canvas: HTMLCanvasElement) {
    Stage.instances += 1;
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera.position.set(0, 0, 6);
    this.scene.add(new AmbientLight(0xffffff, 0.6));
    const key = new DirectionalLight(0xffffff, 2);
    key.position.set(3, 4, 5);
    this.scene.add(key);

    this.cube = new Mesh(new BoxGeometry(1.6, 1.6, 1.6), new MeshStandardMaterial());
    this.scene.add(this.cube);

    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onVisibility);
    onTick(this.render);
  }

  /** 換頁後由 boot.ts 呼叫，套用新頁面的參數 */
  setScene(scene: string, color: string): void {
    this.cube.material.color = new Color(color);
    this.cube.visible = scene !== 'none';
  }

  private resize = (): void => {
    const { innerWidth: w, innerHeight: h } = window;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private onVisibility = (): void => {
    this.running = document.visibilityState === 'visible';
  };

  private render = (_time: number, delta: number): void => {
    if (!this.running) return;
    this.cube.rotation.x += delta * 0.4;
    this.cube.rotation.y += delta * 0.6;
    this.renderer.render(this.scene, this.camera);
    this.frames += 1;
  };

  private dispose(): void {
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.cube.geometry.dispose();
    this.cube.material.dispose();
    this.renderer.dispose();
  }
}
