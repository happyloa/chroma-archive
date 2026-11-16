import { CylinderGeometry, Group, LatheGeometry, SphereGeometry, Vector2 } from 'three';
import { fixedMaterial } from './materials';
import { cached, mesh, seg, type ProductBuilder } from './shared';

/** 蘑菇形燈罩：外側弧面到邊緣，再沿內側回到中心，形成有厚度的殼 */
function shadeProfile(): Vector2[] {
  const pts: Vector2[] = [];
  const R = 0.42;
  const t = 0.02;
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    pts.push(new Vector2(Math.sin(a) * R, Math.cos(a) * R * 0.62));
  }
  for (let i = 24; i >= 0; i--) {
    const a = (i / 24) * (Math.PI / 2);
    pts.push(new Vector2(Math.sin(a) * (R - t), Math.cos(a) * (R - t) * 0.62 - t));
  }
  return pts;
}

/** 桌燈：燈罩主色、底座輔色、金屬燈桿與發光燈泡 */
export const buildLamp: ProductBuilder = (detail) => {
  const shade = cached(
    'lamp-shade',
    detail,
    () => new LatheGeometry(shadeProfile(), seg(64, detail, 16)),
  );
  const stem = cached('lamp-stem', detail, () => new CylinderGeometry(0.018, 0.018, 0.78, 12));
  const base = cached(
    'lamp-base',
    detail,
    () => new CylinderGeometry(0.2, 0.24, 0.07, seg(64, detail, 16)),
  );
  const bulb = cached(
    'lamp-bulb',
    detail,
    () => new SphereGeometry(0.07, seg(24, detail), seg(16, detail)),
  );

  const root = new Group();
  const baseMesh = mesh(base);
  baseMesh.position.y = 0.035;
  const stemMesh = mesh(stem, fixedMaterial('metal'));
  stemMesh.position.y = 0.46;
  const shadeMesh = mesh(shade);
  shadeMesh.position.y = 0.84;
  const bulbMesh = mesh(bulb, fixedMaterial('bulb'));
  bulbMesh.position.y = 0.8;

  root.add(baseMesh, stemMesh, shadeMesh, bulbMesh);
  return { root, primary: [shadeMesh], accent: [baseMesh] };
};
