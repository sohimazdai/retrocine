// Защита крепости: поле вдвое больше обычной комнаты (map.scale = 2 — люди и монстры на нём
// вдвое мельче). Слева — небольшая крепость со стенами, башнями и донжоном, справа — скала с дверью
// в подземелье, откуда выходят монстры (логика игры — dist/defense.js). Между ними — местность без
// высоких загораживающих вещей: камни, старинные руины, пеньки, холм у дальнего края, низина с
// заросшим прудом у ближнего и болотце прямо на пути монстров. Пруд и болото замедляют идущих.

const S = 2,
  EDGE = 14.7 * S,
  FRONT = 10.3 * S;

// ——— Крепость: передняя стена смотрит на поле (её грань — x = WALL.x1), в ней ворота: сами
// открываются, когда к ним подходит аватар, изнутри или снаружи, и закрываются, когда рядом никого
// (state.js, «gate.open»). Монстров ворота не пускают в любом случае: для них крепость — сплошная
// стена (map.defense.fort). На стену ведут пандус со двора и лестница с поля; на башнях и стене
// встают самострелы (награды). ———
export const WALL = { x0: -23.6, x1: -22.4, z0: -7.0, z1: 9.0, h: 2.6 };
export const TOWERS = [
  { x: -23.0, z: -7.0 },
  { x: -23.0, z: 9.0 },
];
const TOWER_R = 1.4,
  TOWER_H = 4.2;
export const KEEP = { x: -27.2, z: 1.0, w: 3.6, d: 4.4, h: 4.4 };
// Ворота: проём в передней стене, над ним — свод, по которому идёт стена.
export const GATE = { id: "main", z: 1.0, w: 2.4, h: 2.3 };
const wallX = (WALL.x0 + WALL.x1) / 2,
  wallW = WALL.x1 - WALL.x0,
  gate0 = GATE.z - GATE.w / 2,
  gate1 = GATE.z + GATE.w / 2;
const fortress = [
  // Передняя стена — две части по сторонам ворот.
  { kind: "fort-wall", front: true, x: wallX, z: (WALL.z0 + gate0) / 2, w: wallW, d: gate0 - WALL.z0, h: WALL.h },
  { kind: "fort-wall", front: true, x: wallX, z: (gate1 + WALL.z1) / 2, w: wallW, d: WALL.z1 - gate1, h: WALL.h },
  // Свод над воротами: под ним проходят, по нему идут по стене.
  { kind: "fort-gatehouse", x: wallX, z: GATE.z, w: wallW, d: GATE.w, y: GATE.h, h: WALL.h },
  // Створки: закрытые — стена для аватара, открытые — проход.
  { kind: "fort-gate", gate: GATE.id, x: WALL.x1 - 0.25, z: GATE.z, w: 0.3, d: GATE.w, h: GATE.h },
  // Зубцы по внешнему краю: за ними стоят, через них можно перепрыгнуть.
  { kind: "fort-parapet", x: WALL.x1 - 0.08, z: (WALL.z0 + WALL.z1) / 2, w: 0.16, d: WALL.z1 - WALL.z0 - 2.4, y: WALL.h, h: WALL.h + 0.7 },
  // Боковые стены до края поля.
  ...[WALL.z0, WALL.z1].map((z) => ({ kind: "fort-wall", x: (-EDGE + WALL.x1) / 2 - 0.3, z, w: WALL.x1 - 0.6 + EDGE, d: 1.0, h: WALL.h })),
  ...TOWERS.map((t) => ({ kind: "fort-tower", x: t.x, z: t.z, shape: "cylinder", radius: TOWER_R, w: TOWER_R * 2, d: TOWER_R * 2, h: TOWER_H })),
  { kind: "fort-keep", ...KEEP },
  // Пандус со двора на стену.
  { kind: "fort-ramp", shape: "ramp", x: WALL.x0 - 0.7, z: 5.6, w: 1.4, d: 5.2, h0: 0, h1: WALL.h, h: WALL.h, axis: "z" },
];
// Лестница снаружи: с поля на стену.
export const FORT_LADDER = { id: "fort-ladder", kind: "wall", x: wallX, z: -3.6, w: wallW, d: 1.0, y0: 0, y1: WALL.h, face: "+x" };

// ——— Подземелье: скала у правого края с аркой и дверью. ———
export const DUNGEON = { x: 27.8, z: 1.0, w: 3.4, d: 9.0, h: 3.8 };
const dungeon = [
  { kind: "dungeon", ...DUNGEON },
  // Каменные плечи арки по бокам двери.
  ...[-1, 1].map((s) => ({ kind: "dungeon-pillar", x: DUNGEON.x - DUNGEON.w / 2 - 0.35, z: DUNGEON.z + s * 1.75, w: 0.7, d: 0.8, h: 3.0 })),
];

// ——— Местность ———
const mound = (x, z, w, d, h, top = 0.2, look = "hill") => ({ kind: "mound", look, shape: "mound", x, z, w, d, h, top });
// Камни: валуны разного размера (низкие — перешагнуть нельзя, но они не выше пояса).
const boulder = (x, z, r, h) => ({ kind: "boulder", x, z, shape: "cylinder", radius: r, w: r * 2, d: r * 2, h });
const stump = (x, z, r, h) => ({ kind: "stump", x, z, shape: "cylinder", radius: r, w: r * 2, d: r * 2, h });
// Развалины: обломки стен, основания колонн, упавшие колонны.
const ruinWall = (x, z, w, d, h) => ({ kind: "ruin-wall", x, z, w, d, h });
const column = (x, z, h, r = 0.36) => ({ kind: "ruin-column", x, z, shape: "cylinder", radius: r, w: r * 2, d: r * 2, h });
const fallen = (x, z, w, d) => ({ kind: "ruin-fallen", x, z, w, d, h: 0.55 });

export const POND = { x: -2.5, z: 11.2, rx: 6.4, rz: 4.0 };
export const BOG = { x: 12.6, z: 1.4, rx: 3.2, rz: 3.0 };
const terrain = [
  // Холм у дальнего края и пригорок рядом с ним.
  mound(3.5, -12.5, 17, 10, 1.9, 0.25),
  mound(13.5, -10.5, 8, 6, 1.1, 0.15),
  mound(-15.5, -12.0, 9, 6, 0.8),
  // Низина: пруд между невысокими берегами.
  mound(-11.6, 11.8, 6.5, 10, 0.8, 0.1, "bank"),
  mound(6.6, 12.2, 6, 9.5, 0.7, 0.1, "bank"),
  mound(-2.5, 17.8, 15, 4.6, 0.6, 0.1, "bank"),
];
const rocks = [
  boulder(-14.5, -3.8, 0.9, 1.1),
  boulder(-13.4, -2.6, 0.5, 0.6),
  boulder(18.4, -5.8, 1.1, 1.3),
  boulder(9.6, 7.8, 0.7, 0.8),
  boulder(20.6, 9.6, 1.0, 1.2),
  boulder(-17.4, 14.4, 0.8, 0.9),
  boulder(15.4, 15.6, 0.9, 1.0),
  boulder(-5.6, -16.0, 1.0, 1.1),
  boulder(23.6, -9.4, 0.7, 0.8),
  boulder(-19.4, 4.8, 0.6, 0.7),
  boulder(3.2, -3.2, 0.55, 0.6),
];
const ruins = [
  // Развалины часовни слева от середины: угол стены, колонны, упавшая колонна.
  ruinWall(-9.8, -6.6, 4.4, 0.6, 1.8),
  ruinWall(-12.1, -4.6, 0.6, 3.4, 1.3),
  ruinWall(-8.3, -6.6, 1.4, 0.6, 1.1),
  column(-6.6, -3.2, 1.5),
  column(-6.6, -0.6, 0.7),
  column(-9.4, -1.2, 0.45),
  fallen(-8.6, -9.4, 3.4, 0.7),
  // Остатки арки и стены справа, у холма.
  column(16.4, -14.2, 1.9, 0.42),
  column(19.0, -14.2, 1.6, 0.42),
  ruinWall(21.6, -12.8, 0.6, 3.0, 1.2),
  fallen(17.6, -11.4, 0.8, 3.0),
  // Пара обломков прямо на дороге к крепости.
  column(4.4, 4.0, 0.9),
  ruinWall(-1.6, -1.8, 2.6, 0.6, 1.0),
  column(-16.2, 7.4, 1.2),
];
const stumps = [stump(-16.6, 0.6, 0.48, 0.55), stump(9.8, -3.8, 0.42, 0.5), stump(-2.6, -12.8, 0.5, 0.5), stump(21.2, 3.6, 0.45, 0.55), stump(-19.6, -9.6, 0.4, 0.45), stump(5.6, 17.0, 0.44, 0.5), stump(-20.6, 17.4, 0.5, 0.5)];

export default {
  id: "fortress",
  scale: S,
  // За краями поля — холмы и далёкие горы, без деревьев.
  backdrop: "highlands",
  title: "Защита крепости",
  description: "Мини-игра: монстры идут волнами из подземелья, крепость надо отстоять",
  color: "#7d8f4a",
  // Логика мини-игры: стены крепости, куда идут монстры (грань передней стены — x1); дверь, откуда
  // выходят; где встают самострелы.
  defense: {
    fort: { x0: -EDGE, x1: WALL.x1, z0: TOWERS[0].z - TOWER_R, z1: TOWERS[1].z + TOWER_R },
    door: { x: DUNGEON.x - DUNGEON.w / 2 - 1.0, z: DUNGEON.z, w: 1.0, d: 2.6 },
    turrets: [
      { x: TOWERS[0].x, z: TOWERS[0].z, y: TOWER_H },
      { x: TOWERS[1].x, z: TOWERS[1].z, y: TOWER_H },
      { x: WALL.x1 - 0.4, z: -2.6, y: WALL.h },
      { x: WALL.x1 - 0.4, z: 5.0, y: WALL.h },
    ],
  },
  theme: {
    texture: "grass",
    tint: "#cfe0b0",
    side: "#3d4a2a",
    grid: "#ffffff",
    gridOpacity: 0.02,
    background: "#1d2418",
    hemi: ["#f2f8e0", "#3a4630", 2.1],
    key: ["#fff0d6", 3.6],
    rim: ["#c8dca0", 1.1],
    frame: "#5a6640",
  },
  // Во дворе крепости: сюда приходят новички и возвращаются выбывшие.
  spawn: [
    { x0: -28.4, x1: -25.6, z0: -5.6, z1: -2.2 },
    { x0: -28.4, x1: -25.6, z0: 4.4, z1: 7.8 },
  ],
  // Ворота, которые открываются сами, когда к ним подходят (на reach метров).
  gates: [{ id: GATE.id, x: WALL.x1 - 0.25, z: GATE.z, reach: 2.8 }],
  zones: [
    { id: "pond", kind: "water", ...POND, slow: 0.5, grip: 3, swamp: true },
    { id: "bog", kind: "water", ...BOG, slow: 0.6, grip: 2.5, swamp: true },
  ],
  statics: [...fortress, ...dungeon, ...terrain, ...rocks, ...ruins, ...stumps],
  climbs: [FORT_LADDER],
  props: [],
  balls: [],
  cubes: [],
  edge: EDGE,
  front: FRONT,
};
