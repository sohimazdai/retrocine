// Кинозал — the original stage: a pyramid, two cable spools, the big cube, a ball and a goal.
const tiers = Array.from({ length: 4 }, (_, i) => ({
  x: 0,
  z: 0,
  w: 4.4 - i * 1.05,
  d: 4.4 - i * 1.05,
  h: (i + 1) * 0.64,
}));
const spool = (h) => [{ x: 0, z: 0, shape: "cylinder", radius: 1.25, w: 2.5, d: 2.5, h }];
export const GOAL_COLLIDERS = [
  { x: -2.1, z: 0, w: 0.15, d: 0.15, h: 2.55 },
  { x: 2.1, z: 0, w: 0.15, d: 0.15, h: 2.55 },
  { x: 0, z: 0, w: 4.35, d: 0.15, y: 2.4, h: 2.55 },
  { x: 0, z: -1.45, w: 4.3, d: 0.06, h: 2.55 },
  { x: -2.1, z: -0.75, w: 0.05, d: 1.4, h: 2.55 },
  { x: 2.1, z: -0.75, w: 0.05, d: 1.4, h: 2.55 },
];
// Along the sides: velvet curtains, a loge on each side up a flight of stairs (you can walk under
// it), a popcorn machine and an arcade cabinet to push around.
export const LOGE = { w: 1.8, z0: -3.0, z1: 1.0, y: 2.25, h: 2.4 };
const loge = (side) => {
  const x = side * (14.65 - LOGE.w / 2),
    z = (LOGE.z0 + LOGE.z1) / 2,
    d = LOGE.z1 - LOGE.z0,
    inner = x - (side * LOGE.w) / 2;
  return [
    { kind: "loge", side, x, z, w: LOGE.w, d, y: LOGE.y, h: LOGE.h },
    ...[LOGE.z0 + 0.1, LOGE.z1 - 0.1].map((pz) => ({ kind: "loge-post", x: inner + side * 0.1, z: pz, w: 0.16, d: 0.16, h: LOGE.y })),
    { kind: "loge-rail", x: inner + side * 0.04, z, w: 0.08, d, y: LOGE.h, h: LOGE.h + 0.9 },
    { kind: "loge-rail", x, z: LOGE.z0 + 0.04, w: LOGE.w, d: 0.08, y: LOGE.h, h: LOGE.h + 0.9 },
    // Stairs down toward the front, drawn as steps.
    { kind: "loge-stairs", shape: "ramp", x: side * 13.75, z: LOGE.z1 + 1.5, w: 1.4, d: 3.0, h0: LOGE.h, h1: 0, h: LOGE.h, axis: "z" },
  ];
};
export default {
  id: "cinema",
  title: "Кинозал",
  description: "Пирамида, катушки, большой куб, мяч и ворота",
  color: "#8f7fb0",
  theme: {},
  statics: [
    ...[-1, 1].map((side) => ({ kind: "curtain", x: side * 14.66, z: 1.3, w: 0.06, d: 17.8, h: 4.2 })),
    ...loge(-1),
    ...loge(1),
  ],
  props: [
    { id: "popcorn", kind: "popcorn", label: "Попкорн-машина", x: -13.1, z: 7.4, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 0.8, d: 0.6, h: 1.65 }] },
    { id: "arcade", kind: "arcade", label: "Игровой автомат — двигают вдвоём", x: 13.2, z: 7.4, rot: -Math.PI / 2, weight: 2, lift: 3, colliders: [{ x: 0, z: 0, w: 0.8, d: 0.8, h: 1.8 }] },
    {
      id: "big",
      kind: "bigcube",
      label: "Большой куб",
      x: 2.4,
      z: -1.1,
      weight: 2,
      lift: 3,
      colliders: [{ x: 0, z: 0, w: 2.8, d: 2.8, h: 1.65 }],
      waypoints: [{ x: 0, z: 0, h: 1.65 }],
    },
    {
      id: "pyramid",
      kind: "pyramid",
      label: "Пирамида",
      x: -6.5,
      z: -3.7,
      weight: 3,
      lift: 4,
      colliders: tiers,
      waypoints: tiers.map((tier, i) => ({ x: 0, z: i === 3 ? 0 : tier.d / 2 - 0.32, h: tier.h })),
    },
    { id: "spool-a", kind: "spool", label: "Кабельная катушка", x: -8.3, z: 3.7, h: 1.55, weight: 1, lift: 2, colliders: spool(1.55), waypoints: [{ x: 0, z: 0, h: 1.55 }] },
    { id: "spool-b", kind: "spool", label: "Кабельная катушка", x: 6.2, z: 5.8, h: 1.9, weight: 1, lift: 2, colliders: spool(1.9), waypoints: [{ x: 0, z: 0, h: 1.9 }] },
    { id: "goal", kind: "goal", label: "Футбольные ворота", x: 8.1, z: -4.8, weight: 1, lift: 2, colliders: GOAL_COLLIDERS, goal: true, ballSpot: { x: 0, z: 4.3 } },
  ],
  balls: [{ id: "football", kind: "football", x: 7.5, z: -0.5 }],
  cubes: [
    { x: -10.3, z: 7.8, color: "#a696ce" },
    { x: 6.5, z: 2, color: "#ccad87" },
    { x: 10.5, z: -4, color: "#9bbbbb" },
    { x: -1, z: 0.5, color: "#c99ead" },
  ],
};
