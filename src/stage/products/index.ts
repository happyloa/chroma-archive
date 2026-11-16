import { buildChair } from './chair';
import { buildHeadphones } from './headphones';
import { buildLamp } from './lamp';
import { buildSneaker } from './sneaker';
import { buildSpeaker } from './speaker';
import { buildVase } from './vase';
import type { ProductBuilder, ProductId } from './shared';

/**
 * 產品模型（T047）。第一版以程式產生幾何，不需要下載模型檔、沒有授權問題，
 * 總大小只有幾 KB；之後可以用 loader.ts 換成 Blender 製作的 .glb。
 */
export const PRODUCTS: Record<ProductId, ProductBuilder> = {
  chair: buildChair,
  headphones: buildHeadphones,
  vase: buildVase,
  speaker: buildSpeaker,
  lamp: buildLamp,
  sneaker: buildSneaker,
};

export type { ProductId, ProductModel } from './shared';
export { applyFinish, createFinishMaterial, type Finish } from './materials';
