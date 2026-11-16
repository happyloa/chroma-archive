import {
  BufferGeometry,
  CapsuleGeometry,
  ExtrudeGeometry,
  Group,
  Shape,
  SphereGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { fixedMaterial } from './materials';
import { cached, mesh, seg, type ProductBuilder } from './shared';

/*
 * 運動鞋以側面輪廓擠出成形：x 是鞋長（-0.55 鞋跟到 0.55 鞋頭），y 是高度，z 是鞋寬。
 * 擠出後再依 x 位置收窄寬度，讓鞋頭和鞋跟呈現圓弧。
 */
const LENGTH = 1.1;
const WIDTH = 0.4;

/** 鞋寬比例：鞋跟 0.78、中段 1、鞋頭 0.7 */
function widthAt(x: number): number {
  const t = (x + LENGTH / 2) / LENGTH;
  if (t < 0.25) return 0.78 + (t / 0.25) * 0.22;
  if (t < 0.6) return 1;
  return 1 - ((t - 0.6) / 0.4) ** 1.6 * 0.3;
}

function taper(geometry: BufferGeometry): BufferGeometry {
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, pos.getZ(i) * widthAt(pos.getX(i)));
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function extrude(shape: Shape, depth: number, bevel: number, detail: number): BufferGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: seg(6, detail, 2),
    curveSegments: seg(24, detail, 8),
  });
  g.translate(0, 0, -depth / 2);
  return taper(g);
}

function soleShape(): Shape {
  const s = new Shape();
  s.moveTo(-0.52, 0.02);
  s.lineTo(0.42, 0.02);
  // 鞋頭微微上翹
  s.quadraticCurveTo(0.56, 0.04, 0.55, 0.12);
  s.lineTo(0.5, 0.13);
  s.lineTo(-0.5, 0.13);
  s.quadraticCurveTo(-0.56, 0.12, -0.52, 0.02);
  return s;
}

function upperShape(): Shape {
  const s = new Shape();
  s.moveTo(-0.48, 0.12);
  s.lineTo(0.46, 0.12);
  // 鞋頭圓弧
  s.bezierCurveTo(0.54, 0.13, 0.52, 0.26, 0.38, 0.29);
  // 鞋面斜坡到鞋舌
  s.bezierCurveTo(0.22, 0.33, 0.08, 0.42, -0.02, 0.5);
  // 鞋舌頂端
  s.quadraticCurveTo(-0.08, 0.56, -0.14, 0.5);
  // 鞋口凹處
  s.quadraticCurveTo(-0.28, 0.42, -0.4, 0.5);
  // 鞋跟
  s.bezierCurveTo(-0.5, 0.52, -0.54, 0.4, -0.5, 0.2);
  s.lineTo(-0.48, 0.12);
  return s;
}

/** 運動鞋：鞋面主色、鞋帶與後跟拉環輔色、白色鞋底 */
export const buildSneaker: ProductBuilder = (detail) => {
  const sole = cached('snk-sole', detail, () => extrude(soleShape(), WIDTH - 0.06, 0.03, detail));
  const upper = cached('snk-upper', detail, () =>
    extrude(upperShape(), WIDTH - 0.16, 0.06, detail),
  );
  const collar = cached(
    'snk-collar',
    detail,
    () => new SphereGeometry(1, seg(24, detail), seg(12, detail)),
  );
  const lace = cached('snk-lace', detail, () => new CapsuleGeometry(0.012, 0.2, 4, seg(8, detail)));
  const tab = cached('snk-tab', detail, () => new RoundedBoxGeometry(0.04, 0.12, 0.09, 2, 0.015));

  const root = new Group();
  const soleMesh = mesh(sole, fixedMaterial('sole'));
  const upperMesh = mesh(upper);
  // 鞋口：壓扁的深色橢球
  const opening = mesh(collar, fixedMaterial('rubber'));
  opening.scale.set(0.15, 0.03, 0.11);
  opening.position.set(-0.28, 0.47, 0);
  opening.rotation.z = 0.12;

  // 鞋帶沿鞋面斜坡排列
  const laces = [0, 1, 2, 3, 4].map((i) => {
    const t = i / 4;
    const l = mesh(lace);
    l.rotation.x = Math.PI / 2;
    l.position.set(0.24 - t * 0.26, 0.37 + t * 0.12, 0);
    l.rotation.z = 0.5;
    return l;
  });
  const heelTab = mesh(tab);
  heelTab.position.set(-0.56, 0.44, 0);
  heelTab.rotation.z = 0.2;

  root.add(soleMesh, upperMesh, opening, ...laces, heelTab);
  return { root, primary: [upperMesh], accent: [...laces, heelTab] };
};
