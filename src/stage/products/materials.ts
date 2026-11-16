import { Color, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';

export type Finish = 'matte' | 'satin' | 'gloss' | 'metallic' | 'velvet' | 'translucent';

/**
 * 六種表面處理。同一個 MeshPhysicalMaterial 切換參數，
 * 每次都把所有相關參數設回去，避免上一種表面的設定殘留。
 */
export function applyFinish(mat: MeshPhysicalMaterial, finish: Finish, hex: string): void {
  const color = new Color(hex);
  mat.color.copy(color);
  mat.roughness = 0.5;
  mat.metalness = 0;
  mat.clearcoat = 0;
  mat.clearcoatRoughness = 0.1;
  mat.sheen = 0;
  mat.sheenRoughness = 0.8;
  mat.transmission = 0;
  mat.thickness = 0;
  mat.ior = 1.5;
  mat.transparent = false;
  mat.opacity = 1;

  switch (finish) {
    case 'matte':
      mat.roughness = 0.92;
      break;
    case 'satin':
      mat.roughness = 0.45;
      mat.clearcoat = 0.2;
      mat.clearcoatRoughness = 0.4;
      break;
    case 'gloss':
      mat.roughness = 0.12;
      mat.clearcoat = 1;
      mat.clearcoatRoughness = 0.05;
      break;
    case 'metallic':
      mat.roughness = 0.28;
      mat.metalness = 1;
      break;
    case 'velvet':
      mat.roughness = 1;
      mat.sheen = 1;
      mat.sheenRoughness = 0.45;
      mat.sheenColor.copy(color).lerp(new Color(0xffffff), 0.45);
      break;
    case 'translucent':
      mat.roughness = 0.18;
      mat.transmission = 0.9;
      mat.thickness = 0.5;
      mat.ior = 1.45;
      break;
  }
  mat.needsUpdate = true;
}

export function createFinishMaterial(finish: Finish, hex: string): MeshPhysicalMaterial {
  const mat = new MeshPhysicalMaterial();
  applyFinish(mat, finish, hex);
  return mat;
}

/** 不隨年度色改變的零件材質，全站共用，不在視窗釋放時 dispose */
export type FixedMaterial = 'wood' | 'metal' | 'darkMetal' | 'rubber' | 'sole' | 'bulb';

const fixed = new Map<FixedMaterial, MeshStandardMaterial>();

export function fixedMaterial(kind: FixedMaterial): MeshStandardMaterial {
  const hit = fixed.get(kind);
  if (hit) return hit;
  const mat = {
    wood: () => new MeshStandardMaterial({ color: 0x5a3e2b, roughness: 0.55 }),
    metal: () => new MeshStandardMaterial({ color: 0xc9c9c9, metalness: 1, roughness: 0.22 }),
    darkMetal: () => new MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.8, roughness: 0.35 }),
    rubber: () => new MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 }),
    sole: () => new MeshStandardMaterial({ color: 0xf1efea, roughness: 0.7 }),
    bulb: () =>
      new MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffe2b0, emissiveIntensity: 2.2 }),
  }[kind]();
  fixed.set(kind, mat);
  return mat;
}
