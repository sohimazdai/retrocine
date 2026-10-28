// What lies beyond the left and right edges of the floor: the ground goes on and each map gets a
// backdrop that fits it (a yard with blocks of flats, mountains, a forest, a frontier town, a city).
// Purely scenery, outside where anyone can walk; it fills the empty corners of the view.
import * as T from "three";
import { registerStatics } from "../mapscene.js";
import { mat, mesh, merge, placed, rng, rockGeometry, canvasTexture } from "./kit.js";

const EDGE = 14.7;
// The ground beyond the edge: from the floor's side out to `far`, behind the screen and up to the front.
function verge(group, color, far = 30) {
  for (const side of [-1, 1]) {
    const m = mesh(group, new T.PlaneGeometry(far - EDGE, 34), mat(color, { roughness: 1 }), side * (EDGE + (far - EDGE) / 2), -0.02, -6.7, false);
    m.rotation.x = -Math.PI / 2;
    m.raycast = () => {};
  }
}
// Fades a colour toward the sky the farther away it is, for depth.
function haze(color, sky, k) {
  return new T.Color(color).lerp(new T.Color(sky), Math.min(0.75, Math.max(0, k))).getStyle();
}
// Many trees as two merged meshes (trunks and crowns) per colour.
function forest(group, trees, sky) {
  const trunks = [],
    crowns = new Map();
  const add = (color, part) => {
    if (!crowns.has(color)) crowns.set(color, []);
    crowns.get(color).push(part);
  };
  for (const t of trees) {
    const k = (Math.abs(t.x) - EDGE) / 22;
    trunks.push(placed(new T.CylinderGeometry(0.1 * t.s, 0.16 * t.s, t.h * 0.3, 6), t.x, t.h * 0.15, t.z));
    if (t.kind === "pine")
      for (let i = 0; i < 3; i++) {
        const rr = t.h * (0.3 - i * 0.075),
          hh = t.h * (0.42 - i * 0.07);
        add(haze(t.snow && i === 2 ? "#e9f0f7" : ["#25503a", "#2c5d43", "#336a4b"][i], sky, k), placed(new T.ConeGeometry(rr, hh, 7), t.x, t.h * (0.25 + i * 0.22) + hh / 2, t.z, t.r));
      }
    else if (t.kind === "cypress") add(haze("#2d5536", sky, k), placed(new T.ConeGeometry(t.h * 0.12, t.h * 0.85, 8), t.x, t.h * 0.55, t.z, t.r, 0, 0, [1, 1, 1]));
    else
      for (let i = 0; i < 3; i++) add(haze(["#4c8a3f", "#5a9a49", "#437c38"][i], sky, k), placed(new T.IcosahedronGeometry(t.h * 0.22, 1), t.x + Math.sin(t.r + i * 2) * t.h * 0.12, t.h * (0.62 + i * 0.08), t.z + Math.cos(t.r + i * 2) * t.h * 0.12, t.r + i));
    if (t.snow && t.kind === "pine") add("#f3f6fb", placed(new T.ConeGeometry(t.h * 0.16, t.h * 0.12, 7), t.x, t.h * 0.86, t.z, t.r));
  }
  if (trunks.length) mesh(group, merge(trunks), mat("#5b3d26", { roughness: 0.95 }), 0, 0, 0, false);
  for (const [color, parts] of crowns) mesh(group, merge(parts), mat(color, { flat: true, roughness: 0.9 }), 0, 0, 0, false);
}
// Trees scattered on both sides between x = EDGE + near and EDGE + far.
function scatter(seed, count, near, far, z0, z1, make) {
  const r = rng(seed),
    out = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1,
      x = side * (EDGE + near + r() * (far - near)),
      z = z0 + r() * (z1 - z0);
    out.push(make(x, z, r));
  }
  return out;
}
// Windows on a canvas: a facade texture for blocks of flats and city buildings.
function facade(key, cols, rows, wall, lit, dark) {
  return canvasTexture("facade:" + key, 256, (c, n, r) => {
    c.fillStyle = wall;
    c.fillRect(0, 0, n, n);
    const cw = n / cols,
      ch = n / rows;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        c.fillStyle = r() < 0.38 ? lit : dark;
        c.fillRect(x * cw + cw * 0.2, y * ch + ch * 0.22, cw * 0.6, ch * 0.5);
      }
  });
}
function building(group, x, z, w, d, h, tex, color, roof, sky) {
  const k = (Math.abs(x) - EDGE) / 22;
  const g = new T.BoxGeometry(w, h, d);
  // Repeat the facade by size, so windows keep their scale.
  const uv = g.attributes.uv,
    faces = [d, d, w, w, w, w];
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < 4; i++) {
      const j = f * 4 + i;
      uv.setXY(j, (uv.getX(j) * faces[f]) / 6, (uv.getY(j) * h) / 6);
    }
  const m = mesh(group, g, mat(tex ? haze("#ffffff", sky, k * 0.6) : color, { map: tex, roughness: 0.9, emissive: tex ? "#ffffff" : "#000000", glow: 0.0 }), x, h / 2, z, false);
  if (tex) {
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    m.material.emissiveMap = tex;
    m.material.emissiveIntensity = 0.35;
  }
  mesh(group, new T.BoxGeometry(w + 0.2, 0.3, d + 0.2), mat(haze(roof, sky, k), { roughness: 0.9 }), x, h + 0.15, z, false);
  return m;
}

const STYLES = {
  // Blocks of flats behind bushes and trees: a Russian courtyard.
  yard(group, map, sky) {
    verge(group, "#5f8a4a");
    const r = rng(12),
      bushes = [];
    for (const side of [-1, 1]) for (let z = -13; z < 10; z += 0.9) bushes.push(placed(new T.IcosahedronGeometry(0.55 + r() * 0.3, 1), side * (EDGE + 0.55 + r() * 0.2), 0.45, z, r() * 3, 0, 0, [1, 0.8 + r() * 0.3, 1]));
    mesh(group, merge(bushes), mat("#4a7d3a", { flat: true }), 0, 0, 0, false);
    forest(group, scatter(7, 18, 1.4, 5, -16, 6, (x, z, r) => ({ kind: "leafy", x, z, h: 4.5 + r() * 2.5, s: 1.3, r: r() * 6 })), sky);
    const tex = facade("flats", 8, 5, "#d9cdb8", "#ffe6a6", "#4f5a66");
    for (const side of [-1, 1]) {
      building(group, side * 23, -9, 7, 16, 14, tex, "#d9cdb8", "#7a6f62", sky);
      building(group, side * 24, 6, 7, 10, 14, tex, "#d9cdb8", "#7a6f62", sky);
    }
  },
  // Tall cypresses and poplars beyond the garden walls.
  garden(group, map, sky) {
    verge(group, "#5f8f4e");
    forest(group, [...scatter(31, 26, 0.9, 4.5, -18, 8, (x, z, r) => ({ kind: "cypress", x, z, h: 5.5 + r() * 3, s: 1, r: r() * 6 })), ...scatter(32, 10, 5, 10, -18, -2, (x, z, r) => ({ kind: "leafy", x, z, h: 7 + r() * 3, s: 1.6, r: r() * 6 }))], sky);
  },
  // The valley goes on into mountains with snowy peaks.
  mountains(group, map, sky) {
    verge(group, "#6f6a5e");
    const r = rng(41),
      rocks = [],
      peaks = [],
      snow = [];
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1,
        s = 2 + r() * 3.5;
      rocks.push(placed(rockGeometry(i + 100), side * (EDGE + 1.5 + r() * 6), s * 0.5, -18 + r() * 24, r() * 6, 0, 0, [s, s * (0.7 + r() * 0.6), s]));
    }
    mesh(group, merge(rocks), mat("#7f786c", { flat: true, roughness: 0.95 }), 0, 0, 0, false);
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1,
        h = 14 + r() * 10,
        x = side * (EDGE + 9 + r() * 10),
        z = -24 + r() * 16;
      peaks.push(placed(new T.ConeGeometry(h * 0.6, h, 6), x, h / 2, z, r() * 6));
      snow.push(placed(new T.ConeGeometry(h * 0.6 * 0.28, h * 0.28, 6), x, h - h * 0.14 + 0.05, z, r() * 6));
    }
    mesh(group, merge(peaks), mat(haze("#6c7380", sky, 0.35), { flat: true, roughness: 0.95 }), 0, 0, 0, false);
    mesh(group, merge(snow), mat("#e9eef5", { flat: true }), 0, 0, 0, false);
    forest(group, scatter(42, 16, 1, 7, -16, 4, (x, z, r) => ({ kind: "pine", x, z, h: 4 + r() * 3, s: 1.2, r: r() * 6 })), sky);
  },
  // A dark pine forest behind the netting.
  forest(group, map, sky) {
    verge(group, "#4f6b3a");
    forest(group, [...scatter(51, 30, 0.8, 9, -18, 7, (x, z, r) => ({ kind: "pine", x, z, h: 6 + r() * 4, s: 1.5, r: r() * 6 })), ...scatter(52, 10, 2, 9, -16, 4, (x, z, r) => ({ kind: "leafy", x, z, h: 6 + r() * 3, s: 1.8, r: r() * 6 }))], sky);
  },
  // Deciduous wood for the rope park: big crowns at the edge.
  wood(group, map, sky) {
    verge(group, "#58803f");
    forest(group, [...scatter(61, 24, 0.8, 8, -18, 7, (x, z, r) => ({ kind: "leafy", x, z, h: 6.5 + r() * 3.5, s: 2, r: r() * 6 })), ...scatter(62, 10, 3, 9, -16, 0, (x, z, r) => ({ kind: "pine", x, z, h: 7 + r() * 3, s: 1.6, r: r() * 6 }))], sky);
  },
  // A frontier town across the street, mesas and a water tower in the desert behind.
  town(group, map, sky) {
    verge(group, "#b08a5c");
    const r = rng(71);
    const fronts = ["#8a5a35", "#a3683c", "#7d4c2c", "#9c7a4f"];
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const z = -13 + i * 5.4,
          h = 5 + r() * 2.5,
          x = side * (EDGE + 2.6);
        mesh(group, new T.BoxGeometry(3.6, h, 4.6), mat(haze(fronts[i % 4], sky, 0.1), { roughness: 0.9 }), x, h / 2, z, false);
        // A false front rising above the roof, facing the saloon.
        mesh(group, new T.BoxGeometry(0.15, h + 1.2, 4.6), mat(fronts[(i + 1) % 4], { roughness: 0.9 }), x - side * 1.85, (h + 1.2) / 2, z, false);
        mesh(group, new T.BoxGeometry(0.2, 0.9, 3), mat("#e8d6a8", { emissive: "#ffbe6a", glow: 0.25 }), x - side * 1.95, h - 0.3, z, false);
      }
    const mesas = [];
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1,
        h = 6 + r() * 6,
        w = 8 + r() * 8;
      mesas.push(placed(new T.CylinderGeometry(w * 0.4, w * 0.55, h, 7), side * (EDGE + 13 + r() * 10), h / 2, -22 + r() * 14, r() * 6));
    }
    mesh(group, merge(mesas), mat(haze("#a65a3a", sky, 0.4), { flat: true, roughness: 0.95 }), 0, 0, 0, false);
    // Water tower on stilts.
    const wx = -(EDGE + 6.5),
      wz = -6;
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      mesh(group, new T.CylinderGeometry(0.12, 0.12, 6, 6), mat("#5a3a22"), wx + dx * 1.1, 3, wz + dz * 1.1, false);
    mesh(group, new T.CylinderGeometry(1.7, 1.7, 2.4, 14), mat("#8a5a35", { roughness: 0.9 }), wx, 7.2, wz, false);
    mesh(group, new T.ConeGeometry(1.9, 1.0, 14), mat("#5a3a22"), wx, 8.9, wz, false);
    const cacti = [];
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1,
        x = side * (EDGE + 5 + r() * 8),
        z = -16 + r() * 18,
        h = 1.2 + r() * 1.6;
      cacti.push(placed(new T.CapsuleGeometry(0.18, h, 4, 8), x, h / 2 + 0.2, z));
      cacti.push(placed(new T.CapsuleGeometry(0.12, h * 0.4, 4, 8), x + 0.35, h * 0.6, z));
    }
    mesh(group, merge(cacti), mat("#4f7a3a", { roughness: 0.8 }), 0, 0, 0, false);
  },
  // City blocks with lit windows beyond the skatepark's fences.
  city(group, map, sky) {
    verge(group, "#4a4d54");
    const r = rng(81);
    const texes = [facade("city-a", 6, 8, "#5a5f6a", "#ffe08a", "#2b2f38"), facade("city-b", 5, 7, "#7a6a5e", "#bfe3ff", "#3a3330"), facade("city-c", 7, 9, "#3f4655", "#ffd1a1", "#1f232c")];
    for (const side of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const w = 5 + r() * 4,
          d = 5 + r() * 4,
          h = 9 + r() * 14,
          x = side * (EDGE + 4 + w / 2 + r() * 5),
          z = -20 + i * 6 + r() * 2;
        building(group, x, z, w, d, h, texes[(i + (side > 0 ? 1 : 0)) % 3], "#5a5f6a", "#2b2f38", sky);
      }
    // A billboard on poles.
    const board = canvasTexture("billboard", 256, (c, n) => {
      c.canvas.height = 128;
      const g = c.createLinearGradient(0, 0, n, 0);
      g.addColorStop(0, "#e4573f");
      g.addColorStop(1, "#f2c14e");
      c.fillStyle = g;
      c.fillRect(0, 0, n, 128);
      c.fillStyle = "#1d1f24";
      c.font = "bold 58px Arial, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("KINŌ", n / 2, 66);
    });
    const bx = EDGE + 3.2;
    for (const dz of [-1.6, 1.6]) mesh(group, new T.CylinderGeometry(0.1, 0.1, 6, 6), mat("#3a3d44"), bx, 3, -6 + dz, false);
    const sign = mesh(group, new T.PlaneGeometry(4.5, 2.2), mat(board ? "#ffffff" : "#e4573f", { map: board, emissive: "#ffffff", glow: board ? 0.25 : 0, side: T.DoubleSide }), bx, 6.4, -6, false);
    sign.rotation.y = -Math.PI / 2;
    if (board) sign.material.emissiveMap = board;
  },
  // Snowy pines and drifts; mountains far away.
  winter(group, map, sky) {
    verge(group, "#e6edf6");
    forest(group, scatter(91, 26, 0.8, 9, -18, 7, (x, z, r) => ({ kind: "pine", x, z, h: 5 + r() * 4, s: 1.4, r: r() * 6, snow: true })), sky);
    const r = rng(92),
      hills = [];
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1,
        s = 3 + r() * 5;
      hills.push(placed(new T.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), side * (EDGE + 3 + r() * 12), 0, -20 + r() * 20, r() * 6, 0, 0, [s * 1.6, s * 0.7, s]));
    }
    mesh(group, merge(hills), mat("#f1f5fa", { roughness: 1 }), 0, 0, 0, false);
  },
  // The hall: dark walls with gold pilasters rising behind the curtains, up to the screen's height.
  theater(group, map, sky) {
    for (const side of [-1, 1]) {
      mesh(group, new T.BoxGeometry(0.3, 9, 30), mat("#2a1418", { roughness: 0.9 }), side * (EDGE + 0.35), 4.5, -4, false);
      for (let z = -16; z < 10; z += 3.2) mesh(group, new T.BoxGeometry(0.2, 9, 0.35), mat("#8a6a2a", { metal: 0.5, roughness: 0.4 }), side * (EDGE + 0.15), 4.5, z, false);
    }
  },
};
registerStatics({ backdrop: (group, s, map) => STYLES[s.style]?.(group, map, map.theme?.background || "#1c1b27") });
