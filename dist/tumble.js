// Knocked over: an avatar hit by a kart (or blown up) flies, tumbling head over heels, bounces once
// or twice, lands on its back, front, a side or its bottom — whichever way it came down — lies there
// a moment and gets back up. Pure logic for your own avatar; others see it through your pose
// (orientation quaternion and phase).
import { stepBody } from "./physics.js";

// ——— Quaternions [x, y, z, w] ———
export const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qaxis = (x, y, z, angle) => {
  const s = Math.sin(angle / 2);
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
};
export const qyaw = (a) => qaxis(0, 1, 0, a);
const qnorm = (q) => {
  const l = Math.hypot(...q) || 1;
  return q.map((v) => v / l);
};
// Rotates vector v by quaternion q.
export function qrot(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1],
    iy = w * v[1] + z * v[0] - x * v[2],
    iz = w * v[2] + x * v[1] - y * v[0],
    iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
export function qslerp(a, b, t) {
  let [bx, by, bz, bw] = b,
    cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (cos > 0.9995) return qnorm([a[0] + (bx - a[0]) * t, a[1] + (by - a[1]) * t, a[2] + (bz - a[2]) * t, a[3] + (bw - a[3]) * t]);
  const th = Math.acos(cos),
    s = Math.sin(th),
    ka = Math.sin((1 - t) * th) / s,
    kb = Math.sin(t * th) / s;
  return [a[0] * ka + bx * kb, a[1] * ka + by * kb, a[2] * ka + bz * kb, a[3] * ka + bw * kb];
}
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// The ways to come to rest, as a turn from standing: on the back, the front, the left or right
// side, or sitting on the bottom (still upright).
const RESTS = {
  back: qaxis(1, 0, 0, -Math.PI / 2),
  front: qaxis(1, 0, 0, Math.PI / 2),
  left: qaxis(0, 0, 1, -Math.PI / 2),
  right: qaxis(0, 0, 1, Math.PI / 2),
  sit: [0, 0, 0, 1],
};
export const DOWN_TIME = 1.5,
  UP_TIME = 0.55,
  CENTER = 0.75;
// Which part of the body is lowest when it comes down, and the resting pose that follows.
export function restFor(q) {
  const up = qrot(q, [0, 1, 0]),
    fwd = qrot(q, [0, 0, 1]),
    side = qrot(q, [1, 0, 0]);
  const options = [
    ["back", fwd[1]],
    ["front", -fwd[1]],
    ["left", -side[1]],
    ["right", side[1]],
    ["sit", up[1] - 0.25],
  ].sort((a, b) => b[1] - a[1]);
  const kind = options[0][0];
  // Keep the head pointing where it ended up.
  let yaw;
  const hx = up[0],
    hz = up[2];
  if (kind === "sit" || Math.hypot(hx, hz) < 0.2) yaw = Math.atan2(fwd[0], fwd[2]);
  else if (kind === "back") yaw = Math.atan2(-hx, -hz);
  else if (kind === "front") yaw = Math.atan2(hx, hz);
  else if (kind === "left") yaw = Math.atan2(-hz, hx);
  else yaw = Math.atan2(hz, -hx);
  return { kind, q: qmul(qyaw(yaw), RESTS[kind]), yaw };
}
// How high the body's middle is above the feet's physics point: standing 0.75, lying 0.22.
export function centerHeight(q, kind) {
  if (kind === "sit") return CENTER - 0.42;
  const up = qrot(q, [0, 1, 0]);
  return 0.22 + (CENTER - 0.22) * Math.abs(up[1]);
}

// v: [x, y, z] launch velocity; seed varies the spin.
export function startTumble(body, v, seed = Math.random()) {
  const speed = Math.hypot(v[0], v[2]) || 1,
    // Spin head over heels about the axis across the direction of travel, plus a twist.
    ax = -v[2] / speed,
    az = v[0] / speed,
    flip = 7 + Math.hypot(v[0], v[1], v[2]) * 0.55,
    twist = (seed - 0.5) * 8,
    roll = (((seed * 7.31) % 1) - 0.5) * 5;
  body.tumble = { phase: "air", t: 0, q: body.tumble?.q || qyaw(body.angle || 0), w: [ax * flip + roll * az * 0.3, twist, az * flip - roll * ax * 0.3], bounces: 0 };
  body.climb = null;
  body.vy = v[1];
  body.kx = v[0];
  body.kz = v[2];
  body.grounded = false;
  body.y += 0.05;
}
// One step. Returns "down" when it lands for good, "up" when standing again, or null.
export function stepTumble(body, boxes, dt) {
  const tb = body.tumble;
  tb.t += dt;
  if (tb.phase === "air") {
    const vyBefore = body.vy,
      kx = body.kx || 0,
      kz = body.kz || 0;
    stepBody(body, { x: 0, z: 0 }, boxes, dt);
    // Spin: rotate by the angular velocity (world axes).
    const w = tb.w,
      a = Math.hypot(...w) * dt;
    if (a > 1e-6) tb.q = qnorm(qmul(qaxis(w[0] / (a / dt), w[1] / (a / dt), w[2] / (a / dt), a), tb.q));
    if (body.grounded) {
      // A hard landing bounces; slower ones stay down.
      if (vyBefore < -6.5 && tb.bounces < 2) {
        body.vy = -vyBefore * 0.32;
        body.grounded = false;
        body.kx = kx * 0.55;
        body.kz = kz * 0.55;
        tb.w = tb.w.map((v) => v * 0.5);
        tb.bounces++;
        return null;
      }
      const rest = restFor(tb.q);
      Object.assign(tb, { phase: "down", t: 0, from: tb.q, rest });
      body.kx = kx * 0.3;
      body.kz = kz * 0.3;
      return "down";
    }
    return null;
  }
  if (tb.phase === "down") {
    stepBody(body, { x: 0, z: 0 }, boxes, dt);
    tb.q = qslerp(tb.from, tb.rest.q, ease(tb.t / 0.22));
    if (tb.t >= DOWN_TIME) Object.assign(tb, { phase: "up", t: 0, from: tb.q, standing: qyaw(tb.rest.yaw) });
    return null;
  }
  stepBody(body, { x: 0, z: 0 }, boxes, dt);
  tb.q = qslerp(tb.from, tb.standing, ease(tb.t / UP_TIME));
  if (tb.t >= UP_TIME) {
    body.angle = tb.rest.yaw;
    body.tumble = null;
    return "up";
  }
  return null;
}
// Phase codes for the pose: 1 flying, 2 down, 3 getting up.
export const PHASES = { air: 1, down: 2, up: 3 };
