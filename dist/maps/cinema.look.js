// The cinema's sides: velvet curtains with brass sconces, a loge on each side up a flight of stairs,
// a popcorn machine and an arcade cabinet with a blinking screen.
import * as T from "three";
import { registerProps } from "../props.js";
import { registerDecor } from "../mapscene.js";
import { mat, mesh, merge, placed, worldBox, canvasTexture } from "./kit.js";
import { tube } from "./sides.look.js";

const VELVET = "#7a1f2b",
  GOLD = "#c9a24a";

function curtain(group, s) {
  // Folds: a row of half-cylinders along the wall, with a pelmet on top.
  const parts = [],
    n = Math.round(s.d / 0.42),
    face = -Math.sign(s.x);
  for (let i = 0; i < n; i++) {
    const z = s.z - s.d / 2 + (i + 0.5) * (s.d / n);
    parts.push(placed(new T.CylinderGeometry(0.2, 0.24, s.h, 10, 1, false, 0, Math.PI), s.x + face * 0.02, s.h / 2, z, face > 0 ? 0 : Math.PI));
  }
  mesh(group, merge(parts), mat(VELVET, { roughness: 0.85, side: T.DoubleSide }));
  mesh(group, new T.BoxGeometry(0.3, 0.45, s.d), mat("#5e1620", { roughness: 0.8 }), s.x + face * 0.1, s.h + 0.1, s.z);
  mesh(group, new T.BoxGeometry(0.06, 0.06, s.d), mat(GOLD, { metal: 0.7, roughness: 0.3 }), s.x + face * 0.26, s.h - 0.1, s.z);
  // Sconces with a warm glow.
  for (const z of [-5.5, 4.2, 8.6]) {
    mesh(group, new T.BoxGeometry(0.08, 0.3, 0.16), mat(GOLD, { metal: 0.7, roughness: 0.3 }), s.x + face * 0.22, 2.3, z);
    mesh(group, new T.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("#ffe1a8", { emissive: "#ffb85a", glow: 1.6 }), s.x + face * 0.3, 2.45, z, false);
  }
}
function loge(group, s) {
  const face = -Math.sign(s.x),
    red = mat(VELVET, { roughness: 0.8 }),
    wood = mat("#5a2f22", { roughness: 0.6 }),
    gold = mat(GOLD, { metal: 0.7, roughness: 0.3 });
  mesh(group, worldBox(s.w, s.h - s.y, s.d, 1), wood, s.x, (s.h + s.y) / 2, s.z);
  mesh(group, new T.BoxGeometry(s.w - 0.1, 0.02, s.d - 0.1), red, s.x, s.h + 0.01, s.z, false);
  // A velvet-covered parapet with a gold rail along the room side.
  const ix = s.x + face * (s.w / 2 - 0.05);
  mesh(group, new T.BoxGeometry(0.1, 0.8, s.d), red, ix, s.h + 0.4, s.z);
  tube(group, [ix, s.h + 0.82, s.z - s.d / 2], [ix, s.h + 0.82, s.z + s.d / 2], 0.04, gold);
  // Two armchairs looking out over the room.
  for (const dz of [-0.8, 0.8]) {
    const cx = s.x - face * 0.25;
    mesh(group, new T.BoxGeometry(0.55, 0.4, 0.55), red, cx, s.h + 0.2, s.z + dz);
    mesh(group, new T.BoxGeometry(0.12, 0.55, 0.55), red, cx - face * 0.27, s.h + 0.5, s.z + dz);
  }
}
function stairs(group, s) {
  const n = 6,
    parts = [];
  for (let i = 0; i < n; i++) {
    const top = s.h0 - (i * (s.h0 - s.h1)) / n;
    parts.push(placed(worldBox(s.w, top, s.d / n, 1), s.x, top / 2, s.z - s.d / 2 + (i + 0.5) * (s.d / n)));
  }
  mesh(group, merge(parts), mat("#5a2f22", { roughness: 0.6 }));
  // A red runner up the middle.
  const len = Math.hypot(s.d, s.h0 - s.h1);
  const runner = mesh(group, new T.PlaneGeometry(s.w * 0.55, len), mat(VELVET, { roughness: 0.9 }), s.x, s.h0 / 2 + 0.05, s.z, false);
  runner.rotation.x = -Math.PI / 2 + Math.atan2(s.h0 - s.h1, s.d);
}

function popcorn(g, p) {
  const c = p.colliders[0];
  mesh(g, new T.BoxGeometry(c.w, 0.75, c.d), mat("#c0392b", { roughness: 0.5 }), 0, 0.375, 0);
  for (const x of [-0.3, 0.3]) mesh(g, new T.CylinderGeometry(0.06, 0.06, 0.08, 12), mat("#222"), x, 0.04, c.d / 2 - 0.08).rotation.x = Math.PI / 2;
  // Glass case full of popcorn, a red roof with "POPCORN".
  mesh(g, new T.BoxGeometry(c.w - 0.04, 0.6, c.d - 0.04), mat("#e9f2f7", { roughness: 0.05, opacity: 0.35, depthWrite: false }), 0, 1.05, 0, false);
  const pops = [];
  for (let i = 0; i < 60; i++) pops.push(placed(new T.IcosahedronGeometry(0.035, 0), (Math.random() - 0.5) * 0.65, 0.8 + Math.random() * 0.25, (Math.random() - 0.5) * 0.45));
  mesh(g, merge(pops), mat("#fff1c4", { flat: true, roughness: 0.9 }));
  mesh(g, new T.BoxGeometry(c.w + 0.06, 0.12, c.d + 0.06), mat("#c0392b", { roughness: 0.5 }), 0, 1.41, 0);
  const sign = canvasTexture("popcorn-sign", 256, (ctx, n) => {
    ctx.canvas.height = 64;
    ctx.fillStyle = "#f2c14e";
    ctx.fillRect(0, 0, n, 64);
    ctx.fillStyle = "#c0392b";
    ctx.font = "bold 44px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("POPCORN", n / 2, 34);
  });
  mesh(g, new T.BoxGeometry(c.w, 0.18, 0.04), mat(sign ? "#ffffff" : "#f2c14e", { map: sign }), 0, 1.56, c.d / 2 - 0.02);
}
function arcade(g, p) {
  const c = p.colliders[0];
  const body = mat("#2b2d6e", { roughness: 0.5 });
  mesh(g, new T.BoxGeometry(c.w, c.h - 0.3, c.d), body, 0, (c.h - 0.3) / 2, -0.05);
  mesh(g, new T.BoxGeometry(c.w, 0.3, c.d * 0.6), body, 0, c.h - 0.15, -0.2);
  // Control panel, joystick and buttons.
  const panel = mesh(g, new T.BoxGeometry(c.w, 0.08, 0.35), mat("#1b1c3e"), 0, 0.98, c.d / 2 - 0.05);
  panel.rotation.x = 0.25;
  mesh(g, new T.CylinderGeometry(0.015, 0.015, 0.12, 6), mat("#222"), -0.18, 1.08, c.d / 2 - 0.02);
  mesh(g, new T.SphereGeometry(0.035, 10, 8), mat("#e4573f"), -0.18, 1.15, c.d / 2 - 0.02);
  ["#f2c14e", "#3f86b8", "#69b35a"].forEach((color, i) => mesh(g, new T.CylinderGeometry(0.03, 0.03, 0.03, 12), mat(color, { emissive: color, glow: 0.4 }), 0.05 + i * 0.1, 1.06, c.d / 2 - 0.02));
  // A screen that plays a little game on its own.
  const cv = typeof document !== "undefined" ? document.createElement("canvas") : null;
  let tex = null,
    ctx = null;
  if (cv) {
    cv.width = 64;
    cv.height = 48;
    ctx = cv.getContext("2d");
    if (ctx) {
      tex = new T.CanvasTexture(cv);
      tex.magFilter = T.NearestFilter;
      tex.colorSpace = T.SRGBColorSpace;
    }
  }
  const screen = mesh(g, new T.PlaneGeometry(c.w * 0.75, 0.48), mat("#111", { map: tex, emissive: "#ffffff", glow: tex ? 0.9 : 0, roughness: 0.2 }), 0, 1.38, c.d / 2 - 0.1, false);
  screen.rotation.x = -0.18;
  if (tex) screen.material.emissiveMap = tex;
  mesh(g, new T.BoxGeometry(c.w * 0.9, 0.14, 0.05), mat("#f2c14e", { emissive: "#f2a14e", glow: 0.7 }), 0, c.h - 0.08, c.d / 2 - 0.36);
  let last = -1;
  g.userData.update = (dt, t) => {
    if (!ctx || Math.floor(t * 12) === last) return;
    last = Math.floor(t * 12);
    // Pong-like: a ball bouncing between two paddles, with stars.
    ctx.fillStyle = "#0b0b1e";
    ctx.fillRect(0, 0, 64, 48);
    ctx.fillStyle = "#3a3a6a";
    for (let i = 0; i < 12; i++) ctx.fillRect((i * 23 + last) % 64, (i * 17) % 48, 1, 1);
    const bx = 32 + Math.round(Math.sin(t * 1.7) * 26),
      by = 24 + Math.round(Math.sin(t * 2.9) * 18);
    ctx.fillStyle = "#f2c14e";
    ctx.fillRect(bx - 1, by - 1, 3, 3);
    ctx.fillStyle = "#69b35a";
    ctx.fillRect(3, Math.max(2, Math.min(36, by - 5)), 2, 10);
    ctx.fillStyle = "#e4573f";
    ctx.fillRect(59, Math.max(2, Math.min(36, 24 + Math.round(Math.sin(t * 2.9 - 0.4) * 18) - 5)), 2, 10);
    tex.needsUpdate = true;
  };
}
registerProps({ popcorn, arcade });

registerDecor("cinema", (group, map) => {
  for (const s of map.statics || []) {
    if (s.kind === "curtain") curtain(group, s);
    if (s.kind === "loge") loge(group, s);
    if (s.kind === "loge-post") mesh(group, new T.BoxGeometry(s.w, s.h, s.d), mat("#5a2f22", { roughness: 0.6 }), s.x, s.h / 2, s.z);
    if (s.kind === "loge-stairs") stairs(group, s);
  }
});
