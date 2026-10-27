import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import * as Three from "three";
import * as avatarModule from "../dist/avatars.js";
import * as physics from "../dist/physics.js";
import * as animationModule from "../dist/animation.js";
import * as layoutModule from "../dist/layout.js";
import * as emotionModule from "../dist/emotions.js";
import * as cinemaModule from "../dist/cinema.js";
import * as editorModule from "../dist/avatar-editor.js";
import * as roomModule from "../dist/room.js";
import * as playgroundModule from "../dist/playground.js";
import * as worldModule from "../dist/world.js";
import * as stateModule from "../dist/state.js";
import * as netModule from "../dist/net.js";
import * as mediaModule from "../dist/media.js";
import * as configModule from "../dist/config.js";
// Integration harness: real Three.js scene graph, geometry and raycasts; GPU draw calls only are mocked.
const html = fs.readFileSync(
  new URL("../dist/index.html", import.meta.url),
  "utf8",
);
// The demo room the old single-player prototype showed: five colleagues and six stickers.
// Tests run against a small in-process stand-in for the sync server that applies the same
// state operations (state.js) and answers synchronously.
const DEMO_PEERS = [
  { id: "anya", profile: { name: "Аня", color: "#d99e86", skin: "#ecc0a6", hat: "bun" }, pose: { x: -9, z: 2 } },
  { id: "max", profile: { name: "Макс", color: "#9eb493", skin: "#bd8f70", hat: "cap" }, pose: { x: 5.8, z: -0.8 } },
  { id: "lena", profile: { name: "Лена", color: "#c69eaf", skin: "#edbda1", hat: "long" }, pose: { x: -6, z: 6 } },
  { id: "dima", profile: { name: "Дима", color: "#89a4bf", skin: "#d7a17d", hat: "glasses" }, pose: { x: 8.8, z: 5.3 } },
  { id: "sonya", profile: { name: "Соня", color: "#bcae8b", skin: "#e4b59b", hat: "short", outfit: "suit" }, pose: { x: -11, z: -5.5 } },
].map((p) => ({ ...p, pose: { y: 0, a: 0, vy: 0, g: 1, ...p.pose } }));
const DEMO_NOTES = [
  ["Классно выкатили новый онбординг 🚀", "good", "Аня", -10.5, -0.3],
  ["Помогаем друг другу с ревью", "good", "Макс", -3.8, 4.8],
  ["Меньше встреч без повестки", "improve", "Лена", -0.8, -5.8],
  ["Больше времени на тестирование", "improve", "Дима", 2.5, 5],
  ["Пятничные демо команды ✨", "idea", "Аня", 10.5, 2],
  ["Попробовать день без встреч", "idea", "Макс", 0.1, 8],
].map(([text, type, author, x, z], i) => ({ id: "note-" + i, text, type, author, votes: (i % 3) + 1, voters: [], x, z }));
function fakeServer(peers, notes) {
  let n = 0;
  const newId = () => "srv-" + ++n;
  const state = stateModule.createState({ notes: structuredClone(notes) }, newId);
  const server = { sent: [], state, socket: null, uid: null, clock: () => 0 };
  server.emit = (m) => server.socket.onmessage({ data: JSON.stringify(m) });
  server.of = (t) => server.sent.filter((m) => m.t === t);
  server.Socket = class {
    constructor(url) {
      this.url = url;
      this.readyState = 1;
      server.socket = this;
    }
    send(data) {
      const m = JSON.parse(data);
      server.sent.push(m);
      if (m.t === "hello") {
        server.uid = m.uid;
        server.emit({
          t: "welcome", id: "me", uid: m.uid, room: m.room, s: server.clock(),
          you: { pose: { x: -2.8, y: 0, z: 1.3, a: 0, vy: 0, g: 1 } },
          peers: structuredClone(peers),
          state: stateModule.serializeState(state),
          objs: stateModule.dynamicObjects(state).map(stateModule.packObject),
          rtc: null,
        });
      } else if (m.t === "ping") server.emit({ t: "pong", c: m.c, s: server.clock() });
      else if (stateModule.STATE_OPS.has(m.t)) {
        const r = stateModule.applyOp(state, m, { uid: server.uid, peer: "me", name: "Вы", now: server.clock(), newId });
        if (r) for (const o of r.out) if (!o.others) server.emit(o.msg);
      }
    }
    close() {
      this.readyState = 3;
    }
  };
  return server;
}
function boot({ pixelRatio = 1, offline = false, peers = DEMO_PEERS, notes = DEMO_NOTES } = {}) {
  const dom = new JSDOM(html, { url: "https://kino.test/cine/?r=test-room" }),
    w = dom.window;
  w.localStorage.setItem("kino-avatar-v1", JSON.stringify({ name: "Тестер", color: "#ae92d6", skin: "#e4b59b", hat: "headphones" }));
  const server = offline ? null : fakeServer(peers, notes);
  Object.defineProperty(w, "devicePixelRatio", { value: pixelRatio });
  let now = 0,
    raf;
  const canvasContext = {
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    fillRect() {},
    fillText() {},
    createImageData(width, height) {
      return { data: new Uint8ClampedArray(width * height * 4) };
    },
    putImageData() {},
    measureText(t) {
      return {
        width:
          t.length *
          (parseFloat(this.font.match(/([0-9.]+)px/)?.[1]) || 30) *
          0.53,
      };
    },
  };
  w.HTMLCanvasElement.prototype.getContext = () => canvasContext;
  w.HTMLCanvasElement.prototype.toDataURL = () =>
    "data:image/png;base64,iVBORw0KGgo=";
  w.HTMLCanvasElement.prototype.setPointerCapture = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event("close"));
  };
  class Renderer {
    constructor() {
      this.shadowMap = {};
      this.capabilities = { getMaxAnisotropy: () => 8 };
      this.target = null;
      this.ratio = 1;
      this.offscreenDraws = [];
    }
    setPixelRatio(value) {
      this.ratio = value;
    }
    setSize(width, height) {
      this.setViewport(0, 0, width, height);
    }
    setViewport(...rect) {
      this.viewport = rect.map((v) => v * this.ratio);
      this.defaultViewport = this.viewport;
    }
    setScissor() {}
    setScissorTest() {}
    dispose() {
      this.disposed = true;
    }
    getRenderTarget() {
      return this.target;
    }
    setRenderTarget(t) {
      this.target = t;
      this.viewport = t ? [0, 0, t.width, t.height] : this.defaultViewport;
    }
    readRenderTargetPixels(target, x, y, width, height, pixels) {
      pixels.fill(128);
    }
    render(s, c) {
      s.updateMatrixWorld(true);
      c.updateMatrixWorld(true);
      if (this.target) {
        this.offscreenDraws.push({
          width: this.target.width,
          height: this.target.height,
          viewport: [...this.viewport],
        });
        if (this.offscreenDraws.length > 64) this.offscreenDraws.shift();
      }
    }
  }
  const sandbox = {
    window: w,
    location: w.location,
    history: w.history,
    document: w.document,
    localStorage: w.localStorage,
    navigator: w.navigator,
    innerWidth: 1363,
    innerHeight: 936,
    devicePixelRatio: pixelRatio,
    performance: { now: () => now },
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval() {},
    clearInterval() {},
    requestAnimationFrame: (f) => (raf = f),
    console,
    THREE: { ...Three, WebGLRenderer: Renderer },
    ...avatarModule,
    ...physics,
    ...animationModule,
    ...layoutModule,
    ...emotionModule,
    ...cinemaModule,
    ...editorModule,
    ...roomModule,
    ...playgroundModule,
    ...worldModule,
    ...stateModule,
    ...netModule,
    ...mediaModule,
    ...configModule,
    Blob: w.Blob,
    URL,
    crypto: globalThis.crypto,
    ...(server ? { WebSocket: server.Socket } : {}),
  };
  const context = vm.createContext(sandbox);
  let source = fs
    .readFileSync(new URL("../dist/app.js", import.meta.url), "utf8")
    .replace(/^import[\s\S]*?;\n/gm, "");
  vm.runInContext("const T=THREE;\n" + source, context, { timeout: 5000 });
  const run = (s) => vm.runInContext(s, context);
  if (server) {
    server.clock = () => run("net.serverNow()");
    server.socket.onopen();
  }
  const tick = (seconds = 1) => {
    for (let i = 0; i < seconds * 120; i++) {
      now += 1000 / 120;
      raf(now);
    }
  };
  const pointer = (type, x, y, button = 0) =>
    w.document.querySelector("#world").dispatchEvent(
      new w.MouseEvent(type, {
        clientX: x,
        clientY: y,
        button,
        bubbles: true,
      }),
    );
  return { w, run, tick, pointer, server };
}
test("scene boot builds real meshes and a full viewport perspective camera", () => {
  const a = boot();
  assert.equal(a.run("camera.isPerspectiveCamera"), true);
  assert.equal(a.run("players.length"), 6);
  assert(a.run("players[0].knees[0].parent === players[0].legs[0]"));
  assert(a.run("players[0].elbows[0].parent === players[0].arms[0]"));
  assert.equal(a.run("noteMeshes.size"), 6);
  assert.equal(a.run("bigGroup.children[0].geometry.isBufferGeometry"), true);
  assert(a.run("cinema.group.parent === scene"));
  assert(a.run("cinema.scene === undefined"));
  assert.equal(a.w.document.querySelector("header"), null);
  a.tick(0.2);
});

test("Retina renders portraits and gallery thumbnails into their full target without double scaling", () => {
  const a = boot({ pixelRatio: 2 });
  a.run("avatarModal()");
  a.tick(0.02);
  const portraits = a.run("renderer.offscreenDraws");
  assert(portraits.length >= 6);
  for (const draw of portraits)
    assert.deepEqual(Array.from(draw.viewport), [0, 0, 384, 384]);
  const thumbnails = a.run("avatarEditor.renderer.offscreenDraws");
  assert(thumbnails.length > 0);
  for (const draw of thumbnails)
    assert.deepEqual(Array.from(draw.viewport), [0, 0, 160, 176]);
  assert.equal(a.run("avatarEditor.renderer.getRenderTarget()"), null);
  assert.deepEqual(
    Array.from(a.run("avatarEditor.renderer.viewport")),
    [0, 0, 720, 1000],
  );
  assert(
    a.w.document
      .querySelector('[data-look-thumbnail="six"]')
      .src.startsWith("data:image/png"),
  );
  const renderer = a.run("avatarEditor.renderer");
  a.run('$("#modal").close()');
  assert.equal(renderer.disposed, true);
});

test("character gallery filters, previews, saves and cancels while preserving participant identity", () => {
  const a = boot(),
    d = a.w.document;
  a.run("avatarModal()");
  assert.equal(d.querySelectorAll("[data-look]").length, 25);
  const name = d.querySelector("#avatarName");
  name.value = "Аня";
  name.dispatchEvent(new a.w.Event("input", { bubbles: true }));
  d.querySelector('[data-look-category="creatures"]').click();
  assert.equal(d.querySelectorAll("[data-look]").length, 5);
  const search = d.querySelector("#lookSearch");
  search.value = "волк";
  search.dispatchEvent(new a.w.Event("input", { bubbles: true }));
  assert.equal(d.querySelectorAll("[data-look]").length, 1);
  assert.equal(d.querySelector("#lookSearch"), search);
  d.querySelector('[data-look="wolf"]').click();
  assert.equal(a.run("avatarEditor.rig.root.userData.character"), "wolf");
  assert.equal(a.run("avatarEditor.draft.name"), "Аня");
  d.querySelector('[data-editor-tab="head"]').click();
  d.querySelector('[data-choice="headwear"][data-value="cap"]').click();
  const save = () =>
    d
      .querySelector("#avatarForm")
      .dispatchEvent(
        new a.w.Event("submit", { bubbles: true, cancelable: true }),
      );
  save();
  const saved = JSON.parse(a.w.localStorage.getItem("kino-avatar-v1"));
  assert.equal(saved.character, "wolf");
  assert.equal(saved.headwear, "cap");
  assert.equal(saved.name, "Аня");
  assert.equal(saved.id, "self");
  assert.equal(
    a.run("portraits.get('self').avatar.root.userData.character"),
    "wolf",
  );
  a.run("avatarModal()");
  d.querySelector('[data-look="lego-boy"]').click();
  a.run('$("#modal").close()');
  assert.equal(a.run("active.profile.character"), "wolf");
  assert.deepEqual(
    JSON.parse(a.w.localStorage.getItem("kino-avatar-v1")),
    saved,
  );
  a.run("avatarModal()");
  d.querySelector('[data-look="everyday"]').click();
  save();
  assert.equal(a.run("active.profile.character"), null);
  assert.equal(a.run("active.profile.name"), "Аня");
  assert.equal(a.run("active.profile.id"), "self");
});

test("mouse click creates ballistic snow; keyboard moves and Space jumps", () => {
  const a = boot();
  a.tick(0.1);
  a.pointer("pointerdown", 1000, 500);
  a.tick(0.12);
  assert.equal(a.run("projectiles.length"), 1);
  a.w.document.dispatchEvent(
    new a.w.KeyboardEvent("keydown", { code: "KeyD", bubbles: true }),
  );
  a.tick(0.4);
  a.w.document.dispatchEvent(new a.w.KeyboardEvent("keyup", { code: "KeyD" }));
  assert(a.run("active.x") > -2);
  a.w.document.dispatchEvent(
    new a.w.KeyboardEvent("keydown", { code: "Space" }),
  );
  a.tick(0.25);
  assert(a.run("active.y") > 1.5);
  a.tick(1);
  assert.equal(a.run("active.y"), 0);
  assert.equal(a.run("active.grounded"), true);
});
test("cursor causes volumetric avatars to rotate", () => {
  const a = boot();
  a.tick(0.1);
  a.pointer("pointermove", 1100, 700);
  a.tick(0.2);
  assert(a.run("active.root.rotation.y") > 0.1);
  // Others face where their owners look: the angle arrives with their pose.
  const s = a.run("net.serverNow()");
  a.server.emit({ t: "pose", id: "anya", s, x: -9, y: 0, z: 2, a: 1.2, vy: 0, g: 1 });
  a.tick(0.4);
  assert(Math.abs(a.run("players[1].root.rotation.y") - 1.2) < 0.01);
});
test("large cube climb action reaches its top", () => {
  const a = boot();
  a.run("selected={kind:'big',id:'big'};contextAction('climb')");
  a.tick(4);
  assert.equal(a.run("active.y"), 1.65);
  assert.equal(a.run("active.grounded"), true);
  assert.equal(a.run("pending"), null);
});
test("screen picking uses actual 3D triangle intersections", () => {
  const a = boot();
  a.tick(0.1);
  const coords = a.run(
    "(()=>{const r=screenTiles[1].geometry.userData.rect;const p=screenPoint(r.x+r.width/2,r.y+r.height/2,.035);const v=new T.Vector3(p.x,p.y,p.z).project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2}})()",
  );
  a.pointer("pointerdown", coords.x, coords.y, 2);
  assert.equal(a.run("selected.kind"), "tile");
  assert.equal(a.run("selected.id"), "anya");
  a.run("contextAction('pin')");
  assert.equal(a.run("featured.visible"), true);
  assert.equal(a.run("screenTiles.some(m=>m.visible)"), false);
});
test("sticker editor goes through the server and its answer creates a real 3D panel", () => {
  const a = boot();
  const submit = (text) => {
    a.run("noteModal()");
    a.w.document.querySelector("#noteText").value = text;
    a.w.document
      .querySelector("#noteForm")
      .dispatchEvent(new a.w.Event("submit", { bubbles: true, cancelable: true }));
  };
  submit("Проверка объёмного стикера");
  assert.equal(a.server.of("note.add").length, 1);
  assert.equal(a.server.of("note.add")[0].text, "Проверка объёмного стикера");
  assert.equal(a.run("notes.length"), 7);
  assert.equal(a.run("noteMeshes.size"), 7);
  assert.equal(a.run("notes.at(-1).author"), "Вы", "author comes from the server");
  // Offline the same editor works locally and the room is cached in this browser.
  const b = boot({ offline: true });
  assert.equal(b.run("net.status"), "offline");
  b.run("noteModal()");
  b.w.document.querySelector("#noteText").value = "Без сервера";
  b.w.document
    .querySelector("#noteForm")
    .dispatchEvent(new b.w.Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(b.run("notes.length"), 1);
  assert.equal(b.run("noteMeshes.size"), 1);
  const cached = JSON.parse(b.w.localStorage.getItem("kino-room-v3:test-room"));
  assert.equal(cached.notes[0].text, "Без сервера");
});

test("interaction mode drags a volumetric note and persists its position", () => {
  const a = boot();
  a.tick(0.1);
  a.run("setTool('interact')");
  const p = a.run(
    "(()=>{const p=noteMeshes.values().next().value.userData.front.getWorldPosition(new T.Vector3()).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}})()",
  );
  const before = a.run("notes[0].x");
  a.pointer("pointerdown", p.x, p.y);
  assert.equal(a.run("drag.kind"), "note");
  a.pointer("pointermove", p.x + 100, p.y);
  a.pointer("pointerup", p.x + 100, p.y);
  assert(a.run("notes[0].x") > before + 1);
  const moves = a.server.of("note.move");
  assert(moves.length >= 1, "moves stream to the server while dragging");
  assert.equal(moves.at(-1).x, a.run("notes[0].x"), "the final position is sent on release");
  assert.equal(a.server.state.notes[0].x, a.run("notes[0].x"));
});
test("interaction mode can drag a small cube and release it into physics", () => {
  const a = boot();
  a.tick(0.1);
  a.run("setTool('interact')");
  const p = a.run(
    "(()=>{const p=cubeMeshes.values().next().value.getWorldPosition(new T.Vector3()).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}})()",
  );
  const before = a.run("cubes[0].x");
  a.pointer("pointerdown", p.x, p.y);
  assert.equal(a.run("drag.kind"), "cube");
  a.pointer("pointermove", p.x + 80, p.y);
  a.pointer("pointerup", p.x + 80, p.y);
  assert(a.run("cubes[0].x") > before);
  a.tick(3);
  assert(Number.isFinite(a.run("cubes[0].x")));
  assert.equal(a.run("cubes[0].y"), 0.325);
});

test("enabling a camera preserves the square grid and applies cover UVs", () => {
  const a = boot();
  a.tick(0.1);
  const before = a.run("screenTiles[0].geometry");
  a.run(
    "camTexture=new T.Texture({videoWidth:1920,videoHeight:1080});screenUpdate()",
  );
  assert.equal(a.run("screenTiles[0].geometry"), before);
  assert.equal(a.run("screenTiles[0].material.map.repeat.x"), 1080 / 1920);
  assert.equal(a.run("screenTiles[0].material.map.repeat.y"), 1);
  assert.equal(a.run("screenTiles.filter(t=>t.visible).length"), 6);
});

test("sharing moves all participants to the sides, preserving cameras, and restores the wall grid", () => {
  const a = boot();
  a.run(
    "camTexture=new T.Texture({videoWidth:1920,videoHeight:1080});screenUpdate()",
  );
  const cameraMap = a.run("screenTiles[0].material.map");
  a.run(
    "shareTexture=new T.Texture({videoWidth:1920,videoHeight:1080});displayStream={};screenUpdate()",
  );
  assert.equal(a.run("screenTiles.filter(t=>t.visible).length"), 6);
  assert(
    a.run("screenTiles.every(t=>Math.abs(t.position.x)>ROOM.wallWidth/2)"),
  );
  assert(a.run("screenTiles.filter(t=>t.userData.side==='left').length===3"));
  assert(a.run("featured.visible"));
  assert.equal(a.run("screenTiles[0].material.map"), cameraMap);
  a.run("displayStream=null;screenUpdate()");
  assert.equal(a.run("screenTiles.filter(t=>t.visible).length"), 6);
  assert(a.run("screenTiles.every(t=>t.position.x===0 && !t.userData.side)"));
  assert.equal(a.run("screenTiles[0].material.map"), cameraMap);
});

test("tiles are square patches of the room's genuinely spherical wall", () => {
  const a = boot();
  a.tick(0.1);
  assert.equal(a.run("screenTiles.length"), 6);
  const stats =
    a.run(`(()=>{const g=screenTiles[0].geometry,p=g.attributes.position;
 const zs=Array.from({length:p.count},(_,i)=>p.getZ(i));
 const rect=g.userData.rect;
 return {depth:Math.max(...zs)-Math.min(...zs),ratio:rect.width/rect.height};})()`);
  assert(stats.depth > 0.01);
  assert.equal(stats.ratio, 1);
});

test("default floor camera keeps the front feet and rear jump inside its viewport", () => {
  const a = boot();
  const projection = a.run(
    "({front:new T.Vector3(0,0,9.5).project(camera).y,rear:new T.Vector3(0,3.8,-9.5).project(camera).y})",
  );
  assert(projection.front >= -1);
  assert(projection.rear <= 1);
});

test("kick has anticipation and applies its impulse at foot contact", () => {
  const a = boot();
  a.run("cubes[0].x=active.x+1;cubes[0].z=active.z;kickNearest()");
  assert.equal(a.run("active.action.type"), "kick");
  a.tick(0.07);
  assert.equal(a.run("cubes[0].vx"), 0);
  a.tick(0.08);
  assert(a.run("cubes[0].vx") > 0);
  assert(a.run("active.knees[1].rotation.x") > 0);
});

test("each requested emotion drives a pose and an actual 3D effect", () => {
  const a = boot();
  for (const [emotion] of emotionModule.EMOTIONS) {
    a.run(`react('${emotion}')`);
    a.tick(0.4);
    assert.equal(a.run("active.emote.type"), emotion);
    assert(a.run("emotionEffects.effects[0].group.children.length") > 0);
  }
  a.tick(4.2);
  assert.equal(a.run("emotionEffects.effects.length"), 0);
  assert.equal(a.run("active.emote"), null);
});

test("avatar editor previews equipment live and cancellation preserves the avatar", () => {
  const a = boot();
  const before = a.run("active.profile");
  a.run("avatarModal()");
  a.w.document.querySelector('[data-editor-tab="head"]').click();
  a.w.document
    .querySelector('[data-choice="hairstyle"][data-value="flame"]')
    .click();
  a.tick(0.2);
  assert(a.run("avatarEditor.rig.flames.length") > 0);
  assert.equal(a.run("active.profile"), before);
  a.run('$("#modal").close()');
  assert.equal(a.run("avatarEditor"), null);
  assert.equal(a.run("active.profile"), before);
});

test("RPG preset and subsequent customization save without changing participant identity", () => {
  const a = boot();
  a.run("avatarModal()");
  a.w.document.querySelector('[data-look="wildwest"]').click();
  a.w.document.querySelector('[data-editor-tab="head"]').click();
  a.w.document
    .querySelector('[data-choice="headwear"][data-value="bear"]')
    .click();
  assert.equal(a.w.document.querySelector('[data-choice="mask"]'), null);
  a.w.document
    .querySelector("#avatarForm")
    .dispatchEvent(
      new a.w.Event("submit", { bubbles: true, cancelable: true }),
    );
  assert.equal(a.run("active.profile.id"), "self");
  assert.equal(a.run("active.profile.headwear"), "bear");
  assert.equal(
    JSON.parse(a.w.localStorage.getItem("kino-avatar-v1")).headwear,
    "bear",
  );
  assert.equal(a.run("avatarEditor"), null);
  a.tick(0.1);
});

test("angle moves one camera on a fixed radius; room wheel cannot zoom", () => {
  const a = boot();
  const distance = a.run("camera.position.distanceTo(ROOM_TARGET)");
  for (const angle of [30, 60, 80]) {
    a.run(`camElevation=${angle};updateCamera()`);
    assert(
      Math.abs(a.run("camera.position.distanceTo(ROOM_TARGET)") - distance) <
        1e-9,
    );
    assert.equal(a.run("camera.aspect"), 1363 / 936);
  }
  const position = a.run("camera.position.clone()");
  a.w.document
    .querySelector("#world")
    .dispatchEvent(
      new a.w.WheelEvent("wheel", { deltaY: -500, clientX: 600, clientY: 600 }),
    );
  assert(a.run("camera.position").equals(position));
  a.run("actions.view()");
  assert.equal(a.w.document.querySelector("#elevation").max, "80");
  assert.equal(a.w.document.querySelector("#zoom"), null);
});

test("share zoom and pan change only content and reset on stop", () => {
  const a = boot();
  const position = a.run("camera.position.clone()");
  a.run(
    "shareTexture=new T.Texture({videoWidth:1920,videoHeight:1080});displayStream={};screenUpdate();cinema.zoomShare(2);cinema.panShare(.1,.1)",
  );
  assert.equal(a.run("cinema.shareMap.repeat.x"), 0.5);
  assert(a.run("cinema.shareMap.offset.x") < 0.25);
  assert.equal(a.run("shareTexture.repeat.x"), 1);
  assert(a.run("camera.position").equals(position));
  a.run("displayStream=null;screenUpdate()");
  assert.equal(a.run("cinema.shareZoom"), 1);
  assert.equal(a.w.document.querySelector("#shareTools").hidden, true);
});

test("notes lie flat and characters can walk straight across them", () => {
  const a = boot();
  a.run(
    "notes[0].x=0;notes[0].z=5;refreshNotes();active.x=0;active.z=7;keys.add('up')",
  );
  a.tick(0.7);
  assert(a.run("active.z") < 4);
  assert.equal(a.run("active.y"), 0);
  assert.equal(
    a.run("noteMeshes.values().next().value.userData.pivot.rotation.x"),
    -Math.PI / 2,
  );
  assert(
    a.run(
      "new T.Box3().setFromObject(noteMeshes.values().next().value).getSize(new T.Vector3()).y",
    ) < 0.08,
  );
});

test("climb actions reach the pyramid summit and each spool", () => {
  for (const [id, height] of [
    ["pyramid", 2.56],
    ["spool-a", 1.55],
    ["spool-b", 1.9],
  ]) {
    const a = boot();
    a.run(`selected={kind:'structure',id:'${id}'};contextAction('climb')`);
    a.tick(12);
    assert.equal(a.run("pending"), null, id);
    assert(
      Math.abs(a.run("active.y") - height) < 0.001,
      `${id}: ${a.run("active.y")}`,
    );
    assert(a.run("active.grounded"));
  }
});

test("football can be kicked, rolls, scores once and resets through goal action", () => {
  // Offline the browser referees; online the server does (see the multiplayer tests).
  const a = boot({ offline: true });
  a.run(
    "Object.assign(active,{x:8.1,z:-2.8,y:0});Object.assign(playground.ball,{x:8.1,z:-3.8,y:.42});kickNearest()",
  );
  a.tick(0.07);
  assert.equal(a.run("playground.ball.vz"), 0);
  a.tick(0.8);
  assert.equal(a.run("playground.score"), 1);
  assert(
    a.run("playground.ballMesh.quaternion.angleTo(new T.Quaternion())") > 0.1,
  );
  a.tick(1);
  assert.equal(a.run("playground.score"), 1);
  a.run("selected={kind:'structure',id:'goal'};contextAction('resetBall')");
  assert.equal(a.run("playground.ball.z"), a.run("playground.goal.z+4.3"));
});

// ——— Multiplayer client ———
test("remote participants join, move smoothly from their poses and leave", () => {
  const a = boot({ peers: [] });
  assert.equal(a.run("players.length"), 1);
  a.server.emit({ t: "join", id: "oleg", profile: { name: "Олег", color: "#88aacc" }, pose: { x: 0, y: 0, z: 3, a: 0, vy: 0, g: 1 } });
  assert.equal(a.run("players.length"), 2);
  assert.equal(a.run("screenTiles.length"), 2);
  assert.equal(a.run("players[1].profile.name"), "Олег");
  assert.equal(a.run("players[1].label.parent === players[1].root"), true, "name tag above the head");
  // Poses 1/30 s apart: rendering stays between samples, never jumps to the newest one.
  const t0 = a.run("net.serverNow()");
  // 15 steps of walking, then the samples a stopped avatar keeps sending for a moment.
  for (let i = 0; i <= 20; i++)
    a.server.emit({ t: "pose", id: "oleg", s: t0 + i * 33, x: Math.min(i, 15) * 0.17, y: 0, z: 3, a: 0, vy: 0, g: 1 });
  const xs = [];
  for (let i = 0; i < 60; i++) {
    a.tick(1 / 60);
    xs.push(a.run("players[1].x"));
  }
  for (let i = 1; i < xs.length; i++) assert(xs[i] >= xs[i - 1] - 1e-9, "monotonic motion");
  assert(Math.max(...xs.slice(1).map((x, i) => x - xs[i])) < 0.12, "no jumps between frames");
  assert(Math.abs(xs.at(-1) - 15 * 0.17) < 0.01, "ends exactly where the owner stopped");
  assert(a.run("players[1].velocityX") >= 0);
  a.server.emit({ t: "profile", id: "oleg", profile: { name: "Олег П.", color: "#88aacc" } });
  assert.equal(a.run("players[1].profile.name"), "Олег П.");
  a.server.emit({ t: "leave", id: "oleg" });
  assert.equal(a.run("players.length"), 1);
  assert.equal(a.run("screenTiles.length"), 1);
  assert.equal(a.run("portraits.has('oleg')"), false);
});

test("your avatar streams poses at up to 30 per second and idles at one per second", () => {
  const a = boot({ peers: [] });
  a.tick(0.5);
  a.server.sent.length = 0;
  a.run("keys.add('right')");
  a.tick(1);
  const moving = a.server.of("pose").length;
  assert(moving >= 27 && moving <= 31, `poses while moving: ${moving}`);
  a.run("keys.delete('right')");
  a.tick(0.5);
  a.server.sent.length = 0;
  a.tick(3);
  const idle = a.server.of("pose").length;
  assert(idle >= 2 && idle <= 4, `heartbeat poses while idle: ${idle}`);
  const last = a.server.of("pose").at(-1);
  assert.equal(last.x, Math.round(a.run("active.x") * 1000) / 1000);
});

test("kicks are predicted instantly and confirmed by the server; corrections blend smoothly", () => {
  const a = boot({ peers: [] });
  a.run("cubes[0].x=active.x+1;cubes[0].z=active.z;cubes[0].y=0.325;kickNearest()");
  assert.equal(a.server.of("act").at(-1).k, "kick", "others see the kick animation");
  a.tick(0.3);
  const kick = a.server.of("obj.kick").at(-1);
  assert.equal(kick.id, a.run("cubes[0].id"));
  assert.equal(kick.power, 8);
  assert(a.run("Math.abs(cubes[0].vx)") > 1, "moves before the server answers");
  // The server's state differs a little: position snaps logically, the mesh eases over.
  const c = a.run("({id:cubes[0].id,x:cubes[0].x,z:cubes[0].z})");
  a.server.emit({ t: "objs", s: a.run("net.serverNow()"), o: [[c.id, c.x + 0.3, 0.325, c.z, 0, 0, 0, 0, 0]] });
  assert(Math.abs(a.run("cubes[0].x") - (c.x + 0.3)) < 1e-6);
  assert(Math.abs(a.run("cubes[0].ox") + 0.3) < 1e-6, "visual offset hides the correction");
  a.tick(0.5);
  assert(Math.abs(a.run("cubes[0].ox")) < 0.01, "offset decays");
  assert(Math.abs(a.run("cubeMeshes.get(cubes[0].id).position.x") - a.run("cubes[0].x")) < 0.01);
});

test("server announces goals, shared timer and votes; remote throws and emotions play locally", () => {
  const a = boot();
  a.server.emit({ t: "goal", score: 3, by: "anya" });
  assert.equal(a.run("playground.score"), 3);
  assert.match(a.w.document.querySelector("#toast").textContent, /Аня/);
  a.run("actions.timer()");
  assert.equal(a.server.of("timer.toggle").length, 1);
  assert.equal(a.w.document.querySelector("#timerIsland").hidden, false);
  assert.equal(a.run("world.timer.running"), true);
  const id = a.run("notes[0].id");
  a.run(`contextAction.call(null,'close');selected={kind:'note',id:'${id}'};contextAction('vote')`);
  assert.equal(a.run(`votedByMe(notes[0])`), true);
  assert.equal(a.run(`voteCount(notes[0])`), 2);
  const s = a.run("net.serverNow()");
  a.server.emit({ t: "act", id: "max", s, k: "throw", to: [0, 0.2, 3] });
  a.server.emit({ t: "act", id: "lena", s, k: "emote", e: "heart" });
  a.tick(0.5);
  assert(a.run("projectiles.length + particles.length") > 0, "remote snowball flies in your scene");
  assert.equal(a.run("players.find(p=>p.profile.id==='lena').emote.type"), "heart");
});

test("room link, presence chip and media fallbacks", () => {
  const a = boot();
  a.tick(0.1);
  a.run("renderPresence()");
  assert.equal(a.w.document.querySelector("#netStatus").dataset.state, "online");
  assert.match(a.w.document.querySelector("#netStatus").textContent, /6 участников/);
  a.run("roomModal()");
  assert.match(a.w.document.querySelector("#roomLink").value, /\?r=test-room$/);
  assert.equal(a.w.document.querySelectorAll(".people li").length, 6);
  // Remote camera and screen tracks become textures on the right tile / the wall.
  const video = a.w.document.createElement("video");
  Object.defineProperty(video, "videoWidth", { value: 1280 });
  Object.defineProperty(video, "videoHeight", { value: 720 });
  a.run("onVideo")("max", "camera", video);
  assert(a.run("cameraTextures.has('max')"));
  a.run("onVideo")("dima", "screen", video);
  assert.equal(a.run("featured.visible"), true);
  assert.equal(a.run("cinema.media.share === liveVideo.screen.get('dima').texture"), true);
  a.server.emit({ t: "leave", id: "dima" });
  assert.equal(a.run("featured.visible"), false, "share disappears with its owner");
});
