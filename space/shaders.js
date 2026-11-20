/* GLSL materials for the sun, atmospheres, done-rings and point sprites
 * (stars, dust belt, celebration bursts). */
import * as THREE from "three";

const NOISE_GLSL = /* glsl */`
  float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
  float vn(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.02 + 17.1; a *= 0.5; } return s / 0.97; }
`;

export function sunMaterial() {
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

export function atmosphereMaterial(hex, intensity) {
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

export function ringMaterial(inner, outer) {
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

export function pointsMaterial(pixelRatio) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio }
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
