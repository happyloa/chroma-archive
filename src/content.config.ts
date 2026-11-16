import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { YearContentSchema } from './lib/schema';

const years = defineCollection({
  // 只讀四位數年份的檔案，_template.md 不會被載入
  loader: glob({ pattern: '[0-9][0-9][0-9][0-9].md', base: './src/content/years' }),
  schema: YearContentSchema,
});

export const collections = { years };
