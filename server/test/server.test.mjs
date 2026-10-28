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
        setTimeout(() => reject(new Error("timeout waiting for message: " + pred.toString().slice(0, 120))), ms);
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
  Object.assign(room.state.balls[0], { x: 8.1, z: -4.3, y: 0.42, vx: 0, vz: -6, vy: 0 });
  room.startPhysics();
  const goal = await a.wait((m) => m.t === "goal");
  assert.equal(goal.score, 1);
  assert.equal(goal.goal, "goal");
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

test("Shift pushes: a light prop moves for one avatar, a heavy one needs several on its side", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port),
    c = client(port);
  await a.join("push");
  await b.join("push");
  await c.join("push");
  const room = app.rooms.get("push");
  const spool = { ...room.state.structures["spool-b"] }; // x 6.2, z 5.8, r 1.25
  // A stands just right of the spool and pushes left (−x).
  a.send({ t: "pose", x: spool.x + 1.5, y: 0, z: spool.z, a: 0, vy: 0, g: 1, sh: 1, m: [-1, 0] });
  await b.wait((m) => m.t === "struct" && m.id === "spool-b" && m.x < spool.x - 0.2, 3000);
  a.send({ t: "pose", x: spool.x + 1.5, y: 0, z: spool.z, a: 0, vy: 0, g: 1 });
  await new Promise((r) => setTimeout(r, 120));
  const pyramid = { ...room.state.structures.pyramid }; // 4.4 × 4.4, weight 3
  const pushRight = (cl, dz) => cl.send({ t: "pose", x: pyramid.x - 2.5, y: 0, z: pyramid.z + dz, a: 0, vy: 0, g: 1, sh: 1, m: [1, 0] });
  pushRight(a, 0);
  pushRight(b, 1);
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(room.state.structures.pyramid.x, pyramid.x, "two avatars are not enough for the pyramid");
  pushRight(c, -1);
  await a.wait((m) => m.t === "struct" && m.id === "pyramid" && m.x > pyramid.x + 0.1, 3000);
  for (const cl of [a, b, c]) cl.close();
  await app.close();
});

test("Shift lift: avatars on opposite sides lift a prop, carry it together and drop it on release", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port);
  await a.join("lift");
  await b.join("lift");
  const room = app.rooms.get("lift");
  const s = { ...room.state.structures["spool-a"] }; // x −8.3, z 3.7, r 1.25, lift 2
  const pose = (cl, x, z, extra) => cl.send({ t: "pose", x, y: 0, z, a: 0, vy: 0, g: 1, sh: 1, ...extra });
  pose(a, s.x - 1.5, s.z, { m: [1, 0] });
  pose(b, s.x + 1.5, s.z, { m: [-1, 0] });
  const up = await a.wait((m) => m.t === "struct" && m.id === "spool-a" && m.y > 1, 3000);
  assert.equal(up.by.length, 2);
  // Both walk +z by 2 units: the spool follows their midpoint.
  pose(a, s.x - 1.5, s.z + 2, { m: [0, 1] });
  pose(b, s.x + 1.5, s.z + 2, { m: [0, 1] });
  await a.wait((m) => m.t === "struct" && m.id === "spool-a" && Math.abs(m.z - (s.z + 2)) < 0.05, 3000);
  a.send({ t: "pose", x: s.x - 1.5, y: 0, z: s.z + 2, a: 0, vy: 0, g: 1 });
  const down = await b.wait((m) => m.t === "struct" && m.id === "spool-a" && m.y === 0, 3000);
  assert.equal(down.by.length, 0);
  a.close();
  b.close();
  await app.close();
});

test("grenades explode only when thrown, respect the cooldown and blast objects away", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port);
  await a.join("boom");
  await b.join("boom");
  const room = app.rooms.get("boom");
  const ball = room.state.balls[0];
  a.send({ t: "boom", kind: "grenade", pid: "fake", x: ball.x, y: 0.3, z: ball.z });
  a.send({ t: "act", k: "throw", w: "grenade", to: [ball.x, 0, ball.z], pid: "g1", pw: 1.3 });
  a.send({ t: "act", k: "throw", w: "grenade", to: [ball.x, 0, ball.z], pid: "g2" });
  const thrown = await b.wait((m) => m.t === "act" && m.k === "throw");
  assert.equal(thrown.w, "grenade");
  assert.equal(thrown.pw, 1.3);
  a.send({ t: "boom", kind: "grenade", pid: "g2", x: ball.x - 1, y: 0.3, z: ball.z });
  a.send({ t: "boom", kind: "grenade", pid: "g1", x: ball.x - 1, y: 0.3, z: ball.z });
  const boom = await b.wait((m) => m.t === "boom");
  assert.equal(boom.pid, "g1");
  assert.equal(boom.by, a.welcome.id);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(b.inbox.filter((m) => m.t === "act").length, 1, "second grenade within 10 s is refused");
  assert.equal(b.inbox.filter((m) => m.t === "boom").length, 1, "fake and refused grenades do not explode");
  const flying = await b.wait((m) => m.t === "objs" && m.o.some((o) => o[0] === "football" && o[4] > 1));
  assert(flying);
  a.close();
  b.close();
  await app.close();
});

test("a map switch resets the room for everyone; the river keeps flowing while people are in", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port);
  await a.join("map-room", { name: "Аня" });
  await b.join("map-room", { name: "Борис" });
  a.send({ t: "map.set", id: "river" });
  const reset = await b.wait((m) => m.t === "reset");
  assert.equal(reset.state.map, "river");
  assert.equal(reset.by, a.welcome.id);
  assert(reset.objs.length >= 10, "stones of the river");
  // The current moves the stones without anyone touching them.
  const first = await b.next("objs", 3000);
  await new Promise((r) => setTimeout(r, 600));
  const later = await b.next("objs", 3000);
  assert(first.s < later.s);
  // A newcomer appears on one of the beaches, not in the water.
  const c = client(port);
  const wc = await c.join("map-room", { name: "Вера" });
  assert(Math.abs(wc.you.pose.x) > 5 && Math.abs(wc.you.pose.x) < 7.2, `spawned at ${wc.you.pose.x}`);
  assert.equal(wc.state.map, "river");
  // Unknown maps are refused.
  a.send({ t: "map.set", id: "nowhere" });
  a.send({ t: "map.set", id: "saloon" });
  const back = await c.wait((m) => m.t === "reset" && m.state.map === "saloon");
  assert.equal(back.state.balls.filter((x) => x.kind === "mug").length, 5);
  for (const x of [a, b, c]) x.close();
  await app.close();
});

test("rides: one rider per board, taken only from next to it, left where you step off or leave", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port);
  await a.join("park", { name: "Аня" });
  await b.join("park", { name: "Борис" });
  a.send({ t: "map.set", id: "skatepark" });
  const reset = await b.wait((m) => m.t === "reset");
  const board = reset.state.rides.find((r) => r.id === "board-1");
  assert.equal(board.by, null);
  // Too far away: nothing happens. Next to it: it is yours.
  a.send({ t: "pose", x: 0, y: 0, z: -5, a: 0, vy: 0, g: 1 });
  a.send({ t: "ride.take", id: "board-1" });
  a.send({ t: "pose", x: board.x + 0.5, y: 0, z: board.z, a: 0, vy: 0, g: 1 });
  await new Promise((r) => setTimeout(r, 50));
  a.send({ t: "ride.take", id: "board-1" });
  const taken = await b.wait((m) => m.t === "ride" && m.ride.by === a.welcome.id);
  assert.equal(taken.ride.id, "board-1");
  assert.equal(b.inbox.filter((m) => m.t === "ride").length, 1, "the far attempt was refused");
  // Someone else cannot take it from under you, nor leave it for you.
  b.send({ t: "pose", x: board.x, y: 0, z: board.z, a: 0, vy: 0, g: 1 });
  b.send({ t: "ride.take", id: "board-1" });
  b.send({ t: "ride.leave", id: "board-1", x: 0, z: 0 });
  // Riding poses carry the board and the flip.
  a.send({ t: "pose", x: 1, y: 0.4, z: 2, a: 3.1, vy: 2, g: 0, rd: "board-1", fl: 0.5 });
  const pose = await b.wait((m) => m.t === "pose" && m.rd === "board-1");
  assert.equal(pose.fl, 0.5);
  a.send({ t: "ride.leave", id: "board-1", x: 1, z: 2, a: 3.1 });
  const left = await b.wait((m) => m.t === "ride" && m.ride.by === null);
  assert.deepEqual([left.ride.x, left.ride.z], [1, 2]);
  // Leaving the room on a board leaves the board where you were.
  b.send({ t: "pose", x: 1.5, y: 0, z: 2, a: 0, vy: 0, g: 1 });
  await new Promise((r) => setTimeout(r, 50));
  b.send({ t: "ride.take", id: "board-1" });
  await a.wait((m) => m.t === "ride" && m.ride.by === b.welcome.id);
  b.send({ t: "pose", x: -3, y: 0, z: 4, a: 0, vy: 0, g: 1, rd: "board-1" });
  await new Promise((r) => setTimeout(r, 50));
  b.close();
  const freed = await a.wait((m) => m.t === "ride" && m.ride.by === null && m.ride.x === -3);
  assert.equal(freed.ride.z, 4);
  a.close();
  await app.close();
});

test("karts: only a driver can knock someone over, the throw is limited; laps and tumbling poses are relayed", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port);
  await a.join("race", { name: "Аня" });
  await b.join("race", { name: "Борис" });
  a.send({ t: "map.set", id: "race" });
  await b.wait((m) => m.t === "reset");
  // On foot: no hits.
  a.send({ t: "pose", x: 0, y: 0, z: 6.7, a: 1.57, vy: 0, g: 1 });
  a.send({ t: "act", k: "hit", target: b.welcome.id, v: [8, 9, 0] });
  // Driving: a hit on someone who is not here, a malformed one, then a real one far too hard.
  a.send({ t: "pose", x: 0, y: 0, z: 6.7, a: 1.57, vy: 0, g: 1, kt: 1, ks: 0.4 });
  const driving = await b.wait((m) => m.t === "pose" && m.kt === 1);
  assert.equal(driving.ks, 0.4);
  a.send({ t: "act", k: "hit", target: "nobody", v: [8, 9, 0] });
  a.send({ t: "act", k: "hit", target: b.welcome.id, v: [8, "up", 0] });
  a.send({ t: "act", k: "hit", target: b.welcome.id, v: [80, 90, -3] });
  const hit = await b.wait((m) => m.t === "act" && m.k === "hit");
  assert.equal(hit.target, b.welcome.id);
  assert.deepEqual(hit.v, [14, 14, -3]);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(b.inbox.filter((m) => m.t === "act" && m.k === "hit").length, 1, "only the valid hit got through");
  // Laps: a sensible time only.
  a.send({ t: "act", k: "lap", ms: 200 });
  a.send({ t: "act", k: "lap", ms: 12345.6 });
  const lap = await b.wait((m) => m.t === "act" && m.k === "lap");
  assert.equal(lap.ms, 12346);
  // Борис flies and lands: his pose carries the turn of the body, the phase and how he lies.
  b.send({ t: "pose", x: 3, y: 1, z: 6.7, a: 0, vy: 2, g: 0, tq: [0.5123, 0, 0, 0.8588], tb: 2, tk: 1 });
  const tumbling = await a.wait((m) => m.t === "pose" && m.tb === 2);
  assert.deepEqual(tumbling.tq, [0.51, 0, 0, 0.86]);
  assert.equal(tumbling.tk, 1);
  b.send({ t: "pose", x: 3, y: 1, z: 6.7, a: 0, vy: 2, g: 0, tq: [1, 2], tb: 9, tk: 7 });
  const bad = await a.wait((m) => m.t === "pose" && m.x === 3 && m.tb !== 2);
  assert(bad.tq === undefined && bad.tb === undefined && bad.tk === undefined, "nonsense is dropped");
  a.close();
  b.close();
  await app.close();
});

test("team match: everyone readying up starts the countdown for all; melee reaches a real player only; a throw carries the thrower's speed", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port);
  await a.join("paintball-room", { name: "Аня" });
  await b.join("paintball-room", { name: "Борис" });
  a.send({ t: "map.set", id: "paintball" });
  await b.wait((m) => m.t === "reset");
  // Damage before a round is live counts for nothing.
  a.send({ t: "match.dmg", by: b.welcome.id, amount: 5 });
  a.send({ t: "match.ready" });
  const one = await b.wait((m) => m.t === "match" && m.match.phase === "idle");
  assert.equal(one.match.phase, "idle", "one of two ready: still waiting");
  b.send({ t: "match.ready" });
  const go = await a.wait((m) => m.t === "match" && m.match.phase === "countdown");
  assert(go.match.until > Date.now() + 8000, "a 10 s countdown");
  // Melee: relayed to the target, refused for someone not in the room.
  a.send({ t: "act", k: "melee", target: "ghost" });
  a.send({ t: "act", k: "melee", target: b.welcome.id });
  const hit = await b.wait((m) => m.t === "act" && m.k === "melee");
  assert.equal(hit.target, b.welcome.id);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(b.inbox.filter((m) => m.t === "act" && m.k === "melee").length, 1);
  a.send({ t: "act", k: "throw", to: [1, 0.2, 1], w: "snow", pw: 1, vel: [40, -3] });
  const thrown = await b.wait((m) => m.t === "act" && m.k === "throw");
  assert.deepEqual(thrown.vel, [12, -3], "speed is clamped");
  a.close();
  b.close();
  await app.close();
});

test("icicle frost only from a real icicle throw; a mine is set near you, armed, stepped on and goes off for everyone", async () => {
  const { app, port } = await boot();
  const a = client(port),
    b = client(port);
  await a.join("mines-room", { name: "Аня" });
  await b.join("mines-room", { name: "Борис" });
  // Frost without having thrown an icicle is refused; after one, accepted once.
  a.send({ t: "act", k: "frost", pid: "i1", x: 1, z: 1 });
  a.send({ t: "act", k: "throw", to: [1, 0.2, 1], w: "icicle", pw: 1, pid: "i1" });
  await b.wait((m) => m.t === "act" && m.k === "throw" && m.w === "icicle");
  a.send({ t: "act", k: "frost", pid: "i1", x: 1, z: 1 });
  a.send({ t: "act", k: "frost", pid: "i1", x: 1, z: 1 });
  await b.wait((m) => m.t === "act" && m.k === "frost");
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(b.inbox.filter((m) => m.t === "act" && m.k === "frost").length, 1);
  // A mine at Anya's feet.
  a.send({ t: "pose", x: 2, y: 0, z: 2, a: 0, vy: 0, g: 1 });
  await new Promise((r) => setTimeout(r, 50));
  a.send({ t: "mine.place", x: 2.2, z: 2.1 });
  const placed = await b.wait((m) => m.t === "mines" && m.mines.length === 1);
  const mine = placed.mines[0];
  assert.equal(mine.by, a.welcome.id);
  // Stepping on it before it is armed does nothing; after, the fuse starts.
  b.send({ t: "mine.step", id: mine.id });
  await new Promise((r) => setTimeout(r, 1300));
  b.send({ t: "mine.step", id: mine.id });
  const lit = await a.wait((m) => m.t === "mines" && m.mines[0]?.triggerAt);
  assert(lit.mines[0].triggerAt > Date.now() + 2000);
  const boom = await b.wait((m) => m.t === "boom" && m.kind === "mine", 5000);
  assert.equal(boom.by, a.welcome.id);
  await b.wait((m) => m.t === "mines" && m.mines.length === 0);
  a.close();
  b.close();
  await app.close();
});
