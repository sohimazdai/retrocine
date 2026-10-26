import * as T from "three";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";

const geometries = new Map(),
  materials = new Map();
export function material(color, roughness = 0.65) {
  const key = color + "|" + roughness;
  if (!materials.has(key))
    materials.set(
      key,
      new T.MeshStandardMaterial({
        color,
        roughness,
        metalness: roughness < 0.2 ? 0.08 : 0,
      }),
    );
  return materials.get(key);
}
export function rounded(w, h, d, radius = 0.08) {
  const key = [w, h, d, radius].join();
  if (!geometries.has(key))
    geometries.set(key, new RoundedBoxGeometry(w, h, d, 3, radius));
  return geometries.get(key);
}
export function box(
  parent,
  w,
  h,
  d,
  color,
  x = 0,
  y = 0,
  z = 0,
  radius = 0.06,
) {
  const mesh = new T.Mesh(
    rounded(w, h, d, radius),
    typeof color === "string" ? material(color) : color,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const sphereGeometry = new T.SphereGeometry(1, 20, 14);
export function ball(
  parent,
  color,
  x,
  y,
  z,
  sx,
  sy = sx,
  sz = sx,
  roughness = 0.6,
) {
  const mesh = new T.Mesh(
    sphereGeometry,
    typeof color === "string" ? material(color, roughness) : color,
  );
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(parent, color, radiusTop, radiusBottom, height, x, y, z) {
  const key = ["cylinder", radiusTop, radiusBottom, height].join();
  if (!geometries.has(key))
    geometries.set(
      key,
      new T.CylinderGeometry(radiusTop, radiusBottom, height, 24),
    );
  const mesh = new T.Mesh(geometries.get(key), material(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function pivot(parent, x, y, z) {
  const group = new T.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

export const HAIRSTYLES = [
  ["short", "Короткие"],
  ["long", "Длинные"],
  ["bun", "Пучок"],
  ["curly", "Кудри"],
  ["flame", "Живой огонь"],
  ["bald", "Без волос"],
];
export const HEADWEAR = [
  ["none", "Без шапки"],
  ["headphones", "Наушники"],
  ["ushanka", "Ушанка"],
  ["swim", "Плавательная"],
  ["cowboy", "Ковбойская"],
  ["cap", "Кепка"],
  ["bear", "Голова медведя"],
];
export const OUTFITS = [
  ["hoodie", "Худи"],
  ["tshirt", "Футболка"],
  ["suit", "Костюм"],
  ["tracksuit", "Спортивный"],
  ["spacesuit", "Космонавт"],
  ["wizard", "Маг"],
  ["raincoat", "Дождевик"],
];
export const FOOTWEAR = [
  ["sneakers", "Кроссовки"],
  ["boots", "Ботинки"],
  ["loafers", "Туфли"],
  ["space", "Луноходы"],
  ["bare", "Босиком"],
];
export const LOOKS = [
  {
    id: "everyday",
    name: "На расслабоне",
    color: "#ae92d6",
    hairstyle: "short",
    headwear: "headphones",
    mask: "none",
    outfit: "hoodie",
    footwear: "sneakers",
    pantsColor: "#454050",
  },
  {
    id: "cosmic",
    name: "На орбите",
    color: "#e7e3ed",
    hairstyle: "short",
    headwear: "none",
    mask: "none",
    outfit: "spacesuit",
    footwear: "space",
    pantsColor: "#d8d3e3",
  },
  {
    id: "wildwest",
    name: "Дикий запад",
    color: "#bf8d62",
    hairstyle: "long",
    headwear: "cowboy",
    mask: "none",
    outfit: "suit",
    footwear: "boots",
    pantsColor: "#5f4b3b",
  },
  {
    id: "firestarter",
    name: "Горячая идея",
    color: "#42414e",
    hairstyle: "flame",
    headwear: "none",
    mask: "none",
    outfit: "tracksuit",
    footwear: "sneakers",
    pantsColor: "#383643",
  },
  {
    id: "bear",
    name: "Обнимательный",
    color: "#ac7e5b",
    hairstyle: "short",
    headwear: "bear",
    mask: "none",
    outfit: "hoodie",
    footwear: "bare",
    pantsColor: "#8c674b",
  },
  {
    id: "winter",
    name: "Зимний",
    color: "#94a5ba",
    hairstyle: "short",
    headwear: "ushanka",
    mask: "none",
    outfit: "raincoat",
    footwear: "boots",
    pantsColor: "#403a4b",
  },
];
export function normalizeProfile(profile) {
  const legacy = profile.hat || "headphones";
  return {
    ...profile,
    hairstyle:
      profile.hairstyle ||
      (["long", "bun", "bald"].includes(legacy) ? legacy : "short"),
    headwear:
      (profile.mask === "bear" ? "bear" : profile.headwear) ||
      (["cap", "headphones"].includes(legacy) ? legacy : "none"),
    glasses: profile.glasses ?? legacy === "glasses",
    mask: "none",
    outfit: profile.outfit || "hoodie",
    footwear: profile.footwear || "sneakers",
    pantsColor: profile.pantsColor || "#454050",
    shoeColor: profile.shoeColor || "#f0e9f0",
  };
}

export function avatar(input) {
  const p = normalizeProfile(input),
    root = new T.Group(),
    model = pivot(root, 0, 0, 0);
  const skin = p.skin || "#e4b59b",
    color = p.color || "#ae92d6",
    hair = p.hairColor || "#493339";
  const torso = pivot(model, 0, 0.58, 0),
    neck = pivot(torso, 0, 0.22, 0);
  const coat = ["suit", "wizard", "raincoat"].includes(p.outfit);
  box(
    torso,
    p.outfit === "spacesuit" ? 0.5 : 0.44,
    coat ? 0.55 : 0.43,
    0.34,
    color,
    0,
    coat ? -0.1 : -0.03,
    0,
    0.09,
  );
  box(neck, 0.17, 0.14, 0.19, skin, 0, 0, 0, 0.04);
  if (p.outfit === "hoodie") {
    ball(torso, color, 0, 0.18, -0.11, 0.25, 0.16, 0.2);
    box(torso, 0.23, 0.12, 0.02, color, 0, -0.13, 0.18, 0.02);
    for (const x of [-0.07, 0.07])
      box(torso, 0.018, 0.16, 0.02, "#e9e1f1", x, 0.04, 0.185, 0.006);
  }
  if (p.outfit === "suit") {
    box(torso, 0.18, 0.3, 0.025, "#f6f0ea", 0, 0.02, 0.18, 0.015);
    for (const side of [-1, 1]) {
      const lapel = box(
        torso,
        0.09,
        0.27,
        0.035,
        color,
        side * 0.09,
        0.04,
        0.21,
        0.01,
      );
      lapel.rotation.z = side * 0.27;
    }
    box(torso, 0.045, 0.2, 0.025, "#b3647d", 0, 0.01, 0.225, 0.01);
    for (const y of [-0.16, -0.04]) ball(torso, "#d3be91", 0.04, y, 0.2, 0.017);
  }
  if (p.outfit === "spacesuit") {
    box(torso, 0.24, 0.2, 0.055, "#55546a", 0, 0.015, 0.205, 0.025);
    for (let i = 0; i < 3; i++)
      ball(
        torso,
        ["#e6ad77", "#a9dfcf", "#b1a7ec"][i],
        -0.07 + i * 0.07,
        0.045,
        0.245,
        0.019,
      );
    box(torso, 0.36, 0.36, 0.2, "#c1bdcf", 0, 0.02, -0.24, 0.05);
  }
  if (p.outfit === "tracksuit") {
    box(torso, 0.025, 0.36, 0.018, "#f5ecee", 0, -0.015, 0.18, 0.008);
    for (const side of [-1, 1])
      box(
        torso,
        0.045,
        0.36,
        0.025,
        "#efecf4",
        side * 0.16,
        -0.015,
        0.18,
        0.008,
      );
  }
  if (p.outfit === "wizard") {
    box(torso, 0.06, 0.5, 0.025, "#d7b875", 0, -0.08, 0.19, 0.012);
    ball(torso, "#d7b875", 0, 0.13, 0.2, 0.04);
  }
  if (p.outfit === "raincoat") {
    box(torso, 0.03, 0.48, 0.025, "#d1c19a", 0, -0.08, 0.185, 0.007);
    for (const side of [-1, 1])
      box(torso, 0.12, 0.1, 0.04, color, side * 0.13, -0.2, 0.19, 0.018);
    ball(torso, color, 0, 0.19, -0.12, 0.27, 0.16, 0.2);
  }

  const legs = [],
    knees = [],
    feet = [],
    arms = [],
    elbows = [],
    hands = [];
  for (const side of [-1, 1]) {
    const leg = pivot(model, side * 0.125, 0.34, 0);
    box(leg, 0.16, 0.17, 0.18, p.pantsColor, 0, -0.065, 0, 0.045);
    const knee = pivot(leg, 0, -0.145, 0);
    box(knee, 0.15, 0.12, 0.16, p.pantsColor, 0, -0.045, 0, 0.04);
    const foot = pivot(knee, 0, -0.11, 0.025);
    const boot = ["boots", "space"].includes(p.footwear),
      bare = p.footwear === "bare";
    box(
      foot,
      boot ? 0.23 : 0.2,
      boot ? 0.2 : 0.12,
      0.29,
      bare ? skin : p.footwear === "loafers" ? "#42353c" : p.shoeColor,
      0,
      boot ? 0.03 : -0.005,
      0.035,
      0.045,
    );
    if (!bare)
      box(
        foot,
        boot ? 0.235 : 0.21,
        0.027,
        0.3,
        p.footwear === "loafers" ? "#271e29" : "#b9acc8",
        0,
        -0.065,
        0.04,
        0.012,
      );
    if (p.footwear === "sneakers")
      for (const y of [0.01, 0.045])
        box(foot, 0.11, 0.012, 0.018, "#8d7e9f", 0, y, 0.165, 0.004);
    legs.push(leg);
    knees.push(knee);
    feet.push(foot);
    const arm = pivot(torso, side * 0.29, 0.12, 0);
    box(arm, 0.16, 0.2, 0.18, color, 0, -0.075, 0, 0.055);
    const elbow = pivot(arm, 0, -0.18, 0);
    box(
      elbow,
      0.135,
      0.13,
      0.15,
      p.outfit === "tshirt" ? skin : color,
      0,
      -0.045,
      0,
      0.045,
    );
    const hand = ball(
      elbow,
      p.outfit === "spacesuit" ? "#e9e2ed" : skin,
      0,
      -0.14,
      0.01,
      0.08,
      0.09,
      0.08,
    );
    if (p.outfit === "tracksuit")
      box(arm, 0.04, 0.19, 0.02, "#f3eaf4", side * 0.025, -0.075, 0.09, 0.008);
    arms.push(arm);
    elbows.push(elbow);
    hands.push(hand);
  }

  const head = pivot(model, 0, 1.15, 0),
    face = pivot(head, 0, 0, 0);
  box(face, 0.82, 0.74, 0.69, skin, 0, 0, 0, 0.16);
  const eyes = [],
    brows = [],
    cheeks = [];
  for (const side of [-1, 1]) {
    ball(face, skin, side * 0.42, -0.04, 0, 0.068, 0.11, 0.085);
    const eye = pivot(face, side * 0.215, 0.02, 0.335);
    ball(eye, "#17131b", 0, 0, 0, 0.139, 0.158, 0.073, 0.1);
    ball(eye, "#ffffff", -0.035, 0.053, 0.064, 0.031, 0.033, 0.012, 0.12);
    ball(eye, "#bcb2c4", 0.045, -0.045, 0.064, 0.014, 0.016, 0.009, 0.15);
    eyes.push(eye);
    const brow = box(
      face,
      0.18,
      0.028,
      0.025,
      hair,
      side * 0.22,
      0.225,
      0.348,
      0.01,
    );
    brow.rotation.z = -side * 0.09;
    brows.push(brow);
    cheeks.push(
      ball(face, "#d58a8e", side * 0.26, -0.16, 0.338, 0.065, 0.025, 0.015),
    );
  }
  ball(face, skin, 0, -0.075, 0.371, 0.045, 0.045, 0.055);
  const mouth = pivot(face, 0, -0.23, 0.36);
  ball(mouth, "#aa5c69", -0.027, 0.006, 0, 0.044, 0.019, 0.018);
  ball(mouth, "#aa5c69", 0.027, 0.006, 0, 0.044, 0.019, 0.018);
  ball(mouth, "#cb7b84", 0, -0.015, 0, 0.06, 0.018, 0.018);
  const mouthOpen = ball(mouth, "#5b3546", 0, 0, -0.004, 0.045, 0.038, 0.016);
  mouthOpen.visible = false;
  const flames = [];
  if (p.hairstyle === "flame" && p.headwear !== "bear") {
    const flameMaterials = ["#ff6230", "#ffa12e", "#ffe89a"].map(
      (c) =>
        new T.MeshStandardMaterial({
          color: c,
          emissive: c,
          emissiveIntensity: 0.8,
          roughness: 0.65,
        }),
    );
    for (let i = 0; i < 11; i++) {
      const angle = i * 2.4,
        radius = i ? 0.25 : 0;
      const flame = new T.Mesh(
        new T.ConeGeometry(0.1 + (i % 3) * 0.02, 0.48 + (i % 4) * 0.08, 7),
        flameMaterials[i % 3],
      );
      flame.position.set(
        Math.sin(angle) * radius,
        0.44 + (i % 3) * 0.035,
        Math.cos(angle) * radius,
      );
      flame.userData.seed = i;
      flame.userData.baseY = flame.position.y;
      head.add(flame);
      flames.push(flame);
    }
  } else if (p.hairstyle !== "bald" && p.headwear !== "bear") {
    box(head, 0.85, 0.23, 0.72, hair, 0, 0.31, -0.03, 0.11);
    box(head, 0.81, 0.48, 0.17, hair, 0, 0.1, -0.32, 0.08);
    for (let i = 0; i < 5; i++) {
      const clump = box(
        head,
        0.24,
        0.17,
        0.2,
        hair,
        -0.29 + i * 0.14,
        0.26 + Math.sin(i * 0.8) * 0.07,
        0.28,
        0.07,
      );
      clump.rotation.z = 0.15 - i * 0.1;
    }
    for (const side of [-1, 1])
      box(head, 0.105, 0.25, 0.32, hair, side * 0.37, 0.07, -0.01, 0.05);
    if (p.hairstyle === "long") {
      for (const side of [-1, 1])
        box(head, 0.18, 0.7, 0.46, hair, side * 0.38, -0.04, -0.07, 0.065);
      box(head, 0.75, 0.6, 0.21, hair, 0, -0.08, -0.36, 0.07);
    }
    if (p.hairstyle === "bun") {
      ball(head, hair, 0, 0.51, -0.14, 0.22, 0.2, 0.21);
      ball(head, hair, 0.06, 0.62, -0.18, 0.13);
    }
    if (p.hairstyle === "curly")
      for (let i = 0; i < 15; i++)
        ball(
          head,
          hair,
          Math.sin(i * 2.4) * 0.34,
          0.28 + (i % 3) * 0.065,
          Math.cos(i * 2.4) * 0.28,
          0.13,
        );
  }

  const headwear = p.headwear;
  if (headwear === "cap") {
    box(head, 0.88, 0.2, 0.74, color, 0, 0.36, 0, 0.09);
    box(head, 0.75, 0.065, 0.33, color, 0, 0.27, 0.44, 0.04);
    box(head, 0.15, 0.09, 0.02, "#e2d7b5", 0, 0.38, 0.38, 0.02);
  }
  if (headwear === "ushanka") {
    box(head, 0.96, 0.29, 0.84, "#65566a", 0, 0.37, 0, 0.13);
    box(head, 0.82, 0.2, 0.16, "#c6b4b7", 0, 0.32, 0.39, 0.08);
    for (const side of [-1, 1]) {
      box(head, 0.19, 0.48, 0.48, "#65566a", side * 0.44, 0.04, -0.04, 0.07);
      box(head, 0.055, 0.37, 0.32, "#c6b4b7", side * 0.535, 0.06, 0.01, 0.025);
    }
  }
  if (headwear === "swim") {
    ball(head, color, 0, 0.23, -0.03, 0.445, 0.23, 0.385);
    box(head, 0.85, 0.07, 0.71, color, 0, 0.16, 0, 0.03);
  }
  if (headwear === "cowboy") {
    const brim = cylinder(head, "#ac7951", 0.68, 0.68, 0.045, 0, 0.34, 0.04);
    brim.scale.z = 0.8;
    const crown = cylinder(head, "#bf8f62", 0.29, 0.4, 0.38, 0, 0.55, -0.02);
    crown.scale.z = 0.83;
    cylinder(head, "#694e3d", 0.38, 0.39, 0.06, 0, 0.4, -0.02).scale.z = 0.83;
  }
  if (headwear === "headphones") {
    const band = new T.Mesh(
      new T.TorusGeometry(0.46, 0.035, 8, 36, Math.PI),
      material("#dac8f0"),
    );
    band.position.set(0, 0.04, -0.04);
    head.add(band);
    for (const side of [-1, 1]) {
      box(head, 0.13, 0.27, 0.29, "#b39ad4", side * 0.46, -0.025, -0.01, 0.055);
      box(head, 0.03, 0.18, 0.18, "#d9c7ed", side * 0.53, -0.025, -0.01, 0.025);
    }
  }
  if (p.glasses && p.headwear !== "bear") {
    for (const side of [-1, 1]) {
      const rim = new T.Mesh(
        new T.TorusGeometry(0.167, 0.018, 8, 30),
        material("#3a3044"),
      );
      rim.position.set(side * 0.215, 0.02, 0.42);
      rim.scale.y = 1.08;
      head.add(rim);
    }
    box(head, 0.1, 0.022, 0.025, "#3a3044", 0, 0.055, 0.42, 0.005);
  }
  if (headwear === "bear") {
    face.visible = false;
    const bear = pivot(head, 0, 0, 0.025);
    box(bear, 1.01, 0.88, 0.86, "#926747", 0, 0.015, 0, 0.23);
    for (const side of [-1, 1]) {
      ball(bear, "#926747", side * 0.4, 0.44, -0.02, 0.18, 0.19, 0.13);
      ball(bear, "#bc9473", side * 0.4, 0.44, 0.09, 0.105, 0.12, 0.025);
      ball(bear, "#16151b", side * 0.23, 0.08, 0.423, 0.1, 0.12, 0.05, 0.15);
      ball(bear, "#fff4e8", side * 0.23 - 0.02, 0.12, 0.47, 0.022);
    }
    ball(bear, "#cfaa83", 0, -0.17, 0.43, 0.26, 0.18, 0.14);
    ball(bear, "#30222a", 0, -0.09, 0.565, 0.12, 0.075, 0.045);
    box(bear, 0.02, 0.09, 0.015, "#704e42", 0, -0.2, 0.575, 0.006);
  }
  root.userData = { kind: "avatar", id: p.id };
  return {
    root,
    model,
    torso,
    head,
    legs,
    knees,
    feet,
    arms,
    elbows,
    hands,
    eyes,
    brows,
    mouth,
    mouthOpen,
    flames,
    profile: p,
  };
}

export function tickAccessories(rig, time) {
  for (const flame of rig.flames || []) {
    const seed = flame.userData.seed;
    flame.scale.set(
      1 + Math.sin(time * 9 + seed) * 0.08,
      0.86 + Math.sin(time * 12 + seed * 1.7) * 0.2,
      1,
    );
    flame.rotation.z = Math.sin(time * 7 + seed) * 0.19;
    flame.rotation.x = Math.cos(time * 6 + seed) * 0.13;
    flame.position.y =
      flame.userData.baseY + Math.sin(time * 11 + seed) * 0.025;
  }
}

export function disposeAvatar(rig) {
  if (!rig) return;
  const sharedGeometry = new Set([sphereGeometry, ...geometries.values()]);
  const sharedMaterial = new Set(materials.values()),
    disposed = new Set();
  rig.root.traverse((object) => {
    if (
      object.geometry &&
      !sharedGeometry.has(object.geometry) &&
      !disposed.has(object.geometry)
    ) {
      object.geometry.dispose();
      disposed.add(object.geometry);
    }
    for (const mat of object.material
      ? Array.isArray(object.material)
        ? object.material
        : [object.material]
      : []) {
      if (!sharedMaterial.has(mat) && !disposed.has(mat)) {
        mat.dispose();
        disposed.add(mat);
      }
    }
  });
}
