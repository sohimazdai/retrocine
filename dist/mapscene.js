// Builds the selected map in the 3D room: floor look, scenery, props and balls. Rebuilt whenever the
// room switches maps. Physics data (colliders, positions) comes from world.js, shared with the server.
import * as T from "three";
import { buildProp, buildBall, disposeOwned } from "./props.js";
import { mapProps, obstacles, toWorld, tipShape, BALLS } from "./world.js";

const DECOR = new Map(),
  STATICS = {},
  UP = new T.Vector3(0, 1, 0);
// The pose part of a prop's position: turn, tilt and the side it tips to.
const pose = (p) => ({ yaw: p?.yaw || 0, ta: p?.ta || 0, td: p?.td || 0 });
// A map's renderer registers how its scenery looks: fn(group, map, ctx) → optional { update(dt, t) }.
export function registerDecor(id, fn) {
  DECOR.set(id, fn);
}
// Looks shared by every map for kinds of static colliders (fences, pull-up bars, …): fn(group, s, map).
export function registerStatics(builders) {
  Object.assign(STATICS, builders);
}
const DEFAULT_THEME = {
  floor: "#514959",
  side: "#352f42",
  grid: "#a193af",
  gridOpacity: 0.13,
  background: "#1c1b27",
  hemi: ["#eee1ff", "#484054", 2.1],
  key: ["#fff2df", 3.6],
  rim: ["#baa4f5", 1.4],
  frame: "#766884",
};
const textures = new Map();
// Procedural floor textures, drawn once on a canvas (1 texture repeat = 4 room units).
function floorTexture(kind) {
  if (!kind) return null;
  if (textures.has(kind)) return textures.get(kind);
  let texture = null;
  try {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const c = cv.getContext("2d");
    const rnd = (() => {
      let s = 7;
      return () => ((s = (s * 16807) % 2147483647) / 2147483647);
    })();
    const PAINTERS = {
      grass() {
        c.fillStyle = "#5f8f4e";
        c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 2200; i++) {
          c.fillStyle = ["#6fa35a", "#557f45", "#7cb265", "#4d7340"][i % 4];
          c.fillRect(rnd() * 256, rnd() * 256, 1.5, 3 + rnd() * 4);
        }
      },
      planks() {
        for (let i = 0; i < 8; i++) {
          c.fillStyle = ["#8a5b36", "#7d5131", "#95633b", "#835733"][i % 4];
          c.fillRect(0, i * 32, 256, 32);
          c.fillStyle = "#4a2f1c";
          c.fillRect(0, i * 32, 256, 2);
          const seam = ((i * 97) % 256) | 0;
          c.fillRect(seam, i * 32, 2, 32);
          for (let k = 0; k < 18; k++) {
            c.fillStyle = "#00000014";
            c.fillRect(rnd() * 256, i * 32 + 4 + rnd() * 24, 30 + rnd() * 60, 1);
          }
        }
      },
      sand() {
        c.fillStyle = "#d8bf8e";
        c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 2600; i++) {
          c.fillStyle = ["#cdb17c", "#e3cc9f", "#c4a873"][i % 3];
          c.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5);
        }
      },
      rubber() {
        c.fillStyle = "#3f7b8c";
        c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 1800; i++) {
          c.fillStyle = ["#e4734f", "#f2c14e", "#57a7b8", "#2f6676"][i % 4];
          c.fillRect(rnd() * 256, rnd() * 256, 2, 2);
        }
      },
      concrete() {
        c.fillStyle = "#9d9a96";
        c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 1600; i++) {
          c.fillStyle = ["#8f8c88", "#aaa7a2", "#94918d"][i % 3];
          c.fillRect(rnd() * 256, rnd() * 256, 2, 2);
        }
        c.fillStyle = "#7d7a76";
        c.fillRect(0, 0, 256, 2);
        c.fillRect(0, 0, 2, 256);
      },
      dirt() {
        c.fillStyle = "#86704f";
        c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 2400; i++) {
          c.fillStyle = ["#7a6446", "#927b58", "#6d5a3f", "#9a8460"][i % 4];
          c.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 2, 2);
        }
      },
      turf() {
        c.fillStyle = "#6b8a45";
        c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 26; i++) {
          c.fillStyle = ["#8a7a52", "#7d6e49", "#93835a"][i % 3] + "88";
          c.beginPath();
          c.ellipse(rnd() * 256, rnd() * 256, 8 + rnd() * 26, 5 + rnd() * 16, rnd() * 3, 0, Math.PI * 2);
          c.fill();
        }
        for (let i = 0; i < 2000; i++) {
          c.fillStyle = ["#7a9a50", "#5d7d3c", "#86a85a", "#6b8a45"][i % 4];
          c.fillRect(rnd() * 256, rnd() * 256, 1.5, 3 + rnd() * 3);
        }
      },
      snow() {
        c.fillStyle = "#e9eff7";
        c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 40; i++) {
          c.fillStyle = ["#dde6f2", "#f4f7fb", "#d3dded"][i % 3] + "aa";
          c.beginPath();
          c.ellipse(rnd() * 256, rnd() * 256, 10 + rnd() * 30, 6 + rnd() * 18, rnd() * 3, 0, Math.PI * 2);
          c.fill();
        }
        for (let i = 0; i < 1400; i++) {
          c.fillStyle = ["#ffffff", "#cfdbec", "#e2eaf5", "#b9c9e0"][i % 4];
          c.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
        }
      },
      gravel() {
        c.fillStyle = "#77736c";
        c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 900; i++) {
          c.fillStyle = ["#8c877f", "#66625b", "#9a958c", "#5b5852"][i % 4];
          c.fillRect(rnd() * 256, rnd() * 256, 3 + rnd() * 4, 2 + rnd() * 3);
        }
      },
    };
    (PAINTERS[kind] || PAINTERS.concrete)();
    texture = new T.CanvasTexture(cv);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(0.25, 0.25);
    texture.colorSpace = T.SRGBColorSpace;
  } catch {
    texture = null;
  }
  textures.set(kind, texture);
  return texture;
}

export class MapScene {
  constructor(scene, { floor, grid, hemi, key, rim }) {
    Object.assign(this, { scene, floor, grid, hemi, key, rim });
    this.root = new T.Group();
    scene.add(this.root);
    this.props = new Map();
    this.ballMeshes = new Map();
    this.pickables = [];
    this.version = 0;
    this.decor = null;
  }
  // Floor colour and texture, background, light mood and the screen frame colour of a map.
  applyTheme(theme) {
    const t = { ...DEFAULT_THEME, ...theme };
    const [top, side] = this.floor.material;
    top.color.set(t.texture ? t.tint || "#ffffff" : t.floor);
    top.map = floorTexture(t.texture);
    top.needsUpdate = true;
    side.color.set(t.side);
    this.grid.material.color.set(t.grid);
    this.grid.material.opacity = t.gridOpacity;
    this.grid.visible = t.gridOpacity > 0;
    this.scene.background = new T.Color(t.background);
    this.hemi.color.set(t.hemi[0]);
    this.hemi.groundColor.set(t.hemi[1]);
    this.hemi.intensity = t.hemi[2];
    this.key.color.set(t.key[0]);
    this.key.intensity = t.key[1];
    this.rim.color.set(t.rim[0]);
    this.rim.intensity = t.rim[1];
    this.theme = t;
  }
  build(map, positions, balls) {
    this.clear();
    this.map = map;
    this.applyTheme(map.theme || {});
    const decor = new T.Group();
    decor.userData = { kind: "static" };
    this.root.add(decor);
    this.decorRoot = decor;
    this.decor = DECOR.get(map.id)?.(decor, map, { scene: this.scene }) || null;
    for (const s of map.statics || []) STATICS[s.kind]?.(decor, s, map);
    // What lies beyond the floor's left and right edges (scenery only, not colliders).
    // On a bigger map (map.scale) it is drawn for the standard room and scaled up with the room, so
    // it looks the same from the camera that moved back.
    if (map.backdrop) {
      const far = new T.Group();
      far.scale.setScalar(map.scale || 1);
      decor.add(far);
      STATICS.backdrop?.(far, { style: map.backdrop }, map);
    }
    decor.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true;
    });
    if (decor.children.length) this.pickables.push(decor);
    for (const info of mapProps(map)) {
      const root = buildProp(info);
      root.rotation.y = info.rot || 0;
      root.userData = { ...root.userData, kind: "structure", id: info.id, label: info.label };
      const pos = positions?.[info.id] || info;
      root.position.set(pos.x, pos.y || 0, pos.z);
      this.root.add(root);
      this.props.set(info.id, {
        id: info.id,
        info,
        root,
        label: info.label,
        kind: info.kind,
        x: pos.x,
        z: pos.z,
        y: pos.y || 0,
        localColliders: info.local,
        waypoints: info.waypoints || [],
        movable: Number.isFinite(info.weight),
      });
      // Already knocked about (someone joining late): drawn as it stands or lies.
      const s = this.props.get(info.id);
      s.pose = pose(pos);
      s.view = { x: s.x, z: s.z, y: s.y, ...s.pose };
      this.applyPose(s);
      this.pickables.push(root);
    }
    this.setBalls(balls || []);
    this.version++;
  }
  setBalls(balls) {
    for (const { mesh } of this.ballMeshes.values()) {
      this.root.remove(mesh);
      disposeOwned(mesh);
      this.pickables = this.pickables.filter((p) => p !== mesh);
    }
    this.ballMeshes.clear();
    for (const b of balls) {
      const mesh = buildBall(b);
      mesh.userData = { kind: "ball", id: b.id };
      mesh.position.set(b.x, b.y, b.z);
      mesh.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
      });
      this.root.add(mesh);
      this.ballMeshes.set(b.id, { mesh, ball: b, base: b.size, slides: !!BALLS[b.kind]?.slides });
      this.pickables.push(mesh);
    }
  }
  // A prop's place and pose (yaw, ta, td — see world.js). Colliders follow at once; the picture
  // eases there (tickProps), so the 30-a-second updates of a prop in motion look smooth.
  move(id, x, z, y = 0, p = null) {
    const s = this.props.get(id);
    if (!s) return;
    s.x = x;
    s.z = z;
    s.y = y;
    s.pose = pose(p);
    // Far away (dragged across, a new state): no easing.
    if (!s.view || Math.hypot(s.view.x - x, s.view.z - z) > 3 || Math.abs((s.view.y || 0) - y) > 0.5) {
      s.view = { x, z, y, ...s.pose };
      this.applyPose(s);
    }
    this.version++;
  }
  // The prop's root from its pose: turned by its rot and yaw, tipped about the bottom edge of the
  // side it falls to.
  applyPose(s) {
    const v = s.view,
      yawQ = new T.Quaternion().setFromAxisAngle(UP, v.yaw || 0),
      rotQ = new T.Quaternion().setFromAxisAngle(UP, s.info.rot || 0),
      at = new T.Vector3(v.x, v.y || 0, v.z);
    if (v.ta > 1e-3) {
      const sh = tipShape(s.info, v.td),
        tilt = new T.Quaternion().setFromAxisAngle(new T.Vector3(sh.az, 0, -sh.ax), v.ta),
        pivot = new T.Vector3(sh.ax * sh.edge, 0, sh.az * sh.edge);
      // Turning about the pivot: the origin moves by pivot − tilt·pivot (in the prop's frame).
      at.add(pivot.clone().sub(pivot.clone().applyQuaternion(tilt)).applyQuaternion(yawQ));
      s.root.quaternion.copy(yawQ).multiply(tilt).multiply(rotQ);
    } else s.root.quaternion.copy(yawQ).multiply(rotQ);
    s.root.position.copy(at);
  }
  // Eases the pictures of moving props toward where they are.
  tickProps(dt) {
    const k = 1 - Math.exp(-dt * 22);
    for (const s of this.props.values()) {
      const v = s.view;
      if (!v) continue;
      const target = { x: s.x, z: s.z, y: s.y || 0, ...s.pose };
      const dyaw = Math.atan2(Math.sin(target.yaw - v.yaw), Math.cos(target.yaw - v.yaw));
      // A different side to fall to: come up first, then go over the new way.
      const sameSide = v.td === target.td || v.ta < 1e-3;
      const goalTa = sameSide ? target.ta : 0;
      const far = Math.abs(target.x - v.x) + Math.abs(target.z - v.z) + Math.abs(target.y - (v.y || 0)) + Math.abs(dyaw) + Math.abs(goalTa - v.ta);
      if (far < 1e-4 && sameSide) continue;
      v.x += (target.x - v.x) * k;
      v.z += (target.z - v.z) * k;
      v.y = (v.y || 0) + (target.y - (v.y || 0)) * k;
      v.yaw += dyaw * k;
      v.ta += (goalTa - v.ta) * k;
      if (v.ta < 1e-3) {
        v.ta = 0;
        v.td = target.td;
      }
      if (far < 1e-3) Object.assign(v, target);
      this.applyPose(s);
    }
  }
  // Seesaw tilt (−1…1): changes the plank's slope in the colliders and its angle on screen.
  setTilt(id, tilt) {
    const s = this.props.get(id);
    if (!s) return;
    s.tilt = tilt;
    this.version++;
  }
  positions() {
    return Object.fromEntries(
      [...this.props].map(([id, s]) => {
        const p = { x: s.x, z: s.z };
        if (s.y) p.y = s.y;
        if (s.tilt != null) p.tilt = s.tilt;
        if (s.pose?.yaw) p.yaw = s.pose.yaw;
        if (s.pose?.ta) Object.assign(p, { ta: s.pose.ta, td: s.pose.td });
        return [id, p];
      }),
    );
  }
  // All colliders: scenery and props at their current places. Cached until something moves.
  colliders() {
    if (this.cache?.version === this.version) return this.cache.list;
    const list = this.map ? obstacles(this.map, this.positions()) : [];
    this.cache = { version: this.version, list };
    return list;
  }
  path(id) {
    const s = this.props.get(id);
    // Knocked over, there is nowhere to climb onto.
    if (!s || s.pose?.ta > 0.2) return [];
    return s.waypoints.map((p) => {
      const o = toWorld((s.info.rot || 0) + (s.pose?.yaw || 0), p.x, p.z);
      return { ...p, x: s.x + o.x, z: s.z + o.z, h: p.h + (s.y || 0) };
    });
  }
  update(dt, t) {
    for (const { mesh, ball, base, slides } of this.ballMeshes.values()) {
      mesh.position.set(ball.x + (ball.ox || 0), ball.y + (ball.oy || 0), ball.z + (ball.oz || 0));
      // Snowballs grow as they roll.
      if (ball.size !== base) mesh.scale.setScalar(ball.size / base);
      const speed = Math.hypot(ball.vx, ball.vz);
      // A puck slides and spins flat; balls roll.
      if (slides) mesh.rotation.y += (ball.spin || speed * 0.8) * dt;
      else if (speed > 0.001) mesh.rotateOnWorldAxis(new T.Vector3(ball.vz, 0, -ball.vx).normalize(), (speed * dt) / (ball.size / 2));
    }
    this.decor?.update?.(dt, t);
    // Props that move on their own (fountain water, seesaw plank) update their meshes here.
    for (const s of this.props.values()) s.root.userData.update?.(dt, t, s);
  }
  clear() {
    for (const s of this.props.values()) disposeOwned(s.root);
    if (this.decorRoot) disposeOwned(this.decorRoot);
    this.decor?.dispose?.();
    for (const { mesh } of this.ballMeshes.values()) disposeOwned(mesh);
    this.root.clear();
    this.props.clear();
    this.ballMeshes.clear();
    this.pickables = [];
    this.decor = null;
    this.decorRoot = null;
    this.version++;
  }
}
