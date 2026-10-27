// How the hedge maze looks: clipped hedges, the fountain with the minotaur, benches and the garden.
import * as T from "three";
import { registerProps } from "../props.js";
import { registerDecor } from "../mapscene.js";
import { mat, mesh, merge, placed, worldBox, TEXTURES, rng, leafyTree, rock } from "./kit.js";

const STONE = "#c9c2b3",
  STONE_DARK = "#a39b8b",
  BRONZE = "#6e8c78";

function hedges(group, map) {
  const walls = (map.statics || []).filter((s) => s.kind === "hedge");
  if (!walls.length) return;
  const parts = [],
    tops = [];
  for (const s of walls) {
    const h = s.vh || 1.2;
    parts.push(placed(worldBox(s.w, h, s.d, 1.6), s.x, h / 2, s.z));
    // A slightly rounded crown so the clipped top doesn't look like a crate.
    tops.push(placed(worldBox(s.w - 0.12, 0.12, s.d - 0.12, 1.6), s.x, h + 0.05, s.z));
  }
  const leaves = TEXTURES.leaves();
  mesh(group, merge(parts), mat(leaves ? "#ffffff" : "#447d3a", { map: leaves, roughness: 0.95 }));
  mesh(group, merge(tops), mat(leaves ? "#d8f0c8" : "#56924a", { map: leaves, roughness: 0.95 }));
  // Little flowers at the hedge feet.
  const r = rng(77),
    flowers = [];
  for (const s of walls)
    for (let i = 0; i < Math.max(1, (s.w + s.d) / 2.5); i++) {
      const along = s.w > s.d,
        side = r() < 0.5 ? -1 : 1;
      const x = along ? s.x + (r() - 0.5) * s.w : s.x + side * (s.w / 2 + 0.06),
        z = along ? s.z + side * (s.d / 2 + 0.06) : s.z + (r() - 0.5) * s.d;
      flowers.push(placed(new T.IcosahedronGeometry(0.07, 0), x, 0.12 + r() * 0.25, z));
    }
  if (flowers.length) mesh(group, merge(flowers), mat("#f3e9f7", { flat: true, emissive: "#3a2a40", glow: 0.4 }), 0, 0, 0, false);
}

// Water surfaces shimmer by sliding their texture.
function waterMaterial(opacity = 0.82) {
  const tex = TEXTURES.water()?.clone();
  if (tex) {
    tex.needsUpdate = true;
    tex.repeat.set(1.5, 1.5);
  }
  return mat(tex ? "#bfe7f2" : "#4a9bb5", { map: tex, roughness: 0.15, metal: 0.1, opacity, emissive: "#0d3442", glow: 0.6 });
}
function bowl(g, radius, depth, y, color) {
  const pts = [
    new T.Vector2(0.02, 0),
    new T.Vector2(radius * 0.35, 0.02),
    new T.Vector2(radius * 0.8, depth * 0.45),
    new T.Vector2(radius, depth),
    new T.Vector2(radius * 0.94, depth + 0.02),
    new T.Vector2(radius * 0.86, depth * 0.55),
  ];
  return mesh(g, new T.LatheGeometry(pts, 40), mat(color, { roughness: 0.6, side: T.DoubleSide }), 0, y, 0);
}
function minotaur(g, y) {
  const m = new T.Group();
  m.position.set(0, y, 0);
  const metal = mat(BRONZE, { roughness: 0.42, metal: 0.55, flat: true }),
    dark = mat("#4f6a59", { roughness: 0.5, metal: 0.5, flat: true });
  const part = (geo, x, yy, z, material = metal) => mesh(m, geo, material, x, yy, z);
  // Plinth, hooves and legs.
  part(new T.CylinderGeometry(0.34, 0.38, 0.16, 10), 0, 0.08, 0, dark);
  for (const s of [-1, 1]) {
    part(new T.BoxGeometry(0.16, 0.12, 0.2), s * 0.13, 0.22, 0.02, dark);
    const leg = part(new T.CylinderGeometry(0.075, 0.1, 0.62, 8), s * 0.13, 0.58, 0);
    leg.rotation.z = s * 0.06;
  }
  // Fur kilt, muscular torso, shoulders.
  part(new T.CylinderGeometry(0.22, 0.27, 0.22, 10), 0, 0.92, 0, dark);
  const torso = part(new T.CylinderGeometry(0.3, 0.2, 0.55, 10), 0, 1.3, 0);
  torso.scale.z = 0.72;
  part(new T.SphereGeometry(0.13, 10, 8), -0.31, 1.52, 0);
  part(new T.SphereGeometry(0.13, 10, 8), 0.31, 1.52, 0);
  // Arms: the right one raises a double-headed axe.
  const left = part(new T.CylinderGeometry(0.07, 0.06, 0.5, 8), -0.37, 1.27, 0.03);
  left.rotation.z = -0.25;
  const right = part(new T.CylinderGeometry(0.07, 0.06, 0.48, 8), 0.4, 1.68, 0.02);
  right.rotation.z = 0.5;
  const axe = new T.Group();
  axe.position.set(0.55, 1.88, 0.04);
  axe.rotation.z = -0.25;
  mesh(axe, new T.CylinderGeometry(0.025, 0.025, 1.1, 6), dark, 0, 0.1, 0);
  // Labrys: two crescent blades on either side of the haft's head.
  for (const s of [-1, 1]) {
    const blade = mesh(axe, new T.CylinderGeometry(0.26, 0.26, 0.035, 16, 1, false, 0, Math.PI), metal, s * 0.03, 0.5, 0);
    blade.rotation.set(Math.PI / 2, 0, 0);
    blade.scale.set(s, 1, 1);
  }
  m.add(axe);
  // Bull head: muzzle, ears and long horns.
  part(new T.CylinderGeometry(0.11, 0.14, 0.14, 8), 0, 1.62, 0);
  const head = part(new T.BoxGeometry(0.3, 0.3, 0.3), 0, 1.82, 0.02);
  head.rotation.x = 0.12;
  part(new T.BoxGeometry(0.24, 0.17, 0.2), 0, 1.73, 0.21);
  part(new T.TorusGeometry(0.05, 0.012, 6, 12), 0, 1.69, 0.32, dark);
  for (const s of [-1, 1]) {
    const ear = part(new T.ConeGeometry(0.06, 0.14, 6), s * 0.2, 1.88, 0.0);
    ear.rotation.z = s * 1.9;
    const curve = new T.CatmullRomCurve3([new T.Vector3(s * 0.13, 1.93, 0.02), new T.Vector3(s * 0.32, 1.98, 0.02), new T.Vector3(s * 0.42, 2.14, 0.06), new T.Vector3(s * 0.38, 2.3, 0.1)]);
    mesh(m, new T.TubeGeometry(curve, 12, 0.035, 6), mat("#d9cfb8", { roughness: 0.5 }));
  }
  g.add(m);
  return m;
}
function fountain(g, p) {
  const stone = mat(STONE, { roughness: 0.85 }),
    stoneDark = mat(STONE_DARK, { roughness: 0.9 });
  // Basin: a stone rim around a pool.
  mesh(g, new T.CylinderGeometry(2.4, 2.45, 0.6, 48, 1, true), stone, 0, 0.3, 0);
  mesh(g, new T.CylinderGeometry(2.22, 2.22, 0.58, 48, 1, true), stoneDark, 0, 0.29, 0).material.side = T.BackSide;
  mesh(g, new T.RingGeometry(2.2, 2.42, 48), stone, 0, 0.6, 0).rotation.x = -Math.PI / 2;
  const pool = mesh(g, new T.CircleGeometry(2.22, 48), waterMaterial(0.86), 0, 0.46, 0, false);
  pool.rotation.x = -Math.PI / 2;
  // Middle tier: column, bowl, water; top tier: smaller bowl and the statue.
  mesh(g, new T.CylinderGeometry(0.32, 0.45, 1.0, 16), stone, 0, 0.6, 0);
  bowl(g, 1.35, 0.32, 1.03, STONE);
  const mid = mesh(g, new T.CircleGeometry(1.22, 40), waterMaterial(0.9), 0, 1.3, 0, false);
  mid.rotation.x = -Math.PI / 2;
  mesh(g, new T.CylinderGeometry(0.2, 0.3, 0.75, 14), stone, 0, 1.68, 0);
  bowl(g, 0.85, 0.24, 1.86, STONE);
  const top = mesh(g, new T.CircleGeometry(0.76, 32), waterMaterial(0.9), 0, 2.06, 0, false);
  top.rotation.x = -Math.PI / 2;
  minotaur(g, 2.08);
  // Falling curtains of water from each bowl's rim.
  const curtains = [];
  for (const [r0, r1, y0, y1] of [
    [1.36, 1.5, 1.35, 0.47],
    [0.86, 0.98, 2.1, 1.31],
  ]) {
    const geo = new T.CylinderGeometry(r0, r1, y0 - y1, 40, 1, true);
    const material = waterMaterial(0.45);
    material.depthWrite = false;
    material.side = T.DoubleSide;
    curtains.push(mesh(g, geo, material, 0, (y0 + y1) / 2, 0, false));
  }
  // Jet from the minotaur's axe hand? No — from four lion heads around the top bowl.
  const drops = [];
  const dropMaterial = mat("#d8f3ff", { opacity: 0.7, emissive: "#3d6c7a", glow: 0.5 });
  for (let i = 0; i < 28; i++) {
    const d = mesh(g, new T.SphereGeometry(0.035, 6, 4), dropMaterial, 0, 0, 0, false);
    d.userData.phase = i / 28;
    d.userData.angle = (i * 2.399) % (Math.PI * 2);
    drops.push(d);
  }
  const textured = [pool, mid, top, ...curtains].map((m) => m.material.map).filter(Boolean);
  g.userData.update = (dt, t) => {
    textured.forEach((tex, i) => {
      if (i < 3) {
        tex.offset.x = Math.sin(t * 0.3 + i) * 0.05;
        tex.offset.y = t * 0.03;
      } else tex.offset.y = -t * 0.9;
    });
    // Drops arc from the top bowl's rim down into the middle bowl and the pool.
    for (const d of drops) {
      const k = (t * 0.55 + d.userData.phase) % 1,
        a = d.userData.angle;
      const r = 0.9 + k * 0.7,
        y = 2.1 + 0.25 * Math.sin(k * Math.PI) - k * k * 1.6;
      d.position.set(Math.cos(a) * r, Math.max(0.47, y), Math.sin(a) * r);
    }
  };
}
function bench(g) {
  const wood = mat("#9a6a43", { roughness: 0.8 }),
    iron = mat("#3a3a3e", { roughness: 0.45, metal: 0.5 });
  for (let i = 0; i < 4; i++) mesh(g, new T.BoxGeometry(2.2, 0.05, 0.15), wood, 0, 0.47, -0.25 + i * 0.165);
  for (let i = 0; i < 3; i++) {
    const slat = mesh(g, new T.BoxGeometry(2.2, 0.13, 0.05), wood, 0, 0.66 + i * 0.16, -0.36);
    slat.rotation.x = -0.12;
  }
  for (const x of [-0.95, 0.95]) {
    mesh(g, new T.BoxGeometry(0.07, 0.46, 0.6), iron, x, 0.23, 0);
    mesh(g, new T.BoxGeometry(0.07, 0.55, 0.06), iron, x, 0.75, -0.38);
  }
}
registerProps({ fountain, bench });

registerDecor("maze", (group, map) => {
  hedges(group, map);
  // The garden behind the maze: trees, bronze spheres on plinths.
  const r = rng(5);
  for (const s of map.statics || []) {
    if (s.kind === "tree") leafyTree(group, s.x, s.z, s.h, Math.floor(r() * 1000));
    if (s.kind === "plinth") {
      mesh(group, new T.BoxGeometry(s.w, s.h, s.d), mat(STONE, { roughness: 0.85 }), s.x, s.h / 2, s.z);
      mesh(group, new T.SphereGeometry(0.32, 16, 12), mat(BRONZE, { roughness: 0.4, metal: 0.5 }), s.x, s.h + 0.32, s.z);
    }
  }
  for (let i = 0; i < 6; i++) rock(group, -12 + i * 4.8 + r() * 1.5, 0.12, 9.95 + r() * 0.2, 0.3, 0.18, 0.25, "#9a958b", i + 3);
});
