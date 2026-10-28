import test from "node:test";
import assert from "node:assert/strict";
import { stepKart, enterKart, lapStep, onTrack, crossing, KART } from "../dist/karting.js";
import { mapDef } from "../dist/maps/index.js";
import { obstacles, defaultPositions } from "../dist/world.js";

const race = mapDef("race");
const boxes = obstacles(race, defaultPositions(race));
const track = race.track;
const DT = 1 / 120;
const GAS = { gas: 1 };
function kart(x = race.dispensers[0].spawn.x, z = race.dispensers[0].spawn.z, a = race.dispensers[0].spawn.a) {
  const b = { x: 0, z: 0, y: 0, angle: 0 };
  enterKart(b, { x, z, a }, "#e4573f");
  return b;
}
const speed = (b) => Math.hypot(b.kart.vx, b.kart.vz);
function run(b, seconds, input = {}, world = {}, each) {
  const events = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const was = { x: b.x, z: b.z };
    const ev = stepKart(b, typeof input === "function" ? input(b) : input, { boxes, track, now: i * DT, ...world }, DT);
    events.push(...ev);
    each?.(b, was, i * DT, ev);
  }
  return events;
}

test("the dispenser hands the kart out on the track, facing along it", () => {
  const d = race.dispensers[0];
  assert(onTrack(track, d.spawn.x, d.spawn.z), "the kart appears on the asphalt");
  assert(!onTrack(track, d.x, d.z) && !onTrack(track, 0, 0), "the pits and the infield are not track");
  const b = kart();
  assert.equal(b.y, 0);
  assert(Math.abs(Math.sin(b.angle) - 1) < 1e-9, "faces along the front straight (+x)");
});

test("W speeds the kart up the way it faces; A/D turn it on the spot; W with A drives on and turns left", () => {
  const b = kart();
  run(b, 0.6, { turn: 1 });
  assert(Math.abs(b.x) < 1e-9 && Math.abs(b.z - 6.7) < 1e-9, "turning alone does not move it");
  assert(b.angle > Math.PI / 2 + 1, `turned left on the spot (A): ${b.angle}`);
  const c = kart(-6, 6, Math.PI / 2);
  run(c, 1.2, GAS);
  assert(c.x > -3.5 && Math.abs(c.z - 6) < 0.05, `drove straight along the straight: ${c.x}, ${c.z}`);
  assert(speed(c) > 6 && speed(c) < KART.max, `picking up speed: ${speed(c)}`);
  run(c, 0.8, GAS);
  assert(speed(c) > KART.max * 0.8 && c.x < 7, `near top speed in a couple of seconds: ${speed(c)}`);
  // Left of the way you face (+x) is −z.
  const d = kart(-6, 6, Math.PI / 2);
  run(d, 0.8, { gas: 1, turn: 1 });
  assert(d.x > -6 && d.z < 5.9 && d.angle > Math.PI / 2, `drove forward curving left: ${d.x}, ${d.z}`);
  const e = kart(-6, 6, Math.PI / 2);
  run(e, 0.8, { gas: 1, turn: -1 });
  assert(e.z > 6.1 && e.angle < Math.PI / 2, "D curves right");
});

test("S brakes by half and then backs up slowly; Space stops dead; letting go coasts", () => {
  const go = () => {
    const b = kart(-8, 6, Math.PI / 2);
    run(b, 1.5, GAS);
    return b;
  };
  const coast = go(),
    half = go(),
    full = go();
  const v = speed(coast);
  run(coast, 0.4);
  run(half, 0.4, { brake: 1 });
  run(full, 0.4, { stop: 1 });
  assert(speed(coast) < v && speed(coast) > v - 1, `coasting: ${v} → ${speed(coast)}`);
  assert(speed(half) < speed(coast) - 1, `S slows: ${speed(half)}`);
  assert(speed(full) < speed(half) - 1, `Space slows more: ${speed(full)}`);
  run(full, 0.6, { stop: 1 });
  assert(speed(full) < 0.01, "Space brings it to a stop");
  run(half, 4, { brake: 1 });
  const back = half.kart.vx;
  assert(back < 0 && -back <= KART.reverse + 1e-9, `S then reverses, slowly: ${back}`);
});

test("the grass slows you; walls and tyre stacks bounce you back", () => {
  // Across the infield: grass from x = −4.8 to 4.8 at z = 0.4 is behind the board — go at z = 2.5.
  const b = kart(-4.6, 1.8, Math.PI / 2);
  b.kart.vx = KART.max;
  run(b, 1, GAS);
  assert(speed(b) <= KART.grass.max + 0.05, `held to grass speed: ${speed(b)}`);
  // Straight at the outer wall on the right.
  const w = kart(9.5, 0, Math.PI / 2);
  let max = -Infinity;
  const events = run(w, 2, GAS, {}, (k) => (max = Math.max(max, k.x)));
  const wall = boxes.find((o) => o.kind === "wall" && o.x > 11);
  assert(max + 0.42 + KART.circle < wall.x - wall.w / 2 + 0.02, `stopped by the wall: ${max}`);
  assert(events.some((e) => e.t === "wall"), "a bang");
  for (let i = 0; i < 200; i++) {
    const k = kart(-8 + ((i * 7.3) % 16), 6, (i * 2.399) % (Math.PI * 2));
    run(k, 1.5, GAS);
    const off = boxes.some((o) => o.kind === "tyres" && Math.hypot(k.x - o.x, k.z - o.z) < o.radius);
    assert(!off, "never inside a tyre stack");
  }
});

test("karts bump each other; a kart at speed knocks an avatar flying along its way and up", () => {
  const b = kart(-4, 6, Math.PI / 2);
  b.kart.vx = 8;
  const other = { kind: "kart", id: "k2", x: -2.8, z: 6, vx: 0, vz: 0 };
  const ev = run(b, 0.2, {}, { others: [other] });
  assert(ev.some((e) => e.t === "kart" && e.id === "k2"), "bump");
  assert(b.kart.vx < 5, `slowed by the bump: ${b.kart.vx}`);
  assert(b.x < other.x - KART.reach, "does not drive through it");
  const c = kart(-4, 6, Math.PI / 2);
  c.kart.vx = 8;
  const hits = run(c, 0.4, GAS, { others: [{ kind: "avatar", id: "p", x: -2.5, z: 6.2, y: 0 }] }).filter((e) => e.t === "hit");
  assert.equal(hits.length, 1, "one hit, not one per frame");
  const [vx, vy, vz] = hits[0].v;
  assert(vx > 5 && vy > 6 && vz > 0.1, `forward, up, and off to the side they were on: ${hits[0].v}`);
  // Creeping into someone just nudges.
  const s = kart(-4, 6, Math.PI / 2);
  s.kart.vx = 1.2;
  assert(!run(s, 0.6, {}, { others: [{ kind: "avatar", id: "p", x: -3, z: 6, y: 0 }] }).some((e) => e.t === "hit"));
});

test("the hump on the back straight throws a fast kart into the air; a slow one rolls over it", () => {
  const fast = kart(6, -5.6, -Math.PI / 2);
  fast.kart.vx = -KART.max;
  let air = 0,
    top = 0;
  const ev = run(fast, 1.4, GAS, {}, (k) => {
    if (!k.grounded) air += DT;
    top = Math.max(top, k.y);
  });
  assert(air > 0.12, `flew: ${air}s`);
  assert(top > 0.45 && top < 1.3, `a little jump: ${top}`);
  assert(fast.grounded && fast.y === 0 && fast.x < -2, "landed beyond it");
  assert(!ev.some((e) => e.t === "wall"), "the hump is not a wall");
  const slow = kart(2.5, -5.6, -Math.PI / 2);
  slow.kart.vx = -2;
  run(slow, 2.5, { gas: 0 }, {}, (k) => assert(k.grounded, "stays on the ground"));
});

test("a lap counts when the finish is crossed after every checkpoint in order", () => {
  const lap = { next: 0, start: null, best: null };
  const cross = (line, t) => {
    const [x0, z0] = line.from,
      [x1, z1] = line.to,
      mx = (x0 + x1) / 2,
      mz = (z0 + z1) / 2,
      nx = -(z1 - z0),
      nz = x1 - x0,
      l = Math.hypot(nx, nz);
    return lapStep(lap, track, { x: mx + (nx / l) * 0.1, z: mz + (nz / l) * 0.1 }, { x: mx - (nx / l) * 0.1, z: mz - (nz / l) * 0.1 }, t);
  };
  assert.equal(crossing(track.finish, { x: -3.1, z: 6 }, { x: -2.9, z: 6 }), 1, "the finish is crossed driving +x");
  assert.equal(crossing(track.finish, { x: -2.9, z: 6 }, { x: -3.1, z: 6 }), -1);
  assert.equal(crossing(track.finish, { x: -3.1, z: 12 }, { x: -2.9, z: 12 }), 0, "not beside it");
  assert.deepEqual(cross(track.finish, 1), { start: true });
  for (const cp of track.checkpoints) cross(cp, 3);
  assert.deepEqual(cross(track.finish, 12), { lap: 11, best: true });
  // Cutting across the infield misses a checkpoint: no lap, timing restarts.
  cross(track.checkpoints[0], 14);
  cross(track.checkpoints[2], 16);
  assert.equal(cross(track.finish, 17), null);
  for (const cp of track.checkpoints) cross(cp, 20);
  assert.deepEqual(cross(track.finish, 26), { lap: 9, best: true });
  for (const cp of track.checkpoints) cross(cp, 30);
  assert.deepEqual(cross(track.finish, 36), { lap: 10, best: false });
});

test("a simple driver gets round the whole track and sets a lap time", () => {
  // The centreline every half metre.
  const pts = track.points.flatMap((p, i) => {
    const q = track.points[(i + 1) % track.points.length],
      n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.5));
    return Array.from({ length: n }, (_, j) => [p[0] + ((q[0] - p[0]) * j) / n, p[1] + ((q[1] - p[1]) * j) / n]);
  });
  const b = kart();
  let laps = [],
    stuck = 0;
  const drive = (k) => {
    // Aim at the centreline point three metres ahead of the nearest one.
    let near = 0,
      best = Infinity;
    pts.forEach((p, i) => {
      const d = Math.hypot(p[0] - k.x, p[1] - k.z);
      if (d < best) [best, near] = [d, i];
    });
    let target = pts[near],
      i = near;
    while (Math.hypot(target[0] - k.x, target[1] - k.z) < 3) target = pts[(i = (i + 1) % pts.length)];
    const want = Math.atan2(target[0] - k.x, target[1] - k.z),
      diff = Math.atan2(Math.sin(want - k.angle), Math.cos(want - k.angle));
    return { gas: Math.abs(diff) < 0.5 ? 1 : 0, brake: Math.abs(diff) > 0.9 ? 1 : 0, turn: Math.max(-1, Math.min(1, diff * 3)) };
  };
  let t = 0;
  run(b, 30, drive, {}, (k, was, _, ev) => {
    t += DT;
    const r = lapStep(k.kart.lap, track, was, k, t);
    if (r?.lap) laps.push(r.lap);
    if (speed(k) < 0.5 && t > 2) stuck += DT;
    assert(!ev.some((e) => e.t === "wall" && e.speed > 6), `no hard crash at ${k.x.toFixed(1)}, ${k.z.toFixed(1)}`);
  });
  assert(laps.length >= 2, `laps: ${laps}`);
  assert(laps[0] > 6 && laps[0] < 14, `lap time ${laps[0]}`);
  assert(stuck < 0.5, "never stuck");
});

// A driver that follows its own progress round the centreline (so at a crossing it does not jump to
// the other road), aiming a few metres ahead and braking for sharp bends.
function autopilot(map, seconds) {
  const P = map.roadPoints,
    n = P.length,
    boxes = obstacles(map, defaultPositions(map)),
    d = map.dispensers[0],
    b = { x: 0, z: 0, y: 0, angle: 0 };
  enterKart(b, d.spawn, "#e4573f");
  let idx = P.reduce((best, p, i) => (Math.hypot(p[0] - b.x, p[1] - b.z) < Math.hypot(P[best][0] - b.x, P[best][1] - b.z) ? i : best), 0);
  const log = { laps: [], stuck: 0, crashes: [], maxY: 0, underBridge: false, overBridge: false, offRoad: 0, t: 0 };
  for (let s = 0; s < seconds / DT; s++) {
    // Advance the progress index to the nearest point a little ahead.
    for (let k = 1; k < 6; k++) {
      const j = (idx + k) % n;
      if (Math.hypot(P[j][0] - b.x, P[j][1] - b.z) < Math.hypot(P[idx][0] - b.x, P[idx][1] - b.z)) idx = j;
    }
    const look = (idx + 5) % n,
      want = Math.atan2(P[look][0] - b.x, P[look][1] - b.z),
      diff = Math.atan2(Math.sin(want - b.angle), Math.cos(want - b.angle));
    // How much the road turns over the next few metres.
    const ahead = Math.abs(Math.atan2(Math.sin(Math.atan2(P[(idx + 12) % n][0] - P[(idx + 6) % n][0], P[(idx + 12) % n][1] - P[(idx + 6) % n][1]) - Math.atan2(P[(idx + 6) % n][0] - P[idx][0], P[(idx + 6) % n][1] - P[idx][1])), Math.cos(Math.atan2(P[(idx + 12) % n][0] - P[(idx + 6) % n][0], P[(idx + 12) % n][1] - P[(idx + 6) % n][1]) - Math.atan2(P[(idx + 6) % n][0] - P[idx][0], P[(idx + 6) % n][1] - P[idx][1]))));
    const v = Math.hypot(b.kart.vx, b.kart.vz),
      limit = ahead > 1.4 ? 3.6 : ahead > 0.8 ? 5.5 : ahead > 0.4 ? 7.5 : 99;
    const input = { gas: Math.abs(diff) < 0.6 && v < limit ? 1 : 0, brake: v > limit + 1 ? 1 : 0, turn: Math.max(-1, Math.min(1, diff * 3)) };
    const was = { x: b.x, z: b.z };
    const ev = stepKart(b, input, { boxes, track: map.track, now: log.t }, DT);
    log.t += DT;
    const r = lapStep(b.kart.lap, map.track, was, b, log.t);
    if (r?.lap) log.laps.push(r.lap);
    if (v < 0.4 && log.t > 2) log.stuck += DT;
    for (const e of ev) if (e.t === "wall" && e.speed > 5) log.crashes.push(`${e.speed.toFixed(1)} at ${b.x.toFixed(1)},${b.z.toFixed(1)}`);
    log.maxY = Math.max(log.maxY, b.y);
    // Height matches the road where you are on it.
    if (Math.abs(b.y - P[idx][2]) > 0.6 && b.grounded) log.offRoad += DT;
  }
  return { log, b };
}
for (const id of ["race-mountain", "race-gp"]) {
  test(`${id}: a careful driver laps the whole track — up and down, round the hairpins — without getting stuck`, () => {
    const map = mapDef(id);
    const { log } = autopilot(map, 50);
    assert(log.laps.length >= 2, `laps: ${log.laps.map((l) => l.toFixed(1))}`);
    assert(log.laps[0] > 8 && log.laps[0] < 25, `lap time ${log.laps[0]}`);
    assert(log.stuck < 0.6, `stuck for ${log.stuck}s`);
    assert(log.crashes.length === 0, `hard crashes: ${log.crashes}`);
    assert(log.offRoad < 0.3, `kart height off the road for ${log.offRoad}s`);
    assert(log.maxY > Math.max(...map.roadPoints.map((p) => p[2])) - 0.25, `reached the top: ${log.maxY}`);
  });
}

test("race-gp: under the bridge you drive at ground level; on it you are 2 m up; the bridge's ramp sides are walls", () => {
  const map = mapDef("race-gp"),
    boxes = obstacles(map, defaultPositions(map));
  const bridge = boxes.find((b) => b.shape === "path");
  // Up the road towards the loop: straight under the bridge at x = 3.6.
  const under = { x: 0, z: 0, y: 0, angle: 0 };
  enterKart(under, { x: 3.6, z: 4.6, a: Math.PI }, "#fff");
  under.kart.vz = -6;
  let maxY = 0;
  // (Past the bridge this same road starts climbing into the loop, so only look until then.)
  run(under, 0.9, GAS, { boxes, track: map.track }, (k) => k.z > 0.6 && (maxY = Math.max(maxY, k.y)));
  assert(maxY < 0.05, `stayed on the ground under the bridge: ${maxY}`);
  assert(under.z < 1.2, `drove on through: ${under.z}`);
  // On the bridge going east above the same spot.
  const over = { x: 0, z: 0, y: 1.95, angle: 0 };
  enterKart(over, { x: 2.0, z: 2.4, a: Math.PI / 2 }, "#fff");
  over.y = 1.95;
  over.kart.vx = 5;
  run(over, 0.5, GAS, { boxes, track: map.track });
  assert(over.y > 1.6 && over.x > 3.6, `stayed up on the bridge: y ${over.y} at x ${over.x}`);
  // Driving at the side of the climbing ramp from the ground bounces you off.
  const side = { x: 0, z: 0, y: 0, angle: 0 };
  enterKart(side, { x: -5.6, z: -0.6, a: Math.PI / 2 }, "#fff");
  side.kart.vx = 7;
  const ev = run(side, 1, GAS, { boxes, track: map.track });
  assert(side.x < -2.4 - 1.7 + 0.3 && side.y < 0.1, `kept out of the ramp: ${side.x}, ${side.y}`);
  assert(ev.some((e) => e.t === "wall"));
  assert(bridge.solid === false && bridge.walls === true);
});
