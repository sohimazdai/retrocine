// How the mountain river looks: terraced rocky banks with pines, boulders and flowing water.
import * as T from "three";
import { registerDecor } from "../mapscene.js";
import { BALL_BUILDERS } from "../props.js";
import { mat, mesh, merge, placed, worldBox, TEXTURES, rng, rockGeometry, pine } from "./kit.js";
import { RIVER_ZONE } from "./river.js";
import { tube } from "./sides.look.js";

// The climbing crag: stacked, leaning blocks of rock with chalked holds up its river face.
function crag(group, s) {
  const r = rng(301),
    parts = [];
  for (let y = 0; y < s.h; y += 0.55) {
    const k = 1 - (y / s.h) * 0.25;
    parts.push(placed(rockGeometry(Math.floor(r() * 1e5)), s.x + (r() - 0.5) * 0.2, y + 0.3, s.z + (r() - 0.5) * 0.2, r() * 3, 0, 0, [(s.w / 2) * k * 1.05, 0.42, (s.d / 2) * k * 1.05]));
  }
  mesh(group, merge(parts), mat("#8a8377", { flat: true, roughness: 0.95 }));
  const holds = [];
  for (let i = 0; i < 22; i++) holds.push(placed(new T.IcosahedronGeometry(0.07, 0), s.x + s.w / 2 - 0.02, 2.9 + r() * (s.h - 3.0), s.z + (r() - 0.5) * (s.d - 0.4)));
  mesh(group, merge(holds), mat("#efeae0", { flat: true }));
  // A flat top to stand on, with a flag.
  mesh(group, new T.CylinderGeometry(Math.min(s.w, s.d) / 2, Math.min(s.w, s.d) / 2 + 0.1, 0.12, 9), mat("#9a9386", { flat: true }), s.x, s.h - 0.06, s.z);
  tube(group, [s.x - 0.5, s.h, s.z - 0.8], [s.x - 0.5, s.h + 1.2, s.z - 0.8], 0.025, mat("#d9dde3"));
  mesh(group, new T.PlaneGeometry(0.45, 0.28), mat("#e4573f", { side: T.DoubleSide }), s.x - 0.5, s.h + 1.05, s.z - 0.58, false).rotation.y = Math.PI / 2;
}
function zipLine(group, c) {
  const [fx, fy, fz] = c.from,
    [tx, ty, tz] = c.to,
    l = Math.hypot(tx - fx, tz - fz),
    ux = (tx - fx) / l,
    uz = (tz - fz) / l;
  const back = [fx - ux * 0.4, fy + 0.12, fz - uz * 0.4],
    ahead = [tx + ux * 0.4, ty + 0.1, tz + uz * 0.4];
  tube(group, back, ahead, 0.016, mat("#9aa0a8", { roughness: 0.3, metal: 0.8 }));
  const pole = mat("#5a4632", { roughness: 0.8 });
  for (const [x, y, z, base] of [
    [...back, 4.4],
    [...ahead, 2.6],
  ])
    tube(group, [x, base, z], [x, y + 0.2, z], 0.07, pole);
}
// Water falling down the right bank into the river, with spray at the foot.
function waterfall(group, s) {
  const tex = TEXTURES.water()?.clone();
  if (tex) {
    tex.needsUpdate = true;
    tex.repeat.set(0.5, 1.2);
  }
  const fall = mesh(group, new T.PlaneGeometry(1.1, 3.0, 1, 6), mat(tex ? "#d6f1ff" : "#8fd0e8", { map: tex, opacity: 0.8, emissive: "#16485a", glow: 0.5, side: T.DoubleSide, depthWrite: false }), s.x - 4.4, 1.5, s.z, false);
  fall.rotation.y = -Math.PI / 2;
  // Bend the sheet down the terraces: from the top ledge over to the beach.
  const pos = fall.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i),
      k = (1.5 - y) / 3;
    pos.setZ(i, pos.getZ(i));
    pos.setX(i, pos.getX(i));
    fall.geometry.attributes.position.setXYZ(i, pos.getX(i), y, -k * k * 2.2);
  }
  fall.geometry.computeVertexNormals();
  fall.position.x = s.x - 2.2;
  const spray = mesh(group, new T.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("#ffffff", { opacity: 0.5, depthWrite: false }), s.x - 5.0, 0.12, s.z, false);
  spray.scale.set(1.6, 0.5, 1.2);
  return { tex, spray };
}
function campfire(group, s) {
  const logs = mat("#6b4a2f", { roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    tube(group, [s.x + Math.cos(a) * 0.4, s.h - 0.25, s.z + Math.sin(a) * 0.4], [s.x + Math.cos(a) * 0.05, s.h + 0.05, s.z + Math.sin(a) * 0.05], 0.05, logs);
  }
  const ring = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    ring.push(placed(rockGeometry(i + 40), s.x + Math.cos(a) * s.radius, s.h - 0.22, s.z + Math.sin(a) * s.radius, a, 0, 0, [0.14, 0.1, 0.12]));
  }
  mesh(group, merge(ring), mat("#77736b", { flat: true }));
  const flame = mesh(group, new T.ConeGeometry(0.22, 0.6, 8), mat("#ffb347", { emissive: "#ff7a1a", glow: 2.2, opacity: 0.9, depthWrite: false }), s.x, s.h + 0.2, s.z, false);
  const light = new T.PointLight("#ff9a4a", 6, 7, 1.7);
  light.position.set(s.x, s.h + 0.6, s.z);
  group.add(light);
  // Log seats around it.
  for (const [dx, dz, ry] of [
    [-1.1, 0.4, 0.3],
    [0.2, 1.2, 1.5],
  ])
    tube(group, [s.x + dx - Math.cos(ry) * 0.5, s.h - 0.12, s.z + dz - Math.sin(ry) * 0.5], [s.x + dx + Math.cos(ry) * 0.5, s.h - 0.12, s.z + dz + Math.sin(ry) * 0.5], 0.16, logs);
  return { flame, light };
}

const CLIFF = ["#8b8478", "#7c766b", "#6f6a60"];

function cliffs(group, list) {
  const tex = TEXTURES.rock();
  const r = rng(91);
  const byTier = [[], [], []],
    tops = [],
    lumps = [];
  for (const c of list) {
    byTier[c.tier].push(placed(worldBox(c.w, c.h, c.d, 2.2), c.x, c.h / 2, c.z));
    // Moss and grass on the ledges.
    tops.push(placed(worldBox(c.w - 0.08, 0.05, c.d - 0.02, 2.2), c.x, c.h + 0.02, c.z));
    // Loose rocks and moss on the ledge.
    for (let i = 0; i < Math.ceil((c.w * c.d) / 6); i++) {
      const s = 0.12 + r() * 0.3;
      lumps.push(placed(rockGeometry(Math.floor(r() * 1e5)), c.x + (r() - 0.5) * (c.w - 0.4), c.h + s * 0.25, c.z + (r() - 0.5) * (c.d - 0.3), r() * 3, 0, 0, [s, s * 0.55, s * 0.9]));
    }
    // Boulders breaking up the face toward the river.
    const face = c.x > 0 ? c.x - c.w / 2 : c.x + c.w / 2;
    for (let i = 0; i < Math.ceil(c.d / 1.4); i++) {
      const s = 0.35 + r() * 0.35;
      lumps.push(placed(rockGeometry(Math.floor(r() * 1e5)), face + (c.x > 0 ? 0.05 : -0.05), c.h * (0.25 + r() * 0.5), c.z - c.d / 2 + (i + 0.5) * (c.d / Math.ceil(c.d / 1.4)), r() * 3, 0, 0, [s * 0.7, Math.min(s, c.h * 0.45), s]));
    }
  }
  // Lighter tint over the rock texture for the higher ledges, so the terraces read apart.
  const TINT = ["#d4cdc0", "#c6bfb2", "#b8b1a4"];
  byTier.forEach((parts, i) => parts.length && mesh(group, merge(parts), mat(tex ? TINT[i] : CLIFF[i], { map: tex, roughness: 0.95, flat: true })));
  mesh(group, merge(tops), mat(tex ? "#b9b59a" : "#8f8c78", { map: tex, roughness: 0.95 }));
  mesh(group, merge(lumps), mat("#857e72", { roughness: 0.95, flat: true }));
}
function boulders(group, list) {
  const parts = [],
    foam = [];
  list.forEach((b, i) => {
    parts.push(placed(rockGeometry(i * 17 + 3), b.x, b.h * 0.55, b.z, i, 0, 0, [b.radius * 1.02, b.h * 0.62, b.radius * 1.02]));
    foam.push(placed(new T.RingGeometry(b.radius * 0.98, b.radius * 1.35, 24), b.x, 0.19, b.z + 0.12, 0, -Math.PI / 2, 0, [1, 1.35, 1]));
  });
  mesh(group, merge(parts), mat("#77736b", { roughness: 0.9, flat: true }));
  const f = mesh(group, merge(foam), mat("#eef8ff", { opacity: 0.55, roughness: 0.4, depthWrite: false }), 0, 0, 0, false);
  return f;
}
function water(group) {
  const z = RIVER_ZONE,
    tex = TEXTURES.water()?.clone();
  if (tex) {
    tex.needsUpdate = true;
    tex.repeat.set((z.x1 - z.x0) / 4, 24 / 4);
  }
  // Riverbed under the water, then the moving surface on top.
  const bed = mesh(group, new T.PlaneGeometry(z.x1 - z.x0 + 0.6, 24), mat("#4d5a55", { roughness: 1 }), (z.x0 + z.x1) / 2, 0.01, -1.6, false);
  bed.rotation.x = -Math.PI / 2;
  const surface = mesh(group, new T.PlaneGeometry(z.x1 - z.x0 + 0.4, 24), mat(tex ? "#9fd3e6" : "#3f8aa5", { map: tex, roughness: 0.12, metal: 0.15, opacity: 0.78, emissive: "#0c3140", glow: 0.55, depthWrite: false }), (z.x0 + z.x1) / 2, 0.17, -1.6, false);
  surface.rotation.x = -Math.PI / 2;
  surface.renderOrder = 2;
  // Wet pebbles along both waterlines.
  const r = rng(13),
    stones = [];
  for (const side of [-1, 1])
    for (let k = 0; k < 34; k++) {
      const s = 0.12 + r() * 0.16;
      stones.push(placed(rockGeometry(k * 3 + (side > 0 ? 1 : 2)), side * (4.65 + r() * 0.5), s * 0.4, -12 + k * 0.66 + r() * 0.3, r() * 3, 0, 0, [s, s * 0.6, s]));
    }
  mesh(group, merge(stones), mat("#6d6a63", { roughness: 0.8, flat: true }));
  return tex;
}
// Big round stones that roll with the current.
BALL_BUILDERS.boulder = BALL_BUILDERS.stone;

registerDecor("river", (group, map) => {
  const statics = map.statics || [];
  cliffs(
    group,
    statics.filter((s) => s.kind === "cliff"),
  );
  boulders(
    group,
    statics.filter((s) => s.kind === "boulder"),
  );
  const tex = water(group);
  let fall = null,
    fire = null;
  for (const s of statics) {
    if (s.kind === "crag") crag(group, s);
    if (s.kind === "waterfall") fall = waterfall(group, s);
    if (s.kind === "campfire") fire = campfire(group, s);
  }
  for (const c of map.climbs || []) if (c.kind === "zip") zipLine(group, c);
  // Pines on the high ledges.
  const r = rng(29);
  for (const c of statics.filter((s) => s.kind === "cliff" && s.tier === 2))
    if (r() < 0.75) pine(group, c.x + (r() - 0.5) * (c.w - 1), c.z + (r() - 0.5) * (c.d - 0.6), 2.6 + r() * 1.6, c.h, Math.floor(r() * 1e4));
  return {
    update(dt, t) {
      if (tex) tex.offset.y = ((t * RIVER_ZONE.flow.z) / 4) % 1;
      if (fall?.tex) fall.tex.offset.y = (t * 1.4) % 1;
      if (fall) fall.spray.scale.y = 0.45 + Math.sin(t * 9) * 0.06;
      if (fire) {
        fire.flame.scale.set(1 + Math.sin(t * 17) * 0.12, 1 + Math.sin(t * 11) * 0.2, 1 + Math.cos(t * 13) * 0.12);
        fire.light.intensity = 5.5 + Math.sin(t * 19) * 1.2;
      }
    },
  };
});
