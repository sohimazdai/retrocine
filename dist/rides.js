// How skateboards, scooters and BMX bikes look, and how they follow their riders: wheels roll,
// the deck flips for a kickflip, the deck whips round for a tailwhip, the bars spin for a barspin.
import * as T from "three";
import { own } from "./props.js";
import { rideInfo } from "./riding.js";

const m = (color, roughness = 0.6, metal = 0) => own(new T.MeshStandardMaterial({ color, roughness, metalness: metal }));
function add(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new T.Mesh(own(geometry), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function wheel(parent, r, width, x, y, z, tyre, hub) {
  const w = new T.Group();
  w.position.set(x, y, z);
  const t = add(w, new T.CylinderGeometry(r, r, width, 18), tyre);
  t.rotation.z = Math.PI / 2;
  if (hub) {
    const h = add(w, new T.CylinderGeometry(r * 0.45, r * 0.45, width + 0.01, 10), hub);
    h.rotation.z = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const spoke = add(w, new T.BoxGeometry(width * 0.4, r * 1.8, 0.012), hub);
      spoke.rotation.x = (i * Math.PI) / 4;
    }
  }
  parent.add(w);
  return { group: w, r };
}
const PALETTE = { skateboard: ["#e4573f", "#3f86b8", "#f2c14e"], scooter: ["#69b35a", "#9b6ad6", "#ef8a3a"], bike: ["#2f6fd8", "#d8432f", "#1d1d22"] };

export function buildRide(ride) {
  const g = new T.Group(),
    kind = ride.kind,
    colors = PALETTE[kind] || PALETTE.skateboard,
    color = colors[(ride.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
  const flip = new T.Group(),
    parts = { wheels: [], flip, kind };
  g.add(flip);
  const tyre = m("#25252a", 0.8),
    metal = m("#c9ccd2", 0.3, 0.8);
  if (kind === "skateboard") {
    // Deck along local z (the riding direction), kicktails, trucks and four wheels.
    flip.position.y = 0.1;
    const deck = add(flip, new T.BoxGeometry(0.24, 0.025, 0.78), m(color, 0.5), 0, 0.03, 0);
    for (const s of [-1, 1]) {
      const tail = add(flip, new T.BoxGeometry(0.24, 0.025, 0.14), m(color, 0.5), 0, 0.06, s * 0.45);
      tail.rotation.x = -s * 0.45;
    }
    add(flip, new T.BoxGeometry(0.23, 0.004, 0.76), m("#1d1d22", 0.95), 0, 0.044, 0);
    for (const z of [-0.26, 0.26]) {
      add(flip, new T.BoxGeometry(0.2, 0.03, 0.05), metal, 0, -0.005, z);
      for (const x of [-0.11, 0.11]) parts.wheels.push(wheel(flip, 0.035, 0.035, x, -0.045, z, m("#f2ead8", 0.5)));
    }
    parts.deck = deck;
  } else if (kind === "scooter") {
    // Deck, rear wheel, steering column with the front wheel and the T-bar.
    const deck = add(flip, new T.BoxGeometry(0.14, 0.04, 0.62), m(color, 0.45, 0.3), 0, 0.09, -0.06);
    add(flip, new T.BoxGeometry(0.13, 0.005, 0.5), m("#1d1d22", 0.95), 0, 0.113, -0.06);
    parts.wheels.push(wheel(flip, 0.07, 0.04, 0, 0.07, -0.42, tyre, metal));
    const bars = new T.Group();
    bars.position.set(0, 0.1, 0.27);
    add(bars, new T.CylinderGeometry(0.018, 0.018, 0.85, 8), metal, 0, 0.42, 0.06).rotation.x = -0.14;
    const t = add(bars, new T.CylinderGeometry(0.016, 0.016, 0.46, 8), metal, 0, 0.84, 0.0);
    t.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) add(bars, new T.CylinderGeometry(0.022, 0.022, 0.1, 8), m("#1d1d22", 0.9), s * 0.2, 0.84, 0).rotation.z = Math.PI / 2;
    parts.wheels.push(wheel(bars, 0.07, 0.04, 0, -0.03, 0.08, tyre, metal));
    g.add(bars);
    // A tailwhip spins the deck around the column, so the deck hangs from a pivot there.
    flip.position.set(0, 0, 0);
    parts.deck = deck;
    parts.bars = bars;
  } else {
    // BMX: two big wheels, frame, seat, bars that spin for a barspin.
    const frame = m(color, 0.4, 0.4);
    parts.wheels.push(wheel(flip, 0.27, 0.05, 0, 0.27, -0.46, tyre, metal), wheel(flip, 0.27, 0.05, 0, 0.27, 0.46, tyre, metal));
    const tube = (x0, y0, z0, x1, y1, z1, r = 0.022) => {
      const a = new T.Vector3(x0, y0, z0),
        b = new T.Vector3(x1, y1, z1),
        mesh = add(flip, new T.CylinderGeometry(r, r, a.distanceTo(b), 8), frame);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    };
    tube(0, 0.27, -0.46, 0, 0.3, -0.05);
    tube(0, 0.3, -0.05, 0, 0.58, 0.28);
    tube(0, 0.27, -0.46, 0, 0.58, -0.12);
    tube(0, 0.58, -0.12, 0, 0.58, 0.28);
    tube(0, 0.3, -0.05, 0, 0.62, -0.16);
    add(flip, new T.BoxGeometry(0.1, 0.05, 0.24), m("#1d1d22", 0.8), 0, 0.66, -0.2);
    add(flip, new T.CylinderGeometry(0.06, 0.06, 0.05, 12), metal, 0, 0.3, -0.05).rotation.z = Math.PI / 2;
    const bars = new T.Group();
    bars.position.set(0, 0.58, 0.32);
    add(bars, new T.CylinderGeometry(0.02, 0.02, 0.62, 8), metal, 0, -0.22, 0.08).rotation.x = 0.3;
    add(bars, new T.CylinderGeometry(0.018, 0.018, 0.56, 8), metal, 0, 0.18, 0).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) add(bars, new T.CylinderGeometry(0.024, 0.024, 0.12, 8), m("#1d1d22", 0.9), s * 0.25, 0.18, 0).rotation.z = Math.PI / 2;
    add(bars, new T.CylinderGeometry(0.016, 0.016, 0.22, 8), metal, 0, 0.08, 0);
    flip.add(bars);
    parts.bars = bars;
  }
  g.userData = { kind: "ride", id: ride.id, label: rideInfo(kind).label, parts };
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}
// Places a ride: on the floor where it was left, or under its rider with the rider's lean and pitch.
export function poseRide(g, { x, y, z, angle, pitch = 0, lean = 0, speed = 0, flip = -1, dt = 0 }) {
  const { parts } = g.userData;
  g.position.set(x, y, z);
  g.rotation.order = "YXZ";
  g.rotation.set(-pitch, angle, -lean * 0.18);
  for (const w of parts.wheels) w.group.rotation.x += (speed * dt) / w.r;
  const f = flip >= 0 ? flip : 0;
  if (parts.kind === "skateboard") parts.flip.rotation.z = f * Math.PI * 2;
  else if (parts.kind === "scooter") {
    // Tailwhip: the deck swings round the steering column.
    parts.flip.position.set(0, 0, 0.27);
    parts.flip.rotation.y = f * Math.PI * 2;
    parts.flip.children.forEach((c) => (c.userData.base ??= c.position.clone()));
    parts.flip.children.forEach((c) => c.position.copy(c.userData.base).add(new T.Vector3(0, 0, -0.27)));
  } else if (parts.bars) parts.bars.rotation.y = f * Math.PI * 2;
}
export function disposeRide(g) {
  g.traverse((o) => {
    if (o.geometry?.userData.own) o.geometry.dispose();
    if (o.material?.userData?.own) o.material.dispose();
  });
}
