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

export default {
  id: "paintball",
  title: "Пейнтбол",
  description: "Надувные укрытия, катушки, стога и перевёрнутые столы",
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
  ],
  props: [
    snake("snake-a", -3.4, -4.6, "#d8432f"),
    snake("snake-b", 3.4, 6.2, "#2f6fd8"),
    dorito("dorito-a", -8.2, -2.6, "#2f6fd8"),
    dorito("dorito-b", 8.2, -2.6, "#d8432f"),
    dorito("dorito-c", -6.0, 6.8, "#f2c14e"),
    dorito("dorito-d", 6.0, -6.8, "#f2c14e"),
    cake("cake-a", -0.2, 1.4, "#2b2b30"),
    can("can-a", -9.8, 6.4, "#d8432f"),
    can("can-b", 9.8, -6.4, "#2f6fd8"),
    brick("brick-a", -5.6, 1.8, "#2b2b30", Math.PI / 2),
    brick("brick-b", 5.6, 1.8, "#2b2b30", Math.PI / 2),
    { id: "spool-a", kind: "spool", label: "Кабельная катушка", x: -9.6, z: -6.8, h: 1.55, weight: 1, lift: 2, colliders: spool(1.55), waypoints: [{ x: 0, z: 0, h: 1.55 }] },
    { id: "spool-b", kind: "spool", label: "Кабельная катушка", x: 9.6, z: 6.6, h: 1.55, weight: 1, lift: 2, colliders: spool(1.55), waypoints: [{ x: 0, z: 0, h: 1.55 }] },
    hay("hay-a", 0.4, -8.6),
    hay("hay-b", -3.0, 8.2),
    hay("hay-c", 10.6, 1.4),
    table("table-a", -2.0, -1.6, 0),
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
