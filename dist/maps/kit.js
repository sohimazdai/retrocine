// Building blocks for map scenery: seeded randomness, canvas textures, rocks, trees, merged boxes.
// Everything made here is marked as owned (props.js), so it is freed when the map changes.
import * as T from "three";
import { own } from "../props.js";

export function rng(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
export function mat(color, opts = {}) {
  return own(
    new T.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.75,
      metalness: opts.metal ?? 0,
      flatShading: !!opts.flat,
      transparent: opts.opacity != null && opts.opacity < 1,
      opacity: opts.opacity ?? 1,
      emissive: opts.emissive || "#000000",
      emissiveIntensity: opts.glow ?? 1,
      map: opts.map || null,
      side: opts.side ?? T.FrontSide,
      depthWrite: opts.depthWrite ?? true,
      vertexColors: !!opts.vertexColors,
    }),
  );
}
export function mesh(parent, geometry, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new T.Mesh(own(geometry), material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ——— Canvas textures (drawn once per page; shared by every build of a map) ———
const textureCache = new Map();
export function canvasTexture(key, size, paint, repeat = [1, 1]) {
  if (textureCache.has(key)) return textureCache.get(key);
  let tex = null;
  try {
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const c = cv.getContext("2d");
    if (c) {
      paint(c, size, rng(key.length * 7919 + size));
      tex = new T.CanvasTexture(cv);
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(...repeat);
      tex.colorSpace = T.SRGBColorSpace;
    }
  } catch {
    tex = null;
  }
  textureCache.set(key, tex);
  return tex;
}
export const TEXTURES = {
  leaves: () =>
    canvasTexture("leaves", 256, (c, n, r) => {
      c.fillStyle = "#3f7a35";
      c.fillRect(0, 0, n, n);
      for (let i = 0; i < 1500; i++) {
        c.fillStyle = ["#4f8f41", "#356a2d", "#5fa04c", "#2d5c27", "#6fb257"][i % 5];
        const x = r() * n,
          y = r() * n,
          s = 3 + r() * 6;
        c.beginPath();
        c.ellipse(x, y, s, s * 0.6, r() * Math.PI, 0, Math.PI * 2);
        c.fill();
      }
    }),
  rock: () =>
    canvasTexture("rock", 256, (c, n, r) => {
      c.fillStyle = "#8a847a";
      c.fillRect(0, 0, n, n);
      for (let i = 0; i < 900; i++) {
        c.fillStyle = ["#7b756c", "#968f84", "#6e695f", "#a39c90", "#85807a"][i % 5];
        c.fillRect(r() * n, r() * n, 4 + r() * 14, 2 + r() * 6);
      }
      c.strokeStyle = "#5a554d";
      c.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) {
        c.beginPath();
        let x = r() * n,
          y = r() * n;
        c.moveTo(x, y);
        for (let k = 0; k < 4; k++) c.lineTo((x += (r() - 0.5) * 50), (y += r() * 30));
        c.stroke();
      }
    }),
  water: () =>
    canvasTexture("water", 256, (c, n, r) => {
      const g = c.createLinearGradient(0, 0, n, 0);
      g.addColorStop(0, "#2f6f86");
      g.addColorStop(0.5, "#3a87a0");
      g.addColorStop(1, "#2f6f86");
      c.fillStyle = g;
      c.fillRect(0, 0, n, n);
      for (let i = 0; i < 220; i++) {
        c.strokeStyle = `rgba(220,245,255,${0.12 + r() * 0.3})`;
        c.lineWidth = 1 + r() * 2;
        const x = r() * n,
          y = r() * n,
          l = 10 + r() * 40;
        c.beginPath();
        c.moveTo(x, y);
        c.bezierCurveTo(x + 4, y + l / 3, x - 4, y + (2 * l) / 3, x + (r() - 0.5) * 6, y + l);
        c.stroke();
      }
    }),
  wood: () =>
    canvasTexture("wood", 256, (c, n, r) => {
      c.fillStyle = "#7a4c2c";
      c.fillRect(0, 0, n, n);
      for (let i = 0; i < 70; i++) {
        c.strokeStyle = ["#6a4026", "#87583a", "#5e3820"][i % 3];
        c.lineWidth = 1 + r() * 2;
        const y = r() * n;
        c.beginPath();
        c.moveTo(0, y);
        c.bezierCurveTo(n / 3, y + (r() - 0.5) * 10, (2 * n) / 3, y + (r() - 0.5) * 10, n, y);
        c.stroke();
      }
    }),
  hay: () =>
    canvasTexture("hay", 256, (c, n, r) => {
      c.fillStyle = "#d8b55a";
      c.fillRect(0, 0, n, n);
      for (let i = 0; i < 1400; i++) {
        c.strokeStyle = ["#e9cb74", "#c49a3f", "#f0d88f", "#b88d36"][i % 4];
        c.lineWidth = 1 + r();
        const x = r() * n,
          y = r() * n,
          a = Math.PI / 2 + (r() - 0.5) * 0.9,
          l = 8 + r() * 18;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        c.stroke();
      }
    }),
};

// Box with UVs in world units (one texture repeat per `unit`), so textures keep their scale.
export function worldBox(w, h, d, unit = 1.5) {
  const g = new T.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faces = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * faces[f][0]) / unit, (uv.getY(k) * faces[f][1]) / unit);
    }
  return g;
}
// Joins many geometries (each already placed with a matrix) into one, for fewer draw calls.
export function merge(parts) {
  const list = parts.map(({ geometry, matrix }) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    return g;
  });
  const out = new T.BufferGeometry();
  for (const name of ["position", "normal", "uv", "color"]) {
    if (!list.every((g) => g.attributes[name])) continue;
    const size = list[0].attributes[name].itemSize;
    const array = new Float32Array(list.reduce((n, g) => n + g.attributes[name].count * size, 0));
    let offset = 0;
    for (const g of list) {
      array.set(g.attributes[name].array, offset);
      offset += g.attributes[name].array.length;
    }
    out.setAttribute(name, new T.BufferAttribute(array, size));
  }
  for (const g of list) g.dispose();
  for (const { geometry } of parts) geometry.dispose();
  out.computeBoundingSphere();
  return out;
}
export const placed = (geometry, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = [1, 1, 1]) => ({
  geometry,
  matrix: new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(...s)),
});

// A lumpy low-poly rock, deterministic for a seed.
export function rockGeometry(seed, detail = 1) {
  const g = new T.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position,
    r = rng(seed * 131 + 7);
  const offsets = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = [pos.getX(i), pos.getY(i), pos.getZ(i)].map((v) => v.toFixed(3)).join();
    if (!offsets.has(key)) offsets.set(key, 0.78 + r() * 0.36);
    const k = offsets.get(key);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}
export function rock(parent, x, y, z, sx, sy, sz, color = "#8d877d", seed = 1) {
  const m = mesh(parent, rockGeometry(seed), mat(color, { flat: true, roughness: 0.95 }), x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.y = seed * 1.7;
  return m;
}
export function pine(parent, x, z, h = 3, y = 0, seed = 1) {
  const g = new T.Group();
  g.position.set(x, y, z);
  const r = rng(seed);
  mesh(g, new T.CylinderGeometry(0.09 * h * 0.4, 0.13 * h * 0.4, h * 0.3, 7), mat("#5b3d26"), 0, h * 0.15, 0);
  const greens = ["#2f5b3a", "#386b42", "#2a5034"];
  for (let i = 0; i < 3; i++) {
    const rr = h * (0.36 - i * 0.08),
      hh = h * (0.42 - i * 0.06);
    const cone = mesh(g, new T.ConeGeometry(rr, hh, 8), mat(greens[i], { flat: true }), 0, h * (0.32 + i * 0.2) + hh / 2, 0);
    cone.rotation.y = r() * Math.PI;
  }
  parent.add(g);
  return g;
}
export function leafyTree(parent, x, z, h = 3.2, seed = 1) {
  const g = new T.Group();
  g.position.set(x, 0, z);
  const r = rng(seed);
  mesh(g, new T.CylinderGeometry(0.12, 0.18, h * 0.55, 8), mat("#6b4a2f"), 0, h * 0.27, 0);
  for (let i = 0; i < 4; i++) {
    const s = h * (0.22 + r() * 0.08);
    const m = mesh(g, new T.IcosahedronGeometry(s, 1), mat(["#4c8a3f", "#5a9a49", "#437c38"][i % 3], { flat: true }), (r() - 0.5) * h * 0.3, h * (0.62 + r() * 0.18), (r() - 0.5) * h * 0.3);
    m.rotation.set(r(), r(), r());
  }
  parent.add(g);
  return g;
}
// A sprite-like text sign drawn on a canvas.
export function signTexture(key, text, { w = 512, h = 128, bg = "#5b3a22", fg = "#f6dfb0", font = "bold 72px Georgia, serif", border = "#3a2414" } = {}) {
  return canvasTexture("sign:" + key, w, (c) => {
    c.canvas.height = h;
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = border;
    c.lineWidth = 10;
    c.strokeRect(5, 5, w - 10, h - 10);
    c.fillStyle = fg;
    c.font = font;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, w / 2, h / 2 + 4);
  });
}
