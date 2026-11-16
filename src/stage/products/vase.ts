import { CylinderGeometry, Group, LatheGeometry, SplineCurve, TorusGeometry, Vector2 } from 'three';
import { cached, mesh, seg, type ProductBuilder } from './shared';

/** 花瓶剖面：外壁由底往上到瓶口，再沿內壁往下，形成有厚度的開口 */
function vaseProfile(detail: number): Vector2[] {
  const outer = new SplineCurve([
    new Vector2(0.2, 0),
    new Vector2(0.31, 0.14),
    new Vector2(0.36, 0.38),
    new Vector2(0.28, 0.66),
    new Vector2(0.15, 0.86),
    new Vector2(0.14, 0.98),
    new Vector2(0.19, 1.12),
  ]).getPoints(seg(48, detail, 16));
  const inner = new SplineCurve([
    new Vector2(0.17, 1.12),
    new Vector2(0.12, 0.98),
    new Vector2(0.13, 0.86),
    new Vector2(0.26, 0.66),
    new Vector2(0.33, 0.38),
    new Vector2(0.28, 0.16),
    new Vector2(0.15, 0.06),
  ]).getPoints(seg(48, detail, 16));
  return [new Vector2(0, 0), ...outer, ...inner, new Vector2(0, 0.06)];
}

/** 陶瓷花瓶：瓶身主色、瓶口細環與底座輔色 */
export const buildVase: ProductBuilder = (detail) => {
  const body = cached(
    'vase-body',
    detail,
    () => new LatheGeometry(vaseProfile(detail), seg(64, detail, 16)),
  );
  const lip = cached(
    'vase-lip',
    detail,
    () => new TorusGeometry(0.18, 0.012, 8, seg(64, detail, 16)),
  );
  const plinth = cached(
    'vase-plinth',
    detail,
    () => new CylinderGeometry(0.42, 0.44, 0.06, seg(64, detail, 16)),
  );

  const root = new Group();
  const plinthMesh = mesh(plinth);
  plinthMesh.position.y = 0.03;
  const vase = mesh(body);
  vase.position.y = 0.06;
  const lipMesh = mesh(lip);
  lipMesh.rotation.x = Math.PI / 2;
  lipMesh.position.y = 1.18;

  root.add(plinthMesh, vase, lipMesh);
  return { root, primary: [vase], accent: [lipMesh, plinthMesh] };
};
