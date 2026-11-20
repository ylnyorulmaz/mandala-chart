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
 *
 * Modules:
 *   space/model.js     — progress / decision / next-move rules (mirrors app.js)
 *   space/textures.js  — procedural planet, glow and nebula textures
 *   space/shaders.js   — sun, atmosphere, ring and point-sprite materials
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
import { makePlanetTexture, makeGlowTexture, makeNebulaTexture, hashString } from "./space/textures.js";
import { sunMaterial, atmosphereMaterial, ringMaterial, pointsMaterial } from "./space/shaders.js";
import * as model from "./space/model.js";

const gsap = window.gsap;
const Storage = window.MandalaStorage;

const STORAGE_KEY = "mandala-chart-state-v2";
const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const MOTION = REDUCED_MOTION ? 0.35 : 1;
const LOW_POWER = !!(window.matchMedia && window.matchMedia("(max-width: 700px)").matches) ||
  (navigator.hardwareConcurrency || 8) <= 4;

const KIND = {
  0: ["GOAL", "SUN"],
  1: ["DRIVER", "PLANET"],
  2: ["ACTION", "MOON"],
  3: ["STEP", "MOONLET"]
};
const CHILD_NOUN = { 0: "Planets", 1: "Moons", 2: "Moonlets", 3: "Moonlets" };
const DECISION_LABEL = { do: "Do", defer: "Later", delegate: "Hand off", delete: "Drop" };
const STATUS_LABEL = { open: "Open", doing: "Doing", done: "Cleared", empty: "Empty" };
const PALETTE = ["#ff8a5b", "#5ec8ff", "#b68bff", "#6ee7a8", "#ffd166", "#ff6fae", "#7aa2ff", "#4fd1c5"];
const PLANET_TYPES = ["gas", "terra", "ice", "gas", "rock", "terra", "gas", "ice"];

/* How decisions read in space: dropped work is a grey ghost, deferred work is
 * faded, handed-off work keeps its colour but gains a small blue courier. */
const LOOK = {
  drop: { opacity: 0.28, tint: "#6f6f7a", tag: "Dropped", atmo: 0 },
  later: { opacity: 0.6, tint: "#a9a9bd", tag: "Later", atmo: 0.4 },
  handoff: { opacity: 1, tint: "#ffffff", tag: "Handed off", atmo: 1 },
  inherited: { opacity: 0.55, tint: "#a0a0b4", tag: "", atmo: 0.4 }
};

const $ = (id) => document.getElementById(id);
const title = (node) => model.nodeTitle(node);

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
let buildGen = 0;
let textureQueue = [];
let depLinks = [];
let beacon = null;
let nextBody = null;

let mapState = null;
let mapRecord = null;
let mode = "demo"; // "db" | "legacy" | "demo"
let mapsList = [];
let deepNodeId = null;
let syncChannel = null;

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
let dpr = 1;
const perf = { frames: 0, since: performance.now(), settledAt: performance.now() + 7000 };

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
let pointerDirty = false;
let pointerDown = null;
let lastPointerType = "mouse";

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

let starMat = null;

const sharedGeo = {
  sphereHi: new THREE.SphereGeometry(1, 96, 64),
  sphereMid: new THREE.SphereGeometry(1, 48, 32),
  sphereLo: new THREE.SphereGeometry(1, 24, 16),
  ghost: new THREE.IcosahedronGeometry(1, 2),
  hit: new THREE.SphereGeometry(1, 12, 8)
};
const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });

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
  bindSync();

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
  $("spaceLoader").style.display = "none";
  $("spaceFallback").hidden = false;
}

/* ------------------------------------------------------------------ */
/* Data + sync with the 2D planner                                    */
/* ------------------------------------------------------------------ */

async function loadMaps() {
  const params = new URLSearchParams(location.search);
  const wanted = params.get("map");
  deepNodeId = params.get("node");

  try {
    if (!Storage) throw new Error("no storage");
    await Storage.init();
    mapsList = (await Storage.listMaps()).filter(isUsableRecord);

    if (mapsList.length) {
      const id = wanted && mapsList.some((m) => m.id === wanted) ? wanted : await Storage.getActiveMapId();
      useRecord(mapsList.find((m) => m.id === id) || mapsList[0]);
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
  mapState = model.demoState();
  setTimeout(() => toast("Demo system — create a map in the 2D planner to see your own."), 3400 * MOTION);
}

function isUsableRecord(record) {
  return !!(record && record.state && record.state.rootId && record.state.nodes && record.state.nodes[record.state.rootId]);
}

function useRecord(record) {
  mode = "db";
  mapRecord = record;
  mapState = JSON.parse(JSON.stringify(record.state));
  // keep the planner on the same map when the user goes back to 2D
  Storage.setActiveMapId(record.id).catch(() => {});
}

function bindSync() {
  if (!("BroadcastChannel" in window)) return;
  try {
    syncChannel = new BroadcastChannel("mandala-sync");
  } catch (e) {
    syncChannel = null;
    return;
  }
  syncChannel.onmessage = (event) => {
    const message = event.data || {};
    if (message.type === "map-saved" && mode === "db" && mapRecord && message.mapId === mapRecord.id) {
      scheduleRefresh();
    }
  };
}

let refreshTimer = null;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    try {
      const record = await Storage.getMap(mapRecord.id);
      if (isUsableRecord(record)) applyExternalRecord(record);
    } catch (e) { /* keep what we have */ }
  }, 250);
}

/** The planner saved this map: update in place when possible, rebuild otherwise. */
function applyExternalRecord(record) {
  const next = JSON.parse(JSON.stringify(record.state));
  mapRecord = record;
  const index = mapsList.findIndex((m) => m.id === record.id);
  if (index >= 0) mapsList[index] = record;
  renderMapPicker();

  if (model.structureSignature(next) !== model.structureSignature(mapState)) {
    rebuildPreservingFocus(next);
    return;
  }

  Object.keys(next.nodes).forEach((id) => {
    if (mapState.nodes[id]) Object.assign(mapState.nodes[id], next.nodes[id]);
  });

  for (const body of bodies) {
    applyLook(body);
    if (body.depth > 0 && !body.empty) {
      if (body.node.status === "done") addRing(body, true);
      else removeRing(body);
    }
  }
  afterDataChange();
  if (focused) showPanel(focused, { quiet: true });
}

function rebuildPreservingFocus(nextState) {
  const focusId = focused ? focused.node.id : null;
  const panelOpen = !!focused;
  cancelFlight();

  mapState = nextState;
  disposeSystem();
  buildSystem();
  updateOrbits();
  systemRoot.updateMatrixWorld(true);

  const body = focusId ? bodyById.get(focusId) : null;
  if (body && body !== sunBody) {
    focused = body;
    following = true;
    body.anchor.getWorldPosition(lastFollowPos);
    showPanel(body, { quiet: true });
  } else if (body === sunBody && panelOpen) {
    focused = sunBody;
    showPanel(sunBody, { quiet: true });
  } else {
    focused = null;
    hidePanel();
  }
  syncControlLimits();
}

function broadcastStatus(node) {
  if (!syncChannel || mode !== "db" || !mapRecord) return;
  try {
    syncChannel.postMessage({ type: "status", mapId: mapRecord.id, nodeId: node.id, status: node.status });
  } catch (e) { /* ignore */ }
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
    broadcastStatus(node);
  } catch (e) {
    toast("Could not save — open the 2D planner and try again.");
  }
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
  dpr = Math.min(window.devicePixelRatio || 1, LOW_POWER ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
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
  controls.minDistance = 9;
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
    multisampling: LOW_POWER ? 0 : Math.min(4, renderer.capabilities.maxSamples || 0)
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
  composer.addPass(new EffectPass(camera, bloom, tone, vignette));

  if (!REDUCED_MOTION) {
    composer.addPass(new EffectPass(camera, new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.00055, 0.00055),
      radialModulation: true,
      modulationOffset: 0.35
    })));
  }

  clock = new THREE.Clock();

  scene.add(new THREE.AmbientLight("#7d86c8", 0.32));
  scene.add(new THREE.HemisphereLight("#9fb4ff", "#1b1030", 0.18));
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  if (starMat) starMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  applyViewOffset();
}

/** Drop the pixel ratio in steps when the GPU cannot keep ~40 fps. */
function monitorPerformance(now) {
  perf.frames++;
  const span = now - perf.since;
  if (span < 2000) return;
  const fps = (perf.frames * 1000) / span;
  perf.frames = 0;
  perf.since = now;
  if (flight || document.hidden || now < perf.settledAt) return;
  if (fps < 40 && dpr > 1) {
    dpr = Math.max(1, Math.round((dpr - 0.25) * 100) / 100);
    renderer.setPixelRatio(dpr);
    composer.setSize(window.innerWidth, window.innerHeight);
    starMat.uniforms.uPixelRatio.value = dpr;
    perf.settledAt = now + 1500;
  }
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
/* Backdrop: stars + nebulae                                          */
/* ------------------------------------------------------------------ */

function pointCloud(count, fill) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const color = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) fill(i, pos, size, phase, color);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  return geo;
}

function setupBackdrop() {
  const tints = ["#ffffff", "#cfe0ff", "#ffe6c4", "#ffd0e6", "#b9c8ff"].map((c) => new THREE.Color(c));
  const geo = pointCloud(LOW_POWER ? 4500 : 8000, (i, pos, size, phase, color) => {
    const r = 1300 + Math.random() * 1800;
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const y = i % 3 === 0 ? u * 0.18 : u; // a faint galactic band
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
  });

  starMat = pointsMaterial(renderer.getPixelRatio());
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
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeNebulaTexture(11 + i * 7),
      color: new THREE.Color(hex),
      transparent: true,
      opacity: o,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    sprite.position.set(p[0], p[1], p[2]);
    sprite.scale.set(s, s, 1);
    sprite.material.rotation = i * 1.3;
    scene.add(sprite);
  });
}

/* ------------------------------------------------------------------ */
/* System construction                                                */
/* ------------------------------------------------------------------ */

function bodyRadius(node, depth) {
  const kids = model.filledChildren(mapState, node).length;
  const empty = !title(node);
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
  buildGen++;
  textureQueue = [];
  systemRoot = new THREE.Group();
  scene.add(systemRoot);
  bodies = [];
  bodyById = new Map();
  hitMeshes = [];
  depLinks = [];
  beacon = null;
  nextBody = null;
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

    const line = circleLine(R, hex, title(node) ? 0.2 : 0.08);
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

  for (const body of bodies) applyLook(body);
  afterDataChange();

  // textures are painted after the first frames, planets first, so nothing stalls
  textureQueue.sort((a, b) => a.body.depth - b.body.depth);
  setTimeout(pumpTextures, 60);
}

function buildChildren(parent) {
  const kids = (parent.node.children || []).map((id) => mapState.nodes[id]).filter(Boolean);
  if (!kids.length) return;

  const ringR = childRingRadius(parent);
  const orbit = new THREE.Group();
  orbit.rotation.x = 0.18 + (hashString(parent.node.id) - 0.5) * 0.3;
  orbit.rotation.z = (hashString(parent.node.id + "r") - 0.5) * 0.4;
  parent.anchor.add(orbit);

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

  anchor.add(new THREE.PointLight("#fff2de", 5.2, 0, 0));

  const hit = new THREE.Mesh(sharedGeo.hit, hitMaterial);
  hit.scale.setScalar(6.4);
  anchor.add(hit);

  const body = {
    node, depth: 0, radius: 6, anchor, mesh, hit, corona,
    hex: "#ffb347", children: [], parent: null,
    pivot: null, phase: 0, speed: 0, spin: 0.02, empty: false, atmoFactor: 1
  };
  registerBody(body);
  return body;
}

function makeBody(node, depth, parent, orbitGroup, opts) {
  const empty = !title(node);
  const radius = bodyRadius(node, depth);
  const pivot = new THREE.Group();
  orbitGroup.add(pivot);
  const anchor = new THREE.Group();
  anchor.position.x = opts.orbitRadius;
  pivot.add(anchor);

  const body = {
    node, depth, radius, anchor, pivot,
    hex: opts.hex,
    tint: new THREE.Color("#ffffff"),
    parent,
    children: [],
    phase: opts.phase,
    speed: opts.speed,
    spin: 0.12 + hashString(node.id + "s") * 0.25,
    orbitRadius: opts.orbitRadius,
    line: opts.line || null,
    ring: null,
    handoff: null,
    atmoFactor: 1,
    empty
  };

  if (empty) {
    body.mesh = new THREE.Mesh(sharedGeo.ghost, new THREE.MeshBasicMaterial({
      color: new THREE.Color(opts.hex),
      wireframe: true,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    }));
  } else {
    let type, w;
    if (depth === 1) {
      type = PLANET_TYPES[opts.typeIndex % PLANET_TYPES.length];
      w = LOW_POWER ? 256 : 384;
    } else if (depth === 2) {
      type = opts.typeIndex % 3 === 2 ? "ice" : "rock";
      w = LOW_POWER ? 112 : 160;
    } else {
      type = "rock";
      w = 64;
    }
    body.mesh = new THREE.Mesh(depth === 1 ? sharedGeo.sphereHi : depth === 2 ? sharedGeo.sphereMid : sharedGeo.sphereLo,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(opts.hex),
        roughness: type === "ice" ? 0.55 : 0.88,
        metalness: 0,
        emissive: new THREE.Color(opts.hex),
        emissiveIntensity: 0.04
      }));
    textureQueue.push({ gen: buildGen, body, type, w, h: w / 2, seed: Math.floor(hashString(node.id) * 100000) });
  }
  body.mesh.scale.setScalar(radius);
  body.mesh.rotation.z = (hashString(node.id + "t") - 0.5) * 0.6;
  anchor.add(body.mesh);

  if (!empty && depth <= 2) {
    body.atmo = new THREE.Mesh(depth === 1 ? sharedGeo.sphereMid : sharedGeo.sphereLo, atmosphereMaterial(opts.hex, depth === 1 ? 1.9 : 1.3));
    body.atmo.scale.setScalar(radius * (depth === 1 ? 1.07 : 1.1));
    anchor.add(body.atmo);
  }

  body.hit = new THREE.Mesh(sharedGeo.hit, hitMaterial);
  body.hit.scale.setScalar(Math.max(radius * 1.35, depth >= 3 ? 0.3 : 0.55));
  anchor.add(body.hit);

  pivot.rotation.y = body.phase;
  parent.children.push(body);
  registerBody(body);

  if (node.status === "done" && !empty) addRing(body, false);
  return body;
}

function registerBody(body) {
  body.hit.userData.body = body;
  hitMeshes.push(body.hit);
  bodies.push(body);
  bodyById.set(body.node.id, body);
  makeLabel(body);
}

function pumpTextures() {
  const start = performance.now();
  while (textureQueue.length && performance.now() - start < 10) {
    const job = textureQueue.shift();
    if (job.gen !== buildGen) continue;
    const material = job.body.mesh.material;
    material.map = makePlanetTexture(job.type, job.body.hex, job.seed, job.w, job.h);
    material.color.copy(job.body.tint);
    material.needsUpdate = true;
  }
  if (textureQueue.length) setTimeout(pumpTextures, 16);
}

/** Dim / tag a body according to its decision (Later, Hand off, Drop) or a suppressed ancestor. */
function applyLook(body) {
  if (body.depth === 0 || body.empty) return;
  const kind = model.suppressionOf(mapState, body.node);
  const look = kind ? LOOK[kind] : null;
  body.lookKind = kind;
  body.tint.set(look ? look.tint : "#ffffff");

  const material = body.mesh.material;
  if (material.map) material.color.copy(body.tint);
  else material.color.set(body.hex).multiply(body.tint);
  const opacity = look ? look.opacity : 1;
  material.transparent = opacity < 1;
  material.opacity = opacity;
  material.depthWrite = opacity >= 1;
  material.needsUpdate = true;
  body.atmoFactor = look ? look.atmo : 1;

  if (body.line) body.line.userData.baseOpacity = kind === "drop" ? 0.05 : (kind ? 0.12 : 0.2);

  if (kind === "handoff" && !body.handoff) addHandoff(body);
  if (kind !== "handoff" && body.handoff) {
    body.anchor.remove(body.handoff);
    body.handoff.traverse((o) => { if (o.material) o.material.dispose(); });
    body.handoff = null;
  }
}

function addHandoff(body) {
  const group = new THREE.Group();
  group.rotation.x = 0.7;
  const courier = new THREE.Mesh(sharedGeo.sphereLo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1.3, 2.6) }));
  courier.scale.setScalar(Math.max(body.radius * 0.16, 0.05));
  courier.position.x = body.radius * 1.75;
  group.add(courier);
  body.anchor.add(group);
  body.handoff = group;
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
      if (ring.parent) ring.parent.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
    }
  });
}

function addDustBelt(radius) {
  const geo = pointCloud(2600, (i, pos, size, phase, color) => {
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
  });
  const belt = new THREE.Points(geo, starMat);
  belt.rotation.x = 0.04;
  systemRoot.add(belt);
  systemRoot.userData.belt = belt;
}

function disposeSystem() {
  if (!systemRoot) return;
  textureQueue = [];
  const sharedGeos = new Set(Object.values(sharedGeo));
  systemRoot.traverse((obj) => {
    if (obj.geometry && !sharedGeos.has(obj.geometry)) obj.geometry.dispose();
    if (obj.material && obj.material !== hitMaterial && obj.material !== starMat) {
      if (obj.material.map) obj.material.map.dispose();
      obj.material.dispose();
    }
  });
  scene.remove(systemRoot);
  systemRoot = null;
  depLinks = [];
  beacon = null;
  nextBody = null;
  $("spaceLabels").innerHTML = "";
}

/* ---------- derived overlays: blocked links + next-move beacon ---------- */

/** Re-derive everything that depends on statuses and decisions. */
function afterDataChange() {
  rebuildDependencyLinks();
  updateNextBeacon();
  for (const body of bodies) updateLabelText(body);
  renderSystemIndex();
}

function rebuildDependencyLinks() {
  for (const link of depLinks) {
    if (link.line.parent) link.line.parent.remove(link.line);
    link.line.geometry.dispose();
    link.line.material.dispose();
  }
  depLinks = [];

  for (const body of bodies) {
    const node = body.node;
    if (body.empty || !node.dependencyId || node.status === "done" || !model.isNodeBlocked(mapState, node)) continue;
    const blocker = bodyById.get(node.dependencyId);
    if (!blocker) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({
      color: new THREE.Color("#ff6b6b"),
      dashSize: 0.5,
      gapSize: 0.35,
      transparent: true,
      opacity: 0.3,
      depthWrite: false
    }));
    line.frustumCulled = false;
    systemRoot.add(line);
    depLinks.push({ line, from: body, to: blocker });
  }
}

function updateDependencyLinks() {
  for (const link of depLinks) {
    const arr = link.line.geometry.attributes.position.array;
    link.from.anchor.getWorldPosition(tmpV);
    link.to.anchor.getWorldPosition(tmpV2);
    arr[0] = tmpV.x; arr[1] = tmpV.y; arr[2] = tmpV.z;
    arr[3] = tmpV2.x; arr[4] = tmpV2.y; arr[5] = tmpV2.z;
    link.line.geometry.attributes.position.needsUpdate = true;
    link.line.computeLineDistances();
    const on = [focused, hovered].some((b) => b && (b === link.from || b === link.to));
    const m = link.line.material;
    m.opacity += ((on ? 0.95 : 0.28) - m.opacity) * 0.12;
  }
}

function makeBeacon() {
  const group = new THREE.Group();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture([[0, "rgba(220,255,255,1)"], [0.2, "rgba(120,230,255,.55)"], [0.5, "rgba(80,170,255,.12)"], [1, "rgba(60,120,255,0)"]]),
    color: new THREE.Color(1.4, 2.2, 2.6),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 96), new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.7, 2.2, 2.6),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  group.add(glow, halo);
  group.userData = { glow, halo, radius: 1 };
  return group;
}

function updateNextBeacon() {
  const node = model.nextActionNode(mapState);
  const body = node ? bodyById.get(node.id) || null : null;
  nextBody = body;
  for (const b of bodies) b.label.classList.toggle("is-next", b === body);

  const button = $("nextButton");
  button.classList.toggle("has-next", !!body);
  button.title = body ? "Next move: " + title(body.node) + " (N)" : "No ready action yet (N)";

  if (!body) {
    if (beacon) beacon.visible = false;
    return;
  }
  if (!beacon) beacon = makeBeacon();
  body.anchor.add(beacon);
  beacon.visible = true;
  beacon.userData.radius = body.radius;
}

/* ------------------------------------------------------------------ */
/* Labels                                                             */
/* ------------------------------------------------------------------ */

function makeLabel(body) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "label-chip depth-" + Math.min(body.depth, 3) + (body.depth === 0 ? " sun" : "");
  el.style.setProperty("--dot", body.hex);
  el.tabIndex = -1;
  el.innerHTML = "<i></i><span></span><em></em>";
  el.style.opacity = "0";
  el.style.visibility = "hidden";
  el._opacity = 0;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    focusBody(body);
  });
  el.addEventListener("pointerenter", () => setHovered(body));
  el.addEventListener("pointerleave", () => { if (hovered === body) setHovered(null); });
  $("spaceLabels").appendChild(el);
  body.label = el;
  updateLabelText(body);
  return el;
}

function bodyTag(body) {
  if (body.empty || body.depth === 0) return "";
  if (body === nextBody) return "Next ✦";
  if (body.lookKind && LOOK[body.lookKind].tag) return LOOK[body.lookKind].tag;
  if (body.node.status !== "done" && model.isNodeBlocked(mapState, body.node)) return "Blocked";
  return "";
}

function updateLabelText(body) {
  const el = body.label;
  const name = title(body.node);
  el.querySelector("span").textContent = name || (body.depth === 0 ? "Untitled goal" : "Empty slot");
  const tag = bodyTag(body);
  const em = el.querySelector("em");
  em.textContent = tag;
  em.hidden = !tag;
  el.classList.toggle("empty", !name);
  el.classList.toggle("done", body.node.status === "done" && !!name);
  el.classList.toggle("suppressed", !!body.lookKind && body.lookKind !== "handoff");
  el.classList.toggle("blocked", tag === "Blocked");
  el.title = name || "";
  el._w = undefined;
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
  if (body === nextBody) return focused ? 0.85 : 0.95;
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

function labelPriority(body) {
  if (body === focused || body === hovered) return 0;
  if (body.depth === 0 || body === nextBody) return 1;
  return Math.min(body.depth, 3) + 1;
}

/**
 * Place labels in priority order (focus/hover > sun & next > planets > moons)
 * and hide the lower-priority ones that would overlap something already placed.
 */
function updateLabels() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const camPos = camera.position;
  const items = [];

  for (const body of bodies) {
    body.anchor.getWorldPosition(tmpV);
    const dist = tmpV.distanceTo(camPos);
    let target = labelVisibility(body, dist) * (body._appear === undefined ? 1 : body._appear);

    tmpV2.copy(tmpV);
    tmpV2.y += body.radius * (body.depth === 0 ? 1.15 : 1.35);
    tmpV2.project(camera);
    if (tmpV2.z > 1 || tmpV2.z < -1) target = 0;
    if (body.depth >= 2 && dist > 60 && body !== hovered && body !== focused && body !== nextBody) target = 0;

    items.push({ body, el: body.label, dist, target, x: (tmpV2.x * 0.5 + 0.5) * w, y: (-tmpV2.y * 0.5 + 0.5) * h, prio: labelPriority(body) });
  }

  // measure (reads only, before any writes this frame)
  for (const item of items) {
    if (item.target > 0 && item.el._w === undefined) {
      item.el._w = item.el.offsetWidth || 80;
      item.el._h = item.el.offsetHeight || 22;
    }
  }

  const placed = [];
  items.slice().sort((a, b) => a.prio - b.prio || a.dist - b.dist).forEach((item) => {
    if (item.target <= 0.02) return;
    const hw = item.el._w / 2 + 3;
    const rect = { l: item.x - hw, r: item.x + hw, t: item.y - item.el._h - 3, b: item.y + 3 };
    if (item.prio > 1 && placed.some((p) => rect.l < p.r && rect.r > p.l && rect.t < p.b && rect.b > p.t)) {
      item.target = 0;
      return;
    }
    placed.push(rect);
  });

  for (const item of items) {
    const el = item.el;
    el._opacity += (item.target - el._opacity) * 0.18;
    if (Math.abs(el._opacity - item.target) < 0.01) el._opacity = item.target;

    if (el._opacity <= 0.01) {
      if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
      continue;
    }
    if (el.style.visibility !== "visible") el.style.visibility = "visible";
    const opacity = el._opacity.toFixed(2);
    if (el._o !== opacity) {
      el.style.opacity = opacity;
      el._o = opacity;
    }
    const transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    if (el._t !== transform) {
      el.style.transform = transform;
      el._t = transform;
    }
    const z = String(1000 - Math.round(item.dist));
    if (el._z !== z) {
      el.style.zIndex = z;
      el._z = z;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Animation loop                                                     */
/* ------------------------------------------------------------------ */

function updateOrbits() {
  for (const body of bodies) {
    if (body.pivot) body.pivot.rotation.y = body.phase + sim.time * body.speed;
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  const now = performance.now();

  sim.time += dt * (paused ? 0 : sim.scale);
  updateOrbits();

  for (const body of bodies) {
    body.mesh.rotation.y += dt * body.spin * (paused ? 0.15 : 1);
    if (body.atmo) {
      const u = body.atmo.material.uniforms;
      sunBody.anchor.getWorldPosition(u.uSun.value);
      let target = (body.depth === 1 ? 1.9 : 1.3) * body.atmoFactor;
      if (body.node.status === "doing") target *= 1.25 + Math.sin(elapsed * 3) * 0.35;
      if (body === hovered || body === focused) target *= 1.6;
      u.uIntensity.value += (target - u.uIntensity.value) * 0.12;
    }
    if (body.ring) body.ring.rotation.z += dt * 0.05;
    if (body.handoff) body.handoff.rotation.y += dt * 1.4;
  }

  if (sunBody) {
    sunBody.mesh.material.uniforms.uTime.value = elapsed;
    sunBody.corona.material.rotation = elapsed * 0.01;
    sunBody.corona.scale.setScalar(6 * 4.6 * (1 + Math.sin(elapsed * 0.9) * 0.025));
  }
  if (beacon && beacon.visible) {
    const r = beacon.userData.radius;
    const pulse = REDUCED_MOTION ? 1 : 1 + Math.sin(elapsed * 3.2) * 0.14;
    beacon.userData.glow.scale.setScalar(r * 4.4 * pulse);
    beacon.userData.halo.scale.setScalar(r * 1.95 * (2 - pulse * 0.92));
    beacon.userData.halo.rotation.x = Math.PI / 2 + Math.sin(elapsed * 0.7) * 0.3;
    beacon.userData.halo.rotation.y += dt * 0.6;
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
    if (!focused && !REDUCED_MOTION && now - lastInteraction > 7000) controls.autoRotate = true;
    controls.update();
  }

  updateDependencyLinks();

  if (pointerDirty) {
    pointerDirty = false;
    pick();
  }

  composer.render(dt);
  updateLabels();
  monitorPerformance(now);
}

function updateLineHighlights() {
  for (const body of bodies) {
    if (body.line) {
      const on = body === hovered || (focused && isAncestor(body, focused));
      const m = body.line.material;
      m.opacity += ((on ? 0.6 : body.line.userData.baseOpacity) - m.opacity) * 0.1;
    }
    if (body.childLine) {
      const on = focused && (focused === body || focused.parent === body);
      const m = body.childLine.material;
      m.opacity += ((on ? 0.35 : body.childLine.userData.baseOpacity) - m.opacity) * 0.1;
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
  if (body.depth >= 3 && !body.children.length) extent = Math.max(extent, body.radius * 4);
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

function syncControlLimits() {
  controls.minDistance = focused && focused !== sunBody ? Math.max(focused.radius * 1.5, 0.3) : 9;
}

/**
 * Fly the camera. The path is interpolated in spherical coordinates around the
 * sun, so the camera swings around the system instead of cutting through it.
 * Any drag, pinch or wheel input cancels the flight (see cancelFlight).
 */
function startFlight(getTarget, getCamera, duration, onDone) {
  if (flight && flight.tween) flight.tween.kill();
  controls.enabled = false;
  controls.autoRotate = false;
  following = false;

  const startCam = new THREE.Spherical().setFromVector3(camera.position);
  const startTarget = controls.target.clone();
  const proxy = { t: 0 };
  const endTarget = new THREE.Vector3();
  const endCamV = new THREE.Vector3();
  const endCam = new THREE.Spherical();
  const current = new THREE.Spherical();

  const f = {
    update() {
      const t = proxy.t;
      getTarget(endTarget);
      getCamera(endCamV, endTarget);
      endCam.setFromVector3(endCamV);
      let dTheta = endCam.theta - startCam.theta;
      if (dTheta > Math.PI) dTheta -= Math.PI * 2;
      if (dTheta < -Math.PI) dTheta += Math.PI * 2;
      current.set(
        THREE.MathUtils.lerp(startCam.radius, endCam.radius, t),
        THREE.MathUtils.lerp(startCam.phi, endCam.phi, t),
        startCam.theta + dTheta * t
      );
      camera.position.setFromSpherical(current);
      controls.target.lerpVectors(startTarget, endTarget, t);
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
      syncControlLimits();
      controls.update();
      if (onDone) onDone();
    }
  });
  flight = f;
}

/** The user grabbed the camera mid-flight: hand control back immediately. */
function cancelFlight() {
  if (!flight) return;
  flight.tween.kill();
  flight = null;
  controls.enabled = true;
  if (focused && focused !== sunBody) {
    following = true;
    focused.anchor.getWorldPosition(lastFollowPos);
  }
  syncControlLimits();
}

function focusBody(body) {
  if (!body) return goOverview();
  lastInteraction = performance.now();
  fadeHint();
  closeSearch();

  if (body.depth === 0) {
    goOverview(true);
    return;
  }

  focused = body;
  showPanel(body);
  announceBody(body);
  gsap.to(sim, { scale: 0.12, duration: 1.2 * MOTION, ease: "power2.out" });

  const dist = viewDistance(body);
  const viewDir = new THREE.Vector3();
  const bodyPos = body.anchor.getWorldPosition(new THREE.Vector3());
  if (body.depth >= 3) {
    // moonlets sit right next to their moon: look from the far side of the
    // moon, slightly above, so the moon stays behind the target instead of
    // filling the lens
    const parentPos = body.parent.anchor.getWorldPosition(new THREE.Vector3());
    viewDir.subVectors(bodyPos, parentPos);
    if (viewDir.lengthSq() < 1e-6) viewDir.set(1, 0, 0);
    viewDir.normalize();
    viewDir.y += 0.6;
    viewDir.normalize();
  } else {
    const outward = bodyPos.clone().setY(0);
    if (outward.lengthSq() < 1e-4) outward.set(0, 0, 1);
    outward.normalize();
    // three-quarter view from the sunlit side: tangent to the orbit, a bit
    // sunward and above, on whichever side the camera already is
    const tangent = new THREE.Vector3(-outward.z, 0, outward.x);
    if (camera.position.clone().sub(bodyPos).dot(tangent) < 0) tangent.negate();
    viewDir.copy(tangent).multiplyScalar(0.85).addScaledVector(outward, -0.4);
    viewDir.y = 0.55;
    viewDir.normalize();
  }

  const travel = camera.position.distanceTo(bodyPos);
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
  if (withSunPanel) {
    showPanel(sunBody);
    announceBody(sunBody);
  } else {
    hidePanel();
  }
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

  const deep = deepNodeId ? bodyById.get(deepNodeId) : null;
  if (deepNodeId) {
    const url = new URL(location.href);
    url.searchParams.delete("node");
    history.replaceState(null, "", url);
    deepNodeId = null;
  }
  startFlight((o) => o.set(0, 0, 0), (o) => o.copy(off), deep ? 2.8 : 3.6, () => {
    if (deep && deep !== sunBody) focusBody(deep);
  });

  setTimeout(fadeHint, 9000);
}

function appear(totalDelay) {
  const d = MOTION;
  for (const body of bodies) body._appear = 0;

  gsap.fromTo(sunBody.mesh.scale, { x: 0.5, y: 0.5, z: 0.5 }, { x: 6, y: 6, z: 6, duration: 2.2 * d, ease: "elastic.out(1, 0.6)" });
  gsap.fromTo(sunBody.corona.material, { opacity: 0 }, { opacity: 1, duration: 2 * d });
  gsap.to(sunBody, { _appear: 1, duration: 0.8, delay: 1.2 * d });

  bodies.filter((b) => b.depth === 1).forEach((body, i) => {
    const delay = (0.6 + i * 0.16) * d;
    body.anchor.scale.setScalar(0.001);
    gsap.to(body.anchor.scale, { x: 1, y: 1, z: 1, duration: 1.3 * d, delay, ease: "back.out(1.8)" });
    gsap.to(body, { _appear: 1, duration: 0.6, delay: delay + 0.8 * d });
    if (body.line) {
      body.line.material.opacity = 0;
      gsap.to(body.line.material, { opacity: body.line.userData.baseOpacity, duration: 1.4 * d, delay });
    }
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
    if (body.depth >= 2 && !closeEnoughToPick(body)) continue;
    // prefer the smaller body when hits overlap (moons in front of planets)
    if (!best || (body.depth > best.depth && hit.distance - hits[0].distance < body.radius * 4)) best = body;
  }
  setHovered(best);
}

function closeEnoughToPick(body) {
  body.anchor.getWorldPosition(tmpV);
  return tmpV.distanceTo(camera.position) < (body.depth === 2 ? 70 : 18);
}

function setHovered(body) {
  if (hovered === body) return;
  if (hovered && hovered.label) hovered.label.classList.remove("is-hover");
  hovered = body;
  if (body && body.label) body.label.classList.add("is-hover");
  document.body.classList.toggle("hovering", !!body);
}

/* ------------------------------------------------------------------ */
/* Panel, index, announcements                                        */
/* ------------------------------------------------------------------ */

function nameOf(body) {
  return title(body.node) || (body.depth === 0 ? "Untitled goal" : "Empty slot");
}

function pathOf(body) {
  const parts = [];
  let cur = body.parent;
  while (cur) {
    parts.unshift(nameOf(cur));
    cur = cur.parent;
  }
  return parts.join("  ›  ");
}

function showPanel(body, opts) {
  const quiet = opts && opts.quiet;
  const panel = $("planetPanel");
  const node = body.node;
  const name = title(node);
  const kind = KIND[Math.min(body.depth, 3)];

  panel.style.setProperty("--dot", body.hex);
  $("panelKind").textContent = kind[0] + " · " + kind[1];
  const status = name ? (node.status || "open") : "empty";
  const statusEl = $("panelStatus");
  statusEl.textContent = STATUS_LABEL[status] || status;
  statusEl.className = "panel-status " + status;

  const h1 = $("panelTitle");
  h1.textContent = name || (body.depth === 0 ? "Untitled goal" : "Empty slot — name it in the 2D map");
  h1.classList.toggle("empty", !name);
  $("panelPath").textContent = pathOf(body);

  const stats = model.leafStats(mapState, node);
  const progress = $("panelProgress");
  if (stats.total) {
    const pct = Math.round((stats.done / stats.total) * 100);
    progress.hidden = false;
    $("panelProgressValue").textContent = pct + "%  ·  " + stats.done + "/" + stats.total;
    requestAnimationFrame(() => { $("panelProgressFill").style.width = pct + "%"; });
  } else {
    progress.hidden = true;
  }

  renderMeta(body);

  const notes = $("panelNotes");
  const noteText = typeof node.notes === "string" ? node.notes.trim() : "";
  notes.hidden = !noteText;
  notes.textContent = noteText;

  renderChildList(body);

  const statusSwitch = $("statusSwitch");
  statusSwitch.hidden = !name;
  statusSwitch.querySelectorAll("button").forEach((btn) => {
    const on = btn.dataset.status === (node.status || "open");
    btn.setAttribute("aria-checked", on ? "true" : "false");
    btn.tabIndex = on ? 0 : -1;
  });

  $("parentButton").disabled = !body.parent;
  updateFlatLink();

  for (const b of bodies) b.label.classList.toggle("is-focus", b === body);
  renderSystemIndex();

  const wasHidden = panel.hidden;
  panel.hidden = false;
  if (wasHidden) {
    gsap.fromTo(panel,
      { autoAlpha: 0, x: window.innerWidth <= 640 ? 0 : 40, y: window.innerWidth <= 640 ? 40 : 0 },
      { autoAlpha: 1, x: 0, y: 0, duration: 0.7 * MOTION, ease: "power3.out", delay: 0.15 * MOTION });
    tweenViewOffset(true);
  } else if (!quiet) {
    gsap.fromTo(panel.querySelectorAll("h1, .panel-breadcrumb, .panel-meta, .panel-children, .panel-progress"),
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.45 * MOTION, stagger: 0.04, ease: "power2.out" });
  }
}

function renderMeta(body) {
  const node = body.node;
  const meta = $("panelMeta");
  meta.innerHTML = "";
  if (!title(node)) return;

  const decision = model.decisionValue(node);
  const cells = [
    ["Impact", (node.impact || 3) + "/5"],
    ["Effort", (node.effort || 3) + "/5"],
    ["Decision", DECISION_LABEL[decision] || "Do"]
  ];
  if (node.duration) cells.push(["Estimate", node.duration + " min"]);
  if (decision === "delegate" && node.delegatedTo) cells.push(["Hand off to", node.delegatedTo]);
  if (decision === "defer" && node.deferUntil) cells.push(["Back on", node.deferUntil]);
  if (node.dependencyId && mapState.nodes[node.dependencyId]) {
    const blocked = model.isNodeBlocked(mapState, node);
    cells.push([blocked ? "Blocked by" : "Was blocked by", title(mapState.nodes[node.dependencyId]) || "—", bodyById.get(node.dependencyId)]);
  }
  if (body.lookKind === "inherited") cells.push(["Parked", "A parent is not on Do"]);

  cells.forEach(([k, v, target]) => {
    const div = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = k;
    if (target) {
      const link = document.createElement("button");
      link.type = "button";
      link.className = "meta-link";
      link.textContent = v;
      link.addEventListener("click", () => focusBody(target));
      dd.appendChild(link);
    } else {
      dd.textContent = v;
    }
    if (String(v).length > 14 || target) div.classList.add("wide");
    div.append(dt, dd);
    meta.appendChild(div);
  });
}

function renderChildList(body) {
  const list = $("panelChildren");
  list.innerHTML = "";
  const filled = body.children.filter((c) => !c.empty);
  const emptyCount = body.children.length - filled.length;
  $("panelChildrenWrap").hidden = !body.children.length;
  $("panelChildrenHead").textContent = CHILD_NOUN[Math.min(body.depth, 3)] + " · " + filled.length + (emptyCount ? "  (+" + emptyCount + " empty)" : "");
  filled.forEach((child) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "moon-chip" + (child.node.status === "done" ? " done" : "") +
      (child.lookKind && child.lookKind !== "handoff" ? " suppressed" : "") + (child === nextBody ? " is-next" : "");
    btn.style.setProperty("--dot", child.hex);
    const i = document.createElement("i");
    const span = document.createElement("span");
    span.textContent = title(child.node);
    btn.append(i, span);
    const tag = bodyTag(child);
    const s = model.leafStats(mapState, child.node);
    if (tag || s.total) {
      const small = document.createElement("small");
      small.textContent = tag || (s.done + "/" + s.total);
      btn.appendChild(small);
    }
    btn.addEventListener("click", () => focusBody(child));
    list.appendChild(btn);
  });
}

function hidePanel() {
  const panel = $("planetPanel");
  for (const b of bodies) b.label.classList.remove("is-focus");
  renderSystemIndex();
  updateFlatLink();
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

function updateFlatLink() {
  const link = $("flatLink");
  const target = focused && focused !== sunBody && mode === "db" ? focused.node.id : null;
  link.href = target ? "index.html?node=" + encodeURIComponent(target) : "index.html";
  link.title = target ? "Open “" + nameOf(focused) + "” in the 2D planner" : "Edit in the 2D planner";
}

function renderSystemIndex() {
  const nav = $("systemIndex");
  if (!sunBody) return;
  nav.innerHTML = "";
  const activeDriver = focused ? (focused.depth === 0 ? sunBody : ancestorAtDepth(focused, 1)) : null;
  const nextDriver = nextBody ? ancestorAtDepth(nextBody, 1) : null;

  const chip = (body, sub) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "index-chip" + (sub ? " sub" : "") + (body.depth === 0 ? " sun" : "") +
      ((sub ? isAncestor(body, focused) : body === activeDriver) ? " active" : "") +
      (body.node.status === "done" && !body.empty ? " done" : "") +
      (body.lookKind && body.lookKind !== "handoff" ? " suppressed" : "") +
      (body === nextDriver || body === nextBody ? " has-next" : "");
    btn.style.setProperty("--dot", body.hex);
    const i = document.createElement("i");
    const span = document.createElement("span");
    span.textContent = nameOf(body);
    btn.append(i, span);
    btn.addEventListener("click", () => focusBody(body));
    btn.addEventListener("pointerenter", () => setHovered(body));
    btn.addEventListener("pointerleave", () => { if (hovered === body) setHovered(null); });
    nav.appendChild(btn);
  };

  chip(sunBody, false);
  sunBody.children.filter((b) => !b.empty).forEach((driver) => {
    chip(driver, false);
    // the focused planet's moons, so the whole tree is reachable from the keyboard
    if (driver === activeDriver) driver.children.filter((m) => !m.empty).forEach((moon) => chip(moon, true));
  });
}

function ancestorAtDepth(body, depth) {
  let cur = body;
  while (cur && cur.depth > depth) cur = cur.parent;
  return cur;
}

function announceBody(body) {
  const kind = KIND[Math.min(body.depth, 3)][1].toLowerCase();
  const stats = model.leafStats(mapState, body.node);
  const progress = stats.total ? `, ${stats.done} of ${stats.total} cleared` : "";
  const status = title(body.node) ? `, ${STATUS_LABEL[body.node.status || "open"]}` : "";
  $("spaceAnnouncer").textContent = `${nameOf(body)} — ${kind}${status}${progress}.`;
}

/* ------------------------------------------------------------------ */
/* Status changes                                                     */
/* ------------------------------------------------------------------ */

async function setStatus(body, status) {
  if (!body || body.empty || !title(body.node)) return;
  const node = body.node;
  const previous = node.status || "open";
  if (previous === status) return;
  node.status = status;

  if (status === "done") {
    if (body.depth > 0) addRing(body, true);
    burst(body);
    toast(body.depth === 0 ? "Goal reached ✦" : "Orbit cleared ✓");
  } else if (previous === "done") {
    removeRing(body);
  }

  afterDataChange();
  showPanel(body, { quiet: true });
  announceBody(body);
  await persistStatus(node);
}

function burst(body) {
  const count = 160;
  const palette = [new THREE.Color("#ffd166"), new THREE.Color(body.hex), new THREE.Color("#ffffff"), new THREE.Color("#ff8a5b")];
  const vel = [];
  const geo = pointCloud(count, (i, pos, size, phase, color) => {
    vel.push(new THREE.Vector3().randomDirection().multiplyScalar(0.6 + Math.random() * 1.4));
    size[i] = 0.25 + Math.random() * 0.5;
    phase[i] = Math.random() * 10;
    const c = palette[i % palette.length];
    color[i * 3] = c.r * 2;
    color[i * 3 + 1] = c.g * 2;
    color[i * 3 + 2] = c.b * 2;
  });
  const size = geo.attributes.aSize.array;
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
      if (points.parent) points.parent.remove(points);
      geo.dispose();
    }
  });

  gsap.fromTo(body.mesh.scale,
    { x: body.radius * 1.25, y: body.radius * 1.25, z: body.radius * 1.25 },
    { x: body.radius, y: body.radius, z: body.radius, duration: 0.9 * MOTION, ease: "elastic.out(1, 0.4)" });
}

function goToNext() {
  if (nextBody) {
    focusBody(nextBody);
    toast("Next move: " + title(nextBody.node));
  } else {
    toast("No ready action — choose Do, clear a blocker, or split broad work in 2D.");
  }
}

/* ------------------------------------------------------------------ */
/* Search                                                             */
/* ------------------------------------------------------------------ */

let searchIndex = 0;

function openSearch() {
  const box = $("spaceSearch");
  box.hidden = false;
  const input = $("searchInput");
  input.value = "";
  renderSearch("");
  // opacity only: autoAlpha would set visibility:hidden and the focus() below would fail
  gsap.fromTo(box, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.25 * MOTION, ease: "power2.out" });
  input.focus();
}

function closeSearch() {
  const box = $("spaceSearch");
  if (!box.hidden) box.hidden = true;
}

function searchMatches(query) {
  const q = query.trim().toLocaleLowerCase();
  const filled = bodies.filter((b) => !b.empty);
  if (!q) return filled.filter((b) => b.depth <= 1 || b === nextBody).slice(0, 9);
  const pos = (b) => title(b.node).toLocaleLowerCase().indexOf(q);
  return filled
    .filter((b) => pos(b) !== -1)
    .sort((a, b) => pos(a) - pos(b) || a.depth - b.depth)
    .slice(0, 9);
}

function renderSearch(query) {
  const results = $("searchResults");
  results.innerHTML = "";
  const matches = searchMatches(query);
  searchIndex = 0;
  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.textContent = "Nothing in this system matches.";
    results.appendChild(empty);
    return;
  }
  matches.forEach((body, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-result" + (i === 0 ? " active" : "");
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
    btn.style.setProperty("--dot", body.hex);
    const dot = document.createElement("i");
    const span = document.createElement("span");
    span.textContent = title(body.node);
    const small = document.createElement("small");
    small.textContent = KIND[Math.min(body.depth, 3)][1].toLowerCase() + (body.parent ? " · " + nameOf(body.parent) : "");
    btn.append(dot, span, small);
    btn.addEventListener("click", () => focusBody(body));
    btn._body = body;
    results.appendChild(btn);
  });
}

function moveSearch(delta) {
  const items = Array.from($("searchResults").querySelectorAll(".search-result"));
  if (!items.length) return;
  searchIndex = (searchIndex + delta + items.length) % items.length;
  items.forEach((el, i) => {
    el.classList.toggle("active", i === searchIndex);
    el.setAttribute("aria-selected", i === searchIndex ? "true" : "false");
  });
  items[searchIndex].scrollIntoView({ block: "nearest" });
}

/* ------------------------------------------------------------------ */
/* Map picker                                                         */
/* ------------------------------------------------------------------ */

function renderMapPicker() {
  const select = $("mapSelect");
  select.innerHTML = "";
  if (mode !== "db" || !mapsList.length) {
    const opt = document.createElement("option");
    opt.textContent = mode === "demo" ? "Demo system" : (title(mapState.nodes[mapState.rootId]) || "This map");
    select.appendChild(opt);
    select.disabled = true;
    return;
  }
  mapsList.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.title || title(m.state.nodes[m.state.rootId]) || "Untitled map";
    opt.selected = !!mapRecord && m.id === mapRecord.id;
    select.appendChild(opt);
  });
  select.disabled = mapsList.length < 2;
}

async function switchMap(id) {
  const record = mapsList.find((m) => m.id === id);
  if (!record) return;
  try {
    const fresh = await Storage.getMap(id);
    useRecord(isUsableRecord(fresh) ? fresh : record);
  } catch (e) {
    useRecord(record);
  }
  const url = new URL(location.href);
  url.searchParams.set("map", id);
  history.replaceState(null, "", url);

  cancelFlight();
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

  // capture phase: runs before OrbitControls, so a grab during a flight
  // cancels it and the same gesture already moves the camera
  canvas.addEventListener("pointerdown", (e) => {
    lastPointerType = e.pointerType || "mouse";
    cancelFlight();
  }, { capture: true });
  canvas.addEventListener("wheel", cancelFlight, { capture: true, passive: true });

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
    closeSearch();
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
    // touch double-taps are zoom attempts, not "take me back"
    if (lastPointerType === "mouse" && !hovered) goOverview(false);
  });

  $("overviewButton").addEventListener("click", () => goOverview(false));
  $("panelClose").addEventListener("click", () => goOverview(false));
  $("parentButton").addEventListener("click", () => {
    if (focused && focused.parent) focusBody(focused.parent);
  });
  $("statusSwitch").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-status]");
    if (btn && focused) setStatus(focused, btn.dataset.status);
  });
  $("statusSwitch").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    e.stopPropagation();
    if (!focused) return;
    const order = ["open", "doing", "done"];
    const current = order.indexOf(focused.node.status || "open");
    const next = order[(current + (e.key === "ArrowRight" ? 1 : 2)) % 3];
    setStatus(focused, next).then(() => {
      const target = $("statusSwitch").querySelector(`[data-status="${next}"]`);
      if (target) target.focus();
    });
  });
  $("nextButton").addEventListener("click", goToNext);
  $("searchButton").addEventListener("click", () => ($("spaceSearch").hidden ? openSearch() : closeSearch()));
  $("pauseButton").addEventListener("click", togglePause);
  $("labelsButton").addEventListener("click", toggleLabels);
  $("mapSelect").addEventListener("change", (e) => switchMap(e.target.value));

  const input = $("searchInput");
  input.addEventListener("input", () => renderSearch(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      moveSearch(1);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      moveSearch(-1);
      e.preventDefault();
    } else if (e.key === "Enter") {
      const active = $("searchResults").querySelectorAll(".search-result")[searchIndex];
      if (active) focusBody(active._body);
      e.preventDefault();
    } else if (e.key === "Escape") {
      closeSearch();
      e.preventDefault();
      e.stopPropagation();
    }
  });

  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === "Escape") {
      if (!$("spaceSearch").hidden) closeSearch();
      else if (focused && focused.parent && focused.parent !== sunBody) focusBody(focused.parent);
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
    } else if (e.key === " " && tag !== "BUTTON" && tag !== "A") {
      togglePause();
      e.preventDefault();
    } else if (e.key === "l" || e.key === "L") {
      toggleLabels();
    } else if ((e.key === "d" || e.key === "D") && focused) {
      setStatus(focused, focused.node.status === "done" ? "open" : "done");
    } else if (e.key === "n" || e.key === "N") {
      goToNext();
    } else if (e.key === "/") {
      openSearch();
      e.preventDefault();
    }
  });
}

function hopSibling(dir) {
  const base = focused && focused !== sunBody ? focused : null;
  const siblings = base ? base.parent.children.filter((c) => !c.empty || c === base) : sunBody.children.filter((c) => !c.empty);
  if (!siblings.length) return;
  const idx = base ? siblings.indexOf(base) : (dir > 0 ? -1 : 0);
  focusBody(siblings[(idx + dir + siblings.length) % siblings.length]);
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
