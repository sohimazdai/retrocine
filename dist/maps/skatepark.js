// Скейтпарк, устроенный как настоящий: поле в полтора раза больше обычной комнаты, по краям две
// большие рампы-четвертинки, между ними — свободная «линия» во всю ширину: ничего поперёк пути, а
// вдоль неё — перила, лавка-ледж и мэнуал-пад, чтобы слайдить на ходу. Сзади — мини-рампа, бэнк на
// площадку с перилами и фанбокс; спереди — стойка с досками, низкий ледж и пологий фанбокс.
// Скейты, самокаты и BMX — садитесь (E) и катайтесь.
const S = 1.5;
export const SCALE = S;
const EDGE = 14.7 * S;
// The far edge of the floor at x (the wall is a cylinder, see layout.js).
const back = (x) => (-12 + Math.sqrt(26 ** 2 - 1.6 ** 2)) * S - Math.sqrt((26 * S) ** 2 - x * x);

export const PIPE = { w: 3.4, h: 2.6, z0: -9, z1: 9 };
const pipe = (side) => ({
  kind: "pipe",
  shape: "qpipe",
  x: side * (EDGE - 0.4 - PIPE.w / 2),
  z: (PIPE.z0 + PIPE.z1) / 2,
  w: PIPE.w,
  d: PIPE.z1 - PIPE.z0,
  h: PIPE.h,
  axis: "x",
  dir: side,
});
// The mini ramp at the back: two small quarter pipes facing each other over a flat bottom.
export const MINI = { z: -12.3, d: 4.6, h: 1.4, w: 2.2, flat: 4.0 };
const mini = (side) => [
  { kind: "pipe", shape: "qpipe", x: side * (MINI.flat / 2 + MINI.w / 2), z: MINI.z, w: MINI.w, d: MINI.d, h: MINI.h, axis: "x", dir: side, small: true },
  { kind: "deck", x: side * (MINI.flat / 2 + MINI.w + 0.5), z: MINI.z, w: 1.0, d: MINI.d, h: MINI.h },
];
// A raised platform reached by a mellow bank from the front, with a rail on it.
const PLATFORM = { x: -12, z: -13.0, w: 7, d: 2.6, h: 1.2 };
// Funboxes: a flat top with gentle ramps up and down along x (the way you ride), a rail on top.
function funbox(x, z, w, d, h, run) {
  return [
    { kind: "box", x, z, w, d, h },
    { kind: "ramp", shape: "ramp", x: x - w / 2 - run / 2, z, w: run, d, h0: 0, h1: h, h, axis: "x" },
    { kind: "ramp", shape: "ramp", x: x + w / 2 + run / 2, z, w: run, d, h0: h, h1: 0, h, axis: "x" },
    { kind: "rail", rail: true, x, z, w: w - 0.4, d: 0.08, y: h, h: h + 0.36 },
  ];
}
const rail = (x, z, w, h = 0.45) => ({ kind: "rail", rail: true, x, z, w, d: 0.08, h });
const ledge = (x, z, w, d = 0.55, h = 0.45) => ({ kind: "ledge", rail: true, x, z, w, d, h });

export default {
  id: "skatepark",
  scale: S,
  backdrop: "city",
  title: "Скейтпарк",
  description: "Большое поле: рампы по краям, свободная линия с перилами и леджами, мини-рампа, бэнк, фанбоксы",
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
  spawn: { x0: -3, x1: 3, z0: 12.6, z1: 14.2 },
  statics: [
    // Transition: the two big quarter pipes with a deck behind each.
    pipe(-1),
    pipe(1),
    ...[-1, 1].map((side) => ({ kind: "deck", x: side * (EDGE - 0.2), z: (PIPE.z0 + PIPE.z1) / 2, w: 0.4, d: PIPE.z1 - PIPE.z0, h: PIPE.h })),
    ...mini(-1),
    ...mini(1),
    // Along the line between the pipes (never across it): a long flat rail and a ledge behind it,
    // a manual pad and another rail in front.
    rail(-6.5, -6.6, 7),
    ledge(7, -6.6, 6),
    { kind: "pad", x: -7.5, z: 6.7, w: 6, d: 1.8, h: 0.28 },
    rail(7.5, 6.7, 6),
    // Back left: a mellow bank up onto a platform with a rail along it.
    { kind: "box", ...PLATFORM },
    { kind: "ramp", shape: "ramp", x: PLATFORM.x, z: PLATFORM.z + PLATFORM.d / 2 + 1.5, w: PLATFORM.w, d: 3.0, h0: PLATFORM.h, h1: 0, h: PLATFORM.h, axis: "z" },
    { kind: "rail", rail: true, x: PLATFORM.x, z: PLATFORM.z - 0.5, w: 5, d: 0.08, y: PLATFORM.h, h: PLATFORM.h + 0.4 },
    // Back right: a funbox with a rail on top.
    ...funbox(12.2, -12.2, 3.4, 3.0, 0.8, 2.8),
    // Front: a low ledge on the left and a gentle funbox on the right.
    ledge(-12.5, 11.4, 5),
    ...funbox(12.6, 11.4, 2.4, 2.4, 0.6, 2.4),
    // Around the edges: tall chain-link behind the pipes, graffiti walls in the back corners, light
    // poles, planters with trees.
    ...[-1, 1].map((side) => ({ kind: "fence", style: "chain", x: side * (EDGE - 0.03), z: (back(EDGE) + 10.3 * S) / 2, w: 0.06, d: 10.3 * S - back(EDGE), h: 3.6, color: "#55606b" })),
    ...[-1, 1].map((side) => ({ kind: "graffiti-wall", side, x: side * 19.2, z: -11.0, w: 4.4, d: 0.4, h: 2.4 })),
    ...[
      [-16.9, -9.6],
      [16.9, -9.6],
      [-17.4, 12.2],
      [17.4, 12.2],
    ].map(([x, z]) => ({ kind: "pole", x, z, shape: "cylinder", radius: 0.14, w: 0.28, d: 0.28, h: 6.4 })),
    ...[
      [-7.8, 13.6],
      [7.8, 13.6],
      [-4.4, -16.2],
      [4.4, -16.2],
    ].map(([x, z]) => ({ kind: "planter", x, z, shape: "cylinder", radius: 0.75, w: 1.5, d: 1.5, h: 0.55 })),
    { kind: "rack", x: 0, z: 10.9, w: 7.6, d: 0.3, h: 0.2 },
  ],
  props: [
    { id: "bench-a", kind: "bench", label: "Скамейка", x: -19.6, z: 12.4, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 2.2, d: 0.7, h: 0.5 }], waypoints: [{ x: 0, z: 0, h: 0.5 }] },
    { id: "bench-b", kind: "bench", label: "Скамейка", x: 19.6, z: 12.4, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 2.2, d: 0.7, h: 0.5 }], waypoints: [{ x: 0, z: 0, h: 0.5 }] },
    { id: "bench-c", kind: "bench", label: "Скамейка", x: -4.6, z: 14.2, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 2.2, d: 0.7, h: 0.5 }], waypoints: [{ x: 0, z: 0, h: 0.5 }] },
  ],
  rides: [
    { id: "board-1", kind: "skateboard", x: -3.0, z: 11.6, a: Math.PI },
    { id: "board-2", kind: "skateboard", x: -1.8, z: 11.6, a: Math.PI },
    { id: "board-3", kind: "skateboard", x: -0.6, z: 11.6, a: Math.PI },
    { id: "scooter-1", kind: "scooter", x: 0.6, z: 11.6, a: Math.PI },
    { id: "scooter-2", kind: "scooter", x: 1.8, z: 11.6, a: Math.PI },
    { id: "bike-1", kind: "bike", x: 3.0, z: 11.6, a: Math.PI },
    { id: "bike-2", kind: "bike", x: 4.2, z: 11.6, a: Math.PI },
  ],
  balls: [
    { id: "cone-1", kind: "cone", x: -10.6, z: 9.2 },
    { id: "cone-2", kind: "cone", x: -7.6, z: 9.2 },
    { id: "cone-3", kind: "cone", x: -4.6, z: 9.2 },
  ],
  cubes: [],
};
