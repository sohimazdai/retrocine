// Пейнтбол: надувные укрытия, кабельные катушки, стога пшеницы и перевёрнутые столы. Лёгкое
// надувное двигает один человек, стог — двое; на надувное можно запрыгнуть, оно пружинит.
const spool = (h) => [{ x: 0, z: 0, shape: "cylinder", radius: 1.25, w: 2.5, d: 2.5, h }];
const SOFT = 0.45;
const snake = (id, x, z, color) => ({
  id,
  kind: "snake",
  label: "Надувная «змейка»",
  x,
  z,
  color,
  weight: 2,
  lift: 3,
  colliders: [{ x: 0, z: 0, w: 5.0, d: 0.9, h: 0.9, soft: SOFT }],
  waypoints: [{ x: 0, z: 0, h: 0.9 }],
});
const dorito = (id, x, z, color) => ({ id, kind: "dorito", label: "Надувной «дорито»", x, z, color, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, shape: "cylinder", radius: 0.72, w: 1.44, d: 1.44, h: 1.3, soft: SOFT }] });
const cake = (id, x, z, color) => ({ id, kind: "cake", label: "Надувной «торт»", x, z, color, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, shape: "cylinder", radius: 1.0, w: 2, d: 2, h: 1.0, soft: SOFT }], waypoints: [{ x: 0, z: 0, h: 1.0 }] });
const can = (id, x, z, color) => ({ id, kind: "can", label: "Надувной «цилиндр»", x, z, color, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, shape: "cylinder", radius: 0.58, w: 1.16, d: 1.16, h: 1.75, soft: SOFT }] });
const brick = (id, x, z, color, rot = 0) => ({ id, kind: "brick", label: "Надувной «кирпич»", x, z, rot, color, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 1.8, d: 0.9, h: 1.05, soft: SOFT }], waypoints: [{ x: 0, z: 0, h: 1.05 }] });
const hay = (id, x, z) => ({ id, kind: "haystack", label: "Стог пшеницы", x, z, weight: 2, lift: 3, colliders: [{ x: 0, z: 0, shape: "cylinder", radius: 1.15, w: 2.3, d: 2.3, h: 1.7, soft: 0.2 }] });
// A table knocked on its side: the top stands up as a shield, the legs stick out behind it (-z).
const table = (id, x, z, rot = 0) => ({ id, kind: "table-down", label: "Перевёрнутый стол", x, z, rot, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 1.8, d: 0.12, h: 1.0 }] });

// Along the sides: tall safety netting, a watchtower for each team (ladder on the field side) and
// sandbag walls to hide behind.
export const TOWER = { w: 2.2, d: 2.2, z: 7.3, y: 2.25, h: 2.4 };
const tower = (side) => {
  const x = side * (14.55 - TOWER.w / 2),
    inner = x - (side * TOWER.w) / 2;
  return [
    { kind: "tower-deck", side, team: side < 0 ? "blue" : "red", x, z: TOWER.z, w: TOWER.w, d: TOWER.d, y: TOWER.y, h: TOWER.h },
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ kind: "tower-post", x: x + sx * (TOWER.w / 2 - 0.1), z: TOWER.z + sz * (TOWER.d / 2 - 0.1), w: 0.16, d: 0.16, h: TOWER.y }))),
    // Waist-high walls on the deck except on the ladder side.
    { kind: "parapet", x: x + (side * TOWER.w) / 2 - side * 0.05, z: TOWER.z, w: 0.1, d: TOWER.d, y: TOWER.h, h: TOWER.h + 0.95 },
    ...[-1, 1].map((sz) => ({ kind: "parapet", x, z: TOWER.z + sz * (TOWER.d / 2 - 0.05), w: TOWER.w, d: 0.1, y: TOWER.h, h: TOWER.h + 0.95 })),
  ];
};
export const TOWER_LADDERS = [-1, 1].map((side) => ({ id: "tower-" + (side < 0 ? "blue" : "red"), kind: "wall", x: side * (14.55 - TOWER.w / 2), z: TOWER.z, w: TOWER.w, d: 1.0, y0: 0, y1: TOWER.h, face: side < 0 ? "+x" : "-x" }));

// Fixed cover: concrete barricades (high, block sight and shots), a raised hill with ramps,
// wooden crates and earth berms that make low foxholes.
const barricade = (x, z, w, d, h, rot = 0) => ({ kind: "barricade", x, z, w, d, h, rot });
const crate = (x, z, s = 1.15) => ({ kind: "crate", x, z, w: s, d: s, h: s });
const berm = (x, z, w, d) => ({ kind: "berm", x, z, w, d, h: 1.05 });
// A raised platform reached by a ramp on each of its left and right sides.
function hill(x, z, w, d, h) {
  const half = w / 2,
    run = 2.6;
  return [
    { kind: "platform", x, z, w, d, h },
    { kind: "ramp", shape: "ramp", x: x - half - run / 2, z, w: run, d, h0: 0, h1: h, h, axis: "x" },
    { kind: "ramp", shape: "ramp", x: x + half + run / 2, z, w: run, d, h0: h, h1: 0, h, axis: "x" },
  ];
}

export default {
  id: "paintball",
  camZoom: 1.3,
  backdrop: "forest",
  title: "Пейнтбол",
  description: "Надувные укрытия, катушки, стога, столы, баррикады, холм и окопы",
  color: "#c2c14b",
  theme: {
    texture: "turf",
    side: "#3c4a2c",
    grid: "#ffffff",
    gridOpacity: 0.035,
    background: "#161c14",
    hemi: ["#f6ffe8", "#3e4a2c", 2.1],
    key: ["#fff2d8", 3.7],
    rim: ["#d6f0a0", 1.1],
    frame: "#5d6b3c",
  },
  spawn: [
    { x0: -12.8, x1: -11.2, z0: -1.5, z1: 5 },
    { x0: 11.2, x1: 12.8, z0: -1.5, z1: 5 },
  ],
  // Team bases at the left and right edges: flag poles.
  statics: [
    { kind: "flag", team: "blue", x: -13.4, z: 2.0, shape: "cylinder", radius: 0.12, w: 0.24, d: 0.24, h: 3.6 },
    { kind: "flag", team: "red", x: 13.4, z: 2.0, shape: "cylinder", radius: 0.12, w: 0.24, d: 0.24, h: 3.6 },
    ...[-13.6, 13.6].map((x) => ({ kind: "tyres", x, z: 9.4, shape: "cylinder", radius: 0.6, w: 1.2, d: 1.2, h: 0.95 })),
    ...[-1, 1].map((side) => ({ kind: "fence", style: "net", x: side * 14.62, z: 1.3, w: 0.06, d: 17.8, h: 3.6 })),
    ...tower(-1),
    ...tower(1),
    ...[-1, 1].map((side) => ({ kind: "sandbags", x: side * 13.65, z: -2.7, w: 0.6, d: 3.0, h: 0.95 })),
    // A central hill to fight over.
    ...hill(0, 0.4, 4.4, 4.0, 1.35),
    // High concrete barricades across the mid-field lanes (block sight and shots).
    ...[-1, 1].flatMap((side) => [
      barricade(side * 5.4, 4.2, 3.2, 0.4, 2.3, side * 0.4),
      barricade(side * 6.0, -4.8, 3.0, 0.4, 2.3, -side * 0.35),
      barricade(side * 10.8, 0.4, 0.4, 3.4, 2.1),
    ]),
    // Wooden crates for chest-high cover.
    ...[-1, 1].flatMap((side) => [crate(side * 3.4, -7.4), crate(side * 9.2, 3.8), crate(side * 2.2, 7.8, 1.3)]),
    // Earth berms making low foxholes near each side.
    ...[-1, 1].flatMap((side) => [berm(side * 8.0, -1.2, 2.6, 0.6), berm(side * 8.0, 0.8, 2.6, 0.6), berm(side * 9.3, -0.2, 0.6, 2.6)]),
  ],
  climbs: TOWER_LADDERS,
  props: [
    snake("snake-a", -3.4, -4.6, "#d8432f"),
    snake("snake-b", 3.4, 6.2, "#2f6fd8"),
    dorito("dorito-a", -8.2, -2.6, "#2f6fd8"),
    dorito("dorito-b", 8.2, -2.6, "#d8432f"),
    dorito("dorito-c", -6.0, 6.8, "#f2c14e"),
    dorito("dorito-d", 6.0, -6.8, "#f2c14e"),
    cake("cake-a", 0.0, -6.2, "#2b2b30"),
    can("can-a", -9.8, 6.4, "#d8432f"),
    can("can-b", 9.8, -6.4, "#2f6fd8"),
    brick("brick-a", -5.6, 1.8, "#2b2b30", Math.PI / 2),
    brick("brick-b", 5.6, 1.8, "#2b2b30", Math.PI / 2),
    { id: "spool-a", kind: "spool", label: "Кабельная катушка", x: -9.6, z: -6.8, h: 1.55, weight: 1, lift: 2, colliders: spool(1.55), waypoints: [{ x: 0, z: 0, h: 1.55 }] },
    { id: "spool-b", kind: "spool", label: "Кабельная катушка", x: 9.6, z: 6.6, h: 1.55, weight: 1, lift: 2, colliders: spool(1.55), waypoints: [{ x: 0, z: 0, h: 1.55 }] },
    hay("hay-a", 0.4, -8.6),
    hay("hay-b", -3.0, 8.2),
    hay("hay-c", 12.2, -5.0),
    table("table-a", -8.0, -5.5, 0),
    table("table-b", 3.0, -2.6, Math.PI),
    table("table-c", -11.0, -3.2, -Math.PI / 2),
  ],
  balls: [
    { id: "barrel-a", kind: "barrel", x: 1.8, z: 3.8 },
    { id: "barrel-b", kind: "barrel", x: -6.8, z: -6.6 },
    { id: "ball", kind: "paintball", x: -0.8, z: 5.6, color: "#d8432f" },
  ],
  cubes: [],
};
