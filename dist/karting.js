// Go-karts: driven relative to the kart (W gas, S half brake and then reverse, Space full brake,
// A/D turn — also on the spot), with grip that lets the back step out a little, grass that slows
// you, walls and other karts you bounce off, avatars you knock flying, small jumps over humps,
// and lap timing through checkpoints. Pure logic, run by the browser for your own kart.
import { RADIUS, LIMITS, clamp, inside, sloped, surfaceOf } from "./physics.js";
import { floorBack } from "./layout.js";
import { surfaceUnder, gradient } from "./riding.js";

export const KART = {
  length: 1.5,
  width: 0.95,
  max: 9.5,
  reverse: 3,
  accel: 6.5,
  brake: 8,
  stop: 16,
  turn: 2.5,
  grip: 9,
  roll: 0.5,
  drag: 0.012,
  grass: { max: 4.2, drag: 2.2 },
  gravity: 24,
  // Two circles along the kart for walls, one bigger one for avatars and other karts.
  circle: 0.46,
  reach: 0.78,
};
const forward = (a) => ({ x: Math.sin(a), z: Math.cos(a) });
const left = (a) => ({ x: Math.cos(a), z: -Math.sin(a) });

// ——— The track: a closed centreline with a width; lines to cross for laps ———
function segmentDistance(px, pz, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = dx * dx + dz * dz || 1,
    t = clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / l, 0, 1);
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}
export function onTrack(track, x, z) {
  if (!track) return true;
  const pts = track.points;
  for (let i = 0; i < pts.length; i++) if (segmentDistance(x, z, pts[i], pts[(i + 1) % pts.length]) <= track.width / 2) return true;
  return false;
}
// +1 when moving from `a` to `b` crosses the line in its direction (left of a → b to its right), −1 the other way.
export function crossing(line, a, b) {
  const [x0, z0] = line.from,
    [x1, z1] = line.to;
  const side = (p) => (x1 - x0) * (p.z - z0) - (z1 - z0) * (p.x - x0);
  const sa = side(a),
    sb = side(b);
  if (sa === sb || (sa > 0) === (sb > 0)) return 0;
  // Within the line's extent.
  const t = sa / (sa - sb),
    px = a.x + (b.x - a.x) * t,
    pz = a.z + (b.z - a.z) * t;
  const u = ((px - x0) * (x1 - x0) + (pz - z0) * (z1 - z0)) / ((x1 - x0) ** 2 + (z1 - z0) ** 2);
  if (u < 0 || u > 1) return 0;
  return sa > 0 ? 1 : -1;
}
// Lap state: the next checkpoint to pass; the finish line ends a lap once all are passed in order.
// Returns { lap: seconds } when a lap is done, { start: true } when timing starts.
export function lapStep(lap, track, a, b, now) {
  if (!track?.finish) return null;
  const cps = track.checkpoints || [];
  if (lap.next < cps.length && crossing(cps[lap.next], a, b) > 0) lap.next++;
  if (crossing(track.finish, a, b) > 0) {
    if (lap.start == null || lap.next < cps.length) {
      const first = lap.start == null;
      lap.start = now;
      lap.next = 0;
      return first ? { start: true } : null;
    }
    const time = now - lap.start;
    lap.start = now;
    lap.next = 0;
    lap.best = Math.min(lap.best ?? Infinity, time);
    return { lap: time, best: lap.best === time };
  }
  return null;
}

export function enterKart(body, spawn, color) {
  body.kart = { vx: 0, vz: 0, steer: 0, color, lap: { next: 0, start: null, best: null }, bumped: {}, wheel: 0 };
  body.x = spawn.x;
  body.z = spawn.z;
  body.y = 0;
  body.vy = 0;
  body.kx = body.kz = 0;
  body.grounded = true;
  body.angle = spawn.a ?? 0;
}

// Walls: anything taller than a kerb that the kart's two circles run into.
function pushOut(c, b, y) {
  if (b.rail || sloped(b) || (b.y || 0) > y + 1.0 || b.h <= y + 0.28) return null;
  let nx, nz, d;
  if (b.shape === "cylinder") {
    const dx = c.x - b.x,
      dz = c.z - b.z;
    d = Math.hypot(dx, dz) - b.radius;
    nx = dx / (Math.hypot(dx, dz) || 1);
    nz = dz / (Math.hypot(dx, dz) || 1);
  } else {
    const qx = clamp(c.x, b.x - b.w / 2, b.x + b.w / 2),
      qz = clamp(c.z, b.z - b.d / 2, b.z + b.d / 2),
      dx = c.x - qx,
      dz = c.z - qz;
    d = Math.hypot(dx, dz);
    if (d < 1e-6) {
      // Centre inside the box: out the nearest side.
      const ox = b.w / 2 - Math.abs(c.x - b.x),
        oz = b.d / 2 - Math.abs(c.z - b.z);
      if (ox < oz) return { nx: Math.sign(c.x - b.x) || 1, nz: 0, depth: ox + KART.circle };
      return { nx: 0, nz: Math.sign(c.z - b.z) || 1, depth: oz + KART.circle };
    }
    nx = dx / d;
    nz = dz / d;
  }
  if (d >= KART.circle) return null;
  return { nx, nz, depth: KART.circle - d };
}

// input: { gas, brake, stop, turn } as for boards. world: { boxes, track, others } where others are
// remote karts { kind: "kart", id, x, z, vx, vz } and people on foot { kind: "avatar", id, x, z, y }.
// Returns events: { t: "wall", speed }, { t: "kart", id }, { t: "hit", id, v: [x, y, z] }.
export function stepKart(b, input, world, dt) {
  const k = b.kart,
    events = [];
  const f = forward(b.angle),
    l = left(b.angle);
  let vf = k.vx * f.x + k.vz * f.z,
    vl = k.vx * l.x + k.vz * l.z;
  const grass = !onTrack(world.track, b.x, b.z);
  const top = grass ? KART.grass.max : KART.max;
  if (b.grounded) {
    // Steering: on the spot too; a bit less sharp at full speed.
    const turn = clamp(input.turn || 0, -1, 1);
    k.steer += (turn - k.steer) * Math.min(1, dt * 10);
    b.angle += turn * KART.turn * (1 - 0.3 * Math.min(1, Math.abs(vf) / KART.max)) * dt;
    if (input.gas) {
      if (vf < -0.2) vf += KART.brake * dt;
      else if (vf < top) vf = Math.min(top, vf + KART.accel * dt);
    }
    if (input.brake) {
      if (vf > 0.2) vf -= KART.brake * 0.5 * dt;
      else vf = Math.max(-KART.reverse, vf - KART.accel * 0.5 * dt);
    }
    if (input.stop) {
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), KART.stop * dt);
      vl *= Math.exp(-6 * dt);
    }
    // Rolling resistance, air drag, grass; tyres hold the kart sideways but let it slide a little.
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), (KART.roll + KART.drag * vf * vf) * dt);
    if (grass) {
      vf *= Math.exp(-KART.grass.drag * dt * (Math.abs(vf) > top ? 1 : 0.25));
      if (Math.abs(vf) > top) vf -= Math.sign(vf) * Math.min(Math.abs(vf) - top, 6 * dt);
    }
    vl *= Math.exp(-KART.grip * dt);
  }
  const nf = forward(b.angle),
    nl = left(b.angle);
  if (b.grounded) {
    k.vx = nf.x * vf + nl.x * vl;
    k.vz = nf.z * vf + nl.z * vl;
  }
  b.x += k.vx * dt;
  b.z += k.vz * dt;
  // Walls and barriers: both ends of the kart bounce off them.
  for (const end of [0.42, -0.42]) {
    for (const box of world.boxes) {
      const c = { x: b.x + nf.x * end, z: b.z + nf.z * end };
      const hit = pushOut(c, box, b.y);
      if (!hit) continue;
      b.x += hit.nx * hit.depth;
      b.z += hit.nz * hit.depth;
      const vn = k.vx * hit.nx + k.vz * hit.nz;
      if (vn < 0) {
        k.vx -= hit.nx * vn * 1.35;
        k.vz -= hit.nz * vn * 1.35;
        k.vx *= 0.85;
        k.vz *= 0.85;
        if (vn < -3) events.push({ t: "wall", speed: -vn });
      }
    }
  }
  // The edges of the room.
  const lim = LIMITS.x - 0.25;
  if (Math.abs(b.x) > lim) {
    b.x = Math.sign(b.x) * lim;
    if (k.vx * Math.sign(b.x) > 0) k.vx *= -0.4;
  }
  const back = floorBack(b.x) + 0.6;
  if (b.z < back || b.z > LIMITS.z - 0.25) {
    b.z = clamp(b.z, back, LIMITS.z - 0.25);
    k.vz *= -0.4;
  }
  // Other karts and people.
  const now = world.now ?? 0;
  for (const o of world.others || []) {
    const dx = b.x - o.x,
      dz = b.z - o.z,
      d = Math.hypot(dx, dz);
    if (o.kind === "kart") {
      const reach = KART.reach * 2 * 0.85;
      if (d >= reach || d < 1e-6) continue;
      const nx = dx / d,
        nz = dz / d;
      b.x += nx * (reach - d) * 0.5;
      b.z += nz * (reach - d) * 0.5;
      const rel = (k.vx - (o.vx || 0)) * nx + (k.vz - (o.vz || 0)) * nz;
      if (rel < 0) {
        // Equal masses: you take half the closing speed back, plus a little bounce.
        k.vx -= nx * rel * 0.8;
        k.vz -= nz * rel * 0.8;
        if (rel < -2 && now - (k.bumped[o.id] || -9) > 0.5) {
          k.bumped[o.id] = now;
          events.push({ t: "kart", id: o.id, speed: -rel });
        }
      }
    } else {
      if (d >= KART.reach + RADIUS || Math.abs((o.y || 0) - b.y) > 1.2) continue;
      const speed = Math.hypot(k.vx, k.vz),
        rel = speed > 1e-6 ? -(k.vx * dx + k.vz * dz) / (d || 1) : 0;
      // Running into someone at speed throws them: along the kart's motion and up, harder the faster.
      if (rel > 2.2 && now - (k.bumped[o.id] || -9) > 1.0) {
        k.bumped[o.id] = now;
        const dir = { x: k.vx / speed, z: k.vz / speed },
          side = { x: -dx / (d || 1), z: -dz / (d || 1) };
        const s = Math.min(speed, 12);
        events.push({ t: "hit", id: o.id, v: [dir.x * s * 0.85 + side.x * 1.5, 3.5 + s * 0.65, dir.z * s * 0.85 + side.z * 1.5] });
        k.vx *= 0.78;
        k.vz *= 0.78;
      }
    }
  }
  // Ground: humps carry the kart up and, fast enough, over the crest into the air; off an edge it drops.
  if (b.grounded) {
    const g = surfaceUnder(world.boxes, b.x, b.z, b.y + 0.05);
    const gr = gradient(g.support, b.x, b.z),
      v = Math.hypot(k.vx, k.vz),
      dirx = v > 1e-6 ? k.vx / v : nf.x,
      dirz = v > 1e-6 ? k.vz / v : nf.z;
    // How fast the ground under the wheels rises along the way you are going.
    const vy = (gr.x * dirx + gr.z * dirz) * v,
      climb = k.climb || 0;
    k.pitch = Math.atan(gr.x * nf.x + gr.z * nf.z);
    if (climb > 1.2 && climb - vy > 2.5 && g.h < b.y + climb * dt) {
      // Over the top while still going up: fly on.
      b.vy = climb;
      b.grounded = false;
    } else if (g.h < b.y - 0.12) {
      b.vy = Math.min(0, climb);
      b.grounded = false;
    } else {
      b.y = g.h;
      b.vy = 0;
    }
    k.climb = b.grounded ? vy : 0;
  } else {
    b.vy -= KART.gravity * dt;
    b.y += b.vy * dt;
    k.pitch *= Math.exp(-dt * 3);
    const g = surfaceUnder(world.boxes, b.x, b.z, b.y - b.vy * dt);
    if (b.y <= g.h) {
      b.y = g.h;
      if (b.vy < -6) events.push({ t: "land", speed: -b.vy });
      b.vy = 0;
      b.grounded = true;
    }
  }
  k.wheel += (vf * dt) / 0.16;
  return events;
}
