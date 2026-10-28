// Картинг: кольцевая трасса с бортами и шинами на поворотах, горбом на задней прямой и табло
// лучших кругов. Карт выдаёт автомат в боксах (E): садитесь и едете; вышли — карт исчезает.
// Круг засчитывается, если проехать все отметки по порядку.
const R = 3.2,
  W = 4.2;
// Centreline: a rounded rectangle driven anticlockwise as seen from above — left to right along the
// front straight, away from you on the right, right to left at the back, toward you on the left.
const CORNERS = [
  { cx: 8, cz: 2.8, from: 90, to: 0 },
  { cx: 8, cz: -2.4, from: 0, to: -90 },
  { cx: -8, cz: -2.4, from: -90, to: -180 },
  { cx: -8, cz: 2.8, from: 180, to: 90 },
];
function centreline() {
  const pts = [];
  for (const c of CORNERS)
    for (let i = 0; i <= 8; i++) {
      const a = ((c.from + ((c.to - c.from) * i) / 8) * Math.PI) / 180;
      pts.push([Math.round((c.cx + R * Math.cos(a)) * 1000) / 1000, Math.round((c.cz + R * Math.sin(a)) * 1000) / 1000]);
    }
  return pts;
}
export const TRACK = {
  width: W,
  points: centreline(),
  corners: CORNERS,
  radius: R,
  finish: { from: [-3, 6 - W / 2], to: [-3, 6 + W / 2] },
  checkpoints: [
    { from: [11.2 - W / 2, 0], to: [11.2 + W / 2, 0] },
    { from: [0, -5.6 + W / 2], to: [0, -5.6 - W / 2] },
    { from: [-11.2 + W / 2, 0], to: [-11.2 - W / 2, 0] },
  ],
};
const OUT = W / 2 + 0.3;
// Tyre stacks along the outside of every corner.
function cornerTyres() {
  const out = [],
    r = R + W / 2 + 0.45;
  for (const c of CORNERS)
    for (let i = 0; i <= 11; i++) {
      const a = ((c.from + ((c.to - c.from) * i) / 11) * Math.PI) / 180;
      out.push({ kind: "tyres", x: c.cx + r * Math.cos(a), z: c.cz + r * Math.sin(a), shape: "cylinder", radius: 0.38, w: 0.76, d: 0.76, h: 0.75 });
    }
  return out;
}
export const DISPENSER = { x: 0, z: 9.55, spawn: { x: 0, z: 6.7, a: Math.PI / 2 } };
export const SELECTOR = { x: -6.2, z: 9.55 };
const HUMP = { x: 0, z: -5.6, d: W, h: 0.45, len: 1.6 };

export default {
  id: "race",
  kartTrack: true,
  backdrop: "speedway",
  title: "Картинг",
  description: "Трасса, карты из автомата, горб для прыжка и табло лучших кругов",
  color: "#d8432f",
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
  dispensers: [DISPENSER],
  selectors: [SELECTOR],
  spawn: [
    { x0: -4.4, x1: -1.6, z0: 8.9, z1: 9.9 },
    { x0: 1.6, x1: 4.4, z0: 8.9, z1: 9.9 },
  ],
  statics: [
    // Outer walls along the straights; the front one is the pit wall with a gap at the karts.
    { kind: "wall", x: 0, z: -5.6 - OUT, w: 16, d: 0.3, h: 0.7 },
    ...[-1, 1].map((s) => ({ kind: "wall", x: s * (11.2 + OUT), z: 0.2, w: 0.3, d: 5.2, h: 0.7 })),
    ...[-1, 1].map((s) => ({ kind: "pit-wall", x: s * 5.3, z: 6 + OUT, w: 5.4, d: 0.3, h: 0.55 })),
    ...cornerTyres(),
    // Tyre stacks in the middle of each corner, and the timing board in the infield.
    ...CORNERS.map((c) => ({ kind: "tyres", x: c.cx, z: c.cz, shape: "cylinder", radius: 0.55, w: 1.1, d: 1.1, h: 0.75 })),
    { kind: "board", x: 0, z: 0.4, w: 3.2, d: 0.5, h: 2.6 },
    // A hump on the back straight: up and down again — at speed a little jump.
    { kind: "hump", shape: "ramp", x: HUMP.x + HUMP.len / 2, z: HUMP.z, w: HUMP.len, d: HUMP.d, h0: HUMP.h, h1: 0, h: HUMP.h, axis: "x" },
    { kind: "hump", shape: "ramp", x: HUMP.x - HUMP.len / 2, z: HUMP.z, w: HUMP.len, d: HUMP.d, h0: 0, h1: HUMP.h, h: HUMP.h, axis: "x" },
    // Start lights on a pole by the inside of the start line.
    { kind: "start-lights", x: -3, z: 6 - W / 2 - 0.45, shape: "cylinder", radius: 0.1, w: 0.2, d: 0.2, h: 2.4 },
  ],
  props: [
    { id: "dispenser", kind: "kart-dispenser", label: "Выдача картов — нажмите E рядом", x: DISPENSER.x, z: DISPENSER.z, colliders: [{ x: 0, z: 0, w: 1.6, d: 0.7, h: 2.1 }] },
    { id: "selector", kind: "track-selector", label: "Выбор трассы — нажмите E рядом", x: SELECTOR.x, z: SELECTOR.z, colliders: [{ x: 0, z: 0, w: 1.3, d: 0.7, h: 2.0 }] },
  ],
  balls: [
    ...[
      [-6, 2.6],
      [-4.4, 2.6],
      [4.4, 2.6],
      [6, 2.6],
      [-5.2, -2.2],
      [5.2, -2.2],
    ].map(([x, z], i) => ({ id: "cone-" + i, kind: "cone", x, z })),
  ],
  cubes: [],
};
