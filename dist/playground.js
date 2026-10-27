import * as T from "three";
import { box, ball, material } from "./avatars.js";
import {
  STRUCTURES,
  clampStructure,
  structureColliders,
  ballDefaults,
  ballResetPosition,
  checkGoal,
} from "./world.js";

function cylinder(parent, radius, height, y, color) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(radius, radius, height, 48),
    material(color),
  );
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function line(parent, points, color, opacity = 1) {
  const geometry = new T.BufferGeometry().setFromPoints(
    points.map((p) => new T.Vector3(...p)),
  );
  const mesh = new T.LineSegments(
    geometry,
    new T.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
  );
  parent.add(mesh);
  return mesh;
}

export class Playground {
  constructor(scene, saved = {}) {
    this.structures = new Map();
    this.pickables = [];
    this.score = 0;
    const def = (id) => STRUCTURES.find((s) => s.id === id);
    const add = (id) => {
      const d = def(id);
      const root = new T.Group();
      root.userData = { kind: "structure", id, label: d.label };
      const s = {
        id,
        label: d.label,
        kind: d.kind,
        root,
        x: d.x,
        z: d.z,
        localColliders: d.colliders,
        waypoints: d.waypoints,
      };
      const pos = saved[id];
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.z))
        Object.assign(s, clampStructure(pos.x, pos.z));
      root.position.set(s.x, 0, s.z);
      scene.add(root);
      this.structures.set(id, s);
      this.pickables.push(root);
      return s;
    };
    const pyramid = add("pyramid"),
      tiers = pyramid.localColliders;
    tiers.forEach((tier, i) => {
      box(
        pyramid.root,
        tier.w,
        0.64,
        tier.d,
        ["#b69d7e", "#c2aa89", "#cfb795", "#dac5a6"][i],
        0,
        i * 0.64 + 0.32,
        0,
        0.055,
      );
      box(
        pyramid.root,
        tier.w - 0.12,
        0.025,
        tier.d - 0.12,
        "#e4d1ae",
        0,
        tier.h + 0.008,
        0,
        0.025,
      );
    });
    for (const id of ["spool-a", "spool-b"]) {
      const spool = add(id),
        h = def(id).h;
      cylinder(spool.root, 1.25, 0.17, 0.085, "#b18a60");
      cylinder(spool.root, 0.61, h - 0.25, h / 2, "#96714e");
      cylinder(spool.root, 1.25, 0.17, h - 0.085, "#c5a37a");
      cylinder(spool.root, 0.14, 0.006, h + 0.004, "#534433");
      for (const y of [0.04, h - 0.14]) {
        for (let i = -3; i <= 3; i++) {
          const x = i * 0.3,
            dz = Math.sqrt(1.23 ** 2 - x * x);
          line(
            spool.root,
            [
              [x, y + 0.145, -dz],
              [x, y + 0.145, dz],
            ],
            "#8b6746",
            0.65,
          );
        }
      }
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ball(
          spool.root,
          "#64584b",
          Math.cos(a) * 0.9,
          h + 0.008,
          Math.sin(a) * 0.9,
          0.045,
          0.018,
          0.045,
        );
      }
      for (let i = 0; i < 18; i++) {
        const a = (i * Math.PI) / 9;
        line(
          spool.root,
          [
            [Math.sin(a) * 0.612, 0.18, Math.cos(a) * 0.612],
            [Math.sin(a) * 0.612, h - 0.18, Math.cos(a) * 0.612],
          ],
          "#c8a77c",
          0.55,
        );
      }
    }
    this.goal = add("goal");
    const goalColliders = this.goal.localColliders;
    for (const x of [-2.1, 2.1]) {
      box(this.goal.root, 0.15, 2.55, 0.15, "#e9e5ed", x, 1.275, 0, 0.065);
      box(this.goal.root, 0.11, 0.1, 1.5, "#a399b2", x, 0.05, -0.72, 0.04);
    }
    box(this.goal.root, 4.35, 0.15, 0.15, "#e9e5ed", 0, 2.475, 0, 0.065);
    const net = [];
    for (let x = -2.1; x <= 2.11; x += 0.21) {
      net.push(
        [x, 0.08, -1.45],
        [x, 2.45, -1.45],
        [x, 2.45, -1.45],
        [x, 2.45, 0],
      );
    }
    for (let y = 0.08; y <= 2.46; y += 0.2) {
      net.push([-2.1, y, -1.45], [2.1, y, -1.45]);
      for (const x of [-2.1, 2.1]) net.push([x, y, -1.45], [x, y, 0]);
    }
    for (let z = -1.45; z <= 0.01; z += 0.21) {
      net.push([-2.1, 2.45, z], [2.1, 2.45, z]);
      for (const x of [-2.1, 2.1]) net.push([x, 0.08, z], [x, 2.45, z]);
    }
    line(this.goal.root, net, "#d5cadf", 0.5);
    // Nets are translucent geometry too, so snowballs and picking hit them.
    for (const c of goalColliders.slice(3))
      box(
        this.goal.root,
        c.w,
        c.h,
        c.d,
        new T.MeshBasicMaterial({
          color: "#d5cadf",
          transparent: true,
          opacity: 0.035,
          depthWrite: false,
        }),
        c.x,
        c.h / 2,
        c.z,
        0.005,
      );

    this.ball = ballDefaults();
    this.flags = { scored: false };
    this.ballMesh = new T.Group();
    this.ballMesh.userData = { kind: "ball", id: "football" };
    ball(this.ballMesh, "#f3eee6", 0, 0, 0, 0.42);
    const vertices = new T.IcosahedronGeometry(1, 0).attributes.position;
    const directions = new Map();
    for (let i = 0; i < vertices.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(vertices, i).normalize();
      directions.set(
        v
          .toArray()
          .map((n) => n.toFixed(3))
          .join(),
        v,
      );
    }
    for (const normal of directions.values()) {
      const geo = new T.CircleGeometry(0.14, 5);
      const patch = new T.Mesh(geo, material("#302c36"));
      patch.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), normal);
      patch.position.copy(normal).multiplyScalar(0.4);
      // Project the pentagon onto the sphere, rather than floating a flat decal.
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i),
          y = pos.getY(i);
        pos.setZ(i, Math.sqrt(0.423 ** 2 - x * x - y * y) - 0.4);
      }
      geo.computeVertexNormals();
      this.ballMesh.add(patch);
    }
    scene.add(this.ballMesh);
    this.pickables.push(this.ballMesh);
    this.update(0);
  }
  positions() {
    return Object.fromEntries(
      [...this.structures].map(([id, s]) => [id, { x: s.x, z: s.z }]),
    );
  }
  colliders() {
    return structureColliders(this.positions());
  }
  path(id) {
    const s = this.structures.get(id);
    return (
      s?.waypoints.map((p) => ({ ...p, x: p.x + s.x, z: p.z + s.z })) || []
    );
  }
  move(id, x, z) {
    const s = this.structures.get(id);
    s.x = x;
    s.z = z;
    s.root.position.set(x, 0, z);
  }
  resetBall() {
    Object.assign(this.ball, ballResetPosition(this.goal));
    this.flags.scored = false;
  }
  get scored() {
    return this.flags.scored;
  }
  checkGoal(previous) {
    if (!checkGoal(this.ball, previous, this.goal, this.flags)) return false;
    this.score++;
    return true;
  }
  update(dt) {
    const b = this.ball;
    this.ballMesh.position.set(b.x, b.y, b.z);
    const speed = Math.hypot(b.vx, b.vz);
    if (speed > 0.001)
      this.ballMesh.rotateOnWorldAxis(
        new T.Vector3(b.vz, 0, -b.vx).normalize(),
        (speed * dt) / (b.size / 2),
      );
  }
  snapshot() {
    return this.positions();
  }
}
