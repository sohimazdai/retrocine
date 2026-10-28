// How the skatepark looks: concrete quarter pipes with steel coping, a mini ramp, funboxes, a bank
// up to a platform, rails and ledges, graffiti walls, light poles, planters with trees, a rack for
// the boards and traffic cones.
import * as T from "three";
import { registerDecor } from "../mapscene.js";
import { BALL_BUILDERS } from "../props.js";
import { mat, mesh, rng, canvasTexture } from "./kit.js";
import { surfaceOf } from "../physics.js";

const CONCRETE = "#bdb8b0",
  CONCRETE_DARK = "#9d988f",
  STEEL = "#cfd3da";

// A sloped collider as a solid: its top follows surfaceOf, sides drop to the floor.
function slopeSolid(c, steps = 24) {
  const ax = c.axis === "x";
  const len = ax ? c.w : c.d,
    width = ax ? c.d : c.w;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = ax ? c.x - c.w / 2 + u * c.w : c.x,
      z = ax ? c.z : c.z - c.d / 2 + u * c.d;
    pts.push([u * len - len / 2, surfaceOf(c, x, z)]);
  }
  const shape = new T.Shape();
  shape.moveTo(-len / 2, 0);
  for (const [u, h] of pts) shape.lineTo(u, h);
  shape.lineTo(len / 2, 0);
  shape.lineTo(-len / 2, 0);
  const g = new T.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -width / 2);
  if (ax) g.translate(c.x, 0, c.z);
  else {
    g.rotateY(-Math.PI / 2);
    g.translate(c.x, 0, c.z);
  }
  return g;
}
function graffiti(key, words) {
  return canvasTexture("graffiti:" + key, 512, (c, n, r) => {
    c.fillStyle = "#bdb8b0";
    c.fillRect(0, 0, n, n);
    const colors = ["#e4573f", "#3f86b8", "#f2c14e", "#69b35a", "#9b6ad6", "#ef8a3a"];
    for (let i = 0; i < 9; i++) {
      c.fillStyle = colors[i % colors.length] + "aa";
      c.beginPath();
      c.ellipse(r() * n, r() * n, 30 + r() * 60, 12 + r() * 30, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.font = "bold 92px Impact, Arial Black, sans-serif";
    c.textAlign = "center";
    words.forEach((w, i) => {
      c.save();
      c.translate(n / 2, n * (0.32 + i * 0.36));
      c.rotate((r() - 0.5) * 0.25);
      c.lineWidth = 12;
      c.strokeStyle = "#1d1d22";
      c.strokeText(w, 0, 0);
      c.fillStyle = colors[(i * 3 + 1) % colors.length];
      c.fillText(w, 0, 0);
      c.restore();
    });
  });
}
// Traffic cones are loose objects you can knock over.
BALL_BUILDERS.cone = (g, b) => {
  const r = b.size / 2;
  const orange = mat("#ef6a2f", { roughness: 0.5 });
  mesh(g, new T.ConeGeometry(r * 0.7, r * 1.8, 16), orange, 0, r * 0.1, 0);
  mesh(g, new T.CylinderGeometry(r * 0.42, r * 0.5, r * 0.25, 16), mat("#f6f2ea"), 0, r * 0.15, 0);
  mesh(g, new T.BoxGeometry(r * 1.6, r * 0.15, r * 1.6), orange, 0, -r * 0.85, 0);
};

registerDecor("skatepark", (group, map) => {
  const concrete = mat(CONCRETE, { roughness: 0.9 }),
    dark = mat(CONCRETE_DARK, { roughness: 0.95 }),
    steel = mat(STEEL, { roughness: 0.25, metal: 0.85 });
  for (const s of map.statics || []) {
    if (s.shape === "qpipe" || s.shape === "ramp") {
      const tex = s.kind === "pipe" && !s.small ? graffiti(s.dir > 0 ? "right" : "left", s.dir > 0 ? ["KINO", "SKATE"] : ["RETRO", "RIDE"]) : null;
      mesh(group, slopeSolid(s), s.kind === "pipe" ? concrete : dark);
      if (tex) {
        // Graffiti on the pipe's side wall.
        const side = mesh(group, new T.PlaneGeometry(s.w * 0.92, s.h * 0.9), mat("#ffffff", { map: tex, roughness: 0.9 }), s.x, s.h * 0.45, s.z + s.d / 2 + 0.01, false);
        side.position.x += s.dir * s.w * 0.05;
      }
      if (s.kind === "pipe") {
        // Steel coping along the lip.
        const lip = s.x + (s.dir * s.w) / 2;
        mesh(group, new T.CylinderGeometry(0.05, 0.05, s.d, 10), steel, lip - s.dir * 0.03, s.h, s.z).rotation.x = Math.PI / 2;
      }
      if (s.kind === "kicker") {
        const high = s.h0 > s.h1 ? s.z - s.d / 2 : s.z + s.d / 2;
        mesh(group, new T.BoxGeometry(s.w, 0.05, 0.06), steel, s.x, s.h - 0.02, high);
      }
    } else if (s.kind === "box" || s.kind === "pad" || s.kind === "deck") {
      mesh(group, new T.BoxGeometry(s.w, s.h, s.d), s.kind === "deck" ? dark : concrete, s.x, s.h / 2, s.z);
      // Steel edges to grind on the look of it.
      for (const side of [-1, 1]) mesh(group, new T.BoxGeometry(s.w, 0.04, 0.04), steel, s.x, s.h, s.z + (side * s.d) / 2);
    } else if (s.kind === "ledge") {
      // A concrete ledge with a steel edge on top, to grind along.
      mesh(group, new T.BoxGeometry(s.w, s.h, s.d), concrete, s.x, s.h / 2, s.z);
      for (const side of [-1, 1]) mesh(group, new T.BoxGeometry(0.04, 0.04, s.d), steel, s.x + (side * s.w) / 2, s.h, s.z);
    } else if (s.rail) {
      const along = s.w >= s.d,
        len = along ? s.w : s.d,
        y0 = s.y || 0;
      const bar = mesh(group, new T.CylinderGeometry(0.04, 0.04, len, 10), steel, s.x, s.h - 0.04, s.z);
      bar.rotation.set(along ? 0 : Math.PI / 2, 0, along ? Math.PI / 2 : 0);
      for (const k of [-0.42, 0, 0.42]) {
        const px = along ? s.x + k * len : s.x,
          pz = along ? s.z : s.z + k * len;
        mesh(group, new T.CylinderGeometry(0.03, 0.03, s.h - y0, 8), steel, px, (s.h + y0) / 2, pz);
        if (!y0) mesh(group, new T.BoxGeometry(0.2, 0.02, 0.2), steel, px, 0.01, pz);
      }
    }
  }
  const r = rng(17);
  const pole = mat("#3a3d45", { metal: 0.6, roughness: 0.4 }),
    lamp = mat("#fff6d8", { emissive: "#ffe9a8", glow: 1.8 }),
    soil = mat("#4a3a2c", { roughness: 1 }),
    leaves = ["#4c8a3f", "#5a9a49", "#437c38"].map((c) => mat(c, { roughness: 0.9, flat: true }));
  for (const s of map.statics || []) {
    if (s.kind === "pole") {
      // A light pole with two lamps leaning over the park.
      mesh(group, new T.CylinderGeometry(0.08, 0.13, s.h, 10), pole, s.x, s.h / 2, s.z);
      const toward = -Math.sign(s.x) || 1;
      for (const dz of [-0.5, 0.5]) {
        mesh(group, new T.BoxGeometry(0.9, 0.08, 0.08), pole, s.x + toward * 0.4, s.h - 0.2, s.z + dz);
        mesh(group, new T.BoxGeometry(0.6, 0.12, 0.35), mat("#2a2c33"), s.x + toward * 0.8, s.h - 0.25, s.z + dz);
        mesh(group, new T.BoxGeometry(0.5, 0.03, 0.28), lamp, s.x + toward * 0.8, s.h - 0.32, s.z + dz, false);
      }
    } else if (s.kind === "planter") {
      // A round concrete planter with a small tree.
      mesh(group, new T.CylinderGeometry(s.radius, s.radius * 0.92, s.h, 20), concrete, s.x, s.h / 2, s.z);
      mesh(group, new T.CylinderGeometry(s.radius * 0.86, s.radius * 0.86, 0.04, 20), soil, s.x, s.h + 0.01, s.z, false);
      mesh(group, new T.CylinderGeometry(0.07, 0.1, 1.6, 8), mat("#5a3a22"), s.x, s.h + 0.8, s.z);
      for (let i = 0; i < 3; i++) mesh(group, new T.IcosahedronGeometry(0.62 - i * 0.1, 1), leaves[i], s.x + Math.sin(i * 2.1) * 0.25, s.h + 1.7 + i * 0.35, s.z + Math.cos(i * 2.1) * 0.25);
    } else if (s.kind === "graffiti-wall") {
      // A free-standing concrete wall, painted on both faces.
      mesh(group, new T.BoxGeometry(s.w, s.h, s.d), concrete, s.x, s.h / 2, s.z);
      const tex = graffiti("wall" + s.side, s.side < 0 ? ["SKATE", "OR DIE"] : ["KINO", "PARK"]);
      for (const face of [-1, 1]) {
        const p = mesh(group, new T.PlaneGeometry(s.w * 0.96, s.h * 0.92), mat("#ffffff", { map: tex, roughness: 0.9 }), s.x, s.h / 2, s.z + face * (s.d / 2 + 0.01), false);
        if (face < 0) p.rotation.y = Math.PI;
      }
      mesh(group, new T.BoxGeometry(s.w + 0.06, 0.08, s.d + 0.06), dark, s.x, s.h + 0.04, s.z);
    } else if (s.kind === "rack") {
      // A low steel rack where the boards, scooters and bikes wait.
      mesh(group, new T.BoxGeometry(s.w, 0.04, 0.05), steel, s.x, s.h, s.z - s.d / 2 + 0.03);
      for (let i = 0; i <= 8; i++) mesh(group, new T.CylinderGeometry(0.025, 0.025, s.h, 6), steel, s.x - s.w / 2 + (i * s.w) / 8, s.h / 2, s.z - s.d / 2 + 0.03);
    }
  }
  // Painted bays by the rack, a bin, and skid marks all over the flat.
  const paint = mat("#f2c14e", { roughness: 0.8, opacity: 0.7 });
  const rack = (map.statics || []).find((s) => s.kind === "rack");
  if (rack)
    for (let i = 0; i <= 8; i++) {
      const stripe = mesh(group, new T.PlaneGeometry(0.12, 1.4), paint, rack.x - rack.w / 2 + (i * rack.w) / 8, 0.012, rack.z + 0.85, false);
      stripe.rotation.x = -Math.PI / 2;
    }
  const k = map.scale || 1;
  mesh(group, new T.CylinderGeometry(0.3, 0.26, 0.85, 14), mat("#3f6f4a", { roughness: 0.6 }), 6.4, 0.43, 14.4);
  // The line between the pipes: smoother, darker concrete with painted edges and a logo in the middle.
  const pipes = (map.statics || []).filter((s) => s.shape === "qpipe" && !s.small);
  if (pipes.length === 2) {
    const x0 = Math.min(...pipes.map((s) => s.x + s.w / 2 * -Math.sign(s.x))),
      len = 2 * Math.abs(x0),
      lane = mesh(group, new T.PlaneGeometry(len, 10.4), mat("#9c978f", { roughness: 0.8 }), 0, 0.006, 0, false);
    lane.rotation.x = -Math.PI / 2;
    lane.receiveShadow = true;
    for (const z of [-5.2, 5.2]) {
      const edge = mesh(group, new T.PlaneGeometry(len, 0.2), mat("#f2c14e", { roughness: 0.8, opacity: 0.8 }), 0, 0.009, z, false);
      edge.rotation.x = -Math.PI / 2;
    }
    const logo = mesh(group, new T.CircleGeometry(2.6, 48), mat("#ffffff", { map: graffiti("floor", ["KINO"]), roughness: 0.85, opacity: 0.4 }), 0, 0.01, 0, false);
    logo.rotation.x = -Math.PI / 2;
  }
  for (let i = 0; i < 30; i++) {
    const mark = mesh(group, new T.PlaneGeometry(0.06, 1 + r() * 2.4), mat("#3a3a3e", { opacity: 0.25, roughness: 1 }), (r() - 0.5) * 30 * k, 0.011, (-5 + r() * 10) * k, false);
    mark.rotation.set(-Math.PI / 2, 0, r() * Math.PI);
  }
});
