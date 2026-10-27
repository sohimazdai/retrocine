import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  avatar,
  HEADWEAR,
  normalizeProfile,
  disposeAvatar,
} from "../dist/avatars.js";
import { ROOM, screenPoint, floorBack, setWallShape } from "../dist/layout.js";
import {
  fitRoomCamera,
  fitWall,
  ELEVATION,
  framePortrait,
  createFloor,
} from "../dist/room.js";
import { CinemaScreen } from "../dist/cinema.js";
import { stepBody, stepCube } from "../dist/physics.js";
import { obstacles, defaultPositions, defaultBalls, goalsOf, checkGoal, mapDef } from "../dist/world.js";

function roomCamera(aspect, degrees) {
  const camera = fitRoomCamera(new T.PerspectiveCamera(43, aspect, 0.1, 400), degrees);
  const wall = fitWall(camera);
  setWallShape(wall.height, wall.edges);
  return camera;
}
const ndc = (camera, p) => new T.Vector3(p.x, p.y, p.z).project(camera);

test("near floor corners sit in the bottom corners of the viewport at every angle from 15 to 45 degrees", () => {
  assert.deepEqual([ELEVATION.min, ELEVATION.initial, ELEVATION.max], [15, 30, 45]);
  for (const aspect of [16 / 9, 1363 / 936, 2000 / 980, 4 / 3])
    for (const angle of [15, 22, 30, 38, 45]) {
      const camera = roomCamera(aspect, angle);
      for (const side of [-1, 1]) {
        const p = ndc(camera, { x: side * ROOM.halfWidth, y: 0, z: ROOM.front });
        assert(Math.abs(p.x - side) < 1e-9 && Math.abs(p.y + 1) < 1e-9, `${aspect} ${angle}: ${p.toArray()}`);
      }
      // The camera looks down at exactly that angle to the floor.
      const dir = camera.getWorldDirection(new T.Vector3());
      assert(Math.abs(Math.asin(-dir.y) - T.MathUtils.degToRad(angle)) < 1e-9);
      // The whole floor is in view and widens toward the viewer.
      const far = ndc(camera, { x: ROOM.halfWidth, y: 0, z: floorBack(ROOM.halfWidth) });
      assert(far.x > 0.4 && far.x < 1 && far.y > -1 && far.y < 0.9, `${aspect} ${angle}: far ${far.toArray()}`);
    }
});

test("wall spans the far edge of the floor, rises to the top of the viewport and its sides look vertical", () => {
  for (const aspect of [16 / 9, 1363 / 936, 2000 / 980])
    for (const angle of [15, 30, 45]) {
      const camera = roomCamera(aspect, angle);
      const bottom = ndc(camera, screenPoint(ROOM.wallWidth / 2, 0)),
        farCorner = ndc(camera, { x: ROOM.halfWidth, y: 0, z: floorBack(ROOM.halfWidth) });
      assert(bottom.distanceTo(farCorner) < 1e-9, "bottom corners are the far floor corners");
      for (const y of [0.25, 0.5, 0.75, 1].map((k) => k * ROOM.wallHeight)) {
        const edge = ndc(camera, screenPoint(ROOM.wallWidth / 2, y));
        assert(Math.abs(edge.x - bottom.x) < 0.01, `${aspect} ${angle}: edge at ${y} → ${edge.x} vs ${bottom.x}`);
      }
      let top = -Infinity;
      for (let x = -ROOM.wallWidth / 2; x <= ROOM.wallWidth / 2; x += 0.7)
        top = Math.max(top, ndc(camera, screenPoint(x, ROOM.wallHeight)).y);
      assert(top > 0.85 && top <= 0.95, `${aspect} ${angle}: top ${top}, height ${ROOM.wallHeight}`);
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

test("while sharing, participants are equal squares on the wall beside the picture and never overlap", () => {
  const players = Array.from({ length: 16 }, (_, i) => ({ profile: { id: String(i) } }));
  const portraits = new Map(players.map((p) => [p.profile.id, { target: { texture: new T.Texture() } }]));
  const cinema = new CinemaScreen(players.slice(0, 1), portraits);
  for (const angle of [15, 30, 45]) {
    roomCamera(16 / 9, angle);
    cinema.reshape();
    for (const count of [1, 2, 3, 6, 9, 16]) {
      cinema.setPlayers(players.slice(0, count));
      cinema.setMedia({ share: new T.Texture({ videoWidth: 1920, videoHeight: 1080 }) });
      const share = cinema.featuredRect(16 / 9);
      const rects = cinema.tiles.filter((t) => t.visible).map((t) => t.geometry.userData.rect);
      assert.equal(rects.length, count);
      for (const r of rects) {
        assert(Math.abs(r.width - r.height) < 1e-9, "square");
        assert(Math.abs(r.width - rects[0].width) < 1e-9, "equal");
        assert(r.x + r.width <= share.x + 1e-9 || r.x >= share.x + share.width - 1e-9, "beside the shared picture");
        assert(r.x >= -ROOM.wallWidth / 2 && r.x + r.width <= ROOM.wallWidth / 2, "on the wall");
        assert(r.y >= 0 && r.y + r.height <= ROOM.wallHeight, "on the wall");
      }
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i],
            b = rects[j];
          assert(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, `${count}`);
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
  const map = mapDef("cinema"),
    positions = defaultPositions(map),
    colliders = obstacles(map, positions);
  const goal = goalsOf(map, positions)[0];
  const body = { x: goal.x, z: goal.z + 0.8, y: 0, vy: 0, grounded: true };
  for (let i = 0; i < 30; i++) stepBody(body, { x: 0, z: -1 }, colliders, 1 / 120);
  assert(body.z < goal.z);
  const b = defaultBalls(map)[0];
  Object.assign(b, { x: goal.x, z: goal.z + 0.8, y: 0.42, vx: 0, vz: -10, vy: 0 });
  for (let i = 0; i < 50; i++) stepCube(b, colliders, 1 / 120);
  assert(b.z >= goal.z - 1.45 + 0.42 - 0.04);
  Object.assign(b, { x: goal.x, z: goal.z - 0.3, y: 3 });
  assert.equal(checkGoal(b, { x: b.x, z: goal.z + 0.3, y: 3 }, goal, {}), false);
});
