import test from "node:test";
import assert from "node:assert/strict";
import { MAPS, mapDef } from "../dist/maps/index.js";
import { MAZE, carve } from "../dist/maps/maze.js";
import { mapProps, clampProp, obstacles, defaultPositions, spawnPoint, waterAt, goalsOf, hoopsOf, seesawCollider, propColliders, propInfo } from "../dist/world.js";
import { createState, stepWorld, applyOp, dynamicObjects, packObject, unpackObject, serializeState } from "../dist/state.js";
import { inside, stepBody, surfaceOf, LIMITS, RADIUS } from "../dist/physics.js";
import { floorBack } from "../dist/layout.js";

const solid = (b) => !b.y && b.h > 0.25;
let n = 0;
const newId = () => "id-" + ++n;

test("every map: props stand on the floor and do not overlap each other", () => {
  for (const map of MAPS) {
    const props = mapProps(map);
    for (const p of props) {
      const c = clampProp(p, p.x, p.z);
      assert(Math.abs(c.x - p.x) < 0.02 && Math.abs(c.z - p.z) < 0.02, `${map.id}/${p.id} is off the floor: ${p.x},${p.z} → ${c.x},${c.z}`);
    }
    for (let i = 0; i < props.length; i++)
      for (let j = i + 1; j < props.length; j++) {
        const a = props[i],
          b = props[j];
        const overlap = Math.abs(a.x + a.cx - b.x - b.cx) < a.hw + b.hw - 0.05 && Math.abs(a.z + a.cz - b.z - b.cz) < a.hd + b.hd - 0.05;
        if (!overlap) continue;
        // Footprints may touch at the corners when the actual colliders keep clear.
        const ca = propColliders(a),
          cb = propColliders(b);
        const hit = ca.some((x) => cb.some((y) => Math.abs(x.x - y.x) < (x.w + y.w) / 2 - 0.05 && Math.abs(x.z - y.z) < (x.d + y.d) / 2 - 0.05));
        assert(!hit, `${map.id}: ${a.id} overlaps ${b.id}`);
      }
  }
});

test("every map: balls and cubes start free and settle where they were put (except in the river)", () => {
  for (const map of MAPS) {
    const s = createState({ map: map.id }, newId);
    const boxes = obstacles(map, defaultPositions(map));
    for (const o of dynamicObjects(s)) {
      const under = boxes.filter((b) => inside(o.x, o.z, b, o.size / 2 - 0.02) && (b.y || 0) < o.y + o.size / 2 && b.h > o.y - o.size / 2 + 0.02);
      assert.equal(under.length, 0, `${map.id}/${o.id || o.kind} starts inside ${JSON.stringify(under[0])}`);
      assert(Math.abs(o.x) <= LIMITS.x && o.z <= LIMITS.z && o.z >= floorBack(o.x), `${map.id}/${o.id} is off the floor`);
    }
    const start = dynamicObjects(s).map((o) => ({ x: o.x, z: o.z, y: o.y }));
    for (let i = 0; i < 120 * 3; i++) stepWorld(s, 1 / 120);
    if (map.zones?.some((z) => z.flow)) continue;
    dynamicObjects(s).forEach((o, i) => {
      const moved = Math.hypot(o.x - start[i].x, o.z - start[i].z);
      assert(moved < 0.25, `${map.id}/${o.id || "cube"} drifted ${moved.toFixed(2)} m`);
      assert(Math.abs(o.y - start[i].y) < 0.05, `${map.id}/${o.id || "cube"} fell from ${start[i].y} to ${o.y}`);
    });
  }
});

test("every map: newcomers appear on free floor; the spawn area is reachable", () => {
  for (const map of MAPS) {
    const boxes = obstacles(map, defaultPositions(map)).filter(solid);
    let seed = 3;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 40; i++) {
      const p = spawnPoint(map, random);
      assert(!boxes.some((b) => inside(p.x, p.z, b, RADIUS)), `${map.id}: spawn ${p.x.toFixed(2)},${p.z.toFixed(2)} is inside something`);
      assert(Math.abs(p.x) < LIMITS.x && p.z < LIMITS.z && p.z > floorBack(p.x) + RADIUS, `${map.id}: spawn off the floor`);
    }
  }
});

test("maze: every cell can be reached from the front entrance, and the fountain clearing is open", () => {
  const { east, south } = carve();
  const { cols, rows } = MAZE;
  const seen = new Set(),
    queue = [[Math.floor(cols / 2), rows - 1]];
  while (queue.length) {
    const [c, r] = queue.shift(),
      key = c + "," + r;
    if (seen.has(key)) continue;
    seen.add(key);
    if (c < cols - 1 && !east[r][c]) queue.push([c + 1, r]);
    if (c > 0 && !east[r][c - 1]) queue.push([c - 1, r]);
    if (r < rows - 1 && !south[r][c]) queue.push([c, r + 1]);
    if (r > 0 && !south[r - 1][c]) queue.push([c, r - 1]);
  }
  assert.equal(seen.size, cols * rows);
  // Walking from the entrance into the maze is blocked by hedges you cannot climb.
  const maze = mapDef("maze");
  const hedge = maze.statics.find((s) => s.kind === "hedge");
  assert(hedge.h > 2.3 && hedge.vh < 1.5, "hedges look low but cannot be jumped");
});

test("river: water slows and carries you; stones float downstream and come back from the far edge", () => {
  const river = mapDef("river");
  assert(waterAt(river, 0, 0));
  assert.equal(waterAt(river, -6, 0), null);
  const s = createState({ map: "river" }, newId);
  const stone = s.balls.find((b) => b.id === "pebble-2");
  let wrapped = false,
    last = stone.z;
  for (let i = 0; i < 120 * 40; i++) {
    stepWorld(s, 1 / 120);
    if (stone.z < last - 5) wrapped = true;
    last = stone.z;
  }
  assert(wrapped, "a pebble that floats off the front comes back at the back");
  for (const o of s.balls) {
    assert(Math.abs(o.x) <= LIMITS.x && o.z <= LIMITS.z + 0.01 && o.z >= floorBack(o.x) - 0.01, `${o.id} left the floor`);
    assert(o.y >= o.size / 2 - 0.01, `${o.id} sank`);
  }
  // Beach stones do not move by themselves.
  const beach = s.balls.find((b) => b.id === "beach-stone");
  assert(Math.hypot(beach.x + 6.2, beach.z + 2.5) < 0.05);
});

test("river banks: ledges can be climbed by jumping, step by step", () => {
  const river = mapDef("river");
  const cliffs = river.statics.filter((s) => s.kind === "cliff");
  const heights = [0, 1, 2].map((tier) => Math.max(...cliffs.filter((c) => c.tier === tier).map((c) => c.h)));
  assert(heights[0] < 1.2 && heights[1] - heights[0] < 1.6 && heights[2] - heights[1] < 1.6, `ledges ${heights}`);
  // From the beach you can jump onto the first ledge.
  const ledge = cliffs.find((c) => c.tier === 0 && c.x > 0 && c.z > 0);
  const p = { x: ledge.x - ledge.w / 2 - 0.6, z: ledge.z, y: 0, vy: 0, grounded: true };
  const boxes = obstacles(river, {});
  p.vy = 12.8;
  p.grounded = false;
  for (let i = 0; i < 120; i++) stepBody(p, { x: 1, z: 0 }, boxes, 1 / 120);
  assert(p.y > 0.5 && p.grounded, `standing on the ledge at ${p.y}`);
});

test("playground: goals face each other across the field, the hoop has a ring, the seesaw tips", () => {
  const map = mapDef("playground");
  const goals = goalsOf(map, defaultPositions(map));
  assert.equal(goals.length, 2);
  assert(goals[0].x < -10 && goals[1].x > 10);
  const hoops = hoopsOf(map, defaultPositions(map));
  assert.equal(hoops.length, 1);
  assert(hoops[0].y > 2.4 && hoops[0].r > 0.45);
  const plank = propInfo(map, "seesaw").local[0];
  const up = seesawCollider(plank, 1),
    down = seesawCollider(plank, -1);
  assert(surfaceOf(up, 2, 0) > surfaceOf(up, -2, 0));
  assert(surfaceOf(down, 2, 0) < surfaceOf(down, -2, 0));
  assert(Math.abs(seesawCollider(plank, 0).h0 - seesawCollider(plank, 0).h1) < 1e-9);
  // A ball through the left goal scores for it.
  const s = createState({ map: "playground" }, newId);
  const ball = s.balls.find((b) => b.id === "football");
  Object.assign(ball, { x: -9.5, z: 1.0, y: 0.42, vx: -9, vz: 0, vy: 0 });
  const events = [];
  for (let i = 0; i < 120; i++) events.push(...stepWorld(s, 1 / 120));
  assert(events.some((e) => e.t === "goal" && e.goal === "goal-left"), JSON.stringify(events));
});

test("playground: a shot that drops through the ring scores two points", () => {
  const s = createState({ map: "playground" }, newId);
  const map = mapDef("playground");
  const [hoop] = hoopsOf(map, s.structures);
  const ball = s.balls.find((b) => b.id === "basketball");
  const r = applyOp(s, { t: "obj.throw", id: ball.id, x: ball.x + 0.5, y: 1.9, z: ball.z, vx: 0, vy: 0, vz: 0 }, { uid: "u", peer: "p", name: "n", now: 0, newId });
  assert(r);
  assert.equal(ball.x, 7.1);
  Object.assign(ball, { x: hoop.x, z: hoop.z, y: hoop.y + 1, vx: 0, vy: 0, vz: 0 });
  const events = [];
  for (let i = 0; i < 90; i++) events.push(...stepWorld(s, 1 / 120));
  const basket = events.find((e) => e.t === "basket");
  assert(basket, JSON.stringify(events));
  assert.equal(basket.score, 2);
});

test("saloon: mugs stay on the bar, the stairs lead up to the balcony, you can walk under it", () => {
  const map = mapDef("saloon");
  const s = createState({ map: "saloon" }, newId);
  for (let i = 0; i < 240; i++) stepWorld(s, 1 / 120);
  for (const m of s.balls.filter((b) => b.kind === "mug")) assert(m.y > 0.9, `${m.id} fell to ${m.y}`);
  const boxes = obstacles(map, defaultPositions(map));
  const stairs = map.statics.find((x) => x.kind === "stairs");
  const p = { x: stairs.x, z: stairs.z + stairs.d / 2 + 0.6, y: 0, vy: 0, grounded: true };
  for (let i = 0; i < 120 * 2; i++) stepBody(p, { x: 0, z: -1 }, boxes, 1 / 120);
  assert(p.y > 2.3 && p.grounded, `climbed to ${p.y} at z ${p.z}`);
  const balcony = map.statics.find((x) => x.kind === "balcony");
  const q = { x: balcony.x - 0.6, z: balcony.z + balcony.d / 2 + 0.8, y: 0, vy: 0, grounded: true };
  for (let i = 0; i < 120; i++) stepBody(q, { x: 0, z: -1 }, boxes, 1 / 120);
  assert(q.z < balcony.z + 1 && q.y === 0, `walked under the balcony to ${q.z}`);
});

test("paintball: inflatables bounce you a little and calm down; one person shifts a dorito, a haystack needs two", () => {
  const map = mapDef("paintball");
  const cake = propInfo(map, "cake-a");
  const boxes = obstacles(map, defaultPositions(map));
  const p = { x: cake.x, z: cake.z, y: 3, vy: 0, grounded: false };
  let bounces = 0,
    wasUp = false;
  for (let i = 0; i < 120 * 3; i++) {
    stepBody(p, { x: 0, z: 0 }, boxes, 1 / 120);
    if (p.vy > 0 && !wasUp) bounces++;
    wasUp = p.vy > 0;
  }
  assert(bounces >= 1 && bounces < 6, `bounces ${bounces}`);
  assert(p.grounded && Math.abs(p.y - 1.0) < 0.01);
  assert.equal(propInfo(map, "dorito-a").weight, 1);
  assert.equal(propInfo(map, "hay-a").weight, 2);
});

test("rink: on ice you build up speed and glide on; on snow you stop at once", () => {
  const rink = mapDef("rink");
  const boxes = obstacles(rink, defaultPositions(rink));
  const run = (ice) => {
    const p = { x: -4, z: 2.5, y: 0, vy: 0, grounded: true };
    let early = null;
    for (let i = 0; i < 120 * 1.2; i++) {
      stepBody(p, { x: 1, z: 0 }, boxes, 1 / 120, 1, ice);
      if (i === 24) early = p.x;
    }
    const pressed = p.x;
    for (let i = 0; i < 120; i++) stepBody(p, { x: 0, z: 0 }, boxes, 1 / 120, 1, ice);
    return { early: early + 4, glide: p.x - pressed };
  };
  const ice = run(true),
    snow = run(false);
  assert(ice.early < snow.early * 0.6, `slow start on ice: ${ice.early} vs ${snow.early}`);
  assert(ice.glide > 2.5, `glides ${ice.glide} m after letting go`);
  assert(snow.glide < 0.05, `stops on snow, ${snow.glide}`);
  // The boards stop you; you can't skate through them.
  const p = { x: 6.5, z: 2.5, y: 0, vy: 0, grounded: true };
  for (let i = 0; i < 240; i++) stepBody(p, { x: 1, z: 0 }, boxes, 1 / 120, 1, true);
  assert(p.x < 8 - 0.2, `stopped by the boards at ${p.x}`);
});

test("rink: a struck puck slides across the ice into the net; it is a goal, and the puck comes back to the centre", () => {
  const s = createState({ map: "rink" }, newId);
  const puck = s.balls.find((b) => b.kind === "puck");
  assert(puck.y < 0.25, "the puck lies flat");
  applyOp(s, { t: "obj.kick", id: "puck", x: 1.0, z: 0.05, a: 0, power: 7 }, { uid: "u", peer: "p", name: "n", now: 0, newId });
  assert(puck.vy < 1, "struck along the ice, not into the air");
  const events = [];
  for (let i = 0; i < 120 * 4; i++) events.push(...stepWorld(s, 1 / 120));
  const goal = events.find((e) => e.t === "goal");
  assert(goal, "scored: " + JSON.stringify({ x: puck.x, z: puck.z }));
  assert.equal(goal.goal, "net-left");
  applyOp(s, { t: "ball.reset" }, { uid: "u", peer: "p", name: "n", now: 0, newId });
  assert(Math.hypot(puck.x, puck.z) < 0.01);
  // On snow the same strike barely gets anywhere.
  Object.assign(puck, { x: 0, z: 7.5, vx: 7, vz: 0, vy: 0 });
  for (let i = 0; i < 240; i++) stepWorld(s, 1 / 120);
  assert(puck.x < 4, `on snow the puck stopped at ${puck.x}`);
});

test("rink: snowballs grow as you roll them over snow, not on ice; size travels with the object and resets", () => {
  const s = createState({ map: "rink" }, newId);
  const ball = s.balls.find((b) => b.id === "snow-1");
  const start = ball.size;
  for (let k = 0; k < 8; k++) {
    ball.vx = 3;
    for (let i = 0; i < 60; i++) stepWorld(s, 1 / 120);
  }
  assert(ball.size > start + 0.15, `grew from ${start} to ${ball.size}`);
  assert(Math.abs(ball.y - ball.size / 2) < 0.03, "still resting on the snow");
  const packed = packObject(ball);
  assert.equal(unpackObject(packed).size, Math.round(ball.size * 1000) / 1000);
  assert.equal(packObject(s.balls.find((b) => b.kind === "puck")).length, 9, "others keep the short form");
  const saved = createState(JSON.parse(JSON.stringify(serializeState(s))), newId);
  assert(Math.abs(saved.balls.find((b) => b.id === "snow-1").size - ball.size) < 1e-9, "size survives a restart");
  // Rolled on the ice it stays the same.
  Object.assign(ball, { x: 0, z: 3, y: ball.size / 2 });
  const before = ball.size;
  ball.vx = 3;
  for (let i = 0; i < 120; i++) stepWorld(s, 1 / 120);
  assert.equal(ball.size, before);
  applyOp(s, { t: "ball.reset", id: "snow-1" }, { uid: "u", peer: "p", name: "n", now: 0, newId });
  assert.equal(ball.size, start);
});

test("rink: you slide down the hill on a sled and roll out at the bottom", () => {
  const rink = mapDef("rink");
  const boxes = obstacles(rink, defaultPositions(rink));
  const run = rink.statics.find((x) => x.kind === "sled-run");
  const p = { x: run.x, z: run.z - run.d / 2 + 0.4, y: run.h0, vy: 0, grounded: true };
  let max = 0,
    t = 0;
  while (p.z < run.z + run.d / 2 && t < 6) {
    stepBody(p, { x: 0, z: 0 }, boxes, 1 / 120);
    max = Math.max(max, Math.hypot(p.kx || 0, p.kz || 0));
    t += 1 / 120;
    if (p.z < run.z + run.d / 2 - 0.3) assert(p.support?.slide, "on the run all the way down");
  }
  assert(t < 4, `reached the bottom in ${t.toFixed(1)} s`);
  assert(max > 5, `top speed ${max.toFixed(1)} m/s`);
  // And the steps take you back up.
  const steps = rink.statics.find((x) => x.kind === "snow-steps");
  const q = { x: steps.x - steps.w / 2 - 0.5, z: steps.z, y: 0, vy: 0, grounded: true };
  for (let i = 0; i < 120 * 1.1; i++) stepBody(q, { x: 1, z: 0 }, boxes, 1 / 120);
  assert(q.y > 2.3, `climbed the steps to ${q.y}`);
  // The top reaches the edge of the room: walking on, you stay up there.
  for (let i = 0; i < 120 * 1.5; i++) stepBody(q, { x: 1, z: 0 }, boxes, 1 / 120);
  assert(q.y > 2.3 && q.grounded, `still on top at ${q.x.toFixed(2)}, ${q.y}`);
});
