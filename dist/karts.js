// How a go-kart looks: a low chassis in the driver's colour, four fat wheels (the front ones steer),
// a steering wheel, a seat, bumpers, an engine with an exhaust and a number plate.
import * as T from "three";
import { KART } from "./karting.js";

const geo = (g) => g;
const mat = (color, roughness = 0.6, metal = 0) => new T.MeshStandardMaterial({ color, roughness, metalness: metal });
function part(parent, geometry, material, x, y, z) {
  const m = new T.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function buildKart(color = "#e4573f", number = 1) {
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);
  const L = KART.length,
    W = KART.width;
  const paint = mat(color, 0.35, 0.1),
    dark = mat("#22252b", 0.7),
    steel = mat("#c3c8cf", 0.3, 0.7),
    tyre = mat("#18191c", 0.9);
  // Floor pan, side pods and a nose.
  part(body, geo(new T.BoxGeometry(W * 0.62, 0.06, L * 0.9)), dark, 0, 0.12, 0);
  for (const s of [-1, 1]) part(body, geo(new T.BoxGeometry(0.16, 0.14, L * 0.5)), paint, (s * W) / 2 - s * 0.14, 0.2, -0.02);
  const nose = part(body, geo(new T.BoxGeometry(W * 0.7, 0.16, 0.34)), paint, 0, 0.2, L / 2 - 0.15);
  nose.rotation.x = -0.25;
  // Bumpers front and back.
  part(body, geo(new T.BoxGeometry(W * 0.8, 0.05, 0.05)), steel, 0, 0.17, L / 2 + 0.02);
  part(body, geo(new T.BoxGeometry(W * 0.9, 0.05, 0.05)), steel, 0, 0.17, -L / 2 - 0.02);
  // Seat and steering column with its wheel.
  part(body, geo(new T.BoxGeometry(0.42, 0.06, 0.4)), dark, 0, 0.2, -0.15);
  const back = part(body, geo(new T.BoxGeometry(0.42, 0.42, 0.06)), dark, 0, 0.42, -0.36);
  back.rotation.x = -0.25;
  const column = part(body, geo(new T.CylinderGeometry(0.02, 0.02, 0.45, 6)), steel, 0, 0.36, 0.33);
  column.rotation.x = 1.0;
  const wheel = new T.Group();
  wheel.position.set(0, 0.5, 0.2);
  wheel.rotation.x = -0.9;
  part(wheel, geo(new T.TorusGeometry(0.12, 0.018, 6, 18)), dark, 0, 0, 0);
  part(wheel, geo(new T.BoxGeometry(0.22, 0.025, 0.025)), dark, 0, 0, 0);
  body.add(wheel);
  // Engine on the right, exhaust behind.
  part(body, geo(new T.BoxGeometry(0.22, 0.2, 0.3)), mat("#5a5f68", 0.5, 0.4), -0.3, 0.27, -0.42);
  const pipe = part(body, geo(new T.CylinderGeometry(0.035, 0.035, 0.3, 8)), steel, -0.35, 0.22, -0.68);
  pipe.rotation.x = Math.PI / 2;
  // Number plate on the nose.
  const plate = new T.Mesh(geo(new T.PlaneGeometry(0.26, 0.18)), numberMaterial(number));
  plate.position.set(0, 0.29, L / 2 - 0.06);
  plate.rotation.x = -0.6;
  body.add(plate);
  // Wheels: wider at the back.
  const wheels = [],
    steer = [];
  for (const [x, z, w, front] of [
    [-W / 2, L / 2 - 0.22, 0.14, true],
    [W / 2, L / 2 - 0.22, 0.14, true],
    [-W / 2, -L / 2 + 0.24, 0.2, false],
    [W / 2, -L / 2 + 0.24, 0.2, false],
  ]) {
    const hub = new T.Group();
    hub.position.set(x, 0.14, z);
    const spin = new T.Group();
    const t = part(spin, geo(new T.CylinderGeometry(0.14, 0.14, w, 14)), tyre, 0, 0, 0);
    t.rotation.z = Math.PI / 2;
    const rim = part(spin, geo(new T.CylinderGeometry(0.07, 0.07, w + 0.01, 10)), steel, 0, 0, 0);
    rim.rotation.z = Math.PI / 2;
    hub.add(spin);
    body.add(hub);
    wheels.push(spin);
    if (front) steer.push(hub);
  }
  g.userData = { kind: "kart", body, wheels, steer, wheel, own: true };
  return g;
}
const plates = new Map();
function numberMaterial(n) {
  if (plates.has(n)) return plates.get(n);
  let map = null;
  try {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const c = cv.getContext("2d");
    if (c) {
      c.fillStyle = "#f6f3ea";
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = "#1d1f24";
      c.font = "bold 44px Arial, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(String(n), 32, 35);
      map = new T.CanvasTexture(cv);
      map.colorSpace = T.SRGBColorSpace;
    }
  } catch {}
  const m = new T.MeshStandardMaterial({ color: "#ffffff", map, roughness: 0.6 });
  plates.set(n, m);
  return m;
}
// Places the kart: where it is, which way it faces, nose up or down on a slope, wheels turned and rolling.
export function poseKart(g, x, y, z, angle, pitch = 0, steer = 0, roll = 0) {
  g.position.set(x, y, z);
  g.rotation.order = "YXZ";
  g.rotation.set(-pitch, angle, 0);
  const u = g.userData;
  for (const h of u.steer) h.rotation.y = steer * 0.45;
  for (const w of u.wheels) w.rotation.x = roll;
  u.wheel.rotation.z = -steer * 1.2;
}
export function disposeKart(g) {
  const shared = new Set(plates.values());
  g.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    if (!shared.has(o.material)) o.material.dispose();
  });
}
