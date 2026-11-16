import { CylinderGeometry, Group, LatheGeometry, TorusGeometry, Vector2 } from 'three';
import { fixedMaterial } from './materials';
import { cached, mesh, seg, type ProductBuilder } from './shared';

/** 圓角耳罩的剖面：繞 Y 軸旋轉成耳罩外殼 */
function cupProfile(): Vector2[] {
  const pts: Vector2[] = [new Vector2(0, -0.07)];
  const r = 0.2;
  const corner = 0.05;
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(new Vector2(r - corner + Math.sin(a) * corner, -0.07 + corner - Math.cos(a) * corner));
  }
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(new Vector2(r - corner + Math.cos(a) * corner, 0.07 - corner + Math.sin(a) * corner));
  }
  pts.push(new Vector2(0, 0.07));
  return pts;
}

/** 耳罩式耳機：頭帶與耳罩主色、耳墊與頭帶內襯輔色、金屬滑軌 */
export const buildHeadphones: ProductBuilder = (detail) => {
  const band = cached(
    'hp-band',
    detail,
    () => new TorusGeometry(0.5, 0.038, seg(12, detail), seg(64, detail), Math.PI),
  );
  const pad = cached(
    'hp-pad',
    detail,
    () => new TorusGeometry(0.48, 0.03, seg(10, detail), seg(48, detail), Math.PI * 0.55),
  );
  const cup = cached('hp-cup', detail, () => new LatheGeometry(cupProfile(), seg(48, detail, 12)));
  const cushion = cached(
    'hp-cushion',
    detail,
    () => new TorusGeometry(0.14, 0.055, seg(16, detail), seg(40, detail)),
  );
  const slider = cached('hp-slider', detail, () => new CylinderGeometry(0.012, 0.012, 0.22, 8));

  const root = new Group();
  const headband = mesh(band);
  headband.position.y = 0.32;
  const inner = mesh(pad);
  inner.position.y = 0.32;
  inner.rotation.z = Math.PI * 0.225;

  const metal = fixedMaterial('metal');
  const cups = [-1, 1].flatMap((side) => {
    const shell = mesh(cup);
    shell.rotation.z = Math.PI / 2;
    shell.position.set(side * 0.5, 0.06, 0);
    const ring = mesh(cushion);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(side * 0.43, 0.06, 0);
    const rail = mesh(slider, metal);
    rail.position.set(side * 0.53, 0.25, 0);
    return [shell, ring, rail];
  });

  root.add(headband, inner, ...cups);
  // 讓耳罩底部落在 y = 0
  root.position.y = 0.2;
  const wrapper = new Group();
  wrapper.add(root);
  return {
    root: wrapper,
    primary: [headband, cups[0]!, cups[3]!],
    accent: [inner, cups[1]!, cups[4]!],
  };
};
