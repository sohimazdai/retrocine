import * as T from "three";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";
import { CHARACTERS, dressCharacter, animateCharacter } from "./characters.js";
import { buildFireHair } from "./fire.js";
import { sculptGeometry, sculptGeometries, strandGeometry, garmentGeometry, scalpGeometry } from "./sculpt.js";

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
const sphereGeometry = new T.SphereGeometry(1, 32, 20);
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
  const mesh = new T.Mesh(
    geometries.get(key),
    typeof color === "string" ? material(color) : color,
  );
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

export function surfaceMaterial(color, surface = "cloth") {
  const key = `${surface}|${color}`;
  if (!materials.has(key)) {
    const settings = {
      skin: { roughness: 0.57, sheen: 0.12, sheenRoughness: 0.8 },
      eyes: { roughness: 0.16, clearcoat: 0.65, clearcoatRoughness: 0.12 },
      hair: { roughness: 0.48, sheen: 0.25, sheenRoughness: 0.65 },
      leather: { roughness: 0.56, clearcoat: 0.08 },
      fur: { roughness: 0.94, sheen: 0.75, sheenRoughness: 0.95, sheenColor: new T.Color("#dbcba5") },
      cloth: { roughness: 0.88, sheen: 0.3, sheenRoughness: 1 },
    }[surface];
    materials.set(key, new T.MeshPhysicalMaterial({ color, ...settings }));
  }
  return materials.get(key);
}

export function soft(parent, w, h, d, color, x = 0, y = 0, z = 0, exponent = 0.7) {
  const m = new T.Mesh(sculptGeometry(exponent, Math.max(w, h, d) < 0.35), typeof color === "string" ? material(color) : color);
  m.scale.set(w / 2, h / 2, d / 2);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function strand(parent, points, color, width, depth = width) {
  const m = new T.Mesh(strandGeometry(points, width, depth), typeof color === "string" ? surfaceMaterial(color, "hair") : color);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function garment(parent, profile, color, folds = 0.025) {
  const m = new T.Mesh(garmentGeometry(profile, folds), typeof color === "string" ? surfaceMaterial(color) : color);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

// A cap that follows the scalp and separate continuous locks. The face stays
// exposed; long hair is concentrated behind the head and at the temples.
export function scalp(parent, color) {
  const mesh = new T.Mesh(scalpGeometry(), typeof color === "string" ? surfaceMaterial(color, "hair") : color);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function sculptHair(parent, color, style = "short") {
  const g = pivot(parent, 0, 0, 0), mat = surfaceMaterial(color, "hair");
  scalp(g, mat);
  soft(g, 0.8, style === "long" ? 0.8 : 0.5, 0.23, mat, 0, style === "long" ? -0.06 : 0.08, -0.3, 0.8);
  for (let i = 0; i < 7; i++) {
    const x = -0.3 + i * 0.1;
    strand(g, [[x * 0.7, 0.37, -0.17], [x, 0.43, 0.03], [x + 0.04, 0.34, 0.27], [x + 0.06, 0.22 + i * 0.014, 0.34]], mat, 0.07, 0.045);
  }
  for (const s of [-1, 1]) {
    if (style === "long") {
      for (let i = 0; i < 4; i++) {
        const z = 0.07 - i * 0.11;
        strand(g, [[s * 0.3, 0.31, z], [s * 0.43, 0.05, z], [s * 0.44, -0.25, z], [s * 0.38, -0.57, z + 0.04]], mat, 0.09, 0.07);
      }
    } else strand(g, [[s * 0.32, 0.32, -0.03], [s * 0.41, 0.12, -0.02], [s * 0.39, -0.12, 0]], mat, 0.075, 0.055);
  }
  if (style === "bun") {
    soft(g, 0.37, 0.33, 0.33, mat, 0, 0.43, -0.3, 0.9);
    for (let i = 0; i < 5; i++)
      strand(g, [[-0.14, 0.4, -0.3], [0, 0.56, -0.37 + i * 0.027], [0.15, 0.4, -0.3]], mat, 0.04, 0.035);
  }
  if (style === "curly")
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, x = Math.sin(a) * 0.32, z = Math.cos(a) * 0.27;
      strand(g, [[x - 0.08, 0.3, z], [x, 0.48, z + 0.06], [x + 0.09, 0.37, z], [x + 0.02, 0.29, z - 0.04]], mat, 0.06);
    }
  return g;
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
const BASIC_LOOKS = [
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
export const LOOKS = [
  ...CHARACTERS,
  ...BASIC_LOOKS.map((p) => ({
    ...p,
    category: "basic",
    subtitle: "Свободная настройка",
  })),
];
export function applyLook(profile, lookId) {
  const preset = LOOKS.find((p) => p.id === lookId);
  if (!preset) return { ...profile };
  const { id, name, category, subtitle, ...look } = preset;
  return normalizeProfile({
    ...profile,
    character: null,
    skin: "#e4b59b",
    hairColor: "#493339",
    shoeColor: "#f0e9f0",
    glasses: false,
    ...look,
    lookId: id,
    id: profile.id,
    name: profile.name,
  });
}
export function normalizeProfile(profile) {
  const preset = CHARACTERS.find((p) => p.id === profile.character);
  if (preset) {
    const { id, name, category, subtitle, ...defaults } = preset;
    profile = { ...defaults, ...profile };
  } else profile = { ...profile, character: null };
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
  soft(
    torso,
    p.outfit === "spacesuit" ? 0.5 : 0.44,
    coat ? 0.55 : 0.43,
    0.34,
    color,
    0,
    coat ? -0.1 : -0.03,
    0,
    0.78,
  );
  soft(neck, 0.17, 0.14, 0.19, surfaceMaterial(skin, "skin"));
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
    soft(leg, 0.17, 0.2, 0.19, surfaceMaterial(p.pantsColor), 0, -0.065, 0, 0.8);
    const knee = pivot(leg, 0, -0.145, 0);
    soft(knee, 0.155, 0.16, 0.17, surfaceMaterial(p.pantsColor), 0, -0.045, 0, 0.8);
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
    soft(arm, 0.17, 0.23, 0.19, surfaceMaterial(color), 0, -0.075, 0, 0.85);
    const elbow = pivot(arm, 0, -0.18, 0);
    soft(
      elbow,
      0.135,
      0.13,
      0.15,
      surfaceMaterial(p.outfit === "tshirt" ? skin : color, p.outfit === "tshirt" ? "skin" : "cloth"),
      0,
      -0.045,
      0,
      0.85,
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
  soft(face, 0.86, 0.74, 0.69, surfaceMaterial(skin, "skin"), 0, 0, 0, 0.7);
  const eyes = [],
    brows = [];
  for (const side of [-1, 1]) {
    ball(face, skin, side * 0.42, -0.04, 0, 0.068, 0.11, 0.085);
    const eye = pivot(face, side * 0.215, 0.02, 0.335);
    ball(eye, surfaceMaterial("#141318", "eyes"), 0, 0, 0, 0.112, 0.121, 0.052);
    ball(eye, "#e9e5df", -0.028, 0.04, 0.047, 0.012, 0.016, 0.006);
    eyes.push(eye);
    const brow = pivot(face, side * 0.22, 0.22, 0.327);
    strand(brow, [[-0.09, -0.007, 0], [0, 0.019, 0.012], [0.09, -0.005, 0]], hair, 0.018, 0.008);
    brows.push(brow);
  }
  soft(face, 0.035, 0.075, 0.035, surfaceMaterial(skin, "skin"), 0, -0.065, 0.339, 0.85);
  ball(face, surfaceMaterial(skin, "skin"), 0, -0.092, 0.354, 0.023, 0.015, 0.014);
  const mouth = pivot(face, 0, -0.23, 0.322);
  strand(mouth, [[-0.045, 0.002, 0], [0, -0.008, 0.005], [0.045, 0.002, 0]], material("#b6827d"), 0.007, 0.004);
  const mouthOpen = ball(mouth, "#5b3546", 0, 0, 0.005, 0.035, 0.032, 0.012);
  mouthOpen.visible = false;
  const flames = [];
  let fireHair = null,
    fireMaterial = null;
  const coveredHair =
    p.headwear === "signature" &&
    ["builder", "miner", "doctor", "samurai", "astronaut"].includes(p.character);
  if (p.hairstyle === "flame" && p.headwear !== "bear" && !coveredHair) {
    // Flowing fire grown thick on the head, driven by a shader (see fire.js).
    const built = buildFireHair();
    fireHair = built.mesh;
    fireMaterial = built.material;
    head.add(fireHair);
  } else if (p.hairstyle !== "bald" && p.headwear !== "bear" && !coveredHair) {
    sculptHair(head, hair, p.hairstyle);
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
  const rig = {
    root,
    model,
    torso,
    head,
    face,
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
    fireHair,
    fireMaterial,
    profile: p,
  };
  dressCharacter(rig, p, { box, ball, material, cylinder, pivot, soft, strand, garment, sculptHair, surfaceMaterial, scalp });
  return rig;
}

export function tickAccessories(rig, time) {
  animateCharacter(rig, time);
  if (rig.fireMaterial) rig.fireMaterial.uniforms.uTime.value = time;
  for (const flame of rig.flames || []) {
    const d = flame.userData,
      seed = d.seed,
      lock = d.lock;
    flame.scale.set(
      1 + Math.sin(time * 9 + seed) * 0.08,
      0.86 + Math.sin(time * 12 + seed * 1.7) * (lock ? 0.09 : 0.2),
      1,
    );
    flame.rotation.z = (d.baseRotZ || 0) + Math.sin(time * 7 + seed) * (lock ? 0.09 : 0.19);
    flame.rotation.x = (d.baseRotX || 0) + Math.cos(time * 6 + seed) * (lock ? 0.07 : 0.13);
    flame.position.y = d.baseY + Math.sin(time * 11 + seed) * 0.025;
  }
}

export function disposeAvatar(rig) {
  if (!rig) return;
  const sharedGeometry = new Set([sphereGeometry, ...geometries.values(), ...sculptGeometries.values()]);
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
