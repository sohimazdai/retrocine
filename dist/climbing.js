// Climbing ropes, tree trunks, climbing walls and cargo nets, and riding a zip line. Pure logic, run
// by the browser for your own avatar (like walking); others see it through your pose.
//   rope / trunk: { kind, x, z, r, y0, y1 } — you hang around it, r is the trunk's radius (0 for a rope)
//   wall / net:   { kind, x, z, w, d, y0, y1, face: "+x" | "-x" | "+z" | "-z" } — the climbable side
//   zip:          { kind: "zip", from: [x, y, z], to: [x, y, z] } — the cable; you hang 1.95 below it
//   bar:          { kind: "bar", x, z, w, d, y } — a horizontal bar at height y along its long side
//                 (pull-up bar, monkey bars): jump up into it or press E under it to hang
import { RADIUS, LIMITS, clamp, inside, sloped } from "./physics.js";
import { floorBack } from "./layout.js";

export const CLIMB_SPEED = 2.3,
  HANG = 1.95,
  ZIP_MAX = 12;
const HOLD = 0.32;
const NORMALS = { "+x": [1, 0], "-x": [-1, 0], "+z": [0, 1], "-z": [0, -1] };

// Where on a climbable the body would hold on, and how far it is from there now.
function holdPoint(c, x, z) {
  if (c.kind === "rope" || c.kind === "trunk") {
    const dx = x - c.x,
      dz = z - c.z,
      d = Math.hypot(dx, dz) || 1e-6,
      r = (c.r || 0) + HOLD;
    return { x: c.x + (dx / d) * r, z: c.z + (dz / d) * r, gap: d - r, nx: dx / d, nz: dz / d };
  }
  const [nx, nz] = NORMALS[c.face];
  const fx = c.x + (nx * c.w) / 2,
    fz = c.z + (nz * c.d) / 2;
  const along = nx ? clamp(z, c.z - c.d / 2 + 0.2, c.z + c.d / 2 - 0.2) : clamp(x, c.x - c.w / 2 + 0.2, c.x + c.w / 2 - 0.2);
  const hx = nx ? fx + nx * HOLD : along,
    hz = nx ? along : fz + nz * HOLD;
  const lateral = nx ? Math.abs(z - along) : Math.abs(x - along);
  const gap = (nx ? (x - fx) * nx : (z - fz) * nz) - HOLD;
  return { x: hx, z: hz, gap: Math.max(gap, lateral > 0.05 ? 9 : gap), nx, nz };
}
// A climbable you are pressing against: moving toward it, close enough, at a height you can hold.
export function findClimb(climbs, body, move) {
  const len = Math.hypot(move.x, move.z);
  if (!len || body.climbCooldown > 0) return null;
  for (const c of climbs || []) {
    if (c.kind === "zip" || c.kind === "bar") continue;
    if (body.y < (c.y0 || 0) - 0.6 || body.y > c.y1 - 1.0) continue;
    const h = holdPoint(c, body.x, body.z);
    if (h.gap > 0.16 || h.gap < -0.5) continue;
    const toward = -(move.x * h.nx + move.z * h.nz) / len;
    if (toward > 0.55) return c;
  }
  return null;
}
export function startClimb(body, c) {
  const h = holdPoint(c, body.x, body.z);
  body.climb = { c, around: Math.atan2(h.nx, h.nz) };
  body.x = h.x;
  body.z = h.z;
  body.vy = 0;
  body.kx = body.kz = 0;
  body.grounded = false;
  body.angle = Math.atan2(-h.nx, -h.nz);
}
// Climbing or zipping one step. input: camera-relative { x, z }; jump: let go / jump off.
// Returns "top" (pulled yourself up onto something), "off" (let go) or null.
export function stepClimb(body, input, boxes, dt, jump) {
  const st = body.climb,
    c = st.c;
  if (c.kind === "zip") return stepZip(body, input, dt, jump);
  if (c.kind === "bar") return stepBar(body, input, boxes, dt, jump);
  if (jump) return letGo(body, st, 6.5, 3.2);
  const up = -input.z,
    side = input.x;
  body.y = clamp(body.y + up * CLIMB_SPEED * dt, (c.y0 || 0) - 0.2, c.y1 - 1.0);
  if (c.kind === "rope" || c.kind === "trunk") {
    // Going round the rope or the trunk.
    st.around += (side * CLIMB_SPEED * dt) / ((c.r || 0) + HOLD);
    const r = (c.r || 0) + HOLD;
    body.x = c.x + Math.sin(st.around) * r;
    body.z = c.z + Math.cos(st.around) * r;
    body.angle = st.around + Math.PI;
  } else {
    const [nx, nz] = NORMALS[c.face];
    if (nx) body.z = clamp(body.z - side * nx * CLIMB_SPEED * dt, c.z - c.d / 2 + 0.2, c.z + c.d / 2 - 0.2);
    else body.x = clamp(body.x + side * nz * CLIMB_SPEED * dt, c.x - c.w / 2 + 0.2, c.x + c.w / 2 - 0.2);
    body.angle = Math.atan2(-nx, -nz);
  }
  st.moving = Math.abs(up) + Math.abs(side) > 0;
  // At the top: pull yourself up onto whatever is there.
  if (up > 0 && body.y >= c.y1 - 1.0 - 1e-6) {
    const ledge = ledgeNear(boxes, body);
    if (ledge) {
      Object.assign(body, ledge, { vy: 0, grounded: true });
      body.climb = null;
      body.climbCooldown = 0.3;
      return "top";
    }
  }
  // Down at the bottom: feet on the ground.
  if (up < 0 && body.y <= (c.y0 || 0) - 0.2 + 1e-6) return letGo(body, st, 0, 0.6);
  return null;
}
// The nearest surface within an arm's reach above you to climb onto.
function ledgeNear(boxes, body) {
  let best = null;
  for (const b of boxes) {
    // Nothing too thin to stand on (the top edge of a net, a post).
    if (sloped(b) || b.w < 0.3 || b.d < 0.3 || b.h < body.y - 0.3 || b.h > body.y + 2.1) continue;
    const inset = Math.min(0.35, b.w / 2 - 0.01, b.d / 2 - 0.01);
    const x = clamp(body.x, b.x - b.w / 2 + inset, b.x + b.w / 2 - inset),
      z = clamp(body.z, b.z - b.d / 2 + inset, b.z + b.d / 2 - inset);
    const d = Math.hypot(x - body.x, z - body.z);
    if (d > 1.5) continue;
    // Not into something solid on top of it.
    if (boxes.some((o) => o !== b && !sloped(o) && inside(x, z, o, RADIUS * 0.8) && o.h > b.h + 0.3 && (o.y || 0) < b.h + 1.5)) continue;
    if (!best || d < best.d) best = { x, z, y: b.h, d };
  }
  return best && { x: best.x, z: best.z, y: best.y };
}
function letGo(body, st, vy, push) {
  const a = st.c.kind === "zip" ? null : holdPoint(st.c, body.x, body.z);
  body.climb = null;
  body.climbCooldown = 0.45;
  body.vy = vy;
  body.grounded = false;
  if (a) {
    body.kx = a.nx * push;
    body.kz = a.nz * push;
  }
  return "off";
}

// ——— Zip line ———
export function zipStart(zip, body) {
  const [fx, fy, fz] = zip.from;
  return Math.hypot(body.x - fx, body.z - fz) < 1.4 && Math.abs(body.y - (fy - HANG)) < 0.7;
}
export function startZip(body, zip) {
  body.climb = { c: zip, s: 0, v: 1.5 };
  body.grounded = false;
  body.vy = 0;
  placeOnZip(body, zip, 0);
}
function placeOnZip(body, zip, s) {
  const [fx, fy, fz] = zip.from,
    [tx, ty, tz] = zip.to;
  body.x = fx + (tx - fx) * s;
  body.z = fz + (tz - fz) * s;
  body.y = fy + (ty - fy) * s - HANG;
  body.angle = Math.atan2(tx - fx, tz - fz);
}
function stepZip(body, input, dt, jump) {
  const st = body.climb,
    zip = st.c;
  const [fx, fy, fz] = zip.from,
    [tx, ty, tz] = zip.to;
  const len = Math.hypot(tx - fx, ty - fy, tz - fz),
    drop = (fy - ty) / len;
  st.v = clamp(st.v + (9.8 * drop - 0.04 * st.v * st.v) * dt, 0.5, ZIP_MAX);
  st.s += (st.v * dt) / len;
  const done = st.s >= 1;
  placeOnZip(body, zip, Math.min(1, st.s));
  if (done || jump) {
    const ux = (tx - fx) / len,
      uz = (tz - fz) / len;
    body.climb = null;
    body.climbCooldown = 0.45;
    body.vy = done ? 0 : 1.5;
    body.kx = ux * st.v * 0.6;
    body.kz = uz * st.v * 0.6;
    body.grounded = false;
    body.x = clamp(body.x, -LIMITS.x, LIMITS.x);
    body.z = clamp(body.z, floorBack(body.x) + RADIUS, LIMITS.z);
    return "off";
  }
  return null;
}

// ——— Bars: pull-up bars and monkey bars ———
// Hands are this far above the feet when hanging at full stretch.
export const BAR_HANG = 2.0;
const barAxis = (c) => (c.w >= c.d ? "x" : "z");
const barLength = (c) => Math.max(c.w, c.d);
// A short bar is for pull-ups (W); a long one is for going along it hand over hand.
export const isTurnik = (c) => barLength(c) <= 1.8;
function barSpot(c, x, z) {
  const ax = barAxis(c);
  return { along: ax === "x" ? x - c.x : z - c.z, across: ax === "x" ? z - c.z : x - c.x, half: barLength(c) / 2 };
}
// A bar your hands reach: when jumping, the one your hands come up to; with reach = true (E), any
// bar within arm's length above your head.
export function findBar(climbs, body, reach = false) {
  if (body.climbCooldown > 0) return null;
  let best = null;
  for (const c of climbs || []) {
    if (c.kind !== "bar") continue;
    const s = barSpot(c, body.x, body.z);
    // With E you can reach a little past the ends (the first rung of the monkey bars from the landing).
    if (Math.abs(s.along) > s.half + (reach ? 0.6 : -0.08) || Math.abs(s.across) > (reach ? 0.75 : 0.45)) continue;
    const gap = c.y - (body.y + BAR_HANG);
    if (reach ? gap > 0.45 || c.y < body.y + 1.2 : gap < -0.35 || gap > 0.12) continue;
    if (!best || Math.abs(s.across) < best.d) best = { c, d: Math.abs(s.across) };
  }
  return best?.c || null;
}
export function startBar(body, c) {
  const s = barSpot(c, body.x, body.z),
    ax = barAxis(c);
  body.climb = { c, pull: 0, count: 0, up: false, phase: 0 };
  if (ax === "x") body.z = c.z;
  else body.x = c.x;
  // Hands on the bar itself, even if you reached for its end.
  const along = clamp(s.along, -s.half + 0.12, s.half - 0.12);
  if (ax === "x") body.x = c.x + along;
  else body.z = c.z + along;
  body.y = Math.max(0, c.y - BAR_HANG);
  body.vy = 0;
  body.kx = body.kz = 0;
  body.grounded = false;
  // Facing across a pull-up bar (toward the middle of the room); along monkey bars.
  // Pull-up bars: across the room's side bars you face the middle; on bars along x, the camera.
  if (isTurnik(c)) body.angle = ax === "z" ? (c.x > 0 ? -Math.PI / 2 : Math.PI / 2) : 0;
  else body.angle = ax === "z" ? (s.along > 0 ? Math.PI : 0) : s.along > 0 ? -Math.PI / 2 : Math.PI / 2;
}
// One step hanging from a bar. Returns "pull" (a pull-up done), "top" (onto a platform at the end),
// "off" (let go) or null.
function stepBar(body, input, boxes, dt, jump) {
  const st = body.climb,
    c = st.c,
    ax = barAxis(c);
  if (jump) return letGoBar(body, 4.5, 2.2);
  const hang = Math.max(0, c.y - BAR_HANG);
  let result = null;
  if (isTurnik(c)) {
    // W pulls up (chin over the bar), S lets go.
    const up = -input.z;
    if (up < -0.5 && st.pull < 0.05) return letGoBar(body, 0, 0);
    st.pull = clamp(st.pull + (up > 0.5 ? 1 : -1) * dt * 2.4, 0, 1);
    if (st.pull >= 1 && !st.up) {
      st.up = true;
      st.count++;
      result = "pull";
    }
    if (st.pull < 0.25) st.up = false;
  } else {
    // Hand over hand along the monkey bars.
    const go = ax === "x" ? input.x : input.z,
      s = barSpot(c, body.x, body.z);
    if (Math.abs(go) > 0.3) {
      const next = clamp(s.along + Math.sign(go) * 1.7 * dt, -s.half + 0.12, s.half - 0.12);
      if (ax === "x") body.x = c.x + next;
      else body.z = c.z + next;
      st.phase += dt * 9;
      body.angle = ax === "z" ? (go > 0 ? 0 : Math.PI) : go > 0 ? Math.PI / 2 : -Math.PI / 2;
      // At the end: step onto the platform there, if there is one.
      if (Math.abs(next) >= s.half - 0.121) {
        const dir = Math.sign(go);
        const ahead = { x: body.x + (ax === "x" ? dir * 0.6 : 0), z: body.z + (ax === "z" ? dir * 0.6 : 0), y: hang };
        const ledge = ledgeNear(boxes, ahead);
        if (ledge && ledge.y > hang - 0.4 && ledge.y < hang + 1.2) {
          Object.assign(body, ledge, { vy: 0, grounded: true });
          body.climb = null;
          body.climbCooldown = 0.5;
          return "top";
        }
      }
    }
  }
  body.y = hang + st.pull * 0.55;
  return result;
}
function letGoBar(body, vy, push) {
  const f = { x: Math.sin(body.angle), z: Math.cos(body.angle) };
  body.climb = null;
  body.climbCooldown = 0.5;
  body.vy = vy;
  body.grounded = false;
  body.kx = f.x * push;
  body.kz = f.z * push;
  return "off";
}
