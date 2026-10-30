// kinō sync server: HTTP /health and a WebSocket at /ws. Rooms live in memory and are saved to disk.
import { analyticsClient } from "./analytics.js";
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { Room, MAX_PEERS } from "./room.js";
import { FileStore, MemoryStore } from "./store.js";
import { livekitConfig } from "./livekit.js";

const ROOM_ID = /^[a-z0-9][a-z0-9-]{2,31}$/;
const VERSION = (() => {
  try {
    return readFileSync(new URL("../RELEASE", import.meta.url), "utf8").trim();
  } catch {
    return process.env.RELEASE || "dev";
  }
})();

export function createServer({
  port = 8090,
  host = "127.0.0.1",
  store = new MemoryStore(),
  livekit = null,
  allowedOrigins = [],
  maxRooms = 500,
  maxPerIp = 40,
  unloadAfter = 60_000,
  log = console.log,
  analytics = analyticsClient(),
} = {}) {
  const rooms = new Map(),
    loading = new Map(),
    perIp = new Map(),
    started = Date.now();
  const originOk = (origin) =>
    !origin ||
    !allowedOrigins.length ||
    allowedOrigins.some((o) =>
      o.endsWith(":*") ? origin.startsWith(o.slice(0, -1)) : origin === o,
    );
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      let peers = 0;
      for (const r of rooms.values()) peers += r.size;
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ ok: true, version: VERSION, rooms: rooms.size, peers, uptime: Math.round((Date.now() - started) / 1000) }));
      return;
    }
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end("kinō sync server · WebSocket: /ws · https://sohimazdai.ru/cine/\n");
      return;
    }
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 64 * 1024 });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname !== "/ws" || !originOk(req.headers.origin)) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    const forwarded = req.headers["x-forwarded-for"];
    const ip =
      (req.socket.remoteAddress === "127.0.0.1" && forwarded?.split(",")[0].trim()) ||
      req.socket.remoteAddress;
    if ((perIp.get(ip) || 0) >= maxPerIp) {
      socket.end("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => connection(ws, ip));
  });

  async function getRoom(id) {
    if (rooms.has(id)) return rooms.get(id);
    if (loading.has(id)) return loading.get(id);
    if (rooms.size >= maxRooms) return null;
    const p = (async () => {
      const room = new Room(id, await store.load(id), { livekit, store, log, analytics });
      rooms.set(id, room);
      analytics.event("room.open", 1, { k: { map: room.state.map } });
      loading.delete(id);
      return room;
    })();
    loading.set(id, p);
    return p;
  }
  function scheduleUnload(room) {
    clearTimeout(room.unloadTimer);
    room.unloadTimer = setTimeout(async () => {
      if (room.size || rooms.get(room.id) !== room) return;
      rooms.delete(room.id);
      room.dispose();
      await room.flush();
    }, unloadAfter);
    room.unloadTimer.unref?.();
  }

  function connection(ws, ip) {
    perIp.set(ip, (perIp.get(ip) || 0) + 1);
    let room = null,
      peer = null,
      alive = true;
    ws.on("pong", () => (alive = true));
    ws.heartbeat = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
      ws.ping();
    }, 15_000);
    const helloTimeout = setTimeout(() => ws.close(4000, "no hello"), 10_000);
    ws.on("message", async (data, binary) => {
      if (binary) return;
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      if (!msg || typeof msg.t !== "string") return;
      if (peer) return room.handle(peer, msg);
      if (msg.t !== "hello" || ws.joining) return;
      if (typeof msg.room !== "string" || !ROOM_ID.test(msg.room)) {
        ws.send(JSON.stringify({ t: "error", code: "room", message: "Неверный адрес комнаты" }));
        return ws.close(4002, "bad room");
      }
      ws.joining = true;
      const r = await getRoom(msg.room);
      if (!r) {
        ws.send(JSON.stringify({ t: "error", code: "busy", message: "Сервер перегружен, попробуйте позже" }));
        return ws.close(4003, "busy");
      }
      if (ws.readyState !== 1) return;
      clearTimeout(helloTimeout);
      const result = r.join(ws, msg, ip);
      if (result.error) {
        ws.send(JSON.stringify({ t: "error", code: "full", message: `В комнате уже ${MAX_PEERS} участников` }));
        return ws.close(4004, "full");
      }
      clearTimeout(r.unloadTimer);
      room = r;
      peer = result.peer;
    });
    ws.on("close", () => {
      clearInterval(ws.heartbeat);
      clearTimeout(helloTimeout);
      const n = (perIp.get(ip) || 1) - 1;
      if (n) perIp.set(ip, n);
      else perIp.delete(ip);
      if (room && peer && !peer.replaced) {
        room.leave(peer);
        if (!room.size) scheduleUnload(room);
      }
    });
    ws.on("error", () => {});
  }

  const sweep = setInterval(() => store.sweep(30), 6 * 3600e3);
  sweep.unref?.();
  // Аналитика: сколько людей сейчас в комнатах и сколько комнат открыто (раз в 30 с).
  const census = setInterval(() => {
    analytics.gauge("online", [...rooms.values()].reduce((n, r) => n + r.size, 0));
    analytics.gauge("rooms", [...rooms.values()].filter((r) => r.size).length);
  }, 30_000);
  census.unref?.();
  return {
    server,
    rooms,
    listen: () =>
      new Promise((resolve) =>
        server.listen(port, host, () => resolve(server.address().port)),
      ),
    async close() {
      clearInterval(sweep);
      clearInterval(census);
      await analytics.close();
      for (const c of wss.clients) c.terminate();
      await Promise.all([...rooms.values()].map((r) => (r.dispose(), r.flush())));
      await new Promise((r) => server.close(r));
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = process.env;
  const app = createServer({
    port: Number(env.PORT || 8090),
    host: env.HOST || "127.0.0.1",
    store: new FileStore(env.DATA_DIR || "./data"),
    livekit: livekitConfig(env),
    allowedOrigins: (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
    // Аналитика (analytics/): локальный сервис на этом же сервере.
    analytics: analyticsClient({ url: env.ANALYTICS_URL || "", token: env.ANALYTICS_TOKEN || "", log: console.log }),
  });
  const port = await app.listen();
  console.log(`kinō sync ${VERSION} on ${env.HOST || "127.0.0.1"}:${port}, LiveKit ${livekitConfig(env) ? "on" : "off"}`);
  let stopping = false;
  for (const sig of ["SIGTERM", "SIGINT"])
    process.on(sig, async () => {
      if (stopping) return;
      stopping = true;
      await app.close();
      process.exit(0);
    });
}
