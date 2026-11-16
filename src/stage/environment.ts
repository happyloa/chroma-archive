import {
  BackSide,
  BoxGeometry,
  Color,
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

/**
 * 產品實驗室的三種燈光（US-05-4）。不下載 HDRI，改用程式產生的燈箱場景烘成環境貼圖，
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

/** 各燈光預設的背景色（淺色模式、深色模式）與環境光強度 */
export const LIGHT_LOOK: Record<
  LightPreset,
  { background: number; backgroundDark: number; envIntensity: number; exposure: number }
> = {
  studio: { background: 0xe3e0da, backgroundDark: 0x1d1c1a, envIntensity: 0.55, exposure: 0.9 },
  daylight: { background: 0xebe4d6, backgroundDark: 0x24211c, envIntensity: 0.6, exposure: 0.95 },
  night: { background: 0x15161a, backgroundDark: 0x0f1013, envIntensity: 0.7, exposure: 1.1 },
};

/** 依目前網站配色取背景色 */
export function backgroundFor(preset: LightPreset): number {
  const look = LIGHT_LOOK[preset];
  return document.documentElement.dataset.theme === 'dark' ? look.backgroundDark : look.background;
}
