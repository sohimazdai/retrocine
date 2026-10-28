// Горная трасса: серпантин со шпильками вверх по склону, вершина у задней кромки, спуск с
// S-образной связкой. Поднятые участки идут по насыпи с отбойниками — с дороги не вылететь, а
// снизу под неё не проехать. Карт — из автомата в боксах; рядом автомат выбора трассы.
import { centreline, raisedPaths, lineAt, roomAt } from "./trackgen.js";

const W = 3.4;
// Control points [x, z, height]: front straight left → right, up the right side in two switchbacks,
// over the summit at the back, down the left with an S.
const CTRL = [
  [-6, 5.9, 0], [1, 5.9, 0], [7, 5.6, 0], [10.3, 3.6, 0.3],
  [10.6, -0.5, 0.9], [10.2, -3.8, 1.3], [8.4, -5.6, 1.4], [6.3, -4.6, 1.5],
  [5.7, -1.8, 1.6], [5.4, 0.4, 1.7], [3.6, 1.6, 1.8], [1.4, 0.6, 1.9],
  [0.9, -2.6, 2.2], [0.6, -6.0, 2.6], [-1.6, -8.4, 2.6], [-4.8, -8.0, 2.3],
  [-6.2, -5.8, 2.0], [-8.4, -7.6, 1.7], [-10.8, -6.2, 1.4], [-10.7, -3.0, 1.0],
  [-9.0, -1.0, 0.7], [-10.3, 1.8, 0.35], [-10.3, 4.5, 0.05], [-8.6, 5.9, 0],
];
export const POINTS = centreline(CTRL, 0.6);
const at = (f) => Math.round(f * POINTS.length) % POINTS.length;
export const TRACK = {
  width: W,
  points: POINTS.map(([x, z]) => [x, z]),
  finish: lineAt(POINTS, 4, W),
  checkpoints: [0.25, 0.5, 0.75].map((f) => lineAt(POINTS, at(f), W)),
  finishIndex: 4,
};
const room = roomAt(POINTS, W);
// Rocks shrink to fit the gap they are in (and are left out if there is hardly any).
const ROCKS = [
  [8.05, -1.0, 0.5, 1.8], [8.1, -2.8, 0.5, 1.6], [3.3, -2.6, 0.5, 2.3], [3.2, -0.6, 0.5, 1.9],
  [-3.9, -0.6, 2.0, 3.4], [-2.5, -3.6, 1.0, 2.6], [-5.2, -3.0, 0.8, 1.9],
  [-7.0, -3.4, 0.5, 1.3], [8.0, 0.9, 0.55, 1.4], [3.4, -4.6, 0.55, 2.0],
]
  .map(([x, z, r, h]) => [x, z, Math.min(r, room(x, z) - 0.02), h])
  .filter(([, , r]) => r >= 0.25)
  .map(([x, z, r, h]) => ({ kind: "rock", x, z, shape: "cylinder", radius: Math.round(r * 100) / 100, w: r * 2, d: r * 2, h }));
const PINES = [
  [7.7, 2.2, 3.0], [-1.0, 2.7, 3.2], [0.4, 3.6, 2.8], [-6.8, 3.2, 3.6], [-6.4, 1.6, 3.0], [6.6, 3.4, 2.6], [-1.6, 1.4, 2.6],
]
  .filter(([x, z]) => room(x, z) >= 0.35)
  .map(([x, z, h]) => ({ kind: "pine", x, z, shape: "cylinder", radius: 0.3, w: 0.6, d: 0.6, h }));
export const DISPENSER = { x: 1.4, z: 9.3, spawn: { x: 1.4, z: 5.9, a: Math.PI / 2 } };
export const SELECTOR = { x: -3.2, z: 9.3 };

export default {
  id: "race-mountain",
  kartTrack: true,
  camZoom: 1.35,
  backdrop: "mountains",
  title: "Горная трасса",
  description: "Серпантин со шпильками, подъём на вершину и спуск",
  color: "#7a8b5a",
  theme: {
    texture: "turf",
    tint: "#b9c79c",
    side: "#3c4a2c",
    grid: "#ffffff",
    gridOpacity: 0,
    background: "#141a16",
    hemi: ["#eef6ff", "#3a4532", 2.1],
    key: ["#fff1dc", 3.6],
    rim: ["#bcd4ff", 1.2],
    frame: "#6b6f5a",
  },
  track: TRACK,
  roadPoints: POINTS,
  dispensers: [DISPENSER],
  selectors: [SELECTOR],
  spawn: [
    { x0: -5.6, x1: -1.8, z0: 8.8, z1: 9.8 },
    { x0: 3.4, x1: 6.4, z0: 8.8, z1: 9.8 },
  ],
  statics: [
    // The road up the mountain: on an embankment with crash barriers.
    ...raisedPaths(POINTS, W, { kind: "road", solid: true, walls: true, style: "mountain" }),
    // Rock outcrops in the hairpins and the mountain's heart, pines between (only where clear of the road).
    ...ROCKS,
    ...PINES,
    // Timing board in the infield and start lights by the line.
    { kind: "board", x: -3.9, z: 2.7, w: 2.4, d: 0.45, h: 2.5 },
    { kind: "start-lights", x: POINTS[4][0], z: POINTS[4][1] - W / 2 - 0.5, shape: "cylinder", radius: 0.1, w: 0.2, d: 0.2, h: 2.4 },
  ],
  props: [
    { id: "dispenser", kind: "kart-dispenser", label: "Выдача картов — нажмите E рядом", x: DISPENSER.x, z: DISPENSER.z, colliders: [{ x: 0, z: 0, w: 1.6, d: 0.7, h: 2.1 }] },
    { id: "selector", kind: "track-selector", label: "Выбор трассы — нажмите E рядом", x: SELECTOR.x, z: SELECTOR.z, colliders: [{ x: 0, z: 0, w: 1.3, d: 0.7, h: 2.0 }] },
  ],
  balls: [],
  cubes: [],
};
