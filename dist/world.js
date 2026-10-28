// World rules shared by the browser and the sync server (no Three.js): the current map's props and
// their colliders, loose balls and cubes, goals, hoops and zones.
import { clamp, inside } from "./physics.js";
import { ROOM, floorBack } from "./layout.js";
import { mapDef } from "./maps/index.js";

export const DRAG_BOUNDS = { x: 12, z: 8.5 };
export const MAX_NOTES = 80;
export const MAX_CUBES = 24;
export const NOTE_TYPES = ["good", "improve", "idea"];
export const CUBE_COLORS = ["#a696ce", "#ccad87", "#9bbbbb", "#c99ead"];
export const CUBE_SIZE = 0.65;
export const LIFT_HEIGHT = 1.75;
export const PUSH_SPEED = 1.9;

// Loose physical objects other than cubes.
export const BALLS = {
  // goal: scores in goals; main: the one a goal's "ball back" button returns.
  football: { size: 0.84, restitution: 0.64, friction: 1.15, label: "Футбольный мяч", goal: true, main: true },
  basketball: { size: 0.74, restitution: 0.8, friction: 0.9, label: "Баскетбольный мяч" },
  playball: { size: 0.6, restitution: 0.78, friction: 1, label: "Мяч", goal: true },
  puck: { size: 0.42, restitution: 0.45, friction: 3.5, label: "Шайба", goal: true, main: true, slides: true },
  // Rolled across snow it picks up snow and grows.
  snowroll: { size: 0.5, restitution: 0.05, friction: 4.2, label: "Снежный ком", grows: { max: 1.7, rate: 0.055 } },
  stone: { size: 0.5, restitution: 0.15, friction: 5, label: "Камень" },
  boulder: { size: 0.95, restitution: 0.08, friction: 6, label: "Валун" },
  pebble: { size: 0.3, restitution: 0.2, friction: 4.5, label: "Камешек" },
  barrel: { size: 0.8, restitution: 0.2, friction: 3.2, label: "Бочка" },
  mug: { size: 0.28, restitution: 0.1, friction: 0.5, label: "Кружка" },
  bottle: { size: 0.28, restitution: 0.12, friction: 2.2, label: "Бутылка" },
  paintball: { size: 0.5, restitution: 0.55, friction: 1.6, label: "Мяч" },
  cone: { size: 0.5, restitution: 0.25, friction: 3.6, label: "Конус" },
};

// Props may be turned by quarter turns (rot, radians). Same convention as Object3D.rotation.y.
function turn(c, rot) {
  const q = ((Math.round((rot || 0) / (Math.PI / 2)) % 4) + 4) % 4;
  if (!q) return c;
  const cos = [1, 0, -1, 0][q],
    sin = [0, 1, 0, -1][q];
  return { ...c, x: c.x * cos + c.z * sin, z: -c.x * sin + c.z * cos, w: q % 2 ? c.d : c.w, d: q % 2 ? c.w : c.d };
}
function footprint(colliders) {
  const round = colliders.length === 1 && colliders[0].shape === "cylinder";
  if (round) {
    const c = colliders[0];
    return { round, r: c.radius, cx: c.x, cz: c.z, hw: c.radius, hd: c.radius, h: c.h };
  }
  let x0 = Infinity,
    x1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity,
    h = 0;
  for (const c of colliders) {
    const hw = c.shape === "cylinder" ? c.radius : c.w / 2,
      hd = c.shape === "cylinder" ? c.radius : c.d / 2;
    x0 = Math.min(x0, c.x - hw);
    x1 = Math.max(x1, c.x + hw);
    z0 = Math.min(z0, c.z - hd);
    z1 = Math.max(z1, c.z + hd);
    h = Math.max(h, c.h);
  }
  return { round, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2, h };
}
const propCache = new WeakMap();
// Props of a map with their colliders turned into place and a footprint for pushing.
export function mapProps(map) {
  if (propCache.has(map)) return propCache.get(map);
  const list = (map.props || []).map((p) => {
    const local = p.colliders.map((c) => turn(c, p.rot));
    return { ...p, weight: p.weight ?? Infinity, lift: p.lift ?? Infinity, local, ...footprint(local) };
  });
  propCache.set(map, list);
  return list;
}
export const propInfo = (map, id) => mapProps(map).find((p) => p.id === id);
// A lifted prop floats at pos.y: avatars can walk under it or stand on top of it.
const lifted = (c, y) => (y ? { ...c, y: (c.y || 0) + y, h: c.h + y, h0: c.h0 != null ? c.h0 + y : c.h0, h1: c.h1 != null ? c.h1 + y : c.h1 } : c);
// A seesaw plank is a ramp whose ends follow its tilt: +1 — the +x end up, −1 — the −x end up.
export function seesawCollider(c, tilt = 1) {
  const mid = (c.h0 + c.h1) / 2,
    swing = Math.abs(c.h1 - c.h0) / 2,
    t = clamp(tilt, -1, 1);
  return { ...c, h0: mid - t * swing, h1: mid + t * swing, h: mid + swing };
}
export function propColliders(info, pos) {
  const p = pos || info;
  return info.local.map((c) => lifted({ ...(c.seesaw ? seesawCollider(c, p.tilt ?? 1) : c), x: p.x + c.x, z: p.z + c.z, prop: info.id }, p.y));
}
export function obstacles(map, positions) {
  return [...(map.statics || []), ...mapProps(map).flatMap((p) => propColliders(p, positions?.[p.id]))];
}
export function defaultPositions(map) {
  return Object.fromEntries(mapProps(map).map((p) => [p.id, { x: p.x, z: p.z }]));
}
// Keeps a prop's footprint on the floor.
export function clampProp(info, x, z) {
  const limit = ROOM.halfWidth - 0.3 - info.hw;
  x = clamp(x + info.cx, -limit, limit) - info.cx;
  const back = Math.max(floorBack(x + info.cx - info.hw), floorBack(x + info.cx + info.hw)) + 0.3 + info.hd;
  z = clamp(z + info.cz, back, ROOM.front - 0.3 - info.hd) - info.cz;
  return { x, z };
}
export function supportHeight(x, z, map, positions) {
  return Math.max(
    0,
    ...obstacles(map, positions)
      .filter((b) => inside(x, z, b) && !b.y)
      .map((b) => b.h),
  );
}

export function makeBall(def) {
  const kind = BALLS[def.kind] || BALLS.football;
  const size = def.size || kind.size;
  return {
    id: def.id,
    kind: def.kind,
    x: def.x,
    z: def.z,
    y: def.y ?? size / 2,
    size,
    restitution: kind.restitution,
    friction: kind.friction,
    flat: !!kind.slides,
    color: def.color,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0,
    rotation: 0,
  };
}
export const defaultBalls = (map) => (map.balls || []).map(makeBall);
// Skateboards, scooters and bikes: free ones stand where they were left; by — who rides it.
export const RIDE_KINDS = ["skateboard", "scooter", "bike"];
export const defaultRides = (map) => (map.rides || []).map((r) => ({ id: r.id, kind: r.kind, x: r.x, z: r.z, a: r.a || 0, by: null }));
export function makeCube({ id, x, z, y, color }) {
  return { id, x, z, y: y ?? CUBE_SIZE / 2, size: CUBE_SIZE, color, vx: 0, vy: 0, vz: 0, spin: 0, rotation: 0 };
}
export const defaultCubes = (map, newId) => (map.cubes || []).map((c) => makeCube({ ...c, id: newId() }));

const toLocal = (rot, dx, dz) => ({
  x: dx * Math.cos(rot || 0) - dz * Math.sin(rot || 0),
  z: dx * Math.sin(rot || 0) + dz * Math.cos(rot || 0),
});
export const toWorld = (rot, lx, lz) => ({
  x: lx * Math.cos(rot || 0) + lz * Math.sin(rot || 0),
  z: -lx * Math.sin(rot || 0) + lz * Math.cos(rot || 0),
});
// Football goals: props with goal: true. The mouth faces local +z; the net is behind.
export function goalsOf(map, positions) {
  return mapProps(map)
    .filter((p) => p.goal)
    .map((p) => ({ id: p.id, label: p.label, rot: p.rot || 0, ...(positions?.[p.id] || p), spot: p.ballSpot || { x: 0, z: 4.3 }, mouth: p.mouth || FOOTBALL_MOUTH }));
}
// Inner width and height of a goal's mouth (football goals; hockey nets are smaller).
export const FOOTBALL_MOUTH = { w: 4.05, h: 2.4 };
// Crossing the goal line inside the mouth counts once until the ball leaves the goal area.
export function checkGoal(ball, previous, goal, flags) {
  const mouth = goal.mouth || FOOTBALL_MOUTH;
  const now = toLocal(goal.rot, ball.x - goal.x, ball.z - goal.z),
    before = toLocal(goal.rot, previous.x - goal.x, previous.z - goal.z);
  const line = -0.15,
    key = "goal:" + goal.id + ":" + ball.id;
  if (!flags[key] && before.z >= line && now.z < line && !goal.y) {
    const t = (before.z - line) / (before.z - now.z);
    const x = before.x + (now.x - before.x) * t;
    const y = previous.y + (ball.y - previous.y) * t;
    if (Math.abs(x) < mouth.w / 2 - ball.size / 2 && y + ball.size / 2 < mouth.h) {
      flags[key] = true;
      return true;
    }
  }
  if (now.z > 1) flags[key] = false;
  return false;
}
export function ballResetPosition(map, positions, ball) {
  const def = (map.balls || []).find((b) => b.id === ball.id);
  const goal = BALLS[ball.kind]?.main && !def?.home && goalsOf(map, positions)[0];
  let x = def?.x ?? 0,
    z = def?.z ?? 4;
  if (goal) {
    const o = toWorld(goal.rot, goal.spot.x, goal.spot.z);
    x = goal.x + o.x;
    z = goal.z + o.z;
  }
  // A grown snowball goes back as a small one.
  const size = BALLS[ball.kind]?.grows ? BALLS[ball.kind].size : ball.size;
  return { x, z, y: size / 2, size, vx: 0, vy: 0, vz: 0, spin: 0 };
}
// Basketball hoops: props with hoop: { x, z, y, r } in local coordinates.
export function hoopsOf(map, positions) {
  return mapProps(map)
    .filter((p) => p.hoop)
    .map((p) => {
      const pos = positions?.[p.id] || p,
        o = toWorld(p.rot, p.hoop.x, p.hoop.z);
      return { id: p.id, label: p.label, x: pos.x + o.x, z: pos.z + o.z, y: p.hoop.y + (pos.y || 0), r: p.hoop.r };
    });
}
// A ball falling down through the ring scores.
export function checkHoop(ball, previous, hoop, flags) {
  const key = "hoop:" + hoop.id + ":" + ball.id;
  if (previous.y >= hoop.y && ball.y < hoop.y && ball.vy < 0) {
    const t = (previous.y - hoop.y) / (previous.y - ball.y || 1);
    const x = previous.x + (ball.x - previous.x) * t,
      z = previous.z + (ball.z - previous.z) * t;
    if (Math.hypot(x - hoop.x, z - hoop.z) < hoop.r - ball.size * 0.3 && !flags[key]) {
      flags[key] = true;
      return true;
    }
  }
  if (ball.y > hoop.y + 0.6 || Math.hypot(ball.x - hoop.x, ball.z - hoop.z) > 2) flags[key] = false;
  return false;
}
export const zonesOf = (map) => map.zones || [];
export const inZone = (zone, x, z) => x >= zone.x0 && x <= zone.x1 && z >= zone.z0 && z <= zone.z1;
// Water an avatar stands in (river): slows you down and carries you with the flow.
export const iceAt = (map, x, z) => zonesOf(map).find((zone) => zone.kind === "ice" && inZone(zone, x, z)) || null;
export const waterAt = (map, x, z) => zonesOf(map).find((zone) => zone.kind === "water" && inZone(zone, x, z)) || null;
// Where newcomers appear: a random free spot in one of the map's spawn areas.
export function spawnPoint(map, random = Math.random, positions) {
  const areas = [map.spawn || { x0: -4, x1: 4, z0: 2, z1: 6 }].flat();
  const boxes = obstacles(map, positions || defaultPositions(map)).filter((b) => !b.y || b.y < 1.6);
  for (let i = 0; i < 24; i++) {
    const a = areas[Math.floor(random() * areas.length)];
    const x = a.x0 + (a.x1 - a.x0) * random(),
      z = a.z0 + (a.z1 - a.z0) * random();
    if (!boxes.some((b) => inside(x, z, b, 0.32))) return { x, z };
  }
  const a = areas[0];
  return { x: (a.x0 + a.x1) / 2, z: (a.z0 + a.z1) / 2 };
}
export { mapDef };
