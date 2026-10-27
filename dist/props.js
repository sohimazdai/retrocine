// How props and balls look. Each builder gets the prop's data (see maps/) and returns a group; the
// map scene places it. Geometry and materials created here are marked as owned so they can be freed
// when the map changes; shared ones from avatars.js are cached and kept.
import * as T from "three";
import { box, ball, material } from "./avatars.js";

export const own = (thing) => ((thing.userData.own = true), thing);
export function cyl(parent, rTop, rBottom, h, color, x = 0, y = 0, z = 0, segments = 32, opts = {}) {
  const m = new T.Mesh(own(new T.CylinderGeometry(rTop, rBottom, h, segments, 1, opts.open)), typeof color === "string" ? material(color, opts.roughness ?? 0.65) : color);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function lines(parent, points, color, opacity = 1) {
  const geometry = own(new T.BufferGeometry().setFromPoints(points.map((p) => new T.Vector3(...p))));
  const mesh = new T.LineSegments(geometry, own(new T.LineBasicMaterial({ color, transparent: opacity < 1, opacity })));
  parent.add(mesh);
  return mesh;
}
export function solid(parent, geometry, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new T.Mesh(own(geometry), typeof color === "string" ? (opts.flat || opts.metal != null || opts.emissive ? own(new T.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.7, flatShading: !!opts.flat, metalness: opts.metal ?? 0, emissive: opts.emissive || "#000000", emissiveIntensity: opts.glow ?? 1 })) : material(color, opts.roughness ?? 0.65)) : color);
  m.position.set(x, y, z);
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
// Invisible-but-pickable panel so snowballs and the mouse hit thin things such as nets.
export function ghost(parent, w, h, d, x, y, z) {
  const m = new T.Mesh(own(new T.BoxGeometry(w, h, d)), own(new T.MeshBasicMaterial({ color: "#d5cadf", transparent: true, opacity: 0.035, depthWrite: false })));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// ——— Кинозал ———
function bigcube(g, p) {
  const [c] = p.colliders;
  box(g, c.w, c.h, c.d, "#9988b5", 0, c.h / 2, 0, 0.12);
  box(g, c.w - 0.24, 0.03, c.d - 0.24, "#b5a5cc", 0, c.h + 0.012, 0, 0.04);
  for (const x of [-c.w / 2 + 0.09, c.w / 2 - 0.09]) box(g, 0.022, c.h - 0.3, 0.025, "#c5b2df", x, c.h / 2, c.d / 2 - 0.003, 0.005);
}
function pyramid(g, p) {
  p.colliders.forEach((tier, i) => {
    box(g, tier.w, 0.64, tier.d, ["#b69d7e", "#c2aa89", "#cfb795", "#dac5a6"][i % 4], 0, i * 0.64 + 0.32, 0, 0.055);
    box(g, tier.w - 0.12, 0.025, tier.d - 0.12, "#e4d1ae", 0, tier.h + 0.008, 0, 0.025);
  });
}
function spool(g, p) {
  const h = p.h;
  cyl(g, 1.25, 1.25, 0.17, "#b18a60", 0, 0.085);
  cyl(g, 0.61, 0.61, h - 0.25, "#96714e", 0, h / 2);
  cyl(g, 1.25, 1.25, 0.17, "#c5a37a", 0, h - 0.085);
  cyl(g, 0.14, 0.14, 0.006, "#534433", 0, h + 0.004);
  for (const y of [0.04, h - 0.14])
    for (let i = -3; i <= 3; i++) {
      const x = i * 0.3,
        dz = Math.sqrt(1.23 ** 2 - x * x);
      lines(g, [[x, y + 0.145, -dz], [x, y + 0.145, dz]], "#8b6746", 0.65);
    }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ball(g, "#64584b", Math.cos(a) * 0.9, h + 0.008, Math.sin(a) * 0.9, 0.045, 0.018, 0.045);
  }
  for (let i = 0; i < 18; i++) {
    const a = (i * Math.PI) / 9;
    lines(g, [[Math.sin(a) * 0.612, 0.18, Math.cos(a) * 0.612], [Math.sin(a) * 0.612, h - 0.18, Math.cos(a) * 0.612]], "#c8a77c", 0.55);
  }
}
export function goal(g, p, colors = { post: "#e9e5ed", base: "#a399b2", net: "#d5cadf" }) {
  for (const x of [-2.1, 2.1]) {
    box(g, 0.15, 2.55, 0.15, colors.post, x, 1.275, 0, 0.065);
    box(g, 0.11, 0.1, 1.5, colors.base, x, 0.05, -0.72, 0.04);
  }
  box(g, 4.35, 0.15, 0.15, colors.post, 0, 2.475, 0, 0.065);
  const net = [];
  for (let x = -2.1; x <= 2.11; x += 0.21) net.push([x, 0.08, -1.45], [x, 2.45, -1.45], [x, 2.45, -1.45], [x, 2.45, 0]);
  for (let y = 0.08; y <= 2.46; y += 0.2) {
    net.push([-2.1, y, -1.45], [2.1, y, -1.45]);
    for (const x of [-2.1, 2.1]) net.push([x, y, -1.45], [x, y, 0]);
  }
  for (let z = -1.45; z <= 0.01; z += 0.21) {
    net.push([-2.1, 2.45, z], [2.1, 2.45, z]);
    for (const x of [-2.1, 2.1]) net.push([x, 0.08, z], [x, 2.45, z]);
  }
  lines(g, net, colors.net, 0.5);
  // The net is translucent geometry too, so snowballs and picking hit it.
  ghost(g, 4.3, 2.55, 0.06, 0, 1.275, -1.45);
  ghost(g, 0.05, 2.55, 1.4, -2.1, 1.275, -0.75);
  ghost(g, 0.05, 2.55, 1.4, 2.1, 1.275, -0.75);
}

export const PROP_BUILDERS = { bigcube, pyramid, spool, goal };
// Maps add their own builders here (see maps' renderers).
export function registerProps(builders) {
  Object.assign(PROP_BUILDERS, builders);
}
export function buildProp(p) {
  const g = new T.Group();
  (PROP_BUILDERS[p.kind] || ((group) => box(group, 1, 1, 1, "#888")))(g, p);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow ??= true;
      o.receiveShadow = true;
    }
  });
  return g;
}

// ——— Balls ———
function football(g, b) {
  const r = b.size / 2;
  ball(g, "#f3eee6", 0, 0, 0, r);
  const vertices = new T.IcosahedronGeometry(1, 0).attributes.position;
  const directions = new Map();
  for (let i = 0; i < vertices.count; i++) {
    const v = new T.Vector3().fromBufferAttribute(vertices, i).normalize();
    directions.set(v.toArray().map((n) => n.toFixed(3)).join(), v);
  }
  for (const normal of directions.values()) {
    const geo = own(new T.CircleGeometry(r / 3, 5));
    const patch = new T.Mesh(geo, material("#302c36"));
    patch.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), normal);
    patch.position.copy(normal).multiplyScalar(r * 0.952);
    // Project the pentagon onto the sphere, rather than floating a flat decal.
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i);
      pos.setZ(i, Math.sqrt((r * 1.007) ** 2 - x * x - y * y) - r * 0.952);
    }
    geo.computeVertexNormals();
    g.add(patch);
  }
}
function basketball(g, b) {
  const r = b.size / 2;
  ball(g, "#dd7a32", 0, 0, 0, r, r, r, 0.8);
  const seam = [];
  for (let i = 0; i < 64; i++) {
    const a0 = (i / 64) * Math.PI * 2,
      a1 = ((i + 1) / 64) * Math.PI * 2;
    const R = r * 1.004;
    seam.push([Math.cos(a0) * R, Math.sin(a0) * R, 0], [Math.cos(a1) * R, Math.sin(a1) * R, 0]);
    seam.push([0, Math.sin(a0) * R, Math.cos(a0) * R], [0, Math.sin(a1) * R, Math.cos(a1) * R]);
    seam.push([Math.cos(a0) * R, 0, Math.sin(a0) * R], [Math.cos(a1) * R, 0, Math.sin(a1) * R]);
  }
  lines(g, seam, "#3a2216", 0.9);
}
function playball(g, b) {
  const r = b.size / 2;
  ball(g, b.color || "#e8574f", 0, 0, 0, r, r, r, 0.35);
  ball(g, "#ffffff", 0, r * 0.55, r * 0.55, r * 0.18, r * 0.18, r * 0.05, 0.3);
}
function stone(g, b) {
  const r = b.size / 2;
  const m = solid(g, new T.DodecahedronGeometry(r, 1), b.color || "#8d8a84", 0, 0, 0, { flat: true, roughness: 0.95 });
  const pos = m.geometry.attributes.position,
    seed = (b.id || "s").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.82 + 0.3 * Math.abs(Math.sin(seed * 0.37 + i * 1.7));
    pos.setXYZ(i, pos.getX(i) * k * 1.15, pos.getY(i) * k * 0.78, pos.getZ(i) * k);
  }
  m.geometry.computeVertexNormals();
}
function barrel(g, b) {
  const r = b.size / 2;
  cyl(g, r * 0.9, r * 0.9, r * 2, "#8a5a32", 0, 0, 0, 20);
  for (const y of [-r * 0.65, r * 0.65]) cyl(g, r * 0.93, r * 0.93, 0.05, "#3e3a36", 0, y, 0, 20, { roughness: 0.4 });
}
function mug(g, b) {
  const r = b.size / 2;
  cyl(g, r * 0.7, r * 0.62, r * 1.6, own(new T.MeshStandardMaterial({ color: "#e9c76a", roughness: 0.2, transparent: true, opacity: 0.85 })), 0, 0, 0, 16);
  cyl(g, r * 0.68, r * 0.68, r * 0.3, "#fbf3e2", 0, r * 0.75, 0, 16);
  const handle = solid(g, new T.TorusGeometry(r * 0.35, r * 0.08, 6, 12, Math.PI), "#e9c76a", r * 0.75, 0, 0);
  handle.rotation.z = -Math.PI / 2;
}
export const BALL_BUILDERS = { football, basketball, playball, stone, pebble: stone, barrel, mug, paintball: playball };
export function buildBall(b) {
  const g = new T.Group();
  (BALL_BUILDERS[b.kind] || football)(g, b);
  return g;
}
// Frees what a builder created (owned geometry and materials); shared caches stay.
export function disposeOwned(root) {
  root.traverse((o) => {
    if (o.geometry?.userData.own) o.geometry.dispose();
    for (const m of [o.material].flat()) if (m?.userData?.own) m.dispose();
  });
}
