import test from "node:test";
import assert from "node:assert/strict";
import {
  jump,
  stepBody,
  kickCube,
  stepCube,
  collideCubes,
} from "../dist/physics.js";
const box = { x: 0, z: 0, w: 2.8, d: 2.8, h: 1.65 };
const body = (x = 0, z = 0) => ({ x, z, y: 0, vy: 0, grounded: true });
test("jump leaves floor, rejects double jump and lands", () => {
  const p = body();
  assert(jump(p));
  assert(!jump(p));
  let max = 0;
  for (let i = 0; i < 140; i++) {
    stepBody(p, { x: 0, z: 0 }, [], 1 / 120);
    max = Math.max(max, p.y);
  }
  assert(max > 2.1);
  assert.equal(p.y, 0);
  assert(p.grounded);
});

test("jump remains tall enough for the cube but completes in under three quarters of a second", () => {
  const p = body();
  jump(p);
  let duration = 0,
    peak = 0;
  do {
    stepBody(p, { x: 0, z: 0 }, [], 1 / 120);
    duration += 1 / 120;
    peak = Math.max(peak, p.y);
  } while (!p.grounded && duration < 2);
  assert(peak > 2.1);
  assert(duration < 0.75);
});
test("big cube blocks walking through its sides", () => {
  const p = body(0, 2.2);
  for (let i = 0; i < 80; i++) stepBody(p, { x: 0, z: -1 }, [box], 1 / 120);
  assert(p.z >= 1.67);
  assert.equal(p.y, 0);
});
test("avatar can jump onto the big cube and fall when leaving", () => {
  const p = body(0, 2.2);
  jump(p);
  let landed = false;
  for (let i = 0; i < 140; i++) {
    stepBody(p, { x: 0, z: p.z > 0.3 ? -1 : 0 }, [box], 1 / 120);
    if (p.grounded && p.y === box.h) landed = true;
  }
  assert(landed);
  assert.equal(p.y, box.h);
  for (let i = 0; i < 200; i++) stepBody(p, { x: 1, z: 0 }, [box], 1 / 120);
  assert.equal(p.y, 0);
});
test("kick imparts momentum, bounce and damping", () => {
  const c = { x: 1, z: 0, y: 0.3, size: 0.6, vx: 0, vy: 0, vz: 0, spin: 0 };
  kickCube(c, { x: 0, z: 0 });
  assert(c.vx > 0);
  assert(c.vy > 0);
  for (let i = 0; i < 600; i++) stepCube(c, [], 1 / 120);
  assert(c.x > 2);
  assert(Math.abs(c.vx) < 0.01);
  assert.equal(c.y, 0.3);
});
test("cube collision transfers momentum", () => {
  const a = { x: 0, z: 0, y: 0.3, size: 0.6, vx: 4, vz: 0 },
    b = { x: 0.5, z: 0, y: 0.3, size: 0.6, vx: 0, vz: 0 };
  collideCubes(a, b);
  assert(b.vx > 0);
  assert(a.vx < 4);
  assert(b.x - a.x >= 0.62);
});

import { surfaceOf } from "../dist/physics.js";
import { colliderEdges } from "../dist/hitboxes.js";
test("trampolines throw you back up; a ball bounces higher on them", () => {
  const tramp = { x: 0, z: 0, w: 3, d: 3, h: 0.5, bounce: 14 };
  const p = { x: 0, z: 0, y: 2.5, vy: 0, grounded: false };
  let bounced = false,
    peak = 0;
  for (let i = 0; i < 240; i++) {
    stepBody(p, { x: 0, z: 0 }, [tramp], 1 / 120);
    if (p.bounced) bounced = true;
    if (bounced) peak = Math.max(peak, p.y);
  }
  assert(bounced);
  assert(peak > 3, `peak ${peak}`);
  const ball = { x: 0, z: 0, y: 3, vx: 0, vy: 0, vz: 0, size: 0.6, restitution: 0.3, friction: 1, spin: 0 };
  let up = 0;
  for (let i = 0; i < 120; i++) {
    stepCube(ball, [tramp], 1 / 120);
    up = Math.max(up, ball.vy);
  }
  assert(up > 6, `ball rebound ${up}`);
});

test("ramps carry you up and balls roll down them; a quarter pipe's tall lip blocks like a wall", () => {
  const ramp = { shape: "ramp", x: 0, z: 0, w: 6, d: 3, h: 1.2, h0: 0, h1: 1.2, axis: "x" };
  assert.equal(surfaceOf(ramp, -3, 0), 0);
  assert(Math.abs(surfaceOf(ramp, 0, 0) - 0.6) < 1e-9);
  const p = { x: -4, z: 0, y: 0, vy: 0, grounded: true };
  for (let i = 0; i < 120 * 1.1; i++) stepBody(p, { x: 1, z: 0 }, [ramp], 1 / 120);
  assert(p.x > 1, `walked to ${p.x}`);
  assert(Math.abs(p.y - surfaceOf(ramp, p.x, p.z)) < 0.02 && p.grounded);
  // Walking back down keeps your feet on the slope instead of hopping.
  for (let i = 0; i < 60; i++) {
    stepBody(p, { x: -1, z: 0 }, [ramp], 1 / 120);
    assert(p.grounded && Math.abs(p.y - surfaceOf(ramp, p.x, p.z)) < 0.02, `step ${i}: ${p.y} vs ${surfaceOf(ramp, p.x, p.z)}`);
  }
  const ball = { x: 2.5, z: 0, y: 1.5, vx: 0, vy: 0, vz: 0, size: 0.6, restitution: 0.3, friction: 0.4, spin: 0 };
  for (let i = 0; i < 120; i++) stepCube(ball, [ramp], 1 / 120);
  assert(ball.vx < -1 && ball.x < 2.5, `ball ${ball.x} ${ball.vx}`);
  const pipe = { shape: "qpipe", x: 0, z: 0, w: 3, d: 4, h: 2.4, axis: "x", dir: 1 };
  assert(surfaceOf(pipe, -1.5, 0) < 0.01);
  assert(Math.abs(surfaceOf(pipe, 1.5, 0) - 2.4) < 1e-9);
  const q = { x: 2.2, z: 0, y: 0, vy: 0, grounded: true };
  for (let i = 0; i < 120; i++) stepBody(q, { x: -1, z: 0 }, [pipe], 1 / 120);
  assert(q.x >= 1.5, `walked into the lip: ${q.x}`);
});

test("hitbox wireframes trace boxes, cylinders and sloped surfaces", () => {
  const boxEdges = colliderEdges({ x: 1, z: 2, w: 2, d: 4, h: 3 });
  assert.equal(boxEdges.length, 12 * 6);
  const xs = boxEdges.filter((_, i) => i % 3 === 0);
  assert.equal(Math.min(...xs), 0);
  assert.equal(Math.max(...xs), 2);
  const cyl = colliderEdges({ shape: "cylinder", x: 0, z: 0, radius: 1.25, h: 1.9 });
  for (let i = 0; i < cyl.length; i += 3) assert(Math.hypot(cyl[i], cyl[i + 2]) < 1.2501);
  const ramp = { shape: "ramp", x: 0, z: 0, w: 4, d: 2, h0: 0, h1: 2, h: 2, axis: "x" };
  const pts = colliderEdges(ramp);
  for (let i = 0; i < pts.length; i += 3) assert(pts[i + 1] <= surfaceOf(ramp, pts[i], pts[i + 2]) + 1e-9);
});
