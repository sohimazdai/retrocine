// How the paintball field looks: inflatable bunkers, hay, knocked-over tables, team flags.
import * as T from "three";
import { registerProps } from "../props.js";
import { registerDecor } from "../mapscene.js";
import { mat, mesh, merge, placed, worldBox, TEXTURES, rng } from "./kit.js";
import { tube } from "./sides.look.js";

function towerDeck(group, s) {
  const tex = TEXTURES.wood(),
    wood = mat(tex ? "#d9b48d" : "#8a5a35", { map: tex, roughness: 0.85 });
  mesh(group, worldBox(s.w, s.h - s.y, s.d, 1.2), wood, s.x, (s.h + s.y) / 2, s.z);
  // A roof on four poles and a team banner.
  const color = s.team === "blue" ? "#2f6fd8" : "#d8432f",
    pole = mat("#5a4632", { roughness: 0.8 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tube(group, [s.x + sx * (s.w / 2 - 0.1), s.h, s.z + sz * (s.d / 2 - 0.1)], [s.x + sx * (s.w / 2 - 0.1), s.h + 2.0, s.z + sz * (s.d / 2 - 0.1)], 0.05, pole);
  const roof = mesh(group, new T.ConeGeometry(Math.hypot(s.w, s.d) / 2 + 0.2, 0.7, 4), mat(color, { roughness: 0.7, flat: true }), s.x, s.h + 2.35, s.z);
  roof.rotation.y = Math.PI / 4;
  const banner = mesh(group, new T.PlaneGeometry(0.9, 1.2), mat(color, { side: T.DoubleSide, roughness: 0.8 }), s.x - Math.sign(s.x) * (s.w / 2 + 0.02), s.y - 0.7, s.z, false);
  banner.rotation.y = Math.PI / 2;
  // Ladder on the field side.
  const lx = s.x - Math.sign(s.x) * (s.w / 2 + 0.06),
    rail = mat("#6b5238", { roughness: 0.8 });
  for (const dz of [-0.32, 0.32]) tube(group, [lx, 0, s.z + dz], [lx, s.h + 0.6, s.z + dz], 0.035, rail);
  for (let y = 0.3; y < s.h; y += 0.32) tube(group, [lx, y, s.z - 0.32], [lx, y, s.z + 0.32], 0.025, rail);
}
function parapet(group, s) {
  const tex = TEXTURES.wood();
  mesh(group, worldBox(s.w, s.h - s.y, s.d, 1.2), mat(tex ? "#c49a6c" : "#8a5a35", { map: tex, roughness: 0.85 }), s.x, (s.h + s.y) / 2, s.z);
}
// Sandbags stacked in staggered rows.
function sandbags(group, s) {
  const parts = [],
    along = s.d >= s.w,
    len = along ? s.d : s.w,
    rows = Math.round(s.h / 0.24);
  for (let row = 0; row < rows; row++) {
    const n = Math.floor(len / 0.6),
      off = row % 2 ? 0.3 : 0;
    for (let i = 0; i < n - (row % 2); i++) {
      const t = -len / 2 + 0.3 + off + i * 0.6;
      parts.push(placed(new T.CapsuleGeometry(0.12, 0.34, 4, 8), s.x + (along ? 0 : t), 0.12 + row * 0.23, s.z + (along ? t : 0), along ? 0 : Math.PI / 2, Math.PI / 2, 0, [1.5, 1, 0.75]));
    }
  }
  mesh(group, merge(parts), mat("#b49a6a", { roughness: 0.95 }));
}

// Inflatables: glossy fabric with darker seams.
const fabric = (color) => mat(color, { roughness: 0.35, metal: 0.05 });
const seam = (color) => mat(new T.Color(color).multiplyScalar(0.6).getStyle(), { roughness: 0.5 });
function capsule(g, length, radius, material, x, y, z, ry = 0) {
  const m = mesh(g, new T.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 6, 18), material, x, y, z);
  m.rotation.set(0, ry, Math.PI / 2);
  return m;
}
function snake(g, p) {
  const c = p.colliders[0],
    color = p.color || "#d8432f";
  const r = c.h / 2,
    n = 5,
    seg = c.w / n;
  for (let i = 0; i < n; i++) capsule(g, seg + r * 0.9, r, fabric(color), -c.w / 2 + seg * (i + 0.5), r, 0);
  for (let i = 1; i < n; i++) {
    const ring = mesh(g, new T.TorusGeometry(r * 0.96, 0.03, 6, 20), seam(color), -c.w / 2 + seg * i, r, 0);
    ring.rotation.y = Math.PI / 2;
  }
  mesh(g, new T.BoxGeometry(c.w - 0.4, 0.04, 0.06), mat("#1d1d22"), 0, r * 1.5, c.d / 2 - 0.12);
}
function dorito(g, p) {
  const c = p.colliders[0];
  const m = mesh(g, new T.ConeGeometry(c.radius * 1.15, c.h, 3, 1), mat(p.color || "#2f6fd8", { roughness: 0.35, flat: true }), 0, c.h / 2, 0);
  m.rotation.y = 0.3;
  const stripe = mesh(g, new T.ConeGeometry(c.radius * 0.62, c.h * 0.46, 3, 1, true), mat("#f6f2ea", { roughness: 0.4, flat: true, side: T.DoubleSide }), 0, c.h * 0.77 + 0.002, 0);
  stripe.rotation.y = 0.3;
}
function cake(g, p) {
  const c = p.colliders[0];
  mesh(g, new T.CylinderGeometry(c.radius, c.radius * 1.03, c.h * 0.8, 32), fabric(p.color || "#2b2b30"), 0, c.h * 0.4, 0);
  const top = mesh(g, new T.SphereGeometry(c.radius, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), fabric(p.color || "#2b2b30"), 0, c.h * 0.8, 0);
  top.scale.y = 0.24;
  mesh(g, new T.TorusGeometry(c.radius * 1.0, 0.05, 8, 40), mat("#f2c14e"), 0, c.h * 0.5, 0).rotation.x = Math.PI / 2;
}
function can(g, p) {
  const c = p.colliders[0];
  mesh(g, new T.CapsuleGeometry(c.radius, c.h - c.radius * 2, 8, 24), fabric(p.color || "#d8432f"), 0, c.h / 2, 0);
  for (const y of [0.35, c.h - 0.45]) mesh(g, new T.TorusGeometry(c.radius * 1.0, 0.035, 6, 28), seam(p.color || "#d8432f"), 0, y, 0).rotation.x = Math.PI / 2;
}
function brick(g, p) {
  const c = p.colliders[0];
  const body = mesh(g, new T.CapsuleGeometry(c.d / 2, c.w - c.d, 8, 18), fabric(p.color || "#2b2b30"), 0, c.h / 2, 0);
  body.rotation.z = Math.PI / 2;
  body.scale.set(c.h / c.d, 1, 1);
  mesh(g, new T.BoxGeometry(c.w * 0.6, 0.06, 0.02), mat("#f2c14e"), 0, c.h * 0.6, c.d / 2 + 0.01);
}
function haystack(g, p) {
  const c = p.colliders[0],
    tex = TEXTURES.hay();
  const hay = mat(tex ? "#ffffff" : "#d8b55a", { map: tex, roughness: 1 });
  const dome = mesh(g, new T.SphereGeometry(c.radius, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), hay, 0, 0, 0);
  dome.scale.y = c.h / c.radius;
  const r = rng(c.radius * 100 + p.x * 10);
  // Loose straws sticking out.
  const straw = mat("#e9cb74", { roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2,
      k = 0.2 + r() * 0.75;
    const y = c.h * Math.sqrt(1 - k * k) * 0.98,
      s = mesh(g, new T.CylinderGeometry(0.008, 0.008, 0.35, 3), straw, Math.cos(a) * c.radius * k, y, Math.sin(a) * c.radius * k, false);
    s.rotation.set(r() - 0.5, r(), (r() - 0.5) * 1.6);
  }
  const rope = mat("#8a6a3a");
  mesh(g, new T.TorusGeometry(c.radius * 0.86, 0.025, 6, 32), rope, 0, c.h * 0.5, 0).rotation.x = Math.PI / 2;
}
function tableDown(g, p) {
  const c = p.colliders[0],
    tex = TEXTURES.wood();
  const wood = mat(tex ? "#d9b48d" : "#9a6a43", { map: tex, roughness: 0.8 });
  mesh(g, new T.BoxGeometry(c.w, c.h, 0.07), wood, 0, c.h / 2, 0);
  mesh(g, new T.BoxGeometry(c.w, 0.12, 0.05), mat("#6b4529"), 0, c.h - 0.06, -0.06);
  const legMat = mat("#6b4529", { roughness: 0.8 });
  for (const x of [-c.w / 2 + 0.14, c.w / 2 - 0.14])
    for (const y of [0.14, c.h - 0.14]) mesh(g, new T.CylinderGeometry(0.04, 0.035, 0.72, 8), legMat, x, y, -0.4).rotation.x = Math.PI / 2;
  // Paint hits from earlier games.
  const r = rng(Math.round(p.x * 31 + p.z * 17));
  for (let i = 0; i < 3; i++) {
    const splat = mesh(g, new T.CircleGeometry(0.06 + r() * 0.08, 10), mat(["#d8432f", "#2f6fd8", "#f2c14e"][i], { roughness: 0.4 }), (r() - 0.5) * c.w * 0.8, 0.2 + r() * 0.6, 0.04, false);
    splat.scale.y = 0.7 + r() * 0.6;
  }
}
registerProps({ snake, dorito, cake, can, brick, haystack, "table-down": tableDown });

// A weathered concrete barricade with a scuffed base and a few paint hits.
function barricade(group, s) {
  const g = new T.Group();
  g.position.set(s.x, 0, s.z);
  g.rotation.y = s.rot || 0;
  group.add(g);
  mesh(g, new T.BoxGeometry(s.w, s.h, s.d), mat("#9a9a90", { roughness: 0.95 }), 0, s.h / 2, 0);
  mesh(g, new T.BoxGeometry(s.w + 0.1, 0.2, s.d + 0.1), mat("#6f6f66", { roughness: 0.95 }), 0, 0.1, 0);
  const r = rng(Math.round(s.x * 11 + s.z * 7));
  for (let i = 0; i < 3; i++) {
    const front = r() < 0.5 ? 1 : -1;
    const splat = mesh(g, new T.CircleGeometry(0.12 + r() * 0.1, 10), mat(["#d8432f", "#2f6fd8", "#f2c14e"][i], { roughness: 0.8, opacity: 0.85, side: T.DoubleSide }), (r() - 0.5) * s.w * 0.8, 0.4 + r() * (s.h - 0.8), front * (s.d / 2 + 0.012), false);
    if (front < 0) splat.rotation.y = Math.PI;
  }
}
// A raised concrete platform.
function platform(group, s) {
  mesh(group, new T.BoxGeometry(s.w, s.h, s.d), mat("#8f8f84", { roughness: 0.95 }), s.x, s.h / 2, s.z);
  mesh(group, new T.BoxGeometry(s.w + 0.1, 0.12, s.d + 0.1), mat("#6f6f66", { roughness: 0.95 }), s.x, s.h - 0.06, s.z);
}
// A sloped ramp wedge up one side of the hill.
function ramp(group, s) {
  const up = s.h1 >= s.h0,
    sign = up ? 1 : -1;
  const shape = new T.Shape([
    [-s.w / 2, 0],
    [s.w / 2, 0],
    [sign * (s.w / 2), s.h],
  ].map(([x, y]) => new T.Vector2(x, y)));
  const geo = new T.ExtrudeGeometry(shape, { depth: s.d, bevelEnabled: false });
  geo.translate(0, 0, -s.d / 2);
  mesh(group, geo, mat("#86867b", { roughness: 0.95 }), s.x, 0, s.z);
}
// A wooden crate.
function crate(group, s) {
  mesh(group, new T.BoxGeometry(s.w, s.h, s.d), mat("#9a6b3c", { roughness: 0.85 }), s.x, s.h / 2, s.z);
  const edge = mat("#6f4a28", { roughness: 0.8 });
  for (const sy of [0.5, -0.5]) for (const sx of [1, -1]) mesh(group, new T.BoxGeometry(0.08, s.h * 0.96, s.d * 0.98), edge, s.x + sx * s.w * 0.46, s.h / 2 + sy * 0.001, s.z);
  mesh(group, new T.BoxGeometry(s.w * 0.98, 0.08, s.d * 0.98), edge, s.x, s.h - 0.04, s.z);
}
// A low earth berm with a grassy cap.
function berm(group, s) {
  mesh(group, new T.BoxGeometry(s.w, s.h, s.d), mat("#6b5a3c", { roughness: 1 }), s.x, s.h / 2, s.z);
  const cap = mesh(group, new T.SphereGeometry(1, 12, 6), mat("#5d7a3c", { roughness: 1 }), s.x, s.h, s.z);
  cap.scale.set(s.w / 2, 0.25, s.d / 2);
}
registerDecor("paintball", (group, map) => {
  for (const s of map.statics || []) {
    if (s.kind === "tower-deck") towerDeck(group, s);
    if (s.kind === "tower-post") mesh(group, new T.BoxGeometry(s.w, s.h, s.d), mat("#5a4632", { roughness: 0.8 }), s.x, s.h / 2, s.z);
    if (s.kind === "parapet") parapet(group, s);
    if (s.kind === "sandbags") sandbags(group, s);
    if (s.kind === "barricade") barricade(group, s);
    if (s.kind === "platform") platform(group, s);
    if (s.kind === "ramp") ramp(group, s);
    if (s.kind === "crate") crate(group, s);
    if (s.kind === "berm") berm(group, s);
  }
  const flags = [];
  for (const s of (map.statics || []).filter((s) => s.kind === "flag")) {
    const color = s.team === "blue" ? "#2f6fd8" : "#d8432f";
    mesh(group, new T.CylinderGeometry(s.radius * 0.5, s.radius * 0.6, s.h, 10), mat("#d8d6d0", { roughness: 0.4, metal: 0.5 }), s.x, s.h / 2, s.z);
    mesh(group, new T.CylinderGeometry(0.5, 0.6, 0.12, 16), mat("#3a3a3e"), s.x, 0.06, s.z);
    const cloth = mesh(group, new T.PlaneGeometry(1.2, 0.75, 12, 4), mat(color, { side: T.DoubleSide, roughness: 0.8 }), s.x + (s.x < 0 ? 0.62 : -0.62), s.h - 0.45, s.z, false);
    flags.push({ cloth, rest: Float32Array.from(cloth.geometry.attributes.position.array), dir: s.x < 0 ? 1 : -1 });
    // Base marking on the ground.
    const ring = mesh(group, new T.RingGeometry(2.2, 2.32, 48), mat(color, { opacity: 0.6, roughness: 0.9 }), s.x, 0.012, s.z, false);
    ring.rotation.x = -Math.PI / 2;
  }
  // Centre line and tyre stacks at the corners.
  const k = map.scale || 1,
    line = mesh(group, new T.PlaneGeometry(0.1, 21 * k), mat("#ffffff", { opacity: 0.5 }), 0, 0.012, -0.5 * k, false);
  line.rotation.x = -Math.PI / 2;
  const tyre = mat("#1f1f22", { roughness: 0.9 });
  for (const s of (map.statics || []).filter((s) => s.kind === "tyres"))
    for (let i = 0; i < 3; i++) mesh(group, new T.TorusGeometry(0.42, 0.17, 8, 18), tyre, s.x, 0.17 + i * 0.3, s.z).rotation.x = Math.PI / 2;
  return {
    update(dt, t) {
      for (const f of flags) {
        const pos = f.cloth.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = f.rest[i * 3] * f.dir + 0.6;
          pos.setZ(i, Math.sin(t * 4 + x * 5) * 0.08 * x);
        }
        pos.needsUpdate = true;
      }
    },
  };
});
