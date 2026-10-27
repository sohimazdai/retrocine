// Shared room state and its operations. The sync server applies every operation with these
// functions, and the browser uses the same ones when it has no connection, so both behave alike.
import { clamp, stepCube, collideCubes, kickCube } from "./physics.js";
import {
  MAX_NOTES,
  MAX_CUBES,
  NOTE_TYPES,
  CUBE_COLORS,
  DRAG_BOUNDS,
  STRUCTURE_IDS,
  STRUCTURES,
  ballDefaults,
  ballResetPosition,
  checkGoal,
  clampBig,
  clampStructure,
  defaultCubes,
  defaultStructures,
  makeCube,
  obstacles,
  supportHeight,
  BIG_DEFAULT,
} from "./world.js";

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const num = (v, lo, hi, fallback = 0) => (finite(v) ? clamp(v, lo, hi) : fallback);
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

export function createState(saved = {}, newId) {
  const structures = defaultStructures();
  for (const id of STRUCTURE_IDS) {
    const p = saved.structures?.[id];
    if (p && finite(p.x) && finite(p.z)) structures[id] = clampStructure(p.x, p.z);
  }
  const big = saved.big && finite(saved.big.x) ? clampBig(saved.big.x, saved.big.z) : { ...BIG_DEFAULT };
  const ball = ballDefaults();
  if (saved.ball && finite(saved.ball.x) && finite(saved.ball.z))
    Object.assign(ball, { x: saved.ball.x, z: saved.ball.z, y: ball.size / 2 });
  return {
    notes: (saved.notes || []).slice(0, MAX_NOTES).map((n) => sanitizeNote(n, n.id || newId())),
    cubes: (saved.cubes || defaultCubes(newId))
      .slice(0, MAX_CUBES)
      .map((c) => makeCube({ id: c.id || newId(), x: num(c.x, -14, 14), z: num(c.z, -10, 10), y: c.y, color: str(c.color, 16) || CUBE_COLORS[0] })),
    ball,
    big,
    structures,
    score: num(saved.score, 0, 1e6),
    flags: { scored: false },
    timer: {
      running: false,
      endAt: null,
      remaining: num(saved.timer?.remaining, 0, 3600, 300),
      visible: !!saved.timer?.visible,
    },
  };
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
    notes: s.notes,
    cubes: s.cubes.map(({ id, x, y, z, color, size }) => ({ id, x, y, z, color, size })),
    ball: { x: s.ball.x, y: s.ball.y, z: s.ball.z },
    big: s.big,
    structures: s.structures,
    score: s.score,
    timer: s.timer,
  };
}
export function dynamicObjects(s) {
  return [...s.cubes, s.ball];
}
export function findObject(s, id) {
  return id === s.ball.id ? s.ball : s.cubes.find((c) => c.id === id);
}
export function packObject(o) {
  const r = (v) => Math.round(v * 1000) / 1000;
  return [o.id, r(o.x), r(o.y), r(o.z), r(o.vx), r(o.vy), r(o.vz), r(o.spin || 0), r(o.rotation || 0)];
}
export function unpackObject([id, x, y, z, vx, vy, vz, spin, rotation]) {
  return { id, x, y, z, vx, vy, vz, spin, rotation };
}
export function timerLeft(timer, now) {
  return timer.running ? Math.max(0, Math.ceil((timer.endAt - now) / 1000)) : timer.remaining;
}
export function isMoving(o) {
  return Math.abs(o.vx) + Math.abs(o.vz) + Math.abs(o.vy) > 0.02 || o.y > o.size / 2 + 0.002 + (o.restY || 0);
}

// Fixed-step simulation of cubes and the ball. Returns true when a goal was scored.
export function stepWorld(s, dt, skip = () => false) {
  const obs = obstacles(s.big, s.structures);
  const objects = dynamicObjects(s);
  const previous = { ...s.ball };
  for (const o of objects) if (!skip(o)) stepCube(o, obs, dt);
  for (let i = 0; i < objects.length; i++)
    for (let j = i + 1; j < objects.length; j++) collideCubes(objects[i], objects[j]);
  const goal = STRUCTURES.find((x) => x.id === "goal");
  const goalPos = { ...goal, ...s.structures.goal };
  if (!skip(s.ball) && checkGoal(s.ball, previous, goalPos, s.flags)) {
    s.score++;
    return true;
  }
  return false;
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
      const note = sanitizeNote(
        { text, type: op.type, author: ctx.name, x: op.x, z: op.z, votes: 0 },
        ctx.newId(),
      );
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
        y: supportHeight(x, z, s.big, s.structures) + 0.36,
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
      kickCube(o, { x: op.x, z: op.z, angle: num(op.a, -10, 10) }, num(op.power, 0, 8, 3));
      if (o === s.ball) s.lastTouch = ctx.peer;
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
      o.y = supportHeight(x, z, s.big, s.structures) + 0.9;
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
      if (!finite(op.x) || !finite(op.z)) return null;
      if (op.id === "big") {
        s.big = clampBig(op.x, op.z);
        others({ t: "struct", id: "big", x: s.big.x, z: s.big.z });
      } else if (STRUCTURE_IDS.includes(op.id)) {
        s.structures[op.id] = clampStructure(op.x, op.z);
        others({ t: "struct", id: op.id, ...s.structures[op.id] });
      } else return null;
      physics = true;
      break;
    }
    case "ball.reset": {
      const goal = { ...STRUCTURES.find((x) => x.id === "goal"), ...s.structures.goal };
      Object.assign(s.ball, ballResetPosition(goal), { dragBy: null });
      s.flags.scored = false;
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
      if (s.timer.running)
        s.timer = { ...s.timer, running: false, endAt: null, remaining: timerLeft(s.timer, ctx.now) };
      else
        s.timer = { running: true, endAt: ctx.now + (s.timer.remaining || 300) * 1000, remaining: s.timer.remaining || 300, visible: true };
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
  "obj.drag",
  "obj.release",
  "struct.move",
  "ball.reset",
  "timer.start",
  "timer.toggle",
  "timer.hide",
]);
