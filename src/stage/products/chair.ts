import { CylinderGeometry, Group } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { fixedMaterial } from './materials';
import { cached, mesh, seg, type ProductBuilder } from './shared';

/** 中世紀風格的低背單椅：椅殼主色、坐墊與靠墊輔色、木腳 */
export const buildChair: ProductBuilder = (detail) => {
  const s = seg(4, detail, 2);
  const shellSeat = cached(
    'chair-seat',
    detail,
    () => new RoundedBoxGeometry(1.1, 0.2, 0.92, s, 0.08),
  );
  const shellBack = cached(
    'chair-back',
    detail,
    () => new RoundedBoxGeometry(1.1, 0.78, 0.18, s, 0.08),
  );
  const arm = cached('chair-arm', detail, () => new RoundedBoxGeometry(0.14, 0.32, 0.86, s, 0.06));
  const cushion = cached(
    'chair-cushion',
    detail,
    () => new RoundedBoxGeometry(0.84, 0.13, 0.78, s, 0.06),
  );
  const pillow = cached(
    'chair-pillow',
    detail,
    () => new RoundedBoxGeometry(0.8, 0.5, 0.12, s, 0.06),
  );
  const leg = cached(
    'chair-leg',
    detail,
    () => new CylinderGeometry(0.028, 0.018, 0.4, seg(16, detail)),
  );

  const root = new Group();
  const seat = mesh(shellSeat);
  seat.position.set(0, 0.46, 0);
  const back = mesh(shellBack);
  back.position.set(0, 0.86, -0.4);
  back.rotation.x = -0.16;
  const armL = mesh(arm);
  armL.position.set(-0.48, 0.66, 0.02);
  const armR = mesh(arm);
  armR.position.set(0.48, 0.66, 0.02);
  const seatCushion = mesh(cushion);
  seatCushion.position.set(0, 0.62, 0.04);
  const backCushion = mesh(pillow);
  backCushion.position.set(0, 0.9, -0.28);
  backCushion.rotation.x = -0.16;

  const wood = fixedMaterial('wood');
  const legs = [
    [-0.42, 0.34],
    [0.42, 0.34],
    [-0.42, -0.34],
    [0.42, -0.34],
  ].map(([x, z]) => {
    const l = mesh(leg, wood);
    l.position.set(x!, 0.18, z!);
    // 腳往外張開一點
    l.rotation.z = Math.sign(x!) * -0.12;
    l.rotation.x = Math.sign(z!) * 0.12;
    return l;
  });

  root.add(seat, back, armL, armR, seatCushion, backCushion, ...legs);
  return { root, primary: [seat, back, armL, armR], accent: [seatCushion, backCushion] };
};
