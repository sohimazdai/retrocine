import test from "node:test";
import assert from "node:assert/strict";
import { stepRide, mountRide, RIDES } from "../dist/riding.js";
import { mapDef } from "../dist/maps/index.js";
import { obstacles, defaultPositions } from "../dist/world.js";

const park = mapDef("skatepark");
const boxes = obstacles(park, defaultPositions(park));
const DT = 1 / 120;
function rider(kind, x, z, angle) {
  const b = { x, z, y: 0, vy: 0, grounded: true, angle };
  mountRide(b, { id: "r", kind, a: angle });
  return b;
}
const GAS = { gas: 1 },
  NONE = {};
function run(b, seconds, input = NONE, each, until = (e) => e.t === "bail") {
  const events = [];
  for (let i = 0; i < seconds * 120; i++) {
    const ev = stepRide(b, typeof input === "function" ? input(i * DT, b) : input, boxes, DT);
    events.push(...ev);
    each?.(b, i * DT);
    if (ev.some(until)) break;
  }
  return events;
}

test("W pushes you up to the board's top speed the way you face; letting go you coast; S slows, Space stops; A/D turn on the spot", () => {
  const b = rider("skateboard", -10, 7.4, Math.PI / 2);
  run(b, 2, GAS);
  assert(b.ride.speed > RIDES.skateboard.max * 0.85, `speed ${b.ride.speed}`);
  assert(b.x > -1 && Math.abs(b.z - 7.4) < 0.2, `rode to ${b.x}, ${b.z}`);
  const v = b.ride.speed;
  run(b, 0.3);
  assert(b.ride.speed < v && b.ride.speed > v - 0.5, "coasting slows a little");
  // S is half a brake, Space a full one.
  const half = { ...b, ride: { ...b.ride } },
    full = { ...b, ride: { ...b.ride } };
  run(half, 0.3, { brake: 1 });
  run(full, 0.3, { stop: 1 });
  assert(full.ride.speed < half.ride.speed - 1 && half.ride.speed < b.ride.speed - 1, `half ${half.ride.speed}, full ${full.ride.speed}`);
  run(full, 1, { stop: 1 });
  assert(Math.abs(full.ride.speed) < 1e-9, "stopped");
  // A turns you left on the spot without rolling anywhere.
  const at = { x: full.x, z: full.z },
    angle = full.angle;
  run(full, 0.5, { turn: 1 });
  assert(full.angle > angle + 1 && Math.hypot(full.x - at.x, full.z - at.z) < 1e-9, `turned to ${full.angle}`);
  // W and A together: forward and round to the left.
  run(full, 1, { gas: 1, turn: 1 });
  assert(full.ride.speed > 3 && Math.hypot(full.x - at.x, full.z - at.z) > 1);
});

test("a kicker throws you into the air and you land rolling", () => {
  const kicker = park.statics.find((s) => s.kind === "kicker" && s.x > 0);
  const b = rider("skateboard", kicker.x, kicker.z + 4, Math.PI);
  b.ride.speed = 9.5;
  let peak = 0,
    flew = false;
  const events = run(b, 2.5, GAS, (b) => {
    if (!b.grounded) flew = true;
    peak = Math.max(peak, b.y);
  });
  assert(flew && peak > 0.9, `peak ${peak}`);
  assert(!events.some((e) => e.t === "bail"), JSON.stringify(events));
  assert(b.grounded && b.z < kicker.z - 2, `landed at ${b.z}`);
});

test("quarter pipe: up the wall, straight into the air and back down; spin 180 to land forward", () => {
  const pipe = park.statics.find((s) => s.shape === "qpipe" && s.dir > 0);
  // No spin: you come down backwards (fakie).
  const a = rider("skateboard", 4, pipe.z, Math.PI / 2);
  a.ride.speed = 10;
  let vert = false,
    peak = 0;
  let events = run(
    a,
    3,
    (t, b) => (b.grounded ? GAS : NONE),
    (b) => {
      if (b.ride.vert) vert = true;
      peak = Math.max(peak, b.y);
    },
    (e) => e.t !== "grind",
  );
  assert(vert && peak > pipe.h + 0.3, `went vert to ${peak}`);
  assert(!events.some((e) => e.t === "bail"), JSON.stringify(events));
  assert(events.some((e) => e.t === "land" && /Эйр/.test(e.name)), JSON.stringify(events));
  // Spinning half a turn in the air lands you facing down the pipe.
  const b = rider("skateboard", 4, pipe.z, Math.PI / 2);
  b.ride.speed = 10.5;
  events = run(b, 3, (t, b) => (b.grounded ? GAS : Math.abs(b.ride.spin) < Math.PI - 0.08 ? { turn: 1 } : NONE), null, (e) => e.t !== "grind");
  const landed = events.find((e) => e.t === "land");
  assert(landed && /180/.test(landed.name), JSON.stringify(events));
  assert(b.ride.speed > 0 && Math.sin(b.angle) < 0, "rolling forward, away from the pipe");
});

test("landing sideways or mid-flip throws you off; a full kickflip lands clean", () => {
  const pipe = park.statics.find((s) => s.shape === "qpipe" && s.dir < 0);
  const a = rider("skateboard", -4, pipe.z, -Math.PI / 2);
  a.ride.speed = 10.5;
  // A quarter turn in the air: you come down sideways.
  let events = run(a, 3, (t, b) => (b.grounded ? GAS : Math.abs(b.ride.spin) < Math.PI / 2 ? { turn: -1 } : NONE));
  assert(events.some((e) => e.t === "bail" && e.reason === "sideways"), JSON.stringify(events));
  // Ollie and kickflip on the flat.
  const b = rider("skateboard", -4, 8.6, Math.PI / 2);
  b.ride.speed = 6;
  b.ride.ollie = true;
  stepRide(b, NONE, boxes, DT);
  b.ride.trick = true;
  events = run(b, 1.5);
  const land = events.find((e) => e.t === "land");
  assert(land && /Кикфлип/.test(land.name), JSON.stringify(events));
  // Too late a flip: still spinning the board when you touch down.
  const c = rider("skateboard", -4, 8.6, Math.PI / 2);
  c.ride.speed = 6;
  c.ride.ollie = true;
  stepRide(c, NONE, boxes, DT);
  events = run(c, 1.5, (t, b) => {
    if (t > 0.45 && b.ride.flip < 0 && !b.ride.flips) b.ride.trick = true;
    return NONE;
  });
  assert(events.some((e) => e.t === "bail" && e.reason === "flip"), JSON.stringify(events));
});

test("jumping onto a rail along it grinds to its end", () => {
  const rail = park.statics.find((s) => s.rail && !s.y);
  const b = rider("skateboard", rail.x - rail.w / 2 - 1.2, rail.z, Math.PI / 2);
  b.ride.speed = 7;
  b.ride.ollie = true;
  let ground = false;
  const events = run(b, 2, NONE, (b) => {
    if (b.ride.grind) ground = true;
  });
  assert(ground, "grinding");
  const slide = events.find((e) => e.t === "land" && /Слайд/.test(e.name));
  assert(slide, JSON.stringify(events));
  assert(b.x > rail.x + rail.w / 2, "slid off the far end");
  // Riding into a rail without jumping bumps you back.
  const c = rider("skateboard", rail.x, rail.z + 1.5, Math.PI);
  c.ride.speed = 3;
  run(c, 1);
  assert(c.z > rail.z, "did not pass through the rail");
});

test("bikes and scooters ride too; a wall at speed throws you off, slowly you bounce back", () => {
  const box = park.statics.find((s) => s.kind === "pad");
  for (const kind of ["bike", "scooter"]) {
    const b = rider(kind, box.x, box.z + 3, Math.PI);
    b.ride.speed = 3;
    const events = run(b, 1.2);
    assert(!events.some((e) => e.t === "bail"), kind + " " + JSON.stringify(events));
  }
  const funbox = park.statics.find((s) => s.kind === "box" && s.h < 1);
  const fast = rider("bike", funbox.x, funbox.z + funbox.d / 2 + 3, Math.PI);
  fast.ride.speed = 11;
  const events = run(fast, 1);
  assert(events.some((e) => e.t === "bail"), JSON.stringify(events));
  const slow = rider("bike", funbox.x, funbox.z + funbox.d / 2 + 1.5, Math.PI);
  slow.ride.speed = 3;
  run(slow, 1);
  assert(slow.ride.speed > 0 === false || slow.z > funbox.z + funbox.d / 2, "bounced off");
});
