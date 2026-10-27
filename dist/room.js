import * as T from "three";
import { ROOM, floorBack, screenPoint } from "./layout.js";

export const ROOM_TARGET = new T.Vector3(0, 1.4, -1);

// Fit once on resize, for the complete 30–80° range. Changing the angle never
// changes the lens or distance, and floor/wall always use the same camera.
export function roomDistance(aspect, fov = 43) {
  const tan = Math.tan(T.MathUtils.degToRad(fov / 2));
  const points = [];
  for (const x of [-ROOM.halfWidth, 0, ROOM.halfWidth]) {
    points.push(new T.Vector3(x, 0, ROOM.front));
    points.push(new T.Vector3(x, 0, floorBack(x)));
  }
  for (const x of [-10.5, 0, 10.5]) {
    const p = screenPoint(x, ROOM.wallHeight);
    points.push(new T.Vector3(p.x, p.y, p.z));
  }
  let distance = 0;
  for (let degrees = 30; degrees <= 80; degrees += 2) {
    const el = T.MathUtils.degToRad(degrees);
    for (const p of points) {
      const dy = p.y - ROOM_TARGET.y,
        dz = p.z - ROOM_TARGET.z;
      const depth = dy * Math.sin(el) + dz * Math.cos(el);
      const vertical = dy * Math.cos(el) - dz * Math.sin(el);
      distance = Math.max(
        distance,
        depth + Math.abs(p.x) / (tan * aspect * 0.94),
        depth + Math.abs(vertical) / (tan * (vertical < 0 ? 0.82 : 0.94)),
      );
    }
  }
  return distance;
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
  for (let x = -14; x <= 14; x += 1.4)
    lines.push(x, 0.008, floorBack(x), x, 0.008, ROOM.front);
  for (let z = -11.2; z <= 9.9; z += 1.4) {
    let halfWidth = ROOM.halfWidth;
    if (z < floorBack(ROOM.halfWidth))
      halfWidth = Math.sqrt(
        Math.max(0, ROOM.radius ** 2 - ROOM.eyeY ** 2 - (ROOM.eyeZ - z) ** 2),
      );
    lines.push(-halfWidth, 0.008, z, halfWidth, 0.008, z);
  }
  const grid = new T.BufferGeometry();
  grid.setAttribute("position", new T.Float32BufferAttribute(lines, 3));
  scene.add(
    new T.LineSegments(
      grid,
      new T.LineBasicMaterial({
        color: "#a193af",
        transparent: true,
        opacity: 0.13,
      }),
    ),
  );
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
