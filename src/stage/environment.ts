import {
  BackSide,
  BoxGeometry,
  Color,
  EquirectangularReflectionMapping,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PMREMGenerator,
  PointLight,
  Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

/**
 * 產品實驗室的三種燈光（US-05-4）。
 * 主要用 Poly Haven 的實拍 HDRI（T059）；HDRI 下載完成前，先用程式產生的燈箱場景烘成的環境貼圖，
 * 每個 renderer 每種只烘一次。
 */
export type LightPreset = 'studio' | 'daylight' | 'night';

const cache = new WeakMap<WebGLRenderer, Map<LightPreset, Texture>>();

function panel(color: number, intensity: number, w: number, h: number, d: number) {
  const mat = new MeshBasicMaterial({ color: new Color(color).multiplyScalar(intensity) });
  return new Mesh(new BoxGeometry(w, h, d), mat);
}

/** 以 RoomEnvironment 的做法建一個簡單燈箱 */
function lightBox(preset: Exclude<LightPreset, 'studio'>): Scene {
  const scene = new Scene();
  const room = new Mesh(
    new BoxGeometry(10, 8, 10),
    new MeshLambertMaterial({
      side: BackSide,
      color: preset === 'daylight' ? 0xd9d3c7 : 0x15171c,
    }),
  );
  room.position.y = 3;
  scene.add(room);
  const fill = new PointLight(
    preset === 'daylight' ? 0xfff1dc : 0x8aa0ff,
    preset === 'daylight' ? 60 : 8,
    30,
    2,
  );
  fill.position.set(0, 4, 0);
  scene.add(fill);

  if (preset === 'daylight') {
    // 大面積窗光從左上方進來
    const sky = panel(0xfff6e8, 6, 0.1, 5, 7);
    sky.position.set(-4.9, 3.5, 0);
    scene.add(sky);
    const bounce = panel(0xffffff, 1.2, 6, 0.1, 6);
    bounce.position.set(0, 6.9, 0);
    scene.add(bounce);
  } else {
    // 夜間：一條冷色輪廓光加一盞暖色小燈
    const rim = panel(0xc8d6ff, 14, 0.1, 6, 0.6);
    rim.position.set(4.9, 3, -3);
    scene.add(rim);
    const warm = panel(0xffb46b, 10, 0.6, 0.6, 0.6);
    warm.position.set(-3, 1.2, 3);
    scene.add(warm);
  }
  return scene;
}

export function getEnvironment(renderer: WebGLRenderer, preset: LightPreset): Texture {
  let map = cache.get(renderer);
  if (!map) {
    map = new Map();
    cache.set(renderer, map);
  }
  const hit = map.get(preset);
  if (hit) return hit;

  const pmrem = new PMREMGenerator(renderer);
  const scene = preset === 'studio' ? new RoomEnvironment() : lightBox(preset);
  const texture = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();
  scene.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      (o.material as MeshBasicMaterial).dispose();
    }
  });
  map.set(preset, texture);
  return texture;
}

/** 各燈光預設的背景色（深色介面）與環境光強度 */
export const LIGHT_LOOK: Record<
  LightPreset,
  { background: number; envIntensity: number; exposure: number }
> = {
  studio: { background: 0x1d1c1a, envIntensity: 0.55, exposure: 0.9 },
  daylight: { background: 0x24211c, envIntensity: 0.6, exposure: 0.95 },
  night: { background: 0x0f1013, envIntensity: 0.7, exposure: 1.1 },
};

export function backgroundFor(preset: LightPreset): number {
  return LIGHT_LOOK[preset].background;
}

// —— HDRI ——

export type HdriId = 'studio_small_08' | 'lythwood_room' | 'unfinished_office_night';

/** 純色背景用攝影棚 HDRI；情境場景用室內 HDRI，夜間用夜晚辦公室 */
export function hdriFor(preset: LightPreset, inRoom: boolean): HdriId {
  if (preset === 'night') return 'unfinished_office_night';
  if (!inRoom && preset === 'studio') return 'studio_small_08';
  return 'lythwood_room';
}

/** 各 HDRI 的環境光強度（依實拍亮度校正） */
export const HDRI_INTENSITY: Record<HdriId, number> = {
  studio_small_08: 0.9,
  lythwood_room: 0.75,
  unfinished_office_night: 0.35,
};

const hdriCache = new Map<HdriId, Promise<Texture>>();
const hdriLoaded = new Map<HdriId, Texture>();

/** 已經載入完成的 HDRI；還沒好就回傳 undefined */
export function peekHDRI(id: HdriId): Texture | undefined {
  return hdriLoaded.get(id);
}

/**
 * 載入等距柱狀投影的 HDRI。直接當 scene.environment 使用：
 * 即時算繪時 three.js 會自動轉成 PMREM，路徑追蹤則需要原始的等距柱狀貼圖。
 */
export function loadHDRI(id: HdriId): Promise<Texture> {
  let task = hdriCache.get(id);
  if (!task) {
    task = new HDRLoader().loadAsync(`/hdri/${id}.hdr`).then((t) => {
      t.mapping = EquirectangularReflectionMapping;
      hdriLoaded.set(id, t);
      return t;
    });
    hdriCache.set(id, task);
    task.catch(() => hdriCache.delete(id));
  }
  return task;
}
