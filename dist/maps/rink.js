// Зимний каток: замёрзший пруд с бортиками, по льду катишься по инерции. Хоккей шайбой в маленькие
// ворота, ледяная горка — съезжаешь на санках, снежные комы растут, пока их катишь по снегу.
// Снеговики, тёплый домик с дымком, ёлка с гирляндой, фонари и снегопад.
export const RINK = { x0: -8, x1: 8, z0: -5, z1: 5, gap: 1.3, board: 0.7 };
const B = RINK;
const boards = [
  // Back and front boards with a gate in the middle of each; full boards at the ends.
  ...[B.z0, B.z1].flatMap((z) =>
    [-1, 1].map((s) => {
      const from = s * B.gap,
        to = s * B.x1;
      return { kind: "board", x: (from + to) / 2, z, w: Math.abs(to - from), d: 0.15, h: B.board };
    }),
  ),
  ...[B.x0, B.x1].map((x) => ({ kind: "board", x, z: 0, w: 0.15, d: B.z1 - B.z0 + 0.15, h: B.board })),
];
// Hockey net: posts, crossbar, back and sides; the mouth faces local +z.
const NET = [
  { x: -0.92, z: 0, w: 0.08, d: 0.08, h: 1.2 },
  { x: 0.92, z: 0, w: 0.08, d: 0.08, h: 1.2 },
  { x: 0, z: 0, w: 1.9, d: 0.08, y: 1.12, h: 1.2 },
  { x: 0, z: -0.9, w: 1.85, d: 0.05, h: 1.2 },
  { x: -0.92, z: -0.45, w: 0.05, d: 0.9, h: 1.2 },
  { x: 0.92, z: -0.45, w: 0.05, d: 0.9, h: 1.2 },
];
const net = (id, label, x, rot, color) => ({ id, kind: "hockey-net", label, x, z: 0, rot, color, weight: 1, lift: 2, colliders: NET, goal: true, mouth: { w: 1.76, h: 1.1 }, ballSpot: { x: 0, z: 3 } });
const snowman = (id, x, z, hat) => ({ id, kind: "snowman", label: "Снеговик", x, z, hat, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, shape: "cylinder", radius: 0.55, w: 1.1, d: 1.1, h: 1.75 }] });
export const HILL = { x: 12.4, z: -6.4, w: 4.6, d: 2.4, h: 2.4 };
const SLED_RUN = { kind: "sled-run", shape: "ramp", x: HILL.x, z: HILL.z + HILL.d / 2 + 3.75, w: 3.4, d: 7.5, h0: HILL.h, h1: 0, h: HILL.h, axis: "z", slide: 130 };
const STEPS = { kind: "snow-steps", shape: "ramp", x: HILL.x - HILL.w / 2 - 1.5 + 0.05, z: HILL.z, w: 3.0, d: 1.4, h0: 0, h1: HILL.h, h: HILL.h, axis: "x" };
// A snow fort on each side: walls to hide behind and a tower to jump up on, open toward the rink.
const fort = (side, z0, z1) => {
  const xo = side * 14.55,
    xi = side * 12.3,
    x = (xo + xi) / 2,
    w = Math.abs(xo - xi);
  return [
    { kind: "snow-wall", x: xo - side * 0.25, z: (z0 + z1) / 2, w: 0.5, d: z1 - z0, h: 1.2 },
    ...[z0, z1].map((z) => ({ kind: "snow-wall", x, z: z + (z === z0 ? 0.25 : -0.25), w, d: 0.5, h: 1.2 })),
    { kind: "snow-tower", x: xo - side * 0.85, z: z0 + 0.95, w: 1.2, d: 1.2, h: 2.0 },
  ];
};
export const HUT = { x: -11.8, z: -6.0, w: 3.6, d: 2.8, h: 3.4 };

export default {
  id: "rink",
  title: "Зимний каток",
  description: "Скользкий лёд, хоккей, горка с санками и снежные комы",
  color: "#7fa7d8",
  theme: {
    texture: "snow",
    side: "#c7d3e6",
    grid: "#ffffff",
    gridOpacity: 0,
    background: "#0d1521",
    hemi: ["#e4eeff", "#3b4c6a", 2.2],
    key: ["#eef4ff", 3.2],
    rim: ["#9fc4ff", 1.5],
    frame: "#5b6f8f",
  },
  spawn: { x0: -3, x1: 3, z0: 6.4, z1: 8.6 },
  zones: [{ id: "ice", kind: "ice", x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1, grip: 0.06 }],
  statics: [
    ...boards,
    { kind: "hill", ...HILL },
    SLED_RUN,
    STEPS,
    ...fort(-1, -2.4, 2.8),
    ...fort(1, 4.6, 8.4),
    { kind: "hut", ...HUT },
    ...[
      [-13.5, 8.5, 3.6],
      [13.7, 8.9, 3.4],
      [-14.1, -3.8, 4.0],
      [-9.0, -8.7, 4.6, true],
    ].map(([x, z, h, festive]) => ({ kind: "fir", festive: !!festive, x, z, shape: "cylinder", radius: 0.3, w: 0.6, d: 0.6, h })),
    ...[
      [-8.7, 5.7],
      [8.7, 5.7],
      [-9.9, -3.6],
    ].map(([x, z]) => ({ kind: "lamp", x, z, shape: "cylinder", radius: 0.1, w: 0.2, d: 0.2, h: 3.2 })),
  ],
  props: [
    net("net-left", "Левые ворота", B.x0 + 1.4, Math.PI / 2, "#d8432f"),
    net("net-right", "Правые ворота", B.x1 - 1.4, -Math.PI / 2, "#2f6fd8"),
    snowman("snowman-a", -10.8, 3.2, "bucket"),
    snowman("snowman-b", -11.6, 6.6, "hat"),
    snowman("snowman-c", 10.4, 7.9, "scarf"),
    { id: "bench", kind: "snow-bench", label: "Скамейка", x: -11.8, z: -3.6, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 2.0, d: 0.6, h: 0.48 }], waypoints: [{ x: 0, z: 0, h: 0.48 }] },
  ],
  balls: [
    { id: "puck", kind: "puck", x: 0, z: 0, home: true },
    { id: "snow-1", kind: "snowroll", x: -5.6, z: 7.6 },
    { id: "snow-2", kind: "snowroll", x: 5.2, z: 8.2 },
    { id: "snow-3", kind: "snowroll", x: -10.2, z: -1.6 },
  ],
  cubes: [],
};
