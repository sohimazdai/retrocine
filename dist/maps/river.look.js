// How the mountain river looks: terraced rocky banks with pines, boulders and flowing water.
import * as T from "three";
import { registerDecor } from "../mapscene.js";
import { BALL_BUILDERS } from "../props.js";
import { mat, mesh, merge, placed, worldBox, TEXTURES, rng, rockGeometry, pine } from "./kit.js";
import { RIVER_ZONE } from "./river.js";

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
  // Pines on the high ledges.
  const r = rng(29);
  for (const c of statics.filter((s) => s.kind === "cliff" && s.tier === 2))
    if (r() < 0.75) pine(group, c.x + (r() - 0.5) * (c.w - 1), c.z + (r() - 0.5) * (c.d - 0.6), 2.6 + r() * 1.6, c.h, Math.floor(r() * 1e4));
  return {
    update(dt, t) {
      if (tex) tex.offset.y = ((t * RIVER_ZONE.flow.z) / 4) % 1;
    },
  };
});
