import { CylinderGeometry, Group, LatheGeometry, TorusGeometry, Vector2 } from 'three';
import { fixedMaterial } from './materials';
import { cached, mesh, seg, type ProductBuilder } from './shared';

/** 圓柱外殼，上下邊緣導圓角 */
function bodyProfile(): Vector2[] {
  const r = 0.32;
  const h = 0.92;
  const c = 0.07;
  const pts: Vector2[] = [new Vector2(0, 0)];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(new Vector2(r - c + Math.sin(a) * c, c - Math.cos(a) * c));
  }
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(new Vector2(r - c + Math.cos(a) * c, h - c + Math.sin(a) * c));
  }
  pts.push(new Vector2(0, h));
  return pts;
}

/** 智慧音箱：織布外殼主色、頂蓋輔色、橡膠底座與狀態燈 */
export const buildSpeaker: ProductBuilder = (detail) => {
  const body = cached(
    'spk-body',
    detail,
    () => new LatheGeometry(bodyProfile(), seg(64, detail, 16)),
  );
  const cap = cached(
    'spk-cap',
    detail,
    () => new CylinderGeometry(0.27, 0.28, 0.035, seg(64, detail, 16)),
  );
  const base = cached(
    'spk-base',
    detail,
    () => new CylinderGeometry(0.26, 0.26, 0.03, seg(48, detail, 12)),
  );
  const ring = cached(
    'spk-ring',
    detail,
    () => new TorusGeometry(0.16, 0.008, 6, seg(64, detail, 16)),
  );

  const root = new Group();
  const shell = mesh(body);
  shell.position.y = 0.02;
  const top = mesh(cap);
  top.position.y = 0.955;
  const foot = mesh(base, fixedMaterial('rubber'));
  foot.position.y = 0.015;
  const light = mesh(ring, fixedMaterial('bulb'));
  light.rotation.x = Math.PI / 2;
  light.position.y = 0.975;

  root.add(shell, top, foot, light);
  return { root, primary: [shell], accent: [top] };
};
