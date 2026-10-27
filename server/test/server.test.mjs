import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createServer } from "../src/index.js";
import { MemoryStore } from "../src/store.js";
import { livekitToken } from "../src/livekit.js";
import { createHmac } from "node:crypto";

// A test client that records every message and can wait for one matching a predicate.
function client(port, origin) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, origin ? { origin } : {});
  const inbox = [],
    waiters = [];
  const opened = new Promise((r, j) => (ws.once("open", r), ws.once("error", j)));
  opened.catch(() => {});
  ws.on("message", (d) => {
    const m = JSON.parse(d);
    inbox.push(m);
    for (const w of [...waiters])
      if (w.pred(m)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(m);
      }
  });
  const c = {
    ws,
    inbox,
    open: () => opened,
    send: (m) => ws.send(JSON.stringify(m)),
    wait(pred, ms = 2000) {
      const found = inbox.find(pred);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const w = { pred, resolve };
        waiters.push(w);
        setTimeout(() => reject(new Error("timeout waiting for message")), ms);
      });
    },
    next(t, ms) {
      const start = inbox.length;
      return c.wait((m) => m.t === t && inbox.indexOf(m) >= start, ms);
    },
    async join(room, extra = {}) {
      await c.open();
      c.send({ t: "hello", room, uid: extra.uid || "uid-" + Math.random().toString(36).slice(2, 10), profile: { name: extra.name || "Тест", color: "#ffffff" }, ...extra });
      c.welcome = await c.wait((m) => m.t === "welcome");
      return c.welcome;
    },
    close: () => ws.close(),
  };
  return c;
}
async function boot(opts = {}) {
  const store = opts.store || new MemoryStore();
  const app = createServer({ port: 0, store, log: () => {}, unloadAfter: 50, ...opts });
  const port = await app.listen();
  return { app, port, store };
}

test("peers see each other join, move and leave; poses are relayed with server time", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port);
  const wa = await a.join("team-1", { name: "Аня" });
  assert.equal(wa.peers.length, 0);
  assert.equal(wa.state.notes.length, 0);
  assert.equal(wa.objs.length, 5, "four cubes and the ball");
  const wb = await b.join("team-1", { name: "Борис" });
  assert.deepEqual(wb.peers.map((p) => p.profile.name), ["Аня"]);
  const joined = await a.wait((m) => m.t === "join");
  assert.equal(joined.profile.name, "Борис");
  b.send({ t: "pose", x: 1.5, y: 0.2, z: -2, a: 0.5, vy: 3, g: 0 });
  const pose = await a.wait((m) => m.t === "pose");
  assert.equal(pose.id, wb.id);
  assert.equal(pose.x, 1.5);
  assert.equal(pose.g, 0);
  assert(pose.s > 0);
  assert.equal(b.inbox.filter((m) => m.t === "pose").length, 0, "no echo to sender");
  b.send({ t: "pose", x: 999, y: -5, z: NaN });
  b.send({ t: "pose", x: 999, y: -5, z: 3 });
  const clamped = await a.wait((m) => m.t === "pose" && m.z === 3);
  assert(clamped.x < 15 && clamped.y === 0, "positions are clamped to the room");
  b.close();
  const left = await a.wait((m) => m.t === "leave");
  assert.equal(left.id, wb.id);
  a.close();
  await app.close();
});

test("notes, votes, timer and cubes are authoritative and reach every participant", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port);
  await a.join("retro");
  await b.join("retro", { name: "Борис" });
  b.send({ t: "note.add", text: "Пятничные демо", type: "idea", x: 1, z: 2 });
  const na = await a.wait((m) => m.t === "note");
  const nb = await b.wait((m) => m.t === "note");
  assert.equal(na.note.id, nb.note.id);
  assert.equal(na.note.author, "Борис");
  assert.equal(na.note.type, "idea");
  a.send({ t: "note.vote", id: na.note.id });
  const voted = await b.wait((m) => m.t === "note" && m.note.voters.length === 1);
  assert.deepEqual(voted.note.voters, [a.welcome.voter], "votes are keyed by an opaque voter id");
  a.send({ t: "note.vote", id: na.note.id });
  await b.wait((m) => m.t === "note" && m.note.voters.length === 0 && b.inbox.indexOf(m) > b.inbox.indexOf(voted));
  a.send({ t: "note.move", id: na.note.id, x: -3, z: 4 });
  const moved = await b.wait((m) => m.t === "note.move");
  assert.deepEqual([moved.x, moved.z], [-3, 4]);
  b.send({ t: "note.add", text: "   " });
  b.send({ t: "note.edit", id: "nope", text: "x" });
  a.send({ t: "timer.start", minutes: 3 });
  const timer = await b.wait((m) => m.t === "timer");
  assert.equal(timer.timer.running, true);
  assert(Math.abs(timer.timer.endAt - Date.now() - 180000) < 2000);
  a.send({ t: "cube.add", x: 0, z: 3 });
  const cube = await b.wait((m) => m.t === "cube");
  a.send({ t: "cube.del", id: cube.cube.id });
  await b.wait((m) => m.t === "cube.del");
  b.send({ t: "note.del", id: na.note.id });
  await a.wait((m) => m.t === "note.del");
  assert.equal(b.inbox.filter((m) => m.t === "error").length, 0, "invalid ops are ignored silently");
  // A newcomer receives the current state.
  const c = client(port);
  const wc = await c.join("retro");
  assert.equal(wc.state.notes.length, 0);
  assert.equal(wc.state.timer.running, true);
  assert.equal(wc.peers.length, 2);
  for (const x of [a, b, c]) x.close();
  await app.close();
});

test("server simulates kicked cubes and the ball, streams them and lets them settle", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port);
  const wa = await a.join("physics");
  await b.join("physics");
  const ball = wa.objs.find((o) => o[0] === "football");
  a.send({ t: "obj.kick", id: "football", x: ball[1], z: ball[3] - 1, power: 8 });
  const first = await b.wait((m) => m.t === "objs" && m.o.some((o) => o[0] === "football"));
  const fb = first.o.find((o) => o[0] === "football");
  assert(fb[6] > 1, "ball moves away from the kicker along +z");
  // Wait until the server reports the ball at rest.
  const rest = await b.wait(
    (m) => m.t === "objs" && m.o.some((o) => o[0] === "football" && o[4] === 0 && o[6] === 0 && o[5] === 0),
    8000,
  );
  const settled = rest.o.find((o) => o[0] === "football");
  assert(settled[3] > ball[3] + 1, "ball travelled");
  const updates = b.inbox.filter((m) => m.t === "objs").length;
  assert(updates > 10, "streamed at a steady rate");
  assert.equal(app.rooms.get("physics").physTimer, null, "simulation sleeps when everything rests");
  // Far-away kicks are rejected.
  a.send({ t: "obj.kick", id: "football", x: 100, z: 100, power: 8 });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(app.rooms.get("physics").physTimer, null);
  a.close();
  b.close();
  await app.close();
});

test("dragging is kinematic for one owner and release hands the object back to physics", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port);
  const wa = await a.join("drag");
  await b.join("drag");
  const cube = wa.objs[0][0];
  a.send({ t: "obj.drag", id: cube, x: 0, z: 0 });
  a.send({ t: "obj.drag", id: cube, x: 0.5, z: 0 });
  b.send({ t: "obj.drag", id: cube, x: -5, z: -5 });
  const seen = await b.wait((m) => m.t === "objs" && m.o.some((o) => o[0] === cube && o[1] === 0.5));
  assert(seen);
  await new Promise((r) => setTimeout(r, 100));
  const last = b.inbox.filter((m) => m.t === "objs").flatMap((m) => m.o).filter((o) => o[0] === cube).at(-1);
  assert.equal(last[1], 0.5, "another participant cannot steal a drag in progress");
  a.send({ t: "obj.release", id: cube, vx: 3, vz: 0 });
  await b.wait((m) => m.t === "objs" && m.o.some((o) => o[0] === cube && o[1] > 0.6), 3000);
  a.close();
  b.close();
  await app.close();
});

test("goals are detected on the server and announced with the score", async () => {
  const { app, port } = await boot();
  const a = client(port);
  await a.join("football");
  const room = app.rooms.get("football");
  Object.assign(room.state.ball, { x: 8.1, z: -4.3, y: 0.42, vx: 0, vz: -6, vy: 0 });
  room.startPhysics();
  const goal = await a.wait((m) => m.t === "goal");
  assert.equal(goal.score, 1);
  a.close();
  await app.close();
});

test("room state persists across server restarts", async () => {
  const store = new MemoryStore();
  let { app, port } = await boot({ store });
  const a = client(port);
  await a.join("keep");
  a.send({ t: "note.add", text: "Сохранится", type: "good", x: 0, z: 0 });
  a.send({ t: "struct.move", id: "pyramid", x: 1, z: 1 });
  await a.wait((m) => m.t === "note");
  a.close();
  await new Promise((r) => setTimeout(r, 50));
  await app.close();
  ({ app, port } = await boot({ store }));
  const b = client(port);
  const w = await b.join("keep");
  assert.equal(w.state.notes[0].text, "Сохранится");
  assert.deepEqual(w.state.structures.pyramid, { x: 1, z: 1 });
  b.close();
  await app.close();
});

test("a browser keeps its identity across reconnects; full rooms and bad origins are refused", async () => {
  const { app, port } = await boot({ allowedOrigins: ["https://sohimazdai.ru", "http://localhost:*"] });
  const a = client(port, "https://sohimazdai.ru");
  const w = await a.join("ids", { uid: "browser-1" });
  const again = client(port, "http://localhost:8000");
  const w2 = await again.join("ids", { uid: "browser-1" });
  assert.equal(w2.id, w.id, "same browser keeps its identity");
  assert.equal((await a.wait((m) => m.t === "error")).code, "replaced", "the older tab is told why it was disconnected");
  assert(!JSON.stringify(w2).includes("browser-1"), "the secret uid is never sent back");
  const other = client(port);
  const w3 = await other.join("ids", { uid: "browser-2" });
  assert.notEqual(w3.id, w.id);
  other.close();
  const evil = client(port, "https://evil.example");
  await assert.rejects(evil.open());
  const many = [];
  for (let i = 0; i < 15; i++) {
    const c = client(port);
    await c.join("ids");
    many.push(c);
  }
  const extra = client(port);
  await extra.open();
  extra.send({ t: "hello", room: "ids", uid: "late-uid", profile: {} });
  const err = await extra.wait((m) => m.t === "error");
  assert.equal(err.code, "full");
  const bad = client(port);
  await bad.open();
  bad.send({ t: "hello", room: "../etc", uid: "x-uid-1", profile: {} });
  assert.equal((await bad.wait((m) => m.t === "error")).code, "room");
  for (const c of [again, ...many]) c.close();
  await app.close();
});

test("clock pings, emotes and actions are relayed; floods are cut off", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port);
  await a.join("acts");
  await b.join("acts");
  a.send({ t: "ping", c: 123.5 });
  const pong = await a.wait((m) => m.t === "pong");
  assert.equal(pong.c, 123.5);
  a.send({ t: "act", k: "throw", to: [1, 1, 1] });
  a.send({ t: "act", k: "emote", e: "heart" });
  a.send({ t: "act", k: "rm -rf" });
  await b.wait((m) => m.t === "act" && m.k === "emote");
  const acts = b.inbox.filter((m) => m.t === "act");
  assert.deepEqual(acts.map((m) => m.k), ["throw", "emote"]);
  for (let i = 0; i < 500; i++) a.send({ t: "pose", x: i / 100, y: 0, z: 0 });
  await new Promise((r) => setTimeout(r, 200));
  const relayed = b.inbox.filter((m) => m.t === "pose").length;
  assert(relayed <= 70, `pose flood is limited (${relayed})`);
  a.close();
  b.close();
  await app.close();
});

test("LiveKit tokens are valid HS256 JWTs bound to the room and the peer", async () => {
  const lk = { url: "wss://api.example", apiKey: "APIkey", apiSecret: "secret-secret" };
  const { app, port } = await boot({ livekit: lk });
  const a = client(port);
  const w = await a.join("media", { name: "Аня" });
  assert.equal(w.rtc.url, lk.url);
  const [h, p, s] = w.rtc.token.split(".");
  const expected = createHmac("sha256", lk.apiSecret).update(`${h}.${p}`).digest("base64url");
  assert.equal(s, expected);
  const payload = JSON.parse(Buffer.from(p, "base64url"));
  assert.equal(payload.iss, "APIkey");
  assert.equal(payload.sub, w.id);
  assert.equal(payload.name, "Аня");
  assert.equal(payload.video.room, "kino-media");
  assert.equal(payload.video.roomJoin, true);
  assert(livekitToken({ ...lk, room: "r", identity: "i", name: "n" }).split(".").length === 3);
  a.close();
  await app.close();
});
