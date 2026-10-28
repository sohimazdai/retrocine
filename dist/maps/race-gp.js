// Гран-при: извилистая трасса с петлёй-развязкой — дорога закручивается на 270°, поднимаясь, и
// проходит по мосту над самой собой, — и очень резкой шпилькой в дальнем левом углу. Мост и съезд
// с отбойниками; под мостом проезд свободен.
import { centreline, raisedPaths, lineAt, clearOf, outside, bend } from "./trackgen.js";

const W = 3.4;
const CTRL = [
  [-4, 7.0, 0], [0, 7.0, 0], [2.6, 6.5, 0], [3.6, 4.6, 0], [3.6, 2.0, 0], [3.6, -0.6, 0],
  // The loop: 270° to the left, climbing, then over the road you came up.
  [2.72, -2.72, 0.35], [0.6, -3.6, 0.7], [-1.52, -2.72, 1.05], [-2.4, -0.6, 1.4], [-1.52, 1.52, 1.7], [0.6, 2.4, 1.95],
  [3.6, 2.4, 1.95], [6.5, 2.4, 1.9], [8.6, 1.8, 1.55], [10.4, -0.4, 0.9], [10.7, -3.2, 0.2], [10.0, -5.6, 0],
  [8.0, -7.4, 0], [4.5, -8.4, 0], [0, -8.7, 0], [-4.5, -8.6, 0],
  // The hairpin.
  [-8.4, -8.5, 0], [-10.5, -7.2, 0], [-10.1, -4.5, 0], [-7.9, -3.8, 0],
  [-7.0, -1.8, 0], [-7.0, 1.0, 0], [-6.6, 4.4, 0], [-5.4, 6.5, 0],
];
export const POINTS = centreline(CTRL, 0.6);
const at = (f) => Math.round(f * POINTS.length) % POINTS.length;
export const TRACK = {
  width: W,
  points: POINTS.map(([x, z]) => [x, z]),
  finish: lineAt(POINTS, 3, W),
  checkpoints: [0.3, 0.55, 0.8].map((f) => lineAt(POINTS, at(f), W)),
  finishIndex: 3,
};
export const DISPENSER = { x: 0.6, z: 9.6, spawn: { x: 0.6, z: 7.0, a: Math.PI / 2 } };
export const SELECTOR = { x: -4.0, z: 9.6 };
const clear = clearOf(POINTS, W, 0.15);
// On the outside of every sharp bend at ground level, a stack of tyres every metre or so.
const TYRES = [];
for (let i = 0; i < POINTS.length; i += 2) {
  if (POINTS[i][2] > 0.05 || bend(POINTS, i) < 0.28) continue;
  const [x, z] = outside(POINTS, i, W / 2 + 0.75);
  if (clear(x, z, 0.38) && Math.abs(x) < 13.9 && TYRES.every((t) => Math.hypot(t.x - x, t.z - z) > 0.8))
    TYRES.push({ kind: "tyres", x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, shape: "cylinder", radius: 0.38, w: 0.76, d: 0.76, h: 0.75 });
}
for (const [x, z, r] of [[0.6, -0.6, 0.55], [-3.6, -4.6, 0.55], [-3.4, 3.8, 0.55]]) if (clear(x, z, r)) TYRES.push({ kind: "tyres", x, z, shape: "cylinder", radius: r, w: r * 2, d: r * 2, h: 0.75 });

export default {
  id: "race-gp",
  kartTrack: true,
  camZoom: 1.35,
  backdrop: "speedway",
  title: "Гран-при",
  description: "Петля с мостом над собой, очень резкая шпилька, связки",
  color: "#2f6fd8",
  theme: {
    texture: "turf",
    tint: "#cfe0b8",
    side: "#3c4a2c",
    grid: "#ffffff",
    gridOpacity: 0,
    background: "#12151b",
    hemi: ["#f2f6ff", "#3a4532", 2.2],
    key: ["#fff4e2", 3.7],
    rim: ["#b8d0ff", 1.3],
    frame: "#5b616e",
  },
  track: TRACK,
  roadPoints: POINTS,
  dispensers: [DISPENSER],
  selectors: [SELECTOR],
  spawn: [
    { x0: -8.4, x1: -6.0, z0: 8.9, z1: 9.9 },
    { x0: 3.0, x1: 6.0, z0: 8.9, z1: 9.9 },
  ],
  statics: [
    // The loop and the bridge: you drive under it on the way up.
    ...raisedPaths(POINTS, W, { kind: "road", solid: false, walls: true, style: "bridge" }),
    // Tyre walls round the outside of the sharp bends at floor level, stacks inside the loop.
    ...TYRES,
    { kind: "board", x: 6.7, z: -3.6, w: 2.4, d: 0.45, h: 2.5 },
    { kind: "start-lights", x: POINTS[3][0], z: POINTS[3][1] - W / 2 - 0.5, shape: "cylinder", radius: 0.1, w: 0.2, d: 0.2, h: 2.4 },
  ],
  props: [
    { id: "dispenser", kind: "kart-dispenser", label: "Выдача картов — нажмите E рядом", x: DISPENSER.x, z: DISPENSER.z, colliders: [{ x: 0, z: 0, w: 1.6, d: 0.7, h: 2.1 }] },
    { id: "selector", kind: "track-selector", label: "Выбор трассы — нажмите E рядом", x: SELECTOR.x, z: SELECTOR.z, colliders: [{ x: 0, z: 0, w: 1.3, d: 0.7, h: 2.0 }] },
  ],
  balls: [
    ...[
      [-3.2, -6.6],
      [-2.2, -6.6],
      [5.8, -5.6],
    ].map(([x, z], i) => ({ id: "cone-" + i, kind: "cone", x, z })),
  ],
  cubes: [],
};
