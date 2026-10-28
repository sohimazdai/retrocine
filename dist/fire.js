// A fire shader and flowing-flame hair. Each lock is a tapering tube bent along a curve; a shader
// gives it a core-to-edge heat gradient, flicker and a licking, winding sway that grows toward the
// tip. Built for the fire princess's hair — fire that grows thick on the head and streams like a
// river rather than standing up in spikes.
import * as T from "three";

const VERT = `
precision highp float;
uniform float uTime;
attribute float aT;      // 0 at the root of a lock, 1 at its tip
attribute float aPhase;  // a per-lock phase so locks move out of step
attribute float aSway;   // how far this lock licks about
varying float vT;
varying float vPhase;
void main() {
  vT = aT;
  vPhase = aPhase;
  vec3 pos = position;
  float t = aT;
  float wind = uTime * 1.7 + aPhase * 6.2831;
  // Hardly any motion at the root, a lot at the tip: a lick that winds as it rises.
  float amp = aSway * (t * t * 0.95 + t * 0.12);
  pos.x += sin(wind + t * 3.3) * amp + sin(wind * 2.1 + t * 6.0) * amp * 0.35;
  pos.z += cos(wind * 0.8 + t * 2.4) * amp * 0.7;
  pos.y += sin(wind * 1.3 + t * 4.2) * amp * 0.3;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform float uTime;
uniform vec3 uCore;
uniform vec3 uMid;
uniform vec3 uEdge;
varying float vT;
varying float vPhase;
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise(float x) {
  float i = floor(x), f = fract(x);
  return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
}
void main() {
  float t = vT;
  // Flicker travelling up the flame.
  float flick = noise(t * 6.0 + uTime * 5.0 + vPhase * 10.0) * 0.5 + noise(t * 14.0 - uTime * 3.2) * 0.5;
  float tt = clamp(t + (flick - 0.5) * 0.14, 0.0, 1.0);
  vec3 col = mix(uCore, uMid, smoothstep(0.0, 0.5, tt));
  col = mix(col, uEdge, smoothstep(0.5, 1.0, tt));
  col *= 1.0 + (1.0 - tt) * 0.35; // a warm, glowing core (not white-hot)
  // Wispy: fades out toward the tip and flickers; the very root is softened to hide the seam.
  float alpha = (1.0 - smoothstep(0.5, 1.0, tt)) * (0.5 + flick * 0.45);
  alpha *= smoothstep(0.0, 0.07, t);
  gl_FragColor = vec4(col, alpha);
}
`;

export function createFireMaterial() {
  return new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCore: { value: new T.Color("#ffd874") },
      uMid: { value: new T.Color("#ff6f1c") },
      uEdge: { value: new T.Color("#cf2418") },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    side: T.DoubleSide,
    toneMapped: false,
  });
}

// Adds one tapering tube along a curve to the shared arrays.
function addLock(points, baseR, phase, sway, A, rings = 14, radial = 6) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
  const frames = curve.computeFrenetFrames(rings, false);
  const start = A.ringStart;
  const v = new T.Vector3();
  for (let i = 0; i <= rings; i++) {
    const t = i / rings,
      center = curve.getPointAt(t),
      r = baseR * (1 - t) * (1 - t * 0.25) + 0.004,
      n = frames.normals[i],
      b = frames.binormals[i];
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      v.copy(n).multiplyScalar(Math.cos(a) * r).addScaledVector(b, Math.sin(a) * r).add(center);
      A.pos.push(v.x, v.y, v.z);
      A.aT.push(t);
      A.aPhase.push(phase);
      A.aSway.push(sway);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < radial; j++) {
      const a = start + i * radial + j,
        b = start + i * radial + ((j + 1) % radial),
        c = start + (i + 1) * radial + j,
        d = start + (i + 1) * radial + ((j + 1) % radial);
      A.idx.push(a, c, b, b, c, d);
    }
  A.ringStart += (rings + 1) * radial;
}

// Builds the whole head of flowing fire and returns { mesh, material }.
export function buildFireHair() {
  const A = { pos: [], aT: [], aPhase: [], aSway: [], idx: [], ringStart: 0 };
  const rnd = (() => {
    let s = 7;
    return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  })();
  // A thick crown of short-to-medium flames rising off the whole top of the head and licking over.
  for (let i = 0; i < 26; i++) {
    const a = i * 2.3994,
      rad = 0.07 + rnd() * 0.33,
      x = Math.sin(a) * rad,
      z = Math.cos(a) * rad - 0.02,
      rootY = 0.3 + (0.42 - rad) * 0.5,
      len = 0.42 + rnd() * 0.5,
      curl = (rnd() - 0.5) * 0.3;
    addLock(
      [
        [x, rootY, z],
        [x * 1.3, rootY + len * 0.45, z * 1.3 + 0.02],
        [x * 1.5 + curl, rootY + len * 0.8, z * 1.4 - 0.03],
        [x * 1.5 + curl * 1.8, rootY + len, z * 1.3 - 0.05],
      ],
      0.08 + rnd() * 0.05,
      rnd(),
      0.08 + rnd() * 0.07,
      A,
      12,
    );
  }
  // Big voluminous locks flowing off the temples and sides: up and out, then sweeping down in a wave.
  for (let i = 0; i < 12; i++) {
    const s = i % 2 ? 1 : -1,
      row = Math.floor(i / 2),
      ry = 0.28 - row * 0.12,
      out = 0.42 + row * 0.03,
      drop = 0.55 + row * 0.12 + rnd() * 0.2;
    addLock(
      [
        [s * 0.3, ry, 0.05],
        [s * (out + 0.08), ry + 0.18, -0.02],
        [s * (out + 0.22), ry - 0.05, -0.12],
        [s * (out + 0.18), ry - drop * 0.55, -0.16 - rnd() * 0.1],
        [s * (out - 0.02 + (rnd() - 0.5) * 0.2), ry - drop, -0.1],
      ],
      0.15 + rnd() * 0.05,
      rnd(),
      0.14 + rnd() * 0.08,
      A,
      16,
    );
  }
  // A few long locks streaming down the back.
  for (let i = 0; i < 5; i++) {
    const x = -0.26 + i * 0.13,
      drop = 0.7 + rnd() * 0.35;
    addLock(
      [
        [x, 0.3, -0.26],
        [x * 1.2, 0.42, -0.34],
        [x * 1.1, 0.0, -0.4],
        [x * 0.9 + (rnd() - 0.5) * 0.2, -drop, -0.32],
      ],
      0.13 + rnd() * 0.04,
      rnd(),
      0.1 + rnd() * 0.06,
      A,
      15,
    );
  }

  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(A.pos, 3));
  g.setAttribute("aT", new T.Float32BufferAttribute(A.aT, 1));
  g.setAttribute("aPhase", new T.Float32BufferAttribute(A.aPhase, 1));
  g.setAttribute("aSway", new T.Float32BufferAttribute(A.aSway, 1));
  g.setIndex(A.idx);
  g.computeBoundingSphere();
  const material = createFireMaterial();
  const mesh = new T.Mesh(g, material);
  mesh.frustumCulled = false;
  return { mesh, material };
}
