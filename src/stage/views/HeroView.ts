import {
  Color,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
} from 'three';
import type { StageContext, StageView } from '../types';

/**
 * 首頁 Hero（T041、US-01）：
 * - 一般年份：年度色的液態顏料，domain-warped fbm noise 產生流動的深淺變化，滑鼠會攪動顏料。
 * - 淺色年份（OKLCH L > 0.85，例如 Cloud Dancer）：深色底上緩慢飄動的雲，雲用年度色。
 * 元素上的 data-color、data-mode（liquid | cloud）、data-background 決定外觀。
 */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uMouseStrength;
  uniform vec3 uColor;
  uniform vec3 uBackground;
  uniform float uMode; // 0 液態、1 雲

  // 2D simplex noise（Ashima Arts，MIT）
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * snoise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 p = vUv * aspect;
    vec2 m = uMouse * aspect;
    float d = distance(p, m);
    float t = uTime;

    if (uMode < 0.5) {
      // 液態顏料：兩層 domain warp
      vec2 q = vec2(fbm(p * 0.55 + t * 0.04), fbm(p * 0.55 + vec2(5.2, 1.3) - t * 0.035));
      // 滑鼠附近的漩渦
      vec2 swirl = (p - m) * exp(-d * d * 6.0) * uMouseStrength;
      vec2 r = vec2(
        fbm(p * 0.7 + 1.6 * q + vec2(1.7, 9.2) + swirl * 2.0 + t * 0.06),
        fbm(p * 0.7 + 1.6 * q + vec2(8.3, 2.8) - swirl * 2.0 + t * 0.05)
      );
      float f = fbm(p * 0.6 + 1.4 * r);
      // 以年度色為中心做深淺變化，保持接近原色，文字才讀得清楚
      vec3 light = mix(uColor, vec3(1.0), 0.22);
      vec3 dark = uColor * 0.78;
      vec3 col = mix(dark, light, smoothstep(-0.8, 0.9, f));
      // 顏料表面的細微高光
      float sheen = smoothstep(0.55, 0.95, f + length(r) * 0.25);
      col += sheen * 0.035;
      col = mix(col, uColor, 0.35);
      gl_FragColor = vec4(col, 1.0);
    } else {
      // 雲：多層 fbm，上方與右側較濃，左下保留給文字
      vec2 drift = vec2(t * 0.015, -t * 0.006);
      vec2 push = (p - m) * exp(-d * d * 4.0) * uMouseStrength * 0.6;
      float n = fbm(p * 1.3 + drift + push);
      float n2 = fbm(p * 2.6 - drift * 1.7 + n);
      float density = smoothstep(-0.15, 0.75, n * 0.65 + n2 * 0.45);
      float mask = smoothstep(0.1, 0.95, vUv.y * 0.75 + vUv.x * 0.5);
      density *= mask;
      // 光從右上來：雲的亮面與暗面
      float lit = smoothstep(-0.4, 0.6, n2 - n * 0.4);
      vec3 cloud = mix(uColor * 0.62, uColor, lit);
      vec3 col = mix(uBackground, cloud, density * 0.85);
      gl_FragColor = vec4(col, 1.0);
    }
    #include <colorspace_fragment>
  }
`;

class HeroView implements StageView {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly el: HTMLElement;
  clearColor: Color | null = null;
  private readonly material: ShaderMaterial;
  private readonly mouse = new Vector2(0.7, 0.6);
  private readonly target = new Vector2(0.7, 0.6);
  private strength = 0;
  private reducedMotion: boolean;
  private time = 0;

  constructor(el: HTMLElement, ctx: StageContext) {
    this.el = el;
    this.reducedMotion = ctx.reducedMotion;
    const cloud = el.dataset.mode === 'cloud';
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Vector2(1, 1) },
        uMouse: { value: this.mouse },
        uMouseStrength: { value: 0 },
        uColor: { value: new Color(el.dataset.color ?? '#A47864') },
        uBackground: { value: new Color(el.dataset.background ?? '#0E0E0E') },
        uMode: { value: cloud ? 1 : 0 },
      },
    });
    this.scene.add(new Mesh(new PlaneGeometry(2, 2), this.material));
    // 每次載入給不同的起始時間，畫面不會每次都一樣
    this.time = Math.random() * 100;
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerleave', this.onLeave);
  }

  private onMove = (event: PointerEvent): void => {
    const rect = this.el.getBoundingClientRect();
    this.target.set(
      (event.clientX - rect.left) / rect.width,
      1 - (event.clientY - rect.top) / rect.height,
    );
    this.strength = 1;
  };

  private onLeave = (): void => {
    this.strength = 0;
  };

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  update(_time: number, delta: number): void {
    // 減少動態效果時停在固定畫面
    if (!this.reducedMotion) this.time += delta;
    this.mouse.lerp(this.target, Math.min(1, delta * 3));
    const u = this.material.uniforms;
    u.uTime!.value = this.time;
    u.uMouseStrength!.value += (this.strength - u.uMouseStrength!.value) * Math.min(1, delta * 2);
  }

  resize(width: number, height: number): void {
    (this.material.uniforms.uResolution!.value as Vector2).set(width, height);
  }

  dispose(): void {
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerleave', this.onLeave);
    this.material.dispose();
    (this.scene.children[0] as Mesh).geometry.dispose();
  }
}

export function createHeroView(el: HTMLElement, ctx: StageContext): StageView {
  return new HeroView(el, ctx);
}
