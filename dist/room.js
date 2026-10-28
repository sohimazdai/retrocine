import * as T from "three";
import { ROOM, floorBack, wallZ } from "./layout.js";

export const ELEVATION = { min: 0, max: 80, initial: 25 };

// The camera looks down at the given angle to the floor and is placed so the near corners of the
// floor sit exactly in the bottom corners of the viewport. On portrait screens the floor is framed
// as for a square one, so it stays large and its near corners run past the sides.
export function fitRoomCamera(camera, degrees, frameHalf = ROOM.halfWidth) {
  const aspect = Math.max(1, camera.aspect),
    tilt = T.MathUtils.degToRad(degrees),
    tan = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
  // frameHalf is the half-width the camera frames; larger than the floor (zoom > 1) pulls the camera
  // back so a bigger map fits, the screen and floor shrinking together.
  const depth = frameHalf / (tan * aspect),
    rise = frameHalf / aspect;
  camera.position.set(
    0,
    depth * Math.sin(tilt) + rise * Math.cos(tilt),
    ROOM.front + depth * Math.cos(tilt) - rise * Math.sin(tilt),
  );
  camera.rotation.set(-tilt, 0, 0);
  camera.far = 400;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

// The wall's bottom corners are the far corners of the floor. Its height is chosen so the top is
// near the top of the viewport, and its half-width narrows with height so the side edges look
// vertical on screen (a vertical edge in the room would lean outward in this perspective).
export function fitWall(camera, { top = 0.94, min = 4, max = 24, steps = 16 } = {}) {
  const v = new T.Vector3(),
    ndc = (x, y, z) => v.set(x, y, z).project(camera);
  const W = ROOM.halfWidth,
    targetX = ndc(W, 0, wallZ(W)).x;
  const edgeAt = (y) => {
    let w = W;
    for (let i = 0; i < 12; i++) {
      const p = ndc(w, y, wallZ(w));
      if (!(p.x > 0) || p.z >= 1) break;
      w = Math.max(W * 0.3, Math.min(W, (w * targetX) / p.x));
    }
    return w;
  };
  const highest = (h) => {
    const w = edgeAt(h);
    let y = -Infinity;
    for (const x of [0, w * 0.5, w]) {
      const p = ndc(x, h, wallZ(x));
      y = Math.max(y, p.z >= 1 ? Infinity : p.y);
    }
    return y;
  };
  let lo = min,
    hi = max;
  if (highest(max) <= top) lo = max;
  else
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (highest(mid) <= top) lo = mid;
      else hi = mid;
    }
  const height = lo,
    edges = [];
  for (let i = 0; i <= steps; i++) {
    const y = (height * i) / steps;
    edges.push([y, edgeAt(y)]);
  }
  return { height, edges };
}

export function createFloor(scene) {
  const shape = new T.Shape();
  shape.moveTo(-ROOM.halfWidth, ROOM.front);
  shape.lineTo(ROOM.halfWidth, ROOM.front);
  for (let i = 0; i <= 96; i++) {
    const x = ROOM.halfWidth - (i / 96) * ROOM.halfWidth * 2;
    shape.lineTo(x, floorBack(x));
  }
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, {
    depth: 0.38,
    bevelEnabled: false,
  });
  geometry.rotateX(Math.PI / 2);
  const floor = new T.Mesh(geometry, [
    new T.MeshStandardMaterial({ color: "#514959", roughness: 0.9 }),
    new T.MeshStandardMaterial({ color: "#352f42", roughness: 0.75 }),
  ]);
  floor.receiveShadow = true;
  floor.userData.kind = "floor";
  scene.add(floor);
  const lines = [];
  for (let x = -14; x <= 14.01; x += 1.4)
    lines.push(x, 0.008, floorBack(x), x, 0.008, ROOM.front);
  for (let z = ROOM.back + 0.8; z <= ROOM.front - 0.4; z += 1.4) {
    let halfWidth = ROOM.halfWidth;
    if (z < floorBack(ROOM.halfWidth))
      halfWidth = Math.sqrt(Math.max(0, ROOM.radius ** 2 - (ROOM.eyeZ - z) ** 2));
    lines.push(-halfWidth, 0.008, z, halfWidth, 0.008, z);
  }
  const grid = new T.BufferGeometry();
  grid.setAttribute("position", new T.Float32BufferAttribute(lines, 3));
  const gridLines = new T.LineSegments(
    grid,
    new T.LineBasicMaterial({
      color: "#a193af",
      transparent: true,
      opacity: 0.13,
    }),
  );
  scene.add(gridLines);
  floor.userData.grid = gridLines;
  return floor;
}

export function framePortrait(camera, rig) {
  rig.root.updateMatrixWorld(true);
  const bounds = new T.Box3();
  rig.root.traverseVisible((object) => {
    if (!object.isMesh) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    bounds.union(
      object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld),
    );
  });
  const size = bounds.getSize(new T.Vector3()),
    center = bounds.getCenter(new T.Vector3());
  const halfView = Math.max(size.y, size.x / camera.aspect) / 2 / 0.82;
  const distance =
    halfView / Math.tan(T.MathUtils.degToRad(camera.fov / 2)) + size.z / 2;
  camera.position.set(center.x, center.y, center.z + distance);
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  return bounds;
}
