// Агент на каждом сервере: читает JSON-журнал запросов Caddy и раз в минуту отправляет в сервис
// аналитики, сколько запросов было к каждому урлу (для графиков RPM). Без зависимостей.
//   AGENT_LOG    — журнал Caddy (по умолчанию /var/log/caddy/access.log)
//   AGENT_URL    — куда слать (https://stats.sohimazdai.ru/a/s), AGENT_TOKEN — токен сервиса
//   AGENT_MAP    — какой хост и путь к какому приложению: "sohimazdai.ru/cine=retrocine,
//                  api.sohimazdai.ru=retrocine,sohimazdai.ru=planner" (побеждает самый длинный)
import fs from "node:fs";

// Урл без параметров и идентификаторов: /api/projects/8f3a… → /api/projects/:id.
export function normalizePath(p) {
  const path = String(p || "/").split(/[?#]/)[0].slice(0, 200) || "/";
  return path
    .split("/")
    .map((s) => (/^[0-9]+$/.test(s) || /^[0-9a-f-]{8,}$/i.test(s) || /^[A-Za-z0-9_-]{20,}$/.test(s) ? ":id" : s))
    .join("/");
}
export function parseMap(text) {
  return String(text || "")
    .split(",")
    .map((s) => s.trim().split("="))
    .filter(([k, v]) => k && v)
    .map(([k, v]) => ({ prefix: k.trim(), app: v.trim() }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
}
// Одна строка журнала → { app, key: "хост путь", status } или null.
export function classify(line, map) {
  let e;
  try {
    e = JSON.parse(line);
  } catch {
    return null;
  }
  const r = e.request;
  if (!r || !r.host) return null;
  const host = String(r.host).split(":")[0],
    path = normalizePath(r.uri),
    rule = map.find((m) => (host + path).startsWith(m.prefix));
  if (!rule) return null;
  return { app: rule.app, path, host, status: Math.floor((e.status || 0) / 100) + "xx", ts: Math.round((e.ts || Date.now() / 1000) * 1000) };
}
// Счётчики по минутам: (приложение, минута, хост, путь, статус) → число запросов.
export function aggregate(lines, map) {
  const out = new Map();
  for (const line of lines) {
    const c = classify(line, map);
    if (!c) continue;
    const minute = Math.floor(c.ts / 60000) * 60000,
      key = [c.app, minute, c.host, c.path, c.status].join("\t");
    out.set(key, (out.get(key) || 0) + 1);
  }
  const byApp = {};
  for (const [key, v] of out) {
    const [app, minute, host, path, status] = key.split("\t");
    (byApp[app] ||= []).push({ n: "http", ts: +minute, p: path, v, k: { host, status } });
  }
  return byApp;
}

async function main() {
  const env = process.env,
    file = env.AGENT_LOG || "/var/log/caddy/access.log",
    url = env.AGENT_URL || "https://stats.sohimazdai.ru/a/s",
    map = parseMap(env.AGENT_MAP || "sohimazdai.ru/cine=retrocine,api.sohimazdai.ru=retrocine,sohimazdai.ru=planner");
  let pos = 0,
    inode = 0,
    rest = "";
  // Начинаем с конца файла: старые строки уже не «текущий» RPM.
  try {
    const st = fs.statSync(file);
    pos = st.size;
    inode = st.ino;
  } catch {}
  const send = async (app, events) => {
    for (let i = 0; i < events.length; i += 2000) {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.AGENT_TOKEN }, body: JSON.stringify({ app, events: events.slice(i, i + 2000) }) });
      if (!res.ok) throw new Error("HTTP " + res.status);
    }
  };
  let pending = [];
  setInterval(async () => {
    try {
      const st = fs.statSync(file);
      // Журнал повернули (logrotate / Caddy roll): читаем новый с начала.
      if (st.ino !== inode || st.size < pos) {
        inode = st.ino;
        pos = 0;
        rest = "";
      }
      if (st.size > pos) {
        const fd = fs.openSync(file, "r"),
          buf = Buffer.alloc(Math.min(st.size - pos, 64 << 20));
        fs.readSync(fd, buf, 0, buf.length, pos);
        fs.closeSync(fd);
        pos += buf.length;
        const text = rest + buf.toString("utf8"),
          lines = text.split("\n");
        rest = lines.pop();
        pending.push(...lines);
      }
    } catch (e) {
      console.error("agent read:", e.message);
    }
  }, 5000).unref?.();
  setInterval(async () => {
    const lines = pending;
    pending = [];
    try {
      for (const [app, events] of Object.entries(aggregate(lines, map))) await send(app, events);
    } catch (e) {
      console.error("agent send:", e.message);
      // Не отправилось — попробуем со следующей пачкой (но не копим больше ~1 млн строк).
      if (pending.length < 1e6) pending.unshift(...lines);
    }
  }, 60000);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
