/* Procedural, seamless planet / glow / nebula textures drawn on canvases.
 * Value noise is sampled on the unit sphere, so there is no seam or pole pinch. */
import * as THREE from "three";

function hash3(x, y, z, seed) {
  let h = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x1b873593);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const a = hash3(xi, yi, zi, seed), b = hash3(xi + 1, yi, zi, seed);
  const c = hash3(xi, yi + 1, zi, seed), d = hash3(xi + 1, yi + 1, zi, seed);
  const e = hash3(xi, yi, zi + 1, seed), f = hash3(xi + 1, yi, zi + 1, seed);
  const g = hash3(xi, yi + 1, zi + 1, seed), h = hash3(xi + 1, yi + 1, zi + 1, seed);
  const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (h - g) * u;
  const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
  return y1 + (y2 - y1) * w;
}

function fbm(x, y, z, seed, octaves) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * freq, y * freq, z * freq, seed + i * 131);
    norm += amp;
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

function mixc(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function shade(hex, dh, ds, dl) {
  const c = new THREE.Color(hex);
  c.offsetHSL(dh, ds, dl);
  return [c.r, c.g, c.b];
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function makePlanetTexture(type, hex, seed, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const base = shade(hex, 0, 0, 0);
  const dark = shade(hex, 0.02, -0.1, -0.28);
  const light = shade(hex, -0.03, -0.05, 0.22);
  const deep = shade(hex, 0.05, 0.05, -0.38);
  const landA = shade(hex, 0.28, -0.25, -0.18);
  const landB = shade(hex, 0.12, -0.35, 0.05);
  const snow = [0.94, 0.95, 1.0];
  const bandFreq = 7 + (seed % 5) * 2;

  for (let y = 0; y < h; y++) {
    const lat = (y / (h - 1) - 0.5) * Math.PI;
    const cl = Math.cos(lat), py = Math.sin(lat);
    for (let x = 0; x < w; x++) {
      const lon = (x / w) * Math.PI * 2;
      const px = cl * Math.cos(lon), pz = cl * Math.sin(lon);
      let c;

      if (type === "gas") {
        const warp = fbm(px * 1.6 + 3, py * 1.6, pz * 1.6, seed, 4);
        const band = Math.sin(py * bandFreq + warp * 5.5) * 0.5 + 0.5;
        const fine = fbm(px * 5, py * 22, pz * 5, seed + 7, 3);
        c = band < 0.5 ? mixc(dark, base, band * 2) : mixc(base, light, (band - 0.5) * 2);
        c = mixc(c, light, (fine - 0.5) * 0.45);
        const storm = fbm(px * 3, py * 3, pz * 3, seed + 99, 3);
        if (storm > 0.72) c = mixc(c, snow, smoothstep(0.72, 0.85, storm) * 0.55);
      } else if (type === "terra") {
        const n = fbm(px * 2.1, py * 2.1, pz * 2.1, seed, 5);
        const sea = 0.5;
        if (n > sea) {
          c = mixc(landA, landB, (n - sea) / (1 - sea) * 1.6);
        } else {
          c = mixc(deep, base, smoothstep(0.25, sea, n));
        }
        const pole = Math.abs(py);
        if (pole > 0.82) c = mixc(c, snow, smoothstep(0.82, 0.9, pole + (n - 0.5) * 0.12));
        const cloud = fbm(px * 3.2 + 9, py * 4.5, pz * 3.2, seed + 41, 4);
        c = mixc(c, snow, smoothstep(0.58, 0.78, cloud) * 0.7);
      } else if (type === "ice") {
        const n = fbm(px * 2.6, py * 2.6, pz * 2.6, seed, 5);
        const ridge = 1 - Math.abs(fbm(px * 6, py * 6, pz * 6, seed + 5, 3) * 2 - 1);
        c = mixc(light, snow, n * 0.9);
        c = mixc(c, base, smoothstep(0.86, 0.97, ridge) * 0.75);
      } else {
        const n = fbm(px * 3.2, py * 3.2, pz * 3.2, seed, 5);
        const ridge = 1 - Math.abs(fbm(px * 7, py * 7, pz * 7, seed + 3, 3) * 2 - 1);
        c = mixc(dark, light, n * 1.15 - 0.05);
        c = mixc(c, deep, smoothstep(0.9, 0.98, ridge) * 0.6);
        const crater = vnoise(px * 9, py * 9, pz * 9, seed + 77);
        if (crater > 0.84) c = mixc(c, deep, (crater - 0.84) * 3);
      }

      const i = (y * w + x) * 4;
      data[i] = Math.min(255, c[0] * 255);
      data[i + 1] = Math.min(255, c[1] * 255);
      data[i + 2] = Math.min(255, c[2] * 255);
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeGlowTexture(stops) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeNebulaTexture(seed) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x / size - 0.5, dy = y / size - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const n = fbm(x / 48, y / 48, seed * 0.37, seed, 5);
      const a = Math.max(0, 1 - r) ** 1.6 * smoothstep(0.35, 0.75, n);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}
