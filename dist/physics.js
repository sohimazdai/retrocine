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
// Sloped colliders: "ramp" (straight wedge, height h0 → h1 along axis) and "qpipe" (quarter pipe,
// a concave curve rising toward the dir side, as tall as h). Their top surface carries bodies and balls.
export const sloped = (b) => b.shape === "ramp" || b.shape === "qpipe";
export function surfaceOf(b, x, z) {
  if (!sloped(b)) return b.h;
  const u = clamp(b.axis === "x" ? (x - (b.x - b.w / 2)) / b.w : (z - (b.z - b.d / 2)) / b.d, 0, 1);
  if (b.shape === "ramp") return b.h0 + (b.h1 - b.h0) * u;
  const t = b.dir < 0 ? 1 - u : u;
  return b.h - Math.sqrt(Math.max(0, 1 - t * t)) * b.h;
}
// Downhill direction and steepness on a sloped collider at (x, z): { x, z, slope }.
export function downhill(b, x, z) {
  const e = 0.05,
    ax = b.axis === "x";
  const hi = surfaceOf(b, x + (ax ? e : 0), z + (ax ? 0 : e)),
    lo = surfaceOf(b, x - (ax ? e : 0), z - (ax ? 0 : e));
  const slope = (hi - lo) / (2 * e);
  return { x: ax ? -Math.sign(slope) : 0, z: ax ? 0 : -Math.sign(slope), slope: Math.abs(slope) };
}
export function inside(x, z, b, pad = 0) {
  if (b.shape === "cylinder")
    return Math.hypot(x - b.x, z - b.z) < b.radius + pad;
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
export const STEP_UP = 0.35;
export function stepBody(body, move, boxes, dt, speedScale = 1) {
  let oldY = body.y;
  const oldX = body.x,
    oldZ = body.z;
  const len = Math.hypot(move.x, move.z) || 1;
  const kx = body.kx || 0,
    kz = body.kz || 0;
  body.x = clamp(
    body.x + (move.x / Math.max(1, len)) * SPEED * speedScale * dt + kx * dt,
    -LIMITS.x,
    LIMITS.x,
  );
  body.z = clamp(
    body.z + (move.z / Math.max(1, len)) * SPEED * speedScale * dt + kz * dt,
    floorBack(body.x) + RADIUS,
    LIMITS.z,
  );
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
      }
    }
  for (const b of boxes) resolveHorizontal(body, b);
  // Slopes: walk up gentle ones; a side higher than a step, or one too steep to walk (the top of a
  // quarter pipe), blocks like a wall.
  const moved = Math.hypot(body.x - oldX, body.z - oldZ);
  for (const b of boxes) {
    if (!sloped(b) || !inside(body.x, body.z, b)) continue;
    const rise = surfaceOf(b, body.x, body.z) - oldY;
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
  cube.vy = Math.max(cube.vy, 2.7);
  cube.spin = (cube.spin || 0) + 3.5;
}
export function stepCube(c, boxes, dt) {
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  c.vy -= GRAVITY * dt;
  c.y += c.vy * dt;
  let surface = 0,
    support = null;
  for (const b of boxes) {
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
    const f = Math.exp(-(c.friction ?? 3.2) * dt);
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
