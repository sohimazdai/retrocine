// The strips along the left and right edges of every map: things to climb, hang from, walk up.
import test from "node:test";
import assert from "node:assert/strict";
import { findClimb, startClimb, stepClimb, findBar, startBar, zipStart, startZip, HANG, BAR_HANG } from "../dist/climbing.js";
import { stepBody, stepCube, inside } from "../dist/physics.js";
import { mapDef } from "../dist/maps/index.js";
import { obstacles, defaultPositions } from "../dist/world.js";
import { setRoomScale } from "../dist/layout.js";
import { createState, stepWorld, applyOp } from "../dist/state.js";

const DT = 1 / 120;
const world = (id) => {
  const map = mapDef(id);
  setRoomScale(map.scale || 1);
  return { map, boxes: obstacles(map, defaultPositions(map)) };
};
const standing = (x, z, y = 0) => ({ x, z, y, vy: 0, grounded: true, angle: 0 });
// Walk with `move` until something is grabbed, then climb with `climb` until on top.
function walkAndClimb({ map, boxes }, body, move, climb = { x: 0, z: -1 }, seconds = 6) {
  let grabbed = null,
    result = null;
  for (let i = 0; i < seconds * 120 && result !== "top"; i++) {
    if (body.climb) result = stepClimb(body, climb, boxes, DT, false);
    else {
      const c = findClimb(map.climbs, body, move);
      if (c) {
        grabbed = c;
        startClimb(body, c);
      } else stepBody(body, move, boxes, DT);
    }
  }
  return { grabbed, result };
}
const walk = ({ boxes }, body, move, seconds) => {
  for (let i = 0; i < seconds * 120; i++) stepBody(body, move, boxes, DT);
  return body;
};

test("playground: hand over hand along the monkey bars from one landing to the other", () => {
  const w = world("playground");
  const bars = w.map.climbs.find((c) => c.id === "monkey-bars");
  const start = w.map.statics.find((s) => s.kind === "landing" && s.z < bars.z);
  const body = standing(start.x, start.z, start.h);
  const bar = findBar(w.map.climbs, body, true);
  assert.equal(bar?.id, "monkey-bars", "E on the landing reaches the bars");
  startBar(body, bar);
  assert(Math.abs(body.y - (bar.y - BAR_HANG)) < 1e-9 && body.y > 0.3, "hanging with feet off the ground");
  let result = null;
  for (let i = 0; i < 120 * 4 && result !== "top"; i++) result = stepClimb(body, { x: 0, z: 1 }, w.boxes, DT, false);
  assert.equal(result, "top");
  const end = w.map.statics.find((s) => s.kind === "landing" && s.z > bars.z);
  assert(Math.abs(body.y - end.h) < 1e-9 && Math.abs(body.z - end.z) < end.d, `on the far landing at ${body.z.toFixed(2)}, ${body.y}`);
  // Jumping up from underneath catches the bars too.
  const under = { x: bars.x, z: bars.z, y: 0, vy: 12.8, grounded: false, angle: 0 };
  let caught = null;
  for (let i = 0; i < 120 && !caught; i++) {
    caught = findBar(w.map.climbs, under);
    if (!caught) stepBody(under, { x: 0, z: 0 }, w.boxes, DT);
  }
  assert.equal(caught?.id, "monkey-bars");
});

test("playground: pull-ups on a bar; S lets go and you land on your feet", () => {
  const w = world("playground");
  const t = w.map.climbs.find((c) => c.id === "turnik-mid");
  const body = standing(t.x, t.z + 0.3);
  const bar = findBar(w.map.climbs, body, true);
  assert.equal(bar?.id, "turnik-mid");
  startBar(body, bar);
  assert.equal(body.angle, 0, "facing the camera");
  let pulls = 0;
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 60; i++) if (stepClimb(body, { x: 0, z: -1 }, w.boxes, DT, false) === "pull") pulls++;
    for (let i = 0; i < 60; i++) stepClimb(body, { x: 0, z: 0 }, w.boxes, DT, false);
  }
  assert.equal(pulls, 3);
  assert.equal(body.climb.count, 3);
  assert.equal(stepClimb(body, { x: 0, z: 1 }, w.boxes, DT, false), "off");
  walk(w, body, { x: 0, z: 0 }, 1);
  assert(body.grounded && body.y === 0);
  // The highest bar needs a jump.
  const high = w.map.climbs.find((c) => c.id === "turnik-high");
  assert.equal(findBar([high], standing(high.x, high.z), true), null);
});

test("playground: climb the rope net of the climbing cube, or the pole, up onto its deck", () => {
  const w = world("playground");
  const gym = w.map.statics.find((s) => s.kind === "gym");
  let body = standing(gym.x - gym.w / 2 - 1.2, gym.z - 0.5);
  let r = walkAndClimb(w, body, { x: 1, z: 0 });
  assert.equal(r.grabbed?.id, "gym-net");
  assert(Math.abs(body.y - gym.h) < 1e-9);
  const pole = w.map.climbs.find((c) => c.id === "gym-pole");
  body = standing(pole.x - 1, pole.z);
  r = walkAndClimb(w, body, { x: 1, z: 0 });
  assert.equal(r.grabbed?.id, "gym-pole");
  assert(Math.abs(body.y - gym.h) < 1e-9, `on the deck from the pole at ${body.y}`);
});

test("cinema: stairs lead up into each loge; you can walk underneath", () => {
  const w = world("cinema");
  for (const side of [-1, 1]) {
    const stairs = w.map.statics.find((s) => s.kind === "loge-stairs" && Math.sign(s.x) === side);
    const loge = w.map.statics.find((s) => s.kind === "loge" && Math.sign(s.x) === side);
    const body = walk(w, standing(stairs.x, stairs.z + stairs.d / 2 + 0.6), { x: 0, z: -1 }, 2.2);
    assert(body.y > loge.h - 0.01 && body.grounded, `up in the loge: ${body.y}`);
    const under = walk(w, standing(loge.x - side * 2.2, loge.z), { x: side, z: 0 }, 0.7);
    assert(Math.abs(under.x - loge.x) < 0.6 && under.y === 0, `walked under the loge to ${under.x.toFixed(2)}`);
  }
});

test("maze: climb a trellis onto the garden wall and walk along its top", () => {
  const w = world("maze");
  for (const side of [-1, 1]) {
    const tr = w.map.climbs.find((c) => c.kind === "wall" && Math.sign(c.x) === side);
    const body = standing(tr.x - side * (tr.w / 2 + 0.5), tr.z);
    const r = walkAndClimb(w, body, { x: side, z: 0 });
    assert.equal(r.grabbed?.id, tr.id);
    assert(Math.abs(body.y - 2.6) < 1e-9, `on the wall at ${body.y}`);
    walk(w, body, { x: 0, z: 1 }, 1.5);
    assert(Math.abs(body.y - 2.6) < 1e-9 && body.grounded, "walking along the top");
  }
  // From up there the hedges can't be jumped onto.
  const hedge = w.map.statics.find((s) => s.kind === "hedge");
  assert(hedge.h > 2.6 + 2.4);
});

test("river: climb the crag on the left bank and zip across the river to the right bank", () => {
  const w = world("river");
  const crag = w.map.statics.find((s) => s.kind === "crag");
  const ledge = Math.max(...w.map.statics.filter((s) => s.kind === "cliff" && inside(crag.x + crag.w / 2 + 0.6, crag.z, s)).map((s) => s.h));
  const body = standing(crag.x + crag.w / 2 + 0.8, crag.z, ledge);
  const r = walkAndClimb(w, body, { x: -1, z: 0 });
  assert.equal(r.grabbed?.id, "crag-face");
  assert(Math.abs(body.y - crag.h) < 1e-9, `on top of the crag at ${body.y}`);
  const zip = w.map.climbs.find((c) => c.kind === "zip");
  Object.assign(body, { x: zip.from[0] + 0.3, z: zip.from[2] });
  assert(zipStart(zip, body));
  startZip(body, zip);
  let t = 0,
    result = null;
  while (!result && t < 15) {
    result = stepClimb(body, { x: 0, z: 0 }, w.boxes, DT, false);
    t += DT;
    if (!result && body.climb.s > 0.05 && body.climb.s < 0.95) {
      const hit = w.boxes.find((b) => inside(body.x, body.z, b) && body.y < b.h - 0.05 && body.y + 1.5 > (b.y || 0));
      assert(!hit, `hits ${hit?.kind} at ${body.x.toFixed(1)}`);
    }
  }
  assert.equal(result, "off");
  walk(w, body, { x: 0, z: 0 }, 2);
  assert(body.x > 10 && body.y > 2.5 && body.grounded, `landed on the right bank at ${body.x.toFixed(1)}, ${body.y.toFixed(2)}`);
});

test("paintball: up the ladder onto each team's watchtower, behind its walls", () => {
  const w = world("paintball");
  for (const side of [-1, 1]) {
    const deck = w.map.statics.find((s) => s.kind === "tower-deck" && Math.sign(s.x) === side);
    const body = standing(deck.x - side * (deck.w / 2 + 1.0), deck.z);
    const r = walkAndClimb(w, body, { x: side, z: 0 });
    assert.equal(r.grabbed?.kind, "wall");
    assert(Math.abs(body.y - deck.h) < 1e-9 && inside(body.x, body.z, deck), `on the tower at ${body.y}`);
    // The parapet keeps you from walking off the back.
    walk(w, body, { x: side, z: 0 }, 1);
    assert(Math.abs(body.y - deck.h) < 1e-9);
  }
});

test("saloon: bottles stand on the shelves until something knocks them off", () => {
  const s = createState({ map: "saloon" }, () => "x");
  for (let i = 0; i < 240; i++) stepWorld(s, DT);
  const bottles = s.balls.filter((b) => b.kind === "bottle");
  assert.equal(bottles.length, 14);
  for (const b of bottles) assert(b.y > 1.3, `${b.id} at ${b.y}`);
  const target = bottles[3];
  applyOp(s, { t: "obj.kick", id: target.id, x: target.x - Math.sign(target.x) * 1.5, z: target.z, a: 0, power: 4 }, { uid: "u", peer: "p", name: "n", now: 0, newId: () => "y" });
  for (let i = 0; i < 240; i++) stepWorld(s, DT);
  assert(target.y < 0.5, `knocked down to ${target.y}`);
  assert(bottles.filter((b) => b !== target).every((b) => b.y > 1.3), "the others stay");
});

test("rope park: the tall bouldering wall leads to a deck; jump off onto the crash mat", () => {
  const w = world("ropepark");
  const wall = w.map.statics.find((s) => s.kind === "bigwall");
  const body = standing(wall.x - wall.w / 2 - 2.5, wall.z);
  const r = walkAndClimb(w, body, { x: 1, z: 0 }, { x: 0, z: -1 }, 8);
  assert.equal(r.grabbed?.id, "big-wall");
  assert(Math.abs(body.y - wall.h) < 1e-9, `on the wall's top at ${body.y}`);
  // Off the room side: onto the mat, which gives a little.
  body.vy = 4;
  body.grounded = false;
  let bounced = false;
  for (let i = 0; i < 240; i++) {
    stepBody(body, i < 22 ? { x: -1, z: 0 } : { x: 0, z: 0 }, w.boxes, DT);
    if (body.support?.soft && body.vy > 0) bounced = true;
  }
  const mat = w.map.statics.find((s) => s.kind === "mat");
  assert(bounced && body.grounded && Math.abs(body.y - mat.h) < 1e-9, `landed on the mat at ${body.y}`);
  const web = w.map.climbs.find((c) => c.id === "web");
  const climber = standing(web.x + web.w / 2 + 1, web.z);
  assert.equal(walkAndClimb(w, climber, { x: -1, z: 0 }).grabbed?.id, "web");
});

test("rink: snow forts give cover — walls you cannot walk through, a tower you can jump onto", () => {
  const w = world("rink");
  const wall = w.map.statics.find((s) => s.kind === "snow-wall" && s.x < 0 && s.d > s.w);
  const body = walk(w, standing(wall.x + 2, wall.z), { x: -1, z: 0 }, 1);
  assert(body.x > wall.x + wall.w / 2, "stopped by the wall");
  const tower = w.map.statics.find((s) => s.kind === "snow-tower" && s.x < 0);
  const jumper = standing(tower.x + tower.w / 2 + 0.6, tower.z);
  jumper.vy = 12.8;
  jumper.grounded = false;
  walk(w, jumper, { x: -1, z: 0 }, 0.3);
  walk(w, jumper, { x: 0, z: 0 }, 0.8);
  assert(Math.abs(jumper.y - tower.h) < 1e-9, `on the tower at ${jumper.y}`);
});
