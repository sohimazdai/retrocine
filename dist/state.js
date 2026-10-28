// Shared room state and its operations. The sync server applies every operation with these
// functions, and the browser uses the same ones when it has no connection, so both behave alike.
import { clamp, stepCube, collideCubes, kickCube, LIMITS, inside } from "./physics.js";
import { floorBack } from "./layout.js";
import {
  MAX_NOTES,
  MAX_CUBES,
  NOTE_TYPES,
  CUBE_COLORS,
  DRAG_BOUNDS,
  LIFT_HEIGHT,
  PUSH_SPEED,
  mapDef,
  mapProps,
  propInfo,
  obstacles,
  defaultPositions,
  clampProp,
  supportHeight,
  makeBall,
  defaultBalls,
  defaultRides,
  makeCube,
  defaultCubes,
  goalsOf,
  checkGoal,
  ballResetPosition,
  hoopsOf,
  checkHoop,
  zonesOf,
  inZone,
  BALLS,
} from "./world.js";
import { MAPS } from "./maps/index.js";
import { projectile } from "./projectiles.js";

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const num = (v, lo, hi, fallback = 0) => (finite(v) ? clamp(v, lo, hi) : fallback);
// Furniture topples when the force on it exceeds this times its weight; it ends up lying this far over.
const TOPPLE_FORCE = 3.5,
  TOPPLE_LIE = 1.45;
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

export function createState(saved = {}, newId) {
  const map = mapDef(saved.map);
  const sameMap = saved.map === map.id || (!saved.map && map.id === MAPS[0].id);
  const structures = defaultPositions(map);
  if (sameMap)
    for (const info of mapProps(map)) {
      const p = saved.structures?.[info.id] || (info.id === "big" ? saved.big : null);
      if (p && finite(p.x) && finite(p.z)) structures[info.id] = clampProp(info, p.x, p.z);
    }
  const balls = defaultBalls(map);
  if (sameMap)
    for (const b of balls) {
      const p = (saved.balls || []).find((x) => x.id === b.id) || (b.id === "football" ? saved.ball : null);
      if (p && finite(p.x) && finite(p.z)) {
        if (BALLS[b.kind]?.grows && finite(p.size)) b.size = clamp(p.size, BALLS[b.kind].size, BALLS[b.kind].grows.max);
        Object.assign(b, { x: p.x, z: p.z, y: Math.max(b.size / 2, num(p.y, 0, 20, b.size / 2)) });
      }
    }
  const cubes = sameMap && saved.cubes ? saved.cubes : defaultCubes(map, newId);
  const rides = defaultRides(map);
  if (sameMap)
    for (const r of rides) {
      const p = (saved.rides || []).find((x) => x.id === r.id);
      if (p && finite(p.x) && finite(p.z)) Object.assign(r, { x: clamp(p.x, -LIMITS.x, LIMITS.x), z: clamp(p.z, -12, LIMITS.z), a: num(p.a, -10, 10), by: typeof p.by === "string" ? p.by : null });
    }
  return {
    map: map.id,
    notes: (saved.notes || []).slice(0, MAX_NOTES).map((n) => sanitizeNote(n, n.id || newId())),
    cubes: cubes
      .slice(0, MAX_CUBES)
      .map((c) => makeCube({ id: c.id || newId(), x: num(c.x, -14, 14), z: num(c.z, -10, 10), y: c.y, color: str(c.color, 16) || CUBE_COLORS[0] })),
    balls,
    rides,
    structures,
    scores: sameMap && saved.scores && typeof saved.scores === "object" ? sanitizeScores(saved.scores) : {},
    flags: {},
    lifts: {},
    v: 0,
    timer: {
      running: false,
      endAt: null,
      remaining: num(saved.timer?.remaining, 0, 3600, 300),
      visible: !!saved.timer?.visible,
    },
  };
}
function sanitizeScores(scores) {
  return Object.fromEntries(
    Object.entries(scores)
      .filter(([k, v]) => /^[\w-]{1,32}$/.test(k) && finite(v))
      .slice(0, 16)
      .map(([k, v]) => [k, clamp(Math.round(v), 0, 1e6)]),
  );
}
function sanitizeNote(n, id) {
  return {
    id,
    text: str(n.text, 280),
    type: NOTE_TYPES.includes(n.type) ? n.type : "good",
    author: str(n.author, 40) || "Участник",
    votes: num(n.votes, 0, 999),
    voters: Array.isArray(n.voters) ? n.voters.filter((v) => typeof v === "string").slice(0, 200) : [],
    x: num(n.x, -DRAG_BOUNDS.x, DRAG_BOUNDS.x),
    z: num(n.z, -DRAG_BOUNDS.z, DRAG_BOUNDS.z),
    y: 0,
  };
}
// What is persisted and what a newcomer receives.
export function serializeState(s) {
  return {
    map: s.map,
    notes: s.notes,
    cubes: s.cubes.map(({ id, x, y, z, color, size }) => ({ id, x, y, z, color, size })),
    balls: s.balls.map(({ id, kind, x, y, z, size }) => (BALLS[kind]?.grows ? { id, kind, x, y, z, size } : { id, kind, x, y, z })),
    rides: (s.rides || []).map(({ id, kind, x, z, a, by }) => ({ id, kind, x, z, a, by })),
    structures: s.structures,
    scores: s.scores,
    timer: s.timer,
  };
}
export const stateMap = (s) => mapDef(s.map);
// Someone left the room: whatever they rode stays where they were.
export function releaseRides(s, peer, pose) {
  const freed = [];
  for (const r of s.rides || [])
    if (r.by === peer) {
      r.by = null;
      if (pose && finite(pose.x) && finite(pose.z)) Object.assign(r, { x: clamp(pose.x, -LIMITS.x, LIMITS.x), z: clamp(pose.z, floorBack(pose.x), LIMITS.z), a: finite(pose.a) ? pose.a : r.a });
      freed.push({ ...r });
    }
  return freed;
}
export const THROW_SPEED = 22;
// Colliders of the current map, cached until a prop moves (s.v is bumped on every prop change).
export function stateObstacles(s) {
  if (s._obs && s._obsV === s.v && s._obsMap === s.map) return s._obs;
  s._obs = obstacles(stateMap(s), s.structures);
  s._obsV = s.v;
  s._obsMap = s.map;
  return s._obs;
}
export function dynamicObjects(s) {
  return [...s.cubes, ...s.balls];
}
export function findObject(s, id) {
  return s.balls.find((b) => b.id === id) || s.cubes.find((c) => c.id === id);
}
// Growing snowballs also send their size.
export function packObject(o) {
  const r = (v) => Math.round(v * 1000) / 1000;
  const packed = [o.id, r(o.x), r(o.y), r(o.z), r(o.vx), r(o.vy), r(o.vz), r(o.spin || 0), r(o.rotation || 0)];
  if (BALLS[o.kind]?.grows) packed.push(r(o.size));
  return packed;
}
export function unpackObject([id, x, y, z, vx, vy, vz, spin, rotation, size]) {
  const o = { id, x, y, z, vx, vy, vz, spin, rotation };
  if (finite(size)) o.size = size;
  return o;
}
export function timerLeft(timer, now) {
  return timer.running ? Math.max(0, Math.ceil((timer.endAt - now) / 1000)) : timer.remaining;
}
// A free spot on the floor near (x, z), clear of every collider of the map.
export function freeSpot(s, x, z, pad = 1.2) {
  const obs = stateObstacles(s);
  for (let r = 0; r < 24; r += 0.5)
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const px = clamp(x + Math.sin(a) * r, -DRAG_BOUNDS.x, DRAG_BOUNDS.x),
        pz = clamp(z + Math.cos(a) * r, floorBack(px) + 1.6, DRAG_BOUNDS.z);
      if (!obs.some((b) => !b.y && b.h > 0.1 && inside(px, pz, b, pad))) return { x: px, z: pz };
    }
  return { x, z };
}

// Fixed-step simulation of cubes and balls: water currents, wrap-around at river ends, goals and
// hoops. Returns the scoring events of this step.
export function stepWorld(s, dt, skip = () => false) {
  const map = stateMap(s),
    obs = stateObstacles(s),
    objects = dynamicObjects(s),
    zones = zonesOf(map),
    events = [];
  const previous = s.balls.map((b) => ({ x: b.x, y: b.y, z: b.z }));
  for (const o of objects) {
    if (skip(o)) continue;
    let grip = 1;
    for (const zone of zones) {
      if (!inZone(zone, o.x, o.z)) continue;
      if (zone.grip != null) grip = zone.grip;
      if (zone.flow && o.y < (zone.depth ?? 0.6) + o.size / 2) {
        const k = 1 - Math.exp(-(zone.drag ?? 1.5) * dt);
        o.vx += ((zone.flow.x || 0) - o.vx) * k;
        o.vz += ((zone.flow.z || 0) - o.vz) * k;
      }
      // Whatever leaves the field at one end of the river comes back at the other.
      if (zone.wrap === "z") {
        const next = o.z + o.vz * dt;
        if (o.vz > 0 && next > LIMITS.z - o.size / 2 - 0.05) o.z = floorBack(o.x) + o.size / 2 + 0.3;
        else if (o.vz < 0 && next < floorBack(o.x) + o.size / 2 + 0.05) o.z = LIMITS.z - o.size / 2 - 0.3;
      }
    }
    stepCube(o, obs, dt, grip);
    // A snowball rolled over snow (not ice) picks it up and grows, slower as it gets big.
    const grows = BALLS[o.kind]?.grows;
    if (grows && grip === 1 && o.y <= o.size / 2 + 0.02 && o.size < grows.max) {
      const speed = Math.hypot(o.vx, o.vz);
      if (speed > 0.4) {
        const before = o.size;
        o.size = Math.min(grows.max, o.size + (speed * dt * grows.rate) / o.size);
        o.y += (o.size - before) / 2;
      }
    }
  }
  for (let i = 0; i < objects.length; i++)
    for (let j = i + 1; j < objects.length; j++) collideCubes(objects[i], objects[j]);
  const goals = goalsOf(map, s.structures),
    hoops = hoopsOf(map, s.structures);
  s.balls.forEach((ball, i) => {
    if (skip(ball)) return;
    if (BALLS[ball.kind]?.goal)
      for (const goal of goals)
        if (checkGoal(ball, previous[i], goal, s.flags)) {
          s.scores[goal.id] = (s.scores[goal.id] || 0) + 1;
          events.push({ t: "goal", goal: goal.id, label: goal.label, score: s.scores[goal.id], by: s.lastTouch?.[ball.id] || null });
        }
    if (ball.kind === "basketball")
      for (const hoop of hoops)
        if (checkHoop(ball, previous[i], hoop, s.flags)) {
          s.scores[hoop.id] = (s.scores[hoop.id] || 0) + 2;
          events.push({ t: "basket", hoop: hoop.id, label: hoop.label, score: s.scores[hoop.id], by: s.lastTouch?.[ball.id] || null });
        }
  });
  return events;
}

// Applies one client operation. Returns { out, physics } where out are messages for everyone in
// the room ({ msg, others } — others: do not echo to the sender) and physics marks that the
// simulation must wake up. Returns null for an invalid or forbidden operation.
export function applyOp(s, op, ctx) {
  const out = [],
    all = (msg) => out.push({ msg, others: false }),
    others = (msg) => out.push({ msg, others: true });
  let physics = false;
  switch (op.t) {
    case "note.add": {
      if (s.notes.length >= MAX_NOTES) return null;
      const text = str(op.text, 280).trim();
      if (!text) return null;
      const note = sanitizeNote({ text, type: op.type, author: ctx.name, x: op.x, z: op.z, votes: 0 }, ctx.newId());
      s.notes.push(note);
      all({ t: "note", note });
      break;
    }
    case "note.edit": {
      const n = s.notes.find((n) => n.id === op.id);
      const text = str(op.text, 280).trim();
      if (!n || !text) return null;
      n.text = text;
      if (NOTE_TYPES.includes(op.type)) n.type = op.type;
      all({ t: "note", note: n });
      break;
    }
    case "note.type": {
      const n = s.notes.find((n) => n.id === op.id);
      if (!n || !NOTE_TYPES.includes(op.type)) return null;
      n.type = op.type;
      all({ t: "note", note: n });
      break;
    }
    case "note.vote": {
      const n = s.notes.find((n) => n.id === op.id);
      if (!n || !ctx.uid) return null;
      const i = n.voters.indexOf(ctx.uid);
      if (i >= 0) n.voters.splice(i, 1);
      else if (n.voters.length < 200) n.voters.push(ctx.uid);
      all({ t: "note", note: n });
      break;
    }
    case "note.move": {
      const n = s.notes.find((n) => n.id === op.id);
      if (!n || !finite(op.x) || !finite(op.z)) return null;
      n.x = clamp(op.x, -DRAG_BOUNDS.x, DRAG_BOUNDS.x);
      n.z = clamp(op.z, -DRAG_BOUNDS.z, DRAG_BOUNDS.z);
      others({ t: "note.move", id: n.id, x: n.x, z: n.z });
      break;
    }
    case "note.del": {
      const before = s.notes.length;
      s.notes = s.notes.filter((n) => n.id !== op.id);
      if (s.notes.length === before) return null;
      all({ t: "note.del", id: op.id });
      break;
    }
    case "cube.add": {
      if (s.cubes.length >= MAX_CUBES || !finite(op.x) || !finite(op.z)) return null;
      const x = clamp(op.x, -DRAG_BOUNDS.x, DRAG_BOUNDS.x),
        z = clamp(op.z, -DRAG_BOUNDS.z, DRAG_BOUNDS.z);
      const cube = makeCube({
        id: ctx.newId(),
        x,
        z,
        y: supportHeight(x, z, stateMap(s), s.structures) + 0.36,
        color: CUBE_COLORS[s.cubes.length % CUBE_COLORS.length],
      });
      s.cubes.push(cube);
      all({ t: "cube", cube });
      physics = true;
      break;
    }
    case "cube.del": {
      const before = s.cubes.length;
      s.cubes = s.cubes.filter((c) => c.id !== op.id);
      if (s.cubes.length === before) return null;
      all({ t: "cube.del", id: op.id });
      break;
    }
    case "obj.kick": {
      // Kicks, walking pushes and snowball hits. The sender reports where its avatar was.
      const o = findObject(s, op.id);
      if (!o || !finite(op.x) || !finite(op.z)) return null;
      if (Math.hypot(o.x - op.x, o.z - op.z) > 4) return null;
      kickCube(o, { x: op.x, z: op.z, angle: num(op.a, -10, 10) }, num(op.power, 0, 9, 3));
      if (s.balls.includes(o)) (s.lastTouch ||= {})[o.id] = ctx.peer;
      physics = true;
      break;
    }
    case "obj.throw": {
      // Throwing a ball from your hands (basketball shots, passes): it leaves from (x, y, z) — next to
      // where it lay — with a launch velocity, limited in speed.
      const o = findObject(s, op.id);
      if (!o || ![op.x, op.z, op.vx, op.vy, op.vz].every(finite)) return null;
      if (Math.hypot(o.x - op.x, o.z - op.z) > 2.5) return null;
      const speed = Math.hypot(op.vx, op.vy, op.vz),
        k = speed > THROW_SPEED ? THROW_SPEED / speed : 1;
      Object.assign(o, { x: op.x, z: op.z, vx: op.vx * k, vy: op.vy * k, vz: op.vz * k, dragBy: null });
      if (finite(op.y)) o.y = Math.max(o.y, clamp(op.y, 0, 4));
      if (s.balls.includes(o)) (s.lastTouch ||= {})[o.id] = ctx.peer;
      physics = true;
      break;
    }
    case "obj.drag": {
      const o = findObject(s, op.id);
      if (!o || !finite(op.x) || !finite(op.z)) return null;
      if (o.dragBy && o.dragBy !== ctx.peer && ctx.now - o.dragAt < 1000) return null;
      const x = clamp(op.x, -DRAG_BOUNDS.x, DRAG_BOUNDS.x),
        z = clamp(op.z, -DRAG_BOUNDS.z, DRAG_BOUNDS.z);
      const dt = o.dragAt ? clamp((ctx.now - o.dragAt) / 1000, 0.01, 0.5) : 0.05;
      o.vx = o.dragBy === ctx.peer ? clamp((x - o.x) / dt, -10, 10) : 0;
      o.vz = o.dragBy === ctx.peer ? clamp((z - o.z) / dt, -10, 10) : 0;
      o.vy = 0;
      o.x = x;
      o.z = z;
      o.y = supportHeight(x, z, stateMap(s), s.structures) + 0.9;
      o.dragBy = ctx.peer;
      o.dragAt = ctx.now;
      physics = true;
      break;
    }
    case "obj.release": {
      const o = findObject(s, op.id);
      if (!o || o.dragBy !== ctx.peer) return null;
      o.dragBy = null;
      o.dragAt = 0;
      if (finite(op.vx)) o.vx = clamp(op.vx, -10, 10);
      if (finite(op.vz)) o.vz = clamp(op.vz, -10, 10);
      physics = true;
      break;
    }
    case "struct.move": {
      const info = propInfo(stateMap(s), op.id);
      if (!info || !finite(op.x) || !finite(op.z) || s.lifts?.[op.id] || !finite(info.weight)) return null;
      s.structures[op.id] = clampProp(info, op.x, op.z);
      s.v++;
      others({ t: "struct", id: op.id, ...s.structures[op.id] });
      physics = true;
      break;
    }
    case "ball.reset": {
      const map = stateMap(s);
      const list = op.id ? s.balls.filter((b) => b.id === op.id) : s.balls.filter((b) => BALLS[b.kind]?.main);
      if (!list.length) return null;
      for (const b of list) Object.assign(b, ballResetPosition(map, s.structures, b), { dragBy: null });
      s.flags = {};
      physics = true;
      break;
    }
    case "map.set": {
      const map = MAPS.find((m) => m.id === op.id);
      if (!map || map.id === s.map) return null;
      s.map = map.id;
      s.structures = defaultPositions(map);
      s.balls = defaultBalls(map);
      s.cubes = defaultCubes(map, ctx.newId);
      s.rides = defaultRides(map);
      s.scores = {};
      s.flags = {};
      s.lifts = {};
      s.lastTouch = {};
      s.v++;
      // Stickers stay, moved out of anything solid on the new map.
      for (const n of s.notes) Object.assign(n, freeSpot(s, n.x, n.z));
      all({ t: "reset", by: ctx.peer, name: ctx.name, state: serializeState(s), objs: dynamicObjects(s).map(packObject) });
      physics = true;
      break;
    }
    case "ride.take": {
      // Get on a free skateboard, scooter or bike next to you (one at a time).
      const r = (s.rides || []).find((x) => x.id === op.id);
      if (!r || (r.by && r.by !== ctx.peer)) return null;
      if (ctx.pose && Math.hypot(ctx.pose.x - r.x, ctx.pose.z - r.z) > 3) return null;
      for (const other of s.rides)
        if (other !== r && other.by === ctx.peer) {
          other.by = null;
          if (ctx.pose) Object.assign(other, { x: ctx.pose.x, z: ctx.pose.z });
          all({ t: "ride", ride: { ...other } });
        }
      r.by = ctx.peer;
      all({ t: "ride", ride: { ...r } });
      break;
    }
    case "ride.leave": {
      // Step off: the ride stays where you left it.
      const r = (s.rides || []).find((x) => x.id === op.id);
      if (!r || r.by !== ctx.peer) return null;
      r.by = null;
      if (finite(op.x) && finite(op.z)) {
        r.x = clamp(op.x, -LIMITS.x, LIMITS.x);
        r.z = clamp(op.z, floorBack(r.x), LIMITS.z);
      }
      if (finite(op.a)) r.a = clamp(op.a, -10, 10);
      all({ t: "ride", ride: { ...r } });
      break;
    }
    case "boom": {
      const kind = projectile(op.kind);
      if (!kind.explosion || op.kind !== kind.id || ![op.x, op.y, op.z].every(finite)) return null;
      const x = clamp(op.x, -16, 16),
        y = clamp(op.y, -1, 30),
        z = clamp(op.z, -14, 12);
      const { radius, power } = kind.explosion;
      const props = applyBlast(s, x, y, z, radius, power);
      all({ t: "boom", by: ctx.peer, kind: kind.id, pid: typeof op.pid === "string" ? op.pid.slice(0, 24) : null, x, y, z, r: radius, power });
      for (const p of props) all({ t: "struct", ...p });
      physics = true;
      break;
    }
    case "timer.start": {
      const minutes = num(op.minutes, 1, 60, 5);
      s.timer = { running: true, endAt: ctx.now + minutes * 60000, remaining: minutes * 60, visible: true };
      all({ t: "timer", timer: s.timer });
      break;
    }
    case "timer.toggle": {
      if (s.timer.running) s.timer = { ...s.timer, running: false, endAt: null, remaining: timerLeft(s.timer, ctx.now) };
      else s.timer = { running: true, endAt: ctx.now + (s.timer.remaining || 300) * 1000, remaining: s.timer.remaining || 300, visible: true };
      all({ t: "timer", timer: s.timer });
      break;
    }
    case "timer.hide": {
      s.timer = { ...s.timer, running: false, endAt: null, visible: false };
      all({ t: "timer", timer: s.timer });
      break;
    }
    default:
      return null;
  }
  return { out, physics };
}
export const STATE_OPS = new Set([
  "note.add",
  "note.edit",
  "note.type",
  "note.vote",
  "note.move",
  "note.del",
  "cube.add",
  "cube.del",
  "obj.kick",
  "obj.throw",
  "obj.drag",
  "obj.release",
  "struct.move",
  "ball.reset",
  "map.set",
  "ride.take",
  "ride.leave",
  "boom",
  "timer.start",
  "timer.toggle",
  "timer.hide",
]);

// ——— Pushing and lifting props (Shift) ———
// pushers: [{ id, x, y, z, mx, mz }] — avatars holding Shift, their position and input direction.
// A prop moves when the pushes on it add up to its weight (opposite sides cancel, adjacent sides
// add up). Avatars on opposite sides together lift it, if there are as many as its lift value;
// the lifted prop follows their midpoint until they let go. Returns the props that moved.
export function propPosition(s, id) {
  return s.structures[id];
}
function setPropPosition(s, id, p) {
  s.structures[id] = { ...s.structures[id], ...p };
  if (!s.structures[id].y) delete s.structures[id].y;
  s.v++;
}
function propBox(prop, pos, pad = 0) {
  return { x0: pos.x + prop.cx - prop.hw - pad, x1: pos.x + prop.cx + prop.hw + pad, z0: pos.z + prop.cz - prop.hd - pad, z1: pos.z + prop.cz + prop.hd + pad };
}
function overlapsOthers(s, prop, pos) {
  if (pos.y) return false;
  const a = propBox(prop, pos, -0.05);
  const map = stateMap(s);
  const hitStatic = (map.statics || []).some((b) => {
    if (b.h < 0.2) return false;
    const hw = b.shape === "cylinder" ? b.radius : b.w / 2,
      hd = b.shape === "cylinder" ? b.radius : b.d / 2;
    return a.x0 < b.x + hw && a.x1 > b.x - hw && a.z0 < b.z + hd && a.z1 > b.z - hd;
  });
  if (hitStatic) return true;
  return mapProps(map).some((other) => {
    if (other.id === prop.id) return false;
    const op = s.structures[other.id];
    if (!op || op.y) return false;
    const b = propBox(other, op);
    return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
  });
}
function gapTo(prop, pos, x, z) {
  const dx = x - (pos.x + prop.cx),
    dz = z - (pos.z + prop.cz);
  if (prop.round) return { gap: Math.hypot(dx, dz) - prop.r, dx, dz };
  return { gap: Math.hypot(Math.max(0, Math.abs(dx) - prop.hw), Math.max(0, Math.abs(dz) - prop.hd)), dx, dz };
}
export function stepPushes(s, pushers, dt) {
  const moved = [];
  s.lifts ||= {};
  for (const prop of mapProps(stateMap(s))) {
    if (!finite(prop.weight)) continue;
    const pos = s.structures[prop.id];
    const lift = s.lifts[prop.id];
    if (lift) {
      const holders = lift.by
        .map((id) => pushers.find((p) => p.id === id))
        .filter((h) => h && gapTo(prop, pos, h.x, h.z).gap < 1.4);
      const sides = new Set(holders.map((h) => lift.sides[h.id]));
      const opposite = (sides.has("+x") && sides.has("-x")) || (sides.has("+z") && sides.has("-z"));
      if (holders.length < prop.lift || !opposite) {
        delete s.lifts[prop.id];
        const drop = { y: 0 };
        if (overlapsOthers(s, prop, { ...pos, y: 0 })) Object.assign(drop, { x: lift.from.x, z: lift.from.z });
        setPropPosition(s, prop.id, drop);
        moved.push({ id: prop.id, ...s.structures[prop.id], y: 0, by: [] });
        continue;
      }
      const mx = holders.reduce((a, h) => a + h.x, 0) / holders.length,
        mz = holders.reduce((a, h) => a + h.z, 0) / holders.length;
      const next = clampProp(prop, mx + lift.offset.x, mz + lift.offset.z);
      setPropPosition(s, prop.id, { ...next, y: LIFT_HEIGHT });
      moved.push({ id: prop.id, ...s.structures[prop.id], by: lift.by });
      continue;
    }
    const sides = { "+x": [], "-x": [], "+z": [], "-z": [] };
    for (const p of pushers) {
      const { gap, dx, dz } = gapTo(prop, pos, p.x, p.z);
      if (gap > 0.55 || p.y > (pos.y || 0) + prop.h - 0.1) continue;
      const side = Math.abs(dx) / prop.hw > Math.abs(dz) / prop.hd ? (dx > 0 ? "+x" : "-x") : dz > 0 ? "+z" : "-z";
      const nx = side === "+x" ? -1 : side === "-x" ? 1 : 0,
        nz = side === "+z" ? -1 : side === "-z" ? 1 : 0;
      sides[side].push({ ...p, pressing: p.mx * nx + p.mz * nz > 0.45 });
    }
    const all = Object.values(sides).flat();
    const opposite = (sides["+x"].length && sides["-x"].length) || (sides["+z"].length && sides["-z"].length);
    if (finite(prop.lift) && opposite && all.length >= prop.lift && all.length >= 2) {
      const mx = all.reduce((a, h) => a + h.x, 0) / all.length,
        mz = all.reduce((a, h) => a + h.z, 0) / all.length;
      s.lifts[prop.id] = {
        by: all.map((p) => p.id),
        sides: Object.fromEntries(Object.entries(sides).flatMap(([side, list]) => list.map((p) => [p.id, side]))),
        offset: { x: pos.x - mx, z: pos.z - mz },
        from: { x: pos.x, z: pos.z },
      };
      setPropPosition(s, prop.id, { y: LIFT_HEIGHT });
      moved.push({ id: prop.id, ...s.structures[prop.id], by: s.lifts[prop.id].by });
      continue;
    }
    const fx = sides["-x"].filter((p) => p.pressing).length - sides["+x"].filter((p) => p.pressing).length,
      fz = sides["-z"].filter((p) => p.pressing).length - sides["+z"].filter((p) => p.pressing).length,
      force = Math.hypot(fx, fz);
    if (!force || force < prop.weight) continue;
    const speed = (PUSH_SPEED * Math.min(1.35, force / prop.weight)) / Math.sqrt(prop.weight);
    const next = clampProp(prop, pos.x + (fx / force) * speed * dt, pos.z + (fz / force) * speed * dt);
    if (overlapsOthers(s, prop, next)) continue;
    setPropPosition(s, prop.id, next);
    moved.push({ id: prop.id, ...s.structures[prop.id] });
  }
  return moved;
}

// ——— Explosions ———
// Pushes every loose object away from the blast and nudges movable props according to their weight.
export function applyBlast(s, x, y, z, radius, power) {
  const moved = [];
  for (const o of dynamicObjects(s)) {
    const dx = o.x - x,
      dz = o.z - z,
      d = Math.hypot(dx, dz, o.y - y);
    if (d > radius) continue;
    const k = power * (1 - d / radius),
      len = Math.hypot(dx, dz) || 1;
    o.vx += (dx / len) * k;
    o.vz += (dz / len) * k;
    o.vy = Math.max(o.vy, k * 0.7);
    o.spin = (o.spin || 0) + k;
    o.dragBy = null;
  }
  for (const prop of mapProps(stateMap(s))) {
    if (!finite(prop.weight)) continue;
    const pos = s.structures[prop.id];
    if (pos.y || s.lifts?.[prop.id]) continue;
    const { gap, dx, dz } = gapTo(prop, pos, x, z);
    if (gap > radius) continue;
    const len = Math.hypot(dx, dz) || 1,
      strength = power * (1 - Math.max(0, gap) / radius),
      // The push is away from the blast.
      px = -dx / len,
      pz = -dz / len;
    if (strength > prop.weight * TOPPLE_FORCE) {
      // A strong enough blast topples the prop: it flies a little and lands on its side.
      const slide = clamp(0.25 + (strength / prop.weight) * 0.05, 0, 1.1);
      let next = clampProp(prop, pos.x + px * slide, pos.z + pz * slide);
      if (overlapsOthers(s, prop, next)) next = { x: pos.x, z: pos.z };
      // It tips about the horizontal axis across the push, falling in the push direction.
      s.structures[prop.id] = { x: next.x, z: next.z, tx: -pz, tz: px, ta: TOPPLE_LIE };
    } else {
      const shift = (strength * 0.05) / prop.weight;
      const next = clampProp(prop, pos.x + px * shift, pos.z + pz * shift);
      if (overlapsOthers(s, prop, next)) continue;
      // Keep it toppled if it already was.
      const keep = pos.ta ? { tx: pos.tx, tz: pos.tz, ta: pos.ta } : {};
      s.structures[prop.id] = { ...next, ...keep };
    }
    moved.push({ id: prop.id, ...s.structures[prop.id] });
  }
  return moved;
}
