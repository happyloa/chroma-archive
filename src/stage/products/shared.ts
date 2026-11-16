import { BufferGeometry, Group, Mesh, type Material } from 'three';

export type ProductId = 'chair' | 'headphones' | 'vase' | 'speaker' | 'lamp' | 'sneaker';

/** 換色時要改的零件：primary 套主色、accent 套輔色，其餘零件用固定材質 */
export interface ProductModel {
  root: Group;
  primary: Mesh[];
  accent: Mesh[];
}

export type ProductBuilder = (detail: number) => ProductModel;

/** 同一種幾何在同一個細節等級只建立一次，跨視窗、跨頁共用 */
const geometryCache = new Map<string, BufferGeometry>();

export function cached<T extends BufferGeometry>(key: string, detail: number, make: () => T): T {
  const k = `${key}@${detail}`;
  let g = geometryCache.get(k) as T | undefined;
  if (!g) {
    g = make();
    g.computeVertexNormals?.();
    geometryCache.set(k, g);
  }
  return g;
}

/** 依細節等級調整分段數，至少保留 min 段 */
export const seg = (n: number, detail: number, min = 6) => Math.max(min, Math.round(n * detail));

export function mesh(geometry: BufferGeometry, material?: Material): Mesh {
  const m = new Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
