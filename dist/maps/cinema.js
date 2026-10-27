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
export default {
  id: "cinema",
  title: "Кинозал",
  description: "Пирамида, катушки, большой куб, мяч и ворота",
  color: "#8f7fb0",
  theme: {},
  props: [
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
