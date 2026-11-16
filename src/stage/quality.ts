import type { WebGLRenderer } from 'three';

/**
 * 畫質檔位（T032、FR-05、plan.md 2.3）。
 * 不用 detect-gpu：它執行時會向外部 CDN 下載跑分資料。改用裝置資訊估計初始檔位，
 * 再由 FpsGuard 依實際幀率往下調。
 */
export type Tier = 'high' | 'medium' | 'low';

export interface TierSettings {
  maxDpr: number;
  shadows: boolean;
  /** 產品模型的曲面分段倍率 */
  detail: number;
}

export const TIERS: Record<Tier, TierSettings> = {
  high: { maxDpr: 2, shadows: true, detail: 1 },
  medium: { maxDpr: 1.5, shadows: true, detail: 0.75 },
  low: { maxDpr: 1, shadows: false, detail: 0.5 },
};

const ORDER: Tier[] = ['high', 'medium', 'low'];

interface NavigatorHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

export function detectTier(renderer: WebGLRenderer): Tier {
  const nav = navigator as Navigator & NavigatorHints;
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';

  // 軟體算繪（沒有 GPU 加速）或省流量模式
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return 'low';
  if (nav.connection?.saveData) return 'low';
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return 'low';

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  if (coarse || cores <= 4 || (nav.deviceMemory !== undefined && nav.deviceMemory <= 4)) {
    return 'medium';
  }
  return 'high';
}

export function lowerTier(tier: Tier): Tier {
  return ORDER[Math.min(ORDER.indexOf(tier) + 1, ORDER.length - 1)]!;
}

/** 連續 2 秒平均幀率低於門檻就通知降一檔（plan.md 2.3） */
export class FpsGuard {
  private elapsed = 0;
  private frames = 0;

  constructor(
    private readonly onSlow: () => void,
    private readonly minFps = 40,
    private readonly window = 2,
  ) {}

  sample(delta: number): void {
    // 分頁切回來時的第一幀 delta 很大，不計入
    if (delta > 0.5) return;
    this.elapsed += delta;
    this.frames += 1;
    if (this.elapsed < this.window) return;
    const fps = this.frames / this.elapsed;
    this.elapsed = 0;
    this.frames = 0;
    if (fps < this.minFps) this.onSlow();
  }

  reset(): void {
    this.elapsed = 0;
    this.frames = 0;
  }
}
