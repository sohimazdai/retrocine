import * as T from "three";
import {
  avatar,
  box,
  ball,
  material,
  normalizeProfile,
  disposeAvatar,
} from "./avatars.js";
import {
  jump,
  stepBody,
  kickCube,
  stepCube,
  collideCubes,
  clamp,
  inside,
  LIMITS,
  SPRINT,
  GRAVITY,
} from "./physics.js";
import { animateRig, startAction } from "./animation.js";
import { EmotionEffects, EMOTIONS } from "./emotions.js";
import { ROOM, floorBack, fitNoteText, setWallShape, setRoomScale } from "./layout.js";
import {
  createFloor,
  reshapeFloor,
  fitRoomCamera,
  fitWall,
  ELEVATION,
  framePortrait,
} from "./room.js";
import { MapScene } from "./mapscene.js";
import { HitboxView } from "./hitboxes.js";
import { stepRide, mountRide, rideInfo, surfaceUnder, gradient } from "./riding.js";
import { buildRide, poseRide, disposeRide } from "./rides.js";
import { stepKart, enterKart, lapStep, KART } from "./karting.js";
import { buildKart, poseKart, disposeKart } from "./karts.js";
import { startTumble, stepTumble, centerHeight, qrot, qslerp, CENTER, PHASES } from "./tumble.js";
import { findClimb, startClimb, stepClimb, zipStart, startZip, HANG, findBar, startBar, isTurnik } from "./climbing.js";
import "./maps/render.js";
import { CinemaScreen } from "./cinema.js";
import { AvatarEditor, editorMarkup } from "./avatar-editor.js";
import { mapDef, mapProps, clampProp, BALLS, spawnPoint, waterAt, iceAt, hoopsOf, DRAG_BOUNDS } from "./world.js";
import {
  PROJECTILES,
  projectile,
  launchVelocity,
  arcVelocity,
  CHARGE_MAX,
  CHARGE_TIME,
  PROJECTILE_GRAVITY,
} from "./projectiles.js";
import { Effects, projectileMesh, mineModel } from "./effects.js";
import {
  createState,
  serializeState,
  applyOp,
  unpackObject,
  findObject,
  timerLeft,
  stepPushes,
  stepWorld,
  stateObstacles,
  dynamicObjects,
  freeSpot,
  THROW_SPEED,
  runMatchStep,
  matchActive,
  runMines,
} from "./state.js";
import { loadMatch, matchEnabled, projectileDamage, blastDamage, MAX_HP, TEAM_COLOR, DMG } from "./match.js";
import { Net, PoseBuffer, POSE_INTERVAL, HEARTBEAT } from "./net.js";
import { Media } from "./media.js";
import { apiUrl, currentRoom, roomLink } from "./config.js";
import { MAPS, DEFAULT_MAP } from "./maps/index.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const icons = {
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 4 4-4M8 20l4-4 4 4M3 11l5-1-1-5M21 13l-5 1 1 5M3 13l5 1-1 5M21 11l-5-1 1-5"/>',
  hand: '<path d="M8 13V5a2 2 0 0 1 4 0v6-7a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-5-2-7-5l-3-5a2 2 0 0 1 3-2l2 3"/>',
  note: '<path d="M4 3h16v13l-5 5H4zM15 21v-5h5M8 8h8M8 12h6"/>',
  cube: '<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/>',
  person:
    '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3M6 19h12"/>',
  board:
    '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 2v3M12 8v6l3 2"/>',
  smile:
    '<circle cx="12" cy="12" r="9"/><path d="M8 14s1 3 4 3 4-3 4-3M8 9h.01M16 9h.01"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  video:
    '<rect x="2" y="5" width="14" height="14" rx="3"/><path d="m16 10 6-4v12l-6-4"/>',
  screen:
    '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 22h8M12 17v5M8 10l4-4 4 4M12 6v7"/>',
  orbit:
    '<ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-30 12 12)"/><ellipse cx="12" cy="12" rx="5" ry="10" transform="rotate(-30 12 12)"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01"/>',
  invite:
    '<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 12-4.9M19 14v6M16 17h6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
$$("[data-icon]").forEach(
  (e) =>
    (e.innerHTML = `<svg viewBox="0 0 24 24">${icons[e.dataset.icon]}</svg>`),
);
function read(k, f) {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? f;
  } catch {
    return f;
  }
}
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  Date.now().toString(36) + Math.random().toString(36).slice(2);
const palette = { good: "#b7cfa8", improve: "#dfacb9", idea: "#ead49b" },
  categories = {
    good: "Что было хорошо",
    improve: "Что можно улучшить",
    idea: "Новые идеи",
  };
// Identity of this browser (stable across visits) and the room from ?r= in the address.
let clientUid = read("kino-client-v1", null);
if (typeof clientUid !== "string" || clientUid.length < 8) {
  clientUid = uid().replace(/[^\w-]/g, "");
  try {
    localStorage.setItem("kino-client-v1", JSON.stringify(clientUid));
  } catch {}
}
// Votes are keyed by an opaque per-room id the server derives from clientUid.
let myVoter = clientUid;
const roomId = currentRoom(location, history);
const API_URL = apiUrl(location),
  OFFLINE = API_URL === "off",
  inviteLink = () => roomLink(roomId, location);
const roomKey = "kino-room-v3:" + roomId;
let me = read("kino-avatar-v1", {
  name: "",
  color: "#ae92d6",
  skin: "#e4b59b",
  hat: "headphones",
});
// The room's shared state. The server is the authority; without a connection the same
// operations run locally (state.js) and are cached in this browser.
const world = createState(read(roomKey, null) || {}, uid);
let notes = world.notes,
  cubes = world.cubes;
function syncAliases() {
  notes = world.notes;
  cubes = world.cubes;
}
let net = null,
  mediaClient = null;
const r3 = (v) => Math.round(v * 1000) / 1000;
let storageFailed = false;
function save() {
  try {
    localStorage.setItem(
      "kino-avatar-v1",
      JSON.stringify(players[0]?.profile || me),
    );
    if (!net?.connected)
      localStorage.setItem(roomKey, JSON.stringify(serializeState(world)));
  } catch {
    if (!storageFailed) {
      storageFailed = true;
      toast("Сохранение недоступно в этом браузере");
    }
  }
}
const canvas = $("#world"),
  scene = new T.Scene();
scene.background = new T.Color("#1c1b27");
let renderer;
try {
  renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
} catch (e) {
  $("#loading").innerHTML =
    '<span class="loading-mark">k</span><span>Нужен браузер с WebGL 2. Включите аппаратное ускорение.</span>';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const camera = new T.PerspectiveCamera(43, innerWidth / innerHeight, 0.1, 400),
  raycaster = new T.Raycaster(),
  pointerNDC = new T.Vector2(),
  groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0),
  pointerWorld = new T.Vector3(0, 0, 7);
// Lines are detail, not targets: by default three.js counts a line as hit from a metre away.
raycaster.params.Line.threshold = 0.02;
let camElevation = ELEVATION.initial;
let cinema = null,
  avatarEditor = null;
// The near corners of the floor stay in the bottom corners of the viewport at every angle; the wall
// is refitted so it spans the far edge of the floor and reaches the top of the viewport.
function updateCamera() {
  fitRoomCamera(camera, camElevation);
  const wall = fitWall(camera);
  setWallShape(wall.height, wall.edges);
  cinema?.reshape();
  cinema?.updateCamera(camera);
}
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  updateCamera();
}
window.addEventListener("resize", resize);
resize();
const hemi = new T.HemisphereLight("#eee1ff", "#484054", 2.1);
scene.add(hemi);
const keyLight = new T.DirectionalLight("#fff2df", 3.6);
keyLight.position.set(-10, 20, 9);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
Object.assign(keyLight.shadow.camera, {
  left: -20,
  right: 20,
  top: 20,
  bottom: -20,
  near: 0.1,
  far: 70,
});
keyLight.shadow.normalBias = 0.035;
keyLight.shadow.bias = -0.00015;
keyLight.shadow.radius = 3;
scene.add(keyLight);
const rim = new T.DirectionalLight("#baa4f5", 1.4);
rim.position.set(8, 10, -12);
scene.add(rim);
setRoomScale(mapDef(world.map).scale || 1);
const floor = createFloor(scene);
// A bigger map makes a bigger room: floor, wall and camera grow together (the picture keeps its
// proportions), and so do the shadows' reach.
function fitShadows() {
  const s = ROOM.scale;
  keyLight.position.set(-10 * s, 20 * s, 9 * s);
  Object.assign(keyLight.shadow.camera, { left: -20 * s, right: 20 * s, top: 20 * s, bottom: -20 * s, far: 70 * s });
  keyLight.shadow.camera.updateProjectionMatrix();
}
function fitRoomSize() {
  setRoomScale(mapDef(world.map).scale || 1);
  if (!reshapeFloor(floor)) return;
  fitShadows();
  updateCamera();
}
fitShadows();
updateCamera();
// The selected map: scenery, props and balls. Rebuilt when the room switches maps.
const mapScene = new MapScene(scene, { floor, grid: floor.userData.grid, hemi, key: keyLight, rim });
mapScene.build(mapDef(world.map), world.structures, world.balls);
// Settings → Хитбоксы: wireframes of colliders, bodies, balls and projectiles (only for this viewer).
const hitboxes = new HitboxView(scene);
hitboxes.setEnabled(read("kino-hitboxes-v1", false) === true, mapScene);
function setHitboxes(on) {
  hitboxes.setEnabled(on, mapScene);
  try {
    localStorage.setItem("kino-hitboxes-v1", JSON.stringify(!!on));
  } catch {}
}
function showExplosion(point, radius) {
  effects.explosion(point, radius);
  hitboxes.blast(point, radius);
}
// ——— Skateboards, scooters, bikes ———
const rideMeshes = new Map();
const myRider = () => (net?.connected ? net.id : "self");
function buildRides() {
  for (const g of rideMeshes.values()) {
    scene.remove(g);
    disposeRide(g);
    pickables = pickables.filter((o) => o !== g);
  }
  rideMeshes.clear();
  for (const r of world.rides || []) {
    const g = buildRide(r);
    scene.add(g);
    rideMeshes.set(r.id, g);
    pickables.push(g);
  }
}
const riderOf = (r) => (!r.by ? null : r.by === myRider() ? active : remotes.get(r.by) || null);
// Slope under a rider along their heading (remote riders are tilted from their position).
function slopePitch(p) {
  const g = surfaceUnder(mapScene.colliders(), p.x, p.z, p.y + 0.05);
  if (Math.abs(g.h - p.y) > 0.1) return 0;
  const d = gradient(g.support, p.x, p.z);
  return Math.atan(d.x * Math.sin(p.angle) + d.z * Math.cos(p.angle));
}
// Sleds under whoever rides down a snow slope (yours from the physics, others' from their pose).
const sleds = new Map();
const sledding = (p) => (p.remote ? !!p.flags?.sd : !!(p.grounded && p.support?.slide && !p.ride && !p.climb));
const skating = (p) => !p.ride && !p.climb && p.y < 0.2 && !!iceAt(mapScene.map, p.x, p.z);
function buildSled() {
  const g = new T.Group();
  const wood = material("#c0392b", 0.5),
    metal = material("#d9dde3", 0.25);
  for (let i = 0; i < 4; i++) {
    const slat = new T.Mesh(new T.BoxGeometry(0.62, 0.04, 0.16), wood);
    slat.position.set(0, 0.2, -0.36 + i * 0.22);
    g.add(slat);
  }
  for (const x of [-0.27, 0.27]) {
    const runner = new T.Mesh(new T.BoxGeometry(0.04, 0.05, 1.05), metal);
    runner.position.set(x, 0.03, 0);
    g.add(runner);
    const tip = new T.Mesh(new T.TorusGeometry(0.1, 0.02, 6, 12, Math.PI), metal);
    tip.rotation.y = Math.PI / 2;
    tip.position.set(x, 0.13, 0.52);
    g.add(tip);
    for (const z of [-0.3, 0.3]) {
      const leg = new T.Mesh(new T.BoxGeometry(0.04, 0.16, 0.04), metal);
      leg.position.set(x, 0.11, z);
      g.add(leg);
    }
  }
  return g;
}
function updateSleds() {
  const on = new Set();
  for (const p of players) {
    if (!sledding(p)) continue;
    on.add(p);
    let g = sleds.get(p);
    if (!g) {
      g = buildSled();
      g.rotation.order = "YXZ";
      scene.add(g);
      sleds.set(p, g);
    }
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = p.angle;
    g.rotation.x = -slopePitch(p);
  }
  for (const [p, g] of sleds)
    if (!on.has(p)) {
      scene.remove(g);
      sleds.delete(p);
    }
}
// Zip line handles above whoever hangs from one.
const trolleys = new Map();
function updateTrolleys() {
  const hanging = new Set();
  for (const p of players) {
    const zip = p.climb?.c.kind === "zip" || (p.remote && p.flags?.zp);
    if (!zip) continue;
    hanging.add(p);
    let g = trolleys.get(p);
    if (!g) {
      g = new T.Group();
      const metal = material("#c9ccd2", 0.3);
      const wheel = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.05, 14), metal);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.y = 0.06;
      const bar = new T.Mesh(new T.BoxGeometry(0.04, 0.1, 0.04), metal);
      bar.position.y = -0.04;
      const grip = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.4, 8), material("#e4573f", 0.6));
      grip.rotation.z = Math.PI / 2;
      grip.position.y = -0.1;
      g.add(wheel, bar, grip);
      scene.add(g);
      trolleys.set(p, g);
    }
    g.position.set(p.x, p.y + HANG + 0.02, p.z);
    g.rotation.y = p.angle;
  }
  for (const [p, g] of trolleys)
    if (!hanging.has(p)) {
      scene.remove(g);
      trolleys.delete(p);
    }
}
// ——— Karts ———
const kartMeshes = new Map();
const inKart = (p) => (p.remote ? !!p.flags?.kt : !!p.kart);
const TUMBLE_KINDS = ["back", "front", "left", "right", "sit"];
function updateKarts(dt) {
  const on = new Set();
  for (const p of players) {
    if (!inKart(p)) continue;
    on.add(p);
    let g = kartMeshes.get(p);
    if (!g) {
      g = buildKart(p.profile.color || "#e4573f", players.indexOf(p) + 1);
      scene.add(g);
      kartMeshes.set(p, g);
    }
    const own = !p.remote,
      speed = own ? p.kart.vx * Math.sin(p.angle) + p.kart.vz * Math.cos(p.angle) : Math.hypot(p.velocityX || 0, p.velocityZ || 0);
    g.userData.roll = (g.userData.roll || 0) + (speed * dt) / 0.14;
    poseKart(g, p.x, p.y, p.z, p.angle, own ? p.kart.pitch || 0 : 0, own ? p.kart.steer : p.flags?.ks || 0, g.userData.roll);
  }
  for (const [p, g] of kartMeshes)
    if (!on.has(p)) {
      scene.remove(g);
      disposeKart(g);
      kartMeshes.delete(p);
    }
}
const nearDispenser = () => (mapScene.map?.dispensers || []).find((d) => Math.hypot(d.x - active.x, d.z - active.z) < 2.6);
const nearSelector = () => (mapScene.map?.selectors || []).find((d) => Math.hypot(d.x - active.x, d.z - active.z) < 2.2);
// The track selector: pick one of the kart tracks; the room switches to it for everyone.
function openTrackChooser() {
  let box = $("#trackChooser");
  if (!box) {
    const style = document.createElement("style");
    style.textContent = `#trackChooser{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:55;display:none;gap:10px;padding:12px;background:rgba(18,20,26,.92);border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.45);font:14px system-ui,sans-serif;color:#eef0f4}
#trackChooser.on{display:flex}
#trackChooser button{all:unset;cursor:pointer;width:168px;padding:10px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:6px}
#trackChooser button:hover,#trackChooser button:focus-visible{background:rgba(255,255,255,.12)}
#trackChooser button.current{border-color:#f2c14e}
#trackChooser canvas{width:148px;height:92px;align-self:center}
#trackChooser b{font-size:15px}#trackChooser small{opacity:.7;line-height:1.3}`;
    document.head.appendChild(style);
    box = document.createElement("div");
    box.id = "trackChooser";
    document.body.appendChild(box);
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-track]");
      if (!b) return;
      box.classList.remove("on");
      if (b.dataset.track !== world.map) op({ t: "map.set", id: b.dataset.track });
    });
  }
  const tracks = MAPS.filter((m) => m.kartTrack);
  box.innerHTML = tracks
    .map((m, k) => `<button data-track="${m.id}" class="${m.id === world.map ? "current" : ""}"><canvas width="296" height="184" data-outline="${m.id}"></canvas><b>${k + 1}. ${m.title}</b><small>${m.description}</small></button>`)
    .join("");
  for (const cv of box.querySelectorAll("canvas[data-outline]")) {
    const m = mapDef(cv.dataset.outline),
      ctx = cv.getContext?.("2d"),
      pts = m.roadPoints || m.track?.points || [];
    if (!ctx || !pts.length) continue;
    ctx.fillStyle = "#1c2a1c";
    ctx.fillRect(0, 0, 296, 184);
    ctx.strokeStyle = m.id === world.map ? "#f2c14e" : "#e9edf3";
    ctx.lineWidth = 9;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, 148 + p[0] * 9.2, 98 + p[1] * 8.4));
    ctx.closePath();
    ctx.stroke();
  }
  box.classList.add("on");
  box.querySelector("button")?.focus?.();
}
const closeTrackChooser = () => $("#trackChooser")?.classList.remove("on");
// A kart appears in front of the dispenser and you are in it; if another kart stands there, a bit further on.
function takeKart(d) {
  let spot = { ...d.spawn };
  for (let i = 1; i < 6 && players.some((p) => p !== active && inKart(p) && Math.hypot(p.x - spot.x, p.z - spot.z) < 1.9); i++)
    spot = { ...d.spawn, x: d.spawn.x - Math.sin(d.spawn.a) * 2.1 * i, z: d.spawn.z - Math.cos(d.spawn.a) * 2.1 * i };
  if (active.ride) leaveRide();
  enterKart(active, spot, active.profile.color || "#e4573f");
  pending = null;
  sprinting = false;
  toast("Карт: W — газ, A/D — руль, S — тормоз и назад, Space — стоп. E — выйти (карт исчезнет)", 6500);
}
// Out of the kart: you step out to the side and the kart is gone.
function leaveKart() {
  const l = { x: Math.cos(active.angle), z: -Math.sin(active.angle) };
  const boxes = mapScene.colliders().filter((b) => !b.y && b.h > 0.3);
  const spot = [1, -1].map((s) => ({ x: active.x + l.x * s * 1.05, z: active.z + l.z * s * 1.05 })).find((p) => !boxes.some((b) => inside(p.x, p.z, b, 0.3))) || { x: active.x, z: active.z };
  delete active.kart;
  Object.assign(active, spot, { vy: 0, grounded: true, kx: 0, kz: 0 });
  active.x = clamp(active.x, -LIMITS.x, LIMITS.x);
  active.z = clamp(active.z, floorBack(active.x) + 0.3, LIMITS.z);
}
// Best laps per track: name → seconds.
const bestLapsByMap = new Map();
const lapsHere = () => {
  if (!bestLapsByMap.has(world.map)) bestLapsByMap.set(world.map, new Map());
  return bestLapsByMap.get(world.map);
};
const drawLaps = () => mapScene.decor?.setBoard?.([...lapsHere()].sort((a, b) => a[1] - b[1]).slice(0, 6).map(([n, s]) => [n, lapTime(s)]));
const lapTime = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}` : s.toFixed(2)) + " с";
function recordLap(name, seconds) {
  const laps = lapsHere();
  if (!(seconds < (laps.get(name) ?? Infinity))) return false;
  laps.set(name, seconds);
  drawLaps();
  return true;
}
function kartEvents(events) {
  for (const e of events) {
    if (e.t === "hit") {
      const victim = players.find((p) => p.profile.id === e.id);
      if (victim) effects.puff(new T.Vector3(victim.x, victim.y + 0.8, victim.z), "#ffffff", 8, 3, 0.04);
      net.send({ t: "act", k: "hit", target: e.id, v: e.v.map(r3) });
      // Without a server nobody else runs their own avatar: knock them over here.
      if (victim && !net.connected) startTumble(victim, e.v);
    }
    if (e.t === "wall" && e.speed > 4) effects.puff(new T.Vector3(active.x + Math.sin(active.angle) * 0.8, 0.3, active.z + Math.cos(active.angle) * 0.8), "#d9d4cc", 6, 2.6, 0.035);
    if (e.t === "land") active.land = 0.15;
  }
}
// Knocked over by a kart or a blast: you fly and tumble; riding or climbing stops.
function knockOver(v) {
  if (active.kart) return;
  if (active.ride) leaveRide();
  active.climb = null;
  pending = null;
  startTumble(active, v);
}

// ——— Team match (paintball): your browser is the authority on your own health ———
const matchId = () => (net?.connected ? net.id : "self");
const myTeam = () => world.match?.teams?.[matchId()] || null;
const teamColorHex = (team) => TEAM_COLOR[team] || null;
function teamOf(p) {
  const id = p === active ? matchId() : p.profile.id;
  return world.match?.teams?.[id] || null;
}
const inMatchMap = () => matchEnabled(mapScene.map);
// Live for you: a round is on and you are not out.
const matchLive = () => world.match?.phase === "live" && world.match.alive?.[matchId()] !== false && !active.dead;
function takeDamage(amount, byId) {
  if (!matchLive() || amount <= 0) return;
  active.hp = Math.max(0, (active.hp ?? MAX_HP) - amount);
  active.hurt = 0.4;
  op({ t: "match.dmg", by: byId || null, amount: Math.round(amount) });
  if (active.hp <= 0) dieNow(byId);
  renderHp();
}
function dieNow(byId) {
  if (active.dead) return;
  active.dead = true;
  if (active.ride) leaveRide();
  if (active.kart) leaveKart();
  active.climb = null;
  pending = null;
  effects.puff(new T.Vector3(active.x, active.y + 0.9, active.z), teamColorHex(myTeam()) || "#d8d8d8", 16, 3, 0.05);
  op({ t: "match.dead", by: byId || null });
  toast("Вы выбыли — следующий раунд вернёт в бой", 2600);
  renderMatchHud();
}
function respawnSelf(spawn) {
  if (active.kart) delete active.kart;
  Object.assign(active, { x: spawn.x, z: spawn.z, y: 0, vy: 0, grounded: true, angle: spawn.a ?? active.angle, kx: 0, kz: 0, hp: MAX_HP, dead: false, tumble: null, climb: null, ride: active.ride ? null : active.ride, slow: 0, noSprint: 0 });
  pending = null;
  renderHp();
  renderMatchHud();
}
// A blast is fully blocked by solid, tall cover between its centre and you.
function blastBlocked(ax, az, bx, bz) {
  const boxes = mapScene.colliders().filter((b) => !b.y && !b.rail && b.h0 == null && b.h >= 1.6);
  const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.18);
  for (let i = 1; i < steps; i++) {
    const x = ax + ((bx - ax) * i) / steps,
      z = az + ((bz - az) * i) / steps;
    for (const b of boxes) if (inside(x, z, b)) return true;
  }
  return false;
}
// The nearest other avatar within melee reach.
function meleeTarget() {
  return players
    .filter((p) => p !== active && Math.hypot(p.x - active.x, p.z - active.z) < 1.9 && !(p.remote ? p.flags?.tb : p.tumble))
    .sort((a, b) => Math.hypot(a.x - active.x, a.z - active.z) - Math.hypot(b.x - active.x, b.z - active.z))[0];
}
function meleeSwing(target) {
  startAction(active, "kick", worldTime, {});
  active.angle = Math.atan2(target.x - active.x, target.z - active.z);
  net.send({ t: "act", k: "melee", target: target.profile.id });
  // Offline, nobody else runs the victim's client: apply it here.
  if (!net.connected && target === active) takeDamage(DMG.melee, matchId());
}
// Offline, the browser advances the match clock itself.
function stepMatchOffline() {
  if (net.connected || !matchActive(world)) return;
  for (const m of runMatchStep(world, clockNow(), [matchId()])) onServer(m);
}
// ——— Match HUD: a banner, your health, and the TAB scoreboard ———
let scoreboardOpen = false;
function initMatchHud() {
  if ($("#matchHud")) return;
  const style = document.createElement("style");
  style.textContent = `
#matchHud{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:40;display:none;flex-direction:column;align-items:center;gap:6px;font:600 14px system-ui,sans-serif;color:#f2f0ea;pointer-events:none;text-align:center}
#matchHud.on{display:flex}
#matchBanner{background:rgba(20,22,18,.72);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:7px 16px;backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,.35)}
#matchBanner b{font-weight:800}
#matchBanner .teamc{display:inline-flex;align-items:center;gap:4px;margin:0 5px}
#matchBanner .dot{width:11px;height:11px;border-radius:50%;display:inline-block}
#hpWrap{width:210px;height:14px;background:rgba(20,22,18,.72);border:1px solid rgba(255,255,255,.14);border-radius:8px;overflow:hidden;display:none}
#hpWrap.on{display:block}
#hpFill{height:100%;width:100%;transition:width .18s ease, background .2s}
#matchHint{font-weight:600;opacity:.85;font-size:12.5px}
#scoreboard{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(8,9,12,.55);backdrop-filter:blur(3px)}
#scoreboard.on{display:flex}
#scoreboard .card{background:rgba(22,24,20,.96);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px 20px;min-width:440px;max-width:92vw;color:#f2f0ea;font:14px system-ui,sans-serif;box-shadow:0 18px 60px rgba(0,0,0,.5)}
#scoreboard h3{margin:0 0 10px;font-size:16px}
#scoreboard table{width:100%;border-collapse:collapse}
#scoreboard th,#scoreboard td{padding:5px 8px;text-align:right}
#scoreboard th:first-child,#scoreboard td:first-child{text-align:left}
#scoreboard th{font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.6;border-bottom:1px solid rgba(255,255,255,.12)}
#scoreboard tr.teamrow td{font-weight:800;padding-top:12px;border-bottom:1px solid rgba(255,255,255,.1)}
#scoreboard tr.me td{background:rgba(255,255,255,.06)}
#scoreboard tr.out td:first-child{opacity:.5;text-decoration:line-through}
#scoreboard .foot{margin-top:10px;opacity:.6;font-size:12px;text-align:center}`;
  document.head.appendChild(style);
  const hud = document.createElement("div");
  hud.id = "matchHud";
  hud.innerHTML = `<div id="matchBanner"></div><div id="hpWrap"><div id="hpFill"></div></div><div id="matchHint"></div>`;
  document.body.appendChild(hud);
  const sb = document.createElement("div");
  sb.id = "scoreboard";
  sb.innerHTML = `<div class="card"><h3>Счёт матча</h3><div id="scoreBody"></div><div class="foot">TAB — закрыть · R — готов к бою</div></div>`;
  document.body.appendChild(sb);
}
function playerName(id) {
  if (id === matchId()) return active.profile.name || "Вы";
  return remotes.get(id)?.profile.name || players.find((p) => p.profile.id === id)?.profile.name || "Игрок";
}
function teamDot(team) {
  return `<span class="dot" style="background:${TEAM_COLOR[team]}"></span>`;
}
function aliveCounts() {
  const m = world.match,
    c = { blue: 0, red: 0 };
  for (const id of Object.keys(m.teams || {})) if (m.alive?.[id]) c[m.teams[id]]++;
  return c;
}
function renderHp() {
  const wrap = $("#hpWrap"),
    fill = $("#hpFill");
  if (!wrap) return;
  const live = world.match?.phase === "live" && myTeam() && !active.dead;
  wrap.classList.toggle("on", !!live);
  if (!live) return;
  const hp = Math.max(0, active.hp ?? MAX_HP);
  fill.style.width = `${(hp / MAX_HP) * 100}%`;
  fill.style.background = active.hurt > 0 ? "#fff" : hp > 5 ? teamColorHex(myTeam()) : hp > 2 ? "#e0a53a" : "#d8432f";
}
function renderMatchHud() {
  initMatchHud();
  const hud = $("#matchHud"),
    banner = $("#matchBanner"),
    hint = $("#matchHint");
  const on = inMatchMap();
  hud.classList.toggle("on", on);
  if (!on) {
    $("#scoreboard").classList.remove("on");
    scoreboardOpen = false;
    return;
  }
  const m = world.match || {},
    ready = Object.values(m.ready || {}).filter(Boolean).length,
    here = net.connected ? players.length : 1;
  if (m.phase === "idle") {
    const iAmReady = m.ready?.[matchId()];
    banner.innerHTML = `Командный бой · готовы ${ready}/${here}`;
    hint.textContent = iAmReady ? "Вы готовы — ждём остальных" : "Нажмите R, когда готовы";
  } else if (m.phase === "countdown") {
    const s = Math.max(0, Math.ceil((m.until - clockNow()) / 1000));
    banner.innerHTML = `<b>Бой через ${s}…</b>`;
    hint.textContent = "Готовьтесь! Команды распределит сервер";
  } else if (m.phase === "live") {
    const c = aliveCounts();
    banner.innerHTML = `Раунд ${m.round} · <span class="teamc">${teamDot("blue")}${c.blue}</span> <span class="teamc">${teamDot("red")}${c.red}</span>`;
    hint.textContent = active.dead ? "Вы выбыли — ждите следующего раунда" : myTeam() ? `Ваша команда: ${myTeam() === "blue" ? "синие" : "красные"}` : "Вы наблюдаете — вступите в следующем матче";
  } else if (m.phase === "roundover") {
    banner.innerHTML = m.winner ? `<b>${m.winner === "blue" ? "Победа синих!" : "Победа красных!"}</b>` : `<b>Ничья</b>`;
    hint.textContent = "Следующий раунд вот-вот…";
  }
  renderHp();
  if (scoreboardOpen) renderScoreboard();
}
function renderScoreboard() {
  initMatchHud();
  const m = world.match || {},
    rows = (team) =>
      Object.keys(m.teams || {})
        .filter((id) => m.teams[id] === team)
        .map((id) => ({ id, k: m.stats?.[id]?.[0] ?? (m.stats?.[id]?.k || 0), d: m.stats?.[id]?.[1] ?? (m.stats?.[id]?.d || 0), p: m.stats?.[id]?.[2] ?? (m.stats?.[id]?.p || 0), alive: m.alive?.[id] }))
        .sort((a, b) => b.k - a.k || b.p - a.p || a.d - b.d);
  const body = ["blue", "red"]
    .map((team) => {
      const rs = rows(team),
        tot = rs.reduce((o, r) => ({ k: o.k + r.k, d: o.d + r.d, p: o.p + r.p }), { k: 0, d: 0, p: 0 });
      return (
        `<tr class="teamrow"><td>${teamDot(team)} ${team === "blue" ? "Синие" : "Красные"}</td><td>${tot.k}</td><td>${tot.p}</td><td>${tot.d}</td></tr>` +
        rs.map((r) => `<tr class="${r.id === matchId() ? "me" : ""} ${r.alive ? "" : "out"}"><td>${playerName(r.id)}</td><td>${r.k}</td><td>${r.p}</td><td>${r.d}</td></tr>`).join("")
      );
    })
    .join("");
  $("#scoreBody").innerHTML = `<table><thead><tr><th>Игрок</th><th>Килы</th><th>Очки</th><th>Смерти</th></tr></thead><tbody>${body}</tbody></table>`;
}
function toggleScoreboard(show) {
  initMatchHud();
  scoreboardOpen = show ?? !scoreboardOpen;
  if (scoreboardOpen && !inMatchMap()) scoreboardOpen = false;
  if (scoreboardOpen) renderScoreboard();
  $("#scoreboard").classList.toggle("on", scoreboardOpen);
}
// A coloured ring on the ground marks each player's team during a match.
function ensureTeamRing(p) {
  const team = teamOf(p);
  if (!team) {
    if (p.teamRing) p.teamRing.visible = false;
    return;
  }
  if (!p.teamRing) {
    const ring = new T.Mesh(new T.RingGeometry(0.42, 0.56, 28), new T.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    p.root.add(ring);
    p.teamRing = ring;
  }
  const dead = world.match?.alive?.[p === active ? matchId() : p.profile.id] === false;
  p.teamRing.visible = true;
  p.teamRing.material.color.set(dead ? "#8a8a8a" : TEAM_COLOR[team]);
  p.teamRing.material.opacity = dead ? 0.3 : 0.85;
}

// ——— Icicle: shatters where it lands, freezing everyone close by for a few seconds ———
const shownFrosts = new Set();
const FROST = projectile("icicle").frost;
function showFrost(x, z) {
  const at = new T.Vector3(x, 0.15, z);
  effects.puff(at, "#d8f3ff", 22, 3.2, 0.05);
  effects.puff(at.clone().setY(0.5), "#9fdcff", 10, 2, 0.035);
  // A patch of frost on the ground that melts away.
  const ring = new T.Mesh(new T.CircleGeometry(FROST.radius, 40), new T.MeshBasicMaterial({ color: "#cdeeff", transparent: true, opacity: 0.55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.02, z);
  const shards = new T.Group();
  const ice = new T.MeshStandardMaterial({ color: "#d9f4ff", roughness: 0.1, transparent: true, opacity: 0.85, emissive: "#6fc8ff", emissiveIntensity: 0.3 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4,
      r = 0.3 + Math.random() * (FROST.radius - 0.6);
    const s = new T.Mesh(new T.ConeGeometry(0.06 + Math.random() * 0.05, 0.25 + Math.random() * 0.35, 5), ice);
    s.position.set(x + Math.cos(a) * r, 0.12, z + Math.sin(a) * r);
    s.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
    shards.add(s);
  }
  const g = new T.Group();
  g.add(ring, shards);
  effects.add(
    g,
    FROST.seconds,
    (it) => {
      const k = 1 - it.age / FROST.seconds;
      ring.material.opacity = 0.55 * k;
      ice.opacity = 0.85 * k;
      shards.scale.setScalar(0.4 + 0.6 * Math.min(1, it.age * 6));
    },
    () => {
      ring.geometry.dispose();
      ring.material.dispose();
      shards.children.forEach((s) => s.geometry.dispose());
      ice.dispose();
    },
  );
}
// Everyone runs this for their own avatar: inside the zone you are slowed.
function applyFrost(x, z, pid) {
  if (!pid || !shownFrosts.has(pid)) showFrost(x, z);
  if (pid) shownFrosts.add(pid);
  if (Math.hypot(active.x - x, active.z - z) < FROST.radius && active.y < 2.5) {
    active.slow = FROST.seconds;
    sprinting = false;
    toast("Заморожены: скорость вдвое ниже, Shift не работает", 1800);
  }
}
function frostProjectile(pr, point) {
  pr.mesh.visible = false;
  if (pr.owner !== "self") return; // the thrower reports where it shattered
  applyFrost(point.x, point.z, pr.pid);
  net.send({ t: "act", k: "frost", pid: pr.pid, x: r3(point.x), z: r3(point.z) });
}
// Frozen avatars get a crust of ice around their feet.
function ensureFrost(p) {
  const frozen = p === active ? active.slow > 0 : !!p.flags?.fr;
  if (!frozen) {
    if (p.frostFx) p.frostFx.visible = false;
    return;
  }
  if (!p.frostFx) {
    const g = new T.Group(),
      ice = new T.MeshStandardMaterial({ color: "#d9f4ff", roughness: 0.1, transparent: true, opacity: 0.8, emissive: "#6fc8ff", emissiveIntensity: 0.35 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2,
        s = new T.Mesh(new T.ConeGeometry(0.06, 0.28 + (i % 3) * 0.08, 5), ice);
      s.position.set(Math.cos(a) * 0.32, 0.12, Math.sin(a) * 0.32);
      s.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      g.add(s);
    }
    p.root.add(g);
    p.frostFx = g;
  }
  p.frostFx.visible = true;
}

// ——— Mines: everyone sees them; stepped on, one blinks and lights up its surroundings, then blows ———
const MINE = projectile("mine").mine;
const mineMeshes = new Map();
const steppedMines = new Set();
function renderMines() {
  const list = world.mines || [];
  for (const [id, g] of mineMeshes)
    if (!list.some((m) => m.id === id)) {
      scene.remove(g);
      g.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
      mineMeshes.delete(id);
      steppedMines.delete(id);
    }
  for (const m of list) {
    let g = mineMeshes.get(m.id);
    if (!g) {
      g = mineModel();
      g.position.set(m.x, 0, m.z);
      g.userData.mine = m.id;
      scene.add(g);
      mineMeshes.set(m.id, g);
    }
    g.userData.data = m;
    if (m.triggerAt != null && !g.userData.light) {
      // Bright flashing light that spills onto the floor and everything nearby.
      const light = new T.PointLight("#ff3a1a", 0, 7, 1.6);
      light.position.set(0, 0.5, 0);
      g.add(light);
      g.userData.light = light;
    }
  }
}
function tickMines() {
  const now = clockNow();
  for (const g of mineMeshes.values()) {
    const m = g.userData.data,
      lamp = g.userData.lamp;
    if (!m) continue;
    if (m.triggerAt == null) {
      // Armed: a slow, dim blink; before arming it is dark.
      lamp.material.emissiveIntensity = now < m.armAt ? 0.1 : 0.25 + (Math.sin(now / 260) > 0.6 ? 1.2 : 0);
      continue;
    }
    // Triggered: blinking faster and faster until it goes off.
    const left = Math.max(0, m.triggerAt - now) / MINE.fuse,
      rate = 6 + (1 - left) * 26,
      on = Math.sin((now / 1000) * rate * Math.PI) > 0;
    lamp.material.emissiveIntensity = on ? 6 : 0.4;
    lamp.scale.setScalar(on ? 0.06 : 0.035);
    g.userData.body.material.emissive?.set(on ? "#ff2a14" : "#000000");
    g.userData.body.material.emissiveIntensity = on ? 0.6 : 0;
    if (g.userData.light) g.userData.light.intensity = on ? 14 : 1.5;
  }
}
// Offline the browser sets mines off itself; anyone (you included) stepping on an armed one starts it.
function stepMines() {
  if (!net.connected) for (const m of runMines(world, clockNow())) onServer(m);
  if (!world.mines?.length || active.dead) return;
  const now = clockNow();
  for (const m of world.mines)
    if (m.triggerAt == null && now >= m.armAt && !steppedMines.has(m.id) && active.y < 0.35 && Math.hypot(active.x - m.x, active.z - m.z) < MINE.trigger) {
      steppedMines.add(m.id);
      op({ t: "mine.step", id: m.id });
      toast("Щёлк… мина!", 1500);
    }
}
function placeMine(kind) {
  const now = performance.now();
  if (now < (cooldownUntil[kind.id] || 0)) {
    toast(`${kind.emoji} ${kind.label} будет готова через ${Math.ceil((cooldownUntil[kind.id] - now) / 1000)} с`, 1300);
    return;
  }
  if ((world.mines || []).some((m) => m.by === matchId())) {
    toast("Ваша мина уже стоит — новую можно поставить, когда она сработает", 2200);
    return;
  }
  cooldownUntil[kind.id] = now + kind.cooldown * 1000;
  startAction(active, "kick", worldTime, {});
  op({ t: "mine.place", x: r3(active.x), z: r3(active.z) });
  toast("Мина поставлена — взведётся через секунду. Отойдите!", 2000);
  renderCooldowns();
}
function updateRides(dt) {
  updateTrolleys();
  updateSleds();
  updateKarts(dt);
  for (const r of world.rides || []) {
    const g = rideMeshes.get(r.id);
    if (!g) continue;
    const p = riderOf(r);
    if (p) {
      const own = p === active && p.ride;
      if (!own) p.pitch = p.grounded ? slopePitch(p) : (p.pitch || 0) * Math.exp(-dt * 4);
      poseRide(g, {
        x: p.x,
        y: p.y,
        z: p.z,
        angle: p.angle,
        pitch: own ? p.ride.pitch : p.pitch,
        lean: own ? p.ride.lean : 0,
        speed: own ? p.ride.speed : Math.hypot(p.velocityX || 0, p.velocityZ || 0),
        flip: own ? p.ride.flip : (p.flags?.fl ?? -1),
        dt,
      });
    } else {
      const h = surfaceUnder(mapScene.colliders(), r.x, r.z, 0.3).h;
      poseRide(g, { x: r.x, y: h, z: r.z, angle: r.a, dt: 0 });
    }
  }
}
function nearestFreeRide(d = 1.7) {
  return (world.rides || [])
    .filter((r) => !r.by && Math.hypot(r.x - active.x, r.z - active.z) < d)
    .sort((a, b) => Math.hypot(a.x - active.x, a.z - active.z) - Math.hypot(b.x - active.x, b.z - active.z))[0];
}
function takeRide(r) {
  if (!r || r.by || active.ride) return;
  op({ t: "ride.take", id: r.id });
}
// Off the ride: it stays where you are. A bail throws you off it.
function leaveRide(bail = false) {
  const st = active.ride;
  if (!st) return;
  delete active.ride;
  const a = active.angle,
    speed = st.speed || 0;
  op({ t: "ride.leave", id: st.id, x: r3(active.x), z: r3(active.z), a: Math.round(a * 100) / 100 });
  active.root.rotation.x = 0;
  active.y = Math.max(active.y, 0);
  if (bail) {
    // Thrown off: you fly on the way you were going, tumble, land and get up again.
    startTumble(active, [Math.sin(a) * speed * 0.7, Math.max(active.vy || 0, 0) + 3 + Math.abs(speed) * 0.15, Math.cos(a) * speed * 0.7]);
    toast("Падение! Подойдите к доске и нажмите E, чтобы встать обратно", 2200);
  } else {
    active.x += Math.cos(a) * 0.5;
    active.z -= Math.sin(a) * 0.5;
  }
}
function onRide(r) {
  const mine = (world.rides || []).find((x) => x.id === r.id);
  if (!mine) return;
  Object.assign(mine, r);
  if (r.by === myRider() && !active.ride) {
    pending = null;
    Object.assign(active, { x: r.x, z: r.z });
    mountRide(active, r);
    active.y = surfaceUnder(mapScene.colliders(), r.x, r.z, active.y + 0.3).h;
    const R = rideInfo(r.kind);
    toast(`${R.label}: W — разгон, A/D — поворот, S — тормоз. Space — ${R.jump.toLowerCase()}, Shift — ${R.flip.toLowerCase()} (с земли — сразу с прыжком), в воздухе A/D — вращение; на перила — запрыгнуть вдоль. E — слезть`, 7000);
  } else if (active.ride?.id === r.id && r.by !== myRider()) delete active.ride;
}
function rideEvents(events) {
  for (const e of events) {
    if (e.t === "bail") leaveRide(true);
    if (e.t === "grind") effects.puff(new T.Vector3(active.x, active.y, active.z), "#ffd27a", 8, 3, 0.02);
    if (e.t === "land" && e.score >= 40) {
      toast(`${e.name} · +${e.score}`, 1800);
      if (e.score >= 200) net.send({ t: "act", k: "trick", n: e.name });
    }
  }
}
const cubeMeshes = new Map(),
  noteMeshes = new Map();
let pickables = [floor, ...mapScene.pickables];
function clearFloorSpot(x, z, pad = 1.4) {
  const boxes = mapScene.colliders().filter((b) => !b.y && b.h > 0.1);
  for (let radius = 0; radius < 24; radius += 0.5) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const p = {
        x: x + Math.sin(angle) * radius,
        z: z + Math.cos(angle) * radius,
      };
      if (validPos(p) && !boxes.some((b) => inside(p.x, p.z, b, pad))) return p;
    }
  }
  return { x, z };
}
function addCubeMesh(c) {
  const root = new T.Group();
  root.userData = { kind: "cube", id: c.id };
  scene.add(root);
  const m = box(root, c.size, c.size, c.size, c.color, 0, 0, 0, 0.07);
  box(
    root,
    c.size * 0.72,
    0.015,
    c.size * 0.72,
    new T.MeshStandardMaterial({ color: c.color, roughness: 0.75 }),
    0,
    c.size / 2 + 0.003,
    0,
    0.02,
  );
  root.position.set(c.x, c.y, c.z);
  cubeMeshes.set(c.id, root);
  pickables.push(root);
}
cubes.forEach(addCubeMesh);
function makePlayer(profile, pose) {
  return {
    ...avatar(profile),
    profile: normalizeProfile(profile),
    x: pose.x,
    z: pose.z,
    y: pose.y || 0,
    vy: 0,
    grounded: true,
    angle: pose.a ?? 0,
    walk: 0,
    hit: 0,
    land: 0,
  };
}
// Name tags float above heads; they turn green while that person speaks.
function drawLabel(p) {
  const cv = p.label.material.map.image,
    c = cv.getContext("2d"),
    base = p.profile.name || "Вы",
    name = base + (p === players[0] && base !== "Вы" ? " · вы" : "");
  c.clearRect?.(0, 0, cv.width, cv.height);
  c.font = "600 50px system-ui, sans-serif";
  const w = Math.min(cv.width - 8, (c.measureText(name).width || 200) + 64);
  c.fillStyle = p.speaking ? "#3d8f5fe6" : "#1c1b27c4";
  if (c.roundRect) {
    c.beginPath();
    c.roundRect((cv.width - w) / 2, 22, w, 84, 42);
    c.fill();
  } else c.fillRect((cv.width - w) / 2, 22, w, 84);
  c.fillStyle = "#ffffff";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText((p.speaking ? "● " : "") + name, cv.width / 2, 66);
  p.label.material.map.needsUpdate = true;
}
function nameLabel(p) {
  const cv = document.createElement("canvas");
  cv.width = 640;
  cv.height = 128;
  const texture = new T.CanvasTexture(cv);
  texture.colorSpace = T.SRGBColorSpace;
  const sprite = new T.Sprite(
    new T.SpriteMaterial({ map: texture, depthTest: false, transparent: true }),
  );
  sprite.scale.set(4.2, 0.84, 1);
  sprite.position.set(0, 2.85, 0);
  sprite.renderOrder = 10;
  sprite.raycast = () => {};
  p.root.add(sprite);
  p.label = sprite;
  drawLabel(p);
}
// players[0] is always you; everyone else is a remote participant driven by the network.
const players = [makePlayer({ ...me, id: "self" }, world.map && world.map !== DEFAULT_MAP ? spawnPoint(mapDef(world.map), Math.random, world.structures) : { x: -2.8, z: 1.3 })];
nameLabel(players[0]);
const remotes = new Map();
players.forEach((p) => {
  scene.add(p.root);
  pickables.push(p.root);
});
let active = players[0];
const ring = new T.Mesh(
  new T.RingGeometry(0.45, 0.49, 48),
  new T.MeshBasicMaterial({
    color: "#d7baff",
    side: T.DoubleSide,
    transparent: true,
    opacity: 0.8,
  }),
);
ring.rotation.x = -Math.PI / 2;
scene.add(ring);
const voteCount = (n) => (n.votes || 0) + (n.voters?.length || 0),
  votedByMe = (n) => !!n.voters?.includes(myVoter);
function textureForNote(n) {
  const cv = document.createElement("canvas");
  cv.width = 640;
  cv.height = 800;
  const c = cv.getContext("2d");
  c.fillStyle = palette[n.type] || palette.good;
  c.fillRect(0, 0, 640, 800);
  c.fillStyle = "#ffffff32";
  c.fillRect(28, 28, 584, 4);
  const layout = fitNoteText(c, n.text);
  c.fillStyle = "#29342d";
  c.textAlign = "center";
  c.textBaseline = "middle";
  const startY = 350 - ((layout.lines.length - 1) * layout.lineHeight) / 2;
  layout.lines.forEach((line, i) =>
    c.fillText(line, 320, startY + i * layout.lineHeight),
  );
  c.fillStyle = "#29342d91";
  c.font = "26px system-ui";
  c.textAlign = "left";
  c.fillText(n.author || "Вы", 42, 748);
  c.textAlign = "right";
  c.font = "32px system-ui";
  c.fillText("♡ " + voteCount(n), 598, 748);
  const texture = new T.CanvasTexture(cv);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.userData.layout = layout;
  return texture;
}
function addNoteMesh(n) {
  const root = new T.Group();
  root.userData = { kind: "note", id: n.id };
  n.y = 0;
  root.position.set(n.x, 0.025, n.z);
  const pivot = new T.Group();
  root.add(pivot);
  pivot.rotation.x = -Math.PI / 2;
  box(pivot, 2.3, 2.86, 0.025, palette[n.type], 0, 0, 0, 0.012);
  const texture = textureForNote(n),
    front = new T.Mesh(
      new T.PlaneGeometry(2.23, 2.78),
      new T.MeshBasicMaterial({
        map: texture,
        side: T.DoubleSide,
        toneMapped: false,
      }),
    );
  front.position.z = 0.015;
  pivot.add(front);
  root.userData.pivot = pivot;
  root.userData.texture = texture;
  root.userData.front = front;
  scene.add(root);
  noteMeshes.set(n.id, root);
  pickables.push(root);
}
function removeNoteMesh(id) {
  const r = noteMeshes.get(id);
  if (!r) return;
  scene.remove(r);
  pickables = pickables.filter((p) => p !== r);
  r.userData.texture.dispose();
  r.userData.front.material.dispose();
  r.userData.front.geometry.dispose();
  noteMeshes.delete(id);
}
function refreshNotes() {
  for (const id of [...noteMeshes.keys()]) removeNoteMesh(id);
  notes.forEach(addNoteMesh);
  save();
}
function refreshNote(n) {
  const wobble = noteMeshes.get(n.id)?.userData.wobble;
  removeNoteMesh(n.id);
  addNoteMesh(n);
  if (wobble) noteMeshes.get(n.id).userData.wobble = wobble;
}
notes.forEach(addNoteMesh);
// Each screen image is a render of the actual volumetric avatar, not an illustrated sprite.
const portraits = new Map();
function portraitTexture(p) {
  const ps = new T.Scene();
  ps.background = new T.Color(p.profile.color).multiplyScalar(0.45);
  ps.add(new T.HemisphereLight("#fff0f8", "#4a3f50", 2.8));
  const l = new T.DirectionalLight("#fff0df", 3.3);
  l.position.set(-3, 5, 4);
  ps.add(l);
  const a = avatar(p.profile);
  a.root.rotation.y = -0.12;
  ps.add(a.root);
  const pc = new T.PerspectiveCamera(31, 1, 0.1, 10);
  framePortrait(pc, a);
  const rt = new T.WebGLRenderTarget(384, 384, { depthBuffer: true });
  const entry = { target: rt, scene: ps, camera: pc, avatar: a, caption: portraitCaption(p) };
  const current = renderer.getRenderTarget();
  renderer.setScissorTest(false);
  renderer.setRenderTarget(rt);
  renderPortrait(entry);
  renderer.setRenderTarget(current);
  disposePortrait(portraits.get(p.profile.id));
  portraits.set(p.profile.id, entry);
  return rt.texture;
}
// The participant's name is drawn over the bottom of their square on the wall.
const captionCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 2);
captionCamera.position.z = 1;
function portraitCaption(p) {
  const cv = document.createElement("canvas");
  cv.width = 384;
  cv.height = 64;
  const c = cv.getContext("2d");
  c.fillStyle = "#16141ea8";
  c.fillRect(0, 0, 384, 64);
  c.font = "600 30px system-ui, sans-serif";
  c.fillStyle = "#ffffff";
  c.textAlign = "center";
  c.textBaseline = "middle";
  const base = p.profile.name || "Вы";
  c.fillText(base + (p.profile.id === "self" && base !== "Вы" ? " · вы" : ""), 192, 34);
  const texture = new T.CanvasTexture(cv);
  texture.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(
    new T.PlaneGeometry(2, 64 / 192),
    new T.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false }),
  );
  mesh.position.set(0, -1 + 32 / 192, 0.5);
  const scene = new T.Scene();
  scene.add(mesh);
  return { scene, mesh, texture };
}
function renderPortrait(entry) {
  renderer.render(entry.scene, entry.camera);
  const autoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.render(entry.caption.scene, captionCamera);
  renderer.autoClear = autoClear;
}
function disposePortrait(entry) {
  if (!entry) return;
  entry.target.dispose();
  disposeAvatar(entry.avatar);
  entry.caption.texture.dispose();
  entry.caption.mesh.geometry.dispose();
  entry.caption.mesh.material.dispose();
}
players.forEach(portraitTexture);
cinema = new CinemaScreen(players, portraits);
scene.add(cinema.group);
pickables.push(cinema.group);
cinema.updateCamera(camera);
const screenGroup = cinema.group,
  featured = cinema.featured;
let screenTiles = cinema.tiles;
let pinned = null,
  camStream = null,
  micStream = null,
  displayStream = null,
  camTexture = null,
  shareTexture = null;
const cameraTextures = new Map();
// Video from the media server: cameras and screen shares of everyone, including your own.
const liveVideo = { camera: new Map(), screen: new Map() };
let localMedia = { mic: false, cam: false, screen: false };
function onVideo(id, kind, el) {
  const map = liveVideo[kind];
  if (!map) return;
  const old = map.get(id);
  if (old) {
    old.texture.dispose();
    map.delete(id);
  }
  if (el) {
    const texture = new T.VideoTexture(el);
    texture.colorSpace = T.SRGBColorSpace;
    map.set(id, { el, texture, at: performance.now() });
    el.addEventListener("loadedmetadata", () => screenUpdate());
    el.addEventListener("resize", () => screenUpdate());
  }
  if (kind === "screen") pinned = null;
  screenUpdate();
}
function currentShare() {
  if (displayStream) return shareTexture;
  const shares = [...liveVideo.screen.values()].sort((a, b) => b.at - a.at);
  return shares[0]?.texture || null;
}
function screenUpdate() {
  cameraTextures.clear();
  for (const [id, v] of liveVideo.camera) cameraTextures.set(id, v.texture);
  if (camTexture) cameraTextures.set("self", camTexture);
  cinema.setMedia({ cameras: cameraTextures, pinned, share: currentShare() });
  updateShareTools();
}
function updateShareTools() {
  $("#shareTools").hidden = !cinema.media?.share;
  $("#shareScale").textContent = Math.round(cinema.shareZoom * 100) + "%";
}
screenUpdate();
const emotionEffects = new EmotionEffects(scene);
function refreshParticipants() {
  cinema.setPlayers(players);
  screenTiles = cinema.tiles;
  if (pinned && !players.some((p) => p.profile.id === pinned)) pinned = null;
  screenUpdate();
  renderPresence();
}
function addRemote(id, profile, pose, batch = false) {
  if (remotes.has(id)) {
    updateRemoteProfile(id, profile);
    return;
  }
  if (players.length >= 16) return;
  const start = pose || { x: 0, z: 4, y: 0, a: Math.PI, g: 1 };
  const p = makePlayer({ ...profile, id }, start);
  p.remote = true;
  p.buffer = new PoseBuffer();
  p.events = [];
  p.speaking = false;
  p.buffer.push({ a: 0, vy: 0, g: 1, y: 0, ...start }, clockNow() - 1, clockNow());
  players.push(p);
  remotes.set(id, p);
  nameLabel(p);
  scene.add(p.root);
  pickables.push(p.root);
  portraitTexture(p);
  if (!batch) {
    refreshParticipants();
    toast(`${p.profile.name} в комнате`, 2200);
  }
}
function removeRemote(id, batch = false) {
  const p = remotes.get(id);
  if (!p) return;
  remotes.delete(id);
  players.splice(players.indexOf(p), 1);
  scene.remove(p.root);
  pickables = pickables.filter((o) => o !== p.root);
  p.label?.material.map.dispose();
  disposeAvatar(p);
  disposePortrait(portraits.get(id));
  portraits.delete(id);
  for (const kind of ["camera", "screen"]) {
    liveVideo[kind].get(id)?.texture.dispose();
    liveVideo[kind].delete(id);
  }
  if (selected?.id === id) closeContext();
  if (!batch) {
    refreshParticipants();
    toast(`${p.profile.name} вышел(а)`, 2200);
  }
}
function rebuildAvatar(p, profile) {
  scene.remove(p.root);
  pickables = pickables.filter((o) => o !== p.root);
  p.label?.material.map.dispose();
  disposeAvatar(p);
  Object.assign(p, avatar(profile));
  p.profile = profile;
  p.motion = null;
  nameLabel(p);
  scene.add(p.root);
  pickables.push(p.root);
  portraitTexture(p);
}
function updateRemoteProfile(id, profile) {
  const p = remotes.get(id);
  if (!p) return;
  rebuildAvatar(p, normalizeProfile({ ...profile, id }));
  refreshParticipants();
}
let tool = "snow",
  selected = null,
  drag = null,
  hovered = null,
  pending = null,
  orbitDrag = null,
  shareDrag = null,
  clock = performance.now(),
  accumulator = 0,
  worldTime = 0,
  projectiles = [],
  particles = [],
  lastThrow = -Infinity,
  saveClock = 0;
const keys = new Set();
function toast(text, time = 4000) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $("#toast").classList.remove("visible"), time);
}
function status() {
  canvas.setAttribute(
    "aria-label",
    `3D-комната. ${active.profile.name}: X ${active.x.toFixed(1)}, Z ${active.z.toFixed(1)}, высота ${active.y.toFixed(1)}. ${active.grounded ? "На опоре" : "В прыжке"}. Кубиков ${cubes.length}. Снежков ${projectiles.length}.`,
  );
}
function setTool(t) {
  tool = t;
  $$("[data-tool]").forEach((b) =>
    b.classList.toggle("active", b.dataset.tool === t),
  );
  canvas.classList.toggle("interact", t === "interact");
  if (t === "interact")
    toast(
      "Тяните объекты мышью. Клик — действия; двойной клик по стикеру — редактировать.",
    );
  if (t === "snow") closeContext();
}
function owner(o) {
  while (o && o !== scene) {
    if (o.userData.kind) return o;
    o = o.parent;
  }
  return null;
}
function visibleObject(object) {
  while (object) {
    if (object.visible === false) return false;
    object = object.parent;
  }
  return true;
}
function rayAt(e) {
  pointerNDC.set(
    (e.clientX / innerWidth) * 2 - 1,
    1 - (e.clientY / innerHeight) * 2,
  );
  raycaster.setFromCamera(pointerNDC, camera);
  const ground = raycaster.ray.intersectPlane(groundPlane, new T.Vector3());
  if (ground) pointerWorld.copy(ground);
  scene.updateMatrixWorld(true);
  return raycaster
    .intersectObjects(pickables, true)
    .find((h) => visibleObject(h.object));
}
function groundAt(e, y = 0) {
  pointerNDC.set(
    (e.clientX / innerWidth) * 2 - 1,
    1 - (e.clientY / innerHeight) * 2,
  );
  raycaster.setFromCamera(pointerNDC, camera);
  return raycaster.ray.intersectPlane(
    new T.Plane(new T.Vector3(0, 1, 0), -y),
    new T.Vector3(),
  );
}
function validPos(v) {
  return (
    v &&
    Math.abs(v.x) < ROOM.halfWidth - 1.4 &&
    v.z > floorBack(v.x) + 1.6 &&
    v.z < ROOM.front - 1.6
  );
}
function highlight() {
  if (!selected) return;
  const obj = selected;
  let label = "",
    buttons = "";
  if (obj.kind === "cube") {
    label = "Кубик";
    buttons =
      '<button data-context="kick">Пнуть · E</button><button data-context="remove">Убрать</button>';
  }
  if (obj.kind === "ball") {
    const b = findObject(world, obj.id);
    label = BALLS[b?.kind]?.label || "Мяч";
    buttons =
      `<button data-context="kick">${b?.kind === "basketball" ? "Бросить в кольцо" : "Пнуть"} · E</button><button data-context="move">Переместить</button><button data-context="resetBall">На исходную</button>`;
  }
  if (obj.kind === "structure") {
    const structure = mapScene.props.get(obj.id);
    label = structure.label;
    buttons =
      (structure.info.goal || structure.info.hoop
        ? `<button data-context="resetBall">Мяч на исходную · ${world.scores[obj.id] || 0} ${structure.info.hoop ? "очк." : "гол."}</button>`
        : "") +
      (structure.waypoints.length ? '<button data-context="climb">Забраться</button>' : "") +
      (structure.movable ? '<button data-context="move">Переместить</button>' : "");
  }
  if (obj.kind === "ride") {
    const r = (world.rides || []).find((x) => x.id === obj.id);
    label = rideInfo(r?.kind).label;
    buttons = r?.by
      ? r.by === myRider()
        ? '<button data-context="unride">Слезть · E</button>'
        : ""
      : '<button data-context="ride">Прокатиться · E</button>';
    if (r?.by && r.by !== myRider()) label += " · занят";
  }
  if (obj.kind === "note") {
    label = "Стикер";
    buttons =
      '<button data-context="edit">Редактировать</button><button data-context="vote">♡ Голос</button><button data-context="move">Переместить</button>';
  }
  if (obj.kind === "avatar") {
    const self = obj.id === "self";
    label =
      (players.find((p) => p.profile.id === obj.id)?.profile.name || "Аватар") +
      (self ? " · вы" : "");
    buttons = self
      ? '<button data-context="customize">Настроить</button><button data-context="wave">Помахать</button>'
      : '<button data-context="wave">Помахать</button>' +
        (cinema.media?.share ? "" : '<button data-context="pin">На весь экран</button>');
  }
  if (["screen", "tile", "share"].includes(obj.kind)) {
    const sharing = !!displayStream || localMedia.screen;
    label = "Экран";
    buttons =
      (obj.kind === "tile" && !cinema.media?.share
        ? '<button data-context="pin">Закрепить</button>'
        : "") +
      '<button data-context="unpin">Все участники</button>' +
      (sharing
        ? '<button data-action="share">Остановить показ</button>'
        : '<button data-action="share">Показать экран</button>');
  }
  $("#contextBar").innerHTML =
    `<strong>${esc(label)}</strong>${buttons}<button data-context="close" aria-label="Закрыть действия">×</button>`;
  $("#contextBar").hidden = !buttons;
}
function closeContext() {
  selected = null;
  $("#contextBar").hidden = true;
}
function select(o) {
  if (!o || o.userData.kind === "floor") {
    closeContext();
    return;
  }
  selected = { kind: o.userData.kind, id: o.userData.id };
  highlight();
}
// ——— Throwing: snowballs, tomatoes, tennis balls, rocks, bricks, grenades, fireballs ———
const effects = new Effects(scene);
let weapon = read("kino-weapon-v1", "snow");
if (!PROJECTILES.some((k) => k.id === weapon)) weapon = "snow";
const cooldownUntil = {},
  shownBooms = new Set();
let charge = null;
const projectileId = () => Math.random().toString(36).slice(2, 12);
function setWeapon(id) {
  const kind = projectile(id);
  weapon = kind.id;
  try {
    localStorage.setItem("kino-weapon-v1", JSON.stringify(weapon));
  } catch {}
  setTool("snow");
  renderWeapon();
  toast(`${kind.emoji} ${kind.label}${kind.cooldown >= 1 ? ` · раз в ${kind.cooldown} с` : ""}`, 1400);
}
function renderWeapon() {
  const kind = projectile(weapon),
    btn = $('[data-tool="snow"]');
  if (!btn) return;
  const icon = btn.querySelector("[data-icon], .weapon-emoji");
  if (icon) icon.outerHTML = `<span class="weapon-emoji" aria-hidden="true">${kind.emoji}</span>`;
  const tip = btn.querySelector(".tip");
  if (tip) tip.textContent = `${kind.label} · клик, ПКМ — сильнее`;
  btn.title = kind.place ? `${kind.label}: клик — поставить под ноги. 1–9 — выбрать` : `${kind.label}: клик — бросок, удерживать ПКМ — сильнее. 1–9 — выбрать снаряд`;
  if (!$("#weaponPicker").hidden) renderWeaponPicker();
}
function renderWeaponPicker() {
  const now = performance.now();
  $("#weaponPicker").innerHTML = PROJECTILES.map((k) => {
    const left = Math.max(0, ((cooldownUntil[k.id] || 0) - now) / 1000);
    return `<button data-weapon="${k.id}" class="${k.id === weapon ? "selected" : ""}" title="${k.label}"><span class="weapon-emoji">${k.emoji}</span><span class="weapon-name">${k.label}</span><kbd>${k.key}</kbd>${left > 0 ? `<i class="weapon-cd">${Math.ceil(left)}</i>` : ""}</button>`;
  }).join("");
}
function toggleWeaponPicker(force) {
  const open = force ?? $("#weaponPicker").hidden;
  $("#weaponPicker").hidden = !open;
  if (open) {
    renderWeaponPicker();
    const r = $('[data-tool="snow"]').getBoundingClientRect();
    $("#weaponPicker").style.left = Math.max(8, r.left + r.width / 2 - 120) + "px";
  }
}
// Cooldown shown on the throw button and in the picker.
function renderCooldowns() {
  const kind = projectile(weapon),
    left = Math.max(0, (cooldownUntil[kind.id] || 0) - performance.now());
  $('[data-tool="snow"]')?.style.setProperty("--cd", kind.cooldown >= 1 ? (left / (kind.cooldown * 1000)).toFixed(3) : 0);
  if (!$("#weaponPicker").hidden) renderWeaponPicker();
}
function chargeLevel() {
  return charge ? Math.min(1, (performance.now() - charge.start) / 1000 / CHARGE_TIME) : 0;
}
function throwSnow(hit, power = 1) {
  if (active.dead) return;
  const kind = projectile(weapon),
    now = performance.now();
  if (kind.place) return placeMine(kind);
  if (now < (cooldownUntil[kind.id] || 0)) {
    if (kind.cooldown >= 1) toast(`${kind.emoji} ${kind.label} будет готов${kind.id === "grenade" ? "а" : ""} через ${Math.ceil((cooldownUntil[kind.id] - now) / 1000)} с`, 1300);
    return;
  }
  let to = hit?.point.clone() || pointerWorld.clone();
  const targetOwner = hit && owner(hit.object);
  if (targetOwner?.userData.kind === "avatar") {
    const p = players.find((p) => p.profile.id === targetOwner.userData.id);
    to.set(p.x, p.y + 1.05, p.z);
  }
  const pid = projectileId();
  const vel = [r3(active.velocityX || 0), r3(active.velocityZ || 0)];
  if (startAction(active, "throw", worldTime, { to, w: kind.id, pw: power, pid, vel })) {
    cooldownUntil[kind.id] = now + kind.cooldown * 1000;
    net.send({ t: "act", k: "throw", to: [to.x, to.y, to.z].map(r3), w: kind.id, pw: Math.round(power * 100) / 100, pid, vel });
    renderCooldowns();
  }
}
function releaseSnow(player, payload) {
  const kind = projectile(payload.w);
  let to = payload.to;
  const from = new T.Vector3(player.x, player.y + 1.08, player.z);
  if (to.distanceTo(from) < 0.6)
    to = new T.Vector3(player.x + Math.sin(player.angle) * 3, 0.2, player.z + Math.cos(player.angle) * 3);
  const direction = to.clone().sub(from);
  direction.y = 0;
  direction.normalize();
  from.addScaledVector(direction, 0.5);
  const g = PROJECTILE_GRAVITY * (kind.gravity ?? 1),
    v = launchVelocity(from, to, kind.maxSpeed * (payload.pw || 1), g);
  // Throwing on the move: your speed along the throw (forward or back, not sideways) adds to the
  // shot's speed; the direction stays where you aimed.
  {
    const vx = payload.vel?.[0] ?? player.velocityX ?? 0,
      vz = payload.vel?.[1] ?? player.velocityZ ?? 0,
      h = Math.hypot(v.x, v.z);
    if (h > 1e-6) {
      const along = (vx * v.x + vz * v.z) / h,
        k = Math.max(0.3, (h + along) / h);
      v.x *= k;
      v.z *= k;
    }
  }
  const mesh = projectileMesh(kind);
  mesh.position.copy(from);
  scene.add(mesh);
  projectiles.push({
    mesh,
    v: new T.Vector3(v.x, v.y, v.z),
    age: 0,
    owner: player.profile.id,
    kind,
    g,
    pid: payload.pid,
    bounces: 0,
    spin: new T.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14),
  });
}
const IMPACT_COLORS = { snow: "#faf5ff", tomato: "#d1352a", tennis: "#d8ef4a", rock: "#8b8680", brick: "#a8543b", grenade: "#6a7458", fireball: "#ff8a2a" };
// What a projectile does where it lands: a puff or a splat, a push for loose objects (thrower only)
// and a knock for avatars (each avatar's owner applies it, so it travels with their pose).
function burst(pos, kind, snowOwner = "self", pr = null) {
  const k = pr?.kind || projectile("snow"),
    speed = pr ? pr.v.length() : 12,
    normal = pr?.normal || new T.Vector3(0, 1, 0);
  if (k.splat) {
    const parent = ["avatar", "cube", "ball", "structure"].includes(kind?.userData.kind) ? kind : null;
    effects.splat(pos, normal, k.splat, parent);
    effects.puff(pos, k.splat, 6, 2.6, 0.03);
  } else effects.puff(pos, IMPACT_COLORS[k.id], k.id === "brick" ? 14 : k.id === "tennis" ? 3 : 10, k.id === "brick" ? 3.6 : 3, k.id === "brick" ? 0.05 : 0.035);
  if (["cube", "ball"].includes(kind?.userData.kind) && snowOwner === "self") {
    const c = findObject(world, kind.userData.id);
    if (c) {
      const dir = pr ? pr.v.clone().setY(0).normalize() : new T.Vector3(c.x - active.x, 0, c.z - active.z).normalize();
      kickObject(c, { x: c.x - dir.x, z: c.z - dir.z }, clamp(k.impact * (speed / 12), 0.6, 9));
    }
  }
  if (kind?.userData.kind === "avatar") {
    const p = players.find((p) => p.profile.id === kind.userData.id);
    if (p) {
      p.hit = 0.55;
      if (p === active) {
        const knock = k.mass * speed * 0.35,
          dir = pr ? pr.v.clone().setY(0).normalize() : new T.Vector3();
        active.kx = (active.kx || 0) + dir.x * knock;
        active.kz = (active.kz || 0) + dir.z * knock;
        if (p.grounded) {
          p.vy = Math.min(7, 2.1 + knock * 0.35);
          p.grounded = false;
        }
        // In a match, a direct hit costs health (friendly fire counts; blasts are handled on boom).
        const by = snowOwner === "self" ? matchId() : snowOwner;
        if (!k.explosion && by !== matchId()) takeDamage(projectileDamage(k.id), by);
      }
    }
  }
  if (kind?.userData.kind === "note") kind.userData.wobble = 0.7;
  if (kind?.userData.kind === "screen" || kind?.userData.kind === "tile")
    screenGroup.userData.wobble = 0.35;
}
// Grenade fuse or fireball contact: the thrower reports the explosion, the server applies it to
// everything and tells everyone. The thrower sees the blast at once.
function explodeProjectile(pr, point) {
  if (pr.owner !== "self") {
    pr.mesh.visible = false;
    setTimeout(() => {
      if (!shownBooms.has(pr.pid) && !pr.boomed) {
        pr.boomed = true;
        showExplosion(point, pr.kind.explosion.radius);
      }
    }, 900);
    return;
  }
  shownBooms.add(pr.pid);
  showExplosion(point, pr.kind.explosion.radius);
  op({ t: "boom", kind: pr.kind.id, pid: pr.pid, x: r3(point.x), y: r3(point.y), z: r3(point.z) });
}
function onBoom(m) {
  const point = new T.Vector3(m.x, m.y, m.z);
  const flying = projectiles.find((pr) => pr.pid && pr.pid === m.pid);
  if (flying) {
    flying.boomed = true;
    scene.remove(flying.mesh);
    projectiles.splice(projectiles.indexOf(flying), 1);
  }
  if (shownBooms.has(m.pid)) shownBooms.delete(m.pid);
  else showExplosion(point, m.r);
  // Your own avatar is thrown by the blast; others are thrown on their screens.
  const body = new T.Vector3(active.x, active.y + 0.8, active.z),
    d = body.distanceTo(point);
  if (d < m.r) {
    const k = m.power * (1 - d / m.r),
      dir = new T.Vector3(active.x - m.x, 0, active.z - m.z);
    if (dir.lengthSq() < 1e-4) dir.set(Math.sin(active.angle), 0, Math.cos(active.angle));
    dir.normalize();
    // A close blast knocks you head over heels; a farther one just shoves you.
    if (k > 7 && !active.kart) knockOver([dir.x * k * 0.85, 3 + k * 0.6, dir.z * k * 0.85]);
    else {
      active.kx = (active.kx || 0) + dir.x * k * 0.85;
      active.kz = (active.kz || 0) + dir.z * k * 0.85;
      active.vy = Math.max(active.vy, 3 + k * 0.6);
      active.grounded = false;
    }
    active.hit = 0.9;
    pending = null;
    // Match damage falls off with distance and is fully stopped by solid cover between you and it.
    // Distance from the epicentre along the ground (plus height if you are above it): right on top is −10.
    const ground = Math.hypot(active.x - m.x, active.z - m.z, Math.max(0, active.y - m.y));
    if (matchLive() && !blastBlocked(m.x, m.z, active.x, active.z)) takeDamage(blastDamage(ground, m.r), m.by === "self" ? matchId() : m.by);
  }
  for (const p of remotes.values()) if (Math.hypot(p.x - m.x, p.z - m.z) < m.r) p.hit = 0.8;
  for (const [, mesh] of noteMeshes)
    if (Math.hypot(mesh.position.x - m.x, mesh.position.z - m.z) < m.r) mesh.userData.wobble = 0.9;
  if (Math.abs(m.z - floorBack(m.x)) < m.r) screenGroup.userData.wobble = 0.5;
  // Loose objects start flying at once; the server's state follows and corrects them.
  if (net.connected)
    for (const o of dynamicObjects(world)) {
      const dx = o.x - m.x,
        dz = o.z - m.z,
        dist = Math.hypot(dx, dz, o.y - m.y);
      if (dist > m.r) continue;
      const k = m.power * (1 - dist / m.r),
        len = Math.hypot(dx, dz) || 1;
      o.vx += (dx / len) * k;
      o.vz += (dz / len) * k;
      o.vy = Math.max(o.vy, k * 0.7);
    }
}
let climbJump = false;
let spaceHeld = false;
// Vehicles are driven relative to themselves: W gas, S brake, A/D turn; in a kart Space is the full
// brake, on a board, scooter or bike it is the jump.
function driveInput() {
  if ($("#modal").open) return {};
  return { gas: keys.has("up") ? 1 : 0, brake: keys.has("down") ? 1 : 0, stop: spaceHeld && active.kart ? 1 : 0, turn: (keys.has("left") ? 1 : 0) - (keys.has("right") ? 1 : 0) };
}
function doJump() {
  if (active.climb) {
    climbJump = true;
    return;
  }
  // On a board, scooter or bike Space is the ollie (on the ground or off a rail).
  if (active.ride) {
    if (active.grounded || active.ride.grind) active.ride.ollie = true;
    return;
  }
  if (active.kart) return;
  if (jump(active)) {
    active.land = 0;
    status();
  }
}
function hangFromBar(bar) {
  startBar(active, bar);
  pending = null;
  toast(isTurnik(bar) ? "W — подтянуться, S — спрыгнуть" : "Перебирайте руками: стрелки вдоль перекладин, Space — спрыгнуть", 2200);
}
// Within reach of your feet or hands: lets you knock a mug off the bar, too.
const reachable = (c, p, d = 1.6) => Math.hypot(c.x - p.x, c.z - p.z) < d && c.y - p.y < 1.45 && c.y - p.y > -0.9;
function kickNearest() {
  if (active.tumble) return;
  if (active.dead) return;
  if (active.kart) {
    leaveKart();
    return;
  }
  if (active.ride) {
    leaveRide();
    return;
  }
  if (active.climb) return;
  // At the track selector: choose where to race.
  if (nearSelector()) {
    openTrackChooser();
    return;
  }
  // At a kart dispenser: a kart of your own, and you are in it.
  const dispenser = nearDispenser();
  if (dispenser) {
    takeKart(dispenser);
    return;
  }
  // A bar above your head: hang from it.
  const bar = findBar(mapScene.map?.climbs, active, true);
  if (bar) {
    hangFromBar(bar);
    return;
  }
  // Zip lines start from their platform.
  const zip = (mapScene.map?.climbs || []).find((c) => c.kind === "zip" && zipStart(c, active));
  if (zip) {
    startZip(active, zip);
    pending = null;
    toast("Вжух! Space — отпустить", 1800);
    return;
  }
  const ride = nearestFreeRide();
  if (ride) {
    takeRide(ride);
    return;
  }
  const near = dynamicObjects(world)
    .filter((c) => reachable(c, active))
    .sort(
      (a, b) =>
        Math.hypot(a.x - active.x, a.z - active.z) -
        Math.hypot(b.x - active.x, b.z - active.z),
    )[0];
  // A nearby player can be hit at close range (a shove, or half your health in a match); if an
  // opponent is closer than any ball, swing at them. E always does something, even into the air.
  const foe = meleeTarget(),
    foeD = foe ? Math.hypot(foe.x - active.x, foe.z - active.z) : Infinity,
    nearD = near ? Math.hypot(near.x - active.x, near.z - active.z) : Infinity;
  if (foe && foeD <= nearD) return meleeSwing(foe);
  if (near?.kind === "basketball") shoot(near);
  else if (near && startAction(active, "kick", worldTime, { cube: near })) net.send({ t: "act", k: "kick", target: near.id });
  else startAction(active, "kick", worldTime, {});
}
function modal(title, body, wide = false) {
  avatarEditor?.dispose();
  avatarEditor = null;
  $("#modal").classList.remove("avatar-dialog");
  keys.clear();
  pending = null;
  $("#modal").classList.toggle("wide", wide);
  $("#modalContent").innerHTML =
    `<div class="modal-head"><h2>${title}</h2><button class="close" data-action="close" aria-label="Закрыть">×</button></div>${body}`;
  if (!$("#modal").open) $("#modal").showModal();
}
function noteModal(id = null, pos = null, type = "good") {
  const n = notes.find((n) => n.id === id);
  modal(
    n ? "Редактировать стикер" : "Новая мысль",
    `<form id="noteForm"><label class="field-label" for="noteText">Текст</label><textarea id="noteText" maxlength="280" required placeholder="Одна мысль — один стикер">${esc(n?.text || "")}</textarea><label class="field-label" for="noteType">Категория</label><select id="noteType">${Object.entries(
      categories,
    )
      .map(
        ([v, l]) =>
          `<option value="${v}" ${(n?.type || type) === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select><div class="modal-actions">${n ? '<button type="button" class="danger" id="deleteNote">Удалить</button>' : ""}<button class="primary">${n ? "Сохранить" : "Поставить стикер"}</button></div></form>`,
  );
  $("#noteForm").onsubmit = (e) => {
    e.preventDefault();
    const text = $("#noteText").value.trim();
    if (!text) return;
    if (n) op({ t: "note.edit", id: n.id, text, type: $("#noteType").value });
    else {
      if (notes.length >= 80) {
        toast("В комнате уже 80 стикеров");
        return;
      }
      const p =
        pos ||
        new T.Vector3(
          clamp(active.x + 1.8, -DRAG_BOUNDS.x, DRAG_BOUNDS.x),
          0,
          clamp(active.z + 1, -DRAG_BOUNDS.z + 0.5, DRAG_BOUNDS.z - 0.5),
        );
      Object.assign(p, clearFloorSpot(p.x, p.z));
      op({ t: "note.add", text, type: $("#noteType").value, x: p.x, z: p.z });
    }
    $("#modal").close();
    closeContext();
  };
  if (n)
    $("#deleteNote").onclick = () => {
      op({ t: "note.del", id: n.id });
      $("#modal").close();
      closeContext();
    };
  setTimeout(() => $("#noteText").focus(), 60);
}
function boardOpen() {
  return $("#modal").open && !!$("#modalContent .board-columns");
}
function board() {
  modal(
    "Ретроспектива",
    `<div class="board-columns">${Object.entries(categories)
      .map(
        ([t, l]) =>
          `<section class="board-column" data-column="${t}"><h3><span class="dot" style="background:${palette[t]}"></span>${l}</h3>${notes
            .filter((n) => n.type === t)
            .map(
              (n) =>
                `<article class="note-card ${t}" draggable="true" data-note="${n.id}"><button class="note-text" data-edit="${n.id}">${esc(n.text)}</button><div class="note-bottom"><span>${esc(n.author)}</span><button class="vote ${votedByMe(n) ? "selected" : ""}" data-vote="${n.id}">♡ ${voteCount(n)}</button></div></article>`,
            )
            .join(
              "",
            )}<button class="column-add" data-add="${t}">+ Добавить</button></section>`,
      )
      .join(
        "",
      )}</div><div class="modal-actions"><button class="secondary" data-action="export">Экспорт JSON</button><button class="primary" data-action="close">Вернуться в зал</button></div>`,
    true,
  );
}
function avatarModal(p = active) {
  const draft = normalizeProfile(p.profile);
  modal("Персонаж", editorMarkup(draft), true);
  $("#modal").classList.add("avatar-dialog");
  avatarEditor = new AvatarEditor(
    $("#modalContent"),
    draft,
    (profile) => {
      rebuildAvatar(p, profile);
      screenUpdate();
      save();
      if (p === active) net.send({ t: "profile", profile: publicProfile() });
      renderPresence();
      $("#modal").close();
    },
    T.WebGLRenderer,
  );
}
function react(type, p = active) {
  emotionEffects.start(p, type, worldTime);
  if (p === active) net.send({ t: "act", k: "emote", e: String(type) });
}
function publicProfile() {
  const { id, ...rest } = active.profile;
  return rest;
}
let timerDoneFor = null;
function renderTimer() {
  const timer = world.timer,
    n = timerLeft(timer, clockNow());
  $("#timerIsland").hidden = !timer.visible;
  $("#timerText").textContent =
    String(Math.floor(n / 60)).padStart(2, "0") +
    ":" +
    String(n % 60).padStart(2, "0");
  $("#timerToggle").textContent = timer.running ? "Ⅱ" : "▶";
  if (timer.running && n === 0 && timerDoneFor !== timer.endAt) {
    timerDoneFor = timer.endAt;
    toast("Время вышло — обсудим идеи?");
    emotionEffects.start(active, "firework", worldTime);
  }
}
function timerSettings() {
  modal(
    "Таймер",
    `<form id="timerForm"><label class="field-label" for="minutes">Минуты</label><input id="minutes" type="number" min="1" max="60" value="${Math.max(1, Math.ceil((world.timer.remaining || 300) / 60))}" required><p class="modal-text">Таймер общий: его видят и останавливают все участники.</p><div class="modal-actions"><button class="primary">Запустить</button></div></form>`,
  );
  $("#timerForm").onsubmit = (e) => {
    e.preventDefault();
    op({ t: "timer.start", minutes: clamp(Number($("#minutes").value), 1, 60) });
    $("#modal").close();
  };
}
function help() {
  modal(
    "Управление",
    `<div class="help-grid"><div><strong>Передвигаться</strong><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> или стрелки.<br><kbd>Space</kbd> — прыжок.</div><div><strong>Транспорт</strong>Скейт, самокат, BMX, карт — <kbd>E</kbd> рядом. <kbd>W</kbd> — газ, <kbd>A</kbd>/<kbd>D</kbd> — поворот относительно себя, <kbd>S</kbd> — тормоз. На доске, самокате, BMX <kbd>Space</kbd> — прыжок, <kbd>Shift</kbd> — флип (с земли — с прыжком), в воздухе <kbd>A</kbd>/<kbd>D</kbd> — вращение. В карте <kbd>Space</kbd> — стоп; карт выдаёт автомат на картинге, рядом — автомат выбора трассы; вышли — карт исчезает.</div><div><strong>Бросать</strong>Левый клик — бросок в точку под курсором. Удерживайте правую кнопку, чтобы бросить сильнее и дальше. <kbd>1</kbd>–<kbd>9</kbd> или колесо — снежок, помидор, теннисный мяч, камень, кирпич (раз в 1 с), граната (взрыв через 3 с, раз в 10 с), фаербол (взрыв при касании, раз в 5 с), сосулька (замедляет всех в зоне на 3 с, без Shift), мина (ставится под ноги; кто наступит — через 3 с взрыв). Тяжёлое летит ближе, бросок на бегу — быстрее.</div><div><strong>Shift</strong>Бегать быстрее. С зажатым Shift упритесь в предмет, чтобы толкать: тяжёлое двигают несколько человек вместе. С двух противоположных сторон предмет можно поднять и унести.</div><div><strong>Конструкции и футбол</strong><kbd>E</kbd> — пнуть мяч или кубик; рядом с игроком — удар. На куб, пирамиду и катушки можно запрыгнуть или выбрать «Забраться». В воротах считаются голы.</div><div><strong>Любой объект</strong><kbd>V</kbd> — взаимодействие: клик для действий, перетаскивание для перемещения. Короткий клик правой кнопкой — действия в любом режиме.</div><div><strong>Командный бой (пейнтбол)</strong><kbd>R</kbd> — готов; когда готовы все, через 10 с бой. Здоровье 10: лёгкое −2, камень −5, кирпич и взрыв в упор — сразу; укрытие защищает от взрыва. <kbd>Tab</kbd> — счёт.</div><div><strong>Стикеры на полу</strong><kbd>N</kbd> и клик по полу. По стикерам можно ходить. В режиме взаимодействия двойной клик открывает редактор.</div><div><strong>Ракурс и демонстрация</strong>Средняя кнопка + движение вверх/вниз — наклон 0–80°. Комната сохраняет масштаб. Колесо над демонстрацией увеличивает её содержимое; потяните его, чтобы рассмотреть детали.</div></div><p class="modal-text">Комната общая: все участники видят друг друга, стикеры, голоса, таймер, мяч и кубики в реальном времени. Микрофон, камера и показ экрана передаются всем в комнате. Пригласить коллег, сменить карту, ракурс и внешность — кнопка настроек в правом верхнем углу.</p><div class="modal-actions"><button class="primary" data-action="close">В зал</button></div>`,
  );
}
function mediaVideo(stream) {
  const v = document.createElement("video");
  v.autoplay = true;
  v.muted = true;
  v.playsInline = true;
  v.srcObject = stream;
  v.onloadedmetadata = () => screenUpdate();
  v.play().catch(() => {});
  return v;
}
function mediaButtons() {
  const set = (sel, on) => {
    $(sel).classList.toggle("on", on);
    $(sel).classList.toggle("off", !on);
  };
  if (mediaClient.ready) {
    set("#micBtn", localMedia.mic);
    set("#camBtn", localMedia.cam);
    $("#shareBtn").classList.toggle("on", localMedia.screen);
  }
}
async function liveMedia(kind) {
  const key = { mic: "mic", camera: "cam", share: "screen" }[kind];
  const on = !localMedia[key];
  const btn = $(kind === "mic" ? "#micBtn" : kind === "camera" ? "#camBtn" : "#shareBtn");
  btn.disabled = true;
  try {
    if (kind === "mic") await mediaClient.setMic(on);
    if (kind === "camera") await mediaClient.setCam(on);
    if (kind === "share") await mediaClient.setShare(on);
    if (on)
      toast(
        kind === "mic"
          ? "Микрофон включён — вас слышат все в комнате"
          : kind === "camera"
            ? "Камера включена — её видят все в комнате"
            : "Показ экрана включён для всех",
        2600,
      );
  } catch (e) {
    if (e?.name !== "NotAllowedError" || kind !== "share")
      toast(
        e?.name === "NotAllowedError"
          ? "Доступ к устройству не разрешён"
          : "Устройство недоступно",
      );
  } finally {
    btn.disabled = false;
    mediaButtons();
  }
}
async function media(kind) {
  if (mediaClient.ready) return liveMedia(kind);
  const cameraMode = kind === "camera",
    existing = cameraMode ? camStream : micStream,
    btn = $(cameraMode ? "#camBtn" : "#micBtn");
  if (existing) {
    existing.getTracks().forEach((t) => t.stop());
    if (cameraMode) {
      camStream = null;
      camTexture?.dispose();
      camTexture = null;
    } else micStream = null;
    btn.classList.add("off");
    btn.classList.remove("on");
    screenUpdate();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Для камеры и микрофона откройте опубликованную HTTPS-версию");
    return;
  }
  btn.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      cameraMode ? { video: true } : { audio: true },
    );
    if (cameraMode) {
      camStream = stream;
      camTexture = new T.VideoTexture(mediaVideo(stream));
      camTexture.colorSpace = T.SRGBColorSpace;
    } else micStream = stream;
    btn.classList.remove("off");
    btn.classList.add("on");
    screenUpdate();
    toast(
      cameraMode
        ? "Нет связи с медиасервером: камера видна только вам."
        : "Нет связи с медиасервером: микрофон включён только локально.",
    );
  } catch (e) {
    toast(
      e.name === "NotAllowedError"
        ? "Доступ к устройству не разрешён"
        : "Устройство недоступно",
    );
  } finally {
    btn.disabled = false;
  }
}
function stopShare() {
  displayStream?.getTracks().forEach((t) => t.stop());
  displayStream = null;
  shareTexture?.dispose();
  shareTexture = null;
  $("#shareBtn").classList.remove("on");
  screenUpdate();
}
async function share() {
  if (mediaClient.ready && !displayStream) return liveMedia("share");
  if (displayStream) {
    stopShare();
    return;
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    toast("Показ экрана доступен в настольном браузере по HTTPS");
    return;
  }
  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    const v = mediaVideo(displayStream);
    shareTexture = new T.VideoTexture(v);
    shareTexture.colorSpace = T.SRGBColorSpace;
    displayStream.getVideoTracks()[0].onended = stopShare;
    $("#shareBtn").classList.add("on");
    pinned = null;
    screenUpdate();
    toast("Нет связи с медиасервером: показ виден только вам");
  } catch {}
}
function exportNotes() {
  const data = {
      room: "kinō",
      exportedAt: new Date().toISOString(),
      roomId,
      notes: notes.map(({ voters, ...n }) => ({
        ...n,
        votes: voteCount(n),
      })),
    },
    a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  a.download = "kino-retro.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const actions = {
  close: () => {
    $("#modal").close();
    canvas.focus();
  },
  avatar: () => avatarModal(),
  board,
  help,
  export: exportNotes,
  mic: () => media("mic"),
  camera: () => media("camera"),
  share,
  shareIn: () => {
    cinema.zoomShare(1.25);
    updateShareTools();
  },
  shareOut: () => {
    cinema.zoomShare(0.8);
    updateShareTools();
  },
  shareReset: () => {
    cinema.zoomShare(1 / cinema.shareZoom);
    updateShareTools();
  },
  timerSettings,
  timer: () => op({ t: "timer.toggle" }),
  timerClose: () => op({ t: "timer.hide" }),
  invite: () => copyLink(),
  newRoom: () => {
    const url = new URL(location.href);
    url.searchParams.delete("r");
    location.href = url.toString();
  },
  reaction: () =>
    modal(
      "Эмоции",
      `<div class="emotion-picker">${EMOTIONS.map(([id, emoji, label]) => `<button data-emoji="${id}" aria-label="${label}"><span>${emoji}</span><strong>${label}</strong></button>`).join("")}</div>`,
    ),
  view: () => openSettings("view"),
  settings: () => (settingsOpen() ? closeSettings() : openSettings()),
  settingsClose: () => closeSettings(),
  room: () => roomModal(),
};
function contextAction(action) {
  if (action === "close") {
    closeContext();
    return;
  }
  if (!selected) return;
  const { kind, id } = selected;
  if (action === "ride") {
    const r = (world.rides || []).find((x) => x.id === id);
    if (r && Math.hypot(r.x - active.x, r.z - active.z) < 2.2) takeRide(r);
    else if (r) pending = { type: "ride", target: r, started: worldTime };
    closeContext();
  }
  if (action === "unride") {
    leaveRide();
    closeContext();
  }
  if (action === "kick") {
    const c = findObject(world, id);
    pending = { type: "kick", target: c, started: worldTime };
    closeContext();
  }
  if (action === "climb") {
    const path = mapScene.path(id);
    if (!path.length) return;
    pending = {
      type: "climb",
      path,
      index: 0,
      target: path[0],
      started: worldTime,
    };
    closeContext();
    toast("Подхожу и забираюсь", 1800);
  }
  if (action === "resetBall") {
    const prop = mapScene.props.get(id);
    op({ t: "ball.reset", ...(prop?.info.hoop ? { id: world.balls.find((b) => b.kind === "basketball")?.id } : {}) });
    closeContext();
  }
  if (action === "move") {
    setTool("interact");
    toast("Зажмите объект и перетащите по площадке");
    closeContext();
  }
  if (action === "remove" && kind === "cube") {
    op({ t: "cube.del", id });
    closeContext();
  }
  if (action === "edit") noteModal(id);
  if (action === "vote") {
    const n = notes.find((n) => n.id === id);
    toast(votedByMe(n) ? "Голос снят" : "Голос учтён", 1800);
    op({ t: "note.vote", id });
  }
  if (action === "wave") {
    react("salute");
    closeContext();
  }
  if (action === "customize") avatarModal(active);
  if (action === "pin") {
    if (cinema.media?.share) return;
    pinned = id;
    screenUpdate();
    closeContext();
  }
  if (action === "unpin") {
    pinned = null;
    if (displayStream) stopShare();
    screenUpdate();
    closeContext();
  }
  if (action === "copy") copyLink();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.action) actions[b.dataset.action]?.();
  if (b.dataset.tool) {
    if (b.dataset.tool === "snow" && tool === "snow") toggleWeaponPicker();
    else toggleWeaponPicker(false);
    setTool(b.dataset.tool);
    canvas.focus();
  }
  if (b.dataset.map && b.dataset.map !== world.map) op({ t: "map.set", id: b.dataset.map });
  if (b.dataset.weapon) {
    setWeapon(b.dataset.weapon);
    toggleWeaponPicker(false);
  }
  if (b.dataset.context) contextAction(b.dataset.context);
  if (b.dataset.edit) noteModal(b.dataset.edit);
  if (b.dataset.vote) op({ t: "note.vote", id: b.dataset.vote });
  if (b.dataset.add) noteModal(null, null, b.dataset.add);
  if (b.dataset.emoji) {
    react(b.dataset.emoji);
    $("#modal").close();
  }
});
$("#modal").addEventListener("close", () => {
  keys.clear();
  avatarEditor?.dispose();
  avatarEditor = null;
  $("#modal").classList.remove("avatar-dialog");
});
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) {
    const r = $("#modal").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      $("#modal").close();
  }
});
document.addEventListener("dragstart", (e) => {
  const card = e.target.closest("[data-note]");
  if (card) e.dataTransfer.setData("text/plain", card.dataset.note);
});
document.addEventListener("dragover", (e) => {
  if (e.target.closest("[data-column]")) e.preventDefault();
});
document.addEventListener("drop", (e) => {
  const col = e.target.closest("[data-column]");
  if (!col) return;
  e.preventDefault();
  const n = notes.find((n) => n.id === e.dataTransfer.getData("text/plain"));
  if (n && n.type !== col.dataset.column)
    op({ t: "note.type", id: n.id, type: col.dataset.column });
});
canvas.addEventListener("pointerdown", (e) => {
  canvas.focus();
  const h = rayAt(e),
    o = h && owner(h.object);
  if (e.button === 1) {
    e.preventDefault();
    orbitDrag = {
      y: e.clientY,
      elevation: camElevation,
    };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (e.button === 2) {
    e.preventDefault();
    if (tool === "snow") {
      // Hold to wind up a stronger throw; a short tap still opens the object's actions.
      charge = { start: performance.now(), x: e.clientX, y: e.clientY, target: o };
      const ring = $("#chargeRing");
      ring.hidden = false;
      ring.style.left = e.clientX + "px";
      ring.style.top = e.clientY + "px";
      return;
    }
    select(o);
    return;
  }
  if (e.button !== 0) return;
  if (o?.userData.kind === "share" && cinema.shareZoom > 1 && h.uv) {
    shareDrag = { uv: h.uv.clone() };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (["screen", "tile", "share"].includes(o?.userData.kind)) {
    select(o);
    return;
  }
  if (tool === "snow") {
    throwSnow(h);
    return;
  }
  const pos = groundAt(e);
  if (!pos) return;
  if (tool === "note") {
    if (validPos(pos)) noteModal(null, pos);
    setTool("snow");
    return;
  }
  if (tool === "cube") {
    if (validPos(pos)) {
      if (cubes.length >= 24) {
        toast("На площадке уже 24 кубика");
        return;
      }
      op({ t: "cube.add", x: pos.x, z: pos.z });
    }
    setTool("snow");
    return;
  }
  select(o);
  if (
    o &&
    (["note", "cube", "ball"].includes(o.userData.kind) || (o.userData.kind === "structure" && mapScene.props.get(o.userData.id)?.movable))
  ) {
    drag = {
      kind: o.userData.kind,
      id: o.userData.id,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: o.position.x - pos.x,
      offsetZ: o.position.z - pos.z,
      moved: false,
      previous: pos.clone(),
      lastTime: performance.now(),
    };
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener("pointermove", (e) => {
  const h = rayAt(e),
    o = h && owner(h.object);
  hovered = o;
  if (shareDrag) {
    const shareHit = raycaster.intersectObject(featured)[0];
    if (shareHit?.uv) {
      cinema.panShare(
        shareHit.uv.x - shareDrag.uv.x,
        shareHit.uv.y - shareDrag.uv.y,
      );
      shareDrag.uv.copy(shareHit.uv);
    }
    return;
  }
  if (orbitDrag) {
    camElevation = clamp(
      orbitDrag.elevation + (e.clientY - orbitDrag.y) * 0.08,
      ELEVATION.min,
      ELEVATION.max,
    );
    updateCamera();
    return;
  }
  if (drag) {
    const pos = groundAt(e);
    if (!pos) return;
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 5)
      drag.moved = true;
    if (drag.moved) {
      canvas.classList.add("dragging");
      let x = clamp(pos.x + drag.offsetX, -DRAG_BOUNDS.x, DRAG_BOUNDS.x),
        z = clamp(pos.z + drag.offsetZ, -DRAG_BOUNDS.z, DRAG_BOUNDS.z);
      if (drag.kind === "note") {
        const n = notes.find((n) => n.id === drag.id);
        const spot = clearFloorSpot(x, z);
        x = spot.x;
        z = spot.z;
        n.x = x;
        n.z = z;
        n.y = 0;
        noteMeshes.get(n.id).position.set(x, 0.025, z);
        throttled("note", () => op({ t: "note.move", id: n.id, x, z }));
      }
      if (["cube", "ball"].includes(drag.kind)) {
        const c = findObject(world, drag.id);
        const dt = Math.max(0.01, (performance.now() - drag.lastTime) / 1000);
        c.vx = clamp((x - c.x) / dt, -10, 10);
        c.vz = clamp((z - c.z) / dt, -10, 10);
        c.x = x;
        c.z = z;
        c.y =
          Math.max(
            0,
            ...mapScene
              .colliders()
              .filter((b) => inside(x, z, b) && !b.y)
              .map((b) => b.h),
          ) + 0.9;
        c.vy = 0;
        c.ox = c.oy = c.oz = 0;
        if (net.connected)
          throttled("obj", () => net.send({ t: "obj.drag", id: c.id, x, z }));
      }
      if (drag.kind === "structure") {
        ({ x, z } = clampProp(mapScene.props.get(drag.id).info, x, z));
        moveStructure(drag.id, x, z);
        throttled("struct", () => op({ t: "struct.move", id: drag.id, x, z }));
        pending = null;
      }
      drag.lastTime = performance.now();
    }
    return;
  }
  const hint = $("#objectHint");
  if (tool === "interact" && o && o.userData.kind !== "floor") {
    const d = o.userData;
    const text =
      d.kind === "note"
        ? "Стикер · тянуть / редактировать"
        : d.kind === "cube"
          ? "Кубик · тянуть / пнуть"
          : d.kind === "ball"
              ? "Мяч · тянуть / пнуть"
              : d.kind === "structure"
                ? `${mapScene.props.get(d.id)?.label || "Предмет"} · действия`
                : d.kind === "avatar"
                  ? players.find((p) => p.profile.id === d.id)?.profile.name
                  : "Экран · закрепить";
    hint.textContent = text;
    hint.hidden = false;
    hint.style.left = Math.min(innerWidth - 200, e.clientX + 15) + "px";
    hint.style.top = Math.max(10, e.clientY - 35) + "px";
  } else hint.hidden = true;
});
function endDrag() {
  if (drag?.moved) {
    if (drag.kind === "note") {
      const n = notes.find((n) => n.id === drag.id);
      if (n) op({ t: "note.move", id: n.id, x: n.x, z: n.z });
    }
    if (["cube", "ball"].includes(drag.kind) && net.connected) {
      const c = findObject(world, drag.id);
      if (c) net.send({ t: "obj.release", id: c.id, vx: c.vx, vz: c.vz });
    }
    if (drag.kind === "structure") {
      const s = mapScene.props.get(drag.id);
      op({ t: "struct.move", id: s.id, x: s.x, z: s.z });
    }
    save();
  }
  drag = null;
  orbitDrag = null;
  shareDrag = null;
  canvas.classList.remove("dragging");
}
canvas.addEventListener("pointerup", endDrag);
function cancelCharge() {
  charge = null;
  $("#chargeRing").hidden = true;
}
window.addEventListener("pointerup", (e) => {
  if (e.button !== 2 || !charge) return;
  const held = performance.now() - charge.start,
    moved = Math.hypot(e.clientX - charge.x, e.clientY - charge.y),
    target = charge.target,
    level = chargeLevel();
  cancelCharge();
  if (held < 180 && moved < 6) {
    select(target);
    return;
  }
  throwSnow(e.target === canvas ? rayAt(e) : null, 1 + (CHARGE_MAX - 1) * level);
});
canvas.addEventListener("pointermove", (e) => {
  if (!charge) return;
  const ring = $("#chargeRing");
  ring.style.left = e.clientX + "px";
  ring.style.top = e.clientY + "px";
});
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("pointerleave", () => {
  $("#objectHint").hidden = true;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("dblclick", (e) => {
  if (tool !== "interact") return;
  const h = rayAt(e),
    o = h && owner(h.object);
  if (o?.userData.kind === "note") noteModal(o.userData.id);
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (cinema.media?.share && owner(rayAt(e)?.object)?.userData.kind === "share") {
      cinema.zoomShare(Math.exp(-e.deltaY * 0.0015));
      updateShareTools();
    } else if (Math.abs(e.deltaY) > 4)
      throttled("wheel", () => {
        const i = PROJECTILES.findIndex((k) => k.id === weapon);
        setWeapon(PROJECTILES[(i + Math.sign(e.deltaY) + PROJECTILES.length) % PROJECTILES.length].id);
      }, 160);
  },
  { passive: false },
);
const keyMap = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};
document.addEventListener("keydown", (e) => {
  if ($("#modal").open || e.target.matches?.("input,textarea,select")) return;
  if (keyMap[e.code]) {
    e.preventDefault();
    keys.add(keyMap[e.code]);
    pending = null;
  }
  if (e.key === "Shift") {
    // On a board, scooter or bike Shift is the trick: a flip in the air, from the ground an ollie
    // straight into one.
    if (active.ride) {
      if (!e.repeat) active.ride.trick = true;
    } else sprinting = !(active.slow > 0);
    shiftHeld = true;
  }
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (digit && !e.repeat) setWeapon(PROJECTILES[+digit[1] - 1].id);
  if (e.code === "Space") {
    e.preventDefault();
    spaceHeld = true;
    if (!e.repeat) doJump();
  }
  if (e.code === "KeyE" && !e.repeat) kickNearest();
  // Team match: R to ready up (while waiting), hold TAB for the score.
  if (e.code === "KeyR" && !e.repeat && inMatchMap() && world.match?.phase === "idle") {
    op({ t: world.match.ready?.[matchId()] ? "match.unready" : "match.ready" });
  }
  if (e.code === "Tab") {
    e.preventDefault();
    if (!e.repeat && inMatchMap()) toggleScoreboard(true);
  }
  if (e.code === "KeyV") setTool("interact");
  if (e.code === "KeyX") setTool("snow");
  if (e.code === "KeyN") setTool("note");
  if (e.code === "KeyC") setTool("cube");
  if (e.code === "Escape" && settingsOpen()) {
    closeSettings();
    return;
  }
  if (e.code === "Escape") {
    closeTrackChooser();
    closeContext();
    setTool("snow");
  }
});
document.addEventListener("keyup", (e) => {
  if (keyMap[e.code]) keys.delete(keyMap[e.code]);
  if (e.code === "Tab") toggleScoreboard(false);
  if (e.key === "Shift") {
    sprinting = false;
    shiftHeld = false;
  }
  if (e.code === "Space") spaceHeld = false;
});
window.addEventListener("blur", () => {
  keys.clear();
  sprinting = false;
  spaceHeld = false;
  cancelCharge();
  endDrag();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    save();
  }
});
window.addEventListener("beforeunload", save);
$$("[data-move]").forEach((b) => {
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    keys.add(b.dataset.move);
    b.setPointerCapture(e.pointerId);
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    b.addEventListener(name, () => keys.delete(b.dataset.move));
});
$("#touchJump").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  doJump();
});
function movement() {
  let x = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0),
    z = (keys.has("down") ? 1 : 0) - (keys.has("up") ? 1 : 0);
  return {
    x,
    z,
  };
}
// Seesaws tip toward whoever sits on them; the one on the rising end gets tossed up.
function updateSeesaws(dt) {
  for (const s of mapScene.props.values()) {
    const c = s.info.local.find((c) => c.seesaw);
    if (!c) continue;
    const cx = s.x + c.x,
      cz = s.z + c.z;
    let torque = 0,
      mine = 0;
    for (const p of players) {
      const lx = p.x - cx;
      if (Math.abs(lx) > c.w / 2 || Math.abs(p.z - cz) > c.d / 2 + 0.15 || p.y < 0.06) continue;
      torque += lx;
      if (p === active) mine = lx;
    }
    const before = s.tilt ?? 1,
      target = torque > 0.2 ? -1 : torque < -0.2 ? 1 : before,
      next = before + clamp(target - before, -dt * 3.4, dt * 3.4);
    if (next === before) continue;
    mapScene.setTilt(s.id, next);
    // At the end of the swing the rising end throws its rider.
    if (Math.abs(next) === 1 && mine && Math.sign(mine) === Math.sign(next) && active.grounded) {
      active.vy = 5 + (6 * Math.abs(mine)) / (c.w / 2);
      active.grounded = false;
    }
  }
}
function physics(dt) {
  worldTime += dt;
  if (active.hurt > 0) active.hurt = Math.max(0, active.hurt - dt);
  if (active.slow > 0) {
    // Frozen by an icicle: half speed, and Shift (sprint, push) does nothing until it wears off.
    active.slow = Math.max(0, active.slow - dt);
    sprinting = active.slow === 0 && shiftHeld && !active.ride;
  }
  stepMatchOffline();
  stepMines();
  updateSeesaws(dt);
  mapScene.tickTips(dt);
  const obstacles = mapScene.colliders();
  const loose = dynamicObjects(world);
  let move = $("#modal").open ? { x: 0, z: 0 } : movement();
  if (pending && !$("#modal").open) {
    const t = pending.target,
      dx = t.x - active.x,
      dz = t.z - active.z,
      dist = Math.hypot(dx, dz);
    if (worldTime - pending.started > 20) {
      pending = null;
    } else if (pending.type === "ride") {
      if (dist < 1.4) {
        takeRide(t);
        pending = null;
      } else move = { x: dx / dist, z: dz / dist };
    } else if (pending.type === "kick") {
      if (dist < 1.25) {
        if (t.kind === "basketball") shoot(t);
        else startAction(active, "kick", worldTime, { cube: t });
        pending = null;
      } else move = { x: dx / dist, z: dz / dist };
    } else if (pending.type === "climb") {
      if (active.grounded && active.y >= t.h - 0.01 && dist < 0.35) {
        pending.index++;
        if (pending.index >= pending.path.length) {
          pending = null;
          toast("Наверху! Space — прыгнуть, WASD — сойти.", 2000);
        } else pending.target = pending.path[pending.index];
      } else {
        move = dist > 0.1 ? { x: dx / dist, z: dz / dist } : { x: 0, z: 0 };
        if (active.y < t.h - 0.02 && dist < 2.35 && active.grounded) {
          jump(active);
        }
      }
    }
  }
  for (const p of players) {
    const wasGrounded = p.grounded,
      oldX = p.x,
      oldZ = p.z;
    let grab = null;
    if (!p.remote && !p.climb && !p.ride && !p.kart && !p.tumble) {
      p.climbCooldown = Math.max(0, (p.climbCooldown || 0) - dt);
      grab = findClimb(mapScene.map?.climbs, p, move);
      // Jumping up into a bar catches it.
      if (!grab && !p.grounded) {
        const bar = findBar(mapScene.map?.climbs, p);
        if (bar) {
          hangFromBar(bar);
          continue;
        }
      }
    }
    if (p.tumble && (!p.remote || !net.connected)) {
      // Knocked over: flying, lying there, getting up (offline, others too).
      const was = { x: p.x, z: p.z };
      const result = stepTumble(p, obstacles, dt);
      p.velocityX = (p.x - was.x) / dt;
      p.velocityZ = (p.z - was.z) / dt;
      if (result === "down") effects.puff(new T.Vector3(p.x, 0.15, p.z), "#cfc6b8", 10, 2.4, 0.045);
    } else if (!p.remote && p.kart) {
      // Driving: other karts to bump, people on foot to knock over, laps to time.
      const was = { x: p.x, z: p.z };
      const others = [];
      for (const o of players) {
        if (o === p) continue;
        if (inKart(o)) others.push({ kind: "kart", id: o.profile.id, x: o.x, z: o.z, vx: o.velocityX || 0, vz: o.velocityZ || 0 });
        else if (!o.tumble && !o.flags?.tb) others.push({ kind: "avatar", id: o.profile.id, x: o.x, z: o.z, y: o.y });
      }
      kartEvents(stepKart(p, driveInput(), { boxes: obstacles, track: mapScene.map?.track, others, now: worldTime }, dt));
      const lap = lapStep(p.kart.lap, mapScene.map?.track, was, p, worldTime);
      if (lap?.start) toast("Круг пошёл!", 1500);
      if (lap?.lap) {
        const best = recordLap(p.profile.name || "Вы", lap.lap);
        toast(`Круг: ${lapTime(lap.lap)}${best ? " — лучший!" : ""}`, 2500);
        net.send({ t: "act", k: "lap", ms: Math.round(lap.lap * 1000) });
      }
      p.velocityX = (p.x - was.x) / dt;
      p.velocityZ = (p.z - was.z) / dt;
      // Karts shove balls, cones and cubes out of the way.
      for (const c of loose) {
        const d = Math.hypot(c.x - p.x, c.z - p.z),
          v = Math.hypot(p.kart.vx, p.kart.vz);
        if (d < KART.reach + c.size / 2 && v > 1 && c.y < 1 && worldTime - (c.kartKick || -9) > 0.3) {
          c.kartKick = worldTime;
          kickObject(c, { x: p.x - p.kart.vx / v, z: p.z - p.kart.vz / v, angle: p.angle }, Math.min(9, 1.5 + v));
        }
      }
    } else if (!p.remote && p.climb) {
      // Ropes, trunks, walls, nets and zip lines.
      const was = { x: p.x, z: p.z };
      const result = stepClimb(p, move, obstacles, dt, climbJump);
      climbJump = false;
      p.velocityX = (p.x - was.x) / dt;
      p.velocityZ = (p.z - was.z) / dt;
      if (result === "top") p.land = 0.2;
      if (result === "pull") {
        const n = p.climb.count;
        toast(n === 1 ? "Подтянулся!" : `Подтягиваний: ${n}`, 900);
        if (n % 5 === 0) emotionEffects.start(p, "fire", worldTime);
      }
    } else if (!p.remote && p.ride) {
      const was = { x: p.x, z: p.z };
      rideEvents(stepRide(p, driveInput(), obstacles, dt));
      p.velocityX = (p.x - was.x) / dt;
      p.velocityZ = (p.z - was.z) / dt;
      if (p.ride?.grind && Math.random() < dt * 30) effects.puff(new T.Vector3(p.x, p.y, p.z), "#ffcf6b", 2, 2.4, 0.015);
    } else if (grab) {
      // Pressing against a rope, trunk, wall or net: grab it.
      startClimb(p, grab);
      pending = null;
    } else if (!p.remote) {
      // Rivers slow you down and carry you downstream.
      const water = p.y < 0.35 ? waterAt(mapScene.map, p.x, p.z) : null;
      if (water) {
        p.x += (water.flow?.x || 0) * (water.drift ?? 0.5) * dt;
        p.z += (water.flow?.z || 0) * (water.drift ?? 0.5) * dt;
        if ((move.x || move.z) && Math.random() < dt * 9) effects.puff(new T.Vector3(p.x, 0.15, p.z), "#d9f0ff", 3, 1.6, 0.03);
      }
      // Ice: you skate — speed builds up, and you glide on when you let go.
      const ice = p.y < 0.2 && !!iceAt(mapScene.map, p.x, p.z);
      stepBody(p, move, obstacles, dt, (sprinting && (move.x || move.z) ? SPRINT : 1) * (water ? (water.slow ?? 0.6) : 1) * (p.slow > 0 ? 0.5 : 1), ice);
      p.velocityX = (p.x - oldX) / dt;
      p.velocityZ = (p.z - oldZ) / dt;
      if (!wasGrounded && p.grounded) p.land = 0.2;
    }
    if (p.action) {
      const age = worldTime - p.action.started;
      if (!p.action.released && age >= p.action.release) {
        p.action.released = true;
        if (p.action.type === "throw" && p.action.payload.ball) {
          if (p === active) releaseShot(p, p.action.payload.ball);
        } else if (p.action.type === "throw") releaseSnow(p, p.action.payload);
        if (p.action.type === "kick" && p === active) {
          const c = p.action.payload.cube;
          if (loose.includes(c) && reachable(c, p, 1.9)) kickObject(c, p, 8);
        }
      }
      if (age >= p.action.duration) p.action = null;
    }
    p.hit = Math.max(0, p.hit - dt);
    p.land = Math.max(0, p.land - dt);
    for (const c of loose) {
      if (drag?.id === c.id) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (
        d < c.size / 2 + 0.34 &&
        Math.abs(c.y - (p.y + 0.3)) < 0.55 &&
        p === active &&
        (move.x || move.z)
      ) {
        if (!c.lastKick || worldTime - c.lastKick > 0.4) {
          kickObject(c, p, 3.8);
          c.lastKick = worldTime;
        }
      }
    }
  }
  // Cubes and balls: the same simulation as the server (currents, river wrap, goals, hoops).
  // Online the server is the referee and its corrections arrive; offline the browser announces.
  const events = stepWorld(world, dt, (o) => drag?.moved && drag.id === o.id);
  if (!net.connected) for (const event of events) onServer(event);
  if (!active.ride) updatePushing(move, dt);
  const removal = [];
  for (const pr of projectiles) {
    const k = pr.kind,
      pos = pr.mesh.position,
      old = pos.clone();
    pr.age += dt;
    if (!pr.resting) {
      pr.v.y -= pr.g * dt;
      pos.addScaledVector(pr.v, dt);
      if (k.id !== "fireball") {
        pr.mesh.rotation.x += pr.spin.x * dt;
        pr.mesh.rotation.y += pr.spin.y * dt;
        pr.mesh.rotation.z += pr.spin.z * dt;
      }
    }
    if (k.id === "fireball") {
      if (Math.random() < 0.8) effects.ember(pos);
      pr.mesh.userData.flame?.scale.setScalar(k.radius * (1 + Math.sin(pr.age * 40) * 0.12));
    }
    if (k.id === "grenade" && pr.mesh.userData.spark)
      pr.mesh.userData.spark.visible = Math.sin(pr.age * (8 + pr.age * 10)) > 0;
    let hit = null;
    const delta = pos.clone().sub(old),
      dist = delta.length();
    if (dist > 1e-6) {
      raycaster.set(old, delta.divideScalar(dist));
      raycaster.far = dist + k.radius;
      hit = raycaster
        .intersectObjects(pickables.filter((o) => o.userData.id !== pr.owner || pr.age > 0.3), true)
        .find((h) => visibleObject(h.object));
    }
    if (!hit && !pr.resting && pos.y < k.radius)
      hit = { point: new T.Vector3(pos.x, 0, pos.z), object: floor, face: null };
    if (hit) {
      const target = owner(hit.object);
      pr.normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new T.Vector3(0, 1, 0);
      if (pr.normal.dot(pr.v) > 0) pr.normal.negate();
      if (k.frostOnContact) {
        frostProjectile(pr, hit.point);
        removal.push(pr);
        continue;
      }
      if (k.explodeOnContact) {
        explodeProjectile(pr, hit.point);
        if (pr.owner === "self") removal.push(pr);
        else pr.resting = true;
        continue;
      }
      if (pr.v.length() > 2.5 || !k.bounce) burst(hit.point, target, pr.owner, pr);
      if (k.bounce && pr.bounces < 7 && pr.v.length() > 1.4) {
        const vn = pr.v.dot(pr.normal);
        pr.v.addScaledVector(pr.normal, -(1 + k.bounce) * vn).multiplyScalar(0.82);
        pos.copy(hit.point).addScaledVector(pr.normal, k.radius + 0.01);
        pr.bounces++;
        pr.spin.multiplyScalar(0.7);
      } else if (k.fuse) {
        pr.resting = true;
        pr.v.set(0, 0, 0);
        pos.copy(hit.point).addScaledVector(pr.normal, k.radius);
      } else {
        removal.push(pr);
        continue;
      }
    }
    if (k.fuse && pr.age >= k.fuse) {
      explodeProjectile(pr, pos.clone());
      removal.push(pr);
      continue;
    }
    if ((!k.fuse && pr.age > (k.life || 3)) || pos.y < -3 || (pr.resting && pr.owner !== "self" && pr.age > 6))
      removal.push(pr);
  }
  raycaster.far = Infinity;
  for (const s of removal) {
    if (!projectiles.includes(s)) continue;
    scene.remove(s.mesh);
    projectiles.splice(projectiles.indexOf(s), 1);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    p.v.y -= 8 * dt;
    p.mesh.position.addScaledVector(p.v, dt);
    p.mesh.scale.setScalar(Math.max(0.01, 1 - p.age / 0.65));
    if (p.age > 0.65) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
  emotionEffects.update(worldTime);
  saveClock += dt;
  if (saveClock > 3) {
    saveClock = 0;
    save();
  }
}
function rideState(p) {
  if (p.ride)
    return { kind: p.ride.kind, lean: p.ride.lean, speed: p.ride.speed, air: !p.grounded && !p.ride.grind, grind: !!p.ride.grind, push: p.grounded && keys.size > 0 && Math.abs(p.ride.speed) < rideInfo(p.ride.kind).max * 0.9 && !p.ride.grind };
  const r = (world.rides || []).find((x) => x.id === p.flags.rd);
  return { kind: r?.kind || "skateboard", lean: 0, speed: Math.hypot(p.velocityX || 0, p.velocityZ || 0), air: !p.grounded, grind: !!p.flags.gr };
}
function visual(dt) {
  effects.update(dt);
  updateRides(dt);
  if (charge) {
    const ring = $("#chargeRing");
    ring.style.setProperty("--p", chargeLevel().toFixed(3));
    ring.classList.toggle("full", chargeLevel() >= 1);
  }
  // Remote avatars are sampled once per rendered frame, so their motion is as smooth as the display.
  for (const p of players) if (p.remote) updateRemote(p, dt);
  tickMines();
  for (const p of players) {
    p.root.position.set(p.x, p.y, p.z);
    ensureTeamRing(p);
    ensureFrost(p);
    if (!p.remote && sledding(p)) {
      // On a sled you face down the slope.
      const d = gradient(p.support, p.x, p.z),
        desired = Math.atan2(-d.x, -d.z),
        delta = Math.atan2(Math.sin(desired - p.angle), Math.cos(desired - p.angle));
      p.angle += delta * (1 - Math.exp(-12 * dt));
    } else if (!p.remote && !p.ride && !p.climb && !p.kart && !p.tumble) {
      // You face your cursor; others face where their owners look (sent with their pose).
      const desired = Math.atan2(pointerWorld.x - p.x, pointerWorld.z - p.z),
        delta = Math.atan2(
          Math.sin(desired - p.angle),
          Math.cos(desired - p.angle),
        );
      p.angle += delta * (1 - Math.exp(-10 * dt));
      p.angle = Math.atan2(Math.sin(p.angle), Math.cos(p.angle));
    }
    p.root.rotation.y = p.angle;
    // Riders lean with the slope they roll on.
    const riding = p.ride || (p.remote && p.flags?.rd);
    p.root.rotation.order = "YXZ";
    p.root.rotation.x = riding ? -(p.ride ? p.ride.pitch : p.pitch || 0) : sledding(p) ? -slopePitch(p) : p.kart ? -(p.kart.pitch || 0) : 0;
    p.root.rotation.z = 0;
    // Tumbling: the whole body turns about its middle; lying down, the middle sinks to the ground.
    const tq = p.tumble ? p.tumble.q : p.remote && p.flags?.tq ? p.flags.tq : null;
    if (tq) {
      if (p.remote && !p.tumble) p.tq = p.tq ? qslerp(p.tq, tq, 1 - Math.exp(-18 * dt)) : tq;
      const q = p.remote && !p.tumble ? p.tq : tq,
        kind = p.tumble ? p.tumble.rest?.kind : TUMBLE_KINDS[p.flags?.tk],
        lying = p.tumble ? p.tumble.phase !== "air" : (p.flags?.tb || 1) > 1,
        off = qrot(q, [0, CENTER, 0]),
        hc = centerHeight(q, lying ? kind : null);
      p.root.quaternion.set(q[0], q[1], q[2], q[3]);
      p.root.position.set(p.x - off[0], p.y + hc - off[1], p.z - off[2]);
    } else if (p.tq) p.tq = null;
    const vx = p.velocityX || 0,
      vz = p.velocityZ || 0,
      speed = Math.hypot(vx, vz);
    animateRig(
      p,
      {
        time: worldTime,
        speed,
        localX:
          (vx * Math.cos(p.angle) - vz * Math.sin(p.angle)) / (speed || 1),
        localZ:
          (vx * Math.sin(p.angle) + vz * Math.cos(p.angle)) / (speed || 1),
        grounded: p.grounded,
        vy: p.vy,
        landing: p.land,
        action: p.action,
        emote: p.emote,
        hit: p.hit,
        pushing: p === active ? pushState : p.flags?.ps || 0,
        ride: riding ? rideState(p) : null,
        sled: sledding(p),
        kart: inKart(p) ? { steer: p.remote ? p.flags?.ks || 0 : p.kart.steer } : null,
        tumble: p.tumble ? { phase: PHASES[p.tumble.phase], kind: p.tumble.rest?.kind, t: p.tumble.t } : p.remote && p.flags?.tb ? { phase: p.flags.tb, kind: TUMBLE_KINDS[p.flags.tk], t: 1 } : null,
        skate: skating(p) ? Math.min(1, speed / 5) : 0,
        climb: p.climb
          ? p.climb.c.kind === "bar"
            ? { bar: true, pull: p.climb.pull, phase: p.climb.phase }
            : { zip: p.climb.c.kind === "zip", phase: p.y * 5 + (p.climb.around || 0) * 2 + p.x + p.z }
          : p.remote && p.flags?.hb
            ? { bar: true, pull: p.flags.pu || 0, phase: (p.x + p.z) * 5 }
            : p.remote && (p.flags?.cl || p.flags?.zp)
              ? { zip: !!p.flags.zp, phase: p.y * 5 + p.x + p.z }
              : null,
        charge: p === active ? chargeLevel() : p.flags?.c || 0,
        seed: p.x * 0.13,
        lookPitch: p.remote
          ? 0.06
          : clamp(
              1.3 /
                Math.max(
                  2,
                  Math.hypot(pointerWorld.x - p.x, pointerWorld.z - p.z),
                ),
              0,
              0.18,
            ),
      },
      dt,
    );
  }
  // Server corrections are blended in: the remaining error decays over ~100 ms.
  const decay = Math.exp(-12 * dt);
  for (const c of dynamicObjects(world)) {
    c.ox = (c.ox || 0) * decay;
    c.oy = (c.oy || 0) * decay;
    c.oz = (c.oz || 0) * decay;
  }
  for (const c of cubes) {
    const m = cubeMeshes.get(c.id);
    if (!m) continue;
    m.position.set(c.x + c.ox, c.y + c.oy, c.z + c.oz);
    m.rotation.y = c.rotation;
    m.rotation.z =
      Math.abs(c.vx) + Math.abs(c.vz) > 0.3 ? Math.sin(c.rotation) * 0.11 : 0;
  }
  for (const m of noteMeshes.values()) {
    m.userData.wobble = Math.max(0, (m.userData.wobble || 0) - dt);
    m.userData.pivot.rotation.z =
      Math.sin(m.userData.wobble * 38) * m.userData.wobble * 0.13;
  }
  mapScene.update(dt, worldTime);
  if (hitboxes.enabled)
    hitboxes.update(dt, {
      mapScene,
      bodies: players.filter((p) => p.root.visible !== false),
      objects: dynamicObjects(world).map((o) => ({ x: o.x, y: o.y, z: o.z, size: o.size, cube: !o.kind })),
      projectiles: projectiles.filter((pr) => pr.mesh.visible).map((pr) => ({ x: pr.mesh.position.x, y: pr.mesh.position.y, z: pr.mesh.position.z, r: pr.kind.radius })),
    });
  ring.position.set(
    active.x,
    (active.grounded
      ? active.y
      : Math.max(
          0,
          ...mapScene
            .colliders()
            .filter((b) => inside(active.x, active.z, b) && active.y >= b.h)
            .map((b) => b.h),
        )) + 0.045,
    active.z,
  );
  ring.material.opacity = active.grounded ? 0.75 : 0.35;
  ring.scale.setScalar(active.grounded ? 1 : 1 + active.y * 0.1);
}
let portraitClock = 0;
function drawRoom(dt) {
  portraitClock += dt;
  if (portraitClock > 0.12) {
    portraitClock = 0;
    renderer.setScissorTest(false);
    for (const p of players.slice(0, cinema.count)) {
      const portrait = portraits.get(p.profile.id);
      animateRig(
        portrait.avatar,
        { time: worldTime, grounded: true, emote: p.emote },
        0.12,
      );
      renderer.setRenderTarget(portrait.target);
      renderPortrait(portrait);
    }
    renderer.setRenderTarget(null);
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.render(scene, camera);
  avatarEditor?.update(worldTime, dt);
}
// ——— Multiplayer ———————————————————————————————————————————————————————————
// The server is authoritative for the shared state and the physics of cubes and the ball.
// Your own avatar moves instantly on your screen; others are interpolated from their poses.
function clockNow() {
  return net?.connected ? net.serverNow() : Date.now();
}
// Sends a state operation. Without a connection it is applied locally with the same rules.
function op(msg) {
  if (net?.connected) {
    net.send(msg);
    return;
  }
  if (msg.t.startsWith("obj.")) return;
  const result = applyOp(world, msg, {
    uid: myVoter,
    peer: "self",
    name: active.profile.name || "Вы",
    now: clockNow(),
    newId: uid,
  });
  if (!result) return;
  for (const { msg: out, others } of result.out) if (!others) onServer(out);
  syncAliases();
  save();
}
// Basketball: pick the ball up and shoot it at the nearest ring in reach, or pass it where you point.
function shoot(c) {
  if (!startAction(active, "throw", worldTime, { ball: c })) return;
  active.angle = Math.atan2(c.x - active.x, c.z - active.z);
  net.send({ t: "act", k: "shoot", target: c.id });
}
function shotTarget(from) {
  const hoop = hoopsOf(mapScene.map, world.structures)
    .map((h) => ({ ...h, d: Math.hypot(h.x - from.x, h.z - from.z) }))
    .filter((h) => h.d < 12.5)
    .sort((a, b) => a.d - b.d)[0];
  if (hoop) return { to: { x: hoop.x, y: hoop.y + 0.12, z: hoop.z }, angle: 54, hoop };
  const aim = pointerWorld.clone(),
    d = Math.hypot(aim.x - from.x, aim.z - from.z);
  if (d > 12) aim.set(from.x + ((aim.x - from.x) * 12) / d, 0, from.z + ((aim.z - from.z) * 12) / d);
  return { to: { x: aim.x, y: 0.4, z: aim.z }, angle: 38 };
}
function releaseShot(p, c) {
  if (!dynamicObjects(world).includes(c) || Math.hypot(c.x - p.x, c.z - p.z) > 2.3) return;
  const fx = Math.sin(p.angle) * 0.45,
    fz = Math.cos(p.angle) * 0.45;
  const from = { x: p.x + fx, y: p.y + 1.85, z: p.z + fz },
    { to, angle, hoop } = shotTarget(from);
  // Longer shots are less sure.
  const d = Math.hypot(to.x - from.x, to.z - from.z),
    miss = (Math.random() - 0.5) * (0.012 + d * 0.0045);
  const v = arcVelocity(from, to, angle, GRAVITY);
  const k = Math.min(1, THROW_SPEED / (Math.hypot(v.x, v.y, v.z) || 1)) * (1 + miss);
  Object.assign(c, { x: from.x, y: from.y, z: from.z, vx: v.x * k, vy: v.y * k, vz: v.z * k });
  if (!net?.connected) (world.lastTouch ||= {})[c.id] = "self";
  net?.send({ t: "obj.throw", id: c.id, x: r3(from.x), y: r3(from.y), z: r3(from.z), vx: r3(c.vx), vy: r3(c.vy), vz: r3(c.vz) });
  if (hoop) toast(d > 8 ? "Дальний бросок…" : "Бросок!", 900);
}
// Kicks, pushes and snowball hits: predicted locally at once, confirmed by the server.
function kickObject(c, from, power) {
  kickCube(c, from, power);
  if (!net?.connected && world.balls.includes(c)) (world.lastTouch ||= {})[c.id] = "self";

  net?.send({ t: "obj.kick", id: c.id, x: r3(from.x), z: r3(from.z), a: r3(from.angle || 0), power });
}
const throttleClock = {};
function throttled(key, fn, interval = 50) {
  const now = performance.now();
  if (now - (throttleClock[key] || 0) < interval) return;
  throttleClock[key] = now;
  fn();
}
// Moves a structure (or the big cube) and carries your avatar if it stands on top.
function moveStructure(id, x, z, y = 0, tip = null) {
  const s = mapScene.props.get(id);
  if (!s) return;
  const dy = y - (s.y || 0);
  // Carry your avatar if it stands on top of what moves.
  if (
    active.grounded &&
    s.localColliders.some((c) => Math.abs(active.y - (c.h + (s.y || 0))) < 0.02 && inside(active.x, active.z, { ...c, x: s.x + c.x, z: s.z + c.z }))
  ) {
    active.x += x - s.x;
    active.z += z - s.z;
    active.y += dy;
  }
  mapScene.move(id, x, z, y, tip);
  world.structures[id] = { x, z, ...(y ? { y } : {}), ...(tip && tip.ta ? { tx: tip.tx, tz: tip.tz, ta: tip.ta } : {}) };
  world.v = (world.v || 0) + 1;
}
// ——— Shift: sprint, push, lift ———
let sprinting = false,
  shiftHeld = false,
  pushState = 0;
const liftedBy = {};
// Leaning into a prop with Shift shows the pushing pose; holding a lifted prop raises the arms.
// Without a server the same rules run here, so pushing works offline too.
function updatePushing(move, dt) {
  const me = net?.id;
  pushState = me && Object.values(liftedBy).some((by) => by.includes(me)) ? 2 : 0;
  if (!sprinting) return;
  if (!pushState && (move.x || move.z)) {
    const len = Math.hypot(move.x, move.z);
    for (const prop of mapProps(mapDef(world.map))) {
      const pos = mapScene.props.get(prop.id);
      if (!pos || pos.y || !Number.isFinite(prop.weight)) continue;
      const dx = active.x - (pos.x + prop.cx),
        dz = active.z - (pos.z + prop.cz);
      const gap = prop.round
        ? Math.hypot(dx, dz) - prop.r
        : Math.hypot(Math.max(0, Math.abs(dx) - prop.hw), Math.max(0, Math.abs(dz) - prop.hd));
      if (gap < 0.55 && active.y < prop.h - 0.1 && (move.x * -dx + move.z * -dz) / len / (Math.hypot(dx, dz) || 1) > 0.4) {
        pushState = 1;
        break;
      }
    }
  }
  if (!net?.connected) {
    const len = Math.hypot(move.x, move.z) || 1;
    for (const m of stepPushes(world, [{ id: "self", x: active.x, y: active.y, z: active.z, mx: move.x / len, mz: move.z / len }], dt))
      moveStructure(m.id, m.x, m.z, m.y || 0);
  }
}
function updateRemote(p, dt) {
  const renderAt = clockNow() - p.buffer.delay();
  while (p.events.length && p.events[0].s <= renderAt) remoteEvent(p, p.events.shift());
  // Without a server, someone you knocked over flies here, not by their pose.
  if (p.tumble) return;
  const s = p.buffer.sample(renderAt);
  if (!s) return;
  if (!(dt > 0)) return;
  const vx = (s.x - p.x) / dt,
    vz = (s.z - p.z) / dt;
  p.velocityX = (p.velocityX || 0) + (vx - (p.velocityX || 0)) * 0.25;
  p.velocityZ = (p.velocityZ || 0) + (vz - (p.velocityZ || 0)) * 0.25;
  const wasGrounded = p.grounded;
  p.x = s.x;
  p.y = s.y;
  p.z = s.z;
  p.vy = s.vy;
  p.grounded = !!s.g;
  p.angle = s.a;
  if (!wasGrounded && p.grounded) p.land = 0.2;
}
function remoteEvent(p, ev) {
  if (ev.k === "throw" && Array.isArray(ev.to))
    startAction(p, "throw", worldTime, { to: new T.Vector3(...ev.to), w: ev.w || "snow", pw: ev.pw || 1, pid: ev.pid });
  if (ev.k === "kick")
    startAction(p, "kick", worldTime, { cube: findObject(world, ev.target) || null });
  if (ev.k === "trick" && ev.n) toast(`${p.profile.name}: ${ev.n}!`, 1600);
  if (ev.k === "shoot") startAction(p, "throw", worldTime, { ball: findObject(world, ev.target) || {} });
  if (ev.k === "emote") emotionEffects.start(p, ev.e, worldTime);
}
let lastPoseSent = -Infinity,
  lastPose = null,
  movedAt = -Infinity;
function currentPose() {
  const pose = {
    x: r3(active.x),
    y: r3(active.y),
    z: r3(active.z),
    a: Math.round(active.angle * 100) / 100,
    vy: Math.round(active.vy * 100) / 100,
    g: active.grounded ? 1 : 0,
  };
  if (sprinting) {
    const mv = movement(),
      len = Math.hypot(mv.x, mv.z) || 1;
    pose.sh = 1;
    pose.m = [Math.round((mv.x / len) * 100) / 100, Math.round((mv.z / len) * 100) / 100];
  }
  if (pushState) pose.ps = pushState;
  if (charge) pose.c = Math.round(chargeLevel() * 10) / 10;
  if (active.climb?.c.kind === "bar") {
    pose.hb = 1;
    if (active.climb.pull > 0.05) pose.pu = Math.round(active.climb.pull * 10) / 10;
  } else if (active.climb) pose[active.climb.c.kind === "zip" ? "zp" : "cl"] = 1;
  if (sledding(active)) pose.sd = 1;
  if (active.slow > 0) pose.fr = 1;
  if (active.kart) {
    pose.kt = 1;
    if (Math.abs(active.kart.steer) > 0.05) pose.ks = Math.round(active.kart.steer * 10) / 10;
  }
  if (active.tumble) {
    pose.tq = active.tumble.q.map((v) => Math.round(v * 100) / 100);
    pose.tb = PHASES[active.tumble.phase];
    if (active.tumble.rest) pose.tk = TUMBLE_KINDS.indexOf(active.tumble.rest.kind);
  }
  if (active.ride) {
    pose.rd = active.ride.id;
    if (active.ride.flip >= 0) pose.fl = Math.round(active.ride.flip * 100) / 100;
    if (active.ride.grind) pose.gr = 1;
  }
  return pose;
}
// Up to 30 poses a second while moving (plus a few after stopping so others land exactly),
// one per second while idle.
function sendPose(now) {
  if (!net?.connected) return;
  const pose = currentPose();
  const changed =
    !lastPose ||
    lastPose.x !== pose.x ||
    lastPose.y !== pose.y ||
    lastPose.z !== pose.z ||
    lastPose.g !== pose.g ||
    Math.abs(lastPose.a - pose.a) > 0.02 ||
    lastPose.sh !== pose.sh ||
    String(lastPose.m) !== String(pose.m) ||
    lastPose.ps !== pose.ps ||
    lastPose.c !== pose.c;
  if (changed) movedAt = now;
  const since = now - lastPoseSent;
  const due = now - movedAt < 200 ? since >= POSE_INTERVAL : since >= HEARTBEAT;
  if (!due) return;
  net.send({ t: "pose", ...pose });
  lastPoseSent = now;
  lastPose = pose;
}
function ensureCubeMesh(c) {
  if (!cubeMeshes.has(c.id)) addCubeMesh(c);
}
function removeCubeMesh(id) {
  const root = cubeMeshes.get(id);
  if (!root) return;
  scene.remove(root);
  pickables = pickables.filter((o) => o !== root);
  cubeMeshes.delete(id);
}
function upsertNote(note) {
  let n = world.notes.find((x) => x.id === note.id);
  if (n) Object.assign(n, note);
  else world.notes.push((n = { ...note }));
  syncAliases();
  if (drag?.id === n.id) n.x = noteMeshes.get(n.id)?.position.x ?? n.x;
  refreshNote(n);
  if (boardOpen()) board();
}
// Server physics states arrive a little late: replay them forward by the measured latency,
// then hide the correction by letting the visual offset decay.
function applyObjects(m) {
  const lag = clamp((clockNow() - m.s) / 1000, 0, 0.25);
  const obs = stateObstacles(world);
  for (const packed of m.o) {
    const o = findObject(world, packed[0]);
    if (!o || (drag?.moved && drag.id === o.id)) continue;
    const s = { ...o, ...unpackObject(packed) };
    for (let t = 0; t + 1e-9 < lag; t += 1 / 120) stepCube(s, obs, 1 / 120);
    const ex = o.x - s.x,
      ey = o.y - s.y,
      ez = o.z - s.z;
    if (Math.hypot(ex, ey, ez) < 1.5) {
      o.ox = clamp((o.ox || 0) + ex, -1, 1);
      o.oy = clamp((o.oy || 0) + ey, -1, 1);
      o.oz = clamp((o.oz || 0) + ez, -1, 1);
    } else o.ox = o.oy = o.oz = 0;
    Object.assign(o, {
      x: s.x,
      y: s.y,
      z: s.z,
      vx: s.vx,
      vy: s.vy,
      vz: s.vz,
      spin: s.spin,
      rotation: s.rotation,
    });
  }
}
let placedOnce = false,
  welcomed = false;
// Replaces the room state (on joining, and when someone switches the map).
function loadState(fresh, objs) {
  const mapChanged = fresh.map !== mapScene.map?.id;
  Object.assign(world, {
    map: fresh.map,
    notes: fresh.notes,
    cubes: fresh.cubes,
    balls: fresh.balls,
    rides: fresh.rides,
    structures: fresh.structures,
    scores: fresh.scores,
    timer: fresh.timer,
    match: fresh.match,
    mines: fresh.mines || [],
    flags: {},
    lifts: {},
  });
  world.v = (world.v || 0) + 1;
  renderMines();
  for (const id of [...cubeMeshes.keys()]) removeCubeMesh(id);
  syncAliases();
  for (const packed of objs || []) {
    const o = findObject(world, packed[0]);
    if (o) Object.assign(o, unpackObject(packed), { ox: 0, oy: 0, oz: 0 });
  }
  const old = new Set(mapScene.pickables);
  if (mapChanged) {
    fitRoomSize();
    mapScene.build(mapDef(world.map), world.structures, world.balls);
    drawLaps();
    closeTrackChooser();
  }
  else {
    for (const [id, pos] of Object.entries(world.structures)) mapScene.move(id, pos.x, pos.z, pos.y || 0, pos.ta ? pos : null);
    mapScene.setBalls(world.balls);
  }
  pickables = [...pickables.filter((p) => !old.has(p)), ...mapScene.pickables];
  cinema.frame.material.color.set(mapScene.theme.frame);
  cubes.forEach(addCubeMesh);
  refreshNotes();
  renderTimer();
  for (const id of Object.keys(liftedBy)) delete liftedBy[id];
  buildRides();
  // Back on the ride you were on (a reconnect), or off it if the room says so.
  const mine = (world.rides || []).find((r) => r.by === myRider());
  if (active.ride && mine?.id !== active.ride.id) delete active.ride;
  if (mapChanged) {
    // Step out of anything solid on the new map.
    if (mapScene.colliders().some((b) => !b.y && b.h > 0.2 && inside(active.x, active.z, b, 0.3))) {
      Object.assign(active, freeSpot(world, active.x, active.z, 0.6), { y: 0, vy: 0, grounded: true });
    }
    projectiles.splice(0).forEach((pr) => scene.remove(pr.mesh));
    if (settingsOpen()) renderSettings();
  }
}
function onWelcome(m) {
  myVoter = m.voter || clientUid;
  for (const p of players.slice(1)) removeRemote(p.profile.id, true);
  for (const peer of m.peers) addRemote(peer.id, peer.profile, peer.pose, true);
  loadState(createState(m.state, uid), m.objs);
  if (!placedOnce && m.you?.pose) {
    placedOnce = true;
    Object.assign(active, { x: m.you.pose.x, z: m.you.pose.z, y: 0, vy: 0, grounded: true });
  }
  lastPose = null;
  refreshParticipants();
  if (!welcomed) {
    welcomed = true;
    toast(
      remotes.size
        ? `Вы в комнате. Здесь уже: ${[...remotes.values()].map((p) => p.profile.name).join(", ")}`
        : "Вы в комнате одни. Пригласите коллег — ссылка в настройках (правый верхний угол)",
      5000,
    );
  }
  if (m.rtc) mediaClient.connect(m.rtc.url, m.rtc.token, m.id);
}
function onServer(m, at) {
  switch (m.t) {
    case "welcome":
      onWelcome(m);
      break;
    case "join":
      addRemote(m.id, m.profile, m.pose);
      break;
    case "leave":
      removeRemote(m.id);
      break;
    case "pose": {
      const p = remotes.get(m.id);
      if (!p) break;
      p.buffer.push(m, m.s, clockNow());
      p.flags = { ps: m.ps || 0, c: m.c || 0, rd: m.rd || null, fl: m.fl ?? -1, gr: m.gr || 0, cl: m.cl || 0, zp: m.zp || 0, sd: m.sd || 0, hb: m.hb || 0, pu: m.pu || 0, kt: m.kt || 0, ks: m.ks || 0, tq: m.tq || null, tb: m.tb || 0, tk: m.tk ?? -1, fr: m.fr || 0 };
      break;
    }
    case "profile":
      updateRemoteProfile(m.id, m.profile);
      break;
    case "act":
      // Run over: you are thrown at once, as the driver saw it.
      if (m.k === "hit") {
        if (m.target === net.id) knockOver(m.v);
        break;
      }
      if (m.k === "frost") {
        applyFrost(m.x, m.z, m.pid);
        break;
      }
      if (m.k === "melee") {
        // You were hit in melee: a shove and, in a match, a chunk of health.
        if (m.target === net.id) {
          const by = remotes.get(m.id);
          const dir = by ? new T.Vector3(active.x - by.x, 0, active.z - by.z) : new T.Vector3(Math.sin(active.angle), 0, Math.cos(active.angle));
          if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
          dir.normalize();
          active.kx = (active.kx || 0) + dir.x * 4;
          active.kz = (active.kz || 0) + dir.z * 4;
          active.hit = 0.6;
          takeDamage(DMG.melee, m.id);
        }
        break;
      }
      if (m.k === "lap") {
        const p = remotes.get(m.id);
        if (p && recordLap(p.profile.name, m.ms / 1000)) toast(`${p.profile.name}: лучший круг ${lapTime(m.ms / 1000)}`, 2500);
        break;
      }
      remotes.get(m.id)?.events.push(m);
      break;
    case "note":
      upsertNote(m.note);
      break;
    case "note.move": {
      const n = world.notes.find((n) => n.id === m.id);
      if (!n || drag?.id === n.id) break;
      n.x = m.x;
      n.z = m.z;
      noteMeshes.get(n.id)?.position.set(n.x, 0.025, n.z);
      break;
    }
    case "note.del":
      world.notes = world.notes.filter((n) => n.id !== m.id);
      removeNoteMesh(m.id);
      if (selected?.id === m.id) closeContext();
      if (boardOpen()) board();
      break;
    case "cube":
      if (!world.cubes.some((c) => c.id === m.cube.id)) world.cubes.push({ ...m.cube });
      syncAliases();
      ensureCubeMesh(findObject(world, m.cube.id));
      break;
    case "cube.del":
      world.cubes = world.cubes.filter((c) => c.id !== m.id);
      removeCubeMesh(m.id);
      if (selected?.id === m.id) closeContext();
      break;
    case "objs":
      applyObjects(m);
      break;
    case "struct":
      if (drag?.id !== m.id) moveStructure(m.id, m.x, m.z, m.y || 0, m.ta ? { tx: m.tx, tz: m.tz, ta: m.ta } : null);
      liftedBy[m.id] = m.by || [];
      break;
    case "boom":
      onBoom(m);
      break;
    case "goal":
    case "basket": {
      world.scores[m.goal || m.hoop] = m.score;
      const scorer = m.by === net.id || m.by === "self" ? active : remotes.get(m.by);
      toast(
        m.t === "goal"
          ? `Гол${scorer ? ` — ${scorer.profile.name}` : ""}! ${m.label || "Ворота"}: ${m.score} · мяч можно вернуть через меню ворот`
          : `Попадание${scorer ? ` — ${scorer.profile.name}` : ""}! ${m.label || "Кольцо"}: ${m.score} очк.`,
        3500,
      );
      emotionEffects.start(scorer || active, "firework", worldTime);
      break;
    }
    case "ride":
      onRide(m.ride);
      break;
    case "mines":
      world.mines = m.mines;
      renderMines();
      break;
    case "match": {
      const wasLive = world.match?.phase;
      world.match = loadMatch(m.match);
      // A new round: jump to your spawn, full health, back in the fight.
      const spawn = m.spawns?.[matchId()];
      if (spawn) respawnSelf(spawn);
      else if (world.match.alive?.[matchId()] !== false && wasLive !== "live" && world.match.phase === "live") active.hp = MAX_HP;
      if (world.match.phase === "idle") active.dead = false;
      renderMatchHud();
      break;
    }
    case "reset": {
      delete active.ride;
      delete active.kart;
      active.tumble = null;
      active.climb = null;
      loadState(createState(m.state, uid), m.objs);
      // Everyone starts the new map at its entrance.
      Object.assign(active, spawnPoint(mapDef(world.map), Math.random, world.structures), { y: 0, vy: 0, grounded: true, kx: 0, kz: 0, hp: MAX_HP, dead: false, slow: 0 });
      pending = null;
      const who = m.by === net.id || m.by === "self" ? "Вы" : remotes.get(m.by)?.profile.name || m.name || "Кто-то";
      toast(`${who} — карта «${mapDef(world.map).title}»`, 3500);
      renderMatchHud();
      break;
    }
    case "timer":
      world.timer = m.timer;
      renderTimer();
      break;
    case "error":
      toast(m.message, 6000);
      break;
  }
  syncAliases();
}
// ——— Room UI: status chip, invite link, people ———
function peopleNames() {
  return players.map((p) => (p === active ? `${p.profile.name || "Вы"} (вы)` : p.profile.name));
}
function renderPresence() {
  refreshSettings();
  const chip = $("#netStatus");
  if (!chip) return;
  const s = net?.status || "offline";
  const text = {
    connecting: "Подключаемся…",
    reconnecting: "Нет связи — переподключаемся…",
    offline: "Офлайн · всё сохраняется в этом браузере",
    full: "Комната заполнена — ждём место",
    error: "Не удалось войти в комнату",
  }[s];
  const n = players.length;
  chip.dataset.state = s;
  chip.querySelector(".net-text").textContent =
    text ||
    `${n} ${n % 10 === 1 && n % 100 !== 11 ? "участник" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "участника" : "участников"}` +
      (net.rtt ? ` · ${Math.round(net.rtt)} мс` : "");
  chip.title = peopleNames().join(", ");
}
async function copyLink() {
  const link = inviteLink();
  try {
    await navigator.clipboard.writeText(link);
    toast("Ссылка на комнату скопирована — отправьте её коллегам", 3000);
  } catch {
    openSettings("room");
    $("#roomLink")?.select();
  }
}
// ——— Settings panel (top right): room, map, view angle, avatar ———
function settingsOpen() {
  return !$("#settings").hidden;
}
function peopleHTML() {
  return players
    .map(
      (p) =>
        `<li><span class="dot" style="background:${esc(p.profile.color || "#aaa")}"></span>${esc(p.profile.name || "Вы")}${p === active ? " <em>вы</em>" : ""}${p.speaking ? " <em>говорит</em>" : ""}</li>`,
    )
    .join("");
}
function connectionText() {
  return net?.connected
    ? `Сервер api.sohimazdai.ru · задержка ${net.rtt ? Math.round(net.rtt) + " мс" : "измеряется"} · звук и видео ${mediaClient?.ready ? "подключены" : "не подключены"}`
    : "Нет связи с сервером: изменения сохраняются только в этом браузере.";
}
function renderSettings() {
  const current = world.map || DEFAULT_MAP;
  $("#settings").innerHTML = `<div class="settings-head"><h2>Настройки</h2><button class="close" data-action="settingsClose" aria-label="Закрыть настройки">×</button></div>
<section data-section="room"><h3>Комната</h3>
<label class="field-label" for="roomLink">Ссылка-приглашение</label><div class="link-row"><input id="roomLink" readonly value="${esc(inviteLink())}"><button class="primary" data-action="invite">Пригласить</button></div>
<p class="settings-hint">Все, кто откроет ссылку, попадут в эту комнату: увидят друг друга, стикеры и таймер, услышат голос.</p>
<label class="field-label">В комнате · <span id="peopleCount">${players.length}</span></label><ul class="people" id="peopleList">${peopleHTML()}</ul>
<div class="settings-row"><button class="secondary" data-action="newRoom">Новая комната</button><button class="secondary" data-action="export">Скачать итоги</button></div>
<p class="settings-hint" id="connectionText">${connectionText()}</p></section>
<section data-section="map"><h3>Карта</h3><div class="map-grid">${MAPS.map(
    (m) =>
      `<button class="map-card${m.id === current ? " selected" : ""}" data-map="${m.id}" style="--map:${m.color}" aria-pressed="${m.id === current}"><strong>${esc(m.title)}</strong><span>${esc(m.description)}</span></button>`,
  ).join("")}</div><p class="settings-hint">Карта общая: меняется сразу у всех в комнате. Стикеры остаются на месте.</p></section>
<section data-section="view"><h3>Ракурс</h3><div class="label-row"><label for="elevation">Угол к полу</label><span id="elevationValue">${Math.round(camElevation)}°</span></div><input id="elevation" type="range" min="${ELEVATION.min}" max="${ELEVATION.max}" value="${camElevation}"><div class="settings-row"><button class="secondary" id="resetView">Вернуть ${ELEVATION.initial}°</button></div><p class="settings-hint">Также средняя кнопка мыши и движение вверх-вниз. Ракурс только ваш.</p></section>
<section data-section="debug"><h3>Хитбоксы</h3><label class="switch-row"><input type="checkbox" id="hitboxToggle"${hitboxes.enabled ? " checked" : ""}><span class="switch" aria-hidden="true"></span><span>Показать хитбоксы</span></label><p class="settings-hint hitbox-legend"><span><i style="--c:#4fd2ff"></i>стены и декор</span><span><i style="--c:#6dff7c"></i>двигается Shift</span><span><i style="--c:#ffae42"></i>поднято</span><span><i style="--c:#ff5fd2"></i>аватары</span><span><i style="--c:#ffffff"></i>мячи и кубики</span><span><i style="--c:#ff4848"></i>снаряды и взрывы</span></p><p class="settings-hint">Видно только вам. Бледная линия на полу — докуда может дойти центр аватара.</p></section>
<section data-section="avatar"><h3>Аватар</h3><div class="avatar-row"><span class="dot" style="background:${esc(active.profile.color || "#aaa")}"></span><strong>${esc(active.profile.name || "Вы")}</strong><button class="secondary" data-action="avatar">Изменить внешность</button></div></section>`;
  $("#elevation").oninput = (e) => {
    camElevation = +e.target.value;
    $("#elevationValue").textContent = camElevation + "°";
    updateCamera();
  };
  $("#resetView").onclick = () => {
    camElevation = ELEVATION.initial;
    $("#elevation").value = camElevation;
    $("#elevationValue").textContent = camElevation + "°";
    updateCamera();
  };
  $("#roomLink").onfocus = (e) => e.target.select();
  $("#hitboxToggle").onchange = (e) => setHitboxes(e.target.checked);
}
function refreshSettings() {
  if (!settingsOpen()) return;
  $("#peopleList").innerHTML = peopleHTML();
  $("#peopleCount").textContent = players.length;
  $("#connectionText").textContent = connectionText();
}
function openSettings(section) {
  renderSettings();
  $("#settings").hidden = false;
  $("#settingsBtn").setAttribute("aria-expanded", "true");
  $("#settingsBtn").classList.add("on");
  if (section) $(`#settings [data-section="${section}"]`)?.scrollIntoView?.({ block: "nearest" });
}
function closeSettings() {
  $("#settings").hidden = true;
  $("#settingsBtn").setAttribute("aria-expanded", "false");
  $("#settingsBtn").classList.remove("on");
  canvas.focus();
}
const roomModal = () => openSettings("room");
document.addEventListener("pointerdown", (e) => {
  if (settingsOpen() && !e.target.closest?.("#settings, #settingsBtn, #netStatus, dialog")) closeSettings();
});
function askName(then) {
  modal(
    "Как вас зовут?",
    `<form id="nameForm"><label class="field-label" for="nameInput">Имя для коллег</label><input id="nameInput" maxlength="32" required placeholder="Например, Аня" value="${esc(me.name || "")}"><p class="modal-text">Имя видно над аватаром и на экране. Внешность можно настроить позже — кнопка «Мой аватар».</p><div class="modal-actions"><button class="primary">Войти в комнату</button></div></form>`,
  );
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    then();
  };
  $("#nameForm").onsubmit = (e) => {
    e.preventDefault();
    const name = $("#nameInput").value.trim().slice(0, 32);
    if (!name) return;
    const profile = normalizeProfile({ ...active.profile, name });
    rebuildAvatar(active, profile);
    me = profile;
    save();
    go();
    $("#modal").close();
  };
  // Closing the dialog without a name still enters the room, as a guest.
  $("#modal").addEventListener("close", go, { once: true });
  setTimeout(() => $("#nameInput")?.focus(), 60);
}
function startNetwork() {
  mediaClient = new Media({
    onVideo,
    onSpeakers: (ids) => {
      for (const p of players) {
        const speaking = ids.has(p === active ? "self" : p.profile.id);
        if (speaking !== !!p.speaking) {
          p.speaking = speaking;
          drawLabel(p);
        }
      }
    },
    onLocal: (state) => {
      localMedia = state;
      mediaButtons();
    },
    onStatus: () => mediaButtons(),
    toast,
  });
  net = new Net({
    url: API_URL,
    room: roomId,
    uid: clientUid,
    profile: publicProfile,
    WebSocketImpl: !OFFLINE && typeof WebSocket === "function" ? WebSocket : null,
    onMessage: onServer,
    clock: () => performance.now(),
    timers: { setTimeout, clearTimeout, setInterval, clearInterval },
    onStatus: (s, detail) => {
      renderPresence();
      if (s === "error" && detail) toast(detail, 6000);
      if (s === "full") toast(detail || "Комната заполнена", 6000);
    },
  });
  // The first time in, the server picks where you appear (the map's entrance); after a reconnect
  // you carry on from where you were.
  net.pose = () => (placedOnce ? currentPose() : undefined);
  // ?debug exposes internals for end-to-end checks and troubleshooting in the console.
  if (/[?&]debug\b/.test(location.search))
    window.kino = { players, world, remotes, net, mediaClient, op, camera, avatarModal, editor: () => avatarEditor, notes: () => notes, active: () => active };
  setInterval(renderPresence, 2000);
  initMatchHud();
  renderMines();
  active.hp = MAX_HP;
  renderMatchHud();
  // Keep the match banner's countdown ticking.
  setInterval(() => inMatchMap() && renderMatchHud(), 250);
  // Browsers only play sound after a gesture: the first click in the room unlocks it.
  window.addEventListener("pointerdown", () => mediaClient.startAudio(), true);
  if (!net.WebSocketImpl) {
    renderPresence();
    return;
  }
  if (!active.profile.name || active.profile.name === "Вы") askName(() => net.start());
  else net.start();
}
function frame(now) {
  const dt = Math.min((now - clock) / 1000, 0.06);
  clock = now;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= 1 / 120 && steps < 8) {
    physics(1 / 120);
    accumulator -= 1 / 120;
    steps++;
  }
  visual(dt);
  sendPose(now);
  drawRoom(dt);
  requestAnimationFrame(frame);
}
setInterval(() => {
  renderTimer();
  status();
  renderCooldowns();
}, 250);
requestAnimationFrame(frame);
$("#loading").classList.add("hidden");
setTimeout(() => $("#loading").remove(), 600);
toast("WASD / стрелки — движение · Space — прыжок · клик — снежок", 6500);
status();
renderWeapon();
startNetwork();
