// How the kart track looks: asphalt with white edges and red-and-white kerbs, a chequered start line
// with start lights on a pole, walls and tyre stacks, an asphalt hump with yellow lines, a timing
// board of the best laps, and the kart dispenser in the pits with its sign.
import * as T from "three";
import { registerProps } from "../props.js";
import { registerDecor } from "../mapscene.js";
import { mat, mesh, merge, placed, worldBox, canvasTexture, rng } from "./kit.js";
import { tube } from "./sides.look.js";
import { TRACK } from "./race.js";

// A rounded rectangle (corner centres of the track) offset to radius r, as a shape in (x, −z).
function rounded(r, steps = 10) {
  const s = new T.Shape();
  TRACK.corners.forEach((c, k) => {
    for (let i = 0; i <= steps; i++) {
      const a = ((c.from + ((c.to - c.from) * i) / steps) * Math.PI) / 180,
        x = c.cx + r * Math.cos(a),
        z = c.cz + r * Math.sin(a);
      if (k === 0 && i === 0) s.moveTo(x, -z);
      else s.lineTo(x, -z);
    }
  });
  s.closePath();
  return s;
}
function asphalt() {
  return canvasTexture("asphalt", 256, (c, n, r) => {
    c.fillStyle = "#3b3e44";
    c.fillRect(0, 0, n, n);
    for (let i = 0; i < 3000; i++) {
      c.fillStyle = ["#44474e", "#33363b", "#4c4f56", "#2e3035"][i % 4];
      c.fillRect(r() * n, r() * n, 1.5, 1.5);
    }
    // Rubber laid down along the racing line.
    c.fillStyle = "rgba(20,20,22,0.25)";
    c.fillRect(0, n * 0.35, n, n * 0.3);
  });
}
function track(group) {
  const half = TRACK.width / 2,
    R = TRACK.radius;
  const outer = rounded(R + half),
    inner = rounded(R - half);
  outer.holes.push(new T.Path(inner.getPoints().reverse()));
  const tex = asphalt()?.clone();
  if (tex) {
    tex.needsUpdate = true;
    tex.repeat.set(0.25, 0.25);
  }
  const road = mesh(group, new T.ShapeGeometry(outer, 12), mat(tex ? "#ffffff" : "#3b3e44", { map: tex, roughness: 0.85 }), 0, 0.012, 0, false);
  road.rotation.x = -Math.PI / 2;
  // White edge lines.
  for (const r of [R + half - 0.12, R - half + 0.12]) {
    const line = rounded(r + 0.05);
    line.holes.push(new T.Path(rounded(r - 0.05).getPoints().reverse()));
    const m = mesh(group, new T.ShapeGeometry(line, 12), mat("#f2f2ee", { roughness: 0.6 }), 0, 0.016, 0, false);
    m.rotation.x = -Math.PI / 2;
  }
  // Kerbs on the inside and outside of every corner: red and white blocks.
  const red = [],
    white = [];
  for (const c of TRACK.corners)
    for (const r of [R - half - 0.25, R + half + 0.2])
      for (let i = 0; i < 12; i++) {
        const a0 = ((c.from + ((c.to - c.from) * i) / 12) * Math.PI) / 180,
          a1 = ((c.from + ((c.to - c.from) * (i + 1)) / 12) * Math.PI) / 180,
          am = (a0 + a1) / 2,
          len = Math.abs(a1 - a0) * r;
        (i % 2 ? red : white).push(placed(new T.BoxGeometry(len, 0.05, 0.4), c.cx + r * Math.cos(am), 0.025, c.cz + r * Math.sin(am), -am + Math.PI / 2));
      }
  mesh(group, merge(red), mat("#d8432f", { roughness: 0.6 }), 0, 0, 0, false);
  mesh(group, merge(white), mat("#f2f2ee", { roughness: 0.6 }), 0, 0, 0, false);
  // Chequered start/finish line and the starting grid behind it.
  const f = TRACK.finish,
    x = f.from[0],
    z0 = Math.min(f.from[1], f.to[1]),
    z1 = Math.max(f.from[1], f.to[1]);
  const checks = canvasTexture("checks", 64, (c, n) => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      c.fillStyle = (i + j) % 2 ? "#111" : "#f4f4f0";
      c.fillRect(i * 8, j * 8, 8, 8);
    }
  });
  const line = mesh(group, new T.PlaneGeometry(0.6, z1 - z0), mat(checks ? "#ffffff" : "#eee", { map: checks }), x, 0.02, (z0 + z1) / 2, false);
  line.rotation.x = -Math.PI / 2;
  if (checks) {
    line.material.map = checks.clone();
    line.material.map.needsUpdate = true;
    line.material.map.repeat.set(1, (z1 - z0) / 0.6);
  }
  const grid = [];
  for (let i = 0; i < 4; i++) {
    const gx = x - 1.4 - i * 2.2,
      gz = i % 2 ? (z0 + z1) / 2 - 1 : (z0 + z1) / 2 + 1;
    grid.push(placed(new T.BoxGeometry(0.08, 0.01, 1.1), gx, 0.02, gz), placed(new T.BoxGeometry(0.8, 0.01, 0.08), gx - 0.4, 0.02, gz - 0.55), placed(new T.BoxGeometry(0.8, 0.01, 0.08), gx - 0.4, 0.02, gz + 0.55));
  }
  mesh(group, merge(grid), mat("#f2f2ee"), 0, 0, 0, false);
  // Arrows showing the way round on the straights.
  const arrows = [];
  for (const [ax, az, rot] of [
    [3, 6, -Math.PI / 2],
    [11.2, 0.4, 0],
    [-3, -5.6, Math.PI / 2],
    [-11.2, 0.4, Math.PI],
  ]) {
    const shape = new T.Shape();
    shape.moveTo(0, 0.6);
    shape.lineTo(0.5, 0);
    shape.lineTo(0.18, 0);
    shape.lineTo(0.18, -0.6);
    shape.lineTo(-0.18, -0.6);
    shape.lineTo(-0.18, 0);
    shape.lineTo(-0.5, 0);
    shape.closePath();
    // Flat on the road, then turned to point the way round.
    const g = new T.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    arrows.push(placed(g, ax, 0.018, az, rot));
  }
  mesh(group, merge(arrows), mat("#f2f2ee", { opacity: 0.7 }), 0, 0, 0, false);
}
function walls(group, statics) {
  const concrete = [],
    stripes = [];
  for (const s of statics.filter((s) => s.kind === "wall" || s.kind === "pit-wall")) {
    concrete.push(placed(worldBox(s.w, s.h, s.d, 1), s.x, s.h / 2, s.z));
    const along = s.w > s.d,
      len = along ? s.w : s.d;
    for (let t = -len / 2 + 0.5; t < len / 2; t += 2)
      stripes.push(placed(new T.BoxGeometry(along ? 1 : s.w + 0.02, 0.18, along ? s.d + 0.02 : 1), s.x + (along ? t : 0), s.h - 0.15, s.z + (along ? 0 : t)));
  }
  mesh(group, merge(concrete), mat("#e9e6df", { roughness: 0.85 }));
  mesh(group, merge(stripes), mat("#d8432f", { roughness: 0.6 }), 0, 0, 0, false);
  // Tyre stacks in alternating colours.
  const r = rng(13),
    colors = ["#1b1c20", "#d8432f", "#f2f2ee", "#2f6fd8"],
    byColor = colors.map(() => []);
  for (const s of statics.filter((s) => s.kind === "tyres")) {
    const n = Math.round(s.h / 0.25);
    for (let i = 0; i < n; i++) byColor[i % 2 ? 0 : 1 + Math.floor(r() * 3)].push(placed(new T.TorusGeometry(s.radius * 0.72, s.radius * 0.3, 8, 16), s.x, 0.12 + i * 0.25, s.z, 0, Math.PI / 2, 0));
  }
  byColor.forEach((parts, i) => parts.length && mesh(group, merge(parts), mat(colors[i], { roughness: 0.85 })));
}
function hump(group, statics) {
  const parts = statics.filter((s) => s.kind === "hump");
  if (!parts.length) return;
  const x0 = Math.min(...parts.map((s) => s.x - s.w / 2)),
    x1 = Math.max(...parts.map((s) => s.x + s.w / 2)),
    s = parts[0],
    h = s.h;
  const shape = new T.Shape();
  shape.moveTo(x0, 0);
  shape.lineTo((x0 + x1) / 2, h);
  shape.lineTo(x1, 0);
  shape.closePath();
  mesh(group, new T.ExtrudeGeometry(shape, { depth: s.d, bevelEnabled: false }), mat("#4a4d54", { roughness: 0.85 }), 0, 0, s.z - s.d / 2);
  // Yellow lines at the foot on both sides and along the crest.
  const lines = [];
  for (const [x, y] of [
    [x0 + 0.1, 0.03],
    [x1 - 0.1, 0.03],
    [(x0 + x1) / 2, h + 0.01],
  ])
    lines.push(placed(new T.BoxGeometry(0.16, 0.02, s.d - 0.1), x, y, s.z));
  mesh(group, merge(lines), mat("#f2c14e", { roughness: 0.6 }), 0, 0, 0, false);
}
// A pole by the start line with five red lights that come on one by one and go out: go!
function startLights(group, statics) {
  const s = statics.find((s) => s.kind === "start-lights");
  if (!s) return null;
  const steel = mat("#3a3d44", { roughness: 0.4, metal: 0.6 });
  tube(group, [s.x, 0, s.z], [s.x, s.h, s.z], s.radius, steel);
  mesh(group, new T.BoxGeometry(1.5, 0.4, 0.22), steel, s.x, s.h + 0.1, s.z);
  const lights = [];
  for (let i = 0; i < 5; i++) lights.push(mesh(group, new T.SphereGeometry(0.11, 12, 8), mat("#4a1a1a", { emissive: "#ff2a1a", glow: 0 }), s.x - 0.56 + i * 0.28, s.h + 0.1, s.z + 0.12, false));
  return lights;
}
function board(group, s) {
  mesh(group, new T.BoxGeometry(s.w + 0.2, s.h - 0.6, s.d), mat("#1d1f24", { roughness: 0.5 }), s.x, (s.h - 0.6) / 2 + 0.6, s.z);
  for (const dx of [-s.w / 2 + 0.2, s.w / 2 - 0.2]) mesh(group, new T.BoxGeometry(0.15, 0.6, 0.15), mat("#3a3d44"), s.x + dx, 0.3, s.z);
  let ctx = null,
    tex = null;
  try {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 320;
    ctx = cv.getContext("2d");
    if (ctx) {
      tex = new T.CanvasTexture(cv);
      tex.colorSpace = T.SRGBColorSpace;
    }
  } catch {}
  const screen = mesh(group, new T.PlaneGeometry(s.w, s.h - 0.8), mat("#0d0f13", { map: tex, emissive: "#ffffff", glow: tex ? 0.85 : 0 }), s.x, (s.h - 0.6) / 2 + 0.6, s.z + s.d / 2 + 0.01, false);
  if (tex) screen.material.emissiveMap = tex;
  const draw = (rows) => {
    if (!ctx) return;
    ctx.fillStyle = "#0d0f13";
    ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = "#f2c14e";
    ctx.font = "bold 40px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("ЛУЧШИЕ КРУГИ", 24, 52);
    ctx.font = "32px Arial, sans-serif";
    if (!rows.length) {
      ctx.fillStyle = "#9aa3b0";
      ctx.fillText("Пока никто не проехал круг", 24, 120);
      ctx.fillText("Карт — у автомата в боксах, E", 24, 165);
    }
    rows.forEach(([name, time], i) => {
      ctx.fillStyle = i ? "#e9edf3" : "#7fe08a";
      ctx.fillText(`${i + 1}. ${name}`.slice(0, 22), 24, 104 + i * 40);
      ctx.textAlign = "right";
      ctx.fillText(time, 488, 104 + i * 40);
      ctx.textAlign = "left";
    });
    tex.needsUpdate = true;
  };
  draw([]);
  return draw;
}
// The dispenser: a red cabinet with a screen, a big button and helmets.
function dispenser(g, p) {
  const c = p.colliders[0];
  mesh(g, new T.BoxGeometry(c.w, c.h, c.d), mat("#d8432f", { roughness: 0.45 }), 0, c.h / 2, 0);
  mesh(g, new T.BoxGeometry(c.w + 0.1, 0.12, c.d + 0.1), mat("#1d1f24"), 0, c.h + 0.06, 0);
  const sign = canvasTexture("dispenser", 256, (ctx, n) => {
    ctx.canvas.height = 160;
    ctx.fillStyle = "#101318";
    ctx.fillRect(0, 0, n, 160);
    ctx.fillStyle = "#f2c14e";
    ctx.font = "bold 44px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("КАРТЫ", n / 2, 56);
    ctx.fillStyle = "#e9edf3";
    ctx.font = "28px Arial, sans-serif";
    ctx.fillText("нажмите E", n / 2, 104);
    ctx.fillText("и в путь", n / 2, 140);
  });
  mesh(g, new T.PlaneGeometry(1.2, 0.75), mat(sign ? "#ffffff" : "#101318", { map: sign, emissive: "#ffffff", glow: 0.0 }), 0, 1.55, c.d / 2 + 0.01, false).material.emissiveMap = sign;
  const button = mesh(g, new T.CylinderGeometry(0.13, 0.15, 0.08, 18), mat("#f2c14e", { emissive: "#f2a14e", glow: 0.6 }), 0, 0.95, c.d / 2 + 0.02, false);
  button.rotation.x = Math.PI / 2;
  // A "pits" sign on a post beside it.
  mesh(g, new T.CylinderGeometry(0.05, 0.05, 2.6, 8), mat("#3a3d44"), -c.w / 2 - 0.35, 1.3, 0);
  const pits = canvasTexture("pits", 256, (ctx, n) => {
    ctx.canvas.height = 64;
    ctx.fillStyle = "#f2f2ee";
    ctx.fillRect(0, 0, n, 64);
    ctx.fillStyle = "#d8432f";
    ctx.font = "bold 34px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("БОКСЫ", n / 2, 34);
  });
  mesh(g, new T.PlaneGeometry(1.0, 0.25), mat(pits ? "#ffffff" : "#f2f2ee", { map: pits }), -c.w / 2 - 0.35, 2.45, 0.06, false);
  // A slot the karts roll out of and a stack of helmets.
  mesh(g, new T.BoxGeometry(c.w * 0.8, 0.35, 0.05), mat("#1d1f24"), 0, 0.3, c.d / 2 + 0.02, false);
  for (let i = 0; i < 3; i++) mesh(g, new T.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.7), mat(["#2f6fd8", "#f2c14e", "#69b35a"][i], { roughness: 0.3 }), c.w / 2 + 0.3, 0.17 + i * 0.22, 0.1);
  g.userData.update = (dt, t) => {
    button.material.emissiveIntensity = 0.4 + Math.max(0, Math.sin(t * 4)) * 1.2;
  };
}
registerProps({ "kart-dispenser": dispenser });

registerDecor("race", (group, map) => {
  const statics = map.statics || [];
  track(group);
  walls(group, statics);
  hump(group, statics);
  const lights = startLights(group, statics);
  const draw = board(
    group,
    statics.find((s) => s.kind === "board"),
  );
  return {
    setBoard: draw,
    update(dt, t) {
      if (!lights) return;
      // 0–5 lights on, a second each, then all out for two seconds.
      const k = t % 7,
        on = k < 5 ? Math.floor(k) + 1 : 0;
      lights.forEach((l, i) => (l.material.emissiveIntensity = i < on ? 2.2 : 0));
    },
  };
});
