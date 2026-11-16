import { describe, expect, it } from 'vitest';
import { formatColorRef, parseColorRef, tryParseColorRef } from '../../src/lib/color';

const years = [
  { year: 2016, colors: [{ hex: '#F7CAC9' }, { hex: '#92A8D1' }] },
  { year: 2025, colors: [{ hex: '#A47864' }] },
];

describe('parseColorRef', () => {
  it('解析年份引用', () => {
    expect(parseColorRef('2016-1', years)).toEqual({
      kind: 'year',
      year: 2016,
      index: 1,
      hex: '#92A8D1',
    });
  });

  it('解析 HEX 並轉大寫', () => {
    expect(parseColorRef('#e8dccb', years)).toEqual({ kind: 'hex', hex: '#E8DCCB' });
  });

  it.each([
    ['1999-0', '沒有 1999 年'],
    ['2025-1', '沒有第 1 個顏色'],
    ['#FFF', '格式錯誤'],
    ['mocha', '格式錯誤'],
  ])('%s 拋出錯誤', (ref, message) => {
    expect(() => parseColorRef(ref, years)).toThrow(message);
  });

  it('tryParseColorRef 失敗時回傳 null', () => {
    expect(tryParseColorRef('nope', years)).toBeNull();
  });

  it('formatColorRef 可還原', () => {
    for (const ref of ['2016-0', '#E8DCCB']) {
      expect(formatColorRef(parseColorRef(ref, years))).toBe(ref);
    }
  });
});
