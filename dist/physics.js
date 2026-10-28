import { ROOM, floorBack } from "./layout.js";

export const GRAVITY = 36,
  JUMP_SPEED = 12.8,
  SPEED = 5.1,
  SPRINT = 1.7,
  RADIUS = 0.28;
export const LIMITS = { x: ROOM.halfWidth - 0.35, z: ROOM.front - 0.35 };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function jump(body) {
  if (!body.grounded) return false;
  body.vy = JUMP_SPEED;
  body.grounded = false;
  return true;
}
// Sloped colliders: "ramp" (straight wedge, height h0 → h1 along axis), "qpipe" (quarter pipe,
// a concave curve rising toward the dir side, as tall as h) and "path" (a road of a given width along
// a polyline of [x, z, y] points: hills, embankments and bridges). Their top surface carries bodies
// and balls.
export const sloped = (b) => b.shape === "ramp" || b.shape === "qpipe" || b.shape === "path";
// ——— Paths ———
const pathCache = new WeakMap();
function pathData(b) {
  let d = pathCache.get(b);
  if (d) return d;
  const pts = b.points,
    segs = [];
  let x0 = Infinity,
    x1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity;
  for (let i = 0; i < pts.length - (b.closed ? 0 : 1); i++) {
    const a = pts[i],
      c = pts[(i + 1) % pts.length],
      dx = c[0] - a[0],
      dz = c[1] - a[1];
    segs.push({ ax: a[0], az: a[1], ay: a[2] || 0, dx, dz, dy: (c[2] || 0) - (a[2] || 0), l2: dx * dx + dz * dz || 1e-9 });
  }
  for (const p of pts) {
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
    z0 = Math.min(z0, p[1]);
    z1 = Math.max(z1, p[1]);
  }
  const pad = b.width / 2;
  d = { segs, x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad };
  pathCache.set(b, d);
  return d;
}
// The nearest point of a path's centreline: distance, height there, and the unit vector pointing
// from the centreline out to (x, z).
export function pathNearest(b, x, z) {
  const { segs } = pathData(b);
  let best = { d: Infinity, y: 0, nx: 1, nz: 0 };
  for (const s of segs) {
    const t = clamp(((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.l2, 0, 1),
      px = s.ax + s.dx * t,
      pz = s.az + s.dz * t,
      ox = x - px,
      oz = z - pz,
      d = Math.hypot(ox, oz);
    if (d < best.d) best = { d, y: s.ay + s.dy * t, nx: d > 1e-6 ? ox / d : -s.dz / Math.sqrt(s.l2), nz: d > 1e-6 ? oz / d : s.dx / Math.sqrt(s.l2) };
  }
  return best;
}
// Under a bridge (a path well above you that is not solid ground beneath) you pass freely.
export const PATH_CLEARANCE = 1.5;
export function surfaceOf(b, x, z) {
  if (b.shape === "path") return pathNearest(b, x, z).y;
  if (!sloped(b)) return b.h;
  const u = clamp(b.axis === "x" ? (x - (b.x - b.w / 2)) / b.w : (z - (b.z - b.d / 2)) / b.d, 0, 1);
  if (b.shape === "ramp") return b.h0 + (b.h1 - b.h0) * u;
  const t = b.dir < 0 ? 1 - u : u;
  return b.h - Math.sqrt(Math.max(0, 1 - t * t)) * b.h;
}
// Downhill direction and steepness on a sloped collider at (x, z): { x, z, slope }.
export function downhill(b, x, z) {
  const e = 0.05;
  if (b.shape === "path") {
    const gx = (surfaceOf(b, x + e, z) - surfaceOf(b, x - e, z)) / (2 * e),
      gz = (surfaceOf(b, x, z + e) - surfaceOf(b, x, z - e)) / (2 * e),
      g = Math.hypot(gx, gz) || 1;
    return { x: -gx / g, z: -gz / g, slope: Math.hypot(gx, gz) };
  }
  const ax = b.axis === "x";
  const hi = surfaceOf(b, x + (ax ? e : 0), z + (ax ? 0 : e)),
    lo = surfaceOf(b, x - (ax ? e : 0), z - (ax ? 0 : e));
  const slope = (hi - lo) / (2 * e);
  return { x: ax ? -Math.sign(slope) : 0, z: ax ? 0 : -Math.sign(slope), slope: Math.abs(slope) };
}
export function inside(x, z, b, pad = 0) {
  if (b.shape === "cylinder")
    return Math.hypot(x - b.x, z - b.z) < b.radius + pad;
  if (b.shape === "path") {
    const d = pathData(b);
    if (x < d.x0 - pad || x > d.x1 + pad || z < d.z0 - pad || z > d.z1 + pad) return false;
    return pathNearest(b, x, z).d < b.width / 2 + pad;
  }
  return Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad;
}
export function resolveHorizontal(body, box) {
  if (sloped(box)) return;
  if (body.y >= box.h - 0.035 || body.y + 1.55 <= (box.y || 0)) return;
  if (box.shape === "cylinder") {
    const dx = body.x - box.x,
      dz = body.z - box.z,
      d = Math.hypot(dx, dz);
    if (d < box.radius + RADIUS) {
      const nx = d > 0.001 ? dx / d : 1,
        nz = d > 0.001 ? dz / d : 0;
      body.x = box.x + nx * (box.radius + RADIUS);
      body.z = box.z + nz * (box.radius + RADIUS);
    }
    return;
  }
  const nearX = clamp(body.x, box.x - box.w / 2, box.x + box.w / 2),
    nearZ = clamp(body.z, box.z - box.d / 2, box.z + box.d / 2);
  const dx = body.x - nearX,
    dz = body.z - nearZ,
    d = Math.hypot(dx, dz);
  if (d >= RADIUS) return;
  if (d > 0.0001) {
    body.x += (dx / d) * (RADIUS - d);
    body.z += (dz / d) * (RADIUS - d);
  } else {
    const choices = [
      {
        v: Math.abs(body.x - (box.x - box.w / 2 - RADIUS)),
        axis: "x",
        to: box.x - box.w / 2 - RADIUS,
      },
      {
        v: Math.abs(body.x - (box.x + box.w / 2 + RADIUS)),
        axis: "x",
        to: box.x + box.w / 2 + RADIUS,
      },
      {
        v: Math.abs(body.z - (box.z - box.d / 2 - RADIUS)),
        axis: "z",
        to: box.z - box.d / 2 - RADIUS,
      },
      {
        v: Math.abs(body.z - (box.z + box.d / 2 + RADIUS)),
        axis: "z",
        to: box.z + box.d / 2 + RADIUS,
      },
    ].sort((a, b) => a.v - b.v);
    body[choices[0].axis] = choices[0].to;
  }
}
// speedScale > 1 is a sprint (Shift). kx/kz is knockback from hits and explosions: it carries the
// body on its own and fades, quickly on the ground and slowly in the air.
// ice: skating — you speed up and slow down gradually and glide on; ivx/ivz carry the momentum.
export const STEP_UP = 0.35,
  ICE = { accel: 5.2, glide: 1.3, top: 1.25 };
export function stepBody(body, move, boxes, dt, speedScale = 1, ice = false) {
  let oldY = body.y;
  const oldX = body.x,
    oldZ = body.z;
  const len = Math.hypot(move.x, move.z) || 1;
  let kx = body.kx || 0,
    kz = body.kz || 0;
  let vx = (move.x / Math.max(1, len)) * SPEED * speedScale,
    vz = (move.z / Math.max(1, len)) * SPEED * speedScale;
  if (ice) {
    // Knocks join the glide; you steer by pushing, not by stopping dead.
    let ivx = (body.ivx || 0) + kx,
      ivz = (body.ivz || 0) + kz;
    kx = kz = body.kx = body.kz = 0;
    const tx = vx * ICE.top,
      tz = vz * ICE.top,
      dvx = (move.x || move.z ? tx : 0) - ivx,
      dvz = (move.x || move.z ? tz : 0) - ivz,
      dl = Math.hypot(dvx, dvz),
      k = dl > 0 ? Math.min(1, ((move.x || move.z ? ICE.accel : ICE.glide) * dt) / dl) : 0;
    vx = ivx + dvx * k;
    vz = ivz + dvz * k;
  }
  body.x = clamp(body.x + vx * dt + kx * dt, -LIMITS.x, LIMITS.x);
  body.z = clamp(body.z + vz * dt + kz * dt, floorBack(body.x) + RADIUS, LIMITS.z);
  if (kx || kz) {
    const fade = Math.exp(-(body.grounded ? 6 : 1.1) * dt);
    body.kx = kx * fade;
    body.kz = kz * fade;
    if (Math.hypot(body.kx, body.kz) < 0.05) body.kx = body.kz = 0;
  }
  // Low ledges (a stair's last step, a flat stone) are stepped onto without jumping.
  if (body.grounded)
    for (const b of boxes) {
      if (sloped(b) || (b.y || 0) > body.y + STEP_UP) continue;
      const rise = b.h - body.y;
      if (rise > 0.02 && rise <= STEP_UP && inside(body.x, body.z, b, RADIUS * 0.85)) {
        body.y = b.h;
        oldY = b.h;
        // Up onto it: your feet (the centre) go onto the step, not hang over its edge.
        if (!inside(body.x, body.z, b, 0.02)) {
          if (b.shape === "cylinder") {
            const dx = body.x - b.x,
              dz = body.z - b.z,
              d = Math.hypot(dx, dz) || 1,
              k = Math.max(0, b.radius - 0.04) / d;
            body.x = b.x + dx * Math.min(1, k);
            body.z = b.z + dz * Math.min(1, k);
          } else {
            body.x = clamp(body.x, b.x - b.w / 2 + 0.04, b.x + b.w / 2 - 0.04);
            body.z = clamp(body.z, b.z - b.d / 2 + 0.04, b.z + b.d / 2 - 0.04);
          }
        }
      }
    }
  for (const b of boxes) resolveHorizontal(body, b);
  // Slopes: walk up gentle ones; a side higher than a step, or one too steep to walk (the top of a
  // quarter pipe), blocks like a wall.
  const moved = Math.hypot(body.x - oldX, body.z - oldZ);
  for (const b of boxes) {
    if (!sloped(b) || !inside(body.x, body.z, b)) continue;
    const rise = surfaceOf(b, body.x, body.z) - oldY;
    // A road's edge low enough to step onto; a bridge high overhead you walk under.
    if (b.shape === "path" && (rise <= STEP_UP || (!b.solid && rise > PATH_CLEARANCE))) continue;
    if (rise > 0.55 || rise > Math.max(0.004, moved * 1.2)) {
      const ok = (x, z) => !inside(x, z, b) || surfaceOf(b, x, z) - oldY <= Math.min(0.55, Math.max(0.004, Math.hypot(x - oldX, z - oldZ) * 1.2));
      if (ok(oldX, body.z)) body.x = oldX;
      else if (ok(body.x, oldZ)) body.z = oldZ;
      else {
        body.x = oldX;
        body.z = oldZ;
      }
    }
  }
  const wasGrounded = body.grounded,
    vyBefore = body.vy;
  body.vy -= (body.vy < 0 ? GRAVITY * 1.32 : GRAVITY) * dt;
  body.y += body.vy * dt;
  // Heads bump into platforms and bridges from below.
  if (body.vy > 0)
    for (const b of boxes)
      if (b.y && !sloped(b) && oldY + 1.55 <= b.y + 0.02 && body.y + 1.55 > b.y && inside(body.x, body.z, b)) {
        body.y = b.y - 1.55;
        body.vy = 0;
      }
  body.grounded = false;
  let surface = 0,
    support = null,
    snap = false;
  for (const b of boxes) {
    if (sloped(b)) {
      if (!inside(body.x, body.z, b, 0.02)) continue;
      const h = surfaceOf(b, body.x, body.z);
      // Stick to the slope while walking down it; land on it from above.
      if (body.vy <= 0 && body.y <= h + (wasGrounded ? 0.4 : 0) && oldY >= h - 0.6 && h >= surface) {
        surface = h;
        support = b;
        snap = wasGrounded;
      }
      continue;
    }
    if (inside(body.x, body.z, b, 0.04) && oldY >= b.h - 0.05 && body.y <= b.h && body.vy <= 0 && b.h >= surface) {
      surface = b.h;
      support = b;
      snap = false;
    }
  }
  if (body.y <= surface || (snap && support)) {
    body.y = surface;
    body.vy = 0;
    body.grounded = true;
    // Trampolines throw you back up, higher if you were falling fast (up to a limit).
    if (support?.bounce && vyBefore < -2) {
      body.vy = clamp(-vyBefore * 0.92, support.bounce, support.bounce * 1.3);
      body.grounded = false;
      body.bounced = (body.bounced || 0) + 1;
    } else if (support?.soft && vyBefore < -4) {
      // Inflatables and hay give a little: a smaller bounce that dies out.
      body.vy = -vyBefore * support.soft;
      body.grounded = false;
    }
    // Slides carry you down.
    if (support?.slide) {
      const d = downhill(support, body.x, body.z),
        a = (support.slide === true ? 16 : support.slide) * Math.min(1.5, d.slope) * dt;
      body.kx = (body.kx || 0) + d.x * a;
      body.kz = (body.kz || 0) + d.z * a;
    }
  }
  body.support = support;
  // What you actually moved by (after walls and boards) is the momentum you carry onto the ice.
  body.ivx = (body.x - oldX) / dt;
  body.ivz = (body.z - oldZ) / dt;
  return body;
}
export function kickCube(cube, from, power = 6) {
  let dx = cube.x - from.x,
    dz = cube.z - from.z,
    len = Math.hypot(dx, dz);
  if (len < 0.01) {
    dx = Math.sin(from.angle || 0);
    dz = Math.cos(from.angle || 0);
    len = 1;
  }
  cube.vx += (dx / len) * power;
  cube.vz += (dz / len) * power;
  // A puck is struck along the ice; a ball or a cube hops a little.
  cube.vy = Math.max(cube.vy, cube.flat ? 0.3 : 2.7);
  cube.spin = (cube.spin || 0) + 3.5;
}
// grip < 1: slippery ground (ice) — loose things slide much farther.
export function stepCube(c, boxes, dt, grip = 1) {
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  c.vy -= GRAVITY * dt;
  c.y += c.vy * dt;
  let surface = 0,
    support = null;
  for (const b of boxes) {
    if (b.shape === "path") {
      if (!inside(c.x, c.z, b, c.size / 2)) continue;
      const n = pathNearest(b, c.x, c.z),
        bottom = c.y - c.size / 2;
      if (bottom >= n.y - 0.45) {
        // On the road (or rolling up a gentle rise onto it).
        if (n.d < b.width / 2 && bottom < n.y + 0.25 && n.y >= surface) {
          surface = n.y;
          support = b;
        }
      } else if (b.solid || n.y - bottom < PATH_CLEARANCE) {
        // Against the side of an embankment: bounce off it.
        const push = b.width / 2 + c.size / 2 - n.d;
        if (push > 0) {
          c.x += n.nx * push;
          c.z += n.nz * push;
          const vn = c.vx * n.nx + c.vz * n.nz;
          if (vn < 0) {
            c.vx -= (1 + (c.restitution ?? 0.4)) * vn * n.nx;
            c.vz -= (1 + (c.restitution ?? 0.4)) * vn * n.nz;
          }
        }
      }
      continue;
    }
    if (sloped(b)) {
      if (!inside(c.x, c.z, b)) continue;
      const h = surfaceOf(b, c.x, c.z);
      if (c.y - c.size / 2 < h + 0.25 && h >= surface) {
        surface = h;
        support = b;
      }
      continue;
    }
    if (
      inside(c.x, c.z, b, c.size / 2) &&
      c.y - c.size / 2 < b.h &&
      c.y + c.size / 2 > (b.y || 0)
    ) {
      if (c.y - c.size / 2 > b.h - 0.3 && c.vy < 0) {
        if (b.h >= surface) support = b;
        surface = Math.max(surface, b.h);
      }
      else if (b.shape === "cylinder") {
        const dx = c.x - b.x,
          dz = c.z - b.z,
          d = Math.hypot(dx, dz);
        const nx = d > 0.001 ? dx / d : 1,
          nz = d > 0.001 ? dz / d : 0;
        c.x = b.x + nx * (b.radius + c.size / 2);
        c.z = b.z + nz * (b.radius + c.size / 2);
        const velocity = c.vx * nx + c.vz * nz;
        if (velocity < 0) {
          c.vx -= nx * velocity * 1.6;
          c.vz -= nz * velocity * 1.6;
        }
      } else {
        let dx = c.x - b.x,
          dz = c.z - b.z;
        const px = b.w / 2 + c.size / 2 - Math.abs(dx),
          pz = b.d / 2 + c.size / 2 - Math.abs(dz);
        if (px > 0 && pz > 0) {
          if (px < pz) {
            c.x += Math.sign(dx || 1) * px;
            c.vx *= -0.55;
          } else {
            c.z += Math.sign(dz || 1) * pz;
            c.vz *= -0.55;
          }
        }
      }
    }
  }
  if (c.y < c.size / 2 + surface) {
    c.y = c.size / 2 + surface;
    c.vy = Math.abs(c.vy) > 1 ? -c.vy * (c.restitution ?? 0.3) : 0;
    if (support?.bounce && c.vy >= 0) c.vy = Math.max(c.vy, support.bounce * 0.55);
    // On a slope a ball rolls downhill.
    if (support && sloped(support)) {
      const d = downhill(support, c.x, c.z),
        a = (GRAVITY * 0.55 * d.slope) / Math.sqrt(1 + d.slope * d.slope);
      c.vx += d.x * a * dt;
      c.vz += d.z * a * dt;
    }
    const f = Math.exp(-(c.friction ?? 3.2) * grip * dt);
    c.vx *= f;
    c.vz *= f;
    c.spin *= f;
  }
  for (const axis of ["x", "z"]) {
    const low = axis === "x" ? -LIMITS.x : floorBack(c.x) + c.size / 2;
    if (c[axis] < low || c[axis] > LIMITS[axis]) {
      c[axis] = clamp(c[axis], low, LIMITS[axis]);
      c["v" + axis] *= -0.6;
    }
  }
  c.rotation = (c.rotation || 0) + (c.spin || 0) * dt;
  return c;
}
export function collideCubes(a, b) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    d = Math.hypot(dx, dz),
    r = (a.size + b.size) * 0.52;
  if (d >= r || Math.abs(a.y - b.y) > (a.size + b.size) / 2) return;
  if (d < 0.001) {
    b.x += 0.01;
    return;
  }
  const nx = dx / d,
    nz = dz / d,
    over = (r - d) / 2;
  a.x -= nx * over;
  a.z -= nz * over;
  b.x += nx * over;
  b.z += nz * over;
  const relative = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
  if (relative > 0) {
    const impulse = relative * 0.8;
    a.vx -= nx * impulse;
    a.vz -= nz * impulse;
    b.vx += nx * impulse;
    b.vz += nz * impulse;
  }
}
