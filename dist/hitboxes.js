// Debug overlay: wireframes of what physics and hits actually use — map colliders, avatar bodies,
// balls and cubes, projectiles, explosion radii and the walkable floor edge. Seen only by the viewer
// who turned it on (Settings → Хитбоксы); drawn on top of everything and never picked or hit.
import * as T from "three";
import { RADIUS, LIMITS, sloped, surfaceOf } from "./physics.js";
import { floorBack } from "./layout.js";

export const HITBOX_COLORS = {
  static: "#4fd2ff",
  movable: "#6dff7c",
  lifted: "#ffae42",
  avatar: "#ff5fd2",
  object: "#ffffff",
  projectile: "#ff4848",
  blast: "#ff6a3d",
  bounds: "#4fd2ff",
  ghost: "#4fd2ff",
};
export const AVATAR_HEIGHT = 1.55;

const materials = new Map();
function lineMaterial(color, opacity = 0.9) {
  const key = color + opacity;
  if (!materials.has(key))
    materials.set(key, new T.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false }));
  return materials.get(key);
}
function segments(points) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(points, 3));
  return g;
}
function overlay(geometry, color, opacity) {
  const o = new T.LineSegments(geometry, lineMaterial(color, opacity));
  o.raycast = () => {};
  o.renderOrder = 999;
  o.frustumCulled = false;
  return o;
}
function circle(out, x, y, z, r, n = 32, plane = "xz") {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2,
      a1 = ((i + 1) / n) * Math.PI * 2;
    const p = (a) => (plane === "xz" ? [x + Math.cos(a) * r, y, z + Math.sin(a) * r] : plane === "xy" ? [x + Math.cos(a) * r, y + Math.sin(a) * r, z] : [x, y + Math.cos(a) * r, z + Math.sin(a) * r]);
    out.push(...p(a0), ...p(a1));
  }
}
function boxEdges(out, x0, y0, z0, x1, y1, z1) {
  for (const y of [y0, y1]) out.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
  for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) out.push(x, y0, z, x, y1, z);
}
// Edges of one physics collider in world space (see physics.js for the shapes).
export function colliderEdges(b, out = []) {
  const y0 = b.y || 0;
  if (b.shape === "cylinder") {
    circle(out, b.x, y0, b.z, b.radius);
    circle(out, b.x, b.h, b.z, b.radius);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2,
        x = b.x + Math.cos(a) * b.radius,
        z = b.z + Math.sin(a) * b.radius;
      out.push(x, y0, z, x, b.h, z);
    }
    return out;
  }
  const x0 = b.x - b.w / 2,
    x1 = b.x + b.w / 2,
    z0 = b.z - b.d / 2,
    z1 = b.z + b.d / 2;
  if (!sloped(b)) {
    boxEdges(out, x0, y0, z0, x1, b.h, z1);
    return out;
  }
  // Ramps and quarter pipes: the sampled top surface, its two side profiles, the base and the ends.
  const n = 12,
    ax = b.axis === "x";
  const at = (u, side) => {
    const x = ax ? x0 + (x1 - x0) * u : side ? x1 : x0,
      z = ax ? (side ? z1 : z0) : z0 + (z1 - z0) * u;
    return [x, surfaceOf(b, x, z), z];
  };
  for (let i = 0; i < n; i++)
    for (const side of [0, 1]) {
      out.push(...at(i / n, side), ...at((i + 1) / n, side));
    }
  for (let i = 0; i <= n; i += 3) out.push(...at(i / n, 0), ...at(i / n, 1));
  for (const u of [0, 1])
    for (const side of [0, 1]) {
      const [x, y, z] = at(u, side);
      if (y > y0 + 0.01) out.push(x, y0, z, x, y, z);
    }
  for (const [ax0, az0, ax1, az1] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]) out.push(ax0, y0, az0, ax1, y0, az1);
  return out;
}
// Where an avatar's centre may go: the room's side and front limits and the curved back edge.
export function boundsEdges(out = []) {
  const y = 0.03,
    n = 40;
  const back = (x) => floorBack(x) + RADIUS;
  for (let i = 0; i < n; i++) {
    const xa = -LIMITS.x + (2 * LIMITS.x * i) / n,
      xb = -LIMITS.x + (2 * LIMITS.x * (i + 1)) / n;
    out.push(xa, y, back(xa), xb, y, back(xb));
  }
  out.push(-LIMITS.x, y, LIMITS.z, LIMITS.x, y, LIMITS.z);
  for (const x of [-LIMITS.x, LIMITS.x]) out.push(x, y, back(x), x, y, LIMITS.z);
  return out;
}

const UNIT = {
  cylinder: (() => {
    const out = [];
    circle(out, 0, 0, 0, 1, 24);
    circle(out, 0, 1, 0, 1, 24);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      out.push(Math.cos(a), 0, Math.sin(a), Math.cos(a), 1, Math.sin(a));
    }
    return segments(out);
  })(),
  sphere: (() => {
    const out = [];
    for (const plane of ["xz", "xy", "yz"]) circle(out, 0, 0, 0, 1, 24, plane);
    return segments(out);
  })(),
  box: (() => {
    const out = [];
    boxEdges(out, -0.5, -0.5, -0.5, 0.5, 0.5, 0.5);
    return segments(out);
  })(),
};

export class HitboxView {
  constructor(scene) {
    this.group = new T.Group();
    this.group.name = "hitboxes";
    this.group.visible = false;
    this.group.raycast = () => {};
    scene.add(this.group);
    this.statics = new T.Group();
    this.dynamic = new T.Group();
    this.group.add(this.statics, this.dynamic);
    this.pool = [];
    this.blasts = [];
    this.version = null;
    this.enabled = false;
  }
  setEnabled(on, mapScene) {
    this.enabled = !!on;
    this.group.visible = this.enabled;
    this.version = null;
    if (!this.enabled) {
      for (const b of this.blasts) {
        this.group.remove(b.mesh);
        b.mesh.material.dispose();
      }
      this.blasts = [];
    }
    if (mapScene) this.showGhosts(mapScene);
  }
  // Invisible hit panels (goal nets) become visible while hitboxes are shown.
  showGhosts(mapScene) {
    mapScene.root.traverse((o) => {
      if (!o.userData.ghost) return;
      o.material.opacity = this.enabled ? 0.28 : 0.035;
      o.material.color.set(this.enabled ? HITBOX_COLORS.ghost : "#d5cadf");
    });
  }
  rebuildStatics(mapScene) {
    for (const o of this.statics.children) o.geometry.dispose();
    this.statics.clear();
    const groups = { static: [], movable: [], lifted: [] };
    for (const b of mapScene.colliders()) {
      const prop = b.prop && mapScene.props.get(b.prop);
      const kind = !prop?.movable ? "static" : prop.y ? "lifted" : "movable";
      colliderEdges(b, groups[kind]);
    }
    for (const [kind, points] of Object.entries(groups)) if (points.length) this.statics.add(overlay(segments(points), HITBOX_COLORS[kind]));
    this.statics.add(overlay(segments(boundsEdges()), HITBOX_COLORS.bounds, 0.45));
    this.showGhosts(mapScene);
    this.version = mapScene.version;
  }
  // A short-lived sphere showing how far an explosion reaches.
  blast(point, radius) {
    if (!this.enabled) return;
    const mesh = overlay(UNIT.sphere, HITBOX_COLORS.blast);
    mesh.material = new T.LineBasicMaterial({ color: HITBOX_COLORS.blast, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, toneMapped: false });
    mesh.position.copy(point);
    mesh.scale.setScalar(radius);
    this.group.add(mesh);
    this.blasts.push({ mesh, age: 0 });
  }
  // bodies: avatars { x, y, z }; objects: balls and cubes { x, y, z, size, cube }; projectiles { x, y, z, r }.
  update(dt, { mapScene, bodies = [], objects = [], projectiles = [] }) {
    if (!this.enabled) return;
    if (this.version !== mapScene.version) this.rebuildStatics(mapScene);
    let used = 0;
    const put = (geometry, color, x, y, z, sx, sy = sx, sz = sx) => {
      let o = this.pool[used];
      if (!o) {
        o = overlay(geometry, color);
        this.pool.push(o);
        this.dynamic.add(o);
      }
      o.geometry = geometry;
      o.material = lineMaterial(color);
      o.position.set(x, y, z);
      o.scale.set(sx, sy, sz);
      o.visible = true;
      used++;
    };
    for (const b of bodies) put(UNIT.cylinder, HITBOX_COLORS.avatar, b.x, b.y, b.z, RADIUS, AVATAR_HEIGHT, RADIUS);
    for (const o of objects) {
      if (o.cube) put(UNIT.box, HITBOX_COLORS.object, o.x, o.y, o.z, o.size);
      else put(UNIT.sphere, HITBOX_COLORS.object, o.x, o.y, o.z, o.size / 2);
    }
    for (const p of projectiles) put(UNIT.sphere, HITBOX_COLORS.projectile, p.x, p.y, p.z, Math.max(0.05, p.r));
    for (let i = used; i < this.pool.length; i++) this.pool[i].visible = false;
    for (const b of this.blasts) {
      b.age += dt;
      b.mesh.material.opacity = Math.max(0, 0.9 * (1 - b.age / 1.4));
    }
    this.blasts = this.blasts.filter((b) => {
      if (b.age < 1.4) return true;
      this.group.remove(b.mesh);
      b.mesh.material.dispose();
      return false;
    });
    this.used = used;
  }
}
