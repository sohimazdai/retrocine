// Монстры защиты крепости в 3D: модели семи классов, внутри класса — разные (цвет, уши, шапки,
// оружие, рога, число глаз — всё от «зерна» v, которое сервер выдаёт при появлении), походка, удар,
// вспышка от попадания, падение и полоска здоровья. Логика — в defense.js; здесь только вид.
import * as T from "three";
import { MONSTERS } from "./defense.js";

const SPHERE = new T.SphereGeometry(1, 16, 12),
  LOW = new T.SphereGeometry(1, 9, 7),
  CONE = new T.ConeGeometry(1, 1, 10),
  CYL = new T.CylinderGeometry(1, 1, 1, 10),
  BOX = new T.BoxGeometry(1, 1, 1),
  ROCK = (() => {
    // Глыба для голема: икосаэдр с неровными вершинами.
    const g = new T.IcosahedronGeometry(1, 1),
      p = g.attributes.position,
      seen = new Map();
    let s = 17;
    for (let i = 0; i < p.count; i++) {
      const key = [p.getX(i), p.getY(i), p.getZ(i)].map((v) => v.toFixed(3)).join();
      if (!seen.has(key)) seen.set(key, 0.8 + ((s = (s * 16807) % 2147483647) / 2147483647) * 0.35);
      const k = seen.get(key);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  })();
const capsules = new Map();
const CAPSULE = (r, l) => {
  const key = r + ":" + l;
  if (!capsules.has(key)) capsules.set(key, new T.CapsuleGeometry(r, l, 4, 10));
  return capsules.get(key);
};
const tori = new Map();
const TORUS = (r, t) => {
  const key = r + ":" + t;
  if (!tori.has(key)) tori.set(key, new T.TorusGeometry(r, t, 6, 18));
  return tori.get(key);
};
const WING = (() => {
  // Перепончатое крыло с фестонами по краю.
  const s = new T.Shape();
  s.moveTo(0, 0.03);
  s.lineTo(0.3, 0.12);
  s.lineTo(0.62, 0.08);
  s.quadraticCurveTo(0.5, -0.02, 0.48, -0.12);
  s.quadraticCurveTo(0.38, -0.04, 0.3, -0.14);
  s.quadraticCurveTo(0.2, -0.05, 0.12, -0.12);
  s.quadraticCurveTo(0.06, -0.04, 0, -0.04);
  return new T.ShapeGeometry(s, 4);
})();

function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const pickOf = (r, list) => list[Math.floor(r() * list.length)];
function add(parent, geometry, material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new T.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
function joint(parent, x, y, z) {
  const g = new T.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// Каждый монстр — свои материалы (их подсвечивает попадание), общие геометрии.
function kit() {
  const mats = [];
  const m = (color, o = {}) => {
    const mat = new T.MeshStandardMaterial({ color, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0, flatShading: !!o.flat, transparent: o.opacity != null, opacity: o.opacity ?? 1, emissive: o.glow || "#000000", emissiveIntensity: o.glowK ?? 1, side: o.side ?? T.FrontSide });
    mat.userData.emissive = mat.emissive.clone();
    mat.userData.glowK = mat.emissiveIntensity;
    mats.push(mat);
    return mat;
  };
  return { m, mats };
}
// Глаза: белок и зрачок, смотрят вперёд (+z).
function eyes(parent, k, y, z, gap, r, white = "#fffbe8", pupil = "#151515", n = 2) {
  const w = k.m(white, { rough: 0.3 }),
    p = k.m(pupil, { rough: 0.3 });
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : (i / (n - 1) - 0.5) * gap * 2;
    add(parent, SPHERE, w, x, y, z, r);
    add(parent, SPHERE, p, x, y, z + r * 0.75, r * 0.45);
  }
}

// ——— Классы ———
const BUILD = {
  goblin(rig, k, r) {
    const skin = k.m(pickOf(r, ["#6fae4a", "#86b84c", "#5f9a55", "#9bab45", "#7aa860"]), { rough: 0.65 }),
      cloth = k.m(pickOf(r, ["#7a4a2a", "#8c2f2f", "#5a5a3a", "#3a4a6a"]), { rough: 0.9 }),
      dark = k.m("#2a2018");
    const legs = [-1, 1].map((s) => {
      const leg = joint(rig, s * 0.1, 0.36, 0);
      add(leg, CAPSULE(0.06, 0.2), skin, 0, -0.17, 0);
      add(leg, BOX, dark, 0, -0.33, 0.04, 0.11, 0.06, 0.18);
      return leg;
    });
    add(rig, CAPSULE(0.16, 0.16), skin, 0, 0.55, 0, 1, 1, 0.85);
    add(rig, BOX, cloth, 0, 0.4, 0, 0.34, 0.14, 0.26);
    const head = joint(rig, 0, 0.84, 0.02);
    add(head, SPHERE, skin, 0, 0, 0, 0.21, 0.2, 0.2);
    const ear = 0.16 + r() * 0.16;
    for (const s of [-1, 1]) {
      const e = add(head, CONE, skin, s * (0.2 + ear * 0.4), 0.04, -0.03, 0.06, ear, 0.035);
      e.rotation.z = -s * (Math.PI / 2 - 0.35);
    }
    eyes(head, k, 0.04, 0.15, 0.08, 0.05, pickOf(r, ["#ffe066", "#ff9f40", "#e8ff7a"]));
    const nose = add(head, CONE, skin, 0, -0.03, 0.21, 0.04, 0.12, 0.04);
    nose.rotation.x = Math.PI / 2;
    add(head, BOX, dark, 0, -0.11, 0.16, 0.12, 0.025, 0.02);
    const hat = Math.floor(r() * 3);
    if (hat === 1) add(head, CONE, cloth, 0, 0.2, -0.02, 0.2, 0.28, 0.2);
    if (hat === 2) add(head, SPHERE, k.m("#8a8d92", { metal: 0.6, rough: 0.35 }), 0, 0.06, 0, 0.215, 0.16, 0.215).scale.y = 0.15;
    const arms = [-1, 1].map((s) => {
      const arm = joint(rig, s * 0.2, 0.64, 0);
      add(arm, CAPSULE(0.045, 0.2), skin, 0, -0.15, 0);
      return arm;
    });
    const weapon = Math.floor(r() * 3);
    if (weapon === 0) {
      // Дубинка.
      const club = add(arms[1], CYL, k.m("#7a5434", { rough: 0.9 }), 0, -0.3, 0.12, 0.035, 0.36, 0.035);
      club.rotation.x = Math.PI / 2 - 0.3;
      add(arms[1], SPHERE, k.m("#6a4628", { rough: 0.9 }), 0, -0.36, 0.3, 0.07);
    } else if (weapon === 1) {
      const blade = add(arms[1], BOX, k.m("#c9ccd2", { metal: 0.8, rough: 0.3 }), 0, -0.3, 0.14, 0.02, 0.04, 0.26);
      blade.rotation.x = -0.2;
    }
    return { legs, arms, head, swing: 0.9 };
  },
  bat(rig, k, r) {
    const fur = k.m(pickOf(r, ["#3d2b45", "#4a3328", "#2e2f3d", "#5a2f3f"]), { rough: 0.9 }),
      skin = k.m(pickOf(r, ["#6b4a5a", "#5a4038", "#4a4a5a"]), { rough: 0.6, side: T.DoubleSide });
    add(rig, SPHERE, fur, 0, 0, 0, 0.15, 0.17, 0.15);
    const head = joint(rig, 0, 0.13, 0.06);
    add(head, SPHERE, fur, 0, 0, 0, 0.11);
    for (const s of [-1, 1]) {
      const e = add(head, CONE, fur, s * 0.06, 0.12, 0, 0.04, 0.12, 0.03);
      e.rotation.z = -s * 0.25;
    }
    const glow = pickOf(r, ["#ff3030", "#ffd030", "#a0ff40"]);
    const eye = k.m(glow, { glow, glowK: 1.6 });
    for (const s of [-1, 1]) add(head, SPHERE, eye, s * 0.045, 0.02, 0.09, 0.025);
    // Клыки.
    for (const s of [-1, 1]) {
      const f = add(head, CONE, k.m("#f2f0e6"), s * 0.02, -0.06, 0.08, 0.012, 0.04, 0.012);
      f.rotation.x = Math.PI;
    }
    const span = 0.9 + r() * 0.5;
    const wings = [-1, 1].map((s) => {
      const w = joint(rig, s * 0.1, 0.03, 0);
      const mesh = add(w, WING, skin, 0, 0, 0, s * span, span, span);
      mesh.rotation.x = -Math.PI / 2;
      return w;
    });
    return { wings, head, legs: [], arms: [] };
  },
  zombie(rig, k, r) {
    const skin = k.m(pickOf(r, ["#8aa37a", "#9aa889", "#7f9a86", "#a3a07a", "#8f9e95"]), { rough: 0.8 }),
      shirt = k.m(pickOf(r, ["#5a6b8c", "#7a4a3a", "#6b6b5a", "#4a5a4a", "#8c7a5a", "#7a5a7a"]), { rough: 0.95 }),
      pants = k.m(pickOf(r, ["#3a3a46", "#4a3a2a", "#2e3a3a"]), { rough: 0.95 }),
      dark = k.m("#1b1714");
    const legs = [-1, 1].map((s) => {
      const leg = joint(rig, s * 0.12, 0.86, 0);
      add(leg, CAPSULE(0.085, 0.58), pants, 0, -0.42, 0);
      add(leg, BOX, dark, 0, -0.84, 0.05, 0.14, 0.08, 0.26);
      return leg;
    });
    const body = joint(rig, 0, 0, 0);
    add(body, BOX, shirt, 0, 1.2, 0, 0.46, 0.6, 0.26);
    // Рваный подол.
    for (let i = 0; i < 4; i++) add(body, BOX, shirt, -0.17 + i * 0.115, 0.86 - r() * 0.06, 0, 0.09, 0.1 + r() * 0.08, 0.25);
    const head = joint(rig, 0, 1.66, 0.02);
    head.rotation.z = (r() - 0.5) * 0.5;
    add(head, SPHERE, skin, 0, 0, 0, 0.2, 0.22, 0.2);
    // Один глаз — бельмо.
    add(head, SPHERE, k.m("#f0f0dc"), -0.07, 0.04, 0.16, 0.05);
    add(head, SPHERE, k.m("#c8d8b0"), 0.07, 0.04, 0.16, 0.045);
    add(head, SPHERE, dark, 0.07, 0.04, 0.2, 0.02);
    add(head, BOX, dark, 0, -0.09, 0.18, 0.13, 0.035, 0.02);
    add(head, BOX, k.m("#5a3a3a"), 0.11, 0.1, 0.14, 0.012, 0.11, 0.012).rotation.z = 0.6;
    if (r() < 0.6) add(head, SPHERE, k.m(pickOf(r, ["#3a2a1a", "#6a6a5a", "#2a2a2a"]), { rough: 1 }), 0.03, 0.15, -0.02, 0.12, 0.08, 0.12);
    const oneArm = r() < 0.2;
    const arms = [-1, 1].map((s) => {
      const arm = joint(rig, s * 0.3, 1.42, 0);
      add(arm, CAPSULE(0.065, s < 0 && oneArm ? 0.12 : 0.46), shirt, 0, s < 0 && oneArm ? -0.1 : -0.3, 0);
      if (!(s < 0 && oneArm)) add(arm, SPHERE, skin, 0, -0.62, 0, 0.075);
      // Тянет руки вперёд.
      arm.rotation.x = -1.35 + r() * 0.2;
      return arm;
    });
    return { legs, arms, head, body, reach: true, swing: 0.6, shamble: true };
  },
  skeleton(rig, k, r) {
    const bone = k.m(pickOf(r, ["#e8dfc8", "#d9d2bc", "#efe6cf", "#cfc6a8"]), { rough: 0.55 }),
      dark = k.m("#141210");
    const legs = [-1, 1].map((s) => {
      const leg = joint(rig, s * 0.1, 0.86, 0);
      add(leg, CYL, bone, 0, -0.42, 0, 0.035, 0.82, 0.035);
      add(leg, BOX, bone, 0, -0.84, 0.05, 0.1, 0.04, 0.2);
      return leg;
    });
    add(rig, BOX, bone, 0, 0.9, 0, 0.3, 0.1, 0.14);
    add(rig, CYL, bone, 0, 1.2, -0.04, 0.03, 0.62, 0.03);
    for (let i = 0; i < 3; i++) {
      const rib = add(rig, TORUS(0.16 - i * 0.02, 0.018), bone, 0, 1.38 - i * 0.12, 0.02);
      rib.rotation.x = Math.PI / 2;
    }
    const head = joint(rig, 0, 1.6, 0.02);
    add(head, SPHERE, bone, 0, 0, 0, 0.17, 0.18, 0.17);
    add(head, BOX, bone, 0, -0.14, 0.04, 0.17, 0.06, 0.14);
    const glow = pickOf(r, [null, "#ff4030", "#40c8ff"]);
    for (const s of [-1, 1]) {
      add(head, SPHERE, dark, s * 0.065, 0.02, 0.135, 0.045);
      if (glow) add(head, SPHERE, k.m(glow, { glow, glowK: 2 }), s * 0.065, 0.02, 0.165, 0.018);
    }
    if (r() < 0.4) add(head, SPHERE, k.m("#7a5a3a", { metal: 0.5, rough: 0.5 }), 0, 0.06, 0, 0.19, 0.14, 0.19);
    const arms = [-1, 1].map((s) => {
      const arm = joint(rig, s * 0.22, 1.42, 0);
      add(arm, CYL, bone, 0, -0.27, 0, 0.03, 0.52, 0.03);
      add(arm, SPHERE, bone, 0, -0.55, 0, 0.045);
      return arm;
    });
    const steel = k.m("#9aa0a6", { metal: 0.7, rough: 0.4 });
    if (r() < 0.65) {
      const sword = joint(arms[1], 0, -0.55, 0.05);
      add(sword, BOX, steel, 0, 0, 0.32, 0.025, 0.06, 0.6);
      add(sword, BOX, k.m("#6a4a2a"), 0, 0, 0, 0.03, 0.03, 0.16).rotation.y = Math.PI / 2;
      sword.rotation.x = 0.3;
    } else {
      const axe = joint(arms[1], 0, -0.55, 0.05);
      add(axe, CYL, k.m("#6a4a2a"), 0, 0, 0.25, 0.02, 0.5, 0.02).rotation.x = Math.PI / 2;
      add(axe, BOX, steel, 0, 0.08, 0.46, 0.02, 0.18, 0.12);
    }
    if (r() < 0.5) add(arms[0], CYL, k.m(pickOf(r, ["#7a4a2a", "#5a5a6a"]), { rough: 0.8 }), 0, -0.45, 0.06, 0.2, 0.04, 0.2).rotation.x = Math.PI / 2;
    return { legs, arms, head, swing: 1.1 };
  },
  slime(rig, k, r) {
    const color = pickOf(r, ["#6fdc5a", "#4fb3e8", "#b06fe0", "#f0a040", "#e85a8a"]);
    const jelly = k.m(color, { rough: 0.1, opacity: 0.72, glow: color, glowK: 0.25 });
    const blob = joint(rig, 0, 0, 0);
    add(blob, SPHERE, jelly, 0, 0.4, 0, 0.5, 0.42, 0.5);
    add(blob, SPHERE, k.m(new T.Color(color).multiplyScalar(0.5).getStyle(), { rough: 0.4 }), 0.05, 0.35, -0.05, 0.16);
    // Пузырьки внутри.
    for (let i = 0; i < 4; i++) add(blob, SPHERE, k.m("#ffffff", { opacity: 0.5, rough: 0.1 }), (r() - 0.5) * 0.5, 0.3 + r() * 0.3, (r() - 0.5) * 0.4, 0.03 + r() * 0.04);
    eyes(blob, k, 0.52, 0.36, 0.12, 0.075, "#ffffff", "#111111", 1 + Math.floor(r() * 3));
    if (r() < 0.2) add(blob, CONE, k.m("#f2c94c", { metal: 0.6, rough: 0.3 }), 0, 0.86, 0, 0.12, 0.14, 0.12);
    return { blob, legs: [], arms: [], scale: 0.85 + r() * 0.3 };
  },
  ogre(rig, k, r) {
    const skin = k.m(pickOf(r, ["#8f9a5a", "#9a7d5a", "#7a8f8f", "#a08a6a", "#6f8a5a"]), { rough: 0.75 }),
      fur = k.m(pickOf(r, ["#6a4a2a", "#5a4a3a", "#7a5a3a"]), { rough: 1 }),
      tusk = k.m("#f2ead2", { rough: 0.4 }),
      dark = k.m("#1d1612");
    const legs = [-1, 1].map((s) => {
      const leg = joint(rig, s * 0.3, 1.0, 0);
      add(leg, CAPSULE(0.2, 0.55), skin, 0, -0.5, 0);
      add(leg, SPHERE, skin, 0, -0.95, 0.08, 0.24, 0.12, 0.3);
      return leg;
    });
    const body = joint(rig, 0, 0, 0);
    add(body, SPHERE, skin, 0, 1.55, 0.05, 0.62, 0.66, 0.52);
    add(body, BOX, fur, 0, 1.05, 0, 0.9, 0.34, 0.6);
    add(body, TORUS(0.56, 0.05), k.m("#4a3420"), 0, 1.2, 0.02).rotation.x = Math.PI / 2;
    const head = joint(rig, 0, 2.28, 0.18);
    add(head, SPHERE, skin, 0, 0, 0, 0.28, 0.26, 0.27);
    add(head, BOX, dark, 0, 0.1, 0.22, 0.26, 0.04, 0.04);
    eyes(head, k, 0.04, 0.22, 0.09, 0.04, "#fff3c0", "#201010");
    for (const s of [-1, 1]) {
      const t = add(head, CONE, tusk, s * 0.1, -0.07, 0.23, 0.035, 0.14, 0.035);
      t.rotation.x = -0.2;
    }
    if (r() < 0.55)
      for (const s of [-1, 1]) {
        const h = add(head, CONE, tusk, s * 0.18, 0.24, -0.02, 0.05, 0.24, 0.05);
        h.rotation.z = -s * 0.5;
      }
    for (const s of [-1, 1]) add(head, SPHERE, skin, s * 0.27, 0.02, -0.02, 0.06, 0.1, 0.04);
    const arms = [-1, 1].map((s) => {
      const arm = joint(rig, s * 0.68, 1.95, 0.05);
      add(arm, CAPSULE(0.16, 0.7), skin, 0, -0.5, 0);
      add(arm, SPHERE, skin, 0, -1.0, 0.04, 0.21);
      return arm;
    });
    const wood = k.m("#7a5434", { rough: 0.9 });
    if (r() < 0.6) {
      const club = joint(arms[1], 0, -1.0, 0.05);
      add(club, CYL, wood, 0, 0, 0.45, 0.07, 0.9, 0.07).rotation.x = Math.PI / 2;
      add(club, CONE, wood, 0, 0, 0.95, 0.16, 0.32, 0.16).rotation.x = -Math.PI / 2;
      for (let i = 0; i < 4; i++) add(club, CONE, k.m("#c9ccd2", { metal: 0.6 }), Math.cos(i * 1.6) * 0.14, Math.sin(i * 1.6) * 0.14, 0.9, 0.03, 0.1, 0.03).rotation.z = i * 1.6;
    } else {
      const ham = joint(arms[1], 0, -1.0, 0.05);
      add(ham, CYL, wood, 0, 0, 0.4, 0.05, 0.8, 0.05).rotation.x = Math.PI / 2;
      add(ham, BOX, k.m("#7d786e", { flat: true }), 0, 0, 0.82, 0.42, 0.26, 0.26);
    }
    return { legs, arms, head, body, swing: 1.2, heavy: true };
  },
  golem(rig, k, r) {
    const rockC = pickOf(r, ["#8a857a", "#7a7068", "#6f7a7e", "#857563"]),
      rune = pickOf(r, ["#5ef0ff", "#ffb347", "#7dff6a", "#c77dff"]);
    const rock = k.m(rockC, { flat: true, rough: 0.95 }),
      glow = k.m(rune, { glow: rune, glowK: 2.2 }),
      moss = k.m("#6a8f45", { rough: 1 });
    const legs = [-1, 1].map((s) => {
      const leg = joint(rig, s * 0.45, 1.25, 0);
      add(leg, ROCK, rock, 0, -0.35, 0, 0.32, 0.42, 0.32);
      add(leg, ROCK, rock, 0, -0.95, 0.05, 0.36, 0.32, 0.42);
      return leg;
    });
    const body = joint(rig, 0, 0, 0);
    add(body, ROCK, rock, 0, 2.15, 0, 0.95, 0.85, 0.7);
    add(body, ROCK, rock, 0, 1.45, 0, 0.6, 0.45, 0.5);
    // Руны на груди и трещины, в которых светится.
    add(body, BOX, glow, 0, 2.25, 0.64, 0.4, 0.06, 0.04);
    add(body, BOX, glow, 0, 2.05, 0.66, 0.06, 0.4, 0.04);
    add(body, BOX, glow, 0.25, 1.9, 0.62, 0.22, 0.05, 0.04).rotation.z = 0.6;
    if (r() < 0.6) add(body, SPHERE, moss, -0.4, 2.85, -0.05, 0.4, 0.14, 0.35);
    const head = joint(rig, 0, 3.15, 0.2);
    add(head, ROCK, rock, 0, 0, 0, 0.38, 0.32, 0.34);
    for (const s of [-1, 1]) add(head, BOX, glow, s * 0.13, 0.03, 0.3, 0.09, 0.05, 0.04);
    if (r() < 0.5)
      for (const s of [-1, 1]) {
        const c = add(body, CONE, glow, s * 0.75, 2.95, 0, 0.12, 0.45, 0.12);
        c.rotation.z = -s * 0.35;
      }
    const arms = [-1, 1].map((s) => {
      const arm = joint(rig, s * 1.05, 2.5, 0);
      add(arm, ROCK, rock, 0, -0.1, 0, 0.42, 0.4, 0.42);
      add(arm, ROCK, rock, 0, -0.75, 0.05, 0.3, 0.42, 0.3);
      add(arm, ROCK, rock, 0, -1.35, 0.1, 0.42, 0.38, 0.42);
      return arm;
    });
    return { legs, arms, head, body, swing: 1.0, heavy: true, both: true };
  },
};

class MonsterView {
  constructor(m) {
    this.id = m.id;
    this.c = m.c;
    this.cls = MONSTERS[m.c];
    const k = kit(),
      r = rng(m.v * 9301 + 49297 + m.c.length * 7);
    this.root = new T.Group();
    this.root.userData = { kind: "monster", id: m.id };
    this.rig = new T.Group();
    this.root.add(this.rig);
    this.parts = BUILD[m.c](this.rig, k, r);
    this.mats = k.mats;
    // Внутри класса — чуть разного роста.
    const size = this.parts.scale || 0.92 + ((m.v * 13) % 17) / 100;
    this.rig.scale.setScalar(size);
    this.root.traverse((o) => {
      if (o.isMesh) o.castShadow = o.scale.x > 0.1 || o.scale.y > 0.3;
    });
    this.x = m.x;
    this.z = m.z;
    this.a = m.a ?? -Math.PI / 2;
    this.target = { x: m.x, z: m.z, a: this.a, st: m.st || 0 };
    this.hp = m.hp;
    this.max = m.max;
    this.phase = Math.random() * 6;
    this.flash = 0;
    this.strike = 0;
    this.dead = null;
    this.bar = makeBar();
    this.bar.position.y = this.cls.tall * size + 0.3;
    this.bar.visible = false;
    this.root.add(this.bar);
  }
  // Новые данные с сервера (или из своей симуляции без него).
  set(m) {
    this.target = { x: m.x, z: m.z, a: m.a, st: m.st };
  }
  setHp(hp) {
    this.hp = hp;
    this.flash = 1;
    this.bar.visible = hp < this.max && hp > 0;
    const k = Math.max(0, hp / this.max);
    this.bar.userData.fill.scale.x = Math.max(0.001, k);
    this.bar.userData.fill.position.x = -(1 - k) * 0.35;
    this.bar.userData.fill.material.color.set(k > 0.5 ? "#7bd64a" : k > 0.25 ? "#f0b43a" : "#e8452f");
  }
  attack() {
    this.strike = 1;
  }
  update(dt, t, ground, camera) {
    const p = this.parts,
      cls = this.cls;
    if (this.dead) return this.dying(dt);
    const k = 1 - Math.exp(-dt * 9),
      ox = this.x,
      oz = this.z;
    this.x += (this.target.x - this.x) * k;
    this.z += (this.target.z - this.z) * k;
    this.a += Math.atan2(Math.sin(this.target.a - this.a), Math.cos(this.target.a - this.a)) * Math.min(1, dt * 10);
    const speed = Math.hypot(this.x - ox, this.z - oz) / Math.max(dt, 1e-4),
      walk = Math.min(1, speed / Math.max(0.4, cls.speed * 0.6));
    this.phase += dt * (2 + cls.speed * 3.2) * (0.3 + walk * 0.7);
    const y = ground(this.x, this.z) + (cls.fly ? cls.fly + Math.sin(t * 2.4 + this.phase * 0.2) * 0.18 : 0);
    this.root.position.set(this.x, y, this.z);
    this.root.rotation.y = this.a;
    const s = Math.sin(this.phase);
    // Ноги шагают, руки машут (у зомби — вытянуты вперёд), тело качается.
    p.legs.forEach((leg, i) => (leg.rotation.x = (i ? s : -s) * 0.55 * walk));
    const strike = this.strike;
    this.strike = Math.max(0, this.strike - dt * 2.4);
    // Удар: замах и резкий удар вниз.
    const blow = strike > 0 ? (strike > 0.55 ? -(1 - strike) * 5.5 : -2.5 + (0.55 - strike) * 6) : 0;
    p.arms.forEach((arm, i) => {
      const base = p.reach ? -1.3 : 0;
      const swing = p.reach ? Math.sin(this.phase * 0.5 + i) * 0.12 : (i ? -s : s) * 0.5 * walk;
      arm.rotation.x = base + swing + (strike > 0 && (i === 1 || p.both) ? blow * (p.swing || 1) * 0.6 : 0);
    });
    if (p.shamble) this.rig.rotation.z = Math.sin(this.phase * 0.5) * 0.08;
    if (p.body && p.heavy) p.body.position.y = Math.abs(s) * 0.04 * walk;
    if (p.head) p.head.rotation.y = Math.sin(t * 0.7 + this.phase * 0.1) * 0.25;
    if (p.wings) {
      const flap = Math.sin(t * 16 + this.phase) * 0.7;
      p.wings[0].rotation.z = -flap;
      p.wings[1].rotation.z = flap;
      this.rig.rotation.x = strike > 0 ? -0.6 * strike : 0.15;
    }
    if (p.blob) {
      // Слизень прыгает: сплющивается и вытягивается.
      const hop = Math.abs(Math.sin(this.phase * 0.8));
      p.blob.scale.set(1 + (1 - hop) * 0.18 + strike * 0.2, 0.82 + hop * 0.28 - strike * 0.25, 1 + (1 - hop) * 0.18 + strike * 0.2);
      p.blob.position.y = hop * 0.12 * walk;
    }
    // Вспышка от попадания.
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 6);
      for (const m of this.mats) {
        m.emissive.copy(m.userData.emissive).lerp(WHITE, this.flash * 0.8);
        m.emissiveIntensity = Math.max(m.userData.glowK, this.flash * 1.2);
      }
    }
    if (this.bar.visible && camera) this.bar.quaternion.copy(camera.quaternion).premultiply(INVERSE.setFromAxisAngle(UP, -this.a));
    return true;
  }
  die() {
    this.dead = { t: 0 };
    this.bar.visible = false;
  }
  // Падает на спину, тускнеет и уходит в землю.
  dying(dt) {
    const d = this.dead;
    d.t += dt;
    const k = Math.min(1, d.t / 0.35);
    this.rig.rotation.x = -k * (this.cls.fly ? 0 : 1.45);
    if (this.cls.fly) this.root.position.y = Math.max(0.1, this.root.position.y - dt * 4);
    const fade = Math.max(0, 1 - Math.max(0, d.t - 0.45) / 0.5);
    for (const m of this.mats) {
      m.transparent = true;
      m.opacity = Math.min(m.opacity, fade);
    }
    this.root.position.y -= Math.max(0, d.t - 0.6) * dt * 0.8;
    return d.t < 1;
  }
  dispose() {
    for (const m of this.mats) m.dispose();
    this.bar.userData.fill.material.dispose();
    this.bar.userData.back.material.dispose();
  }
}
const WHITE = new T.Color("#ffffff"),
  UP = new T.Vector3(0, 1, 0),
  INVERSE = new T.Quaternion();
const PLANE = new T.PlaneGeometry(1, 1);
function makeBar() {
  const g = new T.Group(),
    back = new T.Mesh(PLANE, new T.MeshBasicMaterial({ color: "#1a1416", transparent: true, opacity: 0.75, depthWrite: false })),
    fill = new T.Mesh(PLANE, new T.MeshBasicMaterial({ color: "#7bd64a", transparent: true, depthWrite: false }));
  back.scale.set(0.76, 0.12, 1);
  fill.scale.set(0.7, 0.07, 1);
  fill.position.z = 0.002;
  // Оба прозрачные и по порядку: подложка, потом заливка поверх неё.
  back.renderOrder = 5;
  fill.renderOrder = 6;
  g.add(back, fill);
  g.userData = { back, fill };
  return g;
}

// Все монстры на сцене.
export class MonsterLayer {
  // added / removed: кому сказать о появлении и уходе монстра (браузер добавляет их в цели снарядов).
  constructor(scene, { added = () => {}, removed = () => {} } = {}) {
    this.scene = scene;
    this.views = new Map();
    this.dying = [];
    this.added = added;
    this.removed = removed;
  }
  get roots() {
    return [...this.views.values()].map((v) => v.root);
  }
  // Привести сцену к списку монстров: новых — построить, пропавших — убрать (убитые падают отдельно).
  sync(list) {
    const ids = new Set();
    for (const m of list) {
      ids.add(m.id);
      const v = this.views.get(m.id);
      if (v) v.set(m);
      else this.add(m);
    }
    for (const [id, v] of this.views) if (!ids.has(id)) this.remove(id, false);
  }
  add(m) {
    if (!MONSTERS[m.c]) return null;
    const v = new MonsterView(m);
    this.views.set(m.id, v);
    this.scene.add(v.root);
    this.added(v.root);
    if (m.hp < m.max) v.setHp(m.hp);
    return v;
  }
  hit(id, hp) {
    this.views.get(id)?.setHp(hp);
  }
  // Вспышка сразу при попадании (здоровье придёт с сервера).
  flash(id) {
    const v = this.views.get(id);
    if (v) v.flash = 1;
  }
  attack(id) {
    this.views.get(id)?.attack();
  }
  // Убит — падает; иначе (ушёл со сменой волны) — исчезает сразу.
  remove(id, killed = true) {
    const v = this.views.get(id);
    if (!v) return null;
    this.views.delete(id);
    this.removed(v.root);
    if (killed) {
      v.die();
      this.dying.push(v);
    } else {
      this.scene.remove(v.root);
      v.dispose();
    }
    return v;
  }
  clear() {
    for (const id of [...this.views.keys()]) this.remove(id, false);
    for (const v of this.dying) {
      this.scene.remove(v.root);
      v.dispose();
    }
    this.dying = [];
  }
  update(dt, t, ground, camera) {
    for (const v of this.views.values()) v.update(dt, t, ground, camera);
    this.dying = this.dying.filter((v) => {
      if (v.update(dt, t, ground, camera)) return true;
      this.scene.remove(v.root);
      v.dispose();
      return false;
    });
  }
}
