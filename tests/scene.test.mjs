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
// Integration harness: real Three.js scene graph, geometry and raycasts; GPU draw calls only are mocked.
const html = fs.readFileSync(
  new URL("../dist/index.html", import.meta.url),
  "utf8",
);
function boot() {
  const dom = new JSDOM(html, { url: "https://kino.test/" }),
    w = dom.window;
  let now = 0,
    raf;
  const canvasContext = {
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    fillRect() {},
    fillText() {},
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
    }
    setPixelRatio() {}
    setSize() {}
    setViewport(...rect) {
      this.viewport = rect;
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
    }
    render(s, c) {
      s.updateMatrixWorld(true);
      c.updateMatrixWorld(true);
    }
  }
  const sandbox = {
    window: w,
    document: w.document,
    localStorage: w.localStorage,
    navigator: w.navigator,
    innerWidth: 1363,
    innerHeight: 936,
    devicePixelRatio: 1,
    performance: { now: () => now },
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval() {},
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
    Blob: w.Blob,
    URL,
    crypto: globalThis.crypto,
  };
  const context = vm.createContext(sandbox);
  let source = fs
    .readFileSync(new URL("../dist/app.js", import.meta.url), "utf8")
    .replace(/^import[\s\S]*?;\n/gm, "");
  vm.runInContext("const T=THREE;\n" + source, context, { timeout: 5000 });
  const run = (s) => vm.runInContext(s, context);
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
  return { w, run, tick, pointer };
}
test("scene boot builds real meshes and a full viewport perspective camera", () => {
  const a = boot();
  assert.equal(a.run("camera.isPerspectiveCamera"), true);
  assert.equal(a.run("players.length"), 6);
  assert(a.run("players[0].knees[0].parent === players[0].legs[0]"));
  assert(a.run("players[0].elbows[0].parent === players[0].arms[0]"));
  assert.equal(a.run("noteMeshes.size"), 6);
  assert.equal(a.run("bigGroup.children[0].geometry.isBufferGeometry"), true);
  assert.equal(a.w.document.querySelector("header"), null);
  a.tick(0.2);
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
  assert(a.run("players[1].root.rotation.y") > 0.1);
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
    "(()=>{const r=screenTiles[1].geometry.userData.rect;return {x:r.x+r.width/2,y:r.y+r.height/2}})()",
  );
  a.pointer("pointerdown", coords.x, coords.y, 2);
  assert.equal(a.run("selected.kind"), "tile");
  assert.equal(a.run("selected.id"), "anya");
  a.run("contextAction('pin')");
  assert.equal(a.run("featured.visible"), true);
  assert.equal(a.run("screenTiles.some(m=>m.visible)"), false);
});
test("existing local notes migrate and editor creates a real 3D panel", () => {
  const a = boot();
  a.run("noteModal()");
  a.w.document.querySelector("#noteText").value = "Проверка объёмного стикера";
  a.w.document
    .querySelector("#noteForm")
    .dispatchEvent(
      new a.w.Event("submit", { bubbles: true, cancelable: true }),
    );
  assert.equal(a.run("notes.length"), 7);
  assert.equal(a.run("noteMeshes.size"), 7);
  assert.equal(
    JSON.parse(a.w.localStorage.getItem("kino-3d-notes-v2")).length,
    7,
  );
});

test("interaction mode drags a volumetric note and persists its position", () => {
  const a = boot();
  a.tick(0.1);
  a.run("setTool('interact')");
  const p = a.run(
    "(()=>{const p=noteMeshes.values().next().value.userData.front.getWorldPosition(new T.Vector3()).project(camera);return {x:(p.x+1)*innerWidth/2,y:views.floor.y+(1-p.y)*views.floor.height/2}})()",
  );
  const before = a.run("notes[0].x");
  a.pointer("pointerdown", p.x, p.y);
  assert.equal(a.run("drag.kind"), "note");
  a.pointer("pointermove", p.x + 100, p.y);
  a.pointer("pointerup", p.x + 100, p.y);
  assert(a.run("notes[0].x") > before + 1);
  assert.equal(
    a.run("notes[0].x"),
    JSON.parse(a.w.localStorage.getItem("kino-3d-notes-v2"))[0].x,
  );
});
test("interaction mode can drag a small cube and release it into physics", () => {
  const a = boot();
  a.tick(0.1);
  a.run("setTool('interact')");
  const p = a.run(
    "(()=>{const p=cubeMeshes.values().next().value.getWorldPosition(new T.Vector3()).project(camera);return {x:(p.x+1)*innerWidth/2,y:views.floor.y+(1-p.y)*views.floor.height/2}})()",
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

test("share screen hides every participant and restores the grid when it ends", () => {
  const a = boot();
  a.run(
    "shareTexture=new T.Texture({videoWidth:1920,videoHeight:1080});displayStream={};screenUpdate()",
  );
  assert.equal(a.run("screenTiles.some(t=>t.visible)"), false);
  assert(a.run("featured.visible"));
  a.run("displayStream=null;screenUpdate()");
  assert.equal(a.run("screenTiles.filter(t=>t.visible).length"), 6);
});

test("curved screen stays genuinely curved while projected tile corners stay square", () => {
  const a = boot();
  a.tick(0.1);
  a.run("setParticipantCount(6)");
  const stats =
    a.run(`(()=>{const g=screenTiles[0].geometry,p=g.attributes.position;
 const zs=Array.from({length:p.count},(_,i)=>p.getZ(i));
 const rect=g.userData.rect;const v=new T.Vector3().fromBufferAttribute(p,Math.floor(p.count/2)).project(cinema.camera);
 return {depth:Math.max(...zs)-Math.min(...zs),ratio:rect.width/rect.height,views:views.cinema.height+views.floor.height};})()`);
  assert(stats.depth > 0.01);
  assert.equal(stats.ratio, 1);
  assert.equal(stats.views, 936);
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
  a.w.document.querySelector('[data-choice="mask"][data-value="bear"]').click();
  a.w.document
    .querySelector("#avatarForm")
    .dispatchEvent(
      new a.w.Event("submit", { bubbles: true, cancelable: true }),
    );
  assert.equal(a.run("active.profile.id"), "self");
  assert.equal(a.run("active.profile.headwear"), "cowboy");
  assert.equal(a.run("active.profile.mask"), "bear");
  assert.equal(
    JSON.parse(a.w.localStorage.getItem("kino-avatar-v1")).mask,
    "bear",
  );
  assert.equal(a.run("avatarEditor"), null);
  a.tick(0.1);
});
