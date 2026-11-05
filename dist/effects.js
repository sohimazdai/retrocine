// Projectile models and short-lived visual effects: puffs, a bursting tomato, explosions, scorch marks.
import * as T from "three";

const sphere = new T.SphereGeometry(1, 14, 10),
  lowSphere = new T.SphereGeometry(1, 8, 6),
  circle = new T.CircleGeometry(1, 20),
  ring = new T.RingGeometry(0.82, 1, 48);
const mat = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
const UP = new T.Vector3(0, 1, 0);
// A tomato's insides, shared by every burst (pieces fade by shrinking, so nothing per hit changes them).
const JUICE = mat("#e3261b", { roughness: 0.15, emissive: "#7a0d06", emissiveIntensity: 0.5 }),
  FLESH = mat("#ffffff", { roughness: 0.4, flatShading: true }),
  STEM = mat("#3f7a2c"),
  LEAF = mat("#4c8f35"),
  TOMATO_FLESH = ["#d8382b", "#e8553d", "#f27a5a", "#b9231a", "#f2a07a", "#c92b20"],
  chunkGeometry = new T.IcosahedronGeometry(1, 0),
  stemGeometry = new T.CylinderGeometry(0.012, 0.02, 0.05, 6),
  leafGeometry = new T.ConeGeometry(0.05, 0.015, 5);

// One model per projectile kind, built once: every throw gets a clone that shares its geometry and
// materials (a throw used to make new ones each time and never free them).
const templates = new Map();
export function projectileMesh(kind) {
  if (kind.id === "mine") return buildProjectile(kind);
  let t = templates.get(kind.id);
  if (!t) templates.set(kind.id, (t = buildProjectile(kind)));
  const g = t.clone();
  // Parts the flight animates (clone() copies userData as JSON, so the links are made here).
  g.userData = { spark: g.getObjectByName("spark"), flame: g.getObjectByName("flame"), trail: kind.id === "fireball" };
  return g;
}
function buildProjectile(kind) {
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
    spark.name = "spark";
    g.add(m, cap, spark);
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
    flame.name = "flame";
    g.add(core, flame, glow);
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
  // A tomato bursting: juice sprays off whatever it hit and wet chunks of flesh and skin fly, bounce
  // and shrink away; the green top flies off on its own. Nothing stays behind. Drops and chunks are
  // two instanced meshes (two draw calls per hit, however many pieces).
  tomato(point, normal, along = null) {
    const n = normal.clone().normalize(),
      // Pieces come down on what was hit if it faces up (a table top), otherwise on the floor.
      ground = n.y > 0.6 ? point.y : 0,
      t = along ? along.clone().addScaledVector(n, -along.dot(n)) : new T.Vector3();
    if (t.lengthSq() > 1e-6) t.normalize();
    // Out of the surface, a little along the way the tomato was going.
    const fly = (min, max, up) => {
      const d = new T.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().addScaledVector(n, up).addScaledVector(t, 0.6).normalize();
      return { p: point.clone().addScaledVector(n, 0.03), v: d.multiplyScalar(min + Math.random() * (max - min)), landed: -1 };
    };
    const at = new T.Matrix4(),
      turn = new T.Quaternion(),
      size = new T.Vector3(),
      dir = new T.Vector3();
    // Juice: small drops stretched along their flight; on landing they flatten and are gone.
    const drops = Array.from({ length: 40 }, () => ({ ...fly(2.2, 6.5, 1), s: 0.026 + Math.random() * 0.03 }));
    const juice = new T.InstancedMesh(lowSphere, JUICE, drops.length);
    juice.frustumCulled = false;
    const moveDrops = (it, dt) => {
      drops.forEach((d, i) => {
        if (d.landed < 0) {
          d.v.y -= 9.8 * dt;
          d.p.addScaledVector(d.v, dt);
          if (d.p.y < ground + 0.004 && d.v.y < 0) {
            d.p.y = ground + 0.004;
            d.landed = it.age;
          }
        }
        if (d.landed >= 0) {
          const k = Math.max(0, 1 - (it.age - d.landed) / 0.18);
          turn.identity();
          size.set(d.s * 1.8 * k, d.s * 0.25 * k, d.s * 1.8 * k);
        } else {
          const speed = d.v.length() || 1;
          turn.setFromUnitVectors(UP, dir.copy(d.v).divideScalar(speed));
          size.set(d.s, d.s * (1 + speed * 0.3), d.s);
        }
        juice.setMatrixAt(i, at.compose(d.p, turn, size));
      });
      juice.instanceMatrix.needsUpdate = true;
    };
    moveDrops({ age: 0 }, 0);
    this.add(juice, 0.9, moveDrops, () => juice.dispose());
    // Chunks: flesh and skin in a few reds, tumbling; they bounce, settle and shrink away.
    const chunks = Array.from({ length: 14 }, (_, i) => {
      const c = fly(1.3, 4, 0.9),
        s = 0.05 + Math.random() * 0.07;
      return { ...c, s, shape: new T.Vector3(1, 0.45 + Math.random() * 0.45, 0.6 + Math.random() * 0.4).multiplyScalar(s), q: new T.Quaternion().random(), spin: new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(26), color: TOMATO_FLESH[i % TOMATO_FLESH.length] };
    });
    const flesh = new T.InstancedMesh(chunkGeometry, FLESH, chunks.length);
    flesh.frustumCulled = false;
    chunks.forEach((c, i) => flesh.setColorAt(i, new T.Color(c.color)));
    const spinBy = new T.Quaternion(),
      axis = new T.Vector3();
    const moveChunks = (it, dt) => {
      const k = Math.min(1, (it.life - it.age) / 0.4);
      chunks.forEach((c, i) => {
        if (c.landed < 0) {
          c.v.y -= 9.8 * dt;
          c.p.addScaledVector(c.v, dt);
          const r = c.shape.y;
          if (c.p.y < ground + r && c.v.y < 0) {
            c.p.y = ground + r;
            if (c.v.y < -0.9) {
              c.v.set(c.v.x * 0.55, -c.v.y * 0.28, c.v.z * 0.55);
              c.spin.multiplyScalar(0.5);
            } else c.landed = it.age;
          }
          const w = c.spin.length();
          if (w > 0 && dt > 0) c.q.premultiply(spinBy.setFromAxisAngle(axis.copy(c.spin).divideScalar(w), w * dt));
        }
        flesh.setMatrixAt(i, at.compose(c.p, c.q, size.copy(c.shape).multiplyScalar(k)));
      });
      flesh.instanceMatrix.needsUpdate = true;
    };
    moveChunks({ age: 0, life: 1.6 }, 0);
    this.add(flesh, 1.6, moveChunks, () => flesh.dispose());
    // The green top.
    const top = new T.Group();
    const stem = new T.Mesh(stemGeometry, STEM),
      leaf = new T.Mesh(leafGeometry, LEAF);
    stem.position.y = 0.02;
    top.add(stem, leaf);
    top.scale.setScalar(1.6);
    top.position.copy(point).addScaledVector(n, 0.05);
    const tv = n.clone().multiplyScalar(2.2).add(new T.Vector3(Math.random() - 0.5, 1.4, Math.random() - 0.5)),
      tspin = new T.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12);
    let topDown = false;
    this.add(top, 1.6, (it, dt) => {
      if (!topDown) {
        tv.y -= 9.8 * dt;
        top.position.addScaledVector(tv, dt);
        top.rotation.x += tspin.x * dt;
        top.rotation.z += tspin.z * dt;
        if (top.position.y < ground + 0.01 && tv.y < 0) {
          top.position.y = ground + 0.01;
          top.rotation.set(0, top.rotation.y, 0);
          topDown = true;
        }
      }
      top.scale.setScalar(1.6 * Math.min(1, (it.life - it.age) / 0.4));
    });
    // A wet pop at the hit, gone in a blink.
    const popMat = new T.MeshBasicMaterial({ color: "#e0452f", transparent: true, opacity: 0.55, depthWrite: false });
    const pop = new T.Mesh(lowSphere, popMat);
    pop.position.copy(point).addScaledVector(n, 0.04);
    this.add(pop, 0.22, (it) => {
      const k = it.age / it.life;
      pop.scale.setScalar(0.1 + k * 0.55);
      popMat.opacity = 0.55 * (1 - k);
    }, () => popMat.dispose());
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
        continue;
      }
      it.update?.(it, dt);
    }
  }
}
