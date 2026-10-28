// Common looks for the side strips of the maps (see maps/sides.js): fences, pull-up bars, monkey
// bars, landings and the climbing cube. Registered for every map; a map picks them by `kind`.
import * as T from "three";
import { registerStatics } from "../mapscene.js";
import { lines, ghost } from "../props.js";
import { mat, mesh } from "./kit.js";

const STEEL = "#c3c8cf";
// A tube between two points.
export function tube(parent, a, b, r, material) {
  const va = new T.Vector3(...a),
    vb = new T.Vector3(...b);
  const m = mesh(parent, new T.CylinderGeometry(r, r, va.distanceTo(vb), 8), material);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}
// Diagonal chain-link diamonds over a rectangle in the plane x = const (z0..z1, y0..y1).
function diamonds(x, z0, z1, y0, y1, cell) {
  const pts = [],
    h = y1 - y0;
  for (let o = -h; o < z1 - z0; o += cell)
    for (const dir of [1, -1]) {
      // Line z = z0 + o + dir·(y − y0) for "/" and the mirror for "\".
      let za = dir > 0 ? z0 + o : z0 + o + h,
        zb = dir > 0 ? z0 + o + h : z0 + o,
        ya = y0,
        yb = y1;
      const clip = (zEnd, zOther, yEnd, yOther) => {
        if (zEnd < z0) return [z0, yEnd + ((z0 - zEnd) / (zOther - zEnd)) * (yOther - yEnd)];
        if (zEnd > z1) return [z1, yEnd + ((z1 - zEnd) / (zOther - zEnd)) * (yOther - yEnd)];
        return [zEnd, yEnd];
      };
      if ((za < z0 && zb < z0) || (za > z1 && zb > z1)) continue;
      [za, ya] = clip(za, zb, ya, yb);
      [zb, yb] = clip(zb, za, yb, ya);
      pts.push([x, ya, za], [x, yb, zb]);
    }
  return pts;
}
function fence(group, s) {
  const z0 = s.z - s.d / 2,
    z1 = s.z + s.d / 2,
    n = Math.max(1, Math.round(s.d / 2.4));
  const net = s.style === "net",
    post = mat(s.color || (net ? "#2a2d33" : "#7e8a96"), { roughness: 0.45, metal: net ? 0.1 : 0.55 });
  for (let i = 0; i <= n; i++) {
    const z = z0 + (i * s.d) / n;
    mesh(group, new T.CylinderGeometry(net ? 0.06 : 0.045, net ? 0.07 : 0.05, s.h, 8), post, s.x, s.h / 2, z);
  }
  tube(group, [s.x, s.h - 0.03, z0], [s.x, s.h - 0.03, z1], net ? 0.015 : 0.03, post);
  if (!net) tube(group, [s.x, 0.12, z0], [s.x, 0.12, z1], 0.02, post);
  lines(group, net ? squares(s.x, z0, z1, 0, s.h, 0.22) : diamonds(s.x, z0, z1, 0.05, s.h - 0.05, 0.2), net ? "#1d1f24" : "#b9c1c9", net ? 0.75 : 0.55);
  // Snowballs and paint hit the fence: a nearly invisible panel catches them.
  ghost(group, 0.04, s.h, s.d, s.x, s.h / 2, s.z);
}
function squares(x, z0, z1, y0, y1, cell) {
  const pts = [];
  for (let z = z0; z <= z1 + 1e-6; z += cell) pts.push([x, y0, z], [x, y1, z]);
  for (let y = y0; y <= y1 + 1e-6; y += cell) pts.push([x, y, z0], [x, y, z1]);
  return pts;
}
function barPost(group, s) {
  mesh(group, new T.CylinderGeometry(0.045, 0.05, s.h, 10), mat(s.color || "#3f86b8", { roughness: 0.4, metal: 0.3 }), s.x, s.h / 2, s.z);
  mesh(group, new T.SphereGeometry(0.055, 10, 8), mat(s.color || "#3f86b8", { roughness: 0.4, metal: 0.3 }), s.x, s.h, s.z, false);
}
function turnik(group, s) {
  const along = s.w >= s.d;
  const a = along ? [s.x - s.w / 2, s.y, s.z] : [s.x, s.y, s.z - s.d / 2],
    b = along ? [s.x + s.w / 2, s.y, s.z] : [s.x, s.y, s.z + s.d / 2];
  tube(group, a, b, 0.024, mat(STEEL, { roughness: 0.25, metal: 0.8 }));
  // Grip tape in the middle.
  const mid = [(a[0] + b[0]) / 2, s.y, (a[2] + b[2]) / 2],
    k = 0.3;
  tube(group, [mid[0] - (along ? k : 0), s.y, mid[2] - (along ? 0 : k)], [mid[0] + (along ? k : 0), s.y, mid[2] + (along ? 0 : k)], 0.028, mat("#2b2d33", { roughness: 0.9 }));
}
function monkeyBars(group, s) {
  const z0 = s.z - s.d / 2,
    z1 = s.z + s.d / 2,
    rail = mat(s.color || "#f2c14e", { roughness: 0.4, metal: 0.3 }),
    rung = mat(STEEL, { roughness: 0.25, metal: 0.8 });
  for (const side of [-1, 1]) tube(group, [s.x + side * 0.38, s.y, z0 - 0.4], [s.x + side * 0.38, s.y, z1 + 0.4], 0.035, rail);
  for (let z = z0 + 0.15; z <= z1 - 0.1; z += 0.32) tube(group, [s.x - 0.38, s.y, z], [s.x + 0.38, s.y, z], 0.022, rung);
}
function landing(group, s) {
  const top = mat(s.color || "#e4573f", { roughness: 0.6 }),
    leg = mat("#3a4a58", { roughness: 0.5, metal: 0.3 });
  mesh(group, new T.BoxGeometry(s.w, 0.08, s.d), top, s.x, s.h - 0.04, s.z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(group, new T.BoxGeometry(0.06, s.h - 0.08, 0.06), leg, s.x + sx * (s.w / 2 - 0.05), (s.h - 0.08) / 2, s.z + sz * (s.d / 2 - 0.05));
  // A short ladder on the room side.
  const fx = s.x > 0 ? s.x - s.w / 2 - 0.02 : s.x + s.w / 2 + 0.02;
  for (let y = 0.3; y < s.h; y += 0.3) tube(group, [fx, y, s.z - 0.25], [fx, y, s.z + 0.25], 0.018, leg);
}
function gym(group, s) {
  const frame = mat(s.color || "#e4573f", { roughness: 0.4, metal: 0.3 }),
    deck = mat("#e0a457", { roughness: 0.75 });
  const x0 = s.x - s.w / 2,
    x1 = s.x + s.w / 2,
    z0 = s.z - s.d / 2,
    z1 = s.z + s.d / 2;
  for (const x of [x0, x1]) for (const z of [z0, z1]) tube(group, [x, 0, z], [x, s.h, z], 0.045, frame);
  for (const y of [s.h]) {
    tube(group, [x0, y, z0], [x1, y, z0], 0.04, frame);
    tube(group, [x0, y, z1], [x1, y, z1], 0.04, frame);
    tube(group, [x0, y, z0], [x0, y, z1], 0.04, frame);
    tube(group, [x1, y, z0], [x1, y, z1], 0.04, frame);
  }
  mesh(group, new T.BoxGeometry(s.w - 0.05, 0.07, s.d - 0.05), deck, s.x, s.h - 0.035, s.z);
  // Rope nets on every side.
  const rope = "#d9b46c";
  const net = [];
  for (const x of [x0, x1]) net.push(...squares(x, z0, z1, 0.05, s.h - 0.05, 0.3));
  for (const z of [z0, z1]) {
    for (let x = x0; x <= x1 + 1e-6; x += 0.3) net.push([x, 0.05, z], [x, s.h - 0.05, z]);
    for (let y = 0.05; y <= s.h; y += 0.3) net.push([x0, y, z], [x1, y, z]);
  }
  lines(group, net, rope, 0.9);
  ghost(group, s.w, s.h, s.d, s.x, s.h / 2, s.z);
  // A fireman's pole by the room-side front corner, joined to the deck by a short beam.
  const px = s.x - Math.sign(s.x) * (s.w / 2 + 0.45),
    pz = s.z + s.d / 2 - 0.2;
  tube(group, [px, 0, pz], [px, s.h + 0.9, pz], 0.04, mat(STEEL, { roughness: 0.2, metal: 0.85 }));
  tube(group, [px, s.h + 0.85, pz], [s.x - Math.sign(s.x) * (s.w / 2), s.h + 0.85, pz], 0.035, frame);
}
registerStatics({ fence, "bar-post": barPost, turnik, monkeybars: monkeyBars, landing, gym });
