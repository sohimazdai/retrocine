// How the saloon looks: bar with bottles, upright piano, round tables, balcony, plank walls, lamps.
import * as T from "three";
import { registerProps } from "../props.js";
import { registerDecor } from "../mapscene.js";
import { mat, mesh, merge, placed, worldBox, TEXTURES, rng, signTexture } from "./kit.js";

const DARK = "#4a2c19",
  MID = "#7a4c2c",
  LIGHT = "#a8743f",
  BRASS = "#c9a24a";
const wood = (color = "#ffffff", unit) => {
  const tex = TEXTURES.wood();
  return mat(tex ? color : MID, { map: tex, roughness: 0.75 });
};

function bar(g, p) {
  const [counter, back] = p.colliders;
  // Counter: panelled front, polished top, brass foot rail.
  mesh(g, worldBox(counter.w, counter.h - 0.06, counter.d, 1.2), wood("#b98a63"), counter.x, (counter.h - 0.06) / 2, counter.z);
  mesh(g, new T.BoxGeometry(counter.w + 0.2, 0.07, counter.d + 0.1), mat("#3b2213", { roughness: 0.25 }), counter.x + 0.05, counter.h - 0.03, counter.z);
  const panel = mat("#5a3520", { roughness: 0.7 });
  for (let z = -counter.d / 2 + 0.6; z < counter.d / 2 - 0.3; z += 1.15) mesh(g, new T.BoxGeometry(0.03, counter.h * 0.55, 0.85), panel, counter.x + counter.w / 2 + 0.01, counter.h * 0.48, counter.z + z + 0.25);
  mesh(g, new T.CylinderGeometry(0.035, 0.035, counter.d, 8), mat(BRASS, { roughness: 0.3, metal: 0.8 }), counter.x + counter.w / 2 + 0.22, 0.2, counter.z).rotation.x = Math.PI / 2;
  // Back bar: shelves with bottles and a mirror.
  mesh(g, worldBox(back.w, back.h, back.d, 1.2), wood("#8f6444"), back.x, back.h / 2, back.z);
  const mirror = mesh(g, new T.PlaneGeometry(back.d * 0.7, 0.8), mat("#c9d2d6", { roughness: 0.08, metal: 0.9 }), back.x + back.w / 2 + 0.01, 1.85, back.z);
  mirror.rotation.y = Math.PI / 2;
  const r = rng(3),
    colors = ["#3f6b3a", "#8a3a22", "#d9b45a", "#3a4f7a", "#6b2a3a", "#e8e2d0"];
  const bottles = colors.map(() => []);
  for (const y of [1.15, 1.55])
    for (let z = -back.d / 2 + 0.3; z < back.d / 2 - 0.2; z += 0.22 + r() * 0.12) {
      const k = Math.floor(r() * colors.length),
        h = 0.22 + r() * 0.12;
      bottles[k].push(placed(new T.CylinderGeometry(0.04, 0.05, h, 8), back.x + back.w / 2 + 0.1, y + h / 2, back.z + z));
      bottles[k].push(placed(new T.CylinderGeometry(0.015, 0.03, 0.09, 6), back.x + back.w / 2 + 0.1, y + h + 0.04, back.z + z));
    }
  bottles.forEach((parts, k) => parts.length && mesh(g, merge(parts), mat(colors[k], { roughness: 0.15, opacity: 0.85 })));
  for (const y of [1.12, 1.52]) mesh(g, new T.BoxGeometry(0.28, 0.04, back.d), wood("#a87850"), back.x + back.w / 2 + 0.12, y, back.z);
  // "SALOON" sign above the back bar.
  const tex = signTexture("saloon", "SALOON");
  const sign = mesh(g, new T.PlaneGeometry(3.2, 0.8), mat(tex ? "#ffffff" : DARK, { map: tex, roughness: 0.7 }), back.x + back.w / 2 + 0.02, back.h + 0.45, back.z);
  sign.rotation.y = Math.PI / 2;
}
function piano(g, p) {
  const c = p.colliders[0];
  const body = wood("#6a4630");
  mesh(g, new T.BoxGeometry(c.w, c.h, c.d * 0.7), body, 0, c.h / 2, -c.d * 0.15);
  mesh(g, new T.BoxGeometry(c.w, 0.12, c.d), body, 0, 0.78, 0);
  mesh(g, new T.BoxGeometry(c.w - 0.2, 0.04, 0.22), mat("#f6f1e4", { roughness: 0.3 }), 0, 0.86, c.d / 2 - 0.12);
  for (let i = 0; i < 26; i++) {
    if ([2, 6, 9, 13, 16, 20, 23].includes(i % 28)) continue;
    mesh(g, new T.BoxGeometry(0.035, 0.05, 0.12), mat("#1a1512", { roughness: 0.3 }), -c.w / 2 + 0.16 + i * 0.065, 0.895, c.d / 2 - 0.17, false);
  }
  for (const x of [-c.w / 2 + 0.15, c.w / 2 - 0.15]) mesh(g, new T.BoxGeometry(0.12, 0.72, 0.12), body, x, 0.36, c.d / 2 - 0.1);
  // Candles on top.
  for (const x of [-0.6, 0.6]) {
    mesh(g, new T.CylinderGeometry(0.035, 0.035, 0.2, 8), mat("#f3ead2"), x, c.h + 0.1, -c.d * 0.2);
    mesh(g, new T.SphereGeometry(0.03, 8, 6), mat("#ffd27a", { emissive: "#ffb340", glow: 2 }), x, c.h + 0.23, -c.d * 0.2, false);
  }
}
function saloonTable(g, p) {
  const c = p.colliders[0];
  mesh(g, new T.CylinderGeometry(c.radius, c.radius, 0.06, 32), wood("#c49a6c"), 0, c.h - 0.03, 0);
  mesh(g, new T.CylinderGeometry(0.08, 0.1, c.h - 0.06, 10), mat(DARK), 0, (c.h - 0.06) / 2, 0);
  mesh(g, new T.CylinderGeometry(0.42, 0.46, 0.06, 16), mat(DARK), 0, 0.03, 0);
  // Cards and chips.
  const r = rng(Math.round(p.x * 10 + p.z * 7));
  for (let i = 0; i < 4; i++) {
    const card = mesh(g, new T.BoxGeometry(0.12, 0.004, 0.17), mat("#f6f2ea"), (r() - 0.5) * 0.8, c.h + 0.003, (r() - 0.5) * 0.8, false);
    card.rotation.y = r() * Math.PI;
  }
  for (let i = 0; i < 3; i++) mesh(g, new T.CylinderGeometry(0.04, 0.04, 0.05 + i * 0.02, 12), mat(["#c0392b", "#2c3e50", "#f1c40f"][i]), -0.3 + i * 0.12, c.h + 0.03, 0.35, false);
}
function chair(g, p) {
  const c = p.colliders[0],
    w = wood("#b08058");
  mesh(g, new T.BoxGeometry(c.w, 0.05, c.d), w, 0, c.h - 0.025, 0);
  for (const x of [-c.w / 2 + 0.05, c.w / 2 - 0.05]) for (const z of [-c.d / 2 + 0.05, c.d / 2 - 0.05]) mesh(g, new T.CylinderGeometry(0.025, 0.025, c.h - 0.05, 6), mat(DARK), x, (c.h - 0.05) / 2, z);
  for (const x of [-c.w / 2 + 0.05, c.w / 2 - 0.05]) mesh(g, new T.BoxGeometry(0.05, 0.55, 0.05), mat(DARK), x, c.h + 0.27, -c.d / 2 + 0.03);
  for (const y of [0.18, 0.42]) mesh(g, new T.BoxGeometry(c.w - 0.06, 0.07, 0.03), w, 0, c.h + y, -c.d / 2 + 0.03);
}
function stool(g, p) {
  const c = p.colliders[0];
  mesh(g, new T.CylinderGeometry(c.radius, c.radius * 0.95, 0.07, 18), mat("#7a2a22", { roughness: 0.5 }), 0, c.h - 0.035, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = mesh(g, new T.CylinderGeometry(0.022, 0.026, c.h, 6), mat(DARK), Math.cos(a) * 0.15, c.h / 2, Math.sin(a) * 0.15);
    leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
  }
  mesh(g, new T.TorusGeometry(0.17, 0.015, 6, 18), mat(BRASS, { metal: 0.8, roughness: 0.3 }), 0, 0.25, 0).rotation.x = Math.PI / 2;
}
registerProps({ bar, piano, "saloon-table": saloonTable, chair, stool });

function lamp(group, x, y, z, lights) {
  mesh(group, new T.CylinderGeometry(0.1, 0.13, 0.06, 10), mat(BRASS, { metal: 0.7, roughness: 0.35 }), x, y - 0.2, z);
  mesh(group, new T.SphereGeometry(0.14, 12, 10), mat("#ffe2a8", { emissive: "#ffb347", glow: 1.6, opacity: 0.9 }), x, y, z, false);
  if (lights) {
    const light = new T.PointLight("#ffbf70", 6, 9, 1.6);
    light.position.set(x, y, z);
    group.add(light);
  }
}
registerDecor("saloon", (group, map) => {
  const statics = map.statics || [];
  const plank = wood("#c39a74");
  for (const s of statics) {
    if (s.kind === "balcony") {
      mesh(group, worldBox(s.w, s.h - s.y, s.d, 1.4), plank, s.x, (s.h + s.y) / 2, s.z);
      // Balusters along the railings.
      const parts = [];
      for (let z = s.z - s.d / 2 + 0.15; z < s.z + s.d / 2; z += 0.32) parts.push(placed(new T.BoxGeometry(0.05, 0.9, 0.05), s.x - s.w / 2 + 0.05, s.h + 0.45, z));
      for (let x = s.x - s.w / 2 + 0.15; x < s.x + s.w / 2 - 1.5; x += 0.32) parts.push(placed(new T.BoxGeometry(0.05, 0.9, 0.05), x, s.h + 0.45, s.z + s.d / 2 - 0.05));
      mesh(group, merge(parts), mat(DARK));
    }
    if (s.kind === "railing") mesh(group, new T.BoxGeometry(s.w + 0.04, 0.08, s.d + 0.04), mat(DARK), s.x, s.h - 0.04, s.z);
    if (s.kind === "post") mesh(group, new T.BoxGeometry(s.w, s.h, s.d), mat(DARK), s.x, s.h / 2, s.z);
    if (s.kind === "stairs") {
      // Drawn as steps under the walkable slope.
      const n = 6,
        parts = [];
      for (let i = 0; i < n; i++) {
        const top = s.h0 - (i * (s.h0 - s.h1)) / n,
          z0 = s.z - s.d / 2 + (i * s.d) / n;
        parts.push(placed(worldBox(s.w, top, s.d / n, 1.4), s.x, top / 2, z0 + s.d / n / 2));
      }
      mesh(group, merge(parts), plank);
    }
  }
  // Plank walls along both sides with windows, lamps and wanted posters.
  const wall = wood("#9a6c48"),
    frameMat = mat(DARK),
    glass = mat("#2a3a4a", { roughness: 0.1, metal: 0.3, emissive: "#1c2a3a", glow: 0.8 });
  for (const side of [-1, 1]) {
    const x = side * 14.75;
    mesh(group, worldBox(0.15, 3.2, 21, 1.4), wall, x, 1.6, -0.2);
    for (const z of [-4, 3.5]) {
      mesh(group, new T.BoxGeometry(0.05, 1.1, 1.4), glass, x - side * 0.09, 1.7, z);
      mesh(group, new T.BoxGeometry(0.08, 1.24, 0.08), frameMat, x - side * 0.1, 1.7, z);
      mesh(group, new T.BoxGeometry(0.08, 0.08, 1.54), frameMat, x - side * 0.1, 1.7, z);
    }
    for (const z of [-7, 0, 7]) lamp(group, x - side * 0.35, 2.6, z, z === 0);
  }
  const wanted = signTexture("wanted", "РАЗЫСКИВАЕТСЯ", { w: 512, h: 128, bg: "#e8d6a8", fg: "#3a2414", font: "bold 54px Georgia, serif", border: "#8a6a3a" });
  for (const [x, z, ry] of [
    [-14.65, 6.2, Math.PI / 2],
    [14.65, 6.2, -Math.PI / 2],
  ]) {
    const poster = mesh(group, new T.PlaneGeometry(1.2, 0.3), mat(wanted ? "#ffffff" : "#e8d6a8", { map: wanted }), x, 2.15, z, false);
    poster.rotation.y = ry;
    const face = mesh(group, new T.PlaneGeometry(0.9, 0.9), mat("#d9c595", { roughness: 0.9 }), x + (x < 0 ? 0.005 : -0.005), 1.55, z, false);
    face.rotation.y = ry;
  }
  // Swinging doors in the left wall.
  for (const s of [-1, 1]) {
    const door = mesh(group, new T.BoxGeometry(0.06, 1.0, 0.62), wood("#b98a63"), -14.6, 1.25, 8.0 + s * 0.33);
    door.rotation.y = s * 0.15;
  }
  // Warm light from the lamps over the room.
  lamp(group, -3, 3.4, -1, true);
  lamp(group, 4, 3.4, -3, true);
  const r = rng(8);
  // Spittoons and a scatter of sawdust.
  for (const [x, z] of [
    [-8.6, 3.6],
    [0.4, -8.6],
  ])
    mesh(group, new T.CylinderGeometry(0.16, 0.2, 0.22, 14), mat(BRASS, { metal: 0.8, roughness: 0.3 }), x, 0.11, z);
  const dust = [];
  for (let i = 0; i < 60; i++) dust.push(placed(new T.CircleGeometry(0.05 + r() * 0.08, 6), (r() - 0.5) * 26, 0.006, -8 + r() * 17, 0, -Math.PI / 2));
  mesh(group, merge(dust), mat("#d9b98a", { roughness: 1, opacity: 0.6 }), 0, 0, 0, false);
});
