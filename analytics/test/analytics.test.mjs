import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAnalytics, normalizePath } from "../src/server.js";
import { aggregate, parseMap } from "../agent/caddy-agent.js";

const file = () => join(mkdtempSync(join(tmpdir(), "an-")), "events.db");
async function boot() {
  const a = createAnalytics({ file: file(), origins: ["https://sohimazdai.ru"], token: "t0k", salt: "s" });
  const port = await a.listen(0);
  const post = (path, body, headers = {}) => fetch(`http://127.0.0.1:${port}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { a, post };
}

test("browser events: only from our site and known apps; the uid is stored hashed; paths lose their ids", async () => {
  const { a, post } = await boot();
  const ok = await post("/a/e", { app: "planner", uid: "browser-123456", events: [{ n: "pageview", p: "/project/8f3a9c21b7?x=1" }, { n: "edit", k: { what: "wall", bad: { x: 1 } } }, { n: "BAD NAME" }] }, { Origin: "https://sohimazdai.ru" });
  assert.equal(ok.status, 204);
  assert.equal((await post("/a/e", { app: "planner", events: [{ n: "x" }] }, { Origin: "https://evil.example" })).status, 429);
  assert.equal((await post("/a/e", { app: "unknown", events: [{ n: "x" }] }, { Origin: "https://sohimazdai.ru" })).status, 400);
  const rows = a.store.query("SELECT name, uid, path, props FROM events ORDER BY rowid");
  assert.deepEqual(rows.map((r) => r.name), ["pageview", "edit"]);
  assert.equal(rows[0].path, "/project/:id");
  assert(rows[0].uid && rows[0].uid !== "browser-123456" && rows[0].uid.length === 16, "hashed");
  assert.deepEqual(JSON.parse(rows[1].props), { what: "wall" });
  await a.close();
});

test("server events and gauges need the token; uniques per day and sums come out of plain SQL", async () => {
  const { a, post } = await boot();
  assert.equal((await post("/a/s", { app: "retrocine", events: [{ n: "visit" }] })).status, 401);
  const r = await post("/a/s", { app: "retrocine", events: [{ n: "visit", uid: "u1" }, { n: "visit", uid: "u2" }, { n: "visit", uid: "u1" }, { n: "distance", v: 1250.5, k: { mode: "foot" } }], gauges: [{ n: "online", v: 3 }] }, { Authorization: "Bearer t0k" });
  assert.equal(r.status, 204);
  assert.equal(a.store.query("SELECT COUNT(DISTINCT uid) n FROM events WHERE app='retrocine' AND name='visit'")[0].n, 2);
  assert.equal(a.store.query("SELECT SUM(value) km FROM events WHERE name='distance'")[0].km, 1250.5);
  assert.equal(a.store.query("SELECT value FROM gauges WHERE name='online'")[0].value, 3);
  await a.close();
});

test("the Caddy agent counts requests per minute and url, for the app the host and path belong to", () => {
  const map = parseMap("sohimazdai.ru/cine=retrocine,api.sohimazdai.ru=retrocine,sohimazdai.ru=planner");
  const line = (host, uri, status = 200, ts = 1700000000.5) => JSON.stringify({ ts, status, request: { host, uri } });
  const out = aggregate([line("sohimazdai.ru", "/cine/app.js"), line("sohimazdai.ru", "/cine/app.js?v=2"), line("sohimazdai.ru", "/api/projects/12345", 404), line("api.sohimazdai.ru", "/ws"), "not json"], map);
  assert.deepEqual(out.retrocine.map((e) => [e.p, e.v]).sort(), [["/cine/app.js", 2], ["/ws", 1]]);
  assert.deepEqual(out.planner.map((e) => [e.p, e.v, e.k.status]), [["/api/projects/:id", 1, "4xx"]]);
  assert.equal(normalizePath("/a/0f9e8d7c-1111-2222/b"), "/a/:id/b");
});
