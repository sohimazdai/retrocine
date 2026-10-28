import test from "node:test";
import assert from "node:assert/strict";
import { startTumble, stepTumble, restFor, centerHeight, qaxis, qmul, qrot, qyaw, qslerp, DOWN_TIME, UP_TIME, CENTER } from "../dist/tumble.js";
import { mapDef } from "../dist/maps/index.js";
import { obstacles, defaultPositions } from "../dist/world.js";
import { LIMITS } from "../dist/physics.js";

const race = mapDef("race");
const boxes = obstacles(race, defaultPositions(race));
const DT = 1 / 120;
const near = (a, b, e = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < e);
const person = (x = -4, z = 6, angle = 0) => ({ x, z, y: 0, vy: 0, grounded: true, angle });
// Runs the whole fall; returns what happened along the way.
function fall(b, v, seed) {
  startTumble(b, v, seed);
  const log = { top: 0, bounces: 0, spun: 0, minY: Infinity, phases: [], rest: null, steps: 0 };
  let q = b.tumble.q;
  for (let i = 0; i < 8 * 120 && b.tumble; i++) {
    const r = stepTumble(b, boxes, DT);
    log.steps++;
    if (r) log.phases.push(r);
    if (!b.tumble) break;
    log.top = Math.max(log.top, b.y);
    log.minY = Math.min(log.minY, b.y);
    log.bounces = b.tumble.bounces;
    if (b.tumble.phase === "air") log.spun += Math.acos(Math.min(1, Math.abs(q[0] * b.tumble.q[0] + q[1] * b.tumble.q[1] + q[2] * b.tumble.q[2] + q[3] * b.tumble.q[3]))) * 2;
    q = b.tumble.q;
    if (r === "down") log.rest = b.tumble.rest;
  }
  return log;
}

test("quaternions: turning about an axis, combining turns, blending between them", () => {
  assert(near(qrot(qyaw(Math.PI / 2), [0, 0, 1]), [1, 0, 0]), "a quarter yaw turns forward (+z) to +x");
  assert(near(qrot(qaxis(1, 0, 0, -Math.PI / 2), [0, 0, 1]), [0, 1, 0]), "pitching back points the face up");
  const both = qmul(qyaw(Math.PI / 2), qaxis(1, 0, 0, -Math.PI / 2));
  assert(near(qrot(both, [0, 1, 0]), [-1, 0, 0]), "the second turn applies first: pitch back, then yaw");
  const half = qslerp([0, 0, 0, 1], qyaw(Math.PI), 0.5);
  assert(near(qrot(half, [0, 0, 1]), [1, 0, 0], 1e-6), "halfway round is a quarter turn");
});

test("how you come down decides how you lie: on your back, front, either side, or sitting", () => {
  const cases = [
    [qaxis(1, 0, 0, -1.3), "back"],
    [qaxis(1, 0, 0, 1.3), "front"],
    [qaxis(0, 0, 1, -1.3), "left"],
    [qaxis(0, 0, 1, 1.3), "right"],
    [qaxis(1, 0, 0, 0.2), "sit"],
  ];
  for (const [q, kind] of cases) {
    const twisted = qmul(qyaw(0.8), q);
    const r = restFor(twisted);
    assert.equal(r.kind, kind);
    if (kind === "sit") assert(Math.abs(r.yaw - 0.8) < 1e-6, "sitting keeps facing the same way");
    // Lying: flat, low to the ground.
    if (kind !== "sit") {
      assert(Math.abs(qrot(r.q, [0, 1, 0])[1]) < 1e-6, `${kind}: the body lies flat`);
      assert(centerHeight(r.q, kind) < 0.25);
    } else assert(centerHeight(r.q, kind) < CENTER - 0.3);
  }
  // On the back the face is up, on the front it is down.
  assert(qrot(restFor(qaxis(1, 0, 0, -1.3)).q, [0, 0, 1])[1] > 0.99);
  assert(qrot(restFor(qaxis(1, 0, 0, 1.3)).q, [0, 0, 1])[1] < -0.99);
  // Standing: the middle is at the standard height.
  assert.equal(centerHeight([0, 0, 0, 1], "back"), CENTER);
});

test("knocked by a kart you fly along the hit, tumbling, bounce, lie down a while and get back up", () => {
  const b = person();
  const log = fall(b, [8, 9, 0.5], 0.3);
  assert(log.top > 1, `thrown up: ${log.top}`);
  assert(log.minY >= -1e-9, "never through the floor");
  assert(log.spun > Math.PI * 1.5, `head over heels in the air: ${log.spun}`);
  assert(log.bounces >= 1, "a hard landing bounces");
  assert.deepEqual(log.phases, ["down", "up"]);
  assert(log.rest && ["back", "front", "left", "right", "sit"].includes(log.rest.kind));
  assert(b.x > -4 + 3, `carried along: ${b.x}`);
  assert(Math.abs(b.x) <= LIMITS.x + 1e-6 && b.z <= LIMITS.z + 1e-6, "stays in the room");
  const airTime = log.steps * DT - DOWN_TIME - UP_TIME;
  assert(airTime > 0.6 && airTime < 3, `in the air for ${airTime}s`);
  assert(b.tumble === null && Math.abs(b.angle - log.rest.yaw) < 1e-9, "up again, facing where the head pointed");
});

test("different hits leave you on different parts of the body", () => {
  const kinds = new Set();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2,
      s = 3 + (i % 5) * 2;
    const log = fall(person(0, 0, i * 0.7), [Math.sin(a) * s, 3 + s * 0.6, Math.cos(a) * s], (i * 0.618) % 1);
    kinds.add(log.rest.kind);
  }
  assert(kinds.size >= 4, `came down as ${[...kinds]}`);
});

test("a tumble into a wall stops at the wall", () => {
  const wall = boxes.find((o) => o.kind === "wall" && o.x > 11);
  const b = person(wall.x - 2, 0.2);
  fall(b, [14, 6, 0], 0.5);
  assert(b.x < wall.x - wall.w / 2, `stopped by the wall: ${b.x}`);
});
