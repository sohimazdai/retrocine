// Как выглядит «Защита крепости»: каменная крепость с воротами, башнями и донжоном; скала с дверью
// в подземелье; холмы, низина с прудом, болотце, валуны, руины и пеньки. Всё низкое: ничто не
// загораживает поле.
import * as T from "three";
import { registerStatics, registerDecor, floorTexture } from "../mapscene.js";
import { mat, mesh, merge, placed, rng, rockGeometry, canvasTexture, TEXTURES } from "./kit.js";
import { moundHeight } from "../physics.js";
import { POND, BOG, GATE } from "./fortress.js";

// Кладка из тёсаных блоков: светлые известняковые камни с тёмными швами.
const stoneTexture = () =>
  canvasTexture("fort-stone", 256, (c, n, r) => {
    c.fillStyle = "#5e584f";
    c.fillRect(0, 0, n, n);
    const rows = 8,
      h = n / rows;
    for (let row = 0; row < rows; row++) {
      let x = row % 2 ? -h * 0.8 : 0;
      while (x < n) {
        const w = h * (1.3 + r() * 0.9),
          shade = ["#a59d8e", "#b3ab9b", "#9a9283", "#aaa291", "#bdb5a4"][Math.floor(r() * 5)];
        c.fillStyle = shade;
        c.fillRect(x + 2, row * h + 2, w - 4, h - 4);
        // Пятна и сколы.
        for (let k = 0; k < 5; k++) {
          c.fillStyle = `rgba(60,55,45,${0.08 + r() * 0.12})`;
          c.fillRect(x + 2 + r() * (w - 10), row * h + 2 + r() * (h - 8), 3 + r() * 8, 2 + r() * 4);
        }
        x += w;
      }
    }
    // Мох внизу.
    for (let i = 0; i < 160; i++) {
      c.fillStyle = `rgba(${70 + r() * 30},${100 + r() * 30},${50 + r() * 20},${0.25 + r() * 0.3})`;
      c.fillRect(r() * n, n * 0.75 + r() * n * 0.25, 2 + r() * 5, 2 + r() * 4);
    }
  });
const stone = ({ color, ...opts } = {}) => {
  const tex = stoneTexture();
  return mat(color || (tex ? "#e9e3d6" : "#a59d8e"), { map: tex, roughness: 0.92, ...opts });
};
// Каменный блок с текстурой в метрах (одна кладка на 2 м).
function stoneBox(w, h, d) {
  const g = new T.BoxGeometry(w, h, d),
    uv = g.attributes.uv,
    faces = [
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
      uv.setXY(k, (uv.getX(k) * faces[f][0]) / 2, (uv.getY(k) * faces[f][1]) / 2);
    }
  return g;
}
// Зубцы по верху стены: вдоль оси длинной стороны, через промежуток.
function merlons(parts, x, z, len, alongZ, y, size = 0.5, gap = 0.45, thick = 0.4) {
  const n = Math.floor((len + gap) / (size + gap)),
    start = -((n * (size + gap) - gap) / 2) + size / 2;
  for (let i = 0; i < n; i++) {
    const t = start + i * (size + gap);
    parts.push(placed(stoneBox(alongZ ? thick : size, 0.55, alongZ ? size : thick), x + (alongZ ? 0 : t), y + 0.275, z + (alongZ ? t : 0)));
  }
}

// ——— Крепость ———
function fortWall(group, s) {
  const alongZ = s.d > s.w;
  mesh(group, stoneBox(s.w, s.h, s.d), stone(), s.x, s.h / 2, s.z);
  // Карниз по верху и зубцы по наружному краю (у передней — свои, это fort-parapet).
  const parts = [placed(stoneBox(s.w + 0.16, 0.14, s.d + 0.16), s.x, s.h - 0.07, s.z)];
  if (!s.front) merlons(parts, s.x, s.z + (alongZ ? 0 : Math.sign(s.z) * (s.d / 2 - 0.2)), alongZ ? s.d : s.w - 1, alongZ, s.h);
  mesh(group, merge(parts), stone(), 0, 0, 0);
  if (s.front) gate(group, s);
}
function parapet(group, s) {
  const parts = [];
  merlons(parts, s.x, s.z, s.d, true, s.y, 0.6, 0.45, 0.24);
  mesh(group, merge(parts), stone());
}
// Дубовые ворота с железными полосами и аркой из камня на наружной грани передней стены.
function gate(group, s) {
  const face = s.x + s.w / 2 + 0.02,
    h = 2.05,
    tex = TEXTURES.wood();
  const wood = mat(tex ? "#a77a52" : "#6b4a2c", { map: tex, roughness: 0.8 }),
    iron = mat("#3a3a3e", { roughness: 0.45, metal: 0.6 });
  const door = mesh(group, new T.BoxGeometry(0.1, h, GATE.w), wood, face, h / 2, GATE.z);
  door.receiveShadow = true;
  const bands = [];
  for (const y of [0.35, 1.05, 1.75]) bands.push(placed(new T.BoxGeometry(0.04, 0.12, GATE.w + 0.02), face + 0.06, y, GATE.z));
  bands.push(placed(new T.BoxGeometry(0.05, h, 0.06), face + 0.06, h / 2, GATE.z));
  for (const y of [0.35, 1.05, 1.75]) for (let i = -2; i <= 2; i++) if (i) bands.push(placed(new T.SphereGeometry(0.035, 6, 4), face + 0.09, y, GATE.z + i * 0.5));
  mesh(group, merge(bands), iron);
  // Арка: камни полукругом над воротами.
  const arch = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI,
      r = GATE.w / 2 + 0.15;
    arch.push(placed(stoneBox(0.18, 0.3, 0.42), face + 0.04, h + Math.sin(a) * 0.35, GATE.z + Math.cos(a) * r, 0, -(a - Math.PI / 2)));
  }
  mesh(group, merge(arch), stone({ roughness: 0.85 }));
  // Факелы по сторонам ворот.
  for (const side of [-1, 1]) torch(group, face + 0.12, 1.85, GATE.z + side * (GATE.w / 2 + 0.55));
}
function torch(group, x, y, z) {
  mesh(group, new T.CylinderGeometry(0.035, 0.025, 0.42, 6), mat("#4a3020", { roughness: 0.9 }), x, y, z);
  const flame = mesh(group, new T.ConeGeometry(0.08, 0.24, 7), mat("#ffb347", { emissive: "#ff7a1a", glow: 2.2, roughness: 0.5 }), x, y + 0.3, z, false);
  flame.userData.flicker = true;
  return flame;
}
function tower(group, s) {
  const r = s.radius,
    tex = stoneTexture(),
    g = new T.CylinderGeometry(r, r * 1.06, s.h, 20, 1, true),
    uv = g.attributes.uv;
  // Кладка обёрнута вокруг башни в тех же размерах, что и на стенах.
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.PI * 2 * r) / 2, (uv.getY(i) * s.h) / 2);
  mesh(group, g, mat(tex ? "#e9e3d6" : "#a59d8e", { map: tex, roughness: 0.92, side: T.DoubleSide }), s.x, s.h / 2, s.z);
  // Площадка наверху, карниз и кольцо зубцов.
  mesh(group, new T.CylinderGeometry(r + 0.18, r + 0.05, 0.22, 20), stone(), s.x, s.h - 0.11, s.z);
  const parts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parts.push(placed(stoneBox(0.42, 0.55, 0.32), s.x + Math.cos(a) * (r + 0.02), s.h + 0.27, s.z + Math.sin(a) * (r + 0.02), -a + Math.PI / 2));
  }
  mesh(group, merge(parts), stone());
  // Бойницы.
  const dark = mat("#1d1a18", { roughness: 1 });
  for (const a of [0, Math.PI / 2, -Math.PI / 2]) {
    const slit = mesh(group, new T.BoxGeometry(0.06, 0.55, 0.14), dark, s.x + Math.cos(a) * (r + 0.01), s.h * 0.6, s.z + Math.sin(a) * (r + 0.01), false);
    slit.rotation.y = -a;
  }
}
function keep(group, s) {
  mesh(group, stoneBox(s.w, s.h, s.d), stone(), s.x, s.h / 2, s.z);
  const parts = [placed(stoneBox(s.w + 0.2, 0.18, s.d + 0.2), s.x, s.h - 0.09, s.z)];
  merlons(parts, s.x + s.w / 2 - 0.2, s.z, s.d, true, s.h);
  merlons(parts, s.x - s.w / 2 + 0.2, s.z, s.d, true, s.h);
  merlons(parts, s.x, s.z + s.d / 2 - 0.2, s.w - 0.9, false, s.h);
  merlons(parts, s.x, s.z - s.d / 2 + 0.2, s.w - 0.9, false, s.h);
  mesh(group, merge(parts), stone());
  // Окна и дверь со стороны поля.
  const dark = mat("#221d18", { roughness: 1 }),
    face = s.x + s.w / 2 + 0.01;
  for (const z of [-1.1, 1.1]) mesh(group, new T.BoxGeometry(0.04, 0.6, 0.32), dark, face, 3.1, s.z + z, false);
  const tex = TEXTURES.wood();
  mesh(group, new T.BoxGeometry(0.06, 1.7, 1.0), mat(tex ? "#9c7048" : "#6b4a2c", { map: tex, roughness: 0.8 }), face, 0.85, s.z, false);
  // Флагшток без полотнища: высокого ничего не ставим.
}
// Пандус со двора на стену: каменные ступени.
function ramp(group, s) {
  const steps = 10,
    parts = [];
  for (let i = 0; i < steps; i++) {
    const h = ((i + 1) / steps) * s.h,
      d = s.d / steps;
    parts.push(placed(stoneBox(s.w, h, d), s.x, h / 2, s.z - s.d / 2 + d * (i + 0.5)));
  }
  mesh(group, merge(parts), stone());
}

// ——— Подземелье ———
function dungeon(group, s) {
  const r = rng(91),
    rocks = [];
  // Скала из нагромождённых глыб вокруг коллайдера.
  for (let i = 0; i < 16; i++) {
    const sx = 1.3 + r() * 1.4,
      sy = 1.2 + r() * 1.6,
      z = s.z - s.d / 2 + r() * s.d;
    // Глыбы не вылезают за грань скалы, а у двери отступают ещё дальше: проём открыт.
    let x = s.x - s.w / 2 + sx * 0.75 + r() * (s.w + 0.8);
    if (Math.abs(z - s.z) < 1.5 + sx * 0.6) x = Math.max(x, s.x - s.w / 2 + sx * 1.15);
    rocks.push(placed(rockGeometry(i + 500), x, sy * 0.7, z, r() * 6, 0, 0, [sx, sy, sx * (0.8 + r() * 0.4)]));
  }
  for (let i = 0; i < 6; i++) rocks.push(placed(rockGeometry(i + 540), s.x + r() * 1.2, s.h - 0.4 + r() * 0.7, s.z - s.d / 2 + 1 + r() * (s.d - 2), r() * 6, 0, 0, [1.4, 1, 1.3]));
  mesh(group, merge(rocks), mat("#6d675e", { flat: true, roughness: 0.95 }));
  // Тёмный проём и окованная дверь в нём.
  const face = s.x - s.w / 2 - 0.02;
  mesh(group, new T.BoxGeometry(0.2, 2.7, 2.7), mat("#0b0908", { roughness: 1 }), face + 0.05, 1.35, s.z, false);
  const tex = TEXTURES.wood(),
    door = new T.Group();
  door.position.set(face - 0.06, 0, s.z - 1.15);
  group.add(door);
  mesh(door, new T.BoxGeometry(0.12, 2.5, 2.3), mat(tex ? "#5d4430" : "#3d2a1c", { map: tex, roughness: 0.85 }), 0, 1.25, 1.15);
  const iron = mat("#2c2c30", { roughness: 0.4, metal: 0.7 }),
    straps = [];
  for (const y of [0.4, 1.25, 2.1]) straps.push(placed(new T.BoxGeometry(0.03, 0.14, 2.3), -0.07, y, 1.15));
  straps.push(placed(new T.TorusGeometry(0.12, 0.025, 6, 14), -0.1, 1.2, 1.9, Math.PI / 2));
  mesh(door, merge(straps), iron);
  // Зелёный свет из щелей: подземелье живое.
  const glow = mesh(group, new T.PlaneGeometry(2.4, 0.08), mat("#9dff7a", { emissive: "#5dff3a", glow: 2.4 }), face - 0.14, 0.04, s.z, false);
  glow.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  const light = new T.PointLight("#7dff5a", 4, 7, 2);
  light.position.set(face - 0.8, 1.2, s.z);
  group.add(light);
  // Черепа и кости у входа.
  const bone = mat("#e6dccb", { roughness: 0.6 }),
    bones = [];
  for (let i = 0; i < 6; i++) bones.push(placed(new T.CapsuleGeometry(0.03, 0.26, 3, 6), face - 0.8 - r() * 1.6, 0.03, s.z - 1.8 + r() * 3.6, r() * 6, 0, Math.PI / 2));
  for (let i = 0; i < 2; i++) bones.push(placed(new T.SphereGeometry(0.11, 10, 8), face - 1.2 - r() * 1.2, 0.09, s.z + (i ? 1.9 : -2.1), 0, 0, 0, [1, 0.9, 1.1]));
  mesh(group, merge(bones), bone);
  for (const side of [-1, 1]) torch(group, face - 0.12, 2.2, s.z + side * 1.75);
  group.userData.dungeonDoor = door;
  group.userData.dungeonLight = light;
}
function pillar(group, s) {
  mesh(group, stoneBox(s.w, s.h, s.d), stone({ color: "#c9c2b4" }), s.x, s.h / 2, s.z);
}

// ——— Местность ———
// Холм — сетка колец, поднятая по той же формуле, что и физика (moundHeight): ходят ровно по нему.
function mound(group, s) {
  const rings = 16,
    segs = 56,
    pos = [],
    uv = [],
    color = [],
    idx = [];
  // У подножия — ровно цвет поля (тот же оттенок, что у пола), чтобы холм вырастал из него без шва.
  const grass = new T.Color("#cfe0b0"),
    top = new T.Color("#dcebbd");
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2,
        lx = Math.cos(a) * t * (s.w / 2),
        lz = Math.sin(a) * t * (s.d / 2),
        y = moundHeight(s, s.x + lx, s.z + lz);
      pos.push(lx, y + 0.012, lz);
      // Те же координаты, что у пола (у текстуры повтор раз в 4 м): трава на холме как вокруг.
      uv.push(s.x + lx, -(s.z + lz));
      // Светлее к верху.
      const c = grass.clone().lerp(top, y / s.h);
      color.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j,
        b = a + segs + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new T.Float32BufferAttribute(color, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const tex = floorTexture("grass"),
    m = mat("#ffffff", { map: tex, roughness: 0.95, vertexColors: true });
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  const hill = mesh(group, g, m, s.x, 0, s.z, false);
  hill.receiveShadow = true;
}
function boulder(group, s) {
  const seed = Math.round(Math.abs(s.x * 13 + s.z * 7));
  const m = mesh(group, rockGeometry(seed), mat("#8b867b", { flat: true, roughness: 0.95 }), s.x, s.h * 0.45, s.z);
  m.scale.set(s.radius * 1.05, s.h * 0.62, s.radius * (0.9 + (seed % 5) * 0.04));
  m.rotation.y = seed;
  // Мох на макушке.
  const moss = mesh(group, new T.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 3), mat("#6f8f4a", { roughness: 1 }), s.x, s.h * 0.62, s.z, false);
  moss.scale.set(s.radius * 0.7, s.h * 0.35, s.radius * 0.6);
}
function stump(group, s) {
  const tex = TEXTURES.wood(),
    bark = mat(tex ? "#8a6a4c" : "#5b4030", { map: tex, roughness: 0.95 });
  mesh(group, new T.CylinderGeometry(s.radius * 0.92, s.radius * 1.08, s.h, 12), bark, s.x, s.h / 2, s.z);
  // Срез с кольцами.
  const rings = canvasTexture("stump-rings", 128, (c, n) => {
    c.fillStyle = "#d8b98c";
    c.fillRect(0, 0, n, n);
    for (let r = n / 2; r > 2; r -= 6) {
      c.strokeStyle = r % 12 ? "#b8935f" : "#c7a675";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(n / 2, n / 2, r - 2, 0, Math.PI * 2);
      c.stroke();
    }
  });
  const cut = mesh(group, new T.CircleGeometry(s.radius * 0.9, 16), mat(rings ? "#ffffff" : "#c9a676", { map: rings, roughness: 0.9 }), s.x, s.h + 0.005, s.z, false);
  cut.rotation.x = -Math.PI / 2;
  const roots = [];
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + s.x;
    roots.push(placed(new T.ConeGeometry(0.1, s.radius * 1.4, 5), s.x + Math.cos(a) * s.radius, 0.06, s.z + Math.sin(a) * s.radius, -a, 0, Math.PI / 2 - 0.25));
  }
  mesh(group, merge(roots), bark);
}
// Обломок стены: неровный верх из уступов, у подножия — выпавшие камни.
function ruinWall(group, s) {
  const along = s.w >= s.d,
    len = along ? s.w : s.d,
    r = rng(Math.round(Math.abs(s.x * 31 + s.z * 17)) + 3),
    parts = [],
    n = Math.max(2, Math.round(len / 0.7));
  for (let i = 0; i < n; i++) {
    const t = -len / 2 + (len / n) * (i + 0.5),
      h = s.h * (0.55 + r() * 0.45);
    parts.push(placed(stoneBox(along ? len / n : s.w, h, along ? s.d : len / n), s.x + (along ? t : 0), h / 2, s.z + (along ? 0 : t)));
  }
  for (let i = 0; i < 4; i++) {
    const k = 0.18 + r() * 0.16;
    parts.push(placed(stoneBox(k * 1.6, k, k), s.x + (along ? (r() - 0.5) * len : (r() < 0.5 ? -1 : 1) * (s.w / 2 + 0.3)), k / 2, s.z + (along ? (r() < 0.5 ? -1 : 1) * (s.d / 2 + 0.3) : (r() - 0.5) * len), r() * 3));
  }
  mesh(group, merge(parts), stone({ color: "#d9d2c2" }));
}
function column(group, s) {
  const marble = mat("#e4ddcf", { roughness: 0.7 }),
    parts = [placed(new T.BoxGeometry(s.radius * 2.4, 0.18, s.radius * 2.4), s.x, 0.09, s.z)];
  // Каннелюры — шестнадцатигранник; верх сломан наискось.
  const shaft = new T.CylinderGeometry(s.radius * 0.85, s.radius * 0.95, s.h - 0.18, 16);
  parts.push(placed(shaft, s.x, 0.18 + (s.h - 0.18) / 2, s.z));
  parts.push(placed(new T.CylinderGeometry(s.radius * 0.85, s.radius * 0.85, 0.16, 16), s.x, s.h + 0.02, s.z, 0, 0.35, 0.2));
  mesh(group, merge(parts), marble);
}
function fallen(group, s) {
  const along = s.w >= s.d,
    len = (along ? s.w : s.d) / 2 - 0.08,
    r = 0.3,
    marble = mat("#ddd6c7", { roughness: 0.7 }),
    parts = [];
  for (const k of [-1, 1]) parts.push(placed(new T.CylinderGeometry(r, r, len, 16), s.x + (along ? (k * (len + 0.16)) / 2 : 0), r, s.z + (along ? 0 : (k * (len + 0.16)) / 2), k * 0.08, along ? 0 : Math.PI / 2, along ? Math.PI / 2 : 0));
  mesh(group, merge(parts), marble);
}

registerStatics({
  "fort-wall": fortWall,
  "fort-parapet": parapet,
  "fort-tower": tower,
  "fort-keep": keep,
  "fort-ramp": ramp,
  dungeon,
  "dungeon-pillar": pillar,
  mound,
  boulder,
  stump,
  "ruin-wall": ruinWall,
  "ruin-column": column,
  "ruin-fallen": fallen,
});

// ——— Пруд, болото, тропа, трава ———
const noHits = (m) => {
  m.raycast = () => {};
  return m;
};
function pool(group, zone, { water, rim, reeds, pads }, r) {
  const shore = mesh(group, new T.CircleGeometry(1, 40), mat(rim, { roughness: 1 }), zone.x, 0.008, zone.z, false);
  shore.rotation.x = -Math.PI / 2;
  shore.scale.set(zone.rx + 0.5, zone.rz + 0.45, 1);
  const tex = TEXTURES.water();
  const surface = mesh(group, new T.CircleGeometry(1, 40), mat(water, { map: tex, roughness: 0.15, metal: 0.1, opacity: 0.9, emissive: "#0d1a10", glow: 0.4 }), zone.x, 0.02, zone.z, false);
  surface.rotation.x = -Math.PI / 2;
  surface.scale.set(zone.rx, zone.rz, 1);
  surface.raycast = () => {};
  // Камыш по краям: тонкие стебли и коричневые початки.
  const stems = [],
    heads = [];
  for (let i = 0; i < reeds; i++) {
    const a = r() * Math.PI * 2,
      k = 0.85 + r() * 0.25,
      x = zone.x + Math.cos(a) * zone.rx * k,
      z = zone.z + Math.sin(a) * zone.rz * k,
      h = 0.5 + r() * 0.5;
    stems.push(placed(new T.CylinderGeometry(0.012, 0.018, h, 4), x, h / 2, z, 0, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3));
    if (r() < 0.5) heads.push(placed(new T.CapsuleGeometry(0.03, 0.12, 2, 6), x, h + 0.05, z));
  }
  // Камыш, кувшинки, трава и цветы — мелочь: снаряды сквозь них (и проверять их на попадание не надо).
  noHits(mesh(group, merge(stems), mat("#7d9a4a", { roughness: 0.9 }), 0, 0, 0, false));
  if (heads.length) noHits(mesh(group, merge(heads), mat("#6b4a2a", { roughness: 0.9 }), 0, 0, 0, false));
  // Кувшинки.
  if (pads) {
    const leaves = [];
    for (let i = 0; i < pads; i++) {
      const a = r() * Math.PI * 2,
        k = r() * 0.75;
      leaves.push(placed(new T.CircleGeometry(0.22 + r() * 0.15, 10, 0.3, Math.PI * 2 - 0.5), zone.x + Math.cos(a) * zone.rx * k, 0.03, zone.z + Math.sin(a) * zone.rz * k, 0, -Math.PI / 2, r() * 6));
    }
    noHits(mesh(group, merge(leaves), mat("#4f8a3a", { roughness: 0.8, side: T.DoubleSide }), 0, 0, 0, false));
  }
  return surface;
}
registerDecor("fortress", (group, map) => {
  const r = rng(2024);
  const pond = pool(group, POND, { water: "#5f8a74", rim: "#7c7656", reeds: 70, pads: 14 }, r),
    bog = pool(group, BOG, { water: "#6a6f48", rim: "#6f6748", reeds: 40, pads: 0 }, r);
  // Тропа от подземелья к воротам: протоптанная земля (только рисунок).
  const path = [
      [24.4, 1.0],
      [17, 0.4],
      [8, -0.6],
      [0, 1.0],
      [-8, 1.6],
      [-15, 1.2],
      [-21.8, 1.0],
    ],
    dirt = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, z0] = path[i],
      [x1, z1] = path[i + 1],
      l = Math.hypot(x1 - x0, z1 - z0);
    dirt.push(placed(new T.PlaneGeometry(l + 1.2, 1.6), (x0 + x1) / 2, 0.006, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0), -Math.PI / 2));
  }
  const road = mesh(group, merge(dirt), mat("#a39270", { roughness: 1, opacity: 0.55, depthWrite: false }), 0, 0, 0, false);
  road.raycast = () => {};
  // Трава пучками и цветы — низкие, чтобы ничего не загораживать.
  const tufts = [],
    flowers = [];
  for (let i = 0; i < 260; i++) {
    const x = (r() - 0.5) * 54,
      z = -14 + r() * 33;
    if (x < -22 || (x > 24 && Math.abs(z - 1) < 6)) continue;
    tufts.push(placed(new T.ConeGeometry(0.07, 0.22 + r() * 0.15, 4), x, 0.12, z, r() * 3, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4));
    if (r() < 0.25) flowers.push(placed(new T.SphereGeometry(0.045, 6, 4), x + 0.1, 0.25, z + 0.05));
  }
  noHits(mesh(group, merge(tufts), mat("#6f9a48", { roughness: 1 }), 0, 0, 0, false));
  noHits(mesh(group, merge(flowers), mat("#f2e7a8", { roughness: 0.7, emissive: "#3a3410", glow: 0.4 }), 0, 0, 0, false));
  // Факелы и дверь подземелья строятся после этой функции (это статика карты): найдём при первом кадре.
  let flames = null,
    door = null,
    light = null,
    open = 0;
  const find = () => {
    flames = [];
    group.traverse((o) => {
      if (o.userData.flicker) flames.push(o);
      if (o.userData.dungeonDoor) door = o.userData.dungeonDoor;
      if (o.userData.dungeonLight) light = o.userData.dungeonLight;
    });
  };
  return {
    // Монстр вышел: дверь подземелья приоткрывается.
    spawned() {
      open = 1;
    },
    update(dt, t) {
      if (!flames) find();
      for (const f of flames) f.scale.set(1, 0.85 + Math.sin(t * 17 + f.position.z * 3) * 0.15 + Math.sin(t * 29) * 0.06, 1);
      if (pond.material.map) pond.material.map.offset.set(Math.sin(t * 0.2) * 0.05, t * 0.01);
      open = Math.max(0, open - dt * 0.7);
      if (door) door.rotation.y = -Math.min(1, open * 1.6) * 1.2;
      if (light) light.intensity = 3 + Math.sin(t * 2.3) * 0.8 + open * 8;
    },
  };
});
