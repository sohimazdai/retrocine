// Сервис аналитики для всех приложений (retrocine, planner, следующие). Принимает события:
//   POST /a/e — из браузера: { app, uid, events: [{ n, p?, v?, k? }] } (n — имя, p — путь страницы,
//     v — число, k — небольшие свойства). Разрешены только известные приложения и Origin.
//   POST /a/s — от серверов и агентов с токеном (Authorization: Bearer …):
//     { app, events: [{ n, uid?, p?, v?, k?, ts? }], gauges: [{ n, v, ts? }] }.
//   GET /a/health.
// uid из браузера хранится только хешем с солью (сырой идентификатор в базу не попадает).
// Новое приложение подключается одной строкой в ANALYTICS_APPS — схема общая.
import http from "node:http";
import { createHash } from "node:crypto";
import { Store } from "./store.js";

const str = (v, max) => (typeof v === "string" && v ? v.slice(0, max) : null);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 1);
const NAME = /^[a-z][a-z0-9_.:-]{0,47}$/;
// Небольшие свойства события: до 8 ключей, строки до 64 символов, числа, логические.
function props(k) {
  if (!k || typeof k !== "object" || Array.isArray(k)) return null;
  const out = {};
  let n = 0;
  for (const [key, v] of Object.entries(k)) {
    if (n >= 8 || !/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(key)) continue;
    if (typeof v === "string") out[key] = v.slice(0, 64);
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean") out[key] = v;
    else continue;
    n++;
  }
  return n ? out : null;
}
// Путь без параметров и без идентификаторов (/project/8f3a… → /project/:id), чтобы урлы группировались.
export function normalizePath(p) {
  if (typeof p !== "string") return null;
  const path = p.split(/[?#]/)[0].slice(0, 200) || "/";
  return path
    .split("/")
    .map((s) => (/^[0-9]+$/.test(s) || /^[0-9a-f-]{8,}$/i.test(s) || /^[A-Za-z0-9_-]{20,}$/.test(s) ? ":id" : s))
    .join("/");
}

export function createAnalytics({ file, apps = ["retrocine", "planner"], origins = [], token = "", salt = "", now = () => Date.now(), log = () => {} } = {}) {
  const store = new Store(file);
  const hits = new Map();
  const hash = (uid) => (uid ? createHash("sha256").update(salt + ":" + uid).digest("hex").slice(0, 16) : null);
  // Не больше 120 запросов в минуту с одного адреса.
  function limited(ip) {
    const t = now(),
      h = hits.get(ip) || { t, n: 0 };
    if (t - h.t > 60000) Object.assign(h, { t, n: 0 });
    h.n++;
    hits.set(ip, h);
    if (hits.size > 5000) hits.clear();
    return h.n > 120;
  }
  function body(req, max) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on("data", (c) => {
        size += c.length;
        if (size > max) {
          reject(new Error("too big"));
          req.destroy();
        } else chunks.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
  }
  function cors(req, res) {
    const origin = req.headers.origin;
    if (origin && origins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    return !origin || origins.includes(origin);
  }
  const server = http.createServer(async (req, res) => {
    const url = req.url.split("?")[0];
    const done = (code, text = "") => {
      res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(text);
    };
    try {
      if (url === "/a/health") return done(200, "ok");
      if (req.method === "OPTIONS" && url === "/a/e") return done(cors(req, res) ? 204 : 403);
      if (req.method !== "POST") return done(404);
      const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      if (url === "/a/e") {
        // Из браузера: свой Origin, известное приложение, не чаще лимита.
        if (!cors(req, res) || limited(ip)) return done(429);
        const m = JSON.parse(await body(req, 32768));
        if (!apps.includes(m.app) || !Array.isArray(m.events)) return done(400);
        const uid = hash(str(m.uid, 64)),
          t = now();
        const rows = m.events
          .slice(0, 50)
          .filter((e) => e && NAME.test(e.n))
          .map((e) => ({ ts: t, app: m.app, name: e.n, uid, path: normalizePath(e.p), value: num(e.v), props: props(e.k) }));
        if (rows.length) store.events(rows);
        return done(204);
      }
      if (url === "/a/s") {
        // От своих серверов и агентов: с токеном.
        if (!token || req.headers.authorization !== "Bearer " + token) return done(401);
        const m = JSON.parse(await body(req, 1 << 20));
        if (!apps.includes(m.app)) return done(400);
        const t = now(),
          at = (ts) => (typeof ts === "number" && Math.abs(ts - t) < 7 * 86400000 ? ts : t);
        const events = (m.events || [])
          .slice(0, 5000)
          .filter((e) => e && NAME.test(e.n))
          .map((e) => ({ ts: at(e.ts), app: m.app, name: e.n, uid: str(e.uid, 32), path: normalizePath(e.p), value: num(e.v), props: props(e.k) }));
        const gauges = (m.gauges || [])
          .slice(0, 500)
          .filter((g) => g && NAME.test(g.n) && typeof g.v === "number" && Number.isFinite(g.v))
          .map((g) => ({ ts: at(g.ts), app: m.app, name: g.n, value: g.v }));
        if (events.length) store.events(events);
        if (gauges.length) store.gauges(gauges);
        return done(204);
      }
      done(404);
    } catch (e) {
      log("analytics: " + e.message);
      if (!res.headersSent) done(400);
    }
  });
  const pruner = setInterval(() => store.prune(), 86400000);
  pruner.unref();
  return {
    server,
    store,
    listen: (port = 8095, host = "127.0.0.1") => new Promise((r) => server.listen(port, host, () => r(server.address().port))),
    close: () =>
      new Promise((r) => {
        clearInterval(pruner);
        server.close(() => {
          store.close();
          r();
        });
      }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = process.env;
  const app = createAnalytics({
    file: env.ANALYTICS_DB || "/var/lib/analytics/events.db",
    apps: (env.ANALYTICS_APPS || "retrocine,planner").split(",").map((s) => s.trim()).filter(Boolean),
    origins: (env.ANALYTICS_ORIGINS || "https://sohimazdai.ru,https://www.sohimazdai.ru").split(",").map((s) => s.trim()).filter(Boolean),
    token: env.ANALYTICS_TOKEN || "",
    salt: env.ANALYTICS_SALT || "",
    log: (m) => console.log(m),
  });
  const port = await app.listen(+(env.ANALYTICS_PORT || 8095), env.ANALYTICS_HOST || "127.0.0.1");
  console.log(`analytics on ${port}`);
  for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => app.close().then(() => process.exit(0)));
}
