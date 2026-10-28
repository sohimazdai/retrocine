// How the rope park looks: trees with plank platforms, a swaying plank bridge and a balance log,
// hanging ropes, a cargo net, a climbing tower with holds, trampolines and two zip lines.
import * as T from "three";
import { registerDecor } from "../mapscene.js";
import { lines } from "../props.js";
import { mat, mesh, merge, placed, worldBox, TEXTURES, rng } from "./kit.js";

const ROPE = "#c9a46a",
  WOOD = "#b98a5a";

function cylinderBetween(parent, a, b, r, material) {
  const va = new T.Vector3(...a),
    vb = new T.Vector3(...b);
  const m = mesh(parent, new T.CylinderGeometry(r, r, va.distanceTo(vb), 8), material);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}
function planks(s, gap = 0.04) {
  const along = s.w >= s.d,
    len = along ? s.w : s.d,
    n = Math.max(3, Math.round(len / 0.28)),
    parts = [];
  for (let i = 0; i < n; i++) {
    const t = -len / 2 + (i + 0.5) * (len / n);
    const pw = along ? len / n - gap : s.w,
      pd = along ? s.d : len / n - gap;
    parts.push(placed(worldBox(pw, s.h - s.y, pd, 1.2), s.x + (along ? t : 0), (s.h + s.y) / 2, s.z + (along ? 0 : t)));
  }
  return merge(parts);
}

registerDecor("ropepark", (group, map) => {
  const statics = map.statics || [],
    climbs = map.climbs || [];
  const tex = TEXTURES.wood();
  const wood = mat(tex ? "#e8c9a0" : WOOD, { map: tex, roughness: 0.8 }),
    dark = mat("#6b4a2f", { roughness: 0.85 }),
    rope = mat(ROPE, { roughness: 0.95 }),
    r = rng(23);
  const sway = [];
  for (const s of statics) {
    if (s.kind === "tree") {
      mesh(group, new T.CylinderGeometry(s.radius * 0.85, s.radius * 1.15, s.h, 12), mat("#6e4b30", { roughness: 0.95 }), s.x, s.h / 2, s.z);
      for (let i = 0; i < 5; i++) {
        const leaf = mesh(group, new T.IcosahedronGeometry(1.1 + r() * 0.5, 1), mat(["#4c8a3f", "#5a9a49", "#437c38"][i % 3], { flat: true }), s.x + (r() - 0.5) * 2.2, s.h - 0.2 + r() * 0.9, s.z + (r() - 0.5) * 1.6);
        leaf.rotation.set(r(), r(), r());
      }
    }
    if (s.kind === "platform") {
      mesh(group, worldBox(s.w, s.h - s.y, s.d, 1.2), wood, s.x, (s.h + s.y) / 2, s.z);
      // Hatch next to the trunk, joists underneath.
      mesh(group, new T.BoxGeometry(0.7, 0.01, 0.7), dark, s.x + 0.75, s.h + 0.006, s.z + 0.75, false);
      for (const sx of [-1, 1]) mesh(group, new T.BoxGeometry(0.12, 0.16, s.d), dark, s.x + sx * (s.w / 2 - 0.3), s.y - 0.08, s.z);
      // Safety-rope posts at the corners.
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ])
        mesh(group, new T.CylinderGeometry(0.05, 0.05, 1.0, 8), dark, s.x + sx * (s.w / 2 - 0.08), s.h + 0.5, s.z + sz * (s.d / 2 - 0.08));
      const c = [
        [s.x - s.w / 2 + 0.08, s.h + 0.95, s.z - s.d / 2 + 0.08],
        [s.x + s.w / 2 - 0.08, s.h + 0.95, s.z - s.d / 2 + 0.08],
        [s.x + s.w / 2 - 0.08, s.h + 0.95, s.z + s.d / 2 - 0.08],
        [s.x - s.w / 2 + 0.08, s.h + 0.95, s.z + s.d / 2 - 0.08],
      ];
      lines(group, [c[0], c[1], c[1], c[2], c[0], c[3]], ROPE, 0.9);
    }
    if (s.kind === "post") mesh(group, new T.BoxGeometry(s.w, s.h, s.d), dark, s.x, s.h / 2, s.z);
    if (s.kind === "bridge" || s.kind === "beam") {
      const deck = new T.Group();
      if (s.kind === "bridge") mesh(deck, planks(s), wood);
      else {
        const log = mesh(deck, new T.CylinderGeometry(s.d / 2, s.d / 2, s.w, 14), mat("#8a6240", { roughness: 0.9 }), s.x, s.h - s.d / 2, s.z);
        log.rotation.z = Math.PI / 2;
      }
      // Hand lines on both sides (for the log: one overhead line).
      const sides = s.kind === "bridge" ? [-1, 1] : [0];
      for (const side of sides) {
        const z = s.z + (side * s.d) / 2,
          y = s.h + (s.kind === "bridge" ? 0.95 : 1.7);
        const pts = [];
        for (let i = 0; i <= 16; i++) {
          const t = i / 16,
            x = s.x - s.w / 2 + t * s.w;
          pts.push([x, y - Math.sin(t * Math.PI) * 0.18, z]);
        }
        lines(group, pts.flatMap((p, i) => (i ? [pts[i - 1], p] : [])), ROPE, 0.95);
      }
      group.add(deck);
      sway.push({ g: deck, s, amp: s.kind === "bridge" ? 0.035 : 0.015 });
    }
    if (s.kind === "tower") {
      mesh(group, worldBox(s.w, s.h, s.d, 1.2), mat("#d9c7a5", { roughness: 0.85 }), s.x, s.h / 2, s.z);
      mesh(group, new T.BoxGeometry(s.w + 0.1, 0.08, s.d + 0.1), dark, s.x, s.h, s.z);
    }
    if (s.kind === "net") {
      const pts = [],
        x = s.x;
      for (let z = s.z - s.d / 2; z <= s.z + s.d / 2 + 1e-6; z += 0.3) pts.push([x, 0, z], [x, s.h, z]);
      for (let y = 0.15; y <= s.h; y += 0.3) pts.push([x, y, s.z - s.d / 2], [x, y, s.z + s.d / 2]);
      lines(group, pts, ROPE, 0.95);
    }
    if (s.kind === "stairs") {
      const n = 5,
        parts = [];
      for (let i = 0; i < n; i++) {
        const top = s.h0 - (i * s.h0) / n;
        parts.push(placed(worldBox(s.w, top, s.d / n, 1.2), s.x, top / 2, s.z - s.d / 2 + (i + 0.5) * (s.d / n)));
      }
      mesh(group, merge(parts), wood);
    }
    if (s.kind === "trampoline") {
      const pad = mesh(group, new T.TorusGeometry(s.radius - 0.1, 0.12, 10, 36), mat("#3f86b8", { roughness: 0.6 }), s.x, s.h - 0.05, s.z);
      pad.rotation.x = Math.PI / 2;
      const matt = mesh(group, new T.CircleGeometry(s.radius - 0.2, 36), mat("#22262c", { roughness: 0.9 }), s.x, s.h - 0.06, s.z);
      matt.rotation.x = -Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        mesh(group, new T.CylinderGeometry(0.04, 0.04, s.h, 6), mat("#3a4a58"), s.x + Math.cos(a) * (s.radius - 0.1), s.h / 2, s.z + Math.sin(a) * (s.radius - 0.1));
      }
    }
  }
  // Climbing tower holds, hanging ropes, zip lines.
  const holdColors = ["#e4573f", "#f2c14e", "#3f86b8", "#69b35a", "#9b6ad6"];
  for (const c of climbs) {
    if (c.kind === "wall") {
      const holds = holdColors.map(() => []);
      const [nx, nz] = { "+x": [1, 0], "-x": [-1, 0], "+z": [0, 1], "-z": [0, -1] }[c.face];
      for (let i = 0; i < 18; i++) {
        const along = (r() - 0.5) * ((nx ? c.d : c.w) - 0.3),
          y = 0.25 + r() * (c.y1 - 0.4);
        const x = nx ? c.x + (nx * c.w) / 2 + nx * 0.03 : c.x + along,
          z = nx ? c.z + along : c.z + (nz * c.d) / 2 + nz * 0.03;
        holds[i % holds.length].push(placed(new T.IcosahedronGeometry(0.07 + r() * 0.05, 0), x, y, z, r() * 3, r() * 3, 0, [1, 0.7, 0.6]));
      }
      holds.forEach((h, i) => h.length && mesh(group, merge(h), mat(holdColors[i], { flat: true, roughness: 0.6 })));
    }
    if (c.kind === "rope") {
      const g = new T.Group();
      g.position.set(c.x, c.y1 + 0.6, c.z);
      const len = c.y1 + 0.6 - c.y0;
      mesh(g, new T.CylinderGeometry(0.035, 0.035, len, 8), rope, 0, -len / 2, 0);
      for (let y = 0.6; y < len; y += 0.7) mesh(g, new T.SphereGeometry(0.06, 8, 6), rope, 0, -y, 0);
      mesh(g, new T.BoxGeometry(0.5, 0.08, 0.08), dark, 0, 0.04, 0);
      group.add(g);
      sway.push({ g, rope: true, phase: c.x });
    }
    if (c.kind === "zip") {
      const [fx, fy, fz] = c.from,
        [tx, ty, tz] = c.to;
      const cable = mat("#9aa0a8", { roughness: 0.3, metal: 0.8 });
      const ux = tx - fx,
        uz = tz - fz,
        l = Math.hypot(ux, uz);
      const back = [fx - (ux / l) * 0.5, fy + 0.15, fz - (uz / l) * 0.5],
        ahead = [tx + (ux / l) * 0.5, ty + 0.1, tz + (uz / l) * 0.5];
      cylinderBetween(group, back, ahead, 0.018, cable);
      // Poles holding each end.
      for (const [x, y, z] of [back, ahead]) cylinderBetween(group, [x, 0, z], [x, y + 0.25, z], 0.07, dark);
      // A sign at the start.
      mesh(group, new T.BoxGeometry(0.5, 0.3, 0.04), mat("#f2c14e"), back[0], fy - 0.6, back[2]);
    }
  }
  return {
    update(dt, t) {
      for (const s of sway) {
        if (s.rope) s.g.rotation.set(Math.sin(t * 1.3 + s.phase) * 0.05, 0, Math.cos(t * 1.1 + s.phase) * 0.05);
        else s.g.position.y = Math.sin(t * 2.2 + s.s.x) * s.amp;
      }
    },
  };
});
