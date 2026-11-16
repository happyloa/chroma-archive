import { describe, expect, it } from 'vitest';
import { encodeAse } from '../../src/lib/ase';

describe('encodeAse', () => {
  const bytes = encodeAse([{ name: 'G', colors: [{ name: 'Red', hex: '#FF0000' }] }]);
  const view = new DataView(bytes.buffer);

  it('檔頭是 ASEF 1.0，區塊數為 3（群組開始、顏色、群組結束）', () => {
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('ASEF');
    expect(view.getUint16(4)).toBe(1);
    expect(view.getUint16(6)).toBe(0);
    expect(view.getUint32(8)).toBe(3);
  });

  it('群組開始區塊帶 UTF-16BE 名稱', () => {
    expect(view.getUint16(12)).toBe(0xc001);
    const len = view.getUint32(14);
    expect(view.getUint16(18)).toBe(2); // "G" 加上結尾 null
    expect(view.getUint16(20)).toBe('G'.charCodeAt(0));
    expect(len).toBe(2 + 4);
  });

  it('顏色區塊是 RGB float32', () => {
    // 群組區塊：12 起始，6 bytes 標頭 + 6 bytes 內容
    const colorStart = 12 + 6 + 6;
    expect(view.getUint16(colorStart)).toBe(0x0001);
    const body = colorStart + 6;
    const nameLen = view.getUint16(body);
    const modeAt = body + 2 + nameLen * 2;
    expect(String.fromCharCode(...bytes.slice(modeAt, modeAt + 4))).toBe('RGB ');
    expect(view.getFloat32(modeAt + 4)).toBeCloseTo(1);
    expect(view.getFloat32(modeAt + 8)).toBeCloseTo(0);
    expect(view.getFloat32(modeAt + 12)).toBeCloseTo(0);
    expect(view.getUint16(modeAt + 16)).toBe(2);
  });

  it('結尾是群組結束區塊', () => {
    expect(view.getUint16(bytes.length - 6)).toBe(0xc002);
    expect(view.getUint32(bytes.length - 4)).toBe(0);
  });
});
