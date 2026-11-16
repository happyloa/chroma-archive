import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

type Callback = (time: number, delta: number) => void;

let lenis: Lenis | null = null;
const callbacks = new Set<Callback>();

/**
 * GSAP ticker 是全站唯一的時鐘（plan.md 2.2）。
 * 模組只會執行一次，重複呼叫 initTicker 不會重複註冊。
 */
export function initTicker(): Lenis {
  if (lenis) return lenis;

  lenis = new Lenis({ autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time, deltaTime) => {
    lenis?.raf(time * 1000);
    for (const cb of callbacks) cb(time, deltaTime / 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

export function onTick(cb: Callback): () => void {
  callbacks.add(cb);
  return () => callbacks.delete(cb);
}

export function tickerCallbackCount(): number {
  return callbacks.size;
}
