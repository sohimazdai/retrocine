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

// The field is 1.3× the standard room (map.scale): the floor, the screen and the camera grow
// together, so there is more ground to fight over between the bases.
const S = 1.3,
  EDGE = 14.7 * S,
  // The floor's far edge at the sides (the wall is a cylinder: see layout.js).
  BACK_EDGE = (-12 + Math.sqrt(26 ** 2 - 1.6 ** 2)) * S - Math.sqrt((26 * S) ** 2 - EDGE ** 2),
  FRONT = 10.3 * S;

// Along the sides: tall safety netting, a watchtower for each team (ladder on the field side) and
// sandbag walls to hide behind.
export const TOWER = { w: 2.2, d: 2.2, z: 9.6, y: 2.25, h: 2.4 };
const towerX = (side) => side * (EDGE - 0.15 - TOWER.w / 2);
const tower = (side) => {
  const x = towerX(side);
  return [
    { kind: "tower-deck", side, team: side < 0 ? "blue" : "red", x, z: TOWER.z, w: TOWER.w, d: TOWER.d, y: TOWER.y, h: TOWER.h },
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ kind: "tower-post", x: x + sx * (TOWER.w / 2 - 0.1), z: TOWER.z + sz * (TOWER.d / 2 - 0.1), w: 0.16, d: 0.16, h: TOWER.y }))),
    // Waist-high walls on the deck except on the ladder side.
    { kind: "parapet", x: x + (side * TOWER.w) / 2 - side * 0.05, z: TOWER.z, w: 0.1, d: TOWER.d, y: TOWER.h, h: TOWER.h + 0.95 },
    ...[-1, 1].map((sz) => ({ kind: "parapet", x, z: TOWER.z + sz * (TOWER.d / 2 - 0.05), w: TOWER.w, d: 0.1, y: TOWER.h, h: TOWER.h + 0.95 })),
  ];
};
export const TOWER_LADDERS = [-1, 1].map((side) => ({ id: "tower-" + (side < 0 ? "blue" : "red"), kind: "wall", x: towerX(side), z: TOWER.z, w: TOWER.w, d: 1.0, y0: 0, y1: TOWER.h, face: side < 0 ? "+x" : "-x" }));

// Fixed cover: concrete barricades (high, block sight and shots), a raised hill with ramps,
// wooden crates and earth berms that make low foxholes.
const barricade = (x, z, w, d, h, rot = 0) => ({ kind: "barricade", x, z, w, d, h, rot });
const crate = (x, z, s = 1.15) => ({ kind: "crate", x, z, w: s, d: s, h: s });
const berm = (x, z, w, d) => ({ kind: "berm", x, z, w, d, h: 1.05 });
// A raised platform reached by a ramp on each of its left and right sides.
function hill(x, z, w, d, h) {
  const half = w / 2,
    run = 2.8;
  return [
    { kind: "platform", x, z, w, d, h },
    { kind: "ramp", shape: "ramp", x: x - half - run / 2, z, w: run, d, h0: 0, h1: h, h, axis: "x" },
    { kind: "ramp", shape: "ramp", x: x + half + run / 2, z, w: run, d, h0: h, h1: 0, h, axis: "x" },
  ];
}
// Everything mirrored for the two teams: f(side) for side −1 (blue, left) and +1 (red, right).
const both = (f) => [-1, 1].flatMap((side) => [].concat(f(side)));

export default {
  id: "paintball",
  scale: S,
  teamplay: true,
  backdrop: "forest",
  title: "Пейнтбол",
  description: "Большое поле: надувные укрытия, катушки, стога, баррикады, холмы и окопы",
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
    { x0: -17.0, x1: -15.0, z0: -2.4, z1: 6.4 },
    { x0: 15.0, x1: 17.0, z0: -2.4, z1: 6.4 },
  ],
  statics: [
    // Team bases at the left and right edges: flag poles, tyres, the net and a watchtower each.
    ...both((side) => [
      { kind: "flag", team: side < 0 ? "blue" : "red", x: side * 17.6, z: 2.4, shape: "cylinder", radius: 0.12, w: 0.24, d: 0.24, h: 3.6 },
      { kind: "tyres", x: side * 17.9, z: 12.4, shape: "cylinder", radius: 0.6, w: 1.2, d: 1.2, h: 0.95 },
      { kind: "fence", style: "net", x: side * (EDGE - 0.08), z: (BACK_EDGE + FRONT) / 2, w: 0.06, d: FRONT - BACK_EDGE, h: 3.6 },
      { kind: "sandbags", x: side * 17.9, z: -3.8, w: 0.6, d: 3.0, h: 0.95 },
      ...tower(side),
    ]),
    // A central hill to fight over, with a smaller mound in front of each base.
    ...hill(0, 0.4, 5.2, 4.6, 1.5),
    ...both((side) => hill(side * 9.0, -11.2, 2.2, 3.0, 1.1)),
    // High concrete barricades across the lanes (block sight and shots).
    ...both((side) => [
      barricade(side * 6.6, 5.6, 3.6, 0.4, 2.3, side * 0.4),
      barricade(side * 7.6, -6.0, 3.4, 0.4, 2.3, -side * 0.35),
      barricade(side * 14.0, 0.4, 0.4, 3.6, 2.1),
      barricade(side * 3.6, -11.6, 3.0, 0.4, 2.3),
      barricade(side * 12.6, 9.0, 0.4, 3.2, 2.2),
      barricade(side * 2.6, 11.4, 2.6, 0.4, 2.0),
    ]),
    // Wooden crates for chest-high cover.
    ...both((side) => [
      crate(side * 4.4, -8.6),
      crate(side * 12.0, 4.6),
      crate(side * 2.9, 9.6, 1.3),
      crate(side * 15.4, -7.2),
      crate(side * 10.8, -2.4, 1.0),
      crate(side * 7.8, 12.4),
    ]),
    // Earth berms: a foxhole near each base and one more out in the field.
    ...both((side) => [berm(side * 10.4, -1.6, 2.6, 0.6), berm(side * 10.4, 1.0, 2.6, 0.6), berm(side * 12.0, -0.3, 0.6, 2.6)]),
    ...both((side) => [berm(side * 6.1, 1.0, 0.6, 2.4), berm(side * 4.6, -3.4, 2.0, 0.6)]),
  ],
  climbs: TOWER_LADDERS,
  props: [
    snake("snake-a", -4.4, -6.0, "#d8432f"),
    snake("snake-b", 4.4, 8.0, "#2f6fd8"),
    snake("snake-c", 0.0, -13.2, "#f2c14e"),
    dorito("dorito-a", -10.6, -4.6, "#2f6fd8"),
    dorito("dorito-b", 10.6, -4.6, "#d8432f"),
    dorito("dorito-c", -7.8, 8.8, "#f2c14e"),
    dorito("dorito-d", 8.2, -8.2, "#f2c14e"),
    cake("cake-a", 0.0, -8.4, "#2b2b30"),
    cake("cake-b", 0.0, 7.2, "#2b2b30"),
    can("can-a", -12.7, 6.8, "#d8432f"),
    can("can-b", 12.7, -7.6, "#2f6fd8"),
    brick("brick-a", -7.3, 2.3, "#2b2b30", Math.PI / 2),
    brick("brick-b", 7.3, 2.3, "#2b2b30", Math.PI / 2),
    { id: "spool-a", kind: "spool", label: "Кабельная катушка", x: -14.2, z: -8.2, h: 1.55, weight: 1, lift: 2, colliders: spool(1.55), waypoints: [{ x: 0, z: 0, h: 1.55 }] },
    { id: "spool-b", kind: "spool", label: "Кабельная катушка", x: 12.5, z: 7.2, h: 1.55, weight: 1, lift: 2, colliders: spool(1.55), waypoints: [{ x: 0, z: 0, h: 1.55 }] },
    hay("hay-a", 3.0, -5.2),
    hay("hay-b", -3.9, 4.6),
    hay("hay-c", 15.2, -8.8),
    hay("hay-d", -10.6, 11.4),
    table("table-a", -10.4, -7.2, 0),
    table("table-b", 1.4, -3.6, Math.PI),
    table("table-c", -14.4, -4.2, -Math.PI / 2),
    table("table-d", 14.4, 4.4, Math.PI / 2),
  ],
  balls: [
    { id: "barrel-a", kind: "barrel", x: 2.3, z: 4.9 },
    { id: "barrel-b", kind: "barrel", x: -6.6, z: -8.2 },
    { id: "ball", kind: "paintball", x: -0.8, z: 9.6, color: "#d8432f" },
  ],
  cubes: [],
};
