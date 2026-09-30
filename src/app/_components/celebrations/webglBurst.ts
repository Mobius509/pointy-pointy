import { playFireworks } from "./fireworks";
import { playSound } from "./sounds";
import {
  BRAND,
  EFFECT_Z,
  PARTY,
  onStop,
  originPoint,
  tokenRgb,
  type CelebrationOptions,
} from "./shared";

// A swirling starburst of glowing particles drawn with raw WebGL (no
// library). Every particle's path is computed on the GPU from its launch
// angle/speed/swirl and the elapsed time, so the CPU just ticks a clock.
// Falls back to fireworks where WebGL isn't available.

const COUNT = 1500;
const DURATION = 2.8; // seconds

const VERT = `
attribute float a_angle;
attribute float a_speed;
attribute float a_size;
attribute float a_delay;
attribute float a_swirl;
attribute vec3 a_color;
uniform float u_time;
uniform vec2 u_origin;
uniform float u_aspect;
uniform float u_dpr;
varying vec3 v_color;
varying float v_alpha;
void main() {
  float t = max(u_time - a_delay, 0.0);
  float r = a_speed * (1.0 - exp(-2.6 * t));
  float ang = a_angle + a_swirl * t;
  vec2 p = vec2(cos(ang), sin(ang)) * r;
  p.y -= 0.16 * t * t;          // gentle gravity
  p.x /= u_aspect;              // keep the burst round
  gl_Position = vec4(u_origin + p, 0.0, 1.0);
  float life = clamp(t / (${DURATION.toFixed(1)} - a_delay), 0.0, 1.0);
  float twinkle = 0.75 + 0.25 * sin(40.0 * t + a_angle * 7.0);
  v_alpha = u_time < a_delay ? 0.0 : (1.0 - life) * (1.0 - life) * twinkle;
  gl_PointSize = a_size * u_dpr * (1.0 - 0.5 * life);
  v_color = a_color;
}`;

const FRAG = `
precision mediump float;
varying vec3 v_color;
varying float v_alpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float glow = smoothstep(0.5, 0.0, d);
  float core = smoothstep(0.18, 0.0, d);
  float a = (glow * 0.8 + core) * v_alpha;
  gl_FragColor = vec4(mix(v_color, vec3(1.0), core * 0.6) * a, a);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
  }
  return sh;
}

export async function playWebglBurst(opts: CelebrationOptions): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "pointer-events-none fixed inset-0";
  canvas.style.zIndex = String(EFFECT_Z);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;

  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true });
  if (!gl) return playFireworks(opts);
  document.body.appendChild(canvas);
  let stopped = false;
  const unregister = onStop(() => {
    stopped = true;
    canvas.remove();
  });

  try {
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link failed");
    gl.useProgram(prog);

    // Per-particle data: angle, speed, size, delay, swirl, r, g, b.
    const palette = [...PARTY, ...BRAND].map((n) => tokenRgb(n).map((c) => c / 255));
    const STRIDE = 8;
    const data = new Float32Array(COUNT * STRIDE);
    for (let i = 0; i < COUNT; i++) {
      const o = i * STRIDE;
      const ring = i % 3 === 0; // a third form a fast outer ring
      data[o] = Math.random() * Math.PI * 2;
      data[o + 1] = ring ? 0.95 + Math.random() * 0.25 : 0.15 + Math.random() * 0.8;
      data[o + 2] = 4 + Math.random() * (ring ? 6 : 12);
      data[o + 3] = Math.random() * (ring ? 0.05 : 0.35);
      data[o + 4] = (Math.random() - 0.5) * 3.2;
      const c = palette[Math.floor(Math.random() * palette.length)];
      data[o + 5] = c[0];
      data[o + 6] = c[1];
      data[o + 7] = c[2];
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const attr = (name: string, size: number, offset: number) => {
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
    };
    attr("a_angle", 1, 0);
    attr("a_speed", 1, 1);
    attr("a_size", 1, 2);
    attr("a_delay", 1, 3);
    attr("a_swirl", 1, 4);
    attr("a_color", 3, 5);

    const { x, y } = originPoint(opts.origin);
    gl.uniform2f(gl.getUniformLocation(prog, "u_origin"), (x / W) * 2 - 1, 1 - (y / H) * 2);
    gl.uniform1f(gl.getUniformLocation(prog, "u_aspect"), W / H);
    gl.uniform1f(gl.getUniformLocation(prog, "u_dpr"), dpr);
    const uTime = gl.getUniformLocation(prog, "u_time");

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // additive glow

    void playSound("boom");
    setTimeout(() => void playSound("cheer"), 350);

    await new Promise<void>((resolve) => {
      const start = performance.now();
      const frame = (now: number) => {
        const t = (now - start) / 1000;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uTime, t);
        gl.drawArrays(gl.POINTS, 0, COUNT);
        if (t < DURATION && !stopped) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  } catch (e) {
    console.warn("[celebrations] WebGL burst failed, using fireworks", e);
    canvas.remove();
    return playFireworks(opts);
  } finally {
    unregister();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  }
}
