import { navigate } from 'astro:transitions/client';
import { gsap } from 'gsap';
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getEnvironment } from '../environment';
import type { StageContext, StageView } from '../types';

/**
 * 色彩空間：每個年度色是一顆球。三種排列：
 * - space：OKLCH 圓柱座標（角度＝色相、半徑＝彩度、高度＝明度）
 * - spiral：依年份排成螺旋
 * - wheel：依色相排成色環
 * 切換排列時球體以動畫移動。HTML 表格提供同樣的資料給鍵盤與螢幕閱讀器。
 */
export type SpaceLayout = 'space' | 'spiral' | 'wheel';

export interface SpaceItem {
  year: number;
  name: string;
  hex: string;
  l: number;
  c: number;
  h: number;
  href: string;
}

/** 彩蛋的球：只有色值與提示文字 */
interface ZimaItem {
  hex: string;
  l: number;
  c: number;
  h: number;
  label: string;
}
const ZIMA = -2;

function layoutPosition(
  layout: SpaceLayout,
  item: Pick<SpaceItem, 'l' | 'c' | 'h'>,
  i: number,
  n: number,
): Vector3 {
  const rad = (item.h * Math.PI) / 180;
  if (layout === 'space') {
    const r = item.c * 6; // OKLCH 彩度大約 0 到 0.25
    return new Vector3(Math.cos(rad) * r, (item.l - 0.55) * 3.2, Math.sin(rad) * r);
  }
  if (layout === 'spiral') {
    const a = i * 0.62;
    return new Vector3(Math.cos(a) * 1.15, (i / (n - 1) - 0.5) * 2.6, Math.sin(a) * 1.15);
  }
  // 色環：依色相角度排列，彩度越低越靠內圈
  const r = 0.6 + Math.min(1, item.c * 5) * 0.8;
  return new Vector3(Math.cos(rad) * r, (item.l - 0.55) * 0.6, Math.sin(rad) * r);
}

function ring(radius: number, y: number): LineLoop {
  const pts: number[] = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    pts.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pts, 3));
  return new LineLoop(
    g,
    new LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.3 }),
  );
}

class SpaceView implements StageView {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(40, 1, 0.1, 50);
  readonly el: HTMLElement;
  clearColor: Color | null = null;
  private readonly items: SpaceItem[];
  private readonly spheres: Mesh<SphereGeometry, MeshStandardMaterial>[] = [];
  private readonly guides = new Group();
  private readonly controls: OrbitControls;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2(10, 10);
  private readonly geometry = new SphereGeometry(0.075, 32, 16);
  private readonly tooltip: HTMLElement | null;
  private readonly zimaItem: ZimaItem | null;
  private readonly zima: Mesh<SphereGeometry, MeshStandardMaterial> | null = null;
  private hovered = -1;
  private reducedMotion: boolean;
  layout: SpaceLayout = 'space';

  constructor(el: HTMLElement, ctx: StageContext) {
    this.el = el;
    this.reducedMotion = ctx.reducedMotion;
    this.items = JSON.parse(el.dataset.items ?? '[]') as SpaceItem[];
    this.tooltip = el.querySelector<HTMLElement>('[data-space-tooltip]');
    this.zimaItem = el.dataset.zima ? (JSON.parse(el.dataset.zima) as ZimaItem) : null;
    this.scene.environment = getEnvironment(ctx.renderer, 'studio');

    const n = this.items.length;
    this.items.forEach((item, i) => {
      const mesh = new Mesh(
        this.geometry,
        new MeshStandardMaterial({ color: item.hex, roughness: 0.35, metalness: 0 }),
      );
      mesh.position.copy(layoutPosition('space', item, i, n));
      mesh.userData.index = i;
      this.spheres.push(mesh);
      this.scene.add(mesh);
    });
    // 彩蛋：一顆小一半的 Zima Blue，放在它的 OKLCH 座標上
    if (this.zimaItem) {
      this.zima = new Mesh(
        this.geometry,
        new MeshStandardMaterial({ color: this.zimaItem.hex, roughness: 0.35, metalness: 0 }),
      );
      this.zima.scale.setScalar(0.5);
      this.zima.position.copy(this.zimaPosition('space'));
      this.scene.add(this.zima);
    }
    // 明度刻度：三個圓環
    for (const l of [0.25, 0.55, 0.85]) this.guides.add(ring(1.5, (l - 0.55) * 3.2));
    this.scene.add(this.guides);

    this.camera.position.set(3.2, 1.6, 3.4);
    this.controls = new OrbitControls(this.camera, el);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    // 不攔截頁面捲動
    this.controls.enableZoom = false;
    this.controls.autoRotate = !this.reducedMotion;
    this.controls.autoRotateSpeed = 0.6;
    this.controls.target.set(0, 0, 0);

    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('click', this.onClick);
    document.addEventListener('click', this.onLayoutClick);
  }

  /** 螺旋時放在最外圈之後，其他排列照 OKLCH */
  private zimaPosition(layout: SpaceLayout): Vector3 {
    const n = this.items.length;
    return layoutPosition(layout, this.zimaItem!, n, n);
  }

  setLayout(layout: SpaceLayout): void {
    this.layout = layout;
    const n = this.items.length;
    const duration = this.reducedMotion ? 0 : 1.2;
    this.spheres.forEach((s, i) => {
      const p = layoutPosition(layout, this.items[i]!, i, n);
      gsap.to(s.position, {
        x: p.x,
        y: p.y,
        z: p.z,
        duration,
        ease: 'power3.inOut',
        delay: duration ? i * 0.012 : 0,
      });
    });
    if (this.zima) {
      const p = this.zimaPosition(layout);
      gsap.to(this.zima.position, { x: p.x, y: p.y, z: p.z, duration, ease: 'power3.inOut' });
    }
    gsap.to(this.guides.scale, { x: 1, y: layout === 'space' ? 1 : 0.0001, z: 1, duration });
    this.guides.visible = true;
    for (const line of this.guides.children as LineLoop[]) {
      gsap.to(line.material as LineBasicMaterial, {
        opacity: layout === 'space' ? 0.3 : 0,
        duration,
      });
    }
  }

  private onLayoutClick = (event: Event): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      '[data-space-layout]',
    );
    if (!button) return;
    const layout = button.dataset.spaceLayout as SpaceLayout;
    for (const b of document.querySelectorAll<HTMLButtonElement>('[data-space-layout]')) {
      b.setAttribute('aria-pressed', String(b === button));
    }
    this.setLayout(layout);
  };

  private pick(): number {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.zima ? [...this.spheres, this.zima] : this.spheres;
    const [hit] = this.raycaster.intersectObjects(targets, false);
    if (!hit) return -1;
    return hit.object === this.zima ? ZIMA : (hit.object.userData.index as number);
  }

  private onMove = (event: PointerEvent): void => {
    const rect = this.el.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.hovered = this.pick();
    this.el.style.cursor = this.hovered >= 0 ? 'pointer' : '';
    const item = this.items[this.hovered];
    const label =
      this.hovered === ZIMA ? this.zimaItem!.label : item ? `${item.year} ${item.name}` : '';
    if (this.tooltip) {
      this.tooltip.hidden = !label;
      if (label) {
        this.tooltip.textContent = label;
        this.tooltip.style.left = `${event.clientX - rect.left + 14}px`;
        this.tooltip.style.top = `${event.clientY - rect.top + 14}px`;
      }
    }
  };

  private onLeave = (): void => {
    this.pointer.set(10, 10);
    this.hovered = -1;
    if (this.tooltip) this.tooltip.hidden = true;
  };

  private onClick = (): void => {
    const index = this.pick();
    if (index === ZIMA) {
      document.dispatchEvent(new CustomEvent('chroma:zima'));
      return;
    }
    const item = this.items[index];
    if (item) void navigate(item.href);
  };

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.controls.autoRotate = !reduced;
  }

  update(_time: number, delta: number): void {
    this.spheres.forEach((s, i) => {
      const target = i === this.hovered ? 1.6 : 1;
      s.scale.setScalar(s.scale.x + (target - s.scale.x) * Math.min(1, delta * 10));
    });
    if (this.zima) {
      const target = this.hovered === ZIMA ? 0.8 : 0.5;
      const s = this.zima.scale.x;
      this.zima.scale.setScalar(s + (target - s) * Math.min(1, delta * 10));
    }
    this.controls.update(delta);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerleave', this.onLeave);
    this.el.removeEventListener('click', this.onClick);
    document.removeEventListener('click', this.onLayoutClick);
    this.controls.dispose();
    gsap.killTweensOf(this.spheres.map((s) => s.position));
    for (const s of this.spheres) s.material.dispose();
    if (this.zima) {
      gsap.killTweensOf(this.zima.position);
      this.zima.material.dispose();
    }
    this.geometry.dispose();
    for (const line of this.guides.children as LineLoop[]) {
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    }
  }
}

export function createSpaceView(el: HTMLElement, ctx: StageContext): StageView {
  return new SpaceView(el, ctx);
}
