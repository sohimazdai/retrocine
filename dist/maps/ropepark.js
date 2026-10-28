// Верёвочный парк: площадки на деревьях, мостик и бревно между ними, канаты, сетка, скалодром,
// батуты, чтобы допрыгнуть до площадки, и два троллея вниз. По стволам можно залезть через люк.
// Высокое стоит по краям: середина перед экраном остаётся низкой, чтобы не закрывать видео.
const P = {
  a: { x: -8.6, z: -3.6, w: 3.2, d: 3.2, top: 2.8 },
  b: { x: -2.0, z: -3.6, w: 3.0, d: 3.0, top: 2.8 },
  c: { x: -12.4, z: -6.6, w: 3.0, d: 2.6, top: 3.8 },
  d: { x: 6.5, z: -3.6, w: 3.2, d: 3.2, top: 2.8 },
  e: { x: 11.0, z: 5.1, w: 3.0, d: 2.8, top: 1.0 },
  f: { x: -11.2, z: 5.1, w: 3.0, d: 2.8, top: 1.0 },
};
export const PLATFORMS = P;
// The middle platform stands on posts: a crown there would cover the screen.
const TREES = { a: 5.6, c: 6.4, d: 5.4 };
const platform = (id, p) => ({ kind: "platform", id, x: p.x, z: p.z, w: p.w, d: p.d, y: p.top - 0.15, h: p.top });
const posts = (p, skip = []) =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]
    .filter((_, i) => !skip.includes(i))
    .map(([sx, sz]) => ({ kind: "post", x: p.x + sx * (p.w / 2 - 0.12), z: p.z + sz * (p.d / 2 - 0.12), w: 0.16, d: 0.16, h: p.top - 0.15 }));
// Stairs down from the low landing platforms toward the front.
const steps = (p) => ({ kind: "stairs", shape: "ramp", x: p.x, z: p.z + p.d / 2 + 1.0, w: 1.4, d: 2.0, h0: p.top, h1: 0, h: p.top, axis: "z" });
const TOWER = { x: -5.6, z: 4.8, w: 2.4, d: 2.4, h: 2.6 };
// Along the sides: a tall bouldering wall with a crash mat at its foot, and a spider web of rope.
export const BIG_WALL = { x: 14.0, z: -0.2, w: 1.3, d: 4.0, h: 4.2 };
export const WEB = { x: -14.25, z: 0.6, w: 0.5, d: 3.6, h: 3.6 };
const NET = { x: P.d.x + P.d.w / 2 + 0.04, z: P.d.z, w: 0.06, d: P.d.d - 0.4, h: P.d.top - 0.15 };

// You hang 1.95 m below the cable; at the start it lifts you a little off the platform.
export const ZIPS = [
  { id: "zip-d", kind: "zip", from: [P.d.x + 0.6, P.d.top + 2.3, P.d.z + 1.2], to: [P.e.x, P.e.top + 1.95, P.e.z - 0.4] },
  { id: "zip-c", kind: "zip", from: [P.c.x - 0.6, P.c.top + 2.3, P.c.z + 0.8], to: [P.f.x + 0.2, P.f.top + 1.95, P.f.z - 0.3] },
];

export default {
  id: "ropepark",
  title: "Верёвочный парк",
  description: "Площадки на деревьях, канаты, сетка, скалодром, батуты и троллеи",
  color: "#5f8f4e",
  theme: {
    texture: "turf",
    tint: "#d8e6c8",
    side: "#3c4a2c",
    grid: "#ffffff",
    gridOpacity: 0,
    background: "#121a14",
    hemi: ["#f0ffe8", "#33452c", 2.1],
    key: ["#fff0d0", 3.5],
    rim: ["#c8f0a8", 1.2],
    frame: "#55704a",
  },
  spawn: { x0: -2.5, x1: 2.5, z0: 6.6, z1: 8.6 },
  statics: [
    ...Object.entries(TREES).map(([k, h]) => ({ kind: "tree", x: P[k].x, z: P[k].z, shape: "cylinder", radius: 0.42, w: 0.84, d: 0.84, h })),
    ...Object.entries(P).map(([id, p]) => platform(id, p)),
    ...posts(P.a),
    ...posts(P.b),
    ...posts(P.c),
    ...posts(P.d),
    ...posts(P.e),
    ...posts(P.f),
    // A plank bridge from a to b and a balance beam from b to d.
    { kind: "bridge", x: (P.a.x + P.a.w / 2 + P.b.x - P.b.w / 2) / 2, z: P.a.z, w: P.b.x - P.b.w / 2 - (P.a.x + P.a.w / 2), d: 0.8, y: P.a.top - 0.12, h: P.a.top },
    { kind: "beam", x: (P.b.x + P.b.w / 2 + P.d.x - P.d.w / 2) / 2, z: P.b.z, w: P.d.x - P.d.w / 2 - (P.b.x + P.b.w / 2), d: 0.36, y: P.b.top - 0.18, h: P.b.top },
    { kind: "tower", ...TOWER },
    { kind: "net", ...NET },
    steps(P.e),
    steps(P.f),
    { kind: "trampoline", x: P.a.x, z: P.a.z + P.a.d / 2 + 1.5, shape: "cylinder", radius: 1.3, w: 2.6, d: 2.6, h: 0.6, bounce: 14.5 },
    { kind: "trampoline", x: 3.0, z: 2.4, shape: "cylinder", radius: 1.4, w: 2.8, d: 2.8, h: 0.6, bounce: 15 },
    { kind: "bigwall", ...BIG_WALL },
    { kind: "mat", x: BIG_WALL.x - BIG_WALL.w / 2 - 0.75, z: BIG_WALL.z, w: 1.5, d: BIG_WALL.d, h: 0.32, soft: 0.25 },
    { kind: "web", ...WEB },
  ],
  climbs: [
    ...Object.entries(TREES).map(([k]) => ({ id: "trunk-" + k, kind: "trunk", x: P[k].x, z: P[k].z, r: 0.42, y0: 0, y1: P[k].top })),
    { id: "rope-c", kind: "rope", x: P.c.x, z: P.c.z + P.c.d / 2 + 0.4, y0: 0.2, y1: P.c.top + 1.0 },
    { id: "rope-beam", kind: "rope", x: 2.2, z: P.b.z + 0.55, y0: 0.2, y1: P.b.top + 1.0 },
    { id: "tower-front", kind: "wall", ...TOWER, y0: 0, y1: TOWER.h, face: "+z" },
    { id: "tower-side", kind: "wall", ...TOWER, y0: 0, y1: TOWER.h, face: "+x" },
    { id: "net-d", kind: "net", ...NET, y0: 0, y1: P.d.top, face: "+x" },
    { id: "big-wall", kind: "wall", ...BIG_WALL, y0: 0, y1: BIG_WALL.h, face: "-x" },
    { id: "web", kind: "net", ...WEB, y0: 0, y1: WEB.h, face: "+x" },
    ...ZIPS,
  ],
  props: [],
  balls: [{ id: "ball", kind: "playball", x: -1.2, z: 3.2, color: "#f2c14e" }],
  cubes: [],
};
