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
    const top = b.shape === "path" ? surfaceOf(b, x, z) : sloped(b) ? surfaceOf(b, clamp(x, b.x - b.w / 2, b.x + b.w / 2), clamp(z, b.z - b.d / 2, b.z + b.d / 2)) : b.h;
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
  st.bumped = false;
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

// input: { gas, brake, turn } — W, S held; turn +1 is left (A), −1 right (D).
// st.ollie: Space pressed this frame — an ollie on the ground or off a rail.
// st.trick: Shift pressed this frame — in the air a flip; on the ground an ollie straight into one.
// Returns events: { t: "land", name, score } | { t: "grind" } | { t: "bail", reason }.
// How forgiving it is: you only come off for a landing more than ~55° off your line (on a ramp's
// face, off the fall line), a flip far from done, a really hard drop, or a hard head-on hit.
const LAND_MISALIGN = 0.95,
  FLIP_DONE = 0.72,
  HARD_DROP = -24,
  HEAD_ON = 8.5;
export function stepRide(b, input, boxes, dt) {
  const st = b.ride,
    R = rideInfo(st.kind),
    events = [];
  const ollie = st.ollie,
    trick = st.trick;
  st.ollie = st.trick = false;
  if (st.grind) return grind(b, st, R, input, ollie, trick, dt, events);
  if (b.grounded) {
    const ground = surfaceUnder(boxes, b.x, b.z, b.y + 0.05);
    const s = slopeAlong(ground.support, b.x, b.z, b.angle);
    st.groundSlope = s;
    const th = Math.atan(s),
      cos = Math.cos(th),
      sin = Math.sin(th);
    // Controls relative to the rider: A/D turn (on the spot too, a little slower at full speed),
    // W pushes the way you face (rolling backwards it first slows you), S brakes.
    const turn = clamp(input.turn || 0, -1, 1);
    // On a steep face (up a quarter pipe) you can hardly turn. Across a slope gravity pulls you round
    // downhill — you carve back down, the harder the steeper and the slower — as on a real board;
    // nobody rides sideways along a wall.
    const gr = gradient(ground.support, b.x, b.z),
      steep = Math.hypot(gr.x, gr.z);
    b.angle = wrap(b.angle + turn * R.turn * (1 - 0.35 * Math.min(1, Math.abs(st.speed) / R.max)) * Math.max(0.3, 1 - steep * 0.5) * dt);
    if (steep > 0.15) {
      const back = st.speed < 0 ? Math.PI : 0,
        diff = wrap(Math.atan2(-gr.x, -gr.z) - (b.angle + back)),
        rate = (SLOPE_GRAVITY * (steep / Math.hypot(1, steep)) * Math.abs(Math.sin(diff))) / Math.max(2.5, Math.abs(st.speed));
      b.angle = wrap(b.angle + Math.sign(diff) * Math.min(Math.abs(diff), rate * dt));
    }
    if (input.gas) {
      if (st.speed < -0.2) st.speed += R.brake * dt;
      else if (st.speed < R.max) st.speed = Math.min(R.max, st.speed + R.accel * dt);
    }
    const brake = (input.brake ? 1.2 : 0) * R.brake;
    if (brake) st.speed -= Math.sign(st.speed) * Math.min(Math.abs(st.speed), brake * dt);
    const lean = turn * Math.min(1, Math.abs(st.speed) / 4);
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
    const pad = sloped(ground.support || {}) ? 0 : RADIUS * 0.9;
    if (wallAt(boxes, nx, nz, b.y, pad)) {
      // Glancing off a side: slide along it, losing the part of the speed that went into it, the
      // board turned along it. Only a hard hit head-on throws you off; a slow one bounces you back.
      const freeX = !wallAt(boxes, nx, b.z, b.y, pad),
        freeZ = !wallAt(boxes, b.x, nz, b.y, pad),
        into = freeX && !freeZ ? Math.abs(f.z) : freeZ && !freeX ? Math.abs(f.x) : 1;
      if (Math.abs(st.speed) * into > HEAD_ON) {
        events.push({ t: "bail", reason: "wall" });
        return events;
      }
      if (freeX !== freeZ && into < 0.8) {
        const along = freeX ? f.x : f.z;
        if (freeX) nz = b.z;
        else nx = b.x;
        const move = Math.sign(st.speed * along) || 1,
          dir = freeX ? (move > 0 ? Math.PI / 2 : -Math.PI / 2) : move > 0 ? 0 : Math.PI,
          face = wrap(dir + (st.speed < 0 ? Math.PI : 0));
        st.speed *= Math.abs(along);
        b.angle = face;
      } else {
        st.speed *= -0.35;
        nx = b.x;
        nz = b.z;
      }
    }
    b.x = nx;
    b.z = nz;
    const vyGround = st.speed * sin;
    // Going up the near-vertical top of a quarter pipe sends you straight up into the air (carving
    // up it at an angle, you keep some of the speed along the coping).
    const pipe = ground.support?.shape === "qpipe" ? ground.support : null;
    if (pipe && Math.abs(gradient(pipe, b.x, b.z)[pipe.axis]) > 2.6 && vyGround > 1) {
      const along = pipe.axis === "x" ? "z" : "x";
      airborne(b, st, vyGround);
      const carry = (along === "x" ? f.x : f.z) * st.speed * 0.8;
      st.vert = pipe;
      st.vx = along === "x" ? carry : 0;
      st.vz = along === "z" ? carry : 0;
      // Over the lip you turn to face straight up the pipe (a carve), so you come back down on it.
      b.angle = pipe.axis === "x" ? (pipe.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : pipe.dir > 0 ? 0 : Math.PI;
      return events;
    }
    if (ollie || trick) {
      airborne(b, st, Math.max(0, vyGround) + R.ollie);
      if (trick) st.flip = 0;
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
  // A/D spin you in the air, the same way they turn you on the ground; Shift flips the board.
  const spinIn = clamp(input.turn || 0, -1, 1);
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
  // The edge of the floor stops you in the air (no bounce back: that would land you sideways);
  // so does something you fly into — you then come down the way you face.
  const cx = clamp(nx, -LIMITS.x, LIMITS.x),
    cz = clamp(nz, floorBack(cx) + RADIUS, LIMITS.z);
  if (cx !== nx) st.vx = 0;
  if (cz !== nz) st.vz = 0;
  if (cx !== nx || cz !== nz) st.bumped = true;
  nx = cx;
  nz = cz;
  if (wallAt(boxes, nx, nz, b.y, st.vert ? 0 : RADIUS * 0.9)) {
    st.vx *= -0.3;
    st.vz *= -0.3;
    st.bumped = true;
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
      // Not lined up with it, or mid-flip: no grind — you just come down past it.
      if (misalign > 0.6 || (st.flip >= 0 && st.flip < 0.8)) continue;
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
    vh = Math.hypot(st.vx, st.vz);
  // Dropping back into a quarter pipe, or onto a ramp's face with hardly any speed across it, it is
  // the fall line that matters; otherwise the way you are flying (across a face is fine too).
  const steep = Math.hypot(g.x, g.z) > 0.4 && (st.vert || vh < 1.2);
  let misalign = 0,
    line = null;
  if (steep) {
    line = Math.atan2(-g.x, -g.z);
    const off = Math.abs(wrap(line - b.angle));
    misalign = Math.min(off, Math.PI - off);
  } else if (vh > 1.5 && !st.bumped) {
    const off = Math.abs(wrap(Math.atan2(st.vx, st.vz) - b.angle));
    misalign = Math.min(off, Math.PI - off);
  }
  const vyLand = b.vy;
  b.y = ground.h;
  b.vy = 0;
  b.grounded = true;
  const unfinished = st.flip >= 0 && st.flip < FLIP_DONE;
  if (unfinished || misalign > LAND_MISALIGN || vyLand < HARD_DROP) {
    events.push({ t: "bail", reason: unfinished ? "flip" : misalign > LAND_MISALIGN ? "sideways" : "hard" });
    return events;
  }
  // Close enough: the board settles onto the fall line (forwards or fakie, whichever is nearer).
  if (line !== null) b.angle = Math.abs(wrap(line - b.angle)) < Math.PI / 2 ? line : wrap(line + Math.PI);
  const f = forward(b.angle),
    s = g.x * f.x + g.z * f.z,
    th = Math.atan(s);
  st.speed = clamp((st.vx * f.x + st.vz * f.z) * Math.cos(th) + vyLand * Math.sin(th), -R.max * 1.7, R.max * 1.7);
  // Small misalignments are forgiven: you roll off the way you were going.
  if (vh > 1.5 && line === null && !st.bumped) b.angle = wrap(Math.atan2(st.vx, st.vz) + (st.speed < 0 ? Math.PI : 0));
  st.bumped = false;
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
function grind(b, st, R, input, ollie, trick, dt, events) {
  const r = st.grind,
    f = forward(b.angle);
  st.grindTime += dt;
  st.speed -= 0.9 * dt;
  b.x += f.x * st.speed * dt;
  b.z += f.z * st.speed * dt;
  b.y = r.h;
  st.lean = Math.sin(st.grindTime * 9) * 0.25;
  const off = !inside(b.x, b.z, r, 0.02);
  if (ollie || trick || off || st.speed < 0.8) {
    st.grind = null;
    st.groundSlope = 0;
    airborne(b, st, ollie || trick ? R.ollie * 0.9 : 1.2);
    if (trick) st.flip = 0;
    const score = Math.round(150 + st.grindTime * 220);
    events.push({ t: "land", name: (st.landed?.name ? st.landed.name + " + " : "") + "Слайд по перилам", score: score + (st.landed?.score || 0) });
    st.landed = null;
  }
  return events;
}
