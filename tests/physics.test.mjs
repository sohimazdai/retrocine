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
