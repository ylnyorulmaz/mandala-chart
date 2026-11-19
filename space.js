/*
 * Mandala Space — the active map rendered as a solar system.
 *
 *   Goal    → the sun
 *   Driver  → planets on their own orbits
 *   Action  → moons circling their planet
 *   Step    → moonlets circling their moon
 *
 * Three.js renders the scene, pmndrs/postprocessing adds bloom, tone mapping,
 * vignette and a whisper of chromatic aberration, GSAP drives every camera
 * flight and appearance animation. All three are vendored locally (no CDN).
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  ToneMappingEffect,
  ToneMappingMode,
  ChromaticAberrationEffect
} from "postprocessing";

const gsap = window.gsap;
const Storage = window.MandalaStorage;

const STORAGE_KEY = "mandala-chart-state-v2";
const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MOTION = REDUCED_MOTION ? 0.35 : 1;

const KIND = {
  0: ["GOAL", "SUN"],
  1: ["DRIVER", "PLANET"],
  2: ["ACTION", "MOON"],
  3: ["STEP", "MOONLET"]
};
const CHILD_NOUN = { 0: "Planets", 1: "Moons", 2: "Moonlets", 3: "Moonlets" };
const DECISION_LABEL = { do: "Do", defer: "Later", delegate: "Hand off", delete: "Drop" };
const PALETTE = ["#ff8a5b", "#5ec8ff", "#b68bff", "#6ee7a8", "#ffd166", "#ff6fae", "#7aa2ff", "#4fd1c5"];
const PLANET_TYPES = ["gas", "terra", "ice", "gas", "rock", "terra", "gas", "ice"];

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ */
/* State                                                              */
/* ------------------------------------------------------------------ */

let renderer, composer, scene, camera, controls, clock;
let systemRoot = null;
let bodies = [];
let bodyById = new Map();
let hitMeshes = [];
let sunBody = null;
let systemRadius = 80;

let mapState = null;
let mapRecord = null;
let mode = "demo"; // "db" | "legacy" | "demo"
let mapsList = [];

let focused = null;
let hovered = null;
let following = false;
let flight = null;
const lastFollowPos = new THREE.Vector3();

const sim = { time: 0, scale: 1 };
let paused = false;
let labelsOn = true;
let lastInteraction = performance.now();
const view = { offsetX: 0, offsetY: 0 };

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
let pointerDirty = false;
let pointerDown = null;

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */

async function boot() {
  if (!gsap || !webglAvailable()) {
    showFallback();
    return;
  }

  setupRenderer();
  setupBackdrop();
  bindEvents();

  await loadMaps();
  buildSystem();
  renderMapPicker();

  renderer.setAnimationLoop(tick);
  intro();
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch (e) {
    return false;
  }
}

function showFallback() {
  $("spaceLoader").hidden = true;
  $("spaceLoader").style.display = "none";
  $("spaceFallback").hidden = false;
}

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

async function loadMaps() {
  const params = new URLSearchParams(location.search);
  const wanted = params.get("map");

  try {
    if (!Storage) throw new Error("no storage");
    await Storage.init();
    mapsList = (await Storage.listMaps()).filter((m) => m.state && m.state.rootId && m.state.nodes && m.state.nodes[m.state.rootId]);

    if (mapsList.length) {
      let id = wanted && mapsList.some((m) => m.id === wanted) ? wanted : await Storage.getActiveMapId();
      let record = mapsList.find((m) => m.id === id) || mapsList[0];
      useRecord(record);
      return;
    }
  } catch (e) {
    mapsList = [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.rootId && parsed.nodes && parsed.nodes[parsed.rootId]) {
      mode = "legacy";
      mapState = parsed;
      return;
    }
  } catch (e) { /* fall through to demo */ }

  mode = "demo";
  mapState = demoState();
  setTimeout(() => toast("Demo system — create a map in the 2D planner to see your own."), 3400 * MOTION);
}

function useRecord(record) {
  mode = "db";
  mapRecord = record;
  mapState = JSON.parse(JSON.stringify(record.state));
  $("flatLink").href = "index.html";
}

function demoState() {
  const nodes = {};
  let n = 0;
  const make = (title, parentId, depth, status) => {
    const id = "demo_" + (n++);
    nodes[id] = { id, title, parentId, depth, children: [], status: status || "open", impact: 3, effort: 3, decision: "do", notes: "", duration: "" };
    if (parentId) nodes[parentId].children.push(id);
    return id;
  };

  const root = make("Launch my first product", null, 0);
  const drivers = {
    "Product readiness": ["List launch blockers", "Test the main user flow", "Fix mobile issues", "Check performance"],
    "Offer & positioning": ["Write one clear promise", "Create one proof example", "Choose one target audience"],
    "Pricing & payment": ["Choose one simple price", "Set up payment link", "Run one real payment test"],
    "Ideal customer": ["Write ICP in one sentence", "Find 10 matching prospects", "Rank by relevance"],
    "Outreach": ["Write one short message", "Send to 5 prospects", "Follow up after 3 days", "Track replies"],
    "Launch content": ["Publish one demo", "Post in one relevant community"],
    "Measurement": ["Track clicks and replies", "Review what worked"],
    "": []
  };

  let k = 0;
  Object.keys(drivers).forEach((title) => {
    const d = make(title, root, 1, k === 2 ? "done" : "open");
    drivers[title].forEach((a, i) => {
      const id = make(a, d, 2, (i + k) % 3 === 0 ? "done" : (i === 1 ? "doing" : "open"));
      if (k === 0 && i === 1) {
        make("Sign up as a new user", id, 3, "done");
        make("Create first project", id, 3);
        make("Export the result", id, 3);
      }
    });
    k++;
  });

  return { rootId: root, nodes };
}

function nodeTitle(node) {
  return node && node.title && node.title.trim() ? node.title.trim() : "";
}

function filledChildren(node) {
  return (node.children || []).map((id) => mapState.nodes[id]).filter((c) => c && nodeTitle(c));
}

function leafStats(node) {
  let total = 0;
  let done = 0;
  const walk = (n) => {
    const kids = filledChildren(n);
    if (!kids.length) {
      if (n !== node && nodeTitle(n) && n.decision !== "delete") {
        total++;
        if (n.status === "done") done++;
      }
      return;
    }
    kids.forEach(walk);
  };
  walk(node);
  return { total, done };
}

/* ------------------------------------------------------------------ */
/* Renderer, camera, post-processing                                  */
/* ------------------------------------------------------------------ */

function setupRenderer() {
  const canvas = $("spaceCanvas");
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    stencil: false,
    depth: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color("#03040b");

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 6000);
  camera.position.set(0, 420, 1100);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.6;
  controls.minDistance = 1.2;
  controls.maxDistance = 900;
  controls.autoRotateSpeed = 0.18;
  controls.enabled = false;
  controls.addEventListener("start", () => {
    lastInteraction = performance.now();
    controls.autoRotate = false;
    fadeHint();
  });

  composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: Math.min(4, renderer.capabilities.maxSamples || 0)
  });
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    mipmapBlur: true,
    intensity: 1.35,
    luminanceThreshold: 0.62,
    luminanceSmoothing: 0.25,
    radius: 0.78
  });
  const tone = new ToneMappingEffect({
    mode: ToneMappingMode.AGX !== undefined ? ToneMappingMode.AGX : ToneMappingMode.ACES_FILMIC
  });
  const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
  const chroma = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0.00055, 0.00055),
    radialModulation: true,
    modulationOffset: 0.35
  });

  composer.addPass(new EffectPass(camera, bloom, tone, vignette));
  composer.addPass(new EffectPass(camera, chroma));

  clock = new THREE.Clock();

  scene.add(new THREE.AmbientLight("#7d86c8", 0.32));
  const fill = new THREE.HemisphereLight("#9fb4ff", "#1b1030", 0.18);
  scene.add(fill);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  applyViewOffset();
}

function applyViewOffset() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (Math.abs(view.offsetX) < 0.5 && Math.abs(view.offsetY) < 0.5) {
    camera.clearViewOffset();
  } else {
    camera.setViewOffset(w, h, view.offsetX, view.offsetY, w, h);
  }
  camera.updateProjectionMatrix();
}

function targetViewOffset(panelOpen) {
  if (!panelOpen) return { x: 0, y: 0 };
  if (window.innerWidth <= 640) return { x: 0, y: Math.round(window.innerHeight * 0.15) };
  const panel = $("planetPanel");
  const width = panel ? panel.offsetWidth || 360 : 360;
  return { x: Math.round((width + 24) / 2), y: 0 };
}

function tweenViewOffset(panelOpen) {
  const t = targetViewOffset(panelOpen);
  gsap.to(view, {
    offsetX: t.x,
    offsetY: t.y,
    duration: 1.1 * MOTION,
    ease: "power3.inOut",
    onUpdate: applyViewOffset
  });
}

/* ------------------------------------------------------------------ */
/* Procedural textures                                                */
/* ------------------------------------------------------------------ */

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

function makePlanetTexture(type, hex, seed, w, h) {
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

function makeGlowTexture(stops) {
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

function makeNebulaTexture(seed) {
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

/* ------------------------------------------------------------------ */
/* Shaders                                                            */
/* ------------------------------------------------------------------ */

const NOISE_GLSL = /* glsl */`
  float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
  float vn(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.02 + 17.1; a *= 0.5; } return s / 0.97; }
`;

function sunMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
      void main() {
        vPos = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
      ${NOISE_GLSL}
      void main() {
        vec3 p = normalize(vPos) * 2.4;
        float n1 = fbm(p + vec3(uTime * 0.04, uTime * 0.02, 0.0));
        float n2 = fbm(p * 2.6 - vec3(0.0, uTime * 0.07, uTime * 0.03) + n1 * 1.6);
        float t = clamp(n1 * 0.55 + n2 * 0.75 - 0.18, 0.0, 1.0);
        vec3 c = mix(vec3(0.95, 0.28, 0.04), vec3(1.0, 0.62, 0.16), t);
        c = mix(c, vec3(1.0, 0.92, 0.62), pow(t, 3.0) * 1.3);
        float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);
        c += vec3(1.0, 0.55, 0.18) * rim * 1.6;
        gl_FragColor = vec4(c * 2.6, 1.0);
      }`
  });
}

function atmosphereMaterial(hex, intensity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(hex) },
      uIntensity: { value: intensity },
      uSun: { value: new THREE.Vector3() }
    },
    vertexShader: /* glsl */`
      varying vec3 vNormal; varying vec3 vView; varying vec3 vWorldN; varying vec3 vWorldP;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorldN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldP = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uIntensity; uniform vec3 uSun;
      varying vec3 vNormal; varying vec3 vView; varying vec3 vWorldN; varying vec3 vWorldP;
      void main() {
        float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.0);
        float lit = 0.35 + 0.65 * smoothstep(-0.4, 0.6, dot(vWorldN, normalize(uSun - vWorldP)));
        gl_FragColor = vec4(uColor * rim * uIntensity * lit, rim * lit);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

function ringMaterial(inner, outer) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInner: { value: inner },
      uOuter: { value: outer },
      uColor: { value: new THREE.Color("#ffd166") },
      uOpacity: { value: 1 }
    },
    vertexShader: /* glsl */`
      varying vec3 vP;
      void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uInner; uniform float uOuter; uniform vec3 uColor; uniform float uOpacity;
      varying vec3 vP;
      void main() {
        float r = (length(vP.xy) - uInner) / (uOuter - uInner);
        float bands = 0.55 + 0.45 * sin(r * 46.0) * sin(r * 13.0 + 1.3);
        float edge = smoothstep(0.0, 0.12, r) * smoothstep(1.0, 0.75, r);
        float a = edge * (0.35 + 0.65 * bands) * uOpacity;
        gl_FragColor = vec4(uColor * (1.1 + bands * 0.9), a * 0.85);
      }`,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

function starMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aPhase; attribute vec3 aColor;
      uniform float uTime; uniform float uPixelRatio;
      varying vec3 vColor; varying float vTw;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uPixelRatio * (520.0 / -mv.z), 0.0, 24.0);
        vTw = 0.62 + 0.38 * sin(uTime * (0.6 + fract(aPhase) * 2.2) + aPhase * 6.28);
        vColor = aColor;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 1.8);
        gl_FragColor = vec4(vColor * vTw * 1.5, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

/* ------------------------------------------------------------------ */
/* Backdrop: stars + nebulae                                          */
/* ------------------------------------------------------------------ */

let starMat = null;

function setupBackdrop() {
  const count = window.innerWidth < 700 ? 4500 : 8000;
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const color = new Float32Array(count * 3);
  const tints = [new THREE.Color("#ffffff"), new THREE.Color("#cfe0ff"), new THREE.Color("#ffe6c4"), new THREE.Color("#ffd0e6"), new THREE.Color("#b9c8ff")];

  for (let i = 0; i < count; i++) {
    const r = 1300 + Math.random() * 1800;
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    // a faint galactic band: squash a share of stars toward a tilted plane
    let y = u;
    if (i % 3 === 0) y *= 0.18;
    pos[i * 3] = r * s * Math.cos(th);
    pos[i * 3 + 1] = r * y;
    pos[i * 3 + 2] = r * s * Math.sin(th);
    size[i] = Math.random() < 0.04 ? 9 + Math.random() * 7 : 2.2 + Math.random() * 4.2;
    phase[i] = Math.random() * 10;
    const t = tints[(Math.random() * tints.length) | 0];
    const b = 0.45 + Math.random() * 0.55;
    color[i * 3] = t.r * b;
    color[i * 3 + 1] = t.g * b;
    color[i * 3 + 2] = t.b * b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  starMat = starMaterial();
  const stars = new THREE.Points(geo, starMat);
  stars.rotation.z = 0.35;
  stars.frustumCulled = false;
  scene.add(stars);

  const nebulae = [
    ["#6a3cff", [-1500, 420, -2000], 1700, 0.34],
    ["#ff4f8b", [1800, -260, -1500], 1500, 0.26],
    ["#2aa9ff", [500, 900, 2100], 1800, 0.22],
    ["#ff9a3c", [-2100, -520, 900], 1300, 0.18],
    ["#3cffc8", [1400, 600, 1500], 1100, 0.14]
  ];
  nebulae.forEach(([hex, p, s, o], i) => {
    const mat = new THREE.SpriteMaterial({
      map: makeNebulaTexture(11 + i * 7),
      color: new THREE.Color(hex),
      transparent: true,
      opacity: o,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(p[0], p[1], p[2]);
    sprite.scale.set(s, s, 1);
    sprite.material.rotation = i * 1.3;
    scene.add(sprite);
  });
}

/* ------------------------------------------------------------------ */
/* System construction                                                */
/* ------------------------------------------------------------------ */

const sharedGeo = {
  sphereHi: new THREE.SphereGeometry(1, 96, 64),
  sphereMid: new THREE.SphereGeometry(1, 48, 32),
  sphereLo: new THREE.SphereGeometry(1, 24, 16),
  ghost: new THREE.IcosahedronGeometry(1, 2),
  hit: new THREE.SphereGeometry(1, 12, 8)
};
const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });

function bodyRadius(node, depth) {
  const kids = filledChildren(node).length;
  const empty = !nodeTitle(node);
  if (depth === 0) return 6;
  if (depth === 1) return empty ? 1.1 : 1.45 + Math.min(kids, 10) * 0.11;
  if (depth === 2) return empty ? 0.32 : 0.46 + Math.min(kids, 8) * 0.025;
  if (depth === 3) return empty ? 0.1 : 0.17;
  return 0.08;
}

function childRingRadius(body) {
  if (body.depth === 1) return body.radius + 2.5;
  if (body.depth === 2) return body.radius + 0.75;
  return body.radius + 0.32;
}

function circleLine(radius, hex, opacity, segments) {
  const pts = [];
  const n = segments || 192;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity, depthWrite: false });
  const line = new THREE.LineLoop(geo, mat);
  line.userData.baseOpacity = opacity;
  return line;
}

function buildSystem() {
  systemRoot = new THREE.Group();
  scene.add(systemRoot);
  bodies = [];
  bodyById = new Map();
  hitMeshes = [];
  $("spaceLabels").innerHTML = "";

  const root = mapState.nodes[mapState.rootId];
  sunBody = makeSun(root);

  const drivers = (root.children || []).map((id) => mapState.nodes[id]).filter(Boolean);
  const startR = 24;
  const gap = drivers.length > 8 ? 8 : 9.5;
  const offset = hashString(mapState.rootId) * Math.PI * 2;

  drivers.forEach((node, i) => {
    const R = startR + i * gap;
    const hex = PALETTE[i % PALETTE.length];
    const orbit = new THREE.Group();
    orbit.rotation.x = (hashString(node.id + "x") - 0.5) * 0.12;
    orbit.rotation.z = (hashString(node.id + "z") - 0.5) * 0.12;
    sunBody.anchor.add(orbit);

    const line = circleLine(R, hex, nodeTitle(node) ? 0.2 : 0.08);
    orbit.add(line);

    const body = makeBody(node, 1, sunBody, orbit, {
      orbitRadius: R,
      phase: offset + (i / Math.max(drivers.length, 1)) * Math.PI * 2,
      speed: 0.11 * Math.pow(startR / R, 1.5),
      hex,
      typeIndex: i,
      line
    });
    buildChildren(body);
  });

  systemRadius = startR + Math.max(drivers.length - 1, 0) * gap + 6;
  addDustBelt(systemRadius + 12);
  renderSystemIndex();
}

function buildChildren(parent) {
  const kids = (parent.node.children || []).map((id) => mapState.nodes[id]).filter(Boolean);
  if (!kids.length) return;

  const ringR = childRingRadius(parent);
  const orbit = new THREE.Group();
  orbit.rotation.x = 0.18 + (hashString(parent.node.id) - 0.5) * 0.3;
  orbit.rotation.z = (hashString(parent.node.id + "r") - 0.5) * 0.4;
  parent.anchor.add(orbit);
  parent.childOrbit = orbit;

  const line = circleLine(ringR, parent.hex, 0.07, parent.depth === 1 ? 128 : 64);
  orbit.add(line);
  parent.childLine = line;

  const speed = parent.depth === 1 ? 0.32 : 0.7;
  kids.forEach((node, j) => {
    const hex = "#" + new THREE.Color(parent.hex).offsetHSL((j % 3 - 1) * 0.025, -0.12, (j % 2 ? 0.08 : -0.02)).getHexString();
    const body = makeBody(node, parent.depth + 1, parent, orbit, {
      orbitRadius: ringR,
      phase: (j / kids.length) * Math.PI * 2,
      speed,
      hex,
      typeIndex: j
    });
    buildChildren(body);
  });
}

function makeSun(node) {
  const anchor = new THREE.Group();
  systemRoot.add(anchor);

  const mesh = new THREE.Mesh(sharedGeo.sphereHi, sunMaterial());
  mesh.scale.setScalar(6);
  anchor.add(mesh);

  const corona = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture([[0, "rgba(255,220,150,1)"], [0.18, "rgba(255,170,80,.55)"], [0.45, "rgba(255,110,40,.14)"], [1, "rgba(255,80,20,0)"]]),
    color: new THREE.Color(2.2, 1.6, 1.1),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  corona.scale.setScalar(6 * 4.6);
  anchor.add(corona);

  const light = new THREE.PointLight("#fff2de", 5.2, 0, 0);
  anchor.add(light);

  const hit = new THREE.Mesh(sharedGeo.hit, hitMaterial);
  hit.scale.setScalar(6.4);
  anchor.add(hit);

  const body = {
    node, depth: 0, radius: 6, anchor, mesh, hit, corona,
    hex: "#ffb347", children: [], parent: null,
    pivot: null, phase: 0, speed: 0, spin: 0.02
  };
  hit.userData.body = body;
  hitMeshes.push(hit);
  bodies.push(body);
  bodyById.set(node.id, body);
  body.label = makeLabel(body);
  return body;
}

function makeBody(node, depth, parent, orbitGroup, opts) {
  const empty = !nodeTitle(node);
  const radius = bodyRadius(node, depth);
  const pivot = new THREE.Group();
  orbitGroup.add(pivot);
  const anchor = new THREE.Group();
  anchor.position.x = opts.orbitRadius;
  pivot.add(anchor);

  let mesh;
  if (empty) {
    mesh = new THREE.Mesh(sharedGeo.ghost, new THREE.MeshBasicMaterial({
      color: new THREE.Color(opts.hex),
      wireframe: true,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    }));
  } else {
    const seed = Math.floor(hashString(node.id) * 100000);
    let type, w, h;
    if (depth === 1) {
      type = PLANET_TYPES[opts.typeIndex % PLANET_TYPES.length];
      w = 384; h = 192;
    } else if (depth === 2) {
      type = opts.typeIndex % 3 === 2 ? "ice" : "rock";
      w = 160; h = 80;
    } else {
      type = "rock";
      w = 64; h = 32;
    }
    const map = makePlanetTexture(type, opts.hex, seed, w, h);
    mesh = new THREE.Mesh(depth === 1 ? sharedGeo.sphereHi : depth === 2 ? sharedGeo.sphereMid : sharedGeo.sphereLo,
      new THREE.MeshStandardMaterial({
        map,
        roughness: type === "ice" ? 0.55 : 0.88,
        metalness: 0,
        emissive: new THREE.Color(opts.hex),
        emissiveIntensity: 0.04
      }));
  }
  mesh.scale.setScalar(radius);
  mesh.rotation.z = (hashString(node.id + "t") - 0.5) * 0.6;
  anchor.add(mesh);

  let atmo = null;
  if (!empty && depth <= 2) {
    atmo = new THREE.Mesh(depth === 1 ? sharedGeo.sphereMid : sharedGeo.sphereLo, atmosphereMaterial(opts.hex, depth === 1 ? 1.9 : 1.3));
    atmo.scale.setScalar(radius * (depth === 1 ? 1.07 : 1.1));
    anchor.add(atmo);
  }

  const hit = new THREE.Mesh(sharedGeo.hit, hitMaterial);
  hit.scale.setScalar(Math.max(radius * 1.35, depth >= 3 ? 0.3 : 0.55));
  anchor.add(hit);

  const body = {
    node, depth, radius, anchor, mesh, atmo, hit, pivot,
    hex: opts.hex,
    parent,
    children: [],
    phase: opts.phase,
    speed: opts.speed,
    spin: 0.12 + hashString(node.id + "s") * 0.25,
    orbitRadius: opts.orbitRadius,
    line: opts.line || null,
    ring: null,
    empty
  };
  pivot.rotation.y = body.phase;

  hit.userData.body = body;
  hitMeshes.push(hit);
  parent.children.push(body);
  bodies.push(body);
  bodyById.set(node.id, body);

  if (node.status === "done" && !empty) addRing(body, false);
  body.label = makeLabel(body);
  return body;
}

function addRing(body, animate) {
  if (body.ring) return;
  const inner = body.radius * 1.45;
  const outer = body.radius * (body.depth === 1 ? 2.25 : 2.0);
  const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128, 1), ringMaterial(inner, outer));
  ring.rotation.x = -Math.PI / 2 + 0.38;
  ring.rotation.y = 0.2;
  body.anchor.add(ring);
  body.ring = ring;
  if (animate) {
    ring.scale.setScalar(0.01);
    gsap.to(ring.scale, { x: 1, y: 1, z: 1, duration: 1.4 * MOTION, ease: "elastic.out(1, 0.55)" });
  }
}

function removeRing(body) {
  const ring = body.ring;
  if (!ring) return;
  body.ring = null;
  gsap.to(ring.scale, {
    x: 0.01, y: 0.01, z: 0.01,
    duration: 0.5 * MOTION,
    ease: "power2.in",
    onComplete: () => {
      ring.parent && ring.parent.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
    }
  });
}

function addDustBelt(radius) {
  const count = 2600;
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const color = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = radius + (Math.random() - 0.5) * 12 + (Math.random() - 0.5) * 6;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 2.2;
    pos[i * 3 + 2] = Math.sin(a) * r;
    size[i] = 0.12 + Math.random() * 0.35;
    phase[i] = Math.random() * 10;
    const b = 0.25 + Math.random() * 0.35;
    color[i * 3] = 0.75 * b;
    color[i * 3 + 1] = 0.8 * b;
    color[i * 3 + 2] = 1.0 * b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  const belt = new THREE.Points(geo, starMat);
  belt.userData.belt = true;
  belt.rotation.x = 0.04;
  systemRoot.add(belt);
  systemRoot.userData.belt = belt;
}

function disposeSystem() {
  if (!systemRoot) return;
  const sharedGeos = new Set(Object.values(sharedGeo));
  systemRoot.traverse((obj) => {
    if (obj.geometry && !sharedGeos.has(obj.geometry)) obj.geometry.dispose();
    if (obj.material && obj.material !== hitMaterial && obj.material !== starMat) {
      const m = obj.material;
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
  scene.remove(systemRoot);
  systemRoot = null;
  $("spaceLabels").innerHTML = "";
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------ */
/* Labels                                                             */
/* ------------------------------------------------------------------ */

function makeLabel(body) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "label-chip depth-" + Math.min(body.depth, 3) + (body.depth === 0 ? " sun" : "");
  el.style.setProperty("--dot", body.hex);
  el.dataset.id = body.node.id;
  el.tabIndex = -1;
  el.innerHTML = "<i></i><span></span>";
  el.style.opacity = "0";
  el._opacity = 0;
  updateLabelText(body, el);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    focusBody(body);
  });
  el.addEventListener("pointerenter", () => setHovered(body));
  el.addEventListener("pointerleave", () => { if (hovered === body) setHovered(null); });
  $("spaceLabels").appendChild(el);
  return el;
}

function updateLabelText(body, el) {
  el = el || body.label;
  const title = nodeTitle(body.node);
  el.querySelector("span").textContent = title || (body.depth === 0 ? "Untitled goal" : "Empty slot");
  el.classList.toggle("empty", !title);
  el.classList.toggle("done", body.node.status === "done" && !!title);
  el.title = title || "";
}

function isAncestor(a, b) {
  // true if a is an ancestor of b (or equal)
  let cur = b;
  while (cur) {
    if (cur === a) return true;
    cur = cur.parent;
  }
  return false;
}

function labelVisibility(body, camDist) {
  if (body === hovered || body === focused) return 1;
  if (!labelsOn) return 0;
  if (body.depth === 0) return focused && focused.depth >= 2 ? 0 : 1;

  if (body.depth === 1) {
    if (!focused || focused === sunBody) return body.empty ? 0.4 : 1;
    if (isAncestor(body, focused)) return 0.9;
    return focused.depth === 1 ? 0.55 : 0.25;
  }

  // moons and moonlets: only around the current focus
  if (!focused) return camDist < 26 && !body.empty ? 0.8 : 0;
  if (body.parent === focused) return body.empty ? 0.5 : 1;
  if (body.parent === focused.parent && focused.depth === body.depth) return body.empty ? 0.35 : 0.75;
  if (body.depth === 2 && isAncestor(body.parent, focused)) return 0.6;
  return 0;
}

function updateLabels() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const camPos = camera.position;

  for (const body of bodies) {
    const el = body.label;
    body.anchor.getWorldPosition(tmpV);
    const dist = tmpV.distanceTo(camPos);
    let target = labelVisibility(body, dist) * (body._appear === undefined ? 1 : body._appear);

    tmpV2.copy(tmpV);
    tmpV2.y += body.radius * (body.depth === 0 ? 1.15 : 1.35);
    tmpV2.project(camera);

    if (tmpV2.z > 1 || tmpV2.z < -1) target = 0;

    // keep labels from piling up at the sun when far away
    if (body.depth >= 2 && dist > 60) target = Math.min(target, body === hovered || body === focused ? 1 : 0);

    el._opacity += (target - el._opacity) * 0.18;
    if (Math.abs(el._opacity - target) < 0.01) el._opacity = target;

    if (el._opacity <= 0.01) {
      if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
      continue;
    }

    const x = (tmpV2.x * 0.5 + 0.5) * w;
    const y = (-tmpV2.y * 0.5 + 0.5) * h;
    if (el.style.visibility !== "visible") el.style.visibility = "visible";
    el.style.opacity = el._opacity.toFixed(3);
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    el.style.zIndex = String(1000 - Math.round(dist));
  }
}

/* ------------------------------------------------------------------ */
/* Animation loop                                                     */
/* ------------------------------------------------------------------ */

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  const rate = paused ? 0 : sim.scale;
  sim.time += dt * rate;

  for (const body of bodies) {
    if (body.pivot) body.pivot.rotation.y = body.phase + sim.time * body.speed;
    body.mesh.rotation.y += dt * body.spin * (paused ? 0.15 : 1);
    if (body.atmo) {
      const u = body.atmo.material.uniforms;
      sunBody.anchor.getWorldPosition(u.uSun.value);
      let target = body.depth === 1 ? 1.9 : 1.3;
      if (body.node.status === "doing") target *= 1.25 + Math.sin(elapsed * 3) * 0.35;
      if (body === hovered || body === focused) target *= 1.6;
      u.uIntensity.value += (target - u.uIntensity.value) * 0.12;
    }
    if (body.ring) body.ring.rotation.z += dt * 0.05;
  }

  if (sunBody) {
    sunBody.mesh.material.uniforms.uTime.value = elapsed;
    sunBody.corona.material.rotation = elapsed * 0.01;
    const pulse = 1 + Math.sin(elapsed * 0.9) * 0.025;
    sunBody.corona.scale.setScalar(6 * 4.6 * pulse);
  }
  if (systemRoot && systemRoot.userData.belt) systemRoot.userData.belt.rotation.y += dt * 0.004 * (paused ? 0 : sim.scale);
  if (starMat) starMat.uniforms.uTime.value = elapsed;

  updateLineHighlights();

  if (flight) {
    flight.update();
  } else {
    if (following && focused) {
      focused.anchor.getWorldPosition(tmpV);
      tmpV2.subVectors(tmpV, lastFollowPos);
      camera.position.add(tmpV2);
      controls.target.add(tmpV2);
      lastFollowPos.copy(tmpV);
    }
    if (!focused && !REDUCED_MOTION && performance.now() - lastInteraction > 7000) {
      controls.autoRotate = true;
    }
    controls.update();
  }

  if (pointerDirty) {
    pointerDirty = false;
    pick();
  }

  composer.render(dt);
  updateLabels();
}

function updateLineHighlights() {
  for (const body of bodies) {
    if (body.line) {
      const on = body === hovered || (focused && isAncestor(body, focused));
      const target = on ? 0.6 : body.line.userData.baseOpacity;
      const m = body.line.material;
      m.opacity += (target - m.opacity) * 0.1;
    }
    if (body.childLine) {
      const on = focused && (focused === body || focused.parent === body);
      const target = on ? 0.35 : body.childLine.userData.baseOpacity;
      const m = body.childLine.material;
      m.opacity += (target - m.opacity) * 0.1;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Camera flights                                                     */
/* ------------------------------------------------------------------ */

function viewDistance(body) {
  let extent = body.radius * 1.6;
  if (body.children.length) {
    const maxChild = Math.max(...body.children.map((c) => c.radius));
    extent = childRingRadius(body) + maxChild * 1.6;
  }
  if (body.ring) extent = Math.max(extent, body.radius * 2.4);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let dist = extent / Math.tan(fov / 2);
  if (camera.aspect < 1) dist /= Math.max(camera.aspect, 0.5) * 1.05;
  return Math.max(dist * 1.08, body.radius * 3.2);
}

function overviewOffset() {
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let dist = (systemRadius + 6) / Math.tan(fov / 2) * 0.82;
  const portrait = camera.aspect < 1;
  if (portrait) dist /= Math.max(camera.aspect, 0.45) * 1.08;
  const dir = tmpV.subVectors(camera.position, controls.target).setY(0);
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
  dir.normalize();
  // portrait screens look from higher up so the orbits read as circles
  return new THREE.Vector3(dir.x * 0.86, portrait ? 1.35 : 0.5, dir.z * 0.86).normalize().multiplyScalar(dist);
}

function startFlight(getTarget, getCamera, duration, onDone) {
  if (flight && flight.tween) flight.tween.kill();
  controls.enabled = false;
  controls.autoRotate = false;
  following = false;

  const startCam = camera.position.clone();
  const startTarget = controls.target.clone();
  const proxy = { t: 0 };
  const endTarget = new THREE.Vector3();
  const endCam = new THREE.Vector3();

  const f = {
    update() {
      const t = proxy.t;
      getTarget(endTarget);
      getCamera(endCam, endTarget);
      controls.target.lerpVectors(startTarget, endTarget, t);
      camera.position.lerpVectors(startCam, endCam, t);
      // swoop: lift the path so it never cuts through the sun
      const lift = Math.sin(Math.PI * t) * Math.min(startCam.distanceTo(endCam) * 0.22, 60);
      camera.position.y += lift;
      camera.lookAt(controls.target);
    }
  };
  f.tween = gsap.to(proxy, {
    t: 1,
    duration: duration * MOTION,
    ease: "power3.inOut",
    onComplete() {
      f.update();
      flight = null;
      controls.enabled = true;
      controls.update();
      if (onDone) onDone();
    }
  });
  flight = f;
}

function focusBody(body) {
  if (!body) return goOverview();
  lastInteraction = performance.now();
  fadeHint();

  if (body.depth === 0) {
    goOverview(true);
    return;
  }

  focused = body;
  showPanel(body);
  gsap.to(sim, { scale: 0.12, duration: 1.2 * MOTION, ease: "power2.out" });

  const dist = viewDistance(body);
  const viewDir = new THREE.Vector3();
  {
    body.anchor.getWorldPosition(tmpV);
    const outward = tmpV.clone().setY(0);
    if (outward.lengthSq() < 1e-4) outward.set(0, 0, 1);
    outward.normalize();
    // three-quarter view from the sunlit side: tangent to the orbit, a bit
    // sunward and above, on whichever side the camera already is
    const tangent = new THREE.Vector3(-outward.z, 0, outward.x);
    const current = camera.position.clone().sub(tmpV);
    if (current.dot(tangent) < 0) tangent.negate();
    viewDir.copy(tangent).multiplyScalar(0.85).addScaledVector(outward, -0.4);
    viewDir.y = 0.55;
    viewDir.normalize();
  }

  const travel = camera.position.distanceTo(body.anchor.getWorldPosition(tmpV));
  const duration = THREE.MathUtils.clamp(1.1 + travel / 140, 1.3, 2.6);

  startFlight(
    (out) => body.anchor.getWorldPosition(out),
    (out, target) => out.copy(target).addScaledVector(viewDir, dist),
    duration,
    () => {
      following = true;
      body.anchor.getWorldPosition(lastFollowPos);
    }
  );
}

function goOverview(withSunPanel) {
  lastInteraction = performance.now();
  const off = overviewOffset();
  focused = withSunPanel ? sunBody : null;
  if (withSunPanel) showPanel(sunBody);
  else hidePanel();
  gsap.to(sim, { scale: withSunPanel ? 0.5 : 1, duration: 1.4 * MOTION, ease: "power2.inOut" });

  startFlight(
    (out) => out.set(0, 0, 0),
    (out) => out.copy(off),
    1.9,
    () => { following = false; }
  );
}

function intro() {
  const loader = $("spaceLoader");
  gsap.to(loader, {
    autoAlpha: 0,
    duration: 0.9,
    delay: 0.15,
    onComplete: () => { loader.style.display = "none"; }
  });

  appear(2.8);

  const off = overviewOffset();
  camera.position.set(off.x * 4.5, off.y * 5 + 260, off.z * 4.5);
  controls.target.set(0, 0, 0);
  camera.lookAt(0, 0, 0);
  startFlight((o) => o.set(0, 0, 0), (o) => o.copy(off), 3.6, () => {});

  setTimeout(fadeHint, 9000);
}

function appear(totalDelay) {
  const d = MOTION;
  for (const body of bodies) body._appear = 0;

  gsap.fromTo(sunBody.mesh.scale, { x: 0.5, y: 0.5, z: 0.5 }, { x: 6, y: 6, z: 6, duration: 2.2 * d, ease: "elastic.out(1, 0.6)" });
  gsap.fromTo(sunBody.corona.material, { opacity: 0 }, { opacity: 1, duration: 2 * d });
  gsap.to(sunBody, { _appear: 1, duration: 0.8, delay: 1.2 * d });

  const planets = bodies.filter((b) => b.depth === 1);
  planets.forEach((body, i) => {
    const delay = (0.6 + i * 0.16) * d;
    const finalScale = body.mesh.scale.x;
    body.anchor.scale.setScalar(0.001);
    gsap.to(body.anchor.scale, { x: 1, y: 1, z: 1, duration: 1.3 * d, delay, ease: "back.out(1.8)" });
    gsap.to(body, { _appear: 1, duration: 0.6, delay: delay + 0.8 * d });
    if (body.line) {
      const m = body.line.material;
      const base = body.line.userData.baseOpacity;
      m.opacity = 0;
      gsap.to(m, { opacity: base, duration: 1.4 * d, delay });
    }
    void finalScale;
  });

  for (const body of bodies) {
    if (body.depth >= 2) gsap.to(body, { _appear: 1, duration: 0.6, delay: totalDelay * d });
  }
}

/* ------------------------------------------------------------------ */
/* Picking                                                            */
/* ------------------------------------------------------------------ */

function pick() {
  if (pointer.x < -1.5) {
    setHovered(null);
    return;
  }
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(hitMeshes, false);
  let best = null;
  for (const hit of hits) {
    const body = hit.object.userData.body;
    if (!body) continue;
    if (body.depth >= 2 && !labelEligible(body)) continue;
    // prefer the smallest body along the ray when hits overlap (moons in front of planets)
    if (!best || body.depth > best.depth && hit.distance - hits[0].distance < body.radius * 4) best = body;
  }
  setHovered(best);
}

function labelEligible(body) {
  // tiny bodies only become clickable when the camera is close enough to see them
  body.anchor.getWorldPosition(tmpV);
  const d = tmpV.distanceTo(camera.position);
  return d < (body.depth === 2 ? 70 : 18);
}

function setHovered(body) {
  if (hovered === body) return;
  if (hovered && hovered.label) hovered.label.classList.remove("is-hover");
  hovered = body;
  if (body && body.label) body.label.classList.add("is-hover");
  document.body.classList.toggle("hovering", !!body);
}

/* ------------------------------------------------------------------ */
/* Panel + index                                                      */
/* ------------------------------------------------------------------ */

function pathOf(body) {
  const parts = [];
  let cur = body.parent;
  while (cur) {
    parts.unshift(nodeTitle(cur.node) || (cur.depth === 0 ? "Untitled goal" : "Empty slot"));
    cur = cur.parent;
  }
  return parts.join("  ›  ");
}

function showPanel(body) {
  const panel = $("planetPanel");
  const node = body.node;
  const title = nodeTitle(node);
  const kind = KIND[Math.min(body.depth, 3)];

  panel.style.setProperty("--dot", body.hex);
  $("panelKind").textContent = kind[0] + " · " + kind[1];
  const status = title ? (node.status || "open") : "empty";
  const statusEl = $("panelStatus");
  statusEl.textContent = { open: "Open", doing: "Doing", done: "Cleared", empty: "Empty" }[status] || status;
  statusEl.className = "panel-status " + status;

  const h1 = $("panelTitle");
  h1.textContent = title || (body.depth === 0 ? "Untitled goal" : "Empty slot — name it in the 2D map");
  h1.classList.toggle("empty", !title);
  $("panelPath").textContent = pathOf(body);

  const stats = leafStats(node);
  const progress = $("panelProgress");
  if (stats.total) {
    const pct = Math.round((stats.done / stats.total) * 100);
    progress.hidden = false;
    $("panelProgressValue").textContent = pct + "%  ·  " + stats.done + "/" + stats.total;
    requestAnimationFrame(() => { $("panelProgressFill").style.width = pct + "%"; });
  } else {
    progress.hidden = true;
  }

  const meta = $("panelMeta");
  meta.innerHTML = "";
  if (title) {
    const cells = [
      ["Impact", (node.impact || 3) + "/5"],
      ["Effort", (node.effort || 3) + "/5"],
      ["Decision", DECISION_LABEL[node.decision] || "Do"]
    ];
    if (node.duration) cells.push(["Estimate", node.duration + " min"]);
    if (node.decision === "delegate" && node.delegatedTo) cells.push(["Hand off to", node.delegatedTo]);
    if (node.decision === "defer" && node.deferUntil) cells.push(["Back on", node.deferUntil]);
    if (node.dependencyId && mapState.nodes[node.dependencyId]) cells.push(["Blocked by", nodeTitle(mapState.nodes[node.dependencyId]) || "—"]);
    cells.forEach(([k, v]) => {
      const div = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = k;
      dd.textContent = v;
      div.append(dt, dd);
      meta.appendChild(div);
    });
  }

  const notes = $("panelNotes");
  if (node.notes && node.notes.trim()) {
    notes.hidden = false;
    notes.textContent = node.notes.trim();
  } else {
    notes.hidden = true;
  }

  const list = $("panelChildren");
  list.innerHTML = "";
  const filled = body.children.filter((c) => !c.empty);
  const emptyCount = body.children.length - filled.length;
  $("panelChildrenWrap").hidden = !body.children.length;
  $("panelChildrenHead").textContent = CHILD_NOUN[Math.min(body.depth, 3)] + " · " + filled.length + (emptyCount ? "  (+" + emptyCount + " empty)" : "");
  filled.forEach((child) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "moon-chip" + (child.node.status === "done" ? " done" : "");
    btn.style.setProperty("--dot", child.hex);
    const i = document.createElement("i");
    const span = document.createElement("span");
    span.textContent = nodeTitle(child.node);
    btn.append(i, span);
    const s = leafStats(child.node);
    if (s.total) {
      const small = document.createElement("small");
      small.textContent = s.done + "/" + s.total;
      btn.appendChild(small);
    }
    btn.addEventListener("click", () => focusBody(child));
    list.appendChild(btn);
  });

  $("parentButton").disabled = !body.parent;
  const doneBtn = $("doneButton");
  doneBtn.disabled = !title;
  const isDone = node.status === "done";
  doneBtn.textContent = isDone ? "Reopen" : "Clear it ✓";
  doneBtn.classList.toggle("is-done", isDone);

  for (const b of bodies) b.label.classList.toggle("is-focus", b === body);
  renderSystemIndex();

  const wasHidden = panel.hidden;
  panel.hidden = false;
  if (wasHidden) {
    gsap.fromTo(panel,
      { autoAlpha: 0, x: window.innerWidth <= 640 ? 0 : 40, y: window.innerWidth <= 640 ? 40 : 0 },
      { autoAlpha: 1, x: 0, y: 0, duration: 0.7 * MOTION, ease: "power3.out", delay: 0.15 * MOTION });
    tweenViewOffset(true);
  } else {
    gsap.fromTo(panel.querySelectorAll("h1, .panel-breadcrumb, .panel-meta, .panel-children, .panel-progress"),
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.45 * MOTION, stagger: 0.04, ease: "power2.out" });
  }
}

function hidePanel() {
  const panel = $("planetPanel");
  for (const b of bodies) b.label.classList.remove("is-focus");
  renderSystemIndex();
  if (panel.hidden) return;
  gsap.to(panel, {
    autoAlpha: 0,
    x: window.innerWidth <= 640 ? 0 : 40,
    y: window.innerWidth <= 640 ? 40 : 0,
    duration: 0.45 * MOTION,
    ease: "power2.in",
    onComplete: () => { panel.hidden = true; }
  });
  tweenViewOffset(false);
}

function renderSystemIndex() {
  const nav = $("systemIndex");
  if (!sunBody) return;
  nav.innerHTML = "";
  const activeDriver = focused ? (focused.depth === 0 ? sunBody : ancestorAtDepth(focused, 1)) : null;

  const chip = (body) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "index-chip" + (body.depth === 0 ? " sun" : "") + (body === activeDriver ? " active" : "") + (body.node.status === "done" && !body.empty ? " done" : "");
    btn.style.setProperty("--dot", body.hex);
    const i = document.createElement("i");
    const span = document.createElement("span");
    span.textContent = nodeTitle(body.node) || (body.depth === 0 ? "Untitled goal" : "Empty slot");
    btn.append(i, span);
    btn.addEventListener("click", () => focusBody(body));
    btn.addEventListener("pointerenter", () => setHovered(body));
    btn.addEventListener("pointerleave", () => { if (hovered === body) setHovered(null); });
    nav.appendChild(btn);
  };

  chip(sunBody);
  sunBody.children.filter((b) => !b.empty).forEach(chip);
}

function ancestorAtDepth(body, depth) {
  let cur = body;
  while (cur && cur.depth > depth) cur = cur.parent;
  return cur;
}

/* ------------------------------------------------------------------ */
/* Done / reopen                                                      */
/* ------------------------------------------------------------------ */

async function toggleDone() {
  const body = focused;
  if (!body || !nodeTitle(body.node)) return;
  const node = body.node;
  node.status = node.status === "done" ? "open" : "done";

  if (node.status === "done") {
    if (body.depth > 0) addRing(body, true);
    burst(body);
    toast(body.depth === 0 ? "Goal reached ✦" : "Orbit cleared ✓");
  } else {
    removeRing(body);
  }

  updateLabelText(body);
  showPanel(body);
  await persistStatus(node);
}

async function persistStatus(node) {
  if (mode === "demo") return;

  if (mode === "legacy") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapState));
    } catch (e) { toast("Could not save on this device."); }
    return;
  }

  try {
    const record = await Storage.getMap(mapRecord.id);
    if (!record || !record.state || !record.state.nodes[node.id]) throw new Error("missing");
    record.state.nodes[node.id].status = node.status;
    record.updatedAt = Date.now();
    await Storage.saveMap(record);
    mapRecord = record;
  } catch (e) {
    toast("Could not save — open the 2D planner and try again.");
  }
}

function burst(body) {
  const count = 160;
  const pos = new Float32Array(count * 3);
  const vel = [];
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const color = new Float32Array(count * 3);
  const palette = [new THREE.Color("#ffd166"), new THREE.Color(body.hex), new THREE.Color("#ffffff"), new THREE.Color("#ff8a5b")];
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(0.6 + Math.random() * 1.4);
    vel.push(v);
    size[i] = 0.25 + Math.random() * 0.5;
    phase[i] = Math.random() * 10;
    const c = palette[i % palette.length];
    color[i * 3] = c.r * 2;
    color[i * 3 + 1] = c.g * 2;
    color[i * 3 + 2] = c.b * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  const points = new THREE.Points(geo, starMat);
  points.frustumCulled = false;
  body.anchor.add(points);

  const scale = body.radius * 3.2;
  const proxy = { p: 0 };
  gsap.to(proxy, {
    p: 1,
    duration: 1.6 * MOTION,
    ease: "power2.out",
    onUpdate() {
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i * 3] = vel[i].x * proxy.p * scale;
        arr[i * 3 + 1] = vel[i].y * proxy.p * scale;
        arr[i * 3 + 2] = vel[i].z * proxy.p * scale;
        size[i] *= 0.985;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
    onComplete() {
      body.anchor.remove(points);
      geo.dispose();
    }
  });

  gsap.fromTo(body.mesh.scale,
    { x: body.radius * 1.25, y: body.radius * 1.25, z: body.radius * 1.25 },
    { x: body.radius, y: body.radius, z: body.radius, duration: 0.9 * MOTION, ease: "elastic.out(1, 0.4)" });
}

/* ------------------------------------------------------------------ */
/* Map picker                                                         */
/* ------------------------------------------------------------------ */

function renderMapPicker() {
  const select = $("mapSelect");
  select.innerHTML = "";
  if (mode !== "db" || !mapsList.length) {
    const opt = document.createElement("option");
    opt.textContent = mode === "demo" ? "Demo system" : (nodeTitle(mapState.nodes[mapState.rootId]) || "This map");
    select.appendChild(opt);
    select.disabled = true;
    return;
  }
  mapsList.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.title || nodeTitle(m.state.nodes[m.state.rootId]) || "Untitled map";
    opt.selected = mapRecord && m.id === mapRecord.id;
    select.appendChild(opt);
  });
  select.disabled = mapsList.length < 2;
}

async function switchMap(id) {
  const record = mapsList.find((m) => m.id === id);
  if (!record) return;
  try {
    const fresh = await Storage.getMap(id);
    useRecord(fresh || record);
    await Storage.setActiveMapId(id);
  } catch (e) {
    useRecord(record);
  }
  const url = new URL(location.href);
  url.searchParams.set("map", id);
  history.replaceState(null, "", url);

  focused = null;
  hovered = null;
  hidePanel();
  disposeSystem();
  buildSystem();
  appear(1.6);
  goOverview(false);
}

/* ------------------------------------------------------------------ */
/* Events                                                             */
/* ------------------------------------------------------------------ */

function bindEvents() {
  window.addEventListener("resize", onResize);
  const canvas = renderer.domElement;

  canvas.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    pointerDirty = true;
  });
  canvas.addEventListener("pointerleave", () => {
    pointer.set(-10, -10);
    pointerDirty = true;
  });
  canvas.addEventListener("pointerdown", (e) => {
    pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
    lastInteraction = performance.now();
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!pointerDown) return;
    const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
    const quick = performance.now() - pointerDown.t < 450;
    pointerDown = null;
    if (moved > 6 || !quick) return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    pick();
    if (hovered) focusBody(hovered);
    if (e.pointerType !== "mouse") setTimeout(() => setHovered(null), 400);
  });
  canvas.addEventListener("dblclick", () => {
    if (!hovered) goOverview(false);
  });

  $("overviewButton").addEventListener("click", () => goOverview(false));
  $("panelClose").addEventListener("click", () => goOverview(false));
  $("parentButton").addEventListener("click", () => {
    if (focused && focused.parent) focusBody(focused.parent);
  });
  $("doneButton").addEventListener("click", toggleDone);
  $("pauseButton").addEventListener("click", togglePause);
  $("labelsButton").addEventListener("click", toggleLabels);
  $("mapSelect").addEventListener("change", (e) => switchMap(e.target.value));

  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === "Escape") {
      if (focused && focused.parent && focused.parent !== sunBody) focusBody(focused.parent);
      else goOverview(false);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      hopSibling(e.key === "ArrowRight" ? 1 : -1);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      if (focused && focused.parent) focusBody(focused.parent);
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      const base = focused || sunBody;
      const child = base.children.find((c) => !c.empty);
      if (child) focusBody(child);
      e.preventDefault();
    } else if (e.key === " ") {
      togglePause();
      e.preventDefault();
    } else if (e.key === "l" || e.key === "L") {
      toggleLabels();
    } else if ((e.key === "d" || e.key === "D") && focused) {
      toggleDone();
    }
  });
}

function hopSibling(dir) {
  const base = focused && focused !== sunBody ? focused : null;
  const siblings = base ? base.parent.children.filter((c) => !c.empty || c === base) : sunBody.children.filter((c) => !c.empty);
  if (!siblings.length) return;
  const idx = base ? siblings.indexOf(base) : (dir > 0 ? -1 : 0);
  const next = siblings[(idx + dir + siblings.length) % siblings.length];
  focusBody(next);
}

function togglePause() {
  paused = !paused;
  const btn = $("pauseButton");
  btn.setAttribute("aria-pressed", paused ? "true" : "false");
  btn.querySelector("span").textContent = paused ? "Play" : "Pause";
  btn.querySelector("svg").innerHTML = paused ? '<path d="M8 5l11 7-11 7z"/>' : '<path d="M8 5v14M16 5v14"/>';
}

function toggleLabels() {
  labelsOn = !labelsOn;
  $("labelsButton").setAttribute("aria-pressed", labelsOn ? "true" : "false");
}

let hintFaded = false;
function fadeHint() {
  if (hintFaded) return;
  hintFaded = true;
  $("spaceHint").classList.add("faded");
}

let toastTimer = null;
function toast(message) {
  const el = $("spaceToast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

/* Start once every module-level binding above is initialised. */
boot().catch((error) => {
  console.error(error);
  showFallback();
});
