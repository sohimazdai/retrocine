// Рисунки на полу и на экране-доске: каждый штрих — лента заданной толщины по точкам. На полу точки
// — (x, z), на стене — координаты стены (x поперёк, y вверх), чтобы штрих следовал за её формой,
// когда камера меняет наклон или комната — размер.
import * as T from "three";
import { screenPoint } from "./layout.js";

const FLOOR_Y = 0.013,
  WALL_INSET = 0.035;
// A ribbon along points [[a, b], …] in a plane: offsets ±w/2 across the line (averaged at joints),
// mapped to 3D by `place(a, b)`; a dot at each end rounds the caps.
function ribbon(pts, w, place) {
  const pos = [],
    idx = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1,
      ox = (-dy / l) * (w / 2),
      oy = (dx / l) * (w / 2);
    pos.push(...place(pts[i][0] + ox, pts[i][1] + oy), ...place(pts[i][0] - ox, pts[i][1] - oy));
    if (i) idx.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1);
  }
  for (const end of n > 1 ? [pts[0], pts[n - 1]] : [pts[0]]) {
    const c = pos.length / 3;
    pos.push(...place(end[0], end[1]));
    for (let k = 0; k <= 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      pos.push(...place(end[0] + Math.cos(a) * (w / 2), end[1] + Math.sin(a) * (w / 2)));
      if (k) idx.push(c, c + k, c + k + 1);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
const pairs = (p) => {
  const out = [];
  for (let i = 0; i + 1 < p.length; i += 2) out.push([p[i], p[i + 1]]);
  return out;
};
export class StrokeLayer {
  constructor(scene) {
    this.group = new T.Group();
    this.group.userData.kind = "drawing";
    scene.add(this.group);
    this.meshes = new Map();
    this.strokes = new Map();
    this.previewMesh = null;
  }
  build(st) {
    const pts = pairs(st.p);
    if (!pts.length) return null;
    const place = st.on === "wall" ? (x, y) => {
      const q = screenPoint(x, y, WALL_INSET);
      return [q.x, q.y, q.z];
    } : (x, z) => [x, FLOOR_Y, z];
    const mesh = new T.Mesh(
      ribbon(pts, st.w, place),
      new T.MeshBasicMaterial({ color: st.c, side: T.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    mesh.renderOrder = 2;
    mesh.raycast = () => {};
    return mesh;
  }
  add(st) {
    this.remove(st.id);
    const mesh = this.build(st);
    if (!mesh) return;
    this.strokes.set(st.id, st);
    this.meshes.set(st.id, mesh);
    this.group.add(mesh);
  }
  remove(id) {
    const mesh = this.meshes.get(id);
    if (mesh) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.meshes.delete(id);
    this.strokes.delete(id);
  }
  set(strokes = []) {
    for (const id of [...this.meshes.keys()]) this.remove(id);
    for (const st of strokes) this.add(st);
  }
  // The wall changed shape (camera tilt, room size): wall strokes follow it.
  reshape() {
    for (const st of [...this.strokes.values()]) if (st.on === "wall") this.add(st);
    if (this.previewStroke?.on === "wall") this.preview(this.previewStroke);
  }
  // The stroke you are drawing right now (before it is sent).
  preview(st) {
    if (this.previewMesh) {
      this.group.remove(this.previewMesh);
      this.previewMesh.geometry.dispose();
      this.previewMesh.material.dispose();
      this.previewMesh = null;
    }
    this.previewStroke = st;
    if (!st) return;
    this.previewMesh = this.build(st);
    if (this.previewMesh) this.group.add(this.previewMesh);
  }
}
