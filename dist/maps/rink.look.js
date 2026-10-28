// How the winter rink looks: glossy ice with hockey markings and boards, hockey nets, a snowy hill
// with a sled run, a warming hut with smoke from the chimney, snowmen, a festive fir with lights,
// warm street lamps and falling snow.
import * as T from "three";
import { registerProps, BALL_BUILDERS, lines, cyl } from "../props.js";
import { registerDecor } from "../mapscene.js";
import { mat, mesh, merge, placed, worldBox, canvasTexture, TEXTURES, rng } from "./kit.js";
import { RINK } from "./rink.js";

const SNOW = "#f3f6fb",
  SNOW_SHADE = "#dfe7f2";

function iceTexture() {
  return canvasTexture("ice", 512, (c, n, r) => {
    const g = c.createLinearGradient(0, 0, n, n);
    g.addColorStop(0, "#cfe3f2");
    g.addColorStop(0.5, "#e3f0f9");
    g.addColorStop(1, "#c6dcee");
    c.fillStyle = g;
    c.fillRect(0, 0, n, n);
    // Skate marks: long thin arcs.
    for (let i = 0; i < 160; i++) {
      c.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.35})`;
      c.lineWidth = 0.6 + r();
      const x = r() * n,
        y = r() * n,
        l = 40 + r() * 140,
        a = r() * Math.PI;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 30, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 30, x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.stroke();
    }
    // A few cracks.
    c.strokeStyle = "rgba(120,160,195,0.35)";
    c.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      let x = r() * n,
        y = r() * n;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 5; k++) c.lineTo((x += (r() - 0.5) * 50), (y += (r() - 0.5) * 50));
      c.stroke();
    }
  });
}
function ice(group) {
  const w = RINK.x1 - RINK.x0,
    d = RINK.z1 - RINK.z0,
    tex = iceTexture()?.clone();
  if (tex) {
    tex.needsUpdate = true;
    tex.repeat.set(w / 8, d / 8);
  }
  const surface = mesh(group, new T.PlaneGeometry(w, d), mat(tex ? "#ffffff" : "#d6e8f5", { map: tex, roughness: 0.06, metal: 0.15 }), (RINK.x0 + RINK.x1) / 2, 0.012, (RINK.z0 + RINK.z1) / 2, false);
  surface.rotation.x = -Math.PI / 2;
  // Hockey markings: red centre line and circle, blue lines, goal creases.
  const paint = (color, opacity = 0.75) => mat(color, { roughness: 0.3, opacity, depthWrite: false });
  const flat = (geo, material, x, z) => {
    const m = mesh(group, geo, material, x, 0.016, z, false);
    m.rotation.x = -Math.PI / 2;
    return m;
  };
  flat(new T.PlaneGeometry(0.22, d - 0.2), paint("#d8432f"), 0, 0);
  flat(new T.RingGeometry(1.6, 1.72, 48), paint("#2f6fd8"), 0, 0);
  flat(new T.CircleGeometry(0.16, 16), paint("#2f6fd8"), 0, 0);
  for (const x of [-2.8, 2.8]) flat(new T.PlaneGeometry(0.2, d - 0.2), paint("#2f6fd8"), x, 0);
  for (const s of [-1, 1]) {
    flat(new T.PlaneGeometry(0.06, d - 0.2), paint("#d8432f"), s * (RINK.x1 - 1.4), 0);
    const crease = flat(new T.CircleGeometry(1.1, 24, -Math.PI / 2, Math.PI), paint("#7fb3e6", 0.45), s * (RINK.x1 - 1.4), 0);
    crease.rotation.z = s > 0 ? Math.PI : 0;
  }
}
function boards(group, list) {
  const parts = [],
    rails = [],
    ads = [];
  for (const b of list) {
    parts.push(placed(worldBox(b.w, b.h - 0.08, b.d, 1.5), b.x, (b.h - 0.08) / 2, b.z));
    rails.push(placed(new T.BoxGeometry(b.w + 0.06, 0.08, b.d + 0.1), b.x, b.h - 0.04, b.z));
  }
  mesh(group, merge(parts), mat("#f4f6f9", { roughness: 0.35 }));
  mesh(group, merge(rails), mat("#c0392b", { roughness: 0.5 }));
  // Colourful stickers along the boards facing the ice.
  const r = rng(4),
    colors = ["#f2c14e", "#2f6fd8", "#69b35a", "#e4573f"];
  for (const b of list) {
    const along = b.w > b.d,
      len = along ? b.w : b.d;
    for (let i = 0; i < Math.floor(len / 2.2); i++) {
      const t = -len / 2 + 1.1 + i * 2.2,
        x = along ? b.x + t : b.x - Math.sign(b.x) * 0.08,
        z = along ? b.z - Math.sign(b.z) * 0.08 : b.z + t;
      ads.push({ x, z, ry: along ? (b.z > 0 ? Math.PI : 0) : b.x > 0 ? -Math.PI / 2 : Math.PI / 2, c: colors[Math.floor(r() * 4)] });
    }
  }
  for (const a of ads) {
    const m = mesh(group, new T.PlaneGeometry(1.2, 0.32), mat(a.c, { roughness: 0.6 }), a.x, 0.32, a.z, false);
    m.rotation.y = a.ry;
  }
}
// A fir with snow on its branches; the festive one has baubles, lights and a star.
function fir(group, s, r) {
  const g = new T.Group();
  g.position.set(s.x, 0, s.z);
  mesh(g, new T.CylinderGeometry(0.12, 0.18, s.h * 0.25, 8), mat("#5b3d26"), 0, s.h * 0.12, 0);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const rr = s.h * (0.32 - i * 0.065),
      hh = s.h * (0.34 - i * 0.04),
      y = s.h * (0.18 + i * 0.19);
    mesh(g, new T.ConeGeometry(rr, hh, 9), mat(["#25503a", "#2c5d43", "#2f6448", "#346b4c"][i], { flat: true }), 0, y + hh / 2, 0).rotation.y = r() * 3;
    const cap = mesh(g, new T.ConeGeometry(rr * 0.82, hh * 0.38, 9), mat(SNOW, { flat: true, roughness: 0.9 }), 0, y + hh * 0.72, 0);
    cap.rotation.y = r() * 3;
  }
  const lights = [];
  if (s.festive) {
    const colors = ["#e4573f", "#f2c14e", "#3f86b8", "#c86dd7"];
    for (let i = 0; i < 18; i++) {
      const y = s.h * (0.22 + (i / 18) * 0.62),
        rr = s.h * 0.3 * (1 - (y / s.h - 0.15)) * 0.95,
        a = i * 2.2;
      mesh(g, new T.SphereGeometry(0.09, 10, 8), mat(colors[i % 4], { roughness: 0.2, metal: 0.4 }), Math.cos(a) * rr, y, Math.sin(a) * rr);
    }
    // A garland of small lights spiralling up.
    for (let i = 0; i < 40; i++) {
      const k = i / 40,
        y = s.h * (0.2 + k * 0.66),
        rr = s.h * 0.31 * (1 - k * 0.85),
        a = k * Math.PI * 7;
      lights.push(mesh(g, new T.SphereGeometry(0.035, 6, 4), mat("#fff3c4", { emissive: ["#ffcf6b", "#ff8a5a", "#9fd8ff"][i % 3], glow: 2 }), Math.cos(a) * rr, y, Math.sin(a) * rr, false));
    }
    const star = mesh(g, new T.OctahedronGeometry(0.22, 0), mat("#ffd65a", { emissive: "#ffb340", glow: 1.6, metal: 0.4 }), 0, s.h + 0.12, 0, false);
    star.scale.y = 1.3;
  }
  group.add(g);
  return lights;
}
function hut(group, h) {
  const tex = TEXTURES.wood();
  const logs = mat(tex ? "#c49a6c" : "#8a5a35", { map: tex, roughness: 0.85 });
  const g = new T.Group();
  g.position.set(h.x, 0, h.z);
  const wallH = h.h - 1.0;
  mesh(g, worldBox(h.w, wallH, h.d, 1.2), logs, 0, wallH / 2, 0);
  // Log ends at the corners.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      for (let y = 0.15; y < wallH; y += 0.3) {
        const end = mesh(g, new T.CylinderGeometry(0.12, 0.12, 0.3, 8), mat("#a87a50"), (sx * h.w) / 2, y, (sz * h.d) / 2);
        end.rotation.z = Math.PI / 2;
      }
  // Gabled roof with snow, door, warm window, chimney.
  const roof = new T.Shape();
  roof.moveTo(-h.w / 2 - 0.35, 0);
  roof.lineTo(0, 1.25);
  roof.lineTo(h.w / 2 + 0.35, 0);
  roof.lineTo(-h.w / 2 - 0.35, 0);
  const gable = mesh(g, new T.ExtrudeGeometry(roof, { depth: h.d + 0.5, bevelEnabled: false }), mat("#6b3a2a", { roughness: 0.8 }), 0, wallH, -h.d / 2 - 0.25);
  void gable;
  for (const s of [-1, 1]) {
    const slab = mesh(g, new T.BoxGeometry(h.w / 2 + 0.55, 0.14, h.d + 0.6), mat(SNOW, { roughness: 0.9 }), (s * (h.w / 2 + 0.35)) / 2, wallH + 0.68, 0);
    slab.rotation.z = -s * Math.atan2(1.25, h.w / 2 + 0.35);
  }
  mesh(g, new T.BoxGeometry(0.9, 1.6, 0.06), mat("#5a3520"), -0.6, 0.8, h.d / 2 + 0.03);
  mesh(g, new T.BoxGeometry(0.8, 0.6, 0.05), mat("#ffd58a", { emissive: "#ffb34a", glow: 1.4 }), 0.85, 1.25, h.d / 2 + 0.03, false);
  mesh(g, new T.BoxGeometry(0.05, 0.6, 0.06), mat("#5a3520"), 0.85, 1.25, h.d / 2 + 0.06);
  mesh(g, new T.BoxGeometry(0.8, 0.05, 0.06), mat("#5a3520"), 0.85, 1.25, h.d / 2 + 0.06);
  mesh(g, new T.BoxGeometry(0.4, 0.9, 0.4), mat("#7d6e66", { roughness: 0.9 }), h.w / 4, wallH + 1.0, -0.3);
  mesh(g, new T.BoxGeometry(0.46, 0.08, 0.46), mat(SNOW), h.w / 4, wallH + 1.47, -0.3);
  group.add(g);
  const light = new T.PointLight("#ffb860", 5, 7, 1.7);
  light.position.set(h.x + 0.85, 1.4, h.z + h.d / 2 + 0.8);
  group.add(light);
  return { x: h.x + h.w / 4, y: h.h + 0.5, z: h.z - 0.3 };
}
function hill(group, statics) {
  const top = statics.find((s) => s.kind === "hill"),
    run = statics.find((s) => s.kind === "sled-run"),
    steps = statics.find((s) => s.kind === "snow-steps");
  const snow = mat(SNOW, { roughness: 0.92 }),
    shade = mat(SNOW_SHADE, { roughness: 0.95 });
  mesh(group, new T.BoxGeometry(top.w, top.h, top.d), shade, top.x, top.h / 2, top.z);
  mesh(group, new T.BoxGeometry(top.w, 0.06, top.d), snow, top.x, top.h + 0.03, top.z);
  // The run: a smooth wedge with packed, shiny snow and soft banks along its sides.
  const len = Math.hypot(run.d, run.h0 - run.h1),
    angle = Math.atan2(run.h0 - run.h1, run.d);
  const wedge = new T.Shape();
  wedge.moveTo(-run.d / 2, 0);
  wedge.lineTo(-run.d / 2, run.h0);
  wedge.lineTo(run.d / 2, run.h1);
  wedge.lineTo(-run.d / 2, 0);
  // Turned so the shape's x runs along +z; the extrusion then goes toward -x.
  const body = mesh(group, new T.ExtrudeGeometry(wedge, { depth: run.w, bevelEnabled: false }), shade, run.x + run.w / 2, 0, run.z);
  body.rotation.y = -Math.PI / 2;
  const track = mesh(group, new T.PlaneGeometry(run.w - 0.5, len), mat("#e8f1fb", { roughness: 0.25, metal: 0.05 }), run.x, run.h0 / 2 + 0.03, run.z, false);
  track.rotation.x = -Math.PI / 2 + angle;
  for (const s of [-1, 1]) {
    const bank = mesh(group, new T.CapsuleGeometry(0.22, len - 0.4, 4, 8), snow, run.x + s * (run.w / 2 - 0.15), run.h0 / 2 + 0.12, run.z);
    bank.rotation.x = angle - Math.PI / 2;
  }
  // Packed-snow steps on the side.
  const n = 6,
    parts = [];
  for (let i = 0; i < n; i++) {
    const h = ((i + 1) * steps.h1) / n;
    parts.push(placed(new T.BoxGeometry(steps.w / n + 0.02, h, steps.d), steps.x - steps.w / 2 + (i + 0.5) * (steps.w / n), h / 2, steps.z));
  }
  mesh(group, merge(parts), shade);
  // Red flags along the run.
  for (const z of [run.z - run.d / 2 + 0.6, run.z + run.d / 2 - 0.8]) {
    const y = run.h0 - ((z - (run.z - run.d / 2)) / run.d) * (run.h0 - run.h1);
    cyl(group, 0.025, 0.025, 1.0, "#d9dde3", run.x - run.w / 2 - 0.15, y + 0.5, z, 6);
    const flag = mesh(group, new T.PlaneGeometry(0.35, 0.22), mat("#d8432f", { side: T.DoubleSide }), run.x - run.w / 2 - 0.15 + 0.18, y + 0.9, z, false);
    flag.rotation.y = Math.PI / 2;
  }
}
function lamp(group, s, glow) {
  cyl(group, 0.06, 0.09, s.h, "#2c3440", s.x, s.h / 2, s.z, 10, { roughness: 0.4 });
  cyl(group, 0.2, 0.14, 0.12, "#2c3440", s.x, s.h + 0.02, s.z, 10);
  glow.push(mesh(group, new T.SphereGeometry(0.17, 14, 10), mat("#fff1c8", { emissive: "#ffc46b", glow: 1.8 }), s.x, s.h - 0.16, s.z, false));
  const light = new T.PointLight("#ffcf8a", 7, 10, 1.6);
  light.position.set(s.x, s.h - 0.3, s.z);
  group.add(light);
}

// ——— Props and loose things ———
function hockeyNet(g, p) {
  const red = mat(p.color || "#d8432f", { roughness: 0.4, metal: 0.3 });
  const tube = (a, b) => {
    const va = new T.Vector3(...a),
      vb = new T.Vector3(...b);
    const m = mesh(g, new T.CylinderGeometry(0.04, 0.04, va.distanceTo(vb), 8), red);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  };
  for (const x of [-0.92, 0.92]) {
    tube([x, 0, 0], [x, 1.16, 0]);
    tube([x, 1.16, 0], [x * 0.9, 0.9, -0.55]);
    tube([x * 0.9, 0.9, -0.55], [x, 0, -0.9]);
    tube([x, 0.02, 0], [x, 0.02, -0.9]);
  }
  tube([-0.92, 1.16, 0], [0.92, 1.16, 0]);
  tube([-0.92, 0.02, -0.9], [0.92, 0.02, -0.9]);
  const net = [];
  for (let x = -0.9; x <= 0.91; x += 0.15) net.push([x, 1.14, 0], [x * 0.9, 0.9, -0.55], [x * 0.9, 0.9, -0.55], [x, 0.03, -0.9]);
  for (let k = 0; k <= 1.001; k += 0.125) {
    const y = 1.14 * (1 - k),
      z = -0.9 * k;
    net.push([-0.92, y, z], [0.92, y, z]);
  }
  lines(g, net, "#ffffff", 0.75);
  // Thin hit panels so pucks, snowballs and the mouse find the net.
  const ghostMat = mat("#ffffff", { opacity: 0.04, depthWrite: false });
  const back = mesh(g, new T.BoxGeometry(1.84, 1.15, 0.04), ghostMat, 0, 0.57, -0.75, false);
  back.rotation.x = -0.45;
  back.userData.ghost = true;
}
function snowman(g, p) {
  const snow = mat(SNOW, { roughness: 0.9 });
  mesh(g, new T.SphereGeometry(0.55, 20, 14), snow, 0, 0.5, 0);
  mesh(g, new T.SphereGeometry(0.4, 18, 12), snow, 0, 1.1, 0);
  mesh(g, new T.SphereGeometry(0.28, 16, 12), snow, 0, 1.55, 0);
  const coal = mat("#22252b", { roughness: 0.6 });
  for (const x of [-0.09, 0.09]) mesh(g, new T.SphereGeometry(0.035, 8, 6), coal, x, 1.62, 0.24, false);
  for (let i = 0; i < 3; i++) mesh(g, new T.SphereGeometry(0.04, 8, 6), coal, 0, 0.95 + i * 0.16, 0.38 - Math.abs(i - 1) * 0.03, false);
  const nose = mesh(g, new T.ConeGeometry(0.05, 0.28, 10), mat("#f08a2a"), 0, 1.55, 0.38, false);
  nose.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const arm = mesh(g, new T.CylinderGeometry(0.02, 0.025, 0.7, 5), mat("#6b4a2f"), s * 0.62, 1.22, 0);
    arm.rotation.z = s * 1.0;
  }
  if (p.hat === "bucket") {
    const bucket = mesh(g, new T.CylinderGeometry(0.2, 0.15, 0.3, 14), mat("#5b8fd8", { roughness: 0.4, metal: 0.4 }), 0.03, 1.88, 0);
    bucket.rotation.z = -0.25;
  } else if (p.hat === "hat") {
    mesh(g, new T.CylinderGeometry(0.3, 0.3, 0.03, 18), mat("#222"), 0, 1.79, 0);
    mesh(g, new T.CylinderGeometry(0.18, 0.18, 0.3, 18), mat("#222"), 0, 1.95, 0);
  }
  // Every snowman has a scarf.
  mesh(g, new T.TorusGeometry(0.27, 0.06, 8, 20), mat(p.hat === "scarf" ? "#69b35a" : "#d8432f"), 0, 1.33, 0).rotation.x = Math.PI / 2;
  mesh(g, new T.BoxGeometry(0.1, 0.35, 0.05), mat(p.hat === "scarf" ? "#69b35a" : "#d8432f"), 0.15, 1.18, 0.27);
}
function snowBench(g) {
  const wood = mat("#8a5a35", { roughness: 0.8 });
  for (let i = 0; i < 3; i++) mesh(g, new T.BoxGeometry(2.0, 0.05, 0.17), wood, 0, 0.45, -0.2 + i * 0.2);
  mesh(g, new T.BoxGeometry(1.9, 0.08, 0.55), mat(SNOW, { roughness: 0.9 }), 0, 0.51, 0);
  for (const x of [-0.85, 0.85]) mesh(g, new T.BoxGeometry(0.07, 0.43, 0.5), mat("#2c3440"), x, 0.21, 0);
}
registerProps({ "hockey-net": hockeyNet, snowman, "snow-bench": snowBench });
BALL_BUILDERS.puck = (g, b) => {
  // Sits flat on the ice: the physics sphere's centre is above the puck's middle.
  const r = b.size / 2;
  mesh(g, new T.CylinderGeometry(r * 0.75, r * 0.75, 0.09, 24), mat("#15171b", { roughness: 0.35 }), 0, -r + 0.05, 0);
  mesh(g, new T.CylinderGeometry(r * 0.76, r * 0.76, 0.02, 24), mat("#3a3d44", { roughness: 0.3 }), 0, -r + 0.05, 0);
};
BALL_BUILDERS.snowroll = (g, b) => {
  const r = b.size / 2;
  const m = mesh(g, new T.IcosahedronGeometry(r, 2), mat(SNOW, { roughness: 0.95, flat: true }));
  const pos = m.geometry.attributes.position,
    rand = rng(b.id.length * 31 + 5);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.94 + rand() * 0.1;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  m.geometry.computeVertexNormals();
  // Bits of grass and twigs caught in the snow.
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2,
      e = (rand() - 0.5) * 2;
    mesh(g, new T.BoxGeometry(0.03, 0.03, 0.12), mat("#6b5a3a"), Math.cos(a) * r * 0.97, e * r * 0.6, Math.sin(a) * r * 0.97, false);
  }
};

registerDecor("rink", (group, map) => {
  const statics = map.statics || [];
  ice(group);
  boards(
    group,
    statics.filter((s) => s.kind === "board"),
  );
  hill(group, statics);
  const chimney = hut(
    group,
    statics.find((s) => s.kind === "hut"),
  );
  const r = rng(17),
    twinkle = [],
    glow = [];
  for (const s of statics) {
    if (s.kind === "fir") twinkle.push(...fir(group, s, r));
    if (s.kind === "lamp") lamp(group, s, glow);
  }
  // Snowdrifts along the edges of the floor.
  const drifts = [];
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1,
      z = -6 + (i >> 1) * 1.3 + r() * 0.5;
    drifts.push(placed(new T.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), side * (14.4 + r() * 0.3), 0, z, r() * 3, 0, 0, [0.6 + r() * 0.5, 0.25 + r() * 0.2, 0.7 + r() * 0.5]));
  }
  mesh(group, merge(drifts), mat(SNOW, { roughness: 0.95 }));
  // Falling snow, drifting a little; and smoke from the hut's chimney.
  const count = 650,
    flakes = new Float32Array(count * 3),
    speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    flakes[i * 3] = (r() - 0.5) * 30;
    flakes[i * 3 + 1] = r() * 9;
    flakes[i * 3 + 2] = -12 + r() * 22.5;
    speeds[i] = 0.5 + r() * 0.6;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(flakes, 3));
  const snowfall = new T.Points(geometry, new T.PointsMaterial({ color: "#ffffff", size: 0.07, transparent: true, opacity: 0.85, depthWrite: false }));
  snowfall.userData.own = true;
  geometry.userData.own = true;
  snowfall.material.userData.own = true;
  snowfall.raycast = () => {};
  snowfall.frustumCulled = false;
  group.add(snowfall);
  const smoke = [];
  const smokeMat = mat("#c9cfd8", { opacity: 0.5, roughness: 1, depthWrite: false });
  for (let i = 0; i < 9; i++) {
    const puff = mesh(group, new T.SphereGeometry(0.22, 10, 8), smokeMat.clone(), chimney.x, chimney.y, chimney.z, false);
    puff.material.userData.own = true;
    puff.raycast = () => {};
    puff.userData.phase = i / 9;
    smoke.push(puff);
  }
  return {
    update(dt, t) {
      const pos = geometry.attributes.position;
      for (let i = 0; i < count; i++) {
        let y = pos.getY(i) - speeds[i] * dt;
        if (y < 0) y += 9;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(t * 0.7 + i) * 0.15 * dt);
      }
      pos.needsUpdate = true;
      for (const p of smoke) {
        const k = (t * 0.22 + p.userData.phase) % 1;
        p.position.set(chimney.x + Math.sin(k * 5 + p.userData.phase * 9) * 0.25 + k * 0.8, chimney.y + k * 2.6, chimney.z - k * 0.3);
        p.scale.setScalar(0.6 + k * 1.8);
        p.material.opacity = 0.45 * (1 - k);
      }
      twinkle.forEach((m, i) => m.material.emissiveIntensity && (m.material.emissiveIntensity = 1.2 + Math.sin(t * 3 + i * 1.7) * 0.9));
      glow.forEach((m, i) => (m.material.emissiveIntensity = 1.7 + Math.sin(t * 13 + i * 3) * 0.05));
    },
  };
});
