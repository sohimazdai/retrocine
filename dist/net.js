// Connection to the sync server: reconnects, keeps a server clock, and buffers remote poses.
export const POSE_INTERVAL = 1000 / 30;
export const HEARTBEAT = 1000;

export class Net {
  constructor({
    url,
    room,
    uid,
    profile,
    onMessage = () => {},
    onStatus = () => {},
    WebSocketImpl = globalThis.WebSocket,
    clock = () => performance.now(),
    timers = globalThis,
  }) {
    Object.assign(this, { url, room, uid, profile, onMessage, onStatus, WebSocketImpl, clock });
    // Called detached: browsers reject window timers invoked with another object as `this`.
    const bind = (name) => (...args) => {
      const fn = timers[name];
      return fn(...args);
    };
    this.timer = {
      setTimeout: bind("setTimeout"),
      clearTimeout: bind("clearTimeout"),
      setInterval: bind("setInterval"),
      clearInterval: bind("clearInterval"),
    };
    this.status = WebSocketImpl ? "connecting" : "offline";
    this.id = null;
    this.ws = null;
    this.offset = null;
    this.samples = [];
    this.rtt = null;
    this.retry = 300;
    this.stopped = false;
  }
  get connected() {
    return this.status === "online";
  }
  start() {
    if (!this.WebSocketImpl || this.stopped) return;
    this.setStatus(this.id ? "reconnecting" : "connecting");
    let ws;
    try {
      ws = new this.WebSocketImpl(this.url.replace(/\/$/, "") + "/ws");
    } catch {
      this.setStatus("offline");
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          t: "hello",
          v: 1,
          room: this.room,
          uid: this.uid,
          prev: this.id,
          profile: this.profile(),
          pose: this.pose?.(),
        }),
      );
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      const at = this.clock();
      if (msg.t === "welcome") {
        this.id = msg.id;
        this.retry = 300;
        this.samples = [];
        this.offset = msg.s - at;
        this.setStatus("online");
        this.startPings();
      } else if (msg.t === "pong") {
        this.clockSample(msg, at);
        return;
      } else if (msg.t === "error") {
        this.fatal = msg;
      }
      this.onMessage(msg, at);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.timer.clearInterval(this.pingTimer);
      this.timer.clearTimeout(this.burstTimer);
      if (this.stopped) return;
      if (e.code === 4002 || e.code === 4001) {
        this.setStatus("error", this.fatal?.message);
        return;
      }
      const wait = e.code === 4004 ? 8000 : this.retry * (0.8 + Math.random() * 0.4);
      this.retry = Math.min(5000, this.retry * 1.7);
      this.setStatus(e.code === 4004 ? "full" : "reconnecting", this.fatal?.message);
      this.fatal = null;
      this.reconnectTimer = this.timer.setTimeout(() => this.start(), wait);
    };
    ws.onerror = () => {};
  }
  setStatus(status, detail) {
    this.status = status;
    this.onStatus(status, detail);
  }
  send(msg) {
    if (!this.connected || this.ws?.readyState !== 1) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }
  startPings() {
    this.timer.clearInterval(this.pingTimer);
    let burst = 0;
    const ping = () => this.send({ t: "ping", c: this.clock() });
    const quick = () => {
      ping();
      if (++burst < 6) this.burstTimer = this.timer.setTimeout(quick, 150);
    };
    quick();
    this.pingTimer = this.timer.setInterval(ping, 2000);
  }
  // NTP-style: the sample with the smallest round trip gives the most accurate offset.
  clockSample(msg, at) {
    const rtt = at - msg.c;
    if (!(rtt >= 0)) return;
    this.samples.push({ rtt, offset: msg.s - (msg.c + at) / 2 });
    if (this.samples.length > 12) this.samples.shift();
    const best = this.samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    this.offset =
      this.offset === null || Math.abs(best.offset - this.offset) > 25
        ? best.offset
        : this.offset + (best.offset - this.offset) * 0.2;
    this.rtt = this.samples.slice(-5).reduce((a, b) => a + b.rtt, 0) / Math.min(5, this.samples.length);
  }
  serverNow() {
    return this.clock() + (this.offset ?? 0);
  }
  stop() {
    this.stopped = true;
    this.timer.clearTimeout(this.reconnectTimer);
    this.timer.clearInterval(this.pingTimer);
    this.ws?.close();
  }
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

// Snapshot interpolation for one remote avatar. Poses carry the server time they arrived at.
// Rendering happens slightly in the past (delay()) so there are always two samples to blend;
// the delay adapts to the measured network jitter.
export class PoseBuffer {
  constructor() {
    this.items = [];
    this.jitter = 4;
    this.last = null;
  }
  push(pose, s, arrival) {
    const items = this.items;
    if (items.length && s <= items[items.length - 1].s) return;
    items.push({ ...pose, s });
    if (items.length > 48) items.shift();
    if (this.last) {
      const d = arrival - this.last.arrival - (s - this.last.s);
      this.jitter += (Math.min(200, Math.abs(d)) - this.jitter) / 12;
    }
    this.last = { arrival, s };
  }
  delay() {
    return Math.max(45, Math.min(220, POSE_INTERVAL * 1.5 + this.jitter * 2.5));
  }
  latest() {
    return this.items[this.items.length - 1] || null;
  }
  sample(t) {
    const it = this.items;
    if (!it.length) return null;
    if (t <= it[0].s) return { ...it[0] };
    for (let i = it.length - 1; i > 0; i--) {
      const a = it[i - 1],
        b = it[i];
      if (t >= a.s && t <= b.s) {
        const k = b.s > a.s ? (t - a.s) / (b.s - a.s) : 1;
        while (it.length > 2 && it[1].s < t - 1000) it.shift();
        return {
          x: lerp(a.x, b.x, k),
          y: lerp(a.y, b.y, k),
          z: lerp(a.z, b.z, k),
          a: lerpAngle(a.a, b.a, k),
          vy: lerp(a.vy, b.vy, k),
          g: k < 0.5 ? a.g : b.g,
        };
      }
    }
    // Ran out of samples: extrapolate briefly along the last motion, then hold.
    const b = it[it.length - 1],
      a = it[it.length - 2];
    const ahead = Math.min(t - b.s, 120);
    if (!a || ahead <= 0 || b.s - a.s > 250) return { ...b };
    const k = ahead / (b.s - a.s);
    return {
      x: b.x + (b.x - a.x) * k,
      y: Math.max(0, b.y + (b.y - a.y) * k),
      z: b.z + (b.z - a.z) * k,
      a: b.a,
      vy: b.vy,
      g: b.g,
    };
  }
}
