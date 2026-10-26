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
    ...roomModule,
    ...playgroundModule,
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
  assert(a.run("cinema.group.parent === scene"));
  assert(a.run("cinema.scene === undefined"));
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
    "(()=>{const r=screenTiles[1].geometry.userData.rect;const p=screenPoint(r.x+r.width/2,r.y+r.height/2,.035);const v=new T.Vector3(p.x,p.y,p.z).project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2}})()",
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
    "(()=>{const p=noteMeshes.values().next().value.userData.front.getWorldPosition(new T.Vector3()).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}})()",
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
  a.run("camTexture=new T.Texture({videoWidth:1920,videoHeight:1080});screenUpdate()");
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
  a.run("setParticipantCount(6)");
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
  const a = boot();
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
