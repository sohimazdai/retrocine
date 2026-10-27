// Детская площадка: батут, баскетбольное кольцо, мячи, футбольные ворота у левого и правого края,
// качели-весы и игрушечный трёхэтажный форт с горкой.
import { GOAL_COLLIDERS } from "./cinema.js";

// Fort, local coordinates (front = +z): three stacked floors, a step and a slide on the left.
const FORT = [
  { x: 0, z: 0, w: 4.2, d: 3.6, h: 1.0 },
  { x: -0.55, z: -0.4, w: 3.1, d: 2.8, h: 2.0 },
  { x: -1.05, z: -0.8, w: 2.1, d: 2.0, h: 3.0 },
  { x: 1.4, z: 2.15, w: 1.2, d: 0.7, h: 0.5 },
  { shape: "ramp", x: -3.6, z: -0.4, w: 3.0, d: 0.9, h0: 0, h1: 2.0, h: 2.0, axis: "x", slide: 34 },
];
// The seesaw plank is a ramp whose ends move with its tilt (see world.js, seesawCollider).
export const SEESAW = { length: 4.4, width: 0.52, pivot: 0.55, swing: 0.47 };

export default {
  id: "playground",
  title: "Детская площадка",
  description: "Батут, кольцо, ворота, качели-весы и форт с горкой",
  color: "#e4734f",
  theme: {
    texture: "rubber",
    side: "#2f5f6c",
    grid: "#ffffff",
    gridOpacity: 0.04,
    background: "#1d2c3a",
    hemi: ["#fff8ec", "#3d5a66", 2.25],
    key: ["#fff4de", 3.6],
    rim: ["#a8d8ff", 1.2],
    frame: "#3f7b8c",
  },
  spawn: { x0: -3, x1: 3, z0: 6.5, z1: 8.5 },
  statics: [
    [-13.4, -6.6, 3.4],
    [13.6, -5.2, 3.6],
    [-13.8, 9.4, 3.1],
    [13.8, 9.4, 3.3],
  ].map(([x, z, h]) => ({ kind: "tree", x, z, shape: "cylinder", radius: 0.22, w: 0.44, d: 0.44, h })),
  props: [
    {
      id: "fort",
      kind: "fort",
      label: "Форт",
      x: -8.4,
      z: -6.0,
      colliders: FORT,
      waypoints: [
        { x: 1.4, z: 2.15, h: 0.5 },
        { x: 1.5, z: 1.35, h: 1.0 },
        { x: 0.5, z: 0.6, h: 2.0 },
        { x: -1.05, z: -0.8, h: 3.0 },
      ],
    },
    {
      id: "hoop",
      kind: "hoop",
      label: "Баскетбольное кольцо",
      x: 8.4,
      z: -7.4,
      colliders: [
        { x: 0, z: -0.95, w: 0.2, d: 0.2, h: 3.3 },
        { x: 0, z: -0.45, w: 1.7, d: 0.1, y: 2.4, h: 3.5 },
      ],
      hoop: { x: 0, z: 0.1, y: 2.75, r: 0.55 },
    },
    {
      id: "trampoline",
      kind: "trampoline",
      label: "Батут",
      x: -7.6,
      z: 5.6,
      colliders: [{ x: 0, z: 0, shape: "cylinder", radius: 1.6, w: 3.2, d: 3.2, h: 0.65, bounce: 15 }],
      waypoints: [{ x: 0, z: 0, h: 0.65 }],
    },
    {
      id: "seesaw",
      kind: "seesaw",
      label: "Качели-весы",
      x: 7.6,
      z: 6.6,
      colliders: [{ shape: "ramp", x: 0, z: 0, w: SEESAW.length, d: SEESAW.width, h0: SEESAW.pivot - SEESAW.swing, h1: SEESAW.pivot + SEESAW.swing, h: SEESAW.pivot + SEESAW.swing, axis: "x", seesaw: true }],
    },
    { id: "goal-left", kind: "goal", label: "Левые ворота", x: -12.3, z: 1.0, rot: Math.PI / 2, colliders: GOAL_COLLIDERS, goal: true, ballSpot: { x: 0, z: 4.3 }, colors: { post: "#f6f3ea", base: "#e4734f", net: "#ffffff" } },
    { id: "goal-right", kind: "goal", label: "Правые ворота", x: 12.3, z: 1.0, rot: -Math.PI / 2, colliders: GOAL_COLLIDERS, goal: true, ballSpot: { x: 0, z: 4.3 }, colors: { post: "#f6f3ea", base: "#3f7b8c", net: "#ffffff" } },
    { id: "bench", kind: "bench", label: "Скамейка", x: 0, z: -9.9, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 2.2, d: 0.7, h: 0.5 }], waypoints: [{ x: 0, z: 0, h: 0.5 }] },
  ],
  balls: [
    { id: "football", kind: "football", x: 0, z: 1.0, home: true },
    { id: "basketball", kind: "basketball", x: 6.6, z: -4.4, home: true },
    { id: "ball-red", kind: "playball", x: -3.4, z: 4.6, color: "#e8574f" },
    { id: "ball-yellow", kind: "playball", x: 3.8, z: -2.6, color: "#f2c14e" },
    { id: "ball-blue", kind: "playball", x: -2.2, z: -4.8, color: "#57a7b8" },
  ],
  cubes: [
    { x: -4.6, z: -8.4, color: "#e4734f" },
    { x: 4.4, z: 8.6, color: "#f2c14e" },
  ],
};
