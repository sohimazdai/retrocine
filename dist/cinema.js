import * as T from "three";
import { ROOM, screenPoint, participantGrid, coverCrop } from "./layout.js";

export function screenSurface(rect, inset = 0, rounded = false) {
  const geometry = new T.PlaneGeometry(1, 1, 72, 32);
  const positions = geometry.attributes.position,
    uv = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    const u = uv.getX(i),
      v = uv.getY(i);
    let x = rect.x + u * rect.width;
    const y = rect.y + v * rect.height;
    if (rounded) {
      const radius = Math.min(0.18, rect.height * 0.05);
      const edge = Math.min(y - rect.y, rect.y + rect.height - y);
      if (edge < radius) {
        const margin =
          radius - Math.sqrt(Math.max(0, radius ** 2 - (radius - edge) ** 2));
        x = T.MathUtils.clamp(x, rect.x + margin, rect.x + rect.width - margin);
      }
    }
    const p = screenPoint(x, y, inset);
    positions.setXYZ(i, Math.abs(p.x) < 1e-8 ? 0 : p.x, p.y, p.z);
  }
  geometry.computeVertexNormals();
  geometry.userData.rect = { ...rect };
  return geometry;
}

export class CinemaScreen {
  constructor(players, portraits) {
    this.players = players;
    this.portraits = portraits;
    this.count = players.length;
    this.group = new T.Group();
    this.group.userData.kind = "screen";
    this.frame = new T.Mesh(
      new T.BufferGeometry(),
      new T.MeshStandardMaterial({
        color: "#766884",
        metalness: 0.25,
        roughness: 0.5,
        side: T.DoubleSide,
      }),
    );
    this.group.add(this.frame);
    this.panel = new T.Mesh(
      new T.BufferGeometry(),
      new T.MeshBasicMaterial({ color: "#171520", side: T.DoubleSide }),
    );
    this.group.add(this.panel);
    this.buildWall();
    this.tiles = players.map((player) => this.makeTile(player));
    this.featured = new T.Mesh(
      new T.BufferGeometry(),
      new T.MeshBasicMaterial({ toneMapped: false, side: T.DoubleSide }),
    );
    this.featured.userData.kind = "screen";
    this.featured.visible = false;
    this.group.add(this.featured);
    this.shareZoom = 1;
    this.sharePan = new T.Vector2(0.5, 0.5);
    this.layout();
  }
  makeTile(player) {
    const tile = new T.Mesh(
      new T.BufferGeometry(),
      new T.MeshBasicMaterial({
        map: this.portraits.get(player.profile.id).target.texture,
        toneMapped: false,
        side: T.DoubleSide,
      }),
    );
    tile.userData = { kind: "tile", id: player.profile.id };
    this.group.add(tile);
    return tile;
  }
  // Participants come and go: keep tiles of those who stay, add and dispose the rest.
  setPlayers(players) {
    const ids = new Set(players.map((p) => p.profile.id));
    for (const tile of this.tiles) {
      if (ids.has(tile.userData.id)) continue;
      this.group.remove(tile);
      tile.geometry.dispose();
      tile.material.dispose();
      tile.userData.cropped?.dispose();
    }
    const kept = new Map(this.tiles.map((t) => [t.userData.id, t]));
    this.players = players;
    this.tiles = players.map((p) => {
      const tile = kept.get(p.profile.id);
      if (tile && ids.has(tile.userData.id)) return tile;
      return this.makeTile(p);
    });
    this.count = players.length;
    this.layout();
    if (this.media) this.setMedia(this.media, true);
  }
  replaceGeometry(mesh, geometry) {
    mesh.geometry.dispose();
    mesh.geometry = geometry;
  }
  // Frame and dark panel follow the wall's current height and edges (they change with the camera).
  buildWall() {
    const rect = {
      x: -ROOM.wallWidth / 2,
      y: 0,
      width: ROOM.wallWidth,
      height: ROOM.wallHeight,
    };
    this.replaceGeometry(this.frame, screenSurface(rect, -0.06, true));
    this.replaceGeometry(
      this.panel,
      screenSurface(
        { x: rect.x + 0.12, y: 0.08, width: rect.width - 0.24, height: rect.height - 0.16 },
        0,
        true,
      ),
    );
  }
  reshape() {
    this.buildWall();
    this.layout();
    if (this.media) this.setMedia(this.media, true);
  }
  shareAspect() {
    const image = this.media?.share?.image;
    return image?.videoWidth / image?.videoHeight || 16 / 9;
  }
  // The featured picture: during a share it leaves columns on both sides for the participants.
  featuredRect(aspect) {
    const width = ROOM.wallWidth - 0.6,
      height = ROOM.wallHeight - 0.5;
    const maxWidth = this.media?.share && this.count ? width * 0.66 : width;
    const w = Math.min(maxWidth, height * aspect),
      h = w / aspect;
    return { x: -w / 2, y: (ROOM.wallHeight - h) / 2, width: w, height: h };
  }
  layout() {
    const sharing = !!this.media?.share;
    this.layoutAspect = sharing ? this.shareAspect() : null;
    const gap = 0.16;
    const rects = participantGrid(
      this.count,
      ROOM.wallWidth - 0.5,
      ROOM.wallHeight - 0.4,
      gap,
    );
    const share = sharing ? this.featuredRect(this.layoutAspect) : null;
    const leftCount = Math.ceil(this.count / 2),
      column = share ? (ROOM.wallWidth - 0.6 - share.width) / 2 - 0.3 : 0,
      size = share
        ? Math.max(0.3, Math.min(column, (ROOM.wallHeight - 0.5 - gap * (leftCount - 1)) / leftCount))
        : 0;
    this.tiles.forEach((tile, i) => {
      tile.position.set(0, 0, 0);
      tile.quaternion.identity();
      tile.visible = i < this.count && (!this.media?.pinned || sharing);
      if (i >= this.count) return;
      let rect;
      if (sharing) {
        const left = i < leftCount,
          row = left ? i : i - leftCount,
          rows = left ? leftCount : this.count - leftCount;
        const centerX = (left ? -1 : 1) * (share.width / 2 + 0.3 + column / 2),
          total = rows * size + (rows - 1) * gap,
          top = (ROOM.wallHeight + total) / 2;
        rect = { x: centerX - size / 2, y: top - (row + 1) * size - row * gap, width: size, height: size };
        tile.userData.side = left ? "left" : "right";
      } else {
        const r = rects[i];
        rect = {
          x: r.x - ROOM.wallWidth / 2 + 0.25,
          y: ROOM.wallHeight - 0.2 - r.y - r.height,
          width: r.width,
          height: r.height,
        };
        tile.userData.side = null;
      }
      this.replaceGeometry(tile, screenSurface(rect, 0.035, true));
    });
  }
  updateCamera(camera) {
    this.camera = camera;
  }
  setCount(count) {
    this.count = Math.max(1, Math.min(this.players.length, count));
    this.layout();
  }
  setMedia({ cameras = new Map(), pinned = null, share = null } = {}, force = false) {
    const modeChanged =
      force || !!this.media?.share !== !!share || this.media?.pinned !== pinned;
    this.media = { cameras, pinned, share };
    if (modeChanged || (share && this.shareAspect() !== this.layoutAspect)) this.layout();
    this.tiles.forEach((tile, i) => {
      tile.visible = i < this.count && (!pinned || !!share);
      const original =
        cameras.get(tile.userData.id) ||
        this.portraits.get(tile.userData.id)?.target.texture;
      if (!original) return;
      if (tile.userData.source !== original) {
        tile.userData.cropped?.dispose();
        tile.userData.source = original;
        tile.userData.cropped = cameras.has(tile.userData.id)
          ? original.clone()
          : null;
      }
      const texture = tile.userData.cropped || original;
      if (tile.userData.cropped) {
        const video = original.image,
          crop = coverCrop(video.videoWidth, video.videoHeight);
        texture.repeat.set(crop.repeatX, crop.repeatY);
        texture.offset.set(crop.offsetX, crop.offsetY);
        texture.needsUpdate = true;
      }
      tile.material.map = texture;
      tile.material.needsUpdate = true;
    });
    if (this.shareSource !== share) {
      this.shareMap?.dispose();
      this.shareSource = share;
      this.shareMap = share?.clone() || null;
      this.shareZoom = 1;
      this.sharePan.set(0.5, 0.5);
    }
    this.featured.visible = !!share || !!pinned;
    this.featured.userData.kind = share ? "share" : "screen";
    if (this.featured.visible) {
      const texture =
        share ||
        cameras.get(pinned) ||
        this.portraits.get(pinned)?.target.texture;
      this.featured.material.map = this.shareMap || texture;
      this.featured.material.needsUpdate = true;
      const aspect = share
        ? this.shareAspect()
        : texture?.image?.videoWidth / texture?.image?.videoHeight || 1;
      this.replaceGeometry(this.featured, screenSurface(this.featuredRect(aspect), 0.05));
      this.updateShareCrop();
    }
  }
  updateShareCrop() {
    if (!this.shareMap) return;
    const repeat = 1 / this.shareZoom;
    this.sharePan.clampScalar(repeat / 2, 1 - repeat / 2);
    this.shareMap.repeat.set(repeat, repeat);
    this.shareMap.offset.set(
      this.sharePan.x - repeat / 2,
      this.sharePan.y - repeat / 2,
    );
    this.shareMap.needsUpdate = true;
  }
  zoomShare(factor) {
    this.shareZoom = T.MathUtils.clamp(this.shareZoom * factor, 1, 4);
    this.updateShareCrop();
  }
  panShare(dx, dy) {
    this.sharePan.x -= dx / this.shareZoom;
    this.sharePan.y -= dy / this.shareZoom;
    this.updateShareCrop();
  }
}
