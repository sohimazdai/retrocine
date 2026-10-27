// One room: who is in it, the shared state, the authoritative simulation of cubes and the ball.
import { randomBytes, createHash } from "node:crypto";
import {
  createState,
  serializeState,
  applyOp,
  stepWorld,
  dynamicObjects,
  packObject,
  STATE_OPS,
  stepPushes,
  stateMap,
} from "../../dist/state.js";
import { spawnPoint, zonesOf } from "../../dist/world.js";
import { projectile, PROJECTILES } from "../../dist/projectiles.js";
import { LIMITS, clamp } from "../../dist/physics.js";
import { livekitToken } from "./livekit.js";

export const MAX_PEERS = 16;
const PHYS_DT = 1 / 120;
const OBJECT_BROADCAST = 1 / 30;
const ACTS = new Set(["throw", "kick", "shoot", "emote", "jump"]);
export const now = () => performance.timeOrigin + performance.now();
export const newId = () => randomBytes(6).toString("hex");
// Stable per browser and room, without revealing the browser's secret uid to anyone.
export const derivedId = (kind, room, uid, length) =>
  createHash("sha256").update(`${kind}:${room}:${uid}`).digest("hex").slice(0, length);
const r3 = (v) => Math.round(v * 1000) / 1000;

export function sanitizeProfile(p) {
  const out = {};
  if (!p || typeof p !== "object") p = {};
  let n = 0;
  for (const [k, v] of Object.entries(p)) {
    if (n >= 40 || k === "id" || !/^[a-zA-Z][a-zA-Z0-9]{0,31}$/.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 64);
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (v === null) out[k] = null;
    else continue;
    n++;
  }
  out.name = (typeof p.name === "string" && p.name.trim().slice(0, 32)) || "Гость";
  return out;
}
export function sanitizePose(p) {
  if (!p || typeof p !== "object") return null;
  const f = (v, lo, hi) => (Number.isFinite(v) ? clamp(v, lo, hi) : null);
  const x = f(p.x, -LIMITS.x, LIMITS.x),
    z = f(p.z, -14, LIMITS.z),
    y = f(p.y, 0, 12);
  if (x === null || z === null || y === null) return null;
  const pose = {
    x: r3(x),
    y: r3(y),
    z: r3(z),
    a: r3(f(p.a, -1e3, 1e3) ?? 0),
    vy: r3(f(p.vy, -80, 80) ?? 0),
    g: p.g ? 1 : 0,
  };
  // Shift: sh = held, m = input direction (to push props), ps = pushing/lifting pose, c = throw charge.
  if (p.sh) pose.sh = 1;
  if (Array.isArray(p.m) && p.m.length === 2 && p.m.every(Number.isFinite))
    pose.m = p.m.map((v) => Math.round(clamp(v, -1, 1) * 100) / 100);
  if (p.ps === 1 || p.ps === 2) pose.ps = p.ps;
  if (Number.isFinite(p.c) && p.c > 0) pose.c = Math.round(clamp(p.c, 0, 1) * 10) / 10;
  return pose;
}
function spawnPose(state) {
  const p = spawnPoint(stateMap(state), Math.random, state.structures);
  return { x: r3(p.x), y: 0, z: r3(p.z), a: Math.PI, vy: 0, g: 1 };
}
// Maps with running water (river) keep simulating while anyone is in the room.
const flowing = (state) => zonesOf(stateMap(state)).some((z) => z.flow);

export class Room {
  constructor(id, saved, { livekit = null, store = null, log = () => {} } = {}) {
    this.id = id;
    this.livekit = livekit;
    this.store = store;
    this.log = log;
    this.peers = new Map();
    this.state = createState(saved || {}, newId);
    this.dirty = false;
    this.saveTimer = null;
    this.physTimer = null;
    this.timerTimeout = null;
    this.sent = new Map();
    this.pendingProps = new Map();
  }
  get size() {
    return this.peers.size;
  }
  send(peer, msg, droppable = false) {
    sendRaw(peer, JSON.stringify(msg), droppable);
  }
  broadcast(msg, except = null, droppable = false) {
    const data = JSON.stringify(msg);
    for (const p of this.peers.values()) if (p !== except) sendRaw(p, data, droppable);
  }
  join(ws, hello, ip) {
    const uid = typeof hello.uid === "string" && /^[\w-]{6,64}$/.test(hello.uid) ? hello.uid : newId();
    // The same browser always gets the same id in a room, so identity (and the media session)
    // survives reconnects and server restarts. A second tab of that browser takes over.
    const id = derivedId("peer", this.id, uid, 12);
    const live = this.peers.get(id);
    if (live) {
      this.peers.delete(id);
      live.replaced = true;
      try {
        live.ws.send(JSON.stringify({ t: "error", code: "replaced", message: "Комната открыта в другой вкладке или на другом устройстве с этим браузером" }));
        live.ws.close(4001, "replaced");
      } catch {}
    }
    if (this.peers.size >= MAX_PEERS) return { error: "full" };
    const peer = {
      id,
      uid,
      voter: derivedId("vote", this.id, uid, 16),
      ws,
      ip,
      profile: sanitizeProfile(hello.profile),
      pose: sanitizePose(hello.pose) || spawnPose(this.state),
      tokens: 240,
      poseTokens: 60,
      thrown: new Map(),
      lastThrow: {},
      last: now(),
      dropped: 0,
    };
    this.peers.set(id, peer);
    if (flowing(this.state)) this.startPhysics();
    const others = [...this.peers.values()].filter((p) => p !== peer);
    const rtc = this.livekit
      ? {
          url: this.livekit.url,
          token: livekitToken({
            ...this.livekit,
            room: `kino-${this.id}`,
            identity: id,
            name: peer.profile.name,
          }),
        }
      : null;
    this.send(peer, {
      t: "welcome",
      id,
      voter: peer.voter,
      room: this.id,
      s: now(),
      you: { pose: peer.pose },
      peers: others.map((p) => ({ id: p.id, profile: p.profile, pose: p.pose })),
      state: serializeState(this.state),
      objs: dynamicObjects(this.state).map(packObject),
      rtc,
      maxPeers: MAX_PEERS,
    });
    this.broadcast({ t: "join", id, profile: peer.profile, pose: peer.pose }, peer);
    this.log(`room ${this.id}: ${peer.profile.name} (${id}) joined, ${this.peers.size} inside`);
    return { peer };
  }
  leave(peer) {
    if (this.peers.get(peer.id) !== peer) return;
    this.peers.delete(peer.id);
    for (const o of dynamicObjects(this.state))
      if (o.dragBy === peer.id) {
        o.dragBy = null;
        this.startPhysics();
      }
    this.broadcast({ t: "leave", id: peer.id });
    this.log(`room ${this.id}: ${peer.id} left, ${this.peers.size} inside`);
  }
  // Token buckets: generous for normal play, cut off floods.
  allow(peer, isPose) {
    const t = now(),
      dt = (t - peer.last) / 1000;
    peer.last = t;
    peer.tokens = Math.min(240, peer.tokens + dt * 120);
    peer.poseTokens = Math.min(60, peer.poseTokens + dt * 60);
    if (isPose) {
      if (peer.poseTokens < 1) return false;
      peer.poseTokens--;
      return true;
    }
    if (peer.tokens < 1) return false;
    peer.tokens--;
    return true;
  }
  handle(peer, msg) {
    const isPose = msg.t === "pose";
    if (!this.allow(peer, isPose)) {
      if (++peer.dropped > 2000) peer.ws.close(4008, "rate limit");
      return;
    }
    switch (msg.t) {
      case "ping":
        this.send(peer, { t: "pong", c: msg.c, s: now() });
        return;
      case "pose": {
        const pose = sanitizePose(msg);
        if (!pose) return;
        peer.pose = pose;
        this.broadcast({ t: "pose", id: peer.id, s: now(), ...pose }, peer, true);
        if (pose.sh) this.startPhysics();
        return;
      }
      case "profile": {
        peer.profile = sanitizeProfile(msg.profile);
        this.broadcast({ t: "profile", id: peer.id, profile: peer.profile }, peer);
        return;
      }
      case "act": {
        if (!ACTS.has(msg.k)) return;
        const out = { t: "act", id: peer.id, s: now(), k: msg.k };
        if (msg.k === "throw") {
          if (!Array.isArray(msg.to) || msg.to.length !== 3 || !msg.to.every(Number.isFinite)) return;
          const kind = projectile(msg.w);
          // Cooldowns per projectile (bricks 1 s, fireballs 5 s, grenades 10 s), with a little slack.
          const t = now();
          if (t - (peer.lastThrow[kind.id] || 0) < kind.cooldown * 1000 - 150) return;
          peer.lastThrow[kind.id] = t;
          out.to = msg.to.map((v) => r3(clamp(v, -40, 40)));
          out.w = kind.id;
          out.pw = Number.isFinite(msg.pw) ? Math.round(clamp(msg.pw, 1, 1.6) * 100) / 100 : 1;
          if (typeof msg.pid === "string") {
            out.pid = msg.pid.slice(0, 24);
            if (kind.explosion) {
              peer.thrown.set(out.pid, { kind: kind.id, at: t });
              for (const [pid, v] of peer.thrown) if (t - v.at > 15000) peer.thrown.delete(pid);
            }
          }
        }
        if ((msg.k === "kick" || msg.k === "shoot") && typeof msg.target === "string") out.target = msg.target.slice(0, 32);
        if (msg.k === "emote") {
          if (typeof msg.e !== "string") return;
          out.e = msg.e.slice(0, 16);
        }
        this.broadcast(out, peer);
        return;
      }
    }
    if (!STATE_OPS.has(msg.t)) return;
    // An explosion must come from a grenade or fireball this participant actually threw.
    if (msg.t === "boom") {
      const thrown = peer.thrown.get(msg.pid);
      if (!thrown || thrown.kind !== msg.kind) return;
      peer.thrown.delete(msg.pid);
    }
    const result = applyOp(this.state, msg, {
      uid: peer.voter,
      peer: peer.id,
      name: peer.profile.name,
      now: now(),
      newId,
    });
    if (!result) return;
    for (const { msg: out, others } of result.out) this.broadcast(out, others ? peer : null);
    if (result.physics) this.startPhysics();
    if (msg.t.startsWith("timer")) this.scheduleTimer();
    this.markDirty();
  }
  startPhysics() {
    if (this.physTimer) return;
    this.lastStep = performance.now();
    this.acc = 0;
    this.sinceBroadcast = OBJECT_BROADCAST;
    this.physTimer = setInterval(() => this.tick(), 1000 / 60);
    this.physTimer.unref?.();
  }
  stopPhysics() {
    clearInterval(this.physTimer);
    this.physTimer = null;
  }
  tick() {
    const t = performance.now(),
      elapsed = Math.min((t - this.lastStep) / 1000, 0.1);
    this.lastStep = t;
    this.acc += elapsed;
    this.sinceBroadcast += elapsed;
    const nowMs = now(),
      objects = dynamicObjects(this.state);
    for (const o of objects) if (o.dragBy && nowMs - o.dragAt > 1000) o.dragBy = null;
    const dragged = (o) => !!o.dragBy;
    const pushers = [...this.peers.values()]
      .filter((p) => p.pose.sh)
      .map((p) => ({ id: p.id, x: p.pose.x, y: p.pose.y, z: p.pose.z, mx: p.pose.m?.[0] || 0, mz: p.pose.m?.[1] || 0 }));
    if (pushers.length || Object.keys(this.state.lifts || {}).length)
      for (const m of stepPushes(this.state, pushers, elapsed)) this.pendingProps.set(m.id, m);
    let steps = 0;
    while (this.acc >= PHYS_DT && steps < 12) {
      for (const event of stepWorld(this.state, PHYS_DT, dragged)) {
        this.broadcast(event);
        this.markDirty();
      }
      this.acc -= PHYS_DT;
      steps++;
    }
    let awake = pushers.length > 0 || Object.keys(this.state.lifts || {}).length > 0 || (this.peers.size > 0 && flowing(this.state));
    for (const o of objects) {
      if (dragged(o)) {
        awake = true;
        continue;
      }
      if (Math.hypot(o.vx, o.vz) < 0.015 && o.vy === 0) {
        o.vx = 0;
        o.vz = 0;
        o.spin = 0;
      } else awake = true;
    }
    if (this.sinceBroadcast >= OBJECT_BROADCAST || !awake) {
      this.sinceBroadcast = 0;
      this.broadcastObjects(!awake);
    }
    if (!awake) {
      this.stopPhysics();
      this.markDirty();
    }
  }
  broadcastObjects(final) {
    for (const m of this.pendingProps.values()) this.broadcast({ t: "struct", ...m }, null, !final);
    if (this.pendingProps.size) this.markDirty();
    this.pendingProps.clear();
    const changed = [];
    for (const o of dynamicObjects(this.state)) {
      const packed = packObject(o),
        key = packed.join();
      if (this.sent.get(o.id) === key) continue;
      this.sent.set(o.id, key);
      changed.push(packed);
    }
    if (changed.length) this.broadcast({ t: "objs", s: now(), o: changed }, null, !final);
  }
  scheduleTimer() {
    clearTimeout(this.timerTimeout);
    const timer = this.state.timer;
    if (!timer.running) return;
    this.timerTimeout = setTimeout(
      () => {
        this.state.timer = { running: false, endAt: null, remaining: 0, visible: true };
        this.broadcast({ t: "timer", timer: this.state.timer });
        this.markDirty();
      },
      Math.max(0, timer.endAt - now()) + 50,
    );
    this.timerTimeout.unref?.();
  }
  markDirty() {
    this.dirty = true;
    if (this.saveTimer || !this.store) return;
    this.saveTimer = setTimeout(() => this.flush(), 2000);
    this.saveTimer.unref?.();
  }
  async flush() {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.dirty || !this.store) return;
    this.dirty = false;
    try {
      await this.store.save(this.id, { ...serializeState(this.state), savedAt: Date.now() });
    } catch (e) {
      this.dirty = true;
      this.log(`room ${this.id}: save failed: ${e.message}`);
    }
  }
  dispose() {
    this.stopPhysics();
    clearTimeout(this.timerTimeout);
  }
}

function sendRaw(peer, data, droppable) {
  const ws = peer.ws;
  if (ws.readyState !== 1) return;
  if (ws.bufferedAmount > 8 * 1024 * 1024) {
    ws.terminate();
    return;
  }
  if (droppable && ws.bufferedAmount > 256 * 1024) return;
  ws.send(data);
}
