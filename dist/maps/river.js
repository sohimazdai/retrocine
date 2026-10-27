// Горная река: течёт от экрана к зрителю между крутыми каменистыми берегами. Камни, мелкие и
// крупные, сносит течением; уплывший за край камень появляется у другого края.
export const WATER = { x0: -4.6, x1: 4.6 };
const BEACH = 7.4;

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
// Terraced cliffs on both banks: three ledges climbing to the edge of the room, cut into uneven
// blocks along the river so they read as rock rather than steps.
export function cliffs(seed = 4111) {
  const random = rng(seed),
    out = [];
  const tiers = [
    { from: BEACH, to: 9.5, h: 0.8 },
    { from: 9.5, to: 11.7, h: 1.75 },
    { from: 11.7, to: 15.2, h: 2.8 },
  ];
  for (const side of [-1, 1])
    tiers.forEach((tier, i) => {
      let z = -13;
      while (z < 10.6) {
        const d = 2.2 + random() * 2.2,
          inset = (random() - 0.35) * 0.7 * (i < 2 ? 1 : 0.4),
          h = tier.h + (random() - 0.5) * 0.35;
        const from = tier.from + inset,
          w = tier.to - from + (i < 2 ? 0.25 : 0);
        out.push({ kind: "cliff", tier: i, x: side * (from + w / 2), z: z + d / 2, w, d: d + 0.02, h: Math.round(h * 100) / 100 });
        z += d;
      }
    });
  return out;
}
const BOULDERS = [
  [-2.3, -5.6, 0.95, 0.85],
  [1.9, -2.0, 1.15, 1.05],
  [-1.2, 1.8, 0.7, 0.6],
  [3.0, 4.6, 0.8, 0.7],
  [0.6, -8.8, 1.0, 0.9],
  [-3.6, -1.2, 0.55, 0.5],
];
// Stepping stones across the river: wide gaps, so even a boulder floats through.
const STEPPING = [-3.3, -1.1, 1.1, 3.3].map((x, i) => [x, 7.5 + (i % 2) * 0.4, 0.45, 0.3]);
export const RIVER_ZONE = { id: "water", kind: "water", x0: WATER.x0, x1: WATER.x1, z0: -14, z1: 12, flow: { x: 0, z: 1.6 }, drag: 4, depth: 0.55, wrap: "z", slow: 0.62, drift: 0.55 };

export default {
  id: "river",
  title: "Горная река",
  description: "Течение, крутые берега и камни, которые уносит водой",
  color: "#4f8fa8",
  theme: {
    texture: "gravel",
    side: "#4a463f",
    grid: "#ffffff",
    gridOpacity: 0,
    background: "#141b22",
    hemi: ["#e8f4ff", "#3b4237", 2.1],
    key: ["#fff3e0", 3.5],
    rim: ["#9fd0ff", 1.3],
    frame: "#5d6a72",
  },
  spawn: [
    { x0: -6.9, x1: -5.2, z0: 2, z1: 7.5 },
    { x0: 5.2, x1: 6.9, z0: 2, z1: 7.5 },
  ],
  zones: [RIVER_ZONE],
  statics: [
    ...cliffs(),
    ...[...BOULDERS, ...STEPPING].map(([x, z, r, h]) => ({ kind: "boulder", x, z, shape: "cylinder", radius: r, w: r * 2, d: r * 2, h })),
  ],
  props: [],
  balls: [
    { id: "stone-1", kind: "stone", x: -1.5, z: -9.5 },
    { id: "stone-2", kind: "stone", x: 2.6, z: -6.5 },
    { id: "stone-3", kind: "stone", x: -0.4, z: -3.5 },
    { id: "stone-4", kind: "stone", x: 3.8, z: 1.5 },
    { id: "pebble-1", kind: "pebble", x: -2.6, z: -7.8 },
    { id: "pebble-2", kind: "pebble", x: 0.4, z: 0.4 },
    { id: "pebble-3", kind: "pebble", x: -3.2, z: 4.4 },
    { id: "pebble-4", kind: "pebble", x: 1.2, z: 5.6 },
    { id: "boulder-1", kind: "boulder", x: -0.2, z: -6.4 },
    { id: "boulder-2", kind: "boulder", x: 0.9, z: 3.0 },
    { id: "beach-stone", kind: "stone", x: -6.2, z: -2.5 },
    { id: "beach-pebble", kind: "pebble", x: 6.0, z: 0.5 },
  ],
  cubes: [],
};
