// Салун с Дикого Запада: барная стойка с кружками, столы со стульями, пианино (сдвинуть его
// можно только втроём), лестница на балкон, бочки.
const table = (id, x, z) => ({ id, kind: "saloon-table", label: "Стол", x, z, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, shape: "cylinder", radius: 0.8, w: 1.6, d: 1.6, h: 0.82 }], waypoints: [{ x: 0, z: 0, h: 0.82 }] });
// Chairs face the table they belong to; rot turns the backrest away from it.
const chair = (id, x, z, rot) => ({ id, kind: "chair", label: "Стул", x, z, rot, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 0.55, d: 0.55, h: 0.48 }], waypoints: [{ x: 0, z: 0, h: 0.48 }] });
const stool = (id, x, z) => ({ id, kind: "stool", label: "Барный табурет", x, z, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, shape: "cylinder", radius: 0.27, w: 0.54, d: 0.54, h: 0.78 }], waypoints: [{ x: 0, z: 0, h: 0.78 }] });
const TABLES = [
  ["table-a", -4.6, -4.2],
  ["table-b", 2.2, -5.2],
  ["table-c", -2.4, 2.4],
  ["table-d", 5.0, 1.2],
];
// Shooting gallery: a shelf of bottles on each side wall; knock them off with snowballs and the rest.
const SHELVES = [
  { side: -1, z0: 4.6, z1: 8.6 },
  { side: 1, z0: 4.6, z1: 8.6 },
];
const SHELF = { w: 0.42, y: 1.22, h: 1.3 };
const BOTTLE_COLORS = ["#3f6b3a", "#7a4a22", "#2e5a6b", "#6b2a3a", "#8a7a3a"];
const BALCONY = { x: 12.6, z: -3.2, w: 3.4, d: 7.8, y: 2.25, h: 2.4 };
// The stairs are a slope you walk up (drawn as steps), ending level with the balcony floor.
const STAIRS = { kind: "stairs", shape: "ramp", x: 13.55, z: BALCONY.z + BALCONY.d / 2 + 1.5, w: 1.5, d: 3.0, h0: BALCONY.h, h1: 0, h: BALCONY.h, axis: "z" };

export default {
  id: "saloon",
  backdrop: "town",
  title: "Салун",
  description: "Стойка с кружками, столы, пианино, балкон и бочки",
  color: "#a8643a",
  theme: {
    texture: "planks",
    tint: "#c79b78",
    side: "#3e2617",
    grid: "#ffffff",
    gridOpacity: 0,
    background: "#150e0a",
    hemi: ["#ffe2bd", "#3a2617", 1.7],
    key: ["#ffd29a", 3.4],
    rim: ["#ff9e5a", 1.5],
    frame: "#6b4a2c",
  },
  spawn: { x0: -3, x1: 3, z0: 6, z1: 8.5 },
  statics: [
    // Balcony on posts: you can walk underneath it; the stairs lead up from the front.
    { kind: "balcony", ...BALCONY },
    ...[
      [BALCONY.x - BALCONY.w / 2 + 0.12, BALCONY.z - BALCONY.d / 2 + 0.12],
      [BALCONY.x - BALCONY.w / 2 + 0.12, BALCONY.z + BALCONY.d / 2 - 0.12],
      [BALCONY.x - BALCONY.w / 2 + 0.12, BALCONY.z],
    ].map(([x, z]) => ({ kind: "post", x, z, w: 0.22, d: 0.22, h: BALCONY.y })),
    { kind: "railing", x: BALCONY.x - BALCONY.w / 2 + 0.05, z: BALCONY.z, w: 0.08, d: BALCONY.d, y: BALCONY.h, h: BALCONY.h + 0.95 },
    { kind: "railing", x: BALCONY.x - 0.75, z: BALCONY.z + BALCONY.d / 2 - 0.05, w: BALCONY.w - 1.5, d: 0.08, y: BALCONY.h, h: BALCONY.h + 0.95 },
    STAIRS,
    ...SHELVES.map((s) => ({ kind: "shelf", x: s.side * (14.67 - SHELF.w / 2), z: (s.z0 + s.z1) / 2, w: SHELF.w, d: s.z1 - s.z0, y: SHELF.y, h: SHELF.h })),
  ],
  props: [
    {
      id: "bar",
      kind: "bar",
      label: "Барная стойка",
      x: -11.9,
      z: -1.4,
      colliders: [
        { x: 1.35, z: 0, w: 0.95, d: 9.2, h: 1.12 },
        { x: -1.75, z: 0, w: 0.7, d: 9.2, h: 2.7 },
      ],
      waypoints: [{ x: 1.35, z: 3.6, h: 1.12 }],
    },
    {
      id: "piano",
      kind: "piano",
      label: "Пианино — двигают втроём",
      x: 6.8,
      z: -8.0,
      weight: 3,
      lift: 4,
      colliders: [{ x: 0, z: 0, w: 2.0, d: 0.8, h: 1.4 }],
      waypoints: [{ x: 0, z: 0, h: 1.4 }],
    },
    ...TABLES.map(([id, x, z]) => table(id, x, z)),
    ...TABLES.flatMap(([id, x, z]) => [chair(id + "-chair-l", x - 1.25, z + 0.2, Math.PI / 2), chair(id + "-chair-r", x + 1.25, z - 0.2, -Math.PI / 2)]),
    ...[-4.6, -2.6, -0.6, 1.4].map((z, i) => stool("stool-" + i, -9.6, z)),
  ],
  balls: [
    { id: "mug-1", kind: "mug", x: -10.55, z: -3.8, y: 1.27 },
    { id: "mug-2", kind: "mug", x: -10.55, z: -1.2, y: 1.27 },
    { id: "mug-3", kind: "mug", x: -10.55, z: 1.6, y: 1.27 },
    { id: "mug-4", kind: "mug", x: -2.2, z: 2.3, y: 0.97 },
    { id: "mug-5", kind: "mug", x: 5.2, z: 1.0, y: 0.97 },
    { id: "barrel-1", kind: "barrel", x: -9.8, z: 5.6 },
    { id: "barrel-2", kind: "barrel", x: -8.8, z: 6.4 },
    { id: "barrel-3", kind: "barrel", x: 9.4, z: 5.6 },
    ...SHELVES.flatMap((s) =>
      Array.from({ length: 7 }, (_, i) => ({ id: `bottle-${s.side < 0 ? "l" : "r"}${i}`, kind: "bottle", x: s.side * 14.32, z: s.z0 + 0.35 + i * ((s.z1 - s.z0 - 0.7) / 6), y: SHELF.h + 0.14, color: BOTTLE_COLORS[(i + (s.side > 0 ? 2 : 0)) % BOTTLE_COLORS.length] })),
    ),
  ],
  cubes: [],
};
