import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { getYears, type YearEntry } from '../../lib/data';
import { zima } from '../../lib/zima';

/**
 * 建置時產生 OG 分享圖：每個年度一張，加上一張站名的預設圖，1200 × 630。
 * 文字只用英文與數字，中英文頁面共用同一張；字型用 Fontsource 的 woff（satori 不支援 woff2）。
 */
const require = createRequire(import.meta.url);
const font = (pkg: string, file: string) => readFileSync(require.resolve(`${pkg}/files/${file}`));

const fonts = [
  {
    name: 'Fraunces',
    data: font('@fontsource/fraunces', 'fraunces-latin-300-normal.woff'),
    weight: 300 as const,
  },
  {
    name: 'Inter',
    data: font('@fontsource/inter', 'inter-latin-400-normal.woff'),
    weight: 400 as const,
  },
  {
    name: 'Inter',
    data: font('@fontsource/inter', 'inter-latin-500-normal.woff'),
    weight: 500 as const,
  },
];

export const getStaticPaths = (async () => {
  const years = await getYears();
  return [
    ...years.map((entry) => ({ params: { slug: String(entry.year) }, props: { entry, years } })),
    { params: { slug: 'default' }, props: { entry: null, years } },
    { params: { slug: 'zima' }, props: { entry: null, years, zima: true } },
  ];
}) satisfies GetStaticPaths;

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
});

function yearCard(entry: YearEntry): Node {
  const names = entry.colors.map((c) => c.name).join(' & ');
  const codes = entry.colors.map((c) => `PANTONE ${c.code}`).join('  /  ');
  return h(
    'div',
    { display: 'flex', width: '100%', height: '100%', background: '#f4f2ee', color: '#0e0e0e' },
    [
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 0 56px 72px',
          width: '55%',
        },
        [
          h(
            'div',
            { fontFamily: 'Inter', fontWeight: 500, fontSize: 22, letterSpacing: 4 },
            'CHROMA ARCHIVE',
          ),
          h('div', { display: 'flex', flexDirection: 'column' }, [
            h(
              'div',
              {
                fontFamily: 'Fraunces',
                fontWeight: 300,
                fontSize: 200,
                lineHeight: 0.9,
                letterSpacing: -6,
              },
              String(entry.year),
            ),
            h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 44, marginTop: 24 }, names),
            h(
              'div',
              {
                fontFamily: 'Inter',
                fontWeight: 400,
                fontSize: 20,
                marginTop: 14,
                color: '#5c5954',
              },
              codes,
            ),
          ]),
          h(
            'div',
            { fontFamily: 'Inter', fontWeight: 400, fontSize: 18, color: '#5c5954' },
            'Pantone Color of the Year · unofficial archive',
          ),
        ],
      ),
      // 實體色票：白色標籤紙上的色塊
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '45%' }, [
        h(
          'div',
          {
            display: 'flex',
            flexDirection: 'column',
            background: '#fdfcfa',
            padding: 22,
            paddingBottom: 70,
            boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            transform: 'rotate(-3deg)',
          },
          [
            h(
              'div',
              { display: 'flex', width: 360, height: 400 },
              entry.colors.map((c) => h('div', { flex: 1, background: c.hex })),
            ),
          ],
        ),
      ]),
    ],
  );
}

/** Zima Blue 彩蛋：整片藍，右下一塊更亮的方形 */
function zimaCard(): Node {
  // 外框只負責底色；padding 放在 flex: 1 的內層，總寬高才不會超出 1200 × 630
  return h('div', { display: 'flex', width: '100%', height: '100%', background: zima.hex }, [
    h(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flex: 1,
        padding: '64px 72px 56px',
        color: zima.color.ink,
      },
      [
        h(
          'div',
          { fontFamily: 'Inter', fontWeight: 500, fontSize: 22, letterSpacing: 4 },
          'CHROMA ARCHIVE',
        ),
        h('div', { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }, [
          h(
            'div',
            {
              fontFamily: 'Fraunces',
              fontWeight: 300,
              fontSize: 150,
              lineHeight: 0.9,
              letterSpacing: -4,
            },
            zima.name,
          ),
          h('div', {
            display: 'flex',
            width: 120,
            height: 120,
            marginBottom: 12,
            background: '#ffffff',
            opacity: 0.35,
          }),
        ]),
        h(
          'div',
          { fontFamily: 'Inter', fontWeight: 400, fontSize: 20 },
          `${zima.hex} · A fan tribute, not a Pantone Color of the Year`,
        ),
      ],
    ),
  ]);
}

function defaultCard(years: YearEntry[]): Node {
  return h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: '#0e0e0e',
      color: '#f4f2ee',
    },
    [
      h(
        'div',
        { display: 'flex', flex: 1 },
        years.flatMap((y) => y.colors.map((c) => h('div', { flex: 1, background: c.hex }))),
      ),
      h(
        'div',
        {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          padding: '40px 64px 48px',
        },
        [
          h(
            'div',
            { fontFamily: 'Fraunces', fontWeight: 300, fontSize: 96, lineHeight: 1 },
            'Chroma Archive',
          ),
          h(
            'div',
            {
              fontFamily: 'Inter',
              fontWeight: 400,
              fontSize: 24,
              color: '#a8a49d',
              whiteSpace: 'nowrap',
            },
            `Pantone Colors of the Year ${years[0]!.year}–${years.at(-1)!.year}`,
          ),
        ],
      ),
    ],
  );
}

export const GET: APIRoute = async ({ props }) => {
  const {
    entry,
    years,
    zima: isZima,
  } = props as {
    entry: YearEntry | null;
    years: YearEntry[];
    zima?: boolean;
  };
  const card = isZima ? zimaCard() : entry ? yearCard(entry) : defaultCard(years);
  const svg = await satori(card, {
    width: 1200,
    height: 630,
    fonts,
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
