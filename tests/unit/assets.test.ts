import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** 憲章第 3 條：單一 3D 模型（含貼圖）不超過 1.5 MB */
const LIMIT = 1.5 * 1024 * 1024;
const dirs = ['public/models', 'public/models/furniture'];
const models = dirs.flatMap((d) =>
  readdirSync(d)
    .filter((f) => f.endsWith('.glb'))
    .map((f) => join(d, f)),
);

describe('3D 模型大小', () => {
  it.each(models)('%s 在 1.5 MB 以內', (file) => {
    expect(statSync(file).size).toBeLessThanOrEqual(LIMIT);
  });
});
