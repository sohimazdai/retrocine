// How the playground looks: toy fort with a slide, trampoline, basketball hoop, seesaw, goals.
import * as T from "three";
import { registerProps, goal, lines } from "../props.js";
import { registerDecor } from "../mapscene.js";
import { mat, mesh, rng, leafyTree } from "./kit.js";
import { SEESAW } from "./playground.js";

const RED = "#e4573f",
  YELLOW = "#f2c14e",
  BLUE = "#3f86b8",
  GREEN = "#69b35a",
  CREAM = "#f6efe0";

function crenels(g, c, y, material) {
  const step = 0.42;
  for (const [axis, fixed, from, to] of [
    ["x", c.z + c.d / 2 - 0.08, c.x - c.w / 2, c.x + c.w / 2],
    ["x", c.z - c.d / 2 + 0.08, c.x - c.w / 2, c.x + c.w / 2],
    ["z", c.x - c.w / 2 + 0.08, c.z - c.d / 2, c.z + c.d / 2],
    ["z", c.x + c.w / 2 - 0.08, c.z - c.d / 2, c.z + c.d / 2],
  ])
    for (let v = from + step / 2; v < to; v += step * 2) {
      const x = axis === "x" ? v : fixed,
        z = axis === "x" ? fixed : v;
      mesh(g, new T.BoxGeometry(0.2, 0.2, 0.2), material, x, y + 0.1, z);
    }
}
function fort(g, p) {
  const [base, mid, top, step, slide] = p.colliders;
  const walls = [mat(YELLOW, { roughness: 0.55 }), mat(BLUE, { roughness: 0.55 }), mat(RED, { roughness: 0.55 })],
    trim = mat(CREAM, { roughness: 0.5 }),
    dark = mat("#2d3b4a", { roughness: 0.7 });
  [base, mid, top].forEach((c, i) => {
    const y0 = i === 0 ? 0 : [base, mid, top][i - 1].h;
    mesh(g, new T.BoxGeometry(c.w, c.h - y0, c.d), walls[i], c.x, (c.h + y0) / 2, c.z);
    mesh(g, new T.BoxGeometry(c.w + 0.06, 0.07, c.d + 0.06), trim, c.x, c.h - 0.035, c.z);
    // Arched windows on the front.
    for (let k = 0; k < Math.max(1, Math.floor(c.w / 1.3)); k++) {
      const x = c.x - c.w / 2 + (k + 0.5) * (c.w / Math.max(1, Math.floor(c.w / 1.3)));
      mesh(g, new T.BoxGeometry(0.42, 0.42, 0.04), dark, x, y0 + (c.h - y0) * 0.5, c.z + c.d / 2 + 0.01);
      const arch = mesh(g, new T.CylinderGeometry(0.21, 0.21, 0.04, 16, 1, false, 0, Math.PI), dark, x, y0 + (c.h - y0) * 0.5 + 0.21, c.z + c.d / 2 + 0.01);
      arch.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    }
  });
  crenels(g, top, top.h, walls[0]);
  // A flag on the top floor.
  mesh(g, new T.CylinderGeometry(0.03, 0.03, 1.3, 6), trim, top.x + top.w / 2 - 0.2, top.h + 0.65, top.z - top.d / 2 + 0.2);
  const flag = mesh(g, new T.PlaneGeometry(0.6, 0.38, 6, 1), mat(RED, { side: T.DoubleSide, roughness: 0.8 }), top.x + top.w / 2 + 0.1, top.h + 1.1, top.z - top.d / 2 + 0.2);
  // The step with a ladder look, and the slide: a trough following the ramp.
  mesh(g, new T.BoxGeometry(step.w, step.h, step.d), mat(GREEN, { roughness: 0.55 }), step.x, step.h / 2, step.z);
  const len = Math.hypot(slide.w, slide.h1 - slide.h0),
    angle = Math.atan2(slide.h1 - slide.h0, slide.w);
  const chute = new T.Group();
  chute.position.set(slide.x, (slide.h0 + slide.h1) / 2, slide.z);
  chute.rotation.z = angle;
  mesh(chute, new T.BoxGeometry(len, 0.06, slide.d), mat(RED, { roughness: 0.3 }), 0, -0.03, 0);
  for (const s of [-1, 1]) mesh(chute, new T.BoxGeometry(len, 0.22, 0.06), mat(YELLOW, { roughness: 0.35 }), 0, 0.08, (s * slide.d) / 2);
  g.add(chute);
  for (const x of [slide.x - slide.w / 2 + 0.25, slide.x]) {
    const h = slide.h0 + ((x - (slide.x - slide.w / 2)) / slide.w) * (slide.h1 - slide.h0);
    mesh(g, new T.CylinderGeometry(0.05, 0.05, h, 8), trim, x, h / 2, slide.z);
  }
  const wave = flag.geometry.attributes.position,
    rest = Float32Array.from(wave.array);
  g.userData.update = (dt, t) => {
    for (let i = 0; i < wave.count; i++) {
      const x = rest[i * 3];
      wave.setZ(i, Math.sin(t * 5 + x * 7) * 0.06 * (x + 0.3));
    }
    wave.needsUpdate = true;
  };
}
function trampoline(g, p) {
  const c = p.colliders[0],
    r = c.radius,
    h = c.h;
  const legs = mat("#3a4a58", { roughness: 0.5, metal: 0.4 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mesh(g, new T.CylinderGeometry(0.05, 0.05, h, 8), legs, Math.cos(a) * (r - 0.1), h / 2, Math.sin(a) * (r - 0.1));
  }
  const pad = mesh(g, new T.TorusGeometry(r - 0.12, 0.14, 10, 40), mat(BLUE, { roughness: 0.6 }), 0, h - 0.05, 0);
  pad.rotation.x = Math.PI / 2;
  const matt = mesh(g, new T.CircleGeometry(r - 0.24, 40), mat("#22262c", { roughness: 0.9 }), 0, h - 0.06, 0);
  matt.rotation.x = -Math.PI / 2;
  const ring = mesh(g, new T.RingGeometry(r * 0.35, r * 0.4, 40), mat(YELLOW), 0, h - 0.055, 0);
  ring.rotation.x = -Math.PI / 2;
  // The mat dips when someone lands, then wobbles back.
  g.userData.update = (dt, t, s) => {
    const k = s.dip || 0;
    matt.position.y = h - 0.06 - k * 0.25;
    ring.position.y = matt.position.y + 0.005;
    s.dip = Math.max(0, k - dt * 3);
  };
}
function hoop(g, p) {
  const [pole, board] = p.colliders,
    ring = p.hoop;
  const blue = mat(BLUE, { roughness: 0.45, metal: 0.3 });
  mesh(g, new T.CylinderGeometry(0.09, 0.11, pole.h, 12), blue, pole.x, pole.h / 2, pole.z);
  mesh(g, new T.BoxGeometry(0.1, 0.1, Math.abs(board.z - pole.z) + 0.1), blue, 0, 2.9, (pole.z + board.z) / 2);
  mesh(g, new T.BoxGeometry(0.6, 0.08, 0.6), mat("#2d3b4a"), pole.x, 0.04, pole.z);
  mesh(g, new T.BoxGeometry(board.w, board.h - board.y, board.d), mat("#f8f8f6", { roughness: 0.3 }), board.x, (board.h + board.y) / 2, board.z);
  const square = mat(RED, { roughness: 0.4 });
  for (const [w, h, x, y] of [
    [0.6, 0.05, 0, 2.95],
    [0.6, 0.05, 0, 2.62],
    [0.05, 0.38, -0.28, 2.785],
    [0.05, 0.38, 0.28, 2.785],
  ])
    mesh(g, new T.BoxGeometry(w, h, 0.02), square, x, y, board.z + board.d / 2 + 0.01);
  const rim = mesh(g, new T.TorusGeometry(ring.r, 0.03, 8, 32), mat("#ef6a2f", { roughness: 0.35, metal: 0.4 }), ring.x, ring.y, ring.z);
  rim.rotation.x = Math.PI / 2;
  mesh(g, new T.BoxGeometry(0.08, 0.05, 0.2), mat("#ef6a2f"), ring.x, ring.y, ring.z - ring.r - 0.06);
  // Net: lines from the rim down to a narrower ring.
  const net = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2,
      b = ((i + 1) / 16) * Math.PI * 2;
    net.push([ring.x + Math.cos(a) * ring.r, ring.y, ring.z + Math.sin(a) * ring.r], [ring.x + Math.cos(b) * ring.r * 0.62, ring.y - 0.5, ring.z + Math.sin(b) * ring.r * 0.62]);
    net.push([ring.x + Math.cos(b) * ring.r, ring.y, ring.z + Math.sin(b) * ring.r], [ring.x + Math.cos(a) * ring.r * 0.62, ring.y - 0.5, ring.z + Math.sin(a) * ring.r * 0.62]);
  }
  lines(g, net, "#ffffff", 0.85);
}
function seesaw(g, p) {
  const c = p.colliders[0];
  const frame = mat("#3a4a58", { roughness: 0.5, metal: 0.4 });
  for (const s of [-1, 1]) {
    const leg = mesh(g, new T.BoxGeometry(0.08, SEESAW.pivot + 0.1, 0.08), frame, 0, SEESAW.pivot / 2, s * 0.2);
    leg.rotation.x = s * 0.35;
  }
  mesh(g, new T.CylinderGeometry(0.06, 0.06, 0.6, 10), frame, 0, SEESAW.pivot, 0).rotation.x = Math.PI / 2;
  const plank = new T.Group();
  plank.position.set(0, SEESAW.pivot, 0);
  mesh(plank, new T.BoxGeometry(c.w, 0.08, c.d), mat(YELLOW, { roughness: 0.5 }), 0, 0.04, 0);
  for (const s of [-1, 1]) {
    mesh(plank, new T.BoxGeometry(0.5, 0.06, c.d + 0.02), mat(s < 0 ? RED : BLUE, { roughness: 0.6 }), s * (c.w / 2 - 0.35), 0.11, 0);
    const handle = mesh(plank, new T.TorusGeometry(0.13, 0.025, 6, 14, Math.PI), frame, s * (c.w / 2 - 0.75), 0.12, 0);
    handle.rotation.y = Math.PI / 2;
  }
  g.add(plank);
  g.userData.update = (dt, t, s) => {
    const tilt = s.tilt ?? 1;
    plank.rotation.z = Math.atan2(tilt * SEESAW.swing * 2, c.w);
  };
}
function bench(g) {
  const wood = mat("#e4a35a", { roughness: 0.7 }),
    frame = mat(BLUE, { roughness: 0.5 });
  for (let i = 0; i < 3; i++) mesh(g, new T.BoxGeometry(2.2, 0.06, 0.18), wood, 0, 0.46, -0.22 + i * 0.22);
  for (const x of [-0.95, 0.95]) mesh(g, new T.BoxGeometry(0.08, 0.44, 0.6), frame, x, 0.22, 0);
}
registerProps({
  fort,
  trampoline,
  hoop,
  seesaw,
  bench,
  goal: (g, p) => goal(g, p, p.colors),
});

registerDecor("playground", (group, map) => {
  // Painted lines of a small pitch between the goals, and trees in the back corners.
  const paint = mat("#ffffff", { roughness: 0.9, opacity: 0.55 });
  const line = (w, d, x, z) => {
    const m = mesh(group, new T.PlaneGeometry(w, d), paint, x, 0.012, z, false);
    m.rotation.x = -Math.PI / 2;
  };
  line(0.08, 9.4, 0, 1.0);
  const circle = mesh(group, new T.RingGeometry(1.7, 1.78, 48), paint, 0, 0.012, 1.0, false);
  circle.rotation.x = -Math.PI / 2;
  for (const s of [-1, 1]) {
    line(0.08, 6.2, s * 9.3, 1.0);
    line(2.4, 0.08, s * 10.5, 4.06);
    line(2.4, 0.08, s * 10.5, -2.06);
  }
  const r = rng(11);
  for (const s of map.statics || []) if (s.kind === "tree") leafyTree(group, s.x, s.z, s.h, Math.floor(r() * 999));
});
