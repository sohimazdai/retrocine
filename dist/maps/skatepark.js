// Скейтпарк: две рампы-четвертинки по краям, фанбокс с перилами в центре, кикеры, перила,
// бэнк с площадкой, мэнуал-пад. Скейты, самокаты и BMX — садитесь (E) и катайтесь.
export const PIPE = { w: 2.6, h: 2.2, z0: -6.4, z1: 6.4 };
const pipe = (side) => ({
  kind: "pipe",
  shape: "qpipe",
  x: side * (14.2 - PIPE.w / 2),
  z: (PIPE.z0 + PIPE.z1) / 2,
  w: PIPE.w,
  d: PIPE.z1 - PIPE.z0,
  h: PIPE.h,
  axis: "x",
  dir: side,
});
const FUNBOX = { x: 0, z: -2.6, w: 3.6, d: 3.2, h: 0.9 };
const BANK = { x: 6.6, z: -6.9, w: 4.2, d: 2.4, h: 1.2 };

export default {
  id: "skatepark",
  backdrop: "city",
  title: "Скейтпарк",
  description: "Рампы, фанбокс, перила; скейты, самокаты и BMX с трюками",
  color: "#8a8f98",
  theme: {
    texture: "concrete",
    tint: "#d6d3ce",
    side: "#55585e",
    grid: "#ffffff",
    gridOpacity: 0,
    background: "#16181d",
    hemi: ["#f2f4ff", "#3c3f48", 2.2],
    key: ["#fff6e6", 3.7],
    rim: ["#9fb8ff", 1.3],
    frame: "#6b7080",
  },
  spawn: { x0: -2, x1: 2, z0: 7.2, z1: 8.4 },
  statics: [
    pipe(-1),
    pipe(1),
    // Decks behind the pipes' lips.
    ...[-1, 1].map((side) => ({ kind: "deck", x: side * 14.45, z: (PIPE.z0 + PIPE.z1) / 2, w: 0.5, d: PIPE.z1 - PIPE.z0, h: PIPE.h })),
    // Funbox: ramps up from both sides, a flat top and a rail along it.
    { kind: "box", ...FUNBOX },
    { kind: "ramp", shape: "ramp", x: FUNBOX.x - FUNBOX.w / 2 - 1.2, z: FUNBOX.z, w: 2.4, d: FUNBOX.d, h0: 0, h1: FUNBOX.h, h: FUNBOX.h, axis: "x" },
    { kind: "ramp", shape: "ramp", x: FUNBOX.x + FUNBOX.w / 2 + 1.2, z: FUNBOX.z, w: 2.4, d: FUNBOX.d, h0: FUNBOX.h, h1: 0, h: FUNBOX.h, axis: "x" },
    { kind: "rail", rail: true, x: FUNBOX.x, z: FUNBOX.z - 0.8, w: 3.2, d: 0.08, y: FUNBOX.h, h: FUNBOX.h + 0.34 },
    // Kickers: ride toward the screen and fly.
    ...[-1, 1].map((side) => ({ kind: "kicker", shape: "ramp", x: side * 6.4, z: 3.4, w: 2.2, d: 2.0, h0: 0.75, h1: 0, h: 0.75, axis: "z" })),
    // A flat rail and a low manual pad.
    { kind: "rail", rail: true, x: 0, z: 5.9, w: 5.0, d: 0.08, h: 0.45 },
    { kind: "pad", x: -6.6, z: -6.4, w: 3.4, d: 1.5, h: 0.3 },
    // Bank up to a platform at the back.
    { kind: "ramp", shape: "ramp", x: BANK.x, z: BANK.z + BANK.d / 2, w: BANK.w, d: BANK.d, h0: BANK.h, h1: 0, h: BANK.h, axis: "z" },
    { kind: "box", x: BANK.x, z: BANK.z - 0.9, w: BANK.w, d: 1.8, h: BANK.h },
    // Tall chain-link behind the pipes, and a ledge to grind in each front corner.
    ...[-1, 1].map((side) => ({ kind: "fence", style: "chain", x: side * 14.62, z: 1.3, w: 0.06, d: 17.8, h: 3.4, color: "#55606b" })),
    ...[-1, 1].map((side) => ({ kind: "ledge", rail: true, x: side * 13.2, z: 8.8, w: 0.5, d: 1.8, h: 0.45 })),
  ],
  props: [
    { id: "bench-a", kind: "bench", label: "Скамейка", x: -9.6, z: 8.9, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 2.2, d: 0.7, h: 0.5 }], waypoints: [{ x: 0, z: 0, h: 0.5 }] },
    { id: "bench-b", kind: "bench", label: "Скамейка", x: 9.6, z: 8.9, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 2.2, d: 0.7, h: 0.5 }], waypoints: [{ x: 0, z: 0, h: 0.5 }] },
  ],
  rides: [
    { id: "board-1", kind: "skateboard", x: -4.4, z: 7.0, a: Math.PI },
    { id: "board-2", kind: "skateboard", x: -3.2, z: 7.4, a: Math.PI },
    { id: "scooter-1", kind: "scooter", x: 3.2, z: 7.4, a: Math.PI },
    { id: "scooter-2", kind: "scooter", x: 4.4, z: 7.0, a: Math.PI },
    { id: "bike-1", kind: "bike", x: -7.6, z: 6.8, a: Math.PI },
    { id: "bike-2", kind: "bike", x: 7.6, z: 6.8, a: Math.PI },
  ],
  balls: [
    { id: "cone-1", kind: "cone", x: -2.4, z: 2.0 },
    { id: "cone-2", kind: "cone", x: 2.4, z: 2.0 },
    { id: "cone-3", kind: "cone", x: 0, z: 1.2 },
  ],
  cubes: [],
};
