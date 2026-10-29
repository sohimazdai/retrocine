import * as T from "three";

// A small reusable surface vocabulary. Dimensions are applied on the mesh so
// every avatar shares the same smooth, indexed head/body geometry.
export const sculptGeometries = new Map();
const signedPower = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);

export function sculptGeometry(exponent = 0.7, compact = false) {
  const key = compact ? `${exponent}:compact` : exponent;
  if (sculptGeometries.has(key)) return sculptGeometries.get(key);
  const geometry = new T.SphereGeometry(1, compact ? 20 : 40, compact ? 14 : 28);
  const positions = geometry.attributes.position, normals = geometry.attributes.normal;
  const normal = new T.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const x = signedPower(positions.getX(i), exponent);
    const y = signedPower(positions.getY(i), exponent);
    const z = signedPower(positions.getZ(i), exponent);
    positions.setXYZ(i, x, y, z);
    normal.set(signedPower(x, 2 / exponent - 1), signedPower(y, 2 / exponent - 1), signedPower(z, 2 / exponent - 1)).normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  sculptGeometries.set(key, geometry);
  return geometry;
}

export function scalpGeometry() {
  if (sculptGeometries.has("scalp")) return sculptGeometries.get("scalp");
  const positions = [], indices = [], columns = 48, rows = 24;
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= columns; j++) {
      const angle = j / columns * Math.PI * 2, front = Math.cos(angle);
      const end = 1.05 + 0.9 * (1 - Math.max(0, front)) + 0.3 * Math.max(0, -front);
      const phi = Math.max(0.001, i / rows * end), r = Math.pow(Math.sin(phi), 0.7);
      positions.push(signedPower(Math.sin(angle), 0.7) * r * 0.445,
        signedPower(Math.cos(phi), 0.7) * 0.43 + 0.015,
        signedPower(Math.cos(angle), 0.7) * r * 0.365 - 0.035);
      if (i < rows && j < columns) {
        const a = i * (columns + 1) + j, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  sculptGeometries.set("scalp", geometry);
  return geometry;
}

// Tapered swept surface, not a string of beads. Used for hair, brows and folds.
export function strandGeometry(points, width, depth = width, segments = 24) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [], indices = [], radial = 10, v = new T.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, center = curve.getPointAt(t);
    const taper = Math.max(0.015, Math.pow(Math.sin(Math.PI * (0.12 + t * 0.88)), 0.65));
    for (let j = 0; j <= radial; j++) {
      const angle = j / radial * Math.PI * 2;
      v.copy(center).addScaledVector(frames.normals[i], Math.cos(angle) * width * taper)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * depth * taper);
      positions.push(v.x, v.y, v.z);
      if (i < segments && j < radial) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// Closed elliptical loft. Smooth changes in radius define a waist, hem, cuff
// or boot shaft; small waves add cloth volume without changing the joint rig.
export function garmentGeometry(profile, folds = 0, sides = 32) {
  const curve = new T.CatmullRomCurve3(profile.map(([y, x, z]) => new T.Vector3(x, y, z)), false, "catmullrom", 0.25);
  const rows = Math.max(16, profile.length * 4), positions = [], indices = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, p = curve.getPoint(t);
    // Smooth radii, monotone height: spline overshoot at a thin hem would fold
    // the cap back through itself and turn a ring of normals inward.
    const step = t * (profile.length - 1), lower = Math.min(profile.length - 2, Math.floor(step));
    p.y = T.MathUtils.lerp(profile[lower][0], profile[lower + 1][0], step - lower);
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const ripple = 1 + folds * Math.sin(angle * 8 + p.y * 6);
      positions.push(Math.sin(angle) * Math.max(0, p.x) * ripple, p.y, Math.cos(angle) * Math.max(0, p.z) * ripple);
      if (i < rows && j < sides) {
        const a = i * (sides + 1) + j, b = a + sides + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
