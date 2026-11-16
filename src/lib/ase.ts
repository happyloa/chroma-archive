/**
 * Adobe Swatch Exchange（.ase）編碼。Illustrator、Photoshop、InDesign 都能匯入。
 *
 * 格式：'ASEF'、版本 1.0、區塊數，接著是區塊。每個區塊是 2 bytes 類型 + 4 bytes 長度 + 內容：
 * - 0xC001 群組開始：名稱
 * - 0x0001 顏色：名稱、色彩模式 'RGB '、三個 float32、2 bytes 類型（2 = normal）
 * - 0xC002 群組結束
 * 名稱是 UTF-16BE，前面是含結尾 null 的字元數。
 */
export interface AseGroup {
  name: string;
  colors: { name: string; hex: string }[];
}

function nameBytes(name: string): number[] {
  const out: number[] = [];
  const units = [...name].flatMap((ch) => {
    const code = ch.codePointAt(0)!;
    if (code <= 0xffff) return [code];
    const v = code - 0x10000;
    return [0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff)];
  });
  const len = units.length + 1;
  out.push((len >> 8) & 0xff, len & 0xff);
  for (const u of units) out.push((u >> 8) & 0xff, u & 0xff);
  out.push(0, 0);
  return out;
}

function float32(value: number): number[] {
  const buf = new DataView(new ArrayBuffer(4));
  buf.setFloat32(0, value, false);
  return [buf.getUint8(0), buf.getUint8(1), buf.getUint8(2), buf.getUint8(3)];
}

function block(type: number, body: number[]): number[] {
  const len = body.length;
  return [
    (type >> 8) & 0xff,
    type & 0xff,
    (len >>> 24) & 0xff,
    (len >>> 16) & 0xff,
    (len >>> 8) & 0xff,
    len & 0xff,
    ...body,
  ];
}

export function encodeAse(groups: AseGroup[]): Uint8Array {
  const blocks: number[][] = [];
  for (const g of groups) {
    blocks.push(block(0xc001, nameBytes(g.name)));
    for (const c of g.colors) {
      const hex = c.hex.replace('#', '');
      const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      blocks.push(
        block(0x0001, [
          ...nameBytes(c.name),
          ...[...'RGB '].map((ch) => ch.charCodeAt(0)),
          ...rgb.flatMap(float32),
          0,
          2,
        ]),
      );
    }
    blocks.push(block(0xc002, []));
  }
  const count = blocks.length;
  const header = [
    ...[...'ASEF'].map((ch) => ch.charCodeAt(0)),
    0,
    1,
    0,
    0,
    (count >>> 24) & 0xff,
    (count >>> 16) & 0xff,
    (count >>> 8) & 0xff,
    count & 0xff,
  ];
  return new Uint8Array([...header, ...blocks.flat()]);
}
