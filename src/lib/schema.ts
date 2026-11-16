import { z } from 'astro/zod';

/** data/colors.json */
export const ColorSchema = z.object({
  name: z.string().min(1),
  nameZh: z.string().min(1),
  code: z.string().regex(/^\d{2}-\d{4}$/, '色號格式應為 NN-NNNN'),
  hex: z.string().regex(/^#[0-9A-F]{6}$/, 'HEX 應為大寫 #RRGGBB'),
});

export const YearSchema = z.object({
  year: z.number().int().min(2000),
  colors: z.array(ColorSchema).min(1).max(2),
  announced: z.iso.date().optional(),
});

export const ColorsFileSchema = z.object({
  $comment: z.string().optional(),
  years: z.array(YearSchema),
});

export type ColorEntry = z.infer<typeof ColorSchema>;

/** src/content/years/*.md 的 frontmatter */
export const FINISHES = ['matte', 'satin', 'gloss', 'metallic', 'velvet', 'translucent'] as const;
export const PRODUCTS = ['chair', 'headphones', 'vase', 'speaker', 'lamp', 'sneaker'] as const;
export const LIGHTS = ['studio', 'daylight', 'night'] as const;
export const CATEGORIES = [
  'furniture',
  'audio',
  'lighting',
  'homeware',
  'footwear',
  'wearable',
  'packaging',
  'mobility',
  'other',
] as const;

const CmfSchema = z.object({
  primary: z.string(),
  accent: z.string().optional(),
  material: z.string(),
  finish: z.enum(FINISHES),
});

const ConceptSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  category: z.enum(CATEGORIES),
  pitch: z.string().max(80),
  audience: z.string(),
  cmf: CmfSchema,
  labPreset: z.object({
    product: z.enum(PRODUCTS),
    light: z.enum(LIGHTS).default('studio'),
  }),
  /** 英文版 */
  en: z
    .object({
      title: z.string(),
      pitch: z.string().max(140),
      audience: z.string(),
      material: z.string(),
    })
    .optional(),
});

const MaterialNoteSchema = z.object({
  material: z.string(),
  reason: z.string().max(60),
  en: z.object({ material: z.string(), reason: z.string().max(120) }).optional(),
});

export const YearContentSchema = z
  .object({
    year: z.number().int(),
    summary: z.string().max(120),
    keywords: z.array(z.string()).min(4).max(6),
    concepts: z.array(ConceptSchema).default([]),
    materials: z
      .object({
        good: z.array(MaterialNoteSchema).length(3),
        avoid: z.array(MaterialNoteSchema).length(3),
      })
      .optional(),
    /** 英文版的摘要與關鍵字；沒有時英文頁退回中文 */
    en: z
      .object({
        summary: z.string().max(160),
        keywords: z.array(z.string()).min(4).max(6),
        /** 英文色彩故事，段落之間空一行 */
        story: z.string().optional(),
      })
      .optional(),
    status: z.enum(['draft', 'reviewed']).default('draft'),
  })
  .superRefine((data, ctx) => {
    // 草稿可以只有摘要與關鍵字；審稿完成的年份必須有完整設計發想
    if (data.status !== 'reviewed') return;
    if (data.concepts.length < 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['concepts'],
        message: 'reviewed 年份至少要有 3 個產品概念',
      });
    }
    if (!data.materials) {
      ctx.addIssue({
        code: 'custom',
        path: ['materials'],
        message: 'reviewed 年份必須填寫 materials',
      });
    }
  });

export type YearContent = z.infer<typeof YearContentSchema>;
