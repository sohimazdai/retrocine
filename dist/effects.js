// Projectile models and short-lived visual effects: splats, puffs, explosions, scorch marks.
import * as T from "three";

const sphere = new T.SphereGeometry(1, 14, 10),
  lowSphere = new T.SphereGeometry(1, 8, 6),
  circle = new T.CircleGeometry(1, 20),
  ring = new T.RingGeometry(0.82, 1, 48);
const mat = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

// One model per projectile kind; the caller positions it.
export function projectileMesh(kind) {
  const g = new T.Group();
  const r = kind.radius;
  if (kind.id === "snow") {
    const m = new T.Mesh(sphere, mat("#faf5ff", { roughness: 0.85 }));
    m.scale.setScalar(r);
    g.add(m);
  } else if (kind.id === "tomato") {
    const m = new T.Mesh(sphere, mat("#d8382b", { roughness: 0.35 }));
    m.scale.set(r, r * 0.86, r);
    const stem = new T.Mesh(new T.CylinderGeometry(0.012, 0.02, 0.05, 6), mat("#3f7a2c"));
    stem.position.y = r * 0.9;
    const leaf = new T.Mesh(new T.ConeGeometry(0.05, 0.015, 5), mat("#4c8f35"));
    leaf.position.y = r * 0.82;
    g.add(m, stem, leaf);
  } else if (kind.id === "tennis") {
    const m = new T.Mesh(sphere, mat("#d8ef4a", { roughness: 0.95 }));
    m.scale.setScalar(r);
    const seam = new T.Mesh(new T.TorusGeometry(r * 1.0, 0.006, 4, 32), mat("#f4f6ee"));
    seam.rotation.set(0.6, 0.4, 0);
    g.add(m, seam);
  } else if (kind.id === "rock") {
    const m = new T.Mesh(new T.DodecahedronGeometry(r, 0), mat("#8b8680", { roughness: 0.95, flatShading: true }));
    m.scale.set(1.1, 0.85, 0.95);
    g.add(m);
  } else if (kind.id === "brick") {
    const m = new T.Mesh(new T.BoxGeometry(0.25, 0.085, 0.12), mat("#a8543b", { roughness: 0.9 }));
    g.add(m);
  } else if (kind.id === "grenade") {
    const m = new T.Mesh(new T.IcosahedronGeometry(r, 1), mat("#4e5b3a", { roughness: 0.6, flatShading: true }));
    m.scale.set(1, 1.18, 1);
    const cap = new T.Mesh(new T.CylinderGeometry(0.03, 0.035, 0.05, 8), mat("#8c8f86", { metalness: 0.6 }));
    cap.position.y = r * 1.15;
    const spark = new T.Mesh(lowSphere, new T.MeshBasicMaterial({ color: "#ffd36b" }));
    spark.scale.setScalar(0.025);
    spark.position.y = r * 1.45;
    g.add(m, cap, spark);
    g.userData.spark = spark;
  } else if (kind.id === "fireball") {
    const core = new T.Mesh(sphere, new T.MeshBasicMaterial({ color: "#fff1b0" }));
    core.scale.setScalar(r * 0.55);
    const flame = new T.Mesh(
      sphere,
      new T.MeshBasicMaterial({ color: "#ff7a1f", transparent: true, opacity: 0.75, depthWrite: false, blending: T.AdditiveBlending }),
    );
    flame.scale.setScalar(r);
    const glow = new T.Mesh(
      sphere,
      new T.MeshBasicMaterial({ color: "#ff4a10", transparent: true, opacity: 0.25, depthWrite: false, blending: T.AdditiveBlending }),
    );
    glow.scale.setScalar(r * 1.9);
    g.add(core, flame, glow);
    g.userData.flame = flame;
    g.userData.trail = true;
  } else if (kind.id === "icicle") {
    // A sharp shard of clear ice.
    const ice = mat("#cfefff", { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85, emissive: "#6fc8ff", emissiveIntensity: 0.35 });
    const shard = new T.Mesh(new T.ConeGeometry(0.06, 0.34, 6), ice);
    shard.rotation.x = Math.PI / 2;
    const back = new T.Mesh(new T.ConeGeometry(0.06, 0.08, 6), ice);
    back.rotation.x = -Math.PI / 2;
    back.position.z = -0.2;
    g.add(shard, back);
  } else if (kind.id === "mine") {
    g.add(mineModel());
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

// A flat land mine: an olive disc with a ribbed rim, a pressure plate and a red lamp (userData.lamp).
export function mineModel() {
  const g = new T.Group();
  const body = new T.Mesh(new T.CylinderGeometry(0.28, 0.32, 0.09, 20), mat("#4a5636", { roughness: 0.65, metalness: 0.25 }));
  body.position.y = 0.045;
  const rim = new T.Mesh(new T.TorusGeometry(0.29, 0.025, 6, 24), mat("#323b25", { roughness: 0.6, metalness: 0.3 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.07;
  const plate = new T.Mesh(new T.CylinderGeometry(0.13, 0.15, 0.04, 16), mat("#6b7556", { roughness: 0.5, metalness: 0.4 }));
  plate.position.y = 0.11;
  const lamp = new T.Mesh(lowSphere, new T.MeshStandardMaterial({ color: "#5a1410", emissive: "#ff2a14", emissiveIntensity: 0.25, roughness: 0.3 }));
  lamp.scale.setScalar(0.035);
  lamp.position.set(0.19, 0.1, 0);
  g.add(body, rim, plate, lamp);
  g.userData.lamp = lamp;
  g.userData.body = body;
  return g;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.splats = [];
  }
  add(object, life, update, dispose) {
    this.scene.add(object);
    this.items.push({ object, life, age: 0, update, dispose });
    return object;
  }
  remove(item) {
    item.object.parent?.remove(item.object);
    item.dispose?.();
  }
  // Small debris burst where something hit.
  puff(point, color = "#faf5ff", count = 10, speed = 3, size = 0.035) {
    const material = mat(color, { roughness: 0.8 });
    for (let i = 0; i < count; i++) {
      const m = new T.Mesh(lowSphere, material);
      m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      m.position.copy(point);
      const v = new T.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 0.7, (Math.random() - 0.5) * speed);
      const s0 = m.scale.x;
      this.add(m, 0.65, (it, dt) => {
        v.y -= 8 * dt;
        m.position.addScaledVector(v, dt);
        m.scale.setScalar(Math.max(0.001, s0 * (1 - it.age / it.life)));
      }, i === count - 1 ? () => material.dispose() : null);
    }
  }
  // A flat stain on whatever was hit; on an avatar it sticks to the avatar.
  splat(point, normal, color, parent = null, size = 0.32) {
    const material = new T.MeshStandardMaterial({ color, roughness: 0.35, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const m = new T.Mesh(circle, material);
    const n = normal.clone().normalize();
    m.position.copy(point).addScaledVector(n, 0.012);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), n);
    m.rotateZ(Math.random() * Math.PI * 2);
    m.scale.set(size * (0.8 + Math.random() * 0.5), size * (0.6 + Math.random() * 0.4), 1);
    for (let i = 0; i < 4; i++) {
      const drop = new T.Mesh(circle, material);
      const a = Math.random() * Math.PI * 2,
        d = 0.9 + Math.random() * 0.7;
      drop.position.set(Math.cos(a) * d, Math.sin(a) * d, 0);
      drop.scale.setScalar(0.12 + Math.random() * 0.2);
      m.add(drop);
    }
    if (parent) {
      parent.updateMatrixWorld(true);
      parent.attach(m);
    } else this.scene.add(m);
    const item = { object: m, life: 24, age: 0, update: (it) => (material.opacity = 0.95 * Math.min(1, (it.life - it.age) / 4)), dispose: () => material.dispose() };
    this.items.push(item);
    this.splats.push(item);
    if (this.splats.length > 60) {
      const old = this.splats.shift();
      old.age = old.life;
    }
  }
  // Fire, smoke, sparks, a shock ring, a light flash and a scorch mark that fades.
  explosion(point, radius = 4) {
    const s = radius / 4;
    const flash = new T.PointLight("#ffb35a", 60, radius * 4, 2);
    flash.position.copy(point).add(new T.Vector3(0, 0.6, 0));
    this.add(flash, 0.45, (it) => (flash.intensity = 60 * (1 - it.age / it.life)), () => flash.dispose?.());
    const fireMat = new T.MeshBasicMaterial({ color: "#ffb347", transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    const ball = new T.Mesh(sphere, fireMat);
    ball.position.copy(point);
    this.add(ball, 0.5, (it) => {
      const k = it.age / it.life;
      ball.scale.setScalar(radius * 0.55 * (0.3 + 0.7 * Math.sqrt(k)));
      fireMat.opacity = 0.9 * (1 - k);
      fireMat.color.setHSL(0.09 - 0.06 * k, 1, 0.6 - 0.25 * k);
    }, () => fireMat.dispose());
    for (let i = 0; i < 9; i++) {
      const puffMat = new T.MeshStandardMaterial({ color: "#5b5560", roughness: 1, transparent: true, opacity: 0.8, depthWrite: false });
      const smoke = new T.Mesh(sphere, puffMat);
      const dir = new T.Vector3((Math.random() - 0.5) * 2, 0.4 + Math.random(), (Math.random() - 0.5) * 2).normalize();
      smoke.position.copy(point).addScaledVector(dir, 0.3 * s);
      const grow = (0.5 + Math.random() * 0.6) * s;
      this.add(smoke, 1.6 + Math.random() * 0.6, (it, dt) => {
        const k = it.age / it.life;
        smoke.position.addScaledVector(dir, dt * 2.2 * s * (1 - k));
        smoke.position.y += dt * 0.9;
        smoke.scale.setScalar(grow * (0.4 + k * 1.4));
        puffMat.opacity = 0.75 * (1 - k);
      }, () => puffMat.dispose());
    }
    const sparkMat = new T.MeshBasicMaterial({ color: "#ffd77a" });
    for (let i = 0; i < 16; i++) {
      const spark = new T.Mesh(lowSphere, sparkMat);
      spark.scale.setScalar(0.04 * s);
      spark.position.copy(point);
      const v = new T.Vector3((Math.random() - 0.5) * 14, Math.random() * 9, (Math.random() - 0.5) * 14).multiplyScalar(s);
      this.add(spark, 0.9, (it, dt) => {
        v.y -= 16 * dt;
        spark.position.addScaledVector(v, dt);
        if (spark.position.y < 0.02) {
          spark.position.y = 0.02;
          v.y *= -0.3;
          v.x *= 0.6;
          v.z *= 0.6;
        }
      }, i === 15 ? () => sparkMat.dispose() : null);
    }
    const ringMat = new T.MeshBasicMaterial({ color: "#ffe2b0", transparent: true, side: T.DoubleSide, depthWrite: false });
    const wave = new T.Mesh(ring, ringMat);
    wave.rotation.x = -Math.PI / 2;
    wave.position.set(point.x, 0.04, point.z);
    this.add(wave, 0.45, (it) => {
      const k = it.age / it.life;
      wave.scale.setScalar(radius * k);
      ringMat.opacity = 0.7 * (1 - k);
    }, () => ringMat.dispose());
    const scorchMat = new T.MeshBasicMaterial({ color: "#1d1813", transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const scorch = new T.Mesh(circle, scorchMat);
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(point.x, 0.012, point.z);
    scorch.scale.setScalar(radius * 0.32);
    this.add(scorch, 20, (it) => (scorchMat.opacity = 0.55 * Math.min(1, (it.life - it.age) / 5)), () => scorchMat.dispose());
  }
  // Glowing embers behind a flying fireball.
  ember(point) {
    const m = new T.MeshBasicMaterial({ color: "#ff8a2a", transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    const e = new T.Mesh(lowSphere, m);
    e.position.copy(point);
    const s0 = 0.06 + Math.random() * 0.05;
    this.add(e, 0.35, (it) => {
      const k = it.age / it.life;
      e.scale.setScalar(s0 * (1 - k));
      m.opacity = 0.8 * (1 - k);
      e.position.y += 0.01;
    }, () => m.dispose());
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      if (it.age >= it.life) {
        this.remove(it);
        this.items.splice(i, 1);
        const j = this.splats.indexOf(it);
        if (j >= 0) this.splats.splice(j, 1);
        continue;
      }
      it.update?.(it, dt);
    }
  }
}
