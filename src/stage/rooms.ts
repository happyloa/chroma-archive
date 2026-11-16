import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { loadGLTF } from './loader';
import type { ProductId } from './products';

/**
 * 產品實驗室的情境場景（T054、T059、US-05-8）。單位是公尺。
 * 地板、牆面用 Poly Haven 的 PBR 貼圖，家具用 Poly Haven 的模型（皆為 CC0，見 public/models/LICENSES.md）；
 * 床和長凳沒有合適的公開模型，以程式產生。家具非同步載入，載入前場景先顯示空房間。
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
  /** 家具全部載入完成 */
  ready: Promise<void>;
  place(product: ProductId): Placement;
  dispose(): void;
}

// —— 材質 ——

const textureLoader = new TextureLoader();
/** 低畫質檔位：只用底色貼圖，不用法線與 ARM 貼圖 */
let lite = false;
const textureCache = new Map<string, Texture>();
function tex(url: string, repeat: Vector2, srgb = false): Texture {
  const key = `${url}@${repeat.x}x${repeat.y}${lite ? '-lite' : ''}`;
  let t = textureCache.get(key);
  if (!t) {
    t = textureLoader.load(url);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.copy(repeat);
    t.anisotropy = lite ? 1 : 8;
    if (srgb) t.colorSpace = SRGBColorSpace;
    textureCache.set(key, t);
  }
  return t;
}

/** PBR 貼圖材質：diff（底色）、nor（法線）、arm（AO、粗糙度、金屬度） */
function pbr(id: string, repeat: Vector2, tint = 0xffffff): MeshStandardMaterial {
  const base = `/textures/${id}`;
  if (lite)
    return new MeshStandardMaterial({
      color: tint,
      map: tex(`${base}/diff.webp`, repeat, true),
      roughness: 0.9,
      metalness: 0,
    });
  const arm = tex(`${base}/arm.webp`, repeat);
  return new MeshStandardMaterial({
    color: tint,
    map: tex(`${base}/diff.webp`, repeat, true),
    normalMap: tex(`${base}/nor.webp`, repeat),
    aoMap: arm,
    roughnessMap: arm,
    roughness: 1,
    metalness: 0,
  });
}

const mats = new Map<string, MeshStandardMaterial>();
function shared(key: string, make: () => MeshStandardMaterial): MeshStandardMaterial {
  if (lite) key += '-lite';
  let m = mats.get(key);
  if (!m) {
    m = make();
    mats.set(key, m);
  }
  return m;
}

const M = {
  floorWood: () => shared('floorWood', () => pbr('wood_floor', new Vector2(3, 3))),
  floorConcrete: () =>
    shared('floorConcrete', () => pbr('smooth_concrete_floor', new Vector2(3, 3))),
  wall: () => shared('wall', () => pbr('painted_plaster_wall', new Vector2(3, 1.2), 0xf3efe8)),
  rug: () => shared('rug', () => new MeshStandardMaterial({ color: 0xd9d3c8, roughness: 1 })),
  linen: () => shared('linen', () => new MeshStandardMaterial({ color: 0xf1eee8, roughness: 1 })),
  fabric: () => shared('fabric', () => new MeshStandardMaterial({ color: 0xc9c2b6, roughness: 1 })),
  walnut: () =>
    shared('walnut', () => new MeshStandardMaterial({ color: 0x5a3e2b, roughness: 0.55 })),
  oak: () => shared('oak', () => new MeshStandardMaterial({ color: 0xc4a57e, roughness: 0.55 })),
  steel: () =>
    shared(
      'steel',
      () => new MeshStandardMaterial({ color: 0x2e2e2e, roughness: 0.4, metalness: 0.7 }),
    ),
  screen: () =>
    shared(
      'screen',
      () => new MeshStandardMaterial({ color: 0x111214, roughness: 0.25, metalness: 0.2 }),
    ),
  window: () =>
    shared(
      'window',
      () =>
        new MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e6, emissiveIntensity: 1.4 }),
    ),
};

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

// —— 建構 ——

interface FurnitureSpec {
  id: string;
  position: [number, number, number];
  rotationY?: number;
}

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

  /** 載入 Poly Haven 家具模型（幾何與材質由 loader 快取共用） */
  furniture(specs: FurnitureSpec[]): Promise<void> {
    return Promise.all(
      specs.map(async (s) => {
        const model = await loadGLTF(`/models/furniture/${s.id}.glb`);
        model.position.set(...s.position);
        model.rotation.y = s.rotationY ?? 0;
        model.traverse((o) => {
          if (o instanceof Mesh) o.castShadow = o.receiveShadow = true;
        });
        this.group.add(model);
      }),
    ).then(
      () => undefined,
      (e) => console.warn('家具模型載入失敗', e),
    );
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

const COFFEE_TOP = 0.49;
const SIDE_TOP = 0.548;
const NIGHTSTAND_TOP = 0.7;
const DESK_TOP = 0.787;

function living(): Room {
  const b = new Builder();
  shell(b, M.floorWood());
  b.box(2.8, 0.012, 2.0, M.rug(), 0.2, 0, -0.3, 0);
  const ready = b.furniture([
    { id: 'sofa_03', position: [0.4, 0, -1.72] },
    { id: 'coffee_table_round_01', position: [0.4, 0, -0.35] },
    { id: 'side_table_01', position: [-1.35, 0, -1.6] },
    { id: 'potted_plant_04', position: [0.8, COFFEE_TOP, -0.6] },
  ]);

  return {
    group: b.group,
    ready,
    dispose: () => b.dispose(),
    place: (p) =>
      ({
        chair: { position: new Vector3(-1.1, 0, 0.3), rotationY: 0.6 },
        sneaker: { position: new Vector3(-0.3, 0.012, 0.6), rotationY: 0.4 },
        speaker: { position: new Vector3(-1.35, SIDE_TOP, -1.6), rotationY: 0.3 },
        lamp: { position: new Vector3(-1.35, SIDE_TOP, -1.6), rotationY: 0 },
        vase: { position: new Vector3(0.25, COFFEE_TOP, -0.35), rotationY: 0 },
        headphones: { position: new Vector3(0.45, COFFEE_TOP, -0.1), rotationY: -0.5 },
      })[p],
  };
}

function bedroom(): Room {
  const b = new Builder();
  shell(b, M.floorWood());
  // 床（程式產生）
  b.box(1.7, 0.3, 2.1, M.walnut(), 0.4, 0.05, -1.1, 0.03);
  b.box(1.6, 0.22, 2.0, M.linen(), 0.4, 0.35, -1.1, 0.08);
  b.box(1.62, 0.08, 1.3, M.fabric(), 0.4, 0.52, -0.75, 0.06);
  b.box(0.6, 0.14, 0.38, M.linen(), 0.05, 0.57, -1.85, 0.07);
  b.box(0.6, 0.14, 0.38, M.linen(), 0.75, 0.57, -1.85, 0.07);
  b.box(1.8, 0.9, 0.08, M.walnut(), 0.4, 0.05, -2.15, 0.03);
  // 長凳（程式產生）
  b.box(1.2, 0.06, 0.38, M.oak(), 0.4, 0.42, 0.25, 0.02);
  legs(b, 1.1, 0.3, 0.42, 0.4, 0.25, M.steel());
  const ready = b.furniture([
    { id: 'ClassicNightstand_01', position: [-0.85, 0, -1.9] },
    { id: 'potted_plant_04', position: [0.85, 0.48, 0.25] },
  ]);

  return {
    group: b.group,
    ready,
    dispose: () => b.dispose(),
    place: (p) =>
      ({
        chair: { position: new Vector3(-1.5, 0, -0.2), rotationY: 0.8 },
        sneaker: { position: new Vector3(-0.3, 0, 0.45), rotationY: 0.9 },
        speaker: { position: new Vector3(-0.85, NIGHTSTAND_TOP, -1.9), rotationY: 0.4 },
        lamp: { position: new Vector3(-0.85, NIGHTSTAND_TOP, -1.9), rotationY: 0 },
        vase: { position: new Vector3(0.3, 0.48, 0.25), rotationY: 0 },
        headphones: { position: new Vector3(0.6, 0.6, -0.55), rotationY: -0.3 },
      })[p],
  };
}

function office(): Room {
  const b = new Builder();
  shell(b, M.floorConcrete());
  b.box(2.2, 0.01, 1.5, M.rug(), -0.7, 0, -0.1, 0);
  // 螢幕（程式產生）
  b.box(0.62, 0.36, 0.025, M.screen(), 0.55, DESK_TOP + 0.24, -1.95, 0.01);
  b.cylinder(0.02, 0.24, M.steel(), 0.55, DESK_TOP, -1.97);
  b.box(0.2, 0.012, 0.16, M.steel(), 0.55, DESK_TOP, -1.97, 0.004);
  const ready = b.furniture([
    { id: 'metal_office_desk', position: [0.2, 0, -1.65] },
    { id: 'Shelf_01', position: [-1.75, 0, -2.2] },
    { id: 'potted_plant_04', position: [1.0, DESK_TOP, -1.9] },
  ]);

  return {
    group: b.group,
    ready,
    dispose: () => b.dispose(),
    place: (p) =>
      ({
        chair: { position: new Vector3(-1.0, 0, -0.3), rotationY: 0.7 },
        sneaker: { position: new Vector3(-0.2, 0.01, 0.15), rotationY: 0.5 },
        speaker: { position: new Vector3(0.85, DESK_TOP, -1.6), rotationY: -0.4 },
        lamp: { position: new Vector3(-0.35, DESK_TOP, -1.85), rotationY: 0 },
        vase: { position: new Vector3(-0.6, DESK_TOP, -1.55), rotationY: 0 },
        headphones: { position: new Vector3(0.0, DESK_TOP, -1.45), rotationY: 0.5 },
      })[p],
  };
}

export function createRoom(id: Exclude<RoomId, 'studio'>, opts: { lite?: boolean } = {}): Room {
  lite = !!opts.lite;
  return { living, bedroom, office }[id]();
}
