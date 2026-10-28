import test from "node:test";
import assert from "node:assert/strict";
import { stepRide, mountRide, RIDES } from "../dist/riding.js";
import { mapDef } from "../dist/maps/index.js";
import { obstacles, defaultPositions } from "../dist/world.js";
import { setRoomScale } from "../dist/layout.js";

const park = mapDef("skatepark");
setRoomScale(park.scale);
const boxes = obstacles(park, defaultPositions(park));
const DT = 1 / 120;
function rider(kind, x, z, angle, y = 0) {
  const b = { x, z, y, vy: 0, grounded: true, angle };
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
const bails = (events) => events.filter((e) => e.t === "bail");

test("the park is a real one: a clear line from pipe to pipe, nothing across it; grind spots run along it", () => {
  const pipes = park.statics.filter((s) => s.shape === "qpipe" && !s.small);
  assert.equal(pipes.length, 2);
  // Across the whole width between the pipes, in the middle of the floor, nothing stands in the way.
  for (let z = -5.5; z <= 5.5; z += 0.5)
    for (let x = -17.5; x <= 17.5; x += 0.25) assert(!boxes.some((b) => !b.rail && b.h > 0.3 && Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2), `something at ${x}, ${z}`);
  // Rails and ledges near the line run along it (along x), so you grind them on the way.
  const grinds = park.statics.filter((s) => s.rail && Math.abs(s.z) < 8);
  assert(grinds.length >= 3);
  for (const g of grinds) assert(g.w > g.d * 5, `${g.kind} at ${g.x},${g.z} runs along the line`);
  // No kickers.
  assert(!park.statics.some((s) => s.kind === "kicker"));
});

test("W pushes you up to the board's top speed the way you face; letting go you coast; S brakes; A/D turn on the spot", () => {
  const b = rider("skateboard", -14, 0, Math.PI / 2);
  run(b, 2, GAS);
  assert(b.ride.speed > RIDES.skateboard.max * 0.85, `speed ${b.ride.speed}`);
  assert(b.x > -5 && Math.abs(b.z) < 0.2, `rode to ${b.x}, ${b.z}`);
  const v = b.ride.speed;
  run(b, 0.3);
  assert(b.ride.speed < v && b.ride.speed > v - 0.5, "coasting slows a little");
  run(b, 0.3, { brake: 1 });
  assert(b.ride.speed < v - 2.5, `S brakes: ${b.ride.speed}`);
  run(b, 2, { brake: 1 });
  assert(Math.abs(b.ride.speed) < 1e-9, "stopped");
  // A turns you left on the spot without rolling anywhere.
  const at = { x: b.x, z: b.z },
    angle = b.angle;
  run(b, 0.5, { turn: 1 });
  assert(b.angle > angle + 1 && Math.hypot(b.x - at.x, b.z - at.z) < 1e-9, `turned to ${b.angle}`);
  // W and A together: forward and round to the left.
  run(b, 1, { gas: 1, turn: 1 });
  assert(b.ride.speed > 3 && Math.hypot(b.x - at.x, b.z - at.z) > 1);
});

test("Space-ollie on the flat lands rolling; Shift from the ground pops straight into a kickflip; a flip still going when you touch down throws you", () => {
  const a = rider("skateboard", -6, 1, Math.PI / 2);
  a.ride.speed = 6;
  a.ride.ollie = true;
  let events = run(a, 1.5);
  const ollie = events.find((e) => e.t === "land");
  assert(ollie && /Олли/.test(ollie.name) && !bails(events).length, JSON.stringify(events));
  const b = rider("skateboard", -6, 1, Math.PI / 2);
  b.ride.speed = 6;
  b.ride.trick = true;
  events = run(b, 1.5);
  const flip = events.find((e) => e.t === "land");
  assert(flip && /Кикфлип/.test(flip.name), JSON.stringify(events));
  // Too late a flip: still spinning the board when you touch down.
  const c = rider("skateboard", -6, 1, Math.PI / 2);
  c.ride.speed = 6;
  c.ride.ollie = true;
  stepRide(c, NONE, boxes, DT);
  events = run(c, 1.5, (t, b) => {
    if (t > 0.5 && b.ride.flip < 0 && !b.ride.flips) b.ride.trick = true;
    return NONE;
  });
  assert(events.some((e) => e.t === "bail" && e.reason === "flip"), JSON.stringify(events));
});

test("quarter pipe: up the wall, straight into the air and back down; spin 180 to land forward", () => {
  const pipe = park.statics.find((s) => s.shape === "qpipe" && s.dir > 0 && !s.small);
  // No spin: you come down backwards (fakie).
  const a = rider("skateboard", 10, pipe.z, Math.PI / 2);
  a.ride.speed = 10;
  let vert = false,
    peak = 0;
  let events = run(
    a,
    4,
    (t, b) => (b.grounded ? GAS : NONE),
    (b) => {
      if (b.ride.vert) vert = true;
      peak = Math.max(peak, b.y);
    },
    (e) => e.t !== "grind",
  );
  assert(vert && peak > pipe.h + 0.3, `went vert to ${peak}`);
  assert(!bails(events).length, JSON.stringify(events));
  assert(events.some((e) => e.t === "land" && /Эйр/.test(e.name)), JSON.stringify(events));
  // Spinning half a turn in the air lands you facing down the pipe.
  const b = rider("skateboard", 10, pipe.z, Math.PI / 2);
  b.ride.speed = 10.5;
  events = run(b, 4, (t, b) => (b.grounded ? GAS : Math.abs(b.ride.spin) < Math.PI - 0.08 ? { turn: 1 } : NONE), null, (e) => e.t !== "grind");
  const landed = events.find((e) => e.t === "land");
  assert(landed && /180/.test(landed.name), JSON.stringify(events));
  assert(b.ride.speed > 0 && Math.sin(b.angle) < 0, "rolling forward, away from the pipe");
});

test("carving up a quarter pipe at an angle: you come back down onto its face and ride away, no fall", () => {
  const pipe = park.statics.find((s) => s.shape === "qpipe" && s.dir > 0 && !s.small);
  for (const tilt of [0.35, 0.6]) {
    const b = rider("skateboard", 11, -2, Math.PI / 2 - tilt);
    b.ride.speed = 10;
    let up = 0;
    const events = run(b, 4, (t, b) => (b.grounded && b.x < 16 ? GAS : NONE), (b) => (up = Math.max(up, b.y)));
    assert(up > pipe.h * 0.8, `went up the pipe (${up})`);
    assert(!bails(events).length, `tilt ${tilt}: ${JSON.stringify(events)}`);
    assert(b.grounded && b.x < pipe.x - pipe.w / 2 + 0.5, `rolled back down off the pipe: ${b.x}`);
  }
  // Coming down way off the fall line (a quarter turn too far) still throws you.
  const pipeL = park.statics.find((s) => s.shape === "qpipe" && s.dir < 0 && !s.small);
  const c = rider("skateboard", -10, pipeL.z, -Math.PI / 2);
  c.ride.speed = 10.5;
  const events = run(c, 4, (t, b) => (b.grounded ? GAS : Math.abs(b.ride.spin) < Math.PI / 2 ? { turn: -1 } : NONE));
  assert(events.some((e) => e.t === "bail" && e.reason === "sideways"), JSON.stringify(events));
});

test("jumping onto a rail along it grinds to its end; coming down across one you just land past it", () => {
  const rail = park.statics.find((s) => s.rail && !s.y && s.kind === "rail");
  const b = rider("skateboard", rail.x - rail.w / 2 - 1.2, rail.z, Math.PI / 2);
  b.ride.speed = 7;
  b.ride.ollie = true;
  let ground = false;
  let events = run(b, 2.5, NONE, (b) => {
    if (b.ride.grind) ground = true;
  });
  assert(ground, "grinding");
  const slide = events.find((e) => e.t === "land" && /Слайд/.test(e.name));
  assert(slide, JSON.stringify(events));
  assert(b.x > rail.x + rail.w / 2, "slid off the far end");
  // Over it at an angle: no grind and no fall.
  const c = rider("skateboard", rail.x, rail.z + 1.6, Math.PI - 0.9);
  c.ride.speed = 6;
  c.ride.ollie = true;
  events = run(c, 1.5);
  assert(!bails(events).length && !c.ride.grind, JSON.stringify(events));
  // Riding into a rail without jumping bumps you back.
  const d = rider("skateboard", rail.x, rail.z + 1.5, Math.PI);
  d.ride.speed = 3;
  run(d, 1);
  assert(d.z > rail.z, "did not pass through the rail");
});

test("walls: a glancing hit at speed slides you along it; head-on slowly you bounce back, fast you come off", () => {
  const box = park.statics.find((s) => s.kind === "box" && s.h >= 1.2);
  // Along a graffiti wall at full speed, angled into it by 25°: slide along it and keep going.
  const wall = park.statics.find((s) => s.kind === "graffiti-wall" && s.x > 0);
  const g = rider("skateboard", wall.x - wall.w / 2 + 0.2, wall.z + wall.d / 2 + 0.75, Math.PI / 2 + 0.44);
  g.ride.speed = 11;
  let touched = false;
  let events = run(g, 0.3, NONE, (b) => (touched ||= b.z < wall.z + wall.d / 2 + 0.45));
  assert(touched, "reached the wall");
  assert(!bails(events).length, JSON.stringify(events));
  assert(g.ride.speed > 8 && g.x > wall.x, `slid on along it: ${g.ride.speed.toFixed(1)} at ${g.x.toFixed(1)}`);
  assert(Math.abs(Math.sin(g.angle) - 1) < 0.01, "the board turned along the wall");
  for (const kind of ["bike", "scooter", "skateboard"]) {
    const slow = rider(kind, box.x - 1, box.z + box.d / 2 + 1.6 + 3.0, Math.PI);
    slow.ride.speed = 3;
    events = run(slow, 1.5);
    assert(!bails(events).length, kind + " " + JSON.stringify(events));
  }
  // Straight into the side of the mini ramp's deck at full tilt.
  const deck = park.statics.find((s) => s.kind === "deck" && s.h > 1 && s.h < 2);
  const fast = rider("bike", deck.x, deck.z + deck.d / 2 + 3, Math.PI);
  fast.ride.speed = 12;
  events = run(fast, 1);
  assert(events.some((e) => e.t === "bail" && e.reason === "wall"), JSON.stringify(events));
});

test("a mellow bank up to the platform and over its edge: you fly off and land rolling", () => {
  const bank = park.statics.find((s) => s.shape === "ramp" && s.axis === "z");
  const b = rider("skateboard", bank.x - 3, bank.z + bank.d / 2 + 4, Math.PI);
  b.ride.speed = 9;
  let top = 0;
  const events = run(b, 3, GAS, (b) => (top = Math.max(top, b.y)));
  assert(top > 1.1, `up on the platform (${top})`);
  assert(!bails(events).filter((e) => e.reason !== "wall").length, JSON.stringify(events));
});
