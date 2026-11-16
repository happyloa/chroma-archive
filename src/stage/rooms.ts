import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ProductId } from './products';

/**
 * 產品實驗室的情境場景（T054、US-05-8）。單位是公尺，家具只用中性色與木頭、金屬，
 * 不搶年度色。每個場景提供每種產品的擺放位置。
 */
export type RoomId = 'studio' | 'living' | 'bedroom' | 'office';

/** 各產品在真實世界的大約高度（公尺），進場景時依此縮放 */
export const REAL_HEIGHT: Record<ProductId, number> = {
  chair: 0.82,
  headphones: 0.2,
  vase: 0.34,
  speaker: 0.24,
  lamp: 0.46,
  sneaker: 0.13,
};

export interface Placement {
  position: Vector3;
  rotationY: number;
}

export interface Room {
  group: Group;
  place(product: ProductId): Placement;
  dispose(): void;
}

const mats = new Map<string, MeshStandardMaterial>();
function mat(key: string, color: number, roughness = 0.8, metalness = 0): MeshStandardMaterial {
  let m = mats.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness, metalness });
    mats.set(key, m);
  }
  return m;
}

const M = {
  wall: () => mat('wall', 0xe8e4dc, 0.95),
  floorOak: () => mat('oak', 0xb89a74, 0.6),
  floorConcrete: () => mat('concrete', 0x9d9a94, 0.9),
  rug: () => mat('rug', 0xd9d3c8, 1),
  fabric: () => mat('fabric', 0xc9c2b6, 1),
  linen: () => mat('linen', 0xf1eee8, 1),
  walnut: () => mat('walnut', 0x5a3e2b, 0.55),
  oak: () => mat('oakFurniture', 0xc4a57e, 0.55),
  steel: () => mat('steel', 0x2e2e2e, 0.4, 0.7),
  screen: () => mat('screen', 0x111214, 0.3, 0.2),
  window: () => {
    let m = mats.get('window');
    if (!m) {
      m = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e6, emissiveIntensity: 1.4 });
      mats.set('window', m);
    }
    return m;
  },
};

/** 場景各自建立的幾何，在 dispose 時釋放；材質全站共用 */
class Builder {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];

  add(geometry: BufferGeometry, material: Material, x: number, y: number, z: number, ry = 0): Mesh {
    this.geometries.push(geometry);
    const m = new Mesh(geometry, material);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  box(
    w: number,
    h: number,
    d: number,
    material: Material,
    x: number,
    y: number,
    z: number,
    r = 0.02,
  ) {
    const g =
      r > 0
        ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2))
        : new BoxGeometry(w, h, d);
    // y 是底面高度
    return this.add(g, material, x, y + h / 2, z);
  }

  cylinder(r: number, h: number, material: Material, x: number, y: number, z: number) {
    return this.add(new CylinderGeometry(r, r, h, 40), material, x, y + h / 2, z);
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
  }
}

/** 地板、兩面牆與左牆的窗；右側與前方開放給鏡頭 */
function shell(b: Builder, floor: Material): void {
  const floorMesh = b.add(new PlaneGeometry(8, 8), floor, 0, 0, 0);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.castShadow = false;
  const back = b.add(new PlaneGeometry(8, 3.2), M.wall(), 0, 1.6, -2.2);
  back.castShadow = false;
  const left = b.add(new PlaneGeometry(8, 3.2), M.wall(), -2.6, 1.6, 0, Math.PI / 2);
  left.castShadow = false;
  const win = b.add(new PlaneGeometry(1.6, 1.5), M.window(), -2.59, 1.55, -0.6, Math.PI / 2);
  win.castShadow = false;
  win.receiveShadow = false;
}

function legs(
  b: Builder,
  w: number,
  d: number,
  h: number,
  x: number,
  z: number,
  material: Material,
) {
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    b.cylinder(0.018, h, material, x + (dx! * w) / 2, 0, z + (dz! * d) / 2);
  }
}

function living(): Room {
  const b = new Builder();
  shell(b, M.floorOak());
  b.box(2.6, 0.012, 1.8, M.rug(), 0.1, 0, 0.1, 0);
  // 沙發
  b.box(2.1, 0.42, 0.9, M.fabric(), 0.3, 0.08, -1.65, 0.08);
  b.box(2.1, 0.45, 0.22, M.fabric(), 0.3, 0.45, -2.0, 0.08);
  b.box(0.22, 0.25, 0.9, M.fabric(), -0.69, 0.45, -1.65, 0.08);
  b.box(0.22, 0.25, 0.9, M.fabric(), 1.29, 0.45, -1.65, 0.08);
  // 圓形茶几
  b.cylinder(0.48, 0.035, M.oak(), 0.35, 0.4, -0.35);
  b.cylinder(0.05, 0.4, M.steel(), 0.35, 0, -0.35);
  // 邊几
  b.cylinder(0.22, 0.03, M.walnut(), -1.15, 0.55, -1.5);
  b.cylinder(0.025, 0.55, M.steel(), -1.15, 0, -1.5);

  return {
    group: b.group,
    dispose: () => b.dispose(),
    place: (p) =>
      ({
        chair: { position: new Vector3(-0.9, 0, 0.35), rotationY: 0.6 },
        sneaker: { position: new Vector3(-0.2, 0.012, 0.55), rotationY: 0.4 },
        speaker: { position: new Vector3(-1.15, 0.585, -1.5), rotationY: 0.3 },
        lamp: { position: new Vector3(-1.15, 0.585, -1.5), rotationY: 0 },
        vase: { position: new Vector3(0.45, 0.435, -0.4), rotationY: 0 },
        headphones: { position: new Vector3(0.3, 0.435, -0.25), rotationY: -0.5 },
      })[p],
  };
}

function bedroom(): Room {
  const b = new Builder();
  shell(b, M.floorOak());
  // 床
  b.box(1.7, 0.3, 2.1, M.walnut(), 0.4, 0.05, -1.1, 0.03);
  b.box(1.6, 0.22, 2.0, M.linen(), 0.4, 0.35, -1.1, 0.08);
  b.box(1.62, 0.08, 1.3, M.fabric(), 0.4, 0.52, -0.75, 0.06);
  b.box(0.6, 0.14, 0.38, M.linen(), 0.05, 0.57, -1.85, 0.07);
  b.box(0.6, 0.14, 0.38, M.linen(), 0.75, 0.57, -1.85, 0.07);
  b.box(1.8, 0.9, 0.08, M.walnut(), 0.4, 0.05, -2.15, 0.03);
  // 床頭櫃
  b.box(0.45, 0.5, 0.4, M.oak(), -0.85, 0, -1.85, 0.02);
  // 長凳
  b.box(1.2, 0.06, 0.38, M.oak(), 0.4, 0.42, 0.25, 0.02);
  legs(b, 1.1, 0.3, 0.42, 0.4, 0.25, M.steel());

  return {
    group: b.group,
    dispose: () => b.dispose(),
    place: (p) =>
      ({
        chair: { position: new Vector3(-1.4, 0, -0.2), rotationY: 0.8 },
        sneaker: { position: new Vector3(-0.3, 0, 0.4), rotationY: 0.9 },
        speaker: { position: new Vector3(-0.85, 0.5, -1.85), rotationY: 0.4 },
        lamp: { position: new Vector3(-0.85, 0.5, -1.85), rotationY: 0 },
        vase: { position: new Vector3(0.7, 0.48, 0.25), rotationY: 0 },
        headphones: { position: new Vector3(0.6, 0.6, -0.55), rotationY: -0.3 },
      })[p],
  };
}

function office(): Room {
  const b = new Builder();
  shell(b, M.floorConcrete());
  // 書桌
  b.box(1.5, 0.03, 0.72, M.oak(), 0.2, 0.72, -1.6, 0.01);
  legs(b, 1.4, 0.62, 0.72, 0.2, -1.6, M.steel());
  // 螢幕
  b.box(0.62, 0.36, 0.025, M.screen(), 0.45, 0.98, -1.85, 0.01);
  b.cylinder(0.02, 0.24, M.steel(), 0.45, 0.75, -1.87);
  b.box(0.2, 0.012, 0.16, M.steel(), 0.45, 0.75, -1.87, 0.004);
  // 層架
  b.box(0.9, 0.025, 0.3, M.walnut(), -1.9, 1.1, -2.03, 0.005);
  b.box(0.9, 0.025, 0.3, M.walnut(), -1.9, 1.5, -2.03, 0.005);
  // 地毯
  b.box(2.0, 0.01, 1.4, M.rug(), -0.6, 0, -0.2, 0);

  return {
    group: b.group,
    dispose: () => b.dispose(),
    place: (p) =>
      ({
        chair: { position: new Vector3(-1.0, 0, -0.3), rotationY: 0.7 },
        sneaker: { position: new Vector3(-0.2, 0.01, 0.1), rotationY: 0.5 },
        speaker: { position: new Vector3(0.75, 0.75, -1.55), rotationY: -0.4 },
        lamp: { position: new Vector3(-0.3, 0.75, -1.7), rotationY: 0 },
        vase: { position: new Vector3(-0.25, 0.75, -1.5), rotationY: 0 },
        headphones: { position: new Vector3(-0.1, 0.75, -1.45), rotationY: 0.5 },
      })[p],
  };
}

/** 依燈光預設調整窗光：夜間時窗戶變暗、帶一點藍 */
export function setRoomLight(preset: 'studio' | 'daylight' | 'night'): void {
  const win = M.window();
  if (preset === 'night') {
    win.emissive.setHex(0x30405a);
    win.emissiveIntensity = 0.6;
  } else {
    win.emissive.setHex(0xfff6e6);
    win.emissiveIntensity = preset === 'daylight' ? 1.8 : 1.3;
  }
}

export function createRoom(id: Exclude<RoomId, 'studio'>): Room {
  return { living, bedroom, office }[id]();
}
