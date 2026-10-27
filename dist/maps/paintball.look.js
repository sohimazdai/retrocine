// How the paintball field looks: inflatable bunkers, hay, knocked-over tables, team flags.
import * as T from "three";
import { registerProps } from "../props.js";
import { registerDecor } from "../mapscene.js";
import { mat, mesh, TEXTURES, rng } from "./kit.js";

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

registerDecor("paintball", (group, map) => {
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
  const line = mesh(group, new T.PlaneGeometry(0.1, 21), mat("#ffffff", { opacity: 0.5 }), 0, 0.012, -0.5, false);
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
