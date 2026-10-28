// Зелёный лабиринт: живая изгородь, в центре многоярусный фонтан со статуей минотавра.
// The maze is generated from a fixed seed, so the server and every browser build the same walls.
// Hedges look waist-high but their colliders are tall, so nobody jumps from the garden wall across them.
export const MAZE = { cols: 9, rows: 7, cell: { w: 2.8, d: 2.4 }, x0: -12.6, z0: -7.9, thickness: 0.6, height: 6, visible: 1.25 };
// Old garden walls along both sides, with a walkway on top and trellises of ivy to climb up.
export const GARDEN_WALL = { w: 0.9, z0: -7.5, z1: 9.8, h: 2.6 };
const wallX = (side) => side * (14.65 - GARDEN_WALL.w / 2);
const CLEARING = { c0: 3, c1: 5, r0: 2, r1: 4 };
export const FOUNTAIN = { x: 0, z: MAZE.z0 + (CLEARING.r0 + CLEARING.r1 + 1) * MAZE.cell.d * 0.5 };

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const inClearing = (c, r) => c >= CLEARING.c0 && c <= CLEARING.c1 && r >= CLEARING.r0 && r <= CLEARING.r1;
// Walls between cells: east[r][c] — between (c, r) and (c+1, r); south[r][c] — between (c, r) and (c, r+1).
export function carve(seed = 20261028) {
  const { cols, rows } = MAZE,
    random = rng(seed);
  const east = Array.from({ length: rows }, () => Array(cols).fill(true)),
    south = Array.from({ length: rows }, () => Array(cols).fill(true));
  const open = (c, r, c2, r2) => {
    if (c2 === c + 1) east[r][c] = false;
    else if (c2 === c - 1) east[r][c2] = false;
    else if (r2 === r + 1) south[r][c] = false;
    else south[r2][c] = false;
  };
  // The clearing around the fountain is one open room.
  for (let r = CLEARING.r0; r <= CLEARING.r1; r++)
    for (let c = CLEARING.c0; c <= CLEARING.c1; c++) {
      if (c < CLEARING.c1) open(c, r, c + 1, r);
      if (r < CLEARING.r1) open(c, r, c, r + 1);
    }
  // Recursive backtracker over the rest, starting from the front entrance.
  const seen = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => inClearing(c, r)));
  const stack = [[Math.floor(cols / 2), rows - 1]];
  seen[rows - 1][Math.floor(cols / 2)] = true;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const next = [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ].filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows && !seen[y][x]);
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [x, y] = next[Math.floor(random() * next.length)];
    open(c, r, x, y);
    seen[y][x] = true;
    stack.push([x, y]);
  }
  // A doorway on every side of the clearing, and a few loops so you can be chased round.
  const mid = { c: (CLEARING.c0 + CLEARING.c1) / 2, r: (CLEARING.r0 + CLEARING.r1) / 2 };
  open(CLEARING.c0 - 1, mid.r, CLEARING.c0, mid.r);
  open(CLEARING.c1, mid.r, CLEARING.c1 + 1, mid.r);
  open(mid.c, CLEARING.r0 - 1, mid.c, CLEARING.r0);
  open(mid.c, CLEARING.r1, mid.c, CLEARING.r1 + 1);
  let loops = 0;
  while (loops < 9) {
    const c = Math.floor(random() * (cols - 1)),
      r = Math.floor(random() * (rows - 1));
    if (inClearing(c, r)) continue;
    if (random() < 0.5 && east[r][c]) {
      east[r][c] = false;
      loops++;
    } else if (south[r][c]) {
      south[r][c] = false;
      loops++;
    }
  }
  return { east, south };
}

// Hedge colliders: runs of wall merged into long boxes, with gaps for the entrances.
export function hedges(seed) {
  const { cols, rows, cell, x0, z0, thickness: t, height: h, visible } = MAZE,
    { east, south } = carve(seed);
  const xAt = (c) => x0 + c * cell.w,
    zAt = (r) => z0 + r * cell.d;
  const out = [];
  const run = (horizontal, fixed, from, to) => {
    if (to <= from) return;
    if (horizontal) out.push({ kind: "hedge", x: (xAt(from) + xAt(to)) / 2, z: zAt(fixed), w: xAt(to) - xAt(from) + t, d: t, h, vh: visible });
    else out.push({ kind: "hedge", x: xAt(fixed), z: (zAt(from) + zAt(to)) / 2, w: t, d: zAt(to) - zAt(from) + t, h, vh: visible });
  };
  // Horizontal lines r = 0..rows; the outer ones have entrances.
  const entrances = { top: new Set([1, cols - 2]), bottom: new Set([Math.floor(cols / 2)]) };
  for (let r = 0; r <= rows; r++) {
    let start = null;
    for (let c = 0; c <= cols; c++) {
      const wall = c < cols && (r === 0 ? !entrances.top.has(c) : r === rows ? !entrances.bottom.has(c) : south[r - 1][c]);
      if (wall && start === null) start = c;
      if (!wall && start !== null) {
        run(true, r, start, c);
        start = null;
      }
    }
  }
  const sides = new Set([Math.floor(rows / 2)]);
  for (let c = 0; c <= cols; c++) {
    let start = null;
    for (let r = 0; r <= rows; r++) {
      const wall = r < rows && (c === 0 || c === cols ? !sides.has(r) : east[r][c - 1]);
      if (wall && start === null) start = r;
      if (!wall && start !== null) {
        run(false, c, start, r);
        start = null;
      }
    }
  }
  return out;
}

const F = FOUNTAIN;
export default {
  id: "maze",
  backdrop: "garden",
  title: "Лабиринт",
  description: "Живая изгородь и фонтан с минотавром в центре",
  color: "#4f8a4a",
  theme: {
    texture: "grass",
    side: "#2f4a2a",
    grid: "#d9f2c8",
    gridOpacity: 0.05,
    background: "#132017",
    hemi: ["#f2fff0", "#2f4a2d", 2.0],
    key: ["#fff1d6", 3.4],
    rim: ["#b9e3a8", 1.1],
    frame: "#55704a",
  },
  spawn: { x0: -1.8, x1: 1.8, z0: F.z + 2.75, z1: F.z + 2.95 },
  statics: [
    ...hedges(),
    // The garden behind the maze and the corners in front of it.
    ...[-1, 1].map((side) => ({ kind: "garden-wall", side, x: wallX(side), z: (GARDEN_WALL.z0 + GARDEN_WALL.z1) / 2, w: GARDEN_WALL.w, d: GARDEN_WALL.z1 - GARDEN_WALL.z0, h: GARDEN_WALL.h })),
    ...[
      [-11.4, -9.4, 3.4],
      [-3.4, -10.6, 3.0],
      [3.4, -10.6, 3.2],
      [11.4, -9.4, 3.5],
    ].map(([x, z, h]) => ({ kind: "tree", x, z, shape: "cylinder", radius: 0.22, w: 0.44, d: 0.44, h })),
    ...[-9.2, 9.2].map((x) => ({ kind: "plinth", x, z: -9.3, w: 0.7, d: 0.7, h: 0.9 })),
  ],
  climbs: [-1, 1].flatMap((side) =>
    [-3.0, 5.4].map((z, i) => ({ id: `trellis-${side < 0 ? "l" : "r"}${i}`, kind: "wall", x: wallX(side), z, w: GARDEN_WALL.w, d: 1.3, y0: 0, y1: GARDEN_WALL.h, face: side < 0 ? "+x" : "-x" })),
  ),
  props: [
    {
      id: "fountain",
      kind: "fountain",
      label: "Фонтан с минотавром",
      x: F.x,
      z: F.z,
      colliders: [
        { x: 0, z: 0, shape: "cylinder", radius: 2.4, w: 4.8, d: 4.8, h: 0.6 },
        { x: 0, z: 0, shape: "cylinder", radius: 1.35, w: 2.7, d: 2.7, h: 1.35 },
        { x: 0, z: 0, shape: "cylinder", radius: 0.85, w: 1.7, d: 1.7, h: 2.1 },
        { x: 0, z: 0, shape: "cylinder", radius: 0.3, w: 0.6, d: 0.6, h: 4.15 },
      ],
      waypoints: [
        { x: 0, z: 2.0, h: 0.6 },
        { x: 0, z: 1.12, h: 1.35 },
        { x: 0, z: 0.7, h: 2.1 },
      ],
    },
    { id: "bench-a", kind: "bench", label: "Скамейка", x: -6.4, z: -10.0, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 2.2, d: 0.7, h: 0.5 }], waypoints: [{ x: 0, z: 0, h: 0.5 }] },
    { id: "bench-b", kind: "bench", label: "Скамейка", x: 6.4, z: -10.0, weight: 1, lift: 2, colliders: [{ x: 0, z: 0, w: 2.2, d: 0.7, h: 0.5 }], waypoints: [{ x: 0, z: 0, h: 0.5 }] },
  ],
  balls: [
    { id: "ball", kind: "playball", x: -2.7, z: F.z + 2.85, color: "#e8574f" },
    { id: "ball-2", kind: "playball", x: 9.8, z: 9.6, color: "#f2c14e" },
  ],
  cubes: [
    { x: 2.7, z: F.z + 2.85, color: "#a696ce" },
    { x: -0.2, z: -9.8, color: "#ccad87" },
  ],
};
