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

// A single fitted facial-hair patch. The upper boundary leaves the mouth free;
// the lower boundary follows the jaw, including the under-chin overhang.
export function facialHairGeometry(style = "short-beard") {
  const geometry = new T.BufferGeometry();
  const surfaceZ = (x, y) => {
    const limitedY = Math.max(-0.35, y);
    const shell = Math.max(0.015, 1 - Math.pow(Math.abs(x) / 0.435, 2.85) - Math.pow(Math.abs(limitedY) / 0.375, 2.85));
    return Math.pow(shell, 1 / 2.85) * 0.35 + 0.014 + Math.max(0, -y - 0.35) * 0.45;
  };
  if (style === "mustache") {
    const positions = [], indices = [], across = 32, rows = 5;
    for (let i = 0; i <= across; i++) {
      const x = (i / across * 2 - 1) * 0.205, edge = Math.abs(x) / 0.205;
      for (let j = 0; j <= rows; j++) {
        const v = j / rows, y = T.MathUtils.lerp(-0.137 + 0.018 * edge, -0.18 + 0.035 * edge, v);
        positions.push(x, y, surfaceZ(x, y) + Math.sin(v * Math.PI) * 0.008);
        if (i < across && j < rows) {
          const a = i * (rows + 1) + j, b = a + rows + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
  } else {
    const full = style === "full-beard", bottom = full ? -0.55 : -0.415;
    const shape = new T.Shape();
    // Sideburns begin outside the eye. The upper edge then drops below the
    // lower eyelid before crossing each cheek toward the bare upper lip.
    shape.moveTo(-0.418, 0.035);
    shape.bezierCurveTo(-0.43, -0.085, -0.39, -0.18, -0.285, -0.2);
    shape.quadraticCurveTo(-0.18, -0.15, 0, -0.168);
    shape.quadraticCurveTo(0.18, -0.15, 0.285, -0.2);
    shape.bezierCurveTo(0.39, -0.18, 0.43, -0.085, 0.418, 0.035);
    shape.quadraticCurveTo(0.46, -0.18, 0.32, -0.34);
    shape.quadraticCurveTo(0.18, bottom, 0, bottom);
    shape.quadraticCurveTo(-0.18, bottom, -0.32, -0.34);
    shape.quadraticCurveTo(-0.46, -0.18, -0.418, 0.035);
    const mouth = new T.Path();
    mouth.absellipse(0, -0.255, 0.175, 0.075, 0, Math.PI * 2, true);
    shape.holes.push(mouth);
    const flat = new T.ShapeGeometry(shape, 16), attr = flat.attributes.position;
    let vertices = Array.from({ length: attr.count }, (_, i) => [attr.getX(i), attr.getY(i)]);
    let triangles = flat.index ? [...flat.index.array] : vertices.map((_, i) => i);
    flat.dispose();
    // Subdivide before projecting; a triangle stretched across the convex
    // cheeks would otherwise sink inside the head between boundary points.
    for (let pass = 0; pass < 2; pass++) {
      const midpoints = new Map(), next = [];
      const midpoint = (a, b) => {
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (!midpoints.has(key)) {
          const u = vertices[a], v = vertices[b];
          midpoints.set(key, vertices.push([(u[0] + v[0]) / 2, (u[1] + v[1]) / 2]) - 1);
        }
        return midpoints.get(key);
      };
      for (let i = 0; i < triangles.length; i += 3) {
        const a = triangles[i], b = triangles[i + 1], c = triangles[i + 2];
        const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
        next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      }
      triangles = next;
    }
    const positions = vertices.flatMap(([x, y]) => [x, y, surfaceZ(x, y)]);
    geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(triangles);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// Curved hood, open across the front. Each ring is a horseshoe rather than a
// solid cone or a flat extruded triangle.
export function hoodGeometry() {
  const stations = [
    [0.76, 0.012, 0.012, 0], [0.62, 0.23, 0.17, 0],
    [0.4, 0.43, 0.31, 0], [0.19, 0.47, 0.37, 0.45],
    [-0.08, 0.51, 0.39, 0.96], [-0.34, 0.48, 0.36, 1.02],
  ];
  const curve = new T.CatmullRomCurve3(stations.map(([y, rx, rz]) => new T.Vector3(rx, y, rz)), false, "catmullrom", 0.25);
  const positions = [], indices = [], rows = 32, columns = 48, leftEdge = [], rightEdge = [];
  for (let i = 0; i <= rows; i++) {
    const u = i / rows, q = curve.getPoint(u), index = Math.min(stations.length - 2, Math.floor(u * (stations.length - 1)));
    const t = u * (stations.length - 1) - index;
    const y = T.MathUtils.lerp(stations[index][0], stations[index + 1][0], t);
    const opening = T.MathUtils.lerp(stations[index][3], stations[index + 1][3], t);
    for (let j = 0; j <= columns; j++) {
      const theta = opening + j / columns * (Math.PI * 2 - opening * 2);
      const sideScale = Math.sin(theta) < 0 ? 1.34 : 0.91;
      const x = Math.sin(theta) * q.x * sideScale + 0.18 * (1 - u);
      const z = Math.cos(theta) * q.z - 0.05;
      positions.push(x, y, z);
      if (j === 0) leftEdge.push([x, y, z]);
      if (j === columns) rightEdge.push([x, y, z]);
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
  return { geometry, edges: [leftEdge, rightEdge] };
}

export function tailGeometry(points, radii, baseColor, tipColor) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
  const segments = 32, radial = 12, frames = curve.computeFrenetFrames(segments, false);
  const radiusCurve = new T.CatmullRomCurve3(radii.map((r, i) => new T.Vector3(i / (radii.length - 1), r, 0)), false, "catmullrom", 0.25);
  const positions = [], colors = [], indices = [], base = new T.Color(baseColor), tip = new T.Color(tipColor), v = new T.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const radius = Math.max(0.006, radiusCurve.getPoint(t).y);
    const center = curve.getPointAt(t), color = base.clone().lerp(tip, T.MathUtils.smoothstep(t, 0.6, 0.95));
    for (let j = 0; j <= radial; j++) {
      const angle = j / radial * Math.PI * 2;
      v.copy(center).addScaledVector(frames.normals[i], Math.cos(angle) * radius)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * radius);
      positions.push(v.x, v.y, v.z); colors.push(color.r, color.g, color.b);
      if (i < segments && j < radial) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
