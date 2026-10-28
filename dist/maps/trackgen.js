// Shared helpers for kart tracks drawn through control points: a smooth closed centreline (centripetal
// Catmull–Rom) with heights, sampled every `step` metres, plus the derived pieces a map needs — the
// 2D points for lap timing and "on the track", and raised stretches as "path" colliders.

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t,
    t3 = t2 * t;
  return p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
}
// Control points [x, z, y] → evenly spaced points [x, z, y] along the closed curve.
export function centreline(ctrl, step = 0.6) {
  const n = ctrl.length,
    dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n],
      p1 = ctrl[i],
      p2 = ctrl[(i + 1) % n],
      p3 = ctrl[(i + 2) % n];
    for (let k = 0; k < 24; k++) dense.push(catmull(p0, p1, p2, p3, k / 24));
  }
  // Resample by arc length.
  const out = [dense[0]];
  let carry = 0;
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1],
      b = dense[i % dense.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = step - carry;
    while (s <= l) {
      const t = s / l;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      s += step;
    }
    carry = l - (s - step);
  }
  if (Math.hypot(out.at(-1)[0] - out[0][0], out.at(-1)[1] - out[0][1]) < step * 0.5) out.pop();
  return out.map((p) => p.map((v) => Math.round(v * 1000) / 1000));
}
// Runs of the closed centreline that are raised above the floor, each as an open "path" collider
// (with a little flat run-in at both ends so it starts at ground level).
export function raisedPaths(points, width, extra = {}, threshold = 0.02) {
  const n = points.length,
    runs = [];
  let start = points.findIndex((p) => p[2] <= threshold);
  if (start < 0) return [{ shape: "path", points: [...points, points[0]], width, ...extra, ...bounds(points, width) }];
  let run = null;
  for (let k = 1; k <= n; k++) {
    const i = (start + k) % n,
      up = points[i][2] > threshold;
    if (up && !run) run = [points[(i - 1 + n) % n]];
    if (run) run.push(points[i]);
    if (!up && run) {
      runs.push(run);
      run = null;
    }
  }
  return runs.map((pts) => ({ shape: "path", points: pts, width, ...extra, ...bounds(pts, width) }));
}
function bounds(pts, width) {
  const xs = pts.map((p) => p[0]),
    zs = pts.map((p) => p[1]),
    x0 = Math.min(...xs) - width / 2,
    x1 = Math.max(...xs) + width / 2,
    z0 = Math.min(...zs) - width / 2,
    z1 = Math.max(...zs) + width / 2;
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: Math.max(...pts.map((p) => p[2])) };
}
// Whether a round thing of radius r at (x, z) stays clear of the road (with a margin).
export function clearOf(points, width, margin = 0.3) {
  return (x, z, r) => points.every((p) => Math.hypot(p[0] - x, p[1] - z) > width / 2 + r + margin);
}
// How big a round thing at (x, z) can be and still stay clear of the road.
export function roomAt(points, width, margin = 0.3) {
  return (x, z) => Math.min(...points.map((p) => Math.hypot(p[0] - x, p[1] - z))) - width / 2 - margin;
}
// A point d metres outside the bend at centreline index i (away from the bend's centre).
export function outside(points, i, d) {
  const n = points.length,
    p = points[(i + n) % n],
    a = points[(i - 4 + n) % n],
    b = points[(i + 4) % n],
    mx = p[0] - (a[0] + b[0]) / 2,
    mz = p[1] - (a[1] + b[1]) / 2,
    l = Math.hypot(mx, mz) || 1;
  return [p[0] + (mx / l) * d, p[1] + (mz / l) * d];
}
// How sharply the road bends at index i (1/radius, from the turn between neighbouring segments).
export function bend(points, i) {
  const n = points.length,
    a = points[(i - 2 + n) % n],
    p = points[i % n],
    b = points[(i + 2) % n],
    t1 = Math.atan2(p[1] - a[1], p[0] - a[0]),
    t2 = Math.atan2(b[1] - p[1], b[0] - p[0]),
    turn = Math.atan2(Math.sin(t2 - t1), Math.cos(t2 - t1)),
    len = Math.hypot(p[0] - a[0], p[1] - a[1]) + Math.hypot(b[0] - p[0], b[1] - p[1]);
  return Math.abs(turn) / (len / 2 || 1);
}
// A line across the track at centreline index i, for lap timing (crossed in the driving direction).
export function lineAt(points, i, width) {
  const n = points.length,
    a = points[(i - 1 + n) % n],
    b = points[(i + 1) % n],
    p = points[i],
    tx = b[0] - a[0],
    tz = b[1] - a[1],
    l = Math.hypot(tx, tz) || 1,
    // Left of the driving direction (x, z) → (z, −x)·(−1): from right edge to left edge.
    lx = -tz / l,
    lz = tx / l,
    h = width / 2 + 0.3;
  return { from: [p[0] - lx * h, p[1] - lz * h], to: [p[0] + lx * h, p[1] + lz * h] };
}
