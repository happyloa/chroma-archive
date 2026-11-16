/**
 * 產品實驗室情境場景的素材（tasks.md T059）：Poly Haven 的 HDRI、PBR 貼圖與家具模型，全部 CC0。
 *
 * 用法：node scripts/optimize-scene-assets.mjs <原始素材資料夾>
 * 原始資料夾結構：hdri/<id>_1k.hdr、tex/<id>/{Diffuse,nor_gl,arm}.jpg、models/<id>/<id>_1k.gltf
 *
 * - HDRI：1k .hdr 直接複製到 public/hdri/
 * - 貼圖：轉成 1024 WebP 到 public/textures/<id>/{diff,nor,arm}.webp
 * - 家具：貼圖縮到 512 並轉 WebP、幾何用 Meshopt 壓縮，輸出到 public/models/furniture/<id>.glb
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const HDRI = ['studio_small_08', 'lythwood_room', 'unfinished_office_night'];
const TEXTURES = ['wood_floor', 'smooth_concrete_floor', 'painted_plaster_wall'];
const FURNITURE = [
  'sofa_03',
  'coffee_table_round_01',
  'side_table_01',
  'potted_plant_04',
  'ClassicNightstand_01',
  'metal_office_desk',
  'Shelf_01',
];

const rawDir = process.argv[2];
if (!rawDir) {
  console.error('用法：node scripts/optimize-scene-assets.mjs <原始素材資料夾>');
  process.exit(1);
}
const kb = (path) => `${(statSync(path).size / 1024).toFixed(0)} KB`;

// HDRI
const hdriOut = resolve('public/hdri');
mkdirSync(hdriOut, { recursive: true });
for (const id of HDRI) {
  const out = join(hdriOut, `${id}.hdr`);
  copyFileSync(join(rawDir, 'hdri', `${id}_1k.hdr`), out);
  console.log(`hdri/${id}.hdr  ${kb(out)}`);
}

// 貼圖
for (const id of TEXTURES) {
  const outDir = resolve('public/textures', id);
  mkdirSync(outDir, { recursive: true });
  for (const [src, name, quality] of [
    ['Diffuse', 'diff', 78],
    ['nor_gl', 'nor', 88],
    ['arm', 'arm', 82],
  ]) {
    const out = join(outDir, `${name}.webp`);
    await sharp(join(rawDir, 'tex', id, `${src}.jpg`))
      .resize(1024, 1024, { fit: 'inside' })
      .webp({ quality })
      .toFile(out);
    console.log(`textures/${id}/${name}.webp  ${kb(out)}`);
  }
}

// 家具模型
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const furnitureOut = resolve('public/models/furniture');
mkdirSync(furnitureOut, { recursive: true });
for (const id of FURNITURE) {
  const dir = join(rawDir, 'models', id);
  const file = readdirSync(dir).find((f) => f.endsWith('.gltf'));
  const doc = await io.read(join(dir, file));
  await doc.transform(
    dedup(),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 78 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    prune(),
  );
  const out = join(furnitureOut, `${id}.glb`);
  await io.write(out, doc);
  console.log(`models/furniture/${id}.glb  ${kb(out)}`);
}
