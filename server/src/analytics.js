// Отправка событий retrocine в сервис аналитики (analytics/): пачкой раз в 15 с, без блокировок.
// Без ANALYTICS_URL и ANALYTICS_TOKEN ничего не отправляет (тесты, локальный запуск).
export function analyticsClient({ url = "", token = "", app = "retrocine", every = 15000, log = () => {} } = {}) {
  const on = !!(url && token);
  let events = [],
    gauges = [];
  const sums = new Map();
  async function flush() {
    if (!on) return;
    for (const [key, s] of sums) if (s.v > 0) events.push({ n: s.n, v: Math.round(s.v * 10) / 10, k: s.k, ts: Date.now() });
    sums.clear();
    if (!events.length && !gauges.length) return;
    const body = JSON.stringify({ app, events, gauges });
    events = [];
    gauges = [];
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body, signal: AbortSignal.timeout(5000) });
      if (!res.ok) log("analytics: HTTP " + res.status);
    } catch (e) {
      log("analytics: " + e.message);
    }
  }
  const timer = on ? setInterval(flush, every) : null;
  timer?.unref?.();
  return {
    enabled: on,
    // Событие: что случилось (n), сколько (v), чьё (uid — уже обезличенный), небольшие свойства (k).
    event(n, v = 1, { uid, k } = {}) {
      if (on && events.length < 20000) events.push({ n, v, ...(uid ? { uid } : {}), ...(k ? { k } : {}), ts: Date.now() });
    },
    // Накопить и отправить одной суммой (пройденные метры): n — имя, k — свойства.
    sum(n, v, k) {
      if (!on || !(v > 0)) return;
      const key = n + JSON.stringify(k || {}),
        s = sums.get(key) || { n, k, v: 0 };
      s.v += v;
      sums.set(key, s);
    },
    gauge(n, v) {
      if (on) gauges.push({ n, v, ts: Date.now() });
    },
    flush,
    close() {
      clearInterval(timer);
      return flush();
    },
  };
}
