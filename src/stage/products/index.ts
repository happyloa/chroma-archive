import { Mesh, type MeshStandardMaterial } from 'three';
import { loadGLTF } from '../loader';
import { buildChair } from './chair';
import { buildHeadphones } from './headphones';
import { buildLamp } from './lamp';
import { buildSneaker } from './sneaker';
import { buildSpeaker } from './speaker';
import { buildVase } from './vase';
import type { ProductBuilder, ProductId, ProductModel } from './shared';

/**
 * 產品模型。
 * 單椅、花瓶、運動鞋、桌燈用公開的 glTF 模型（來源與授權見 public/models/LICENSES.md），
 * 耳機與智慧音箱沒有合適的公開模型，用程式產生。glTF 載入失敗時退回程式產生的版本。
 */
const PROCEDURAL: Record<ProductId, ProductBuilder> = {
  chair: buildChair,
  headphones: buildHeadphones,
  vase: buildVase,
  speaker: buildSpeaker,
  lamp: buildLamp,
  sneaker: buildSneaker,
};

const GLB: Partial<Record<ProductId, string>> = {
  chair: '/models/chair.glb',
  vase: '/models/vase.glb',
  sneaker: '/models/sneaker.glb',
  lamp: '/models/lamp.glb',
};

export interface LoadedProduct extends ProductModel {
  /**
   * 模型原本的主色材質（glTF 才有）。它的貼圖已經在建置時轉成灰階細節圖，
   * 視窗會把這些貼圖接到自己的主色材質上，再乘上年度色。
   */
  primarySource?: MeshStandardMaterial;
}

export async function loadProduct(id: ProductId, detail: number): Promise<LoadedProduct> {
  const url = GLB[id];
  if (url) {
    try {
      const root = await loadGLTF(url);
      const primary: Mesh[] = [];
      const accent: Mesh[] = [];
      let primarySource: MeshStandardMaterial | undefined;
      root.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        o.castShadow = o.receiveShadow = true;
        const mat = o.material as MeshStandardMaterial;
        if (mat.userData?.coty === 'primary') {
          primary.push(o);
          primarySource ??= mat;
        } else if (mat.userData?.coty === 'accent') {
          accent.push(o);
        }
      });
      if (primary.length) return { root, primary, accent, primarySource };
    } catch (e) {
      console.warn(`無法載入 ${url}，改用程式產生的模型`, e);
    }
  }
  return PROCEDURAL[id](detail);
}

export type { ProductId, ProductModel } from './shared';
export { applyFinish, createFinishMaterial, type Finish } from './materials';
