import * as T from "three";
import { scalpGeometry } from "./sculpt.js";

// One coherent mantle plus swept flames. All fragments share a world-like 3D
// flow field, so neighbouring locks read as fire rather than blinking tubes.
const VERT = `
precision highp float;
uniform float uTime;
uniform float uSpeed;
uniform float uWind;
attribute float aT;
attribute float aPhase;
attribute float aSway;
varying float vT;
varying vec3 vPosition;
varying vec3 vViewPosition;
varying vec3 vViewNormal;
void main() {
  vT = aT;
  vec3 pos = position;
  float t = aT;
  float clock = uTime * uSpeed;
  float wave = clock * 2.1 + aPhase * 6.2831;
  float amp = aSway * t * t;
  pos.x += (sin(wave - t * 4.0) + sin(wave * 1.7 - t * 7.0) * 0.25 + uWind) * amp;
  pos.z += cos(wave * 0.8 - t * 3.0) * amp * 0.65;
  pos.y += sin(wave * 1.1 - t * 5.0) * amp * 0.24;
  vPosition = pos;
  vViewNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vViewPosition = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = `
precision highp float;
uniform float uTime;
uniform float uSpeed;
uniform float uIntensity;
uniform vec3 uCore;
uniform vec3 uMid;
uniform vec3 uEdge;
varying float vT;
varying vec3 vPosition;
varying vec3 vViewPosition;
varying vec3 vViewNormal;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.13, 0.37, 0.71));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float flow(vec3 p) {
  return noise(p) * 0.57 + noise(p * 2.03 + 11.7) * 0.29 + noise(p * 4.1 + 21.3) * 0.14;
}
void main() {
  vec3 p = vPosition * vec3(4.5, 3.0, 4.5);
  p.y -= uTime * uSpeed * 1.6;
  float turbulence = flow(p + vec3(0.0, flow(p * 0.55), 0.0));
  vec3 n = normalize(vViewNormal);
  float facing = abs(dot(n, normalize(-vViewPosition)));
  float heat = clamp(0.15 + facing * 0.06 + smoothstep(0.22, 0.8, turbulence) * 0.9 - vT * 0.32, 0.0, 1.0);
  vec3 col = mix(uEdge, uMid, smoothstep(0.08, 0.58, heat));
  col = mix(col, uCore, smoothstep(0.58, 0.96, heat));
  col *= uIntensity;
  // Solid roots close the scalp; only the ends and silhouette become wisps.
  float tip = 1.0 - smoothstep(0.72 + turbulence * 0.13, 1.0, vT);
  float alpha = tip * mix(0.4, 0.96, smoothstep(0.0, 0.6, facing));
  alpha *= smoothstep(0.0, 0.12, vT) * mix(0.55, 1.0, smoothstep(0.2, 0.65, turbulence));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createFireMaterial() {
  return new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 0.8 },
      uWind: { value: 0.15 },
      uIntensity: { value: 1.15 },
      uCore: { value: new T.Color("#ffe88b") },
      uMid: { value: new T.Color("#ff8c28") },
      uEdge: { value: new T.Color("#cd361a") },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: T.NormalBlending,
    side: T.DoubleSide,
    toneMapped: false,
  });
}

function addLock(points, radius, phase, sway, arrays, rings = 24, radial = 20) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
  const frames = curve.computeFrenetFrames(rings, false);
  const start = arrays.aT.length, v = new T.Vector3();
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, center = curve.getPointAt(t);
    const r = radius * Math.pow(1 - t, 0.85) * (0.9 + Math.sin(t * Math.PI) * 0.22) + 0.001;
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2;
      v.copy(center).addScaledVector(frames.normals[i], Math.cos(a) * r)
        .addScaledVector(frames.binormals[i], Math.sin(a) * r * 0.78);
      arrays.pos.push(v.x, v.y, v.z);
      arrays.aT.push(t); arrays.aPhase.push(phase); arrays.aSway.push(sway);
      if (i < rings && j < radial) {
        const q = start + i * (radial + 1) + j, b = q + radial + 1;
        arrays.idx.push(q, q + 1, b, q + 1, b + 1, b);
      }
    }
  }
}

export function buildFireHair() {
  const a = { pos: [], aT: [], aPhase: [], aSway: [], idx: [] };
  // Broad upward sweeping crown with a taller centre, readable at thumbnail size.
  for (let i = 0; i < 13; i++) {
    const angle = i * 2.39996, radius = 0.09 + (i % 4) * 0.078;
    const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius - 0.06;
    const height = 0.77 - radius * 0.6 + Math.sin(i * 1.7) * 0.08;
    addLock([[x, 0.28, z], [x * 1.1, 0.5, z * 1.15], [x * 0.8 + 0.07, height, z - 0.03], [x * 0.6 + 0.12, height + 0.28, z - 0.08]], 0.15, i / 13, 0.07, a);
  }
  // A continuous fiery mane behind the face, curling upward at its ends.
  for (let i = 0; i < 9; i++) {
    const angle = Math.PI * 0.5 + i / 8 * Math.PI;
    const x = Math.sin(angle) * 0.35, z = Math.cos(angle) * 0.29 - 0.04;
    addLock([[x, 0.23, z], [x * 1.2, -0.03, z * 1.25], [x * 1.4, -0.36, z * 1.4], [x * 1.6, -0.52, z * 1.4], [x * 1.75, -0.3, z * 1.5]], 0.16, i / 9, 0.09, a);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(a.pos, 3));
  geometry.setAttribute("aT", new T.Float32BufferAttribute(a.aT, 1));
  geometry.setAttribute("aPhase", new T.Float32BufferAttribute(a.aPhase, 1));
  geometry.setAttribute("aSway", new T.Float32BufferAttribute(a.aSway, 1));
  geometry.setIndex(a.idx);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  // Account for maximum vertex displacement when framing portraits.
  geometry.boundingBox.expandByScalar(0.14);
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += 0.14;
  const material = createFireMaterial(), mesh = new T.Mesh(geometry, material);
  const mantle = new T.Mesh(scalpGeometry(), new T.MeshStandardMaterial({
    color: "#ed681f", emissive: "#b83e12", emissiveIntensity: 0.45, roughness: 0.8,
  }));

  mesh.add(mantle);
  return { mesh, material };
}
