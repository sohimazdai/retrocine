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
export function inside(x, z, b, pad = 0) {
  if (b.shape === "cylinder")
    return Math.hypot(x - b.x, z - b.z) < b.radius + pad;
  return Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad;
}
export function resolveHorizontal(body, box) {
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
export function stepBody(body, move, boxes, dt, speedScale = 1) {
  const oldY = body.y;
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
  for (const b of boxes) resolveHorizontal(body, b);
  body.vy -= (body.vy < 0 ? GRAVITY * 1.32 : GRAVITY) * dt;
  body.y += body.vy * dt;
  body.grounded = false;
  let surface = 0;
  for (const b of boxes)
    if (
      inside(body.x, body.z, b, 0.04) &&
      oldY >= b.h - 0.05 &&
      body.y <= b.h &&
      body.vy <= 0
    )
      surface = Math.max(surface, b.h);
  if (body.y <= surface) {
    body.y = surface;
    body.vy = 0;
    body.grounded = true;
  }
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
  let surface = 0;
  for (const b of boxes) {
    if (
      inside(c.x, c.z, b, c.size / 2) &&
      c.y - c.size / 2 < b.h &&
      c.y + c.size / 2 > (b.y || 0)
    ) {
      if (c.y - c.size / 2 > b.h - 0.3 && c.vy < 0)
        surface = Math.max(surface, b.h);
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
