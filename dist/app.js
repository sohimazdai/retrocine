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
} from "./physics.js";
import { animateRig, startAction } from "./animation.js";
import { EmotionEffects, EMOTIONS } from "./emotions.js";
import { ROOM, floorBack, fitNoteText } from "./layout.js";
import {
  createFloor,
  roomDistance,
  ROOM_TARGET,
  framePortrait,
} from "./room.js";
import { Playground } from "./playground.js";
import { CinemaScreen } from "./cinema.js";
import { AvatarEditor, editorMarkup } from "./avatar-editor.js";
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
const oldNotes = read("kino-notes-v1", null);
const defaults = [
  ["Классно выкатили новый онбординг 🚀", "good", "Аня"],
  ["Помогаем друг другу с ревью", "good", "Макс"],
  ["Меньше встреч без повестки", "improve", "Лена"],
  ["Больше времени на тестирование", "improve", "Дима"],
  ["Пятничные демо команды ✨", "idea", "Аня"],
  ["Попробовать день без встреч", "idea", "Макс"],
];
const notePositions = [
  [-10.5, -0.3],
  [-3.8, 4.8],
  [-0.8, -5.8],
  [2.5, 5],
  [10.5, 2],
  [0.1, 8],
];
let notes =
  read("kino-3d-notes-v2", null) ||
  (
    oldNotes ||
    defaults.map(([text, type, author], i) => ({
      text,
      type,
      author,
      votes: (i % 3) + 1,
    }))
  ).map((n, i) => ({
    ...n,
    id: n.id || uid(),
    x: notePositions[i % 6][0] + Math.floor(i / 6) * 0.3,
    z: notePositions[i % 6][1],
    y: 0,
  }));
let me = read("kino-avatar-v1", {
  name: "Вы",
  color: "#ae92d6",
  skin: "#e4b59b",
  hat: "headphones",
});
const defs = [
  { ...me, id: "self", x: -2.8, z: 1.3 },
  {
    id: "anya",
    name: "Аня",
    color: "#d99e86",
    skin: "#ecc0a6",
    hat: "bun",
    x: -9,
    z: 2,
  },
  {
    id: "max",
    name: "Макс",
    color: "#9eb493",
    skin: "#bd8f70",
    hat: "cap",
    x: 5.8,
    z: -0.8,
  },
  {
    id: "lena",
    name: "Лена",
    color: "#c69eaf",
    skin: "#edbda1",
    hat: "long",
    x: -6,
    z: 6,
  },
  {
    id: "dima",
    name: "Дима",
    color: "#89a4bf",
    skin: "#d7a17d",
    hat: "glasses",
    x: 8.8,
    z: 5.3,
  },
  {
    id: "sonya",
    name: "Соня",
    color: "#bcae8b",
    skin: "#e4b59b",
    hat: "short",
    outfit: "suit",
    x: -11,
    z: -5.5,
  },
];
let cubes = read("kino-3d-cubes-v2", [
  { x: -10.3, z: 7.8, size: 0.65, color: "#a696ce" },
  { x: 6.5, z: 2, size: 0.65, color: "#ccad87" },
  { x: 10.5, z: -4, size: 0.65, color: "#9bbbbb" },
  { x: -1, z: 0.5, size: 0.65, color: "#c99ead" },
]).map((c) => ({
  ...c,
  y: c.size / 2,
  vx: 0,
  vy: 0,
  vz: 0,
  spin: 0,
  rotation: 0,
  id: c.id || uid(),
}));
let big = {
  ...read("kino-3d-big-v2", { x: 2.4, z: -1.1 }),
  w: 2.8,
  d: 2.8,
  h: 1.65,
  id: "big",
};
let storageFailed = false;
function save() {
  try {
    localStorage.setItem("kino-3d-notes-v2", JSON.stringify(notes));
    localStorage.setItem(
      "kino-3d-cubes-v2",
      JSON.stringify(
        cubes.map(({ x, z, size, color, id }) => ({ x, z, size, color, id })),
      ),
    );
    localStorage.setItem(
      "kino-3d-big-v2",
      JSON.stringify({ x: big.x, z: big.z }),
    );
    localStorage.setItem(
      "kino-avatar-v1",
      JSON.stringify(players[0]?.profile || me),
    );
    localStorage.setItem(
      "kino-playground-v1",
      JSON.stringify(playground.snapshot()),
    );
    localStorage.setItem("kino-room-layout-v3", "true");
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
const camera = new T.PerspectiveCamera(43, innerWidth / innerHeight, 0.1, 120),
  raycaster = new T.Raycaster(),
  pointerNDC = new T.Vector2(),
  groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0),
  pointerWorld = new T.Vector3(0, 0, 7);
let camElevation = 60,
  baseDistance = roomDistance(innerWidth / innerHeight);
let cinema = null,
  avatarEditor = null;
function updateCamera() {
  const d = baseDistance,
    el = (camElevation * Math.PI) / 180;
  camera.position.set(
    0,
    ROOM_TARGET.y + Math.sin(el) * d,
    ROOM_TARGET.z + Math.cos(el) * d,
  );
  camera.lookAt(ROOM_TARGET);
  camera.updateMatrixWorld();
  cinema?.updateCamera(camera);
}
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  baseDistance = roomDistance(camera.aspect, camera.fov);
  camera.far = Math.max(120, baseDistance + 40);
  camera.updateProjectionMatrix();
  updateCamera();
}
window.addEventListener("resize", resize);
resize();
scene.add(new T.HemisphereLight("#eee1ff", "#484054", 2.1));
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
const floor = createFloor(scene);
const playground = new Playground(scene, read("kino-playground-v1", {}));
const bigGroup = new T.Group();
bigGroup.userData = { kind: "big", id: "big" };
scene.add(bigGroup);
box(bigGroup, big.w, big.h, big.d, "#9988b5", 0, big.h / 2, 0, 0.12);
box(bigGroup, 2.56, 0.03, 2.56, "#b5a5cc", 0, big.h + 0.012, 0, 0.04);
for (const x of [-1.31, 1.31])
  box(bigGroup, 0.022, 1.35, 0.025, "#c5b2df", x, 0.83, 1.397, 0.005);
bigGroup.position.set(big.x, 0, big.z);
const cubeMeshes = new Map(),
  noteMeshes = new Map();
let pickables = [floor, bigGroup, ...playground.pickables];
function clearFloorSpot(x, z, pad = 1.4) {
  const boxes = [big, ...playground.colliders()];
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
if (!read("kino-room-layout-v3", false)) {
  for (const n of notes) Object.assign(n, clearFloorSpot(n.x, n.z));
  for (const c of cubes) Object.assign(c, clearFloorSpot(c.x, c.z, 0.9));
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
const players = defs.map((p) => ({
  ...avatar(p),
  profile: normalizeProfile(p),
  x: p.x,
  z: p.z,
  y: 0,
  vy: 0,
  grounded: true,
  angle: 0,
  walk: 0,
  hit: 0,
  land: 0,
}));
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
  c.fillText("♡ " + ((n.votes || 0) + (n.voted ? 1 : 0)), 598, 748);
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
function refreshNotes() {
  for (const r of noteMeshes.values()) {
    scene.remove(r);
    pickables = pickables.filter((p) => p !== r);
    r.userData.texture.dispose();
    r.userData.front.material.dispose();
    r.userData.front.geometry.dispose();
  }
  noteMeshes.clear();
  notes.forEach(addNoteMesh);
  save();
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
  const current = renderer.getRenderTarget();
  renderer.setScissorTest(false);
  renderer.setRenderTarget(rt);
  renderer.setViewport(0, 0, 384, 384);
  renderer.render(ps, pc);
  renderer.setRenderTarget(current);
  const old = portraits.get(p.profile.id);
  old?.target.dispose();
  if (old) disposeAvatar(old.avatar);
  portraits.set(p.profile.id, { target: rt, scene: ps, camera: pc, avatar: a });
  return rt.texture;
}
players.forEach(portraitTexture);
cinema = new CinemaScreen(players, portraits);
scene.add(cinema.group);
pickables.push(cinema.group);
cinema.updateCamera(camera);
const screenGroup = cinema.group,
  screenTiles = cinema.tiles,
  featured = cinema.featured;
let pinned = null,
  camStream = null,
  micStream = null,
  displayStream = null,
  camTexture = null,
  shareTexture = null;
const cameraTextures = new Map();
function screenUpdate() {
  if (camTexture) cameraTextures.set("self", camTexture);
  else cameraTextures.delete("self");
  cinema.setMedia({
    cameras: cameraTextures,
    pinned,
    share: displayStream ? shareTexture : null,
  });
  updateShareTools();
}
function updateShareTools() {
  $("#shareTools").hidden = !displayStream;
  $("#shareScale").textContent = Math.round(cinema.shareZoom * 100) + "%";
}
screenUpdate();
const emotionEffects = new EmotionEffects(scene);
function setParticipantCount(count) {
  cinema.setCount(count);
  players.forEach(
    (player, index) => (player.root.visible = index < cinema.count),
  );
  if (players.indexOf(active) >= cinema.count) active = players[0];
  if (
    pinned &&
    !players
      .slice(0, cinema.count)
      .some((player) => player.profile.id === pinned)
  )
    pinned = null;
  screenUpdate();
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
    label = "Футбольный мяч";
    buttons =
      '<button data-context="kick">Пнуть · E</button><button data-context="move">Переместить</button><button data-context="resetBall">На исходную</button>';
  }
  if (obj.kind === "structure") {
    const structure = playground.structures.get(obj.id);
    label = structure.label;
    buttons =
      (structure.kind === "goal"
        ? `<button data-context="resetBall">Мяч на исходную · ${playground.score} гол.</button>`
        : '<button data-context="climb">Забраться</button>') +
      '<button data-context="move">Переместить</button>';
  }
  if (obj.kind === "big") {
    label = "Большой куб";
    buttons =
      '<button data-context="climb">Забраться</button><button data-context="move">Переместить</button>';
  }
  if (obj.kind === "note") {
    label = "Стикер";
    buttons =
      '<button data-context="edit">Редактировать</button><button data-context="vote">♡ Голос</button><button data-context="move">Переместить</button>';
  }
  if (obj.kind === "avatar") {
    label =
      players.find((p) => p.profile.id === obj.id)?.profile.name || "Аватар";
    buttons =
      '<button data-context="control">Управлять</button><button data-context="wave">Помахать</button><button data-context="customize">Настроить</button>';
  }
  if (["screen", "tile", "share"].includes(obj.kind)) {
    label = "Экран";
    buttons =
      (obj.kind === "tile" && !displayStream
        ? '<button data-context="pin">Закрепить</button>'
        : "") +
      '<button data-context="unpin">Все участники</button>' +
      (displayStream
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
const snowMat = new T.MeshStandardMaterial({
    color: "#faf5ff",
    roughness: 0.8,
  }),
  snowGeo = new T.SphereGeometry(0.09, 12, 10),
  particleGeo = new T.SphereGeometry(0.035, 6, 6);
function throwSnow(hit) {
  const now = performance.now();
  if (now - lastThrow < 240) return;
  lastThrow = now;
  let to = hit?.point.clone() || pointerWorld.clone();
  const targetOwner = hit && owner(hit.object);
  if (targetOwner?.userData.kind === "avatar") {
    const p = players.find((p) => p.profile.id === targetOwner.userData.id);
    to.set(p.x, p.y + 1.05, p.z);
  }
  startAction(active, "throw", worldTime, { to });
}
function releaseSnow(player, to) {
  const from = new T.Vector3(player.x, player.y + 1.08, player.z);
  if (to.distanceTo(from) < 0.6)
    to = new T.Vector3(
      player.x + Math.sin(player.angle) * 3,
      0.2,
      player.z + Math.cos(player.angle) * 3,
    );
  const direction = to.clone().sub(from);
  direction.y = 0;
  direction.normalize();
  from.addScaledVector(direction, 0.5);
  const time = clamp(from.distanceTo(to) / 19, 0.18, 0.85),
    v = to.clone().sub(from).divideScalar(time);
  v.y += 6 * time;
  const mesh = new T.Mesh(snowGeo, snowMat);
  mesh.position.copy(from);
  mesh.castShadow = true;
  scene.add(mesh);
  projectiles.push({ mesh, v, age: 0, owner: player.profile.id });
}
function burst(pos, kind) {
  for (let i = 0; i < 10; i++) {
    const m = new T.Mesh(particleGeo, snowMat);
    m.position.copy(pos);
    scene.add(m);
    particles.push({
      mesh: m,
      v: new T.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 2,
        (Math.random() - 0.5) * 3,
      ),
      age: 0,
    });
  }
  if (["cube", "ball"].includes(kind?.userData.kind)) {
    const c =
      kind.userData.kind === "ball"
        ? playground.ball
        : cubes.find((c) => c.id === kind.userData.id);
    if (c) kickCube(c, { x: active.x, z: active.z }, 3);
  }
  if (kind?.userData.kind === "avatar") {
    const p = players.find((p) => p.profile.id === kind.userData.id);
    if (p) {
      p.hit = 0.55;
      if (p.grounded) {
        p.vy = 2.1;
        p.grounded = false;
      }
    }
  }
  if (kind?.userData.kind === "note") kind.userData.wobble = 0.7;
  if (kind?.userData.kind === "screen" || kind?.userData.kind === "tile")
    screenGroup.userData.wobble = 0.35;
}
function doJump() {
  if (jump(active)) {
    active.land = 0;
    status();
  }
}
function kickNearest() {
  const near = [...cubes, playground.ball]
    .filter(
      (c) =>
        Math.hypot(c.x - active.x, c.z - active.z) < 1.6 &&
        Math.abs(c.y - active.y) < 1.1,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - active.x, a.z - active.z) -
        Math.hypot(b.x - active.x, b.z - active.z),
    )[0];
  if (near) startAction(active, "kick", worldTime, { cube: near });
  else toast("Подойдите к мячу или маленькому кубику и нажмите E", 1800);
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
    if (n) {
      n.text = text;
      n.type = $("#noteType").value;
    } else {
      if (notes.length >= 80) {
        toast("В комнате уже 80 стикеров");
        return;
      }
      const p =
        pos ||
        new T.Vector3(
          clamp(active.x + 1.8, -12, 12),
          0,
          clamp(active.z + 1, -8, 8),
        );
      Object.assign(p, clearFloorSpot(p.x, p.z));
      notes.push({
        id: uid(),
        text,
        type: $("#noteType").value,
        author: active.profile.name,
        votes: 0,
        x: p.x,
        z: p.z,
        y: 0,
      });
    }
    refreshNotes();
    $("#modal").close();
    closeContext();
  };
  if (n)
    $("#deleteNote").onclick = () => {
      notes = notes.filter((x) => x.id !== n.id);
      refreshNotes();
      $("#modal").close();
      closeContext();
    };
  setTimeout(() => $("#noteText").focus(), 60);
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
                `<article class="note-card ${t}" draggable="true" data-note="${n.id}"><button class="note-text" data-edit="${n.id}">${esc(n.text)}</button><div class="note-bottom"><span>${esc(n.author)}</span><button class="vote ${n.voted ? "selected" : ""}" data-vote="${n.id}">♡ ${(n.votes || 0) + (n.voted ? 1 : 0)}</button></div></article>`,
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
      scene.remove(p.root);
      pickables = pickables.filter((o) => o !== p.root);
      disposeAvatar(p);
      Object.assign(p, avatar(profile));
      p.profile = profile;
      p.motion = null;
      scene.add(p.root);
      pickables.push(p.root);
      portraitTexture(p);
      screenUpdate();
      save();
      $("#modal").close();
    },
    T.WebGLRenderer,
  );
}
function react(type, p = active) {
  emotionEffects.start(p, type, worldTime);
}
let timerRemaining = 300,
  timerEnd = null;
function renderTimer() {
  let n = timerEnd
    ? Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000))
    : timerRemaining;
  $("#timerText").textContent =
    String(Math.floor(n / 60)).padStart(2, "0") +
    ":" +
    String(n % 60).padStart(2, "0");
  $("#timerToggle").textContent = timerEnd ? "Ⅱ" : "▶";
  if (timerEnd && n === 0) {
    timerEnd = null;
    timerRemaining = 0;
    toast("Время вышло — обсудим идеи?");
    react("⏰");
  }
}
function timerSettings() {
  modal(
    "Таймер",
    `<form id="timerForm"><label class="field-label" for="minutes">Минуты</label><input id="minutes" type="number" min="1" max="60" value="${Math.max(1, Math.ceil(timerRemaining / 60))}" required><div class="modal-actions"><button class="primary">Запустить</button></div></form>`,
  );
  $("#timerForm").onsubmit = (e) => {
    e.preventDefault();
    timerRemaining = clamp(Number($("#minutes").value), 1, 60) * 60;
    timerEnd = Date.now() + timerRemaining * 1000;
    $("#timerIsland").hidden = false;
    renderTimer();
    $("#modal").close();
  };
}
function help() {
  modal(
    "Управление",
    `<div class="help-grid"><div><strong>Передвигаться</strong><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> или стрелки.<br><kbd>Space</kbd> — прыжок.</div><div><strong>Бросить снежок</strong>Левый клик по сцене.<br>Персонажи поворачиваются к курсору.</div><div><strong>Конструкции и футбол</strong><kbd>E</kbd> — пнуть мяч или кубик. На куб, пирамиду и катушки можно запрыгнуть или выбрать «Забраться». В воротах считаются голы.</div><div><strong>Любой объект</strong><kbd>V</kbd> — взаимодействие: клик для действий, перетаскивание для перемещения. Правая кнопка — действия в любом режиме.</div><div><strong>Стикеры на полу</strong><kbd>N</kbd> и клик по полу. По стикерам можно ходить. В режиме взаимодействия двойной клик открывает редактор.</div><div><strong>Ракурс и демонстрация</strong>Средняя кнопка + движение вверх/вниз — наклон 30–80°. Комната сохраняет масштаб. Колесо над демонстрацией увеличивает её содержимое; потяните его, чтобы рассмотреть детали.</div></div><p class="modal-text">Это локальная 3D-комната. Остальные персонажи демонстрационные; можно переключаться между ними. Данные сохраняются в этом браузере. Видео и звук пока не передаются другим людям.</p><div class="modal-actions"><button class="primary" data-action="close">В зал</button></div>`,
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
async function media(kind) {
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
        ? "Ваша камера на 3D-экране. Видео видно только вам."
        : "Микрофон включён локально. Звук не передаётся.",
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
    toast("Показ экрана включён локально");
  } catch {}
}
function exportNotes() {
  const data = {
      room: "kinō",
      exportedAt: new Date().toISOString(),
      notes: notes.map((n) => ({
        ...n,
        votes: (n.votes || 0) + (n.voted ? 1 : 0),
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
  timer: () => {
    if (timerEnd) {
      timerRemaining = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      timerEnd = null;
    } else timerEnd = Date.now() + (timerRemaining || 300) * 1000;
    renderTimer();
  },
  timerClose: () => {
    $("#timerIsland").hidden = true;
    timerEnd = null;
  },
  reaction: () =>
    modal(
      "Эмоции",
      `<div class="emotion-picker">${EMOTIONS.map(([id, emoji, label]) => `<button data-emoji="${id}" aria-label="${label}"><span>${emoji}</span><strong>${label}</strong></button>`).join("")}</div>`,
    ),
  view: () => {
    modal(
      "Ваш ракурс",
      `<div class="label-row"><label for="elevation">Угол к полу</label><span id="elevationValue">${Math.round(camElevation)}°</span></div><input id="elevation" type="range" min="30" max="80" value="${camElevation}"><div class="modal-actions"><button class="secondary" id="resetView">Вернуть 60°</button><button class="primary" data-action="close">Готово</button></div>`,
    );
    $("#elevation").oninput = (e) => {
      camElevation = +e.target.value;
      $("#elevationValue").textContent = camElevation + "°";
      updateCamera();
    };
    $("#resetView").onclick = () => {
      camElevation = 60;
      updateCamera();
      $("#modal").close();
    };
  },
  room: () => {
    modal(
      "kinō",
      `<label class="field-label" for="participantCount">Участников в демо-комнате</label><select id="participantCount">${players.map((_, i) => `<option value="${i + 1}" ${cinema.count === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select><p class="modal-text">Стикеры, кубики и ваш аватар сохраняются на этом устройстве.</p><div class="modal-actions"><button class="secondary" data-action="help">Управление</button><button class="primary" data-action="export">Скачать итоги</button></div><p class="modal-text">Локальный прототип · совместные звонки пока не подключены.</p>`,
    );
    $("#participantCount").onchange = (event) =>
      setParticipantCount(+event.target.value);
  },
};
function contextAction(action) {
  if (action === "close") {
    closeContext();
    return;
  }
  if (!selected) return;
  const { kind, id } = selected;
  if (action === "kick") {
    const c =
      kind === "ball" ? playground.ball : cubes.find((c) => c.id === id);
    pending = { type: "kick", target: c, started: worldTime };
    closeContext();
  }
  if (action === "climb") {
    const path =
      kind === "big" ? [{ x: big.x, z: big.z, h: big.h }] : playground.path(id);
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
    playground.resetBall();
    closeContext();
  }
  if (action === "move") {
    setTool("interact");
    toast("Зажмите объект и перетащите по площадке");
    closeContext();
  }
  if (action === "remove" && kind === "cube") {
    const root = cubeMeshes.get(id);
    scene.remove(root);
    pickables = pickables.filter((o) => o !== root);
    cubeMeshes.delete(id);
    cubes = cubes.filter((c) => c.id !== id);
    save();
    closeContext();
  }
  if (action === "edit") noteModal(id);
  if (action === "vote") {
    const n = notes.find((n) => n.id === id);
    n.voted = !n.voted;
    refreshNotes();
    toast(n.voted ? "Голос учтён" : "Голос снят", 1800);
  }
  if (action === "control") {
    active = players.find((p) => p.profile.id === id);
    pending = null;
    closeContext();
    status();
    toast(`Вы управляете: ${active.profile.name}`, 2000);
  }
  if (action === "wave") {
    react(
      "👋",
      players.find((p) => p.profile.id === id),
    );
    closeContext();
  }
  if (action === "customize")
    avatarModal(players.find((p) => p.profile.id === id));
  if (action === "pin") {
    if (displayStream) return;
    pinned = id;
    screenUpdate();
    closeContext();
  }
  if (action === "unpin") {
    pinned = null;
    stopShare();
    screenUpdate();
    closeContext();
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.action) actions[b.dataset.action]?.();
  if (b.dataset.tool) {
    setTool(b.dataset.tool);
    canvas.focus();
  }
  if (b.dataset.context) contextAction(b.dataset.context);
  if (b.dataset.edit) noteModal(b.dataset.edit);
  if (b.dataset.vote) {
    const n = notes.find((n) => n.id === b.dataset.vote);
    n.voted = !n.voted;
    refreshNotes();
    board();
  }
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
  if (n) {
    n.type = col.dataset.column;
    refreshNotes();
    board();
  }
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
      const c = {
        id: uid(),
        x: pos.x,
        z: pos.z,
        y: 0.36,
        size: 0.65,
        vx: 0,
        vy: 0,
        vz: 0,
        spin: 0,
        rotation: 0,
        color: ["#a696ce", "#ccad87", "#9bbbbb", "#c99ead"][cubes.length % 4],
      };
      if (inside(c.x, c.z, big)) c.y = big.h + 0.36;
      cubes.push(c);
      addCubeMesh(c);
      save();
    }
    setTool("snow");
    return;
  }
  select(o);
  if (
    o &&
    ["note", "cube", "big", "ball", "structure"].includes(o.userData.kind)
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
      orbitDrag.elevation + (e.clientY - orbitDrag.y) * 0.12,
      30,
      80,
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
      let x = clamp(pos.x + drag.offsetX, -12, 12),
        z = clamp(pos.z + drag.offsetZ, -8.5, 8.5);
      if (drag.kind === "note") {
        const n = notes.find((n) => n.id === drag.id);
        const spot = clearFloorSpot(x, z);
        x = spot.x;
        z = spot.z;
        n.x = x;
        n.z = z;
        n.y = 0;
        noteMeshes.get(n.id).position.set(x, 0.025, z);
      }
      if (["cube", "ball"].includes(drag.kind)) {
        const c =
          drag.kind === "ball"
            ? playground.ball
            : cubes.find((c) => c.id === drag.id);
        const dt = Math.max(0.01, (performance.now() - drag.lastTime) / 1000);
        c.vx = clamp((x - c.x) / dt, -10, 10);
        c.vz = clamp((z - c.z) / dt, -10, 10);
        c.x = x;
        c.z = z;
        c.y =
          Math.max(
            0,
            ...[big, ...playground.colliders()]
              .filter((b) => inside(x, z, b) && !b.y)
              .map((b) => b.h),
          ) + 0.9;
        c.vy = 0;
      }
      if (drag.kind === "big") {
        x = clamp(x, -10, 10);
        z = clamp(z, -7, 7);
        const dx = x - big.x,
          dz = z - big.z;
        for (const p of players)
          if (
            p.grounded &&
            Math.abs(p.y - big.h) < 0.01 &&
            inside(p.x, p.z, big)
          ) {
            p.x += dx;
            p.z += dz;
          }
        big.x = x;
        big.z = z;
        bigGroup.position.set(x, 0, z);
      }
      if (drag.kind === "structure") {
        x = clamp(x, -10.7, 10.7);
        z = clamp(z, -6.2, 7.3);
        const s = playground.structures.get(drag.id),
          dx = x - s.x,
          dz = z - s.z;
        for (const p of players) {
          if (
            p.grounded &&
            s.localColliders.some(
              (c) =>
                Math.abs(p.y - c.h) < 0.02 &&
                inside(p.x, p.z, { ...c, x: s.x + c.x, z: s.z + c.z }),
            )
          ) {
            p.x += dx;
            p.z += dz;
          }
        }
        playground.move(drag.id, x, z);
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
          : d.kind === "big"
            ? "Большой куб · забраться"
            : d.kind === "ball"
              ? "Мяч · тянуть / пнуть"
              : d.kind === "structure"
                ? `${playground.structures.get(d.id).label} · действия`
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
  if (drag?.moved) save();
  drag = null;
  orbitDrag = null;
  shareDrag = null;
  canvas.classList.remove("dragging");
}
canvas.addEventListener("pointerup", endDrag);
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
    if (displayStream && owner(rayAt(e)?.object)?.userData.kind === "share") {
      cinema.zoomShare(Math.exp(-e.deltaY * 0.0015));
      updateShareTools();
    }
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
  if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) doJump();
  }
  if (e.code === "KeyE" && !e.repeat) kickNearest();
  if (e.code === "KeyV") setTool("interact");
  if (e.code === "KeyX") setTool("snow");
  if (e.code === "KeyN") setTool("note");
  if (e.code === "KeyC") setTool("cube");
  if (e.code === "Escape") {
    closeContext();
    setTool("snow");
  }
});
document.addEventListener("keyup", (e) => {
  if (keyMap[e.code]) keys.delete(keyMap[e.code]);
});
window.addEventListener("blur", () => {
  keys.clear();
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
function physics(dt) {
  worldTime += dt;
  const obstacles = [big, ...playground.colliders()];
  const dynamicObjects = [...cubes, playground.ball];
  let move = $("#modal").open ? { x: 0, z: 0 } : movement();
  if (pending && !$("#modal").open) {
    const t = pending.target,
      dx = t.x - active.x,
      dz = t.z - active.z,
      dist = Math.hypot(dx, dz);
    if (worldTime - pending.started > 20) {
      pending = null;
    } else if (pending.type === "kick") {
      if (dist < 1.25) {
        startAction(active, "kick", worldTime, { cube: t });
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
    stepBody(p, p === active ? move : { x: 0, z: 0 }, obstacles, dt);
    p.velocityX = (p.x - oldX) / dt;
    p.velocityZ = (p.z - oldZ) / dt;
    if (!wasGrounded && p.grounded) p.land = 0.2;
    if (p.action) {
      const age = worldTime - p.action.started;
      if (!p.action.released && age >= p.action.release) {
        p.action.released = true;
        if (p.action.type === "throw") releaseSnow(p, p.action.payload.to);
        if (p.action.type === "kick") {
          const c = p.action.payload.cube;
          if (
            dynamicObjects.includes(c) &&
            Math.hypot(c.x - p.x, c.z - p.z) < 1.9 &&
            Math.abs(c.y - p.y) < 1.1
          )
            kickCube(c, p, 8);
        }
      }
      if (age >= p.action.duration) p.action = null;
    }
    p.hit = Math.max(0, p.hit - dt);
    p.land = Math.max(0, p.land - dt);
    for (const c of dynamicObjects) {
      if (drag?.id === c.id) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (
        d < c.size / 2 + 0.34 &&
        Math.abs(c.y - (p.y + 0.3)) < 0.55 &&
        p === active &&
        (move.x || move.z)
      ) {
        if (!c.lastKick || worldTime - c.lastKick > 0.4) {
          kickCube(c, p, 3.8);
          c.lastKick = worldTime;
        }
      }
    }
  }
  const previousBall = { ...playground.ball };
  for (const c of dynamicObjects) {
    if (drag?.moved && drag.id === c.id) continue;
    stepCube(c, obstacles, dt);
  }
  for (let i = 0; i < dynamicObjects.length; i++)
    for (let j = i + 1; j < dynamicObjects.length; j++)
      collideCubes(dynamicObjects[i], dynamicObjects[j]);
  if (drag?.kind !== "ball" && playground.checkGoal(previousBall)) {
    toast(
      `Гол! Забито: ${playground.score} · мяч можно вернуть через меню ворот`,
      3500,
    );
    react("firework");
  }
  const removal = [];
  for (const snow of projectiles) {
    const old = snow.mesh.position.clone();
    snow.age += dt;
    snow.v.y -= 12 * dt;
    snow.mesh.position.addScaledVector(snow.v, dt);
    const delta = snow.mesh.position.clone().sub(old);
    const dist = delta.length();
    raycaster.set(old, delta.normalize());
    raycaster.far = dist + 0.09;
    const hit = raycaster
      .intersectObjects(
        pickables.filter((o) => o.userData.id !== snow.owner),
        true,
      )
      .find((h) => visibleObject(h.object));
    if (hit || snow.mesh.position.y < 0.08 || snow.age > 3) {
      if (snow.age < 3)
        burst(hit?.point || snow.mesh.position, hit && owner(hit.object));
      removal.push(snow);
    }
  }
  raycaster.far = Infinity;
  for (const s of removal) {
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
function visual(dt) {
  for (const p of players) {
    p.root.position.set(p.x, p.y, p.z);
    const desired = Math.atan2(pointerWorld.x - p.x, pointerWorld.z - p.z),
      delta = Math.atan2(
        Math.sin(desired - p.angle),
        Math.cos(desired - p.angle),
      );
    p.angle += delta * (1 - Math.exp(-10 * dt));
    p.root.rotation.y = p.angle;
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
        seed: p.x * 0.13,
        lookPitch: clamp(
          1.3 /
            Math.max(2, Math.hypot(pointerWorld.x - p.x, pointerWorld.z - p.z)),
          0,
          0.18,
        ),
      },
      dt,
    );
  }
  for (const c of cubes) {
    const m = cubeMeshes.get(c.id);
    m.position.set(c.x, c.y, c.z);
    m.rotation.y = c.rotation;
    m.rotation.z =
      Math.abs(c.vx) + Math.abs(c.vz) > 0.3 ? Math.sin(c.rotation) * 0.11 : 0;
  }
  for (const m of noteMeshes.values()) {
    m.userData.wobble = Math.max(0, (m.userData.wobble || 0) - dt);
    m.userData.pivot.rotation.z =
      Math.sin(m.userData.wobble * 38) * m.userData.wobble * 0.13;
  }
  playground.update(dt);
  ring.position.set(
    active.x,
    (active.grounded
      ? active.y
      : Math.max(
          0,
          ...[big, ...playground.colliders()]
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
      renderer.setViewport(0, 0, 384, 384);
      renderer.render(portrait.scene, portrait.camera);
    }
    renderer.setRenderTarget(null);
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.render(scene, camera);
  avatarEditor?.update(worldTime, dt);
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
  drawRoom(dt);
  requestAnimationFrame(frame);
}
setInterval(() => {
  renderTimer();
  status();
}, 250);
requestAnimationFrame(frame);
$("#loading").classList.add("hidden");
setTimeout(() => $("#loading").remove(), 600);
toast("WASD / стрелки — движение · Space — прыжок · клик — снежок", 6500);
status();
