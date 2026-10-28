import test from "node:test";
import assert from "node:assert/strict";
import { findClimb, startClimb, stepClimb, zipStart, startZip, HANG } from "../dist/climbing.js";
import { stepBody, inside, sloped } from "../dist/physics.js";
import { mapDef } from "../dist/maps/index.js";
import { obstacles, defaultPositions } from "../dist/world.js";
import { PLATFORMS, ZIPS } from "../dist/maps/ropepark.js";

const park = mapDef("ropepark");
const boxes = obstacles(park, defaultPositions(park));
const DT = 1 / 120;
// Walk with `move` until something grabs you, then climb with `climb` until you are on top.
function walkAndClimb(body, move, climb = { x: 0, z: -1 }, seconds = 6) {
  let grabbed = null,
    result = null;
  for (let i = 0; i < seconds * 120 && result !== "top"; i++) {
    if (body.climb) result = stepClimb(body, climb, boxes, DT, false);
    else {
      const c = findClimb(park.climbs, body, move);
      if (c) {
        grabbed = c;
        startClimb(body, c);
      } else stepBody(body, move, boxes, DT);
    }
  }
  return { grabbed, result };
}
const standing = (p) => ({ x: p.x, z: p.z, y: 0, vy: 0, grounded: true, angle: 0 });

test("tree trunks: walk into one, climb up and come out through the hatch onto its platform", () => {
  const a = PLATFORMS.a;
  const body = standing({ x: a.x, z: a.z + 1.2 });
  const { grabbed, result } = walkAndClimb(body, { x: 0, z: -1 });
  assert.equal(grabbed?.id, "trunk-a");
  assert.equal(result, "top");
  assert(Math.abs(body.y - a.top) < 1e-6 && body.grounded);
  assert(inside(body.x, body.z, { x: a.x, z: a.z, w: a.w, d: a.d }), "standing on the platform");
  // And you stay there.
  for (let i = 0; i < 60; i++) stepBody(body, { x: 0, z: 0 }, boxes, DT);
  assert(Math.abs(body.y - a.top) < 1e-6);
});

test("the rope in front of the high platform, the tower wall and the cargo net all lead up", () => {
  const c = PLATFORMS.c;
  const rope = park.climbs.find((x) => x.id === "rope-c");
  let body = standing({ x: rope.x, z: rope.z + 1.5 });
  let r = walkAndClimb(body, { x: 0, z: -1 });
  assert.equal(r.grabbed?.id, "rope-c");
  assert.equal(r.result, "top");
  assert(Math.abs(body.y - c.top) < 1e-6, `on the high platform at ${body.y}`);
  const tower = park.statics.find((s) => s.kind === "tower");
  body = standing({ x: tower.x, z: tower.z + tower.d / 2 + 1.5 });
  r = walkAndClimb(body, { x: 0, z: -1 });
  assert.equal(r.grabbed?.id, "tower-front");
  assert(Math.abs(body.y - tower.h) < 1e-6);
  const d = PLATFORMS.d;
  body = standing({ x: d.x + d.w / 2 + 1.5, z: d.z });
  r = walkAndClimb(body, { x: -1, z: 0 });
  assert.equal(r.grabbed?.id, "net-d");
  assert(Math.abs(body.y - d.top) < 1e-6, `on platform d at ${body.y}`);
});

test("Space jumps off a rope; letting go at the bottom puts you back on your feet", () => {
  const rope = park.climbs.find((x) => x.id === "rope-beam");
  const body = standing({ x: rope.x, z: rope.z + 1 });
  walkAndClimb(body, { x: 0, z: -1 }, { x: 0, z: -1 }, 0.8);
  assert(body.climb && body.y > 0.5);
  assert.equal(stepClimb(body, { x: 0, z: 0 }, boxes, DT, true), "off");
  assert(body.vy > 0 && !body.climb);
  for (let i = 0; i < 240; i++) stepBody(body, { x: 0, z: 0 }, boxes, DT);
  assert(body.grounded);
  // You don't grab it again straight away.
  assert(body.climbCooldown > 0);
});

test("zip lines carry you from a high platform to a landing; their path is clear", () => {
  for (const zip of ZIPS) {
    const [fx, fy, fz] = zip.from;
    const body = { x: fx + 0.3, z: fz, y: fy - HANG, vy: 0, grounded: true, angle: 0 };
    assert(zipStart(zip, body), zip.id + " starts from its platform");
    startZip(body, zip);
    let t = 0,
      result = null;
    while (!result && t < 10) {
      result = stepClimb(body, { x: 0, z: 0 }, boxes, DT, false);
      t += DT;
      // Feet to head, nothing in the way between the platforms.
      if (!result && t > 0.25 && body.climb?.s < 0.93) {
        const hit = boxes.find((b) => !sloped(b) && b.kind !== "tree" && inside(body.x, body.z, b) && body.y < b.h - 0.05 && body.y + 1.5 > (b.y || 0));
        assert(!hit, `${zip.id}: hits ${hit?.kind} at ${body.x.toFixed(1)},${body.y.toFixed(1)},${body.z.toFixed(1)}`);
      }
    }
    assert.equal(result, "off");
    assert(t > 1 && t < 5, `${zip.id} took ${t.toFixed(1)} s`);
    for (let i = 0; i < 240; i++) stepBody(body, { x: 0, z: 0 }, boxes, DT);
    assert(body.grounded && body.y > 0.9, `${zip.id}: landed at ${body.y.toFixed(2)}`);
  }
});

test("a trampoline bounces you up onto the platform behind it; platforms stop your head from below", () => {
  const a = PLATFORMS.a;
  const tramp = park.statics.find((s) => s.kind === "trampoline" && s.x === a.x);
  const body = { x: tramp.x, z: tramp.z, y: 1.5, vy: 0, grounded: false };
  let onTop = false;
  for (let i = 0; i < 120 * 4 && !onTop; i++) {
    stepBody(body, body.y > a.top + 0.1 ? { x: 0, z: -1 } : { x: 0, z: 0 }, boxes, DT);
    onTop = body.grounded && Math.abs(body.y - a.top) < 1e-6;
  }
  assert(onTop, "bounced onto the platform");
  // Under a platform a jump stops at its floorboards.
  const under = { x: PLATFORMS.b.x + 0.9, z: PLATFORMS.b.z + 0.9, y: 0, vy: 12.8, grounded: false };
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    stepBody(under, { x: 0, z: 0 }, boxes, DT);
    peak = Math.max(peak, under.y);
  }
  assert(peak < PLATFORMS.b.top - 0.15 - 1.5, `head went to ${peak + 1.55}`);
});
