import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  avatar,
  HEADWEAR,
  normalizeProfile,
  disposeAvatar,
} from "../dist/avatars.js";
import { ROOM, screenPoint, floorBack } from "../dist/layout.js";
import {
  ROOM_TARGET,
  roomDistance,
  framePortrait,
  createFloor,
} from "../dist/room.js";
import { CinemaScreen } from "../dist/cinema.js";
import { stepBody, stepCube } from "../dist/physics.js";
import { Playground } from "../dist/playground.js";

function roomCamera(aspect, degrees) {
  const camera = new T.PerspectiveCamera(43, aspect, 0.1, 180);
  const d = roomDistance(aspect),
    el = T.MathUtils.degToRad(degrees);
  camera.position
    .copy(ROOM_TARGET)
    .add(new T.Vector3(0, Math.sin(el) * d, Math.cos(el) * d));
  camera.lookAt(ROOM_TARGET);
  camera.updateMatrixWorld();
  return camera;
}

test("one fixed room distance keeps floor and spherical wall visible throughout 30–80 degrees", () => {
  for (const aspect of [16 / 9, 1363 / 936, 390 / 844]) {
    for (const angle of [30, 40, 60, 70, 80]) {
      const camera = roomCamera(aspect, angle);
      const points = [];
      for (const x of [-ROOM.halfWidth, 0, ROOM.halfWidth])
        points.push(
          new T.Vector3(x, 0, ROOM.front),
          new T.Vector3(x, 0, floorBack(x)),
        );
      for (const x of [-10.5, 0, 10.5]) {
        const p = screenPoint(x, ROOM.wallHeight);
        points.push(new T.Vector3(p.x, p.y, p.z));
      }
      for (const p of points) {
        p.project(camera);
        assert(
          Math.abs(p.x) <= 0.945 && Math.abs(p.y) <= 0.945,
          `${aspect}, ${angle}: ${p.toArray()}`,
        );
      }
    }
  }
});

test("the floor has a walkable top, bounded edges and no front, side or roof walls", () => {
  const scene = new T.Scene(),
    floor = createFloor(scene);
  scene.updateMatrixWorld(true);
  const ray = new T.Raycaster(new T.Vector3(0, 10, 0), new T.Vector3(0, -1, 0));
  const hit = ray.intersectObject(floor)[0];
  assert(hit && Math.abs(hit.point.y) < 1e-6);
  assert(hit.face.normal.y > 0.99);
  ray.set(new T.Vector3(0, 10, floorBack(0) - 0.2), new T.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(floor).length, 0);
});

test("all hats and animated hair are centered and fully framed in avatar squares", () => {
  for (const headwear of HEADWEAR.map(([id]) => id)) {
    const rig = avatar({
      id: "test",
      headwear,
      hairstyle: headwear === "none" ? "flame" : "short",
    });
    rig.root.rotation.y = -0.12;
    const camera = new T.PerspectiveCamera(31, 1, 0.1, 10);
    const bounds = framePortrait(camera, rig);
    const center = bounds.getCenter(new T.Vector3()).project(camera);
    assert(Math.abs(center.x) < 1e-6 && Math.abs(center.y) < 1e-6, headwear);
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const p = new T.Vector3(x, y, z).project(camera);
          assert(Math.abs(p.x) < 0.83 && Math.abs(p.y) < 0.83, headwear);
        }
    disposeAvatar(rig);
  }
  const migrated = normalizeProfile({ headwear: "cowboy", mask: "bear" });
  assert.equal(migrated.headwear, "bear");
  assert.equal(migrated.mask, "none");
});

test("side participants stay equal squares and never overlap at every room angle and count", () => {
  const players = Array.from({ length: 6 }, (_, i) => ({
    profile: { id: String(i) },
  }));
  const portraits = new Map(
    players.map((p) => [
      p.profile.id,
      { target: { texture: new T.Texture() } },
    ]),
  );
  const cinema = new CinemaScreen(players, portraits);
  cinema.setMedia({
    share: new T.Texture({ videoWidth: 1920, videoHeight: 1080 }),
  });
  for (let count = 1; count <= 6; count++) {
    cinema.setCount(count);
    for (const angle of [30, 60, 80]) {
      const camera = roomCamera(16 / 9, angle);
      cinema.updateCamera(camera);
      cinema.group.updateMatrixWorld(true);
      const rects = cinema.tiles
        .filter((t) => t.visible)
        .map((tile) => {
          const positions = tile.geometry.attributes.position;
          const points = Array.from({ length: positions.count }, (_, i) =>
            new T.Vector3()
              .fromBufferAttribute(positions, i)
              .applyMatrix4(tile.matrixWorld)
              .project(camera),
          );
          return {
            x0: (Math.min(...points.map((p) => p.x)) * 16) / 9,
            x1: (Math.max(...points.map((p) => p.x)) * 16) / 9,
            y0: Math.min(...points.map((p) => p.y)),
            y1: Math.max(...points.map((p) => p.y)),
          };
        });
      const width = rects[0].x1 - rects[0].x0;
      for (const r of rects) {
        assert(Math.abs(r.x1 - r.x0 - (r.y1 - r.y0)) < 1e-6);
        assert(Math.abs(r.x1 - r.x0 - width) < 1e-6);
      }
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i],
            b = rects[j];
          assert(
            a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0,
            `${count}, ${angle}`,
          );
        }
    }
  }
});

test("spools use round collisions, support landing and let the ball bounce", () => {
  const spool = {
    x: 0,
    z: 0,
    shape: "cylinder",
    radius: 1.25,
    w: 2.5,
    d: 2.5,
    h: 1.55,
  };
  const body = { x: 1.2, z: 1.2, y: 0, vy: 0, grounded: true };
  stepBody(body, { x: 0, z: 0 }, [spool], 1 / 120);
  assert.equal(body.x, 1.2);
  const falling = { x: 0, z: 0, y: 1.6, vy: -2, grounded: false };
  for (let i = 0; i < 10; i++)
    stepBody(falling, { x: 0, z: 0 }, [spool], 1 / 120);
  assert.equal(falling.y, 1.55);
  const b = {
    x: 1.69,
    z: 0,
    y: 0.42,
    size: 0.84,
    vx: -5,
    vy: 0,
    vz: 0,
    spin: 0,
  };
  for (let i = 0; i < 8; i++) stepCube(b, [spool], 1 / 120);
  assert(b.vx > 0);
});

test("goal is open at the front, stops shots in its net and rejects shots above its bar", () => {
  const playground = new Playground(new T.Scene());
  const goal = playground.goal;
  const body = { x: goal.x, z: goal.z + 0.8, y: 0, vy: 0, grounded: true };
  for (let i = 0; i < 30; i++)
    stepBody(body, { x: 0, z: -1 }, playground.colliders(), 1 / 120);
  assert(body.z < goal.z);
  const b = playground.ball;
  Object.assign(b, {
    x: goal.x,
    z: goal.z + 0.8,
    y: 0.42,
    vx: 0,
    vz: -10,
    vy: 0,
  });
  for (let i = 0; i < 50; i++) stepCube(b, playground.colliders(), 1 / 120);
  assert(b.z >= goal.z - 1.45 + 0.42 - 0.04);
  Object.assign(b, { x: goal.x, z: goal.z - 0.3, y: 3 });
  assert.equal(playground.checkGoal({ x: b.x, z: goal.z + 0.3, y: 3 }), false);
});
