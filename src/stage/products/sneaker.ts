import {
  BufferGeometry,
  CapsuleGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  Raycaster,
  Shape,
  SphereGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { fixedMaterial } from './materials';
import { cached, mesh, seg, type ProductBuilder } from './shared';

/*
 * 運動鞋以側面輪廓擠出成形：x 是鞋長（-0.55 鞋跟到 0.55 鞋頭），y 是高度，z 是鞋寬。
 * 擠出後依 x 位置收窄寬度，並把鞋面頂部往中線收攏，讓斷面接近鞋子的圓弧而不是方塊。
 */
const LENGTH = 1.1;
const SOLE_WIDTH = 0.4;

/** 鞋寬比例：鞋跟 0.72、前掌最寬 1、鞋頭收到 0.55 */
function widthAt(x: number): number {
  const t = Math.min(1, Math.max(0, (x + LENGTH / 2) / LENGTH));
  if (t < 0.3) return 0.72 + (t / 0.3) * 0.28;
  if (t < 0.68) return 1;
  return 1 - ((t - 0.68) / 0.32) ** 1.8 * 0.45;
}

/** 依高度把鞋面往中線收攏：越高越窄 */
function shapeUpper(geometry: BufferGeometry, base: number, top: number): BufferGeometry {
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const h = Math.min(1, Math.max(0, (y - base) / (top - base)));
    const pinch = 1 - h * h * 0.45;
    pos.setZ(i, pos.getZ(i) * widthAt(x) * pinch);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function taper(geometry: BufferGeometry): BufferGeometry {
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) * widthAt(pos.getX(i)));
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function extrude(shape: Shape, depth: number, bevel: number, detail: number): ExtrudeGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: seg(6, detail, 2),
    curveSegments: seg(32, detail, 10),
    steps: 1,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

function soleShape(): Shape {
  const s = new Shape();
  s.moveTo(-0.5, 0.015);
  s.lineTo(0.38, 0.015);
  // 鞋頭上翹
  s.bezierCurveTo(0.5, 0.015, 0.56, 0.05, 0.55, 0.1);
  s.lineTo(0.5, 0.1);
  s.lineTo(-0.48, 0.1);
  s.quadraticCurveTo(-0.55, 0.09, -0.5, 0.015);
  return s;
}

function upperShape(): Shape {
  const s = new Shape();
  s.moveTo(-0.47, 0.09);
  s.lineTo(0.44, 0.09);
  // 鞋頭：低而圓
  s.bezierCurveTo(0.53, 0.1, 0.52, 0.2, 0.4, 0.22);
  // 鞋面斜坡往鞋舌
  s.bezierCurveTo(0.26, 0.25, 0.1, 0.31, -0.04, 0.4);
  // 鞋舌頂端
  s.quadraticCurveTo(-0.09, 0.45, -0.14, 0.4);
  // 鞋口往後下凹
  s.bezierCurveTo(-0.22, 0.34, -0.33, 0.35, -0.4, 0.4);
  // 後跟
  s.bezierCurveTo(-0.47, 0.42, -0.53, 0.32, -0.5, 0.18);
  s.lineTo(-0.47, 0.09);
  return s;
}

/** 從上往下打射線找鞋面頂部高度，用來把鞋帶貼在表面上 */
function surfaceY(geometry: BufferGeometry, x: number): number {
  const probe = new Mesh(geometry);
  const ray = new Raycaster(new Vector3(x, 2, 0), new Vector3(0, -1, 0));
  const [hit] = ray.intersectObject(probe, false);
  return hit ? hit.point.y : 0.3;
}

/** 運動鞋：鞋面主色、鞋帶與後跟拉環輔色、白色鞋底 */
export const buildSneaker: ProductBuilder = (detail) => {
  const sole = cached('snk-sole', detail, () =>
    taper(extrude(soleShape(), SOLE_WIDTH - 0.04, 0.02, detail)),
  );
  const upper = cached('snk-upper', detail, () =>
    shapeUpper(extrude(upperShape(), SOLE_WIDTH - 0.1, 0.035, detail), 0.09, 0.45),
  );
  const collar = cached(
    'snk-collar',
    detail,
    () => new SphereGeometry(1, seg(24, detail), seg(12, detail)),
  );
  const lace = cached(
    'snk-lace',
    detail,
    () => new CapsuleGeometry(0.011, 0.13, 4, seg(8, detail)),
  );
  const tab = cached('snk-tab', detail, () => new RoundedBoxGeometry(0.035, 0.1, 0.07, 2, 0.012));

  const root = new Group();
  const soleMesh = mesh(sole, fixedMaterial('sole'));
  const upperMesh = mesh(upper);

  // 鞋口：壓扁的深色橢球，嵌在鞋口凹處
  const openingX = -0.27;
  const opening = mesh(collar, fixedMaterial('rubber'));
  opening.scale.set(0.13, 0.025, 0.085);
  opening.position.set(openingX, surfaceY(upper, openingX) - 0.012, 0);

  // 鞋帶：沿鞋面斜坡貼著表面排列，隨坡度傾斜
  const laces = [0, 1, 2, 3, 4].map((i) => {
    const x = 0.2 - i * 0.065;
    const y = surfaceY(upper, x);
    const slope = (surfaceY(upper, x - 0.02) - surfaceY(upper, x + 0.02)) / 0.04;
    const l = mesh(lace);
    l.rotation.set(Math.PI / 2, 0, -Math.atan(slope) * 0.6);
    l.position.set(x, y + 0.006, 0);
    return l;
  });

  const heelTab = mesh(tab);
  const heelY = surfaceY(upper, -0.45);
  heelTab.position.set(-0.505, heelY - 0.02, 0);
  heelTab.rotation.z = 0.25;

  root.add(soleMesh, upperMesh, opening, ...laces, heelTab);
  return { root, primary: [upperMesh], accent: [...laces, heelTab] };
};
