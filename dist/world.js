// Pure description of the room's props, shared by the browser and the sync server.
// No Three.js here: the server imports this file to run the same physics as the client.
import { clamp, inside } from "./physics.js";

// weight: how many avatars (Shift) it takes to push it; lift: how many, from opposite sides, to lift it.
export const BIG = { w: 2.8, d: 2.8, h: 1.65, weight: 2, lift: 3 };
export const BIG_DEFAULT = { x: 2.4, z: -1.1 };
export const BIG_BOUNDS = { x: 10, z: 7 };
export const STRUCTURE_BOUNDS = { x: 10.7, zMin: -6.2, zMax: 7.3 };
export const DRAG_BOUNDS = { x: 12, z: 8.5 };
export const MAX_NOTES = 80;
export const MAX_CUBES = 24;
export const NOTE_TYPES = ["good", "improve", "idea"];
export const CUBE_COLORS = ["#a696ce", "#ccad87", "#9bbbbb", "#c99ead"];
export const CUBE_SIZE = 0.65;

const tiers = Array.from({ length: 4 }, (_, i) => ({
  x: 0,
  z: 0,
  w: 4.4 - i * 1.05,
  d: 4.4 - i * 1.05,
  h: (i + 1) * 0.64,
}));
const spool = (h) => [
  { x: 0, z: 0, shape: "cylinder", radius: 1.25, w: 2.5, d: 2.5, h },
];
export const GOAL_COLLIDERS = [
  { x: -2.1, z: 0, w: 0.15, d: 0.15, h: 2.55 },
  { x: 2.1, z: 0, w: 0.15, d: 0.15, h: 2.55 },
  { x: 0, z: 0, w: 4.35, d: 0.15, y: 2.4, h: 2.55 },
  { x: 0, z: -1.45, w: 4.3, d: 0.06, h: 2.55 },
  { x: -2.1, z: -0.75, w: 0.05, d: 1.4, h: 2.55 },
  { x: 2.1, z: -0.75, w: 0.05, d: 1.4, h: 2.55 },
];
export const STRUCTURES = [
  {
    id: "pyramid",
    weight: 3,
    lift: 4,
    label: "Пирамида",
    kind: "pyramid",
    x: -6.5,
    z: -3.7,
    colliders: tiers,
    waypoints: tiers.map((tier, i) => ({
      x: 0,
      z: i === 3 ? 0 : tier.d / 2 - 0.32,
      h: tier.h,
    })),
  },
  {
    id: "spool-a",
    weight: 1,
    lift: 2,
    label: "Кабельная катушка",
    kind: "spool",
    x: -8.3,
    z: 3.7,
    h: 1.55,
    colliders: spool(1.55),
    waypoints: [{ x: 0, z: 0, h: 1.55 }],
  },
  {
    id: "spool-b",
    weight: 1,
    lift: 2,
    label: "Кабельная катушка",
    kind: "spool",
    x: 6.2,
    z: 5.8,
    h: 1.9,
    colliders: spool(1.9),
    waypoints: [{ x: 0, z: 0, h: 1.9 }],
  },
  {
    id: "goal",
    weight: 1,
    lift: 2,
    label: "Футбольные ворота",
    kind: "goal",
    x: 8.1,
    z: -4.8,
    colliders: GOAL_COLLIDERS,
    waypoints: [],
  },
];
export const STRUCTURE_IDS = STRUCTURES.map((s) => s.id);

export function clampStructure(x, z) {
  return {
    x: clamp(x, -STRUCTURE_BOUNDS.x, STRUCTURE_BOUNDS.x),
    z: clamp(z, STRUCTURE_BOUNDS.zMin, STRUCTURE_BOUNDS.zMax),
  };
}
export function clampBig(x, z) {
  return {
    x: clamp(x, -BIG_BOUNDS.x, BIG_BOUNDS.x),
    z: clamp(z, -BIG_BOUNDS.z, BIG_BOUNDS.z),
  };
}
export function defaultStructures() {
  return Object.fromEntries(STRUCTURES.map((s) => [s.id, { x: s.x, z: s.z }]));
}
// positions: { [id]: {x, z} } → world-space collider boxes.
// A lifted prop floats at p.y: avatars can walk under it, or stand on top of it.
const lifted = (c, y) => (y ? { ...c, y: (c.y || 0) + y, h: c.h + y } : c);
export function structureColliders(positions) {
  return STRUCTURES.flatMap((s) => {
    const p = positions?.[s.id] || s;
    return s.colliders.map((c) => lifted({ ...c, x: p.x + c.x, z: p.z + c.z }, p.y));
  });
}
export function bigBox(big) {
  return lifted({ ...BIG, x: big.x, z: big.z, id: "big" }, big.y);
}
export function obstacles(big, positions) {
  return [bigBox(big), ...structureColliders(positions)];
}
export function ballDefaults() {
  return {
    id: "football",
    kind: "ball",
    x: 7.5,
    z: -0.5,
    y: 0.42,
    size: 0.84,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0,
    rotation: 0,
    restitution: 0.64,
    friction: 1.15,
  };
}
export function ballResetPosition(goal) {
  return { x: goal.x, z: goal.z + 4.3, y: 0.42, vx: 0, vy: 0, vz: 0, spin: 0 };
}
// Crossing the goal line inside the mouth counts once until the ball leaves the goal area.
export function checkGoal(ball, previous, goal, flags) {
  const line = goal.z - 0.15;
  if (!flags.scored && previous.z >= line && ball.z < line) {
    const t = (previous.z - line) / (previous.z - ball.z);
    const x = previous.x + (ball.x - previous.x) * t;
    const y = previous.y + (ball.y - previous.y) * t;
    if (Math.abs(x - goal.x) < 2.025 - ball.size / 2 && y + ball.size / 2 < 2.4) {
      flags.scored = true;
      return true;
    }
  }
  if (ball.z > goal.z + 1) flags.scored = false;
  return false;
}
export function defaultCubes(newId) {
  return [
    { x: -10.3, z: 7.8, color: "#a696ce" },
    { x: 6.5, z: 2, color: "#ccad87" },
    { x: 10.5, z: -4, color: "#9bbbbb" },
    { x: -1, z: 0.5, color: "#c99ead" },
  ].map((c) => makeCube({ ...c, id: newId() }));
}
export function makeCube({ id, x, z, y, color }) {
  return {
    id,
    x,
    z,
    y: y ?? CUBE_SIZE / 2,
    size: CUBE_SIZE,
    color,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0,
    rotation: 0,
  };
}
export function supportHeight(x, z, big, positions) {
  return Math.max(
    0,
    ...obstacles(big, positions)
      .filter((b) => inside(x, z, b) && !b.y)
      .map((b) => b.h),
  );
}

// ——— Movable props: footprints for pushing and lifting ———
function footprint(colliders) {
  const round = colliders.length === 1 && colliders[0].shape === "cylinder";
  if (round) return { round, r: colliders[0].radius, hw: colliders[0].radius, hd: colliders[0].radius, h: colliders[0].h };
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, h = 0;
  for (const c of colliders) {
    x0 = Math.min(x0, c.x - c.w / 2);
    x1 = Math.max(x1, c.x + c.w / 2);
    z0 = Math.min(z0, c.z - c.d / 2);
    z1 = Math.max(z1, c.z + c.d / 2);
    h = Math.max(h, c.h);
  }
  return { round, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2, h };
}
export const PROPS = [
  { id: "big", label: "Большой куб", weight: BIG.weight, lift: BIG.lift, round: false, cx: 0, cz: 0, hw: BIG.w / 2, hd: BIG.d / 2, h: BIG.h },
  ...STRUCTURES.map((s) => ({ id: s.id, label: s.label, weight: s.weight, lift: s.lift, cx: 0, cz: 0, ...footprint(s.colliders) })),
];
export const LIFT_HEIGHT = 1.75;
export const PUSH_SPEED = 1.9;
