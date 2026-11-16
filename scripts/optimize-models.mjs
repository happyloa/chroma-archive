/**
 * 把下載的公開模型壓縮成網站用的 .glb。
 *
 * 用法：node scripts/optimize-models.mjs <原始模型資料夾>
 * 原始資料夾的結構見下方 MODELS 的 file 欄位；來源與授權記在 public/models/LICENSES.md。
 *
 * 處理步驟：
 * 1. 移除 KHR_materials_variants 等用不到的資料
 * 2. 要換成年度色的材質：底色貼圖轉成灰階細節圖並拉亮，執行時乘上年度色；
 *    材質加上 extras.coty = "primary"，three.js 會放進 material.userData
 * 3. 貼圖縮到 1024 以內、轉 WebP；幾何用 Meshopt 壓縮
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * detail：細節圖保留多少原本的明暗（0 是純白、1 是完整對比）。
 * 原始貼圖本身有顏色深淺，對比太強時乘上年度色會顯得斑駁偏暗。
 * variant：有多組材質變體時要採用的那組（KHR_materials_variants）。
 * accent：套輔色的材質（extras.coty = "accent"），執行時整個換成視窗的輔色材質。
 */
const MODELS = [
  { id: 'chair', file: 'chair/modern_arm_chair_01_1k.gltf', tint: /pillow/i, detail: 0.3 },
  { id: 'vase', file: 'vase/ceramic_vase_03_1k.gltf', tint: /.*/, detail: 0.25 },
  {
    id: 'sneaker',
    file: 'shoe/MaterialsVariantsShoe.glb',
    tint: /.*/,
    detail: 0.55,
    variant: /beach/i,
  },
  // 外層燈罩與燈座套主色、燈罩內側套輔色，玻璃燈泡保留原本的透明虹彩材質
  {
    id: 'lamp',
    file: 'lamp/IridescenceLamp.glb',
    tint: /^IridescenceLamp$/,
    accent: /^IridescenceLampIridescence$/,
    detail: 0.2,
  },
];

const BUDGET = 1.5 * 1024 * 1024;
const rawDir = process.argv[2];
if (!rawDir) {
  console.error('用法：node scripts/optimize-models.mjs <原始模型資料夾>');
  process.exit(1);
}
const outDir = resolve('public/models');
mkdirSync(outDir, { recursive: true });

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

/**
 * 灰階並把第 90 百分位拉到白色，再依 detail 壓縮對比：
 * 輸出 = 255 × (1 − detail) + detail × 灰階，乘上年度色後大部分表面接近色票顏色。
 */
async function toDetailMap(texture, detail) {
  const input = Buffer.from(texture.getImage());
  // sharp 的運算順序是固定的（linear 會排在 normalise 之前），所以分兩次處理
  const normalised = await sharp(input)
    .grayscale()
    .normalise({ lower: 1, upper: 90 })
    .png()
    .toBuffer();
  const output = await sharp(normalised)
    .linear(detail, 255 * (1 - detail))
    .png()
    .toBuffer();
  texture.setImage(new Uint8Array(output)).setMimeType('image/png');
}

for (const model of MODELS) {
  const doc = await io.read(join(rawDir, model.file));
  const root = doc.getRoot();

  // 材質變體只留指定的那組
  if (model.variant) {
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const mappings = prim.getExtension('KHR_materials_variants');
        const match = mappings
          ?.listMappings()
          .find((m) => m.listVariants().some((v) => model.variant.test(v.getName())));
        if (match) prim.setMaterial(match.getMaterial());
      }
    }
  }
  for (const ext of root.listExtensionsUsed()) {
    if (ext.extensionName === 'KHR_materials_variants') ext.dispose();
  }
  await doc.transform(prune());

  const tinted = new Set();
  for (const mat of root.listMaterials()) {
    if (model.accent?.test(mat.getName())) {
      mat.setExtras({ ...mat.getExtras(), coty: 'accent' });
      continue;
    }
    if (!model.tint.test(mat.getName())) continue;
    mat.setExtras({ ...mat.getExtras(), coty: 'primary' });
    mat.setBaseColorFactor([1, 1, 1, 1]);
    const tex = mat.getBaseColorTexture();
    if (tex && !tinted.has(tex)) {
      await toDetailMap(tex, model.detail);
      tinted.add(tex);
    }
  }

  await doc.transform(
    dedup(),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    prune(),
  );

  const out = join(outDir, `${model.id}.glb`);
  await io.write(out, doc);
  const size = statSync(out).size;
  const flag = size > BUDGET ? '  ⚠ 超過 1.5 MB 預算' : '';
  console.log(
    `${model.id}.glb  ${(size / 1024).toFixed(0)} KB  上色材質 ${tinted.size || 'n/a'}${flag}`,
  );
}
