// How the big kart tracks look: an asphalt ribbon along the centreline with white edges, kerbs on
// the bends at ground level, a chequered start line and arrows; raised stretches stand on rocky
// embankments (the mountain) or concrete walls and a bridge on pillars with the road passing under
// it (the Grand Prix loop), with crash barriers along them. Rocks, pines, tyre stacks, the timing
// board, start lights — and the track selector machine shared by all three kart maps.
import * as T from "three";
import { registerProps } from "../props.js";
import { registerDecor } from "../mapscene.js";
import { mat, mesh, merge, placed, canvasTexture, rng, rockGeometry } from "./kit.js";
import { asphalt, board, startLights } from "./race.look.js";
import { bend } from "./trackgen.js";
import { MAPS } from "./index.js";

const LIFT = 0.016;
const at = (F, i) => F[((i % F.length) + F.length) % F.length];
// Tangent and left-hand normal at every centreline point (closed loop).
function frames(P) {
  const n = P.length;
  return P.map((p, i) => {
    const a = P[(i - 1 + n) % n],
      b = P[(i + 1) % n],
      tx = b[0] - a[0],
      tz = b[1] - a[1],
      l = Math.hypot(tx, tz) || 1;
    return { x: p[0], z: p[1], y: p[2], tx: tx / l, tz: tz / l, lx: -tz / l, lz: tx / l };
  });
}
// A strip between offsets o0 and o1 from the centreline (positive = left), lifted by dy above the road.
function strip(F, o0, o1, dy, from = 0, to = F.length, closed = true) {
  const pos = [],
    uv = [],
    idx = [];
  let s = 0;
  const count = to - from + (closed && to === F.length && from === 0 ? 1 : 0);
  for (let k = 0; k < count; k++) {
    const f = at(F, from + k);
    if (k) {
      const g = at(F, from + k - 1);
      s += Math.hypot(f.x - g.x, f.z - g.z);
    }
    for (const o of [o0, o1]) {
      pos.push(f.x + f.lx * o, f.y + dy, f.z + f.lz * o);
      // Along the road in u, across it in v: the rubbed-in racing line runs down the middle.
      uv.push(s / 3, o === o0 ? 0 : 1);
    }
    if (k) {
      const a = (k - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// A vertical wall along offset o, from height y0(f) to y1(f) at each point, for indices from..to.
function wall(F, o, y0, y1, from, to) {
  const pos = [],
    idx = [];
  for (let k = 0; k <= to - from; k++) {
    const f = at(F, from + k);
    pos.push(f.x + f.lx * o, y0(f), f.z + f.lz * o, f.x + f.lx * o, y1(f), f.z + f.lz * o);
    if (k) {
      const a = (k - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// Index runs of the centreline where the road is raised (matching the path colliders).
function raisedRuns(P, threshold = 0.02) {
  const runs = [];
  let start = -1;
  for (let i = 0; i <= P.length; i++) {
    const up = P[i % P.length][2] > threshold;
    if (up && start < 0) start = i - 1;
    if (!up && start >= 0) {
      runs.push([start, i]);
      start = -1;
    }
  }
  return runs;
}
function road(group, map) {
  const P = map.roadPoints,
    W = map.track.width,
    half = W / 2,
    F = frames(P),
    style = map.statics.find((s) => s.shape === "path")?.style || "flat";
  const tex = asphalt();
  if (tex) {
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(1, 1);
  }
  mesh(group, strip(F, -half, half, LIFT), mat(tex ? "#ffffff" : "#3b3e44", { map: tex, roughness: 0.92, side: T.DoubleSide }), 0, 0, 0, false).receiveShadow = true;
  // White edge lines.
  const white = mat("#f2f2ee", { roughness: 0.6 });
  for (const s of [-1, 1]) mesh(group, strip(F, s * (half - 0.2), s * (half - 0.08), LIFT + 0.004), white, 0, 0, 0, false);
  // Kerbs on the bends at ground level: red and white blocks along both edges.
  const red = [],
    wht = [];
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    if (f.y > 0.05 || bend(P, i) < 0.22) continue;
    for (const s of [-1, 1]) {
      const g = placed(new T.BoxGeometry(0.34, 0.06, 0.62), f.x + f.lx * s * (half + 0.12), f.y + 0.03, f.z + f.lz * s * (half + 0.12), Math.atan2(f.tx, f.tz));
      (i % 2 ? red : wht).push(g);
    }
  }
  if (red.length) mesh(group, merge(red), mat("#d8432f", { roughness: 0.6 }), 0, 0, 0, false);
  if (wht.length) mesh(group, merge(wht), mat("#f2f2ee", { roughness: 0.6 }), 0, 0, 0, false);
  // Chequered start line.
  const fi = map.track.finishIndex ?? 0,
    sf = F[fi],
    cells = [];
  for (let c = 0; c < 12; c++)
    for (let r = 0; r < 2; r++) {
      if ((c + r) % 2) continue;
      const o = -half + (c + 0.5) * (W / 12),
        along = (r - 0.5) * 0.28;
      cells.push(placed(new T.BoxGeometry(W / 12, 0.01, 0.28), sf.x + sf.lx * o + sf.tx * along, sf.y + LIFT + 0.006, sf.z + sf.lz * o + sf.tz * along, Math.atan2(sf.tx, sf.tz)));
    }
  mesh(group, strip(F, -half, half, LIFT + 0.003, fi, fi + 1, false), mat("#f2f2ee"), 0, 0, 0, false);
  mesh(group, merge(cells), mat("#16171a", { roughness: 0.7 }), 0, 0, 0, false);
  // Arrows showing the way round, every dozen metres or so.
  const arrows = [];
  const arrowShape = new T.Shape([[0, 0.55], [0.32, 0.1], [0.12, 0.1], [0.12, -0.45], [-0.12, -0.45], [-0.12, 0.1], [-0.32, 0.1]].map(([x, y]) => new T.Vector2(x, y)));
  for (let i = (fi + 10) % F.length, k = 0; k < F.length; i = (i + 20) % F.length, k += 20) {
    const f = F[i];
    const g = new T.ShapeGeometry(arrowShape);
    g.rotateX(-Math.PI / 2);
    // The shape's tip (+y) points to −z after the rotation; turning by atan2(−tx, −tz) aims it along the road.
    arrows.push(placed(g, f.x, f.y + LIFT + 0.005, f.z, Math.atan2(-f.tx, -f.tz)));
  }
  mesh(group, merge(arrows), mat("#f2f2ee", { opacity: 0.85 }), 0, 0, 0, false);

  // Raised stretches: what holds them up, and crash barriers.
  const rockMat = mat("#857a6a", { roughness: 1, flat: true }),
    concrete = mat("#a7a69d", { roughness: 0.95 }),
    armco = mat("#c9ccd2", { roughness: 0.35, metal: 0.6, side: T.DoubleSide }),
    post = mat("#6b6e75", { roughness: 0.5, metal: 0.4 });
  const posts = [];
  for (const [from, to] of raisedRuns(P)) {
    if (style === "mountain") {
      // Rocky embankment down to the ground on both sides, with a little splay at the foot.
      for (const s of [-1, 1]) mesh(group, wall(F, s * (half + 0.02), () => 0, (f) => f.y + LIFT, from, to), rockMat, 0, 0, 0, true);
    } else {
      // Bridge: where the road is too low to pass under, solid concrete walls; high up, a deck slab
      // on pillars that leaves the road below free.
      for (const s of [-1, 1]) mesh(group, wall(F, s * (half + 0.02), (f) => (f.y >= 1.5 ? f.y - 0.32 : 0), (f) => f.y + LIFT, from, to), concrete, 0, 0, 0, true);
      const deck = [];
      for (let k = from; k < to; k++) if (at(F, k).y >= 1.5) deck.push(k);
      if (deck.length > 1) mesh(group, strip(F, -half - 0.02, half + 0.02, -0.32, deck[0], deck.at(-1) + 1, false), concrete, 0, 0, 0, true).material.side = T.DoubleSide;
      for (let j = 0; j < deck.length; j += 4) {
        const f = at(F, deck[j]);
        for (const s of [-1, 1]) {
          const x = f.x + f.lx * s * (half - 0.25),
            z = f.z + f.lz * s * (half - 0.25);
          // No pillar standing in the road below.
          const blocked = P.some((p) => p[2] < f.y - 1 && Math.hypot(p[0] - x, p[1] - z) < half + 0.4);
          if (!blocked) mesh(group, new T.BoxGeometry(0.42, f.y - 0.3, 0.42), concrete, x, (f.y - 0.3) / 2, z);
        }
      }
    }
    // Crash barriers on both edges wherever the road is up.
    for (const s of [-1, 1]) {
      mesh(group, wall(F, s * (half + 0.08), (f) => (f.y > 0.3 ? f.y + 0.18 : f.y + LIFT), (f) => (f.y > 0.3 ? f.y + 0.55 : f.y + LIFT), from, to), armco, 0, 0, 0, true);
      for (let k = from; k < to; k += 2) {
        const f = at(F, k);
        if (f.y > 0.3) posts.push(placed(new T.BoxGeometry(0.08, 0.6, 0.08), f.x + f.lx * s * (half + 0.12), f.y + 0.3, f.z + f.lz * s * (half + 0.12)));
      }
    }
  }
  if (posts.length) mesh(group, merge(posts), post, 0, 0, 0, false);
}
function scenery(group, statics) {
  const rockColors = ["#8d877d", "#7e7469", "#958c80"];
  statics.forEach((s, i) => {
    if (s.kind === "rock") {
      const m = mesh(group, rockGeometry(i + 3, 1), mat(rockColors[i % 3], { roughness: 1, flat: true }), s.x, s.h / 2, s.z);
      m.scale.set(s.radius * 1.05, s.h / 2, s.radius * 1.05);
    }
    if (s.kind === "pine") {
      mesh(group, new T.CylinderGeometry(0.1, 0.14, s.h * 0.35, 7), mat("#5a4232", { roughness: 0.9 }), s.x, s.h * 0.175, s.z);
      for (let k = 0; k < 3; k++) mesh(group, new T.ConeGeometry(0.75 - k * 0.18, s.h * 0.42, 8), mat(["#2f5a3a", "#356842", "#3b7349"][k], { roughness: 0.9, flat: true }), s.x, s.h * (0.38 + k * 0.2), s.z);
    }
  });
  // Tyre stacks.
  const tyre = new T.TorusGeometry(0.29, 0.12, 8, 16),
    stacks = [[], [], []];
  statics
    .filter((s) => s.kind === "tyres")
    .forEach((s, i) => {
      const k = s.radius / 0.38;
      for (let j = 0; j < 3; j++) stacks[(i + j) % 3].push(placed(tyre, s.x, 0.13 + j * 0.25, s.z, 0, Math.PI / 2, 0, [k, k, 1]));
    });
  ["#d8432f", "#f2f2ee", "#2f6fd8"].forEach((c, k) => stacks[k].length && mesh(group, merge(stacks[k]), mat(c, { roughness: 0.8 }), 0, 0, 0, true));
}
function decor(group, map) {
  const statics = map.statics || [];
  road(group, map);
  scenery(group, statics);
  const lights = startLights(group, statics);
  const draw = board(
    group,
    statics.find((s) => s.kind === "board"),
  );
  return {
    setBoard: draw,
    update(dt, t) {
      if (!lights) return;
      const k = t % 7,
        on = k < 5 ? Math.floor(k) + 1 : 0;
      lights.forEach((l, i) => (l.material.emissiveIntensity = i < on ? 2.2 : 0));
    },
  };
}
registerDecor("race-mountain", decor);
registerDecor("race-gp", decor);

// The track selector: a blue cabinet whose screen shows the three tracks; E next to it to choose.
function selector(g, p) {
  const c = p.colliders[0];
  mesh(g, new T.BoxGeometry(c.w, c.h, c.d), mat("#2f6fd8", { roughness: 0.45 }), 0, c.h / 2, 0);
  mesh(g, new T.BoxGeometry(c.w + 0.1, 0.12, c.d + 0.1), mat("#1d1f24"), 0, c.h + 0.06, 0);
  const tracks = MAPS.filter((m) => m.kartTrack);
  const screen = canvasTexture("track-selector", 256, (ctx, n) => {
    ctx.canvas.height = 200;
    ctx.fillStyle = "#0f1420";
    ctx.fillRect(0, 0, n, 200);
    ctx.fillStyle = "#f2c14e";
    ctx.font = "bold 30px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ТРАССЫ", n / 2, 34);
    // A tiny outline of each track.
    tracks.forEach((m, k) => {
      const pts = m.roadPoints || m.track?.points || [],
        cx = 44 + k * 84,
        cy = 105;
      ctx.strokeStyle = ["#7fe08a", "#e9b45a", "#6fb4ff"][k % 3];
      ctx.lineWidth = 4;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, cx + p[0] * 2.6, cy + p[1] * 2.6));
      ctx.closePath();
      ctx.stroke();
    });
    ctx.fillStyle = "#e9edf3";
    ctx.font = "24px Arial, sans-serif";
    ctx.fillText("нажмите E", n / 2, 186);
  });
  const face = mesh(g, new T.PlaneGeometry(1.1, 0.86), mat(screen ? "#ffffff" : "#0f1420", { map: screen, emissive: "#ffffff", glow: 0 }), 0, 1.45, c.d / 2 + 0.01, false);
  face.material.emissiveMap = screen;
  face.material.emissiveIntensity = screen ? 0.7 : 0;
  // Three big buttons below the screen in the tracks' colours.
  const buttons = ["#7fe08a", "#e9b45a", "#6fb4ff"].map((col, k) => {
    const b = mesh(g, new T.CylinderGeometry(0.1, 0.12, 0.07, 16), mat(col, { emissive: col, glow: 0.4 }), -0.32 + k * 0.32, 0.86, c.d / 2 + 0.02, false);
    b.rotation.x = Math.PI / 2;
    return b;
  });
  g.userData.update = (dt, t) => buttons.forEach((b, k) => (b.material.emissiveIntensity = 0.3 + Math.max(0, Math.sin(t * 3 + k * 2.1)) * 0.9));
}
registerProps({ "track-selector": selector });
