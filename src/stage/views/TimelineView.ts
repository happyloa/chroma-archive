import { navigate } from 'astro:transitions/client';
import {
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import { initTicker } from '../../app/ticker';
import { morphIntoHero } from '../../app/transitions';
import type { StageContext, StageView } from '../types';

/**
 * 典藏頁的 3D 色卡時間軸。
 * 元素是黏在畫面上的視窗（position: sticky），外層是很高的捲動軌道；
 * 捲動進度決定鏡頭沿曲線前進到哪一年。色卡用 CanvasTexture 畫出實體色票的樣子。
 * 時間軸在畫面上時，左右方向鍵移到前後一年；螢幕閱讀器使用下方的 HTML 色票格。
 * 聚焦的色卡浮起，其他色卡退後並降低飽和度；點擊色卡時色塊放大成年度頁主視覺。
 */
export interface TimelineItem {
  year: number;
  hexes: string[];
  name: string;
  code: string;
  href: string;
}

const CARD_W = 1;
const CARD_H = 1.28;
const STEP = 1.9;

function cssColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** 畫一張實體色票：上方色塊、下方白色標籤寫年份、色名與色號 */
function drawCard(item: TimelineItem): CanvasTexture {
  const w = 512;
  const h = Math.round((w * CARD_H) / CARD_W);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#fdfcfa';
  c.fillRect(0, 0, w, h);
  const pad = 30;
  const swatchH = h * 0.66;
  const cw = (w - pad * 2) / item.hexes.length;
  item.hexes.forEach((hex, i) => {
    c.fillStyle = hex;
    c.fillRect(pad + cw * i, pad, cw + 0.5, swatchH);
  });
  c.fillStyle = '#0e0e0e';
  c.textBaseline = 'alphabetic';
  c.font = '300 76px "Fraunces Variable", Georgia, serif';
  c.fillText(String(item.year), pad, pad + swatchH + 92);
  c.font = '500 26px "Inter Variable", system-ui, sans-serif';
  c.fillText(item.name, pad, pad + swatchH + 138, w - pad * 2);
  c.fillStyle = '#5c5954';
  c.font = '400 20px ui-monospace, monospace';
  c.textAlign = 'right';
  c.fillText(item.code, w - pad, pad + swatchH + 92);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

class TimelineView implements StageView {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(38, 1, 0.1, 100);
  readonly el: HTMLElement;
  clearColor = new Color();
  private readonly items: TimelineItem[];
  private readonly cards: Mesh<PlaneGeometry, MeshBasicMaterial>[] = [];
  private readonly curve: CatmullRomCurve3;
  private readonly group = new Group();
  private readonly geometry = new PlaneGeometry(CARD_W, CARD_H);
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2(10, 10);
  private readonly paper = new Color();
  private readonly tint = new Color();
  private progress = 0;
  private smooth = 0;
  private velocity = 0;
  private hovered = -1;
  private reducedMotion: boolean;

  constructor(el: HTMLElement, ctx: StageContext) {
    this.el = el;
    this.reducedMotion = ctx.reducedMotion;
    this.items = JSON.parse(el.dataset.items ?? '[]') as TimelineItem[];

    // 色卡沿一條往畫面深處延伸的 S 形曲線排列
    const points = this.items.map(
      (_, i) => new Vector3(Math.sin(i * 0.55) * 1.4, Math.cos(i * 0.32) * 0.35, -i * STEP),
    );
    this.curve = new CatmullRomCurve3(
      points.length > 1 ? points : [new Vector3(), new Vector3(0, 0, -1)],
    );

    this.items.forEach((item, i) => {
      const material = new MeshBasicMaterial({
        map: drawCard(item),
        toneMapped: false,
        transparent: true,
      });
      // 飽和度：1 是原色，0 是灰階
      const saturation = { value: 1 };
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uSaturation = saturation;
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', 'uniform float uSaturation;\nvoid main() {')
          .replace(
            '#include <map_fragment>',
            '#include <map_fragment>\n  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, uSaturation);',
          );
      };
      const mesh = new Mesh(this.geometry, material);
      mesh.userData.saturation = saturation;
      mesh.position.copy(points[i]!);
      mesh.userData.index = i;
      this.cards.push(mesh);
      this.group.add(mesh);
    });
    this.scene.add(this.group);

    // 字型載入後重畫色卡，避免用到後備字型
    void document.fonts.ready.then(() => {
      this.cards.forEach((card, i) => {
        card.material.map?.dispose();
        card.material.map = drawCard(this.items[i]!);
        card.material.needsUpdate = true;
      });
    });

    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('click', this.onClick);
    document.addEventListener('keydown', this.onKey);
    this.paper.set(cssColor('--color-paper', '#0e0e0e'));
  }

  private pick(): number {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const [hit] = this.raycaster.intersectObjects(this.cards, false);
    return hit ? (hit.object.userData.index as number) : -1;
  }

  private onMove = (event: PointerEvent): void => {
    const rect = this.el.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.hovered = this.pick();
    this.el.style.cursor = this.hovered >= 0 ? 'pointer' : '';
  };

  private onLeave = (): void => {
    this.pointer.set(10, 10);
    this.hovered = -1;
  };

  private onClick = (): void => {
    const i = this.pick();
    const item = this.items[i];
    if (!item) return;
    if (!this.reducedMotion)
      morphIntoHero(this.swatchRect(i), item.hexes, `hero-${item.year}`, item.href);
    void navigate(item.href);
  };

  /** 色卡上色塊部分在畫面上的位置（drawCard 的版面：四周留 30px，色塊高 66%） */
  private swatchRect(i: number): DOMRect {
    const card = this.cards[i]!;
    card.updateMatrixWorld();
    const texH = (512 * CARD_H) / CARD_W;
    const padX = (30 / 512) * CARD_W;
    const top = CARD_H / 2 - (30 / texH) * CARD_H;
    const bottom = top - 0.66 * CARD_H;
    const rect = this.el.getBoundingClientRect();
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [x, y] of [
      [-CARD_W / 2 + padX, top],
      [CARD_W / 2 - padX, top],
      [-CARD_W / 2 + padX, bottom],
      [CARD_W / 2 - padX, bottom],
    ] as const) {
      const p = new Vector3(x, y, 0).applyMatrix4(card.matrixWorld).project(this.camera);
      xs.push(rect.left + ((p.x + 1) / 2) * rect.width);
      ys.push(rect.top + ((1 - p.y) / 2) * rect.height);
    }
    const left = Math.min(...xs);
    const topPx = Math.min(...ys);
    return new DOMRect(left, topPx, Math.max(...xs) - left, Math.max(...ys) - topPx);
  }

  /** 時間軸黏在畫面上時，左右方向鍵移到前後一年 */
  private onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const track = this.el.parentElement;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const range = rect.height - window.innerHeight;
    if (range <= 0 || rect.top > 0 || rect.bottom < window.innerHeight) return;
    const n = this.items.length;
    const current = Math.round(this.progress * (n - 1));
    const next = Math.min(n - 1, Math.max(0, current + (event.key === 'ArrowRight' ? 1 : -1)));
    if (next === current) return;
    event.preventDefault();
    const y = window.scrollY + rect.top + (next / (n - 1)) * range;
    initTicker().scrollTo(y, { immediate: this.reducedMotion, duration: 0.8 });
  };

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /** 由外層軌道的位置算出捲動進度 0 到 1 */
  private readProgress(): number {
    const track = this.el.parentElement;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const range = rect.height - window.innerHeight;
    return range > 0 ? Math.min(1, Math.max(0, -rect.top / range)) : 0;
  }

  update(_time: number, delta: number): void {
    const n = this.items.length;
    if (!n) return;
    const next = this.readProgress();
    this.velocity = (next - this.progress) / Math.max(delta, 1 / 120);
    this.progress = next;
    // 慣性：鏡頭位置平滑追上捲動進度
    const k = this.reducedMotion ? 1 : Math.min(1, delta * 6);
    this.smooth += (this.progress - this.smooth) * k;

    const t = this.smooth;
    const focus = t * (n - 1);
    const at = this.curve.getPoint(Math.min(1, t));
    const ahead = this.curve.getPoint(Math.min(1, t + 0.02));
    this.camera.position.set(at.x * 0.6, at.y + 0.25, at.z + 3.1);
    this.camera.lookAt(ahead.x * 0.8, ahead.y, ahead.z - 0.5);

    const bend = this.reducedMotion ? 0 : Math.max(-0.5, Math.min(0.5, this.velocity * 0.4));
    this.cards.forEach((card, i) => {
      const d = Math.abs(i - focus);
      const near = Math.max(0, 1 - d);
      // 聚焦的色卡浮起、正對鏡頭；其他的退後並轉開
      card.position.y = this.curve.points[i]!.y + near * 0.18;
      card.rotation.y = (i < focus ? 0.5 : -0.5) * Math.min(1, d * 0.8) + bend * (1 - near);
      card.scale.setScalar(1 + near * 0.08 + (i === this.hovered ? 0.05 : 0));
      const focusAmount = Math.max(near, i === this.hovered ? 0.8 : 0);
      card.material.color.setScalar(0.55 + 0.45 * focusAmount);
      (card.userData.saturation as { value: number }).value = 0.2 + 0.8 * focusAmount;
      // 已經經過的色卡很快淡出，避免擋在鏡頭前；遠處的也逐漸淡出
      const passed = Math.max(0, focus - i - 0.4);
      card.material.opacity = Math.max(0, Math.min(1 - passed * 2.2, 1 - Math.max(0, d - 6) * 0.2));
      card.visible = card.material.opacity > 0.01;
    });

    // 背景帶一點聚焦年份的顏色
    const item = this.items[Math.round(focus)];
    if (item) this.tint.set(item.hexes[0]!);
    this.clearColor.copy(this.paper).lerp(this.tint, 0.22);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerleave', this.onLeave);
    this.el.removeEventListener('click', this.onClick);
    document.removeEventListener('keydown', this.onKey);
    for (const card of this.cards) {
      card.material.map?.dispose();
      card.material.dispose();
    }
    this.geometry.dispose();
  }
}

export function createTimelineView(el: HTMLElement, ctx: StageContext): StageView {
  return new TimelineView(el, ctx);
}
