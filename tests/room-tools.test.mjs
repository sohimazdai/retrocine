// Общие для комнаты вещи без браузера: столкновения объектов, опрос, рисунки, фигуры.
import test from "node:test";
import assert from "node:assert/strict";
import { createState, applyOp, stepWorld, stepProps, serializeState } from "../dist/state.js";
import { stepCube, collideCubes } from "../dist/physics.js";
import { mapProps, mapDef, makeCube } from "../dist/world.js";
import { setRoomScale } from "../dist/layout.js";

let n = 0;
const newId = () => "id" + ++n;
const as = (uid, name = uid) => ({ uid, peer: "peer-" + uid, name, now: 1, newId });

test("loose things stack: a cube dropped on a cube stays on top and rides along with it", () => {
  const low = makeCube({ id: "a", x: 0, z: 0, color: "#fff" }),
    top = makeCube({ id: "b", x: 0.1, z: 0, y: 2, color: "#fff" });
  for (let i = 0; i < 360; i++) {
    stepCube(low, [], 1 / 120);
    stepCube(top, [], 1 / 120);
    collideCubes(low, top);
  }
  assert(Math.abs(top.y - (low.y + low.size)) < 0.01, `on top: ${top.y}`);
  // Push the bottom one: the top one comes along.
  low.vx = 2;
  for (let i = 0; i < 30; i++) {
    stepCube(low, [], 1 / 120);
    stepCube(top, [], 1 / 120);
    collideCubes(low, top);
  }
  assert(top.x > 0.2 && Math.abs(top.y - (low.y + low.size)) < 0.02, `carried to ${top.x}`);
});

test("props do not go into each other: dragged into a table, a chair stops at its edge and the dragger is told", () => {
  setRoomScale(1);
  const s = createState({ map: "saloon" }, newId);
  const props = mapProps(mapDef("saloon")),
    chair = props.find((p) => p.kind === "chair"),
    table = props.find((p) => p.kind === "saloon-table"),
    t0 = s.structures[table.id];
  const r = applyOp(s, { t: "struct.move", id: chair.id, x: t0.x, z: t0.z }, as("u"));
  const at = s.structures[chair.id];
  assert(Math.hypot(at.x - t0.x, at.z - t0.z) > 0.9, `kept out of the table: ${at.x}, ${at.z}`);
  assert(r.out.some((o) => o.msg.t === "struct" && o.others === false), "the dragger gets the corrected place");
  // Free floor: the drag goes where asked.
  applyOp(s, { t: "struct.move", id: chair.id, x: 0, z: 6 }, as("u"));
  assert.equal(s.structures[chair.id].x, 0);
});

test("a prop knocked about shoves the balls in its way; a ball kicked into a prop pushes it a little", () => {
  setRoomScale(mapDef("paintball").scale);
  const s = createState({ map: "paintball" }, newId);
  const can = s.structures["can-a"],
    start = can.x,
    ball = s.balls.find((b) => b.kind === "paintball");
  Object.assign(ball, { x: can.x + 2, z: can.z, y: ball.size / 2, vx: 0, vy: 0, vz: 0 });
  const ball0 = ball.x;
  applyOp(s, { t: "boom", kind: "grenade", x: can.x - 1, y: 0.4, z: can.z }, as("u"));
  for (let i = 0; i < 240; i++) {
    stepProps(s, 1 / 120);
    stepWorld(s, 1 / 120);
  }
  assert(s.structures["can-a"].x > start + 1, "the can flew");
  assert(ball.x > ball0 + 0.5, `the ball was pushed on: ${ball.x - ball0}`);
  setRoomScale(1);
  const c = createState({ map: "cinema" }, newId),
    pop = { ...c.structures.popcorn },
    football = c.balls.find((b) => b.kind === "football");
  Object.assign(football, { x: pop.x, z: pop.z + 1.5, y: football.size / 2, vx: 0, vz: -10, vy: 0 });
  for (let i = 0; i < 360; i++) {
    stepWorld(c, 1 / 120);
    stepProps(c, 1 / 120);
  }
  assert(c.structures.popcorn.z < pop.z - 0.1, `the popcorn machine moved: ${c.structures.popcorn.z - pop.z}`);
  assert(football.vz > -1, "the ball bounced off");
});

test("poll: a question and 2–10 options; one answer or several; open polls show who, anonymous do not; the author closes it", () => {
  const s = createState({}, newId);
  assert.equal(applyOp(s, { t: "poll.create", q: "Где обедаем?", options: ["Пицца"] }, as("a", "Аня")), null, "needs two options");
  applyOp(s, { t: "poll.create", q: "Где обедаем?", options: ["Пицца", "Суши", " ", "Шаурма"], anon: false, multi: false }, as("a", "Аня"));
  const id = s.poll.id;
  assert.deepEqual(s.poll.options, ["Пицца", "Суши", "Шаурма"]);
  applyOp(s, { t: "poll.vote", id, choices: [1, 2] }, as("b", "Борис"));
  assert.deepEqual(s.poll.votes.b, { c: [1], n: "Борис" }, "one answer only, with the name");
  applyOp(s, { t: "poll.vote", id, choices: [] }, as("b", "Борис"));
  assert.equal(s.poll.votes.b, undefined, "withdrawn");
  assert.equal(applyOp(s, { t: "poll.close", id }, as("b")), null, "only the author closes it");
  applyOp(s, { t: "poll.close", id }, as("a"));
  assert.equal(applyOp(s, { t: "poll.vote", id, choices: [0] }, as("b")), null, "closed");
  applyOp(s, { t: "poll.clear", id }, as("b"));
  assert.equal(s.poll, null, "anyone can take a finished poll away");
  applyOp(s, { t: "poll.create", q: "Что улучшить?", options: ["Звук", "Свет", "Сцену"], anon: true, multi: true }, as("a", "Аня"));
  applyOp(s, { t: "poll.vote", id: s.poll.id, choices: [0, 2] }, as("b", "Борис"));
  assert.deepEqual(s.poll.votes.b, { c: [0, 2] }, "several answers, no name");
  const again = createState(JSON.parse(JSON.stringify(serializeState(s))), newId);
  assert.deepEqual(again.poll.votes.b, { c: [0, 2] }, "kept with the room");
});

test("drawings: strokes on the floor and on the board, your own undo, clear; the floor's go with the map, the board's stay", () => {
  const s = createState({}, newId);
  applyOp(s, { t: "draw.add", on: "floor", c: "#ef476f", w: 0.08, p: [0, 0, 1, 1, 2, 0.5] }, as("a"));
  applyOp(s, { t: "draw.add", on: "wall", c: "#4cc9f0", w: 0.04, p: [0, 3, 1, 4] }, as("b"));
  assert.equal(applyOp(s, { t: "draw.add", on: "floor", c: "#fff", p: [1] }, as("a")), null, "needs a point");
  assert.equal(s.strokes.length, 2);
  applyOp(s, { t: "draw.add", on: "floor", c: "javascript:", w: 99, p: [0, 0, 0.5, 0.5] }, as("a"));
  assert.equal(s.strokes.at(-1).c, "#f4d35e", "a bad colour is replaced");
  assert.equal(s.strokes.at(-1).w, 0.3, "the width is limited");
  applyOp(s, { t: "draw.undo" }, as("b"));
  assert(!s.strokes.some((st) => st.by === "b"), "b's own stroke is gone");
  assert.equal(s.strokes.length, 2, "a's are not");
  applyOp(s, { t: "draw.add", on: "wall", c: "#4cc9f0", w: 0.04, p: [0, 3, 1, 4] }, as("b"));
  applyOp(s, { t: "map.set", id: "paintball" }, as("a"));
  assert.deepEqual(s.strokes.map((st) => st.on), ["wall"], "the floor's are gone with the map");
  applyOp(s, { t: "draw.clear" }, as("a"));
  assert.equal(s.strokes.length, 0);
});

test("shapes: the shape tool puts cubes, spheres, tori and the rest on the field; an unknown shape is a cube", () => {
  setRoomScale(1);
  const s = createState({}, newId);
  for (const shape of ["sphere", "torus", "star", "gem", "nope"]) applyOp(s, { t: "cube.add", x: 1, z: 4, shape }, as("a"));
  assert.deepEqual(s.cubes.slice(-5).map((c) => c.shape), ["sphere", "torus", "star", "gem", "cube"]);
  const again = createState(JSON.parse(JSON.stringify(serializeState(s))), newId);
  assert.deepEqual(again.cubes.slice(-5).map((c) => c.shape), ["sphere", "torus", "star", "gem", "cube"]);
});
