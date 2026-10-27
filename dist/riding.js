// Riding skateboards, scooters and BMX bikes: momentum, slopes, ollies, airs off kickers and
// quarter pipes, spins and flips in the air, rails to grind, landings that must line up.
// Pure logic: the browser drives your own avatar with it (riders are client-authoritative, like
// walking); the server only keeps track of who rides what and where a ride was left.
import { RADIUS, LIMITS, clamp, inside, sloped, surfaceOf } from "./physics.js";
import { floorBack } from "./layout.js";

// Real proportions, softened for play: slopes pull a little less than a free fall does, so a
// pushed board reaches the lip of a pipe with speed to spare for a spin.
export const RIDE_GRAVITY = 22,
  SLOPE_GRAVITY = 15;
export const RIDES = {
  skateboard: { label: "Скейтборд", max: 11, accel: 7, brake: 9, turn: 2.9, roll: 0.35, ollie: 8.2, spin: 8.6, flip: "Кикфлип", jump: "Олли", deck: 0.14 },
  scooter: { label: "Самокат", max: 10, accel: 6.5, brake: 11, turn: 2.7, roll: 0.45, ollie: 7.8, spin: 8.2, flip: "Тейлвип", jump: "Прыжок", deck: 0.13 },
  bike: { label: "BMX", max: 13, accel: 8, brake: 13, turn: 2.3, roll: 0.25, ollie: 8.6, spin: 7.4, flip: "Барспин", jump: "Банни-хоп", deck: 0.42 },
};
export const rideInfo = (kind) => RIDES[kind] || RIDES.skateboard;
const STEP = 0.35,
  FLIP_TIME = 0.42,
  wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const forward = (a) => ({ x: Math.sin(a), z: Math.cos(a) });

export function gradient(b, x, z) {
  if (!b || !sloped(b)) return { x: 0, z: 0 };
  const e = 0.04;
  return {
    x: (surfaceOf(b, x + e, z) - surfaceOf(b, x - e, z)) / (2 * e),
    z: (surfaceOf(b, x, z + e) - surfaceOf(b, x, z - e)) / (2 * e),
  };
}
// The surface under (x, z) for something at height y: the highest one it can roll onto.
export function surfaceUnder(boxes, x, z, y) {
  let h = 0,
    support = null;
  for (const b of boxes) {
    if (b.rail || !inside(x, z, b)) continue;
    if ((b.y || 0) > y + STEP) continue;
    const top = sloped(b) ? surfaceOf(b, x, z) : b.h;
    if (top > y + STEP || top < h) continue;
    h = top;
    support = b;
  }
  return { h, support };
}
// Something in the way at (x, z): taller than a step, or a rail you did not jump onto.
function wallAt(boxes, x, z, y, pad = RADIUS * 0.9) {
  for (const b of boxes) {
    if (!inside(x, z, b, pad) || (b.y || 0) > y + 1.4) continue;
    const top = sloped(b) ? surfaceOf(b, clamp(x, b.x - b.w / 2, b.x + b.w / 2), clamp(z, b.z - b.d / 2, b.z + b.d / 2)) : b.h;
    if (top > y + STEP + (sloped(b) ? 0.2 : 0)) return b;
  }
  return null;
}
// Slope along the heading at the body's spot: positive is uphill.
function slopeAlong(support, x, z, a) {
  const g = gradient(support, x, z),
    f = forward(a);
  return g.x * f.x + g.z * f.z;
}
export function mountRide(body, ride) {
  body.ride = { id: ride.id, kind: ride.kind, speed: 0, vx: 0, vz: 0, air: 0, spin: 0, flips: 0, flip: -1, grind: null, vert: null, ollie: false, trick: false, lean: 0, pitch: 0, grindTime: 0 };
  if (Number.isFinite(ride.a)) body.angle = ride.a;
  body.vy = 0;
  body.kx = body.kz = 0;
}
function airborne(b, st, vy) {
  const f = forward(b.angle);
  const th = Math.atan(st.groundSlope || 0);
  st.vx = f.x * st.speed * Math.cos(th);
  st.vz = f.z * st.speed * Math.cos(th);
  b.vy = vy;
  b.grounded = false;
  st.air = 0;
  st.spin = 0;
  st.flips = 0;
  st.flip = -1;
}
function trickName(R, st, fakie) {
  const half = Math.round(Math.abs(st.spin) / Math.PI);
  const parts = [];
  if (st.vert) parts.push("Эйр");
  if (st.flips) parts.push(R.flip + (st.flips > 1 ? " ×" + st.flips : ""));
  if (half) parts.push(String(half * 180));
  if (!parts.length && st.air > 0.45) parts.push(R.jump);
  if (fakie && parts.length) parts.push("в фейки");
  const score = Math.round(st.air * 100 + half * 150 + st.flips * 250 + (st.vert ? 120 : 0));
  return parts.length ? { name: parts.join(" "), score } : null;
}

// input: { x, z } camera-relative stick (like walking), ollie / trick: pressed this frame.
// Returns events: { t: "land", name, score } | { t: "grind" } | { t: "bail", reason }.
export function stepRide(b, input, boxes, dt) {
  const st = b.ride,
    R = rideInfo(st.kind),
    events = [];
  const ollie = st.ollie,
    trick = st.trick;
  st.ollie = st.trick = false;
  if (st.grind) return grind(b, st, R, input, ollie, dt, events);
  if (b.grounded) {
    const ground = surfaceUnder(boxes, b.x, b.z, b.y + 0.05);
    const s = slopeAlong(ground.support, b.x, b.z, b.angle);
    st.groundSlope = s;
    const th = Math.atan(s),
      cos = Math.cos(th),
      sin = Math.sin(th);
    // Steering toward where you point; pushing when you point roughly the way you go.
    const len = Math.hypot(input.x, input.z);
    let lean = 0;
    if (len > 0.1) {
      const want = Math.atan2(input.x, input.z),
        fakie = st.speed < -0.3,
        travel = fakie ? b.angle + Math.PI : b.angle,
        diff = wrap(want - travel),
        turn = R.turn * dt * (0.55 + 0.45 * Math.min(1, Math.abs(st.speed) / 4));
      if (Math.abs(diff) < 1.9) {
        b.angle = wrap(b.angle + clamp(diff, -turn, turn));
        lean = clamp(diff * 2, -1, 1);
        if (Math.abs(st.speed) < R.max) st.speed += (fakie ? -1 : 1) * R.accel * dt * Math.max(0.2, Math.cos(diff));
      } else if (Math.abs(st.speed) > 0.6) st.speed -= Math.sign(st.speed) * R.brake * dt;
      else b.angle = wrap(b.angle + clamp(wrap(want - b.angle), -turn * 2.5, turn * 2.5));
    }
    st.lean += (lean - st.lean) * Math.min(1, dt * 8);
    st.speed -= Math.sign(st.speed) * Math.min(Math.abs(st.speed), R.roll * dt);
    st.speed -= SLOPE_GRAVITY * sin * dt;
    st.speed = clamp(st.speed, -R.max * 1.7, R.max * 1.7);
    st.pitch = th;
    const f = forward(b.angle),
      step = st.speed * cos * dt;
    let nx = b.x + f.x * step,
      nz = b.z + f.z * step;
    const cx = clamp(nx, -LIMITS.x, LIMITS.x),
      cz = clamp(nz, floorBack(cx) + RADIUS, LIMITS.z);
    if (cx !== nx || cz !== nz) {
      st.speed *= -0.35;
      nx = cx;
      nz = cz;
    }
    // On a slope your feet are on the surface: only what is right under them can stop you.
    const wall = wallAt(boxes, nx, nz, b.y, sloped(ground.support || {}) ? 0 : RADIUS * 0.9);
    if (wall) {
      if (Math.abs(st.speed) > 7.5) {
        events.push({ t: "bail", reason: "wall" });
        return events;
      }
      st.speed *= -0.35;
      nx = b.x;
      nz = b.z;
    }
    b.x = nx;
    b.z = nz;
    const vyGround = st.speed * sin;
    // Going up the near-vertical top of a quarter pipe sends you straight up into the air.
    if (ground.support?.shape === "qpipe" && Math.abs(s) > 2.6 && vyGround > 1) {
      airborne(b, st, vyGround);
      st.vert = ground.support;
      st.vx = st.vz = 0;
      return events;
    }
    if (ollie) {
      airborne(b, st, Math.max(0, vyGround) + R.ollie);
      return events;
    }
    const next = surfaceUnder(boxes, b.x, b.z, b.y + Math.max(0, vyGround * dt) + 0.02);
    // The ground fell away (the lip of a kicker, the edge of a box): fly on.
    if (next.h < b.y + Math.min(0, vyGround * dt) - 0.06) {
      airborne(b, st, vyGround);
      return events;
    }
    b.y = next.h;
    b.vy = 0;
    return events;
  }
  // ——— In the air ———
  b.vy -= RIDE_GRAVITY * dt;
  const spinIn = -clamp(input.x, -1, 1);
  b.angle = wrap(b.angle + spinIn * R.spin * dt);
  st.spin += spinIn * R.spin * dt;
  st.lean += (spinIn * 0.6 - st.lean) * Math.min(1, dt * 6);
  if (trick && st.flip < 0) st.flip = 0;
  if (st.flip >= 0) {
    st.flip += dt / FLIP_TIME;
    if (st.flip >= 1) {
      st.flips++;
      st.flip = -1;
    }
  }
  st.air += dt;
  st.pitch *= Math.exp(-dt * 4);
  let nx = b.x + st.vx * dt,
    nz = b.z + st.vz * dt;
  // Over a quarter pipe you come back down onto its face, not behind it.
  if (st.vert && !inside(nx, nz, st.vert)) {
    nx = b.x;
    nz = b.z;
    st.vx = st.vz = 0;
  }
  const cx = clamp(nx, -LIMITS.x, LIMITS.x),
    cz = clamp(nz, floorBack(cx) + RADIUS, LIMITS.z);
  if (cx !== nx) st.vx *= -0.3;
  if (cz !== nz) st.vz *= -0.3;
  nx = cx;
  nz = cz;
  if (wallAt(boxes, nx, nz, b.y, st.vert ? 0 : RADIUS * 0.9)) {
    st.vx *= -0.3;
    st.vz *= -0.3;
    nx = b.x;
    nz = b.z;
  }
  b.x = nx;
  b.z = nz;
  const prevY = b.y;
  b.y += b.vy * dt;
  // Rails: drop onto one lined up with it and you grind.
  if (b.vy <= 0)
    for (const r of boxes) {
      if (!r.rail || prevY < r.h - 0.08 || b.y > r.h + 0.02) continue;
      const along = r.w >= r.d ? "x" : "z",
        across = along === "x" ? Math.abs(b.z - r.z) : Math.abs(b.x - r.x),
        within = along === "x" ? Math.abs(b.x - r.x) < r.w / 2 : Math.abs(b.z - r.z) < r.d / 2;
      if (!within || across > 0.3) continue;
      const axis = along === "x" ? Math.PI / 2 : 0,
        off = Math.abs(wrap(b.angle - axis)),
        misalign = Math.min(off, Math.PI - off);
      if (misalign > 0.6 || (st.flip >= 0 && st.flip < 0.8)) {
        events.push({ t: "bail", reason: "rail" });
        return events;
      }
      const dir = forward(off < Math.PI / 2 ? axis : axis + Math.PI);
      b.angle = Math.atan2(dir.x, dir.z);
      const v = st.vx * dir.x + st.vz * dir.z;
      st.speed = Math.max(2.5, v);
      st.grind = r;
      st.grindTime = 0;
      st.landed = trickName(R, st, false);
      if (along === "x") b.z = r.z;
      else b.x = r.x;
      b.y = r.h;
      b.vy = 0;
      b.grounded = true;
      st.flip = -1;
      events.push({ t: "grind" });
      return events;
    }
  const ground = surfaceUnder(boxes, b.x, b.z, prevY);
  if (b.vy > 0 || b.y > ground.h) return events;
  // ——— Landing ———
  const g = gradient(ground.support, b.x, b.z),
    f = forward(b.angle),
    s = g.x * f.x + g.z * f.z,
    th = Math.atan(s);
  const vh = Math.hypot(st.vx, st.vz);
  let misalign = 0;
  if (vh > 1.5) {
    const off = Math.abs(wrap(Math.atan2(st.vx, st.vz) - b.angle));
    misalign = Math.min(off, Math.PI - off);
  } else if (Math.hypot(g.x, g.z) > 0.4) {
    const off = Math.abs(wrap(Math.atan2(-g.x, -g.z) - b.angle));
    misalign = Math.min(off, Math.PI - off);
  }
  const vyLand = b.vy;
  b.y = ground.h;
  b.vy = 0;
  b.grounded = true;
  if ((st.flip >= 0 && st.flip < 0.82) || misalign > 0.7 || vyLand < -21) {
    events.push({ t: "bail", reason: st.flip >= 0 ? "flip" : misalign > 0.7 ? "sideways" : "hard" });
    return events;
  }
  st.speed = clamp((st.vx * f.x + st.vz * f.z) * Math.cos(th) + vyLand * Math.sin(th), -R.max * 1.7, R.max * 1.7);
  // Small misalignments are forgiven: you roll off the way you were going.
  if (vh > 1.5) b.angle = wrap(Math.atan2(st.vx, st.vz) + (st.speed < 0 ? Math.PI : 0));
  const trickDone = trickName(R, st, st.speed < -0.3);
  if (trickDone) events.push({ t: "land", ...trickDone });
  st.vx = st.vz = 0;
  st.air = 0;
  st.spin = 0;
  st.flips = 0;
  st.flip = -1;
  st.vert = null;
  st.pitch = th;
  st.groundSlope = s;
  return events;
}
function grind(b, st, R, input, ollie, dt, events) {
  const r = st.grind,
    f = forward(b.angle);
  st.grindTime += dt;
  st.speed -= 0.9 * dt;
  b.x += f.x * st.speed * dt;
  b.z += f.z * st.speed * dt;
  b.y = r.h;
  st.lean = Math.sin(st.grindTime * 9) * 0.25;
  const off = !inside(b.x, b.z, r, 0.02);
  if (ollie || off || st.speed < 0.8) {
    st.grind = null;
    st.groundSlope = 0;
    airborne(b, st, ollie ? R.ollie * 0.9 : 1.2);
    const score = Math.round(150 + st.grindTime * 220);
    events.push({ t: "land", name: (st.landed?.name ? st.landed.name + " + " : "") + "Слайд по перилам", score: score + (st.landed?.score || 0) });
    st.landed = null;
  }
  return events;
}
