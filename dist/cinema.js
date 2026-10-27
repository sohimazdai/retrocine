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
    const rect = {
      x: -ROOM.wallWidth / 2,
      y: 0,
      width: ROOM.wallWidth,
      height: ROOM.wallHeight,
    };
    this.frame = new T.Mesh(
      screenSurface(rect, -0.06, true),
      new T.MeshStandardMaterial({
        color: "#766884",
        metalness: 0.25,
        roughness: 0.5,
        side: T.DoubleSide,
      }),
    );
    this.group.add(this.frame);
    this.panel = new T.Mesh(
      screenSurface(
        {
          x: rect.x + 0.1,
          y: 0.08,
          width: rect.width - 0.2,
          height: rect.height - 0.16,
        },
        0,
        true,
      ),
      new T.MeshBasicMaterial({ color: "#171520", side: T.DoubleSide }),
    );
    this.group.add(this.panel);
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
  layout() {
    const sharing = !!this.media?.share;
    const rects = participantGrid(
      this.count,
      ROOM.wallWidth - 0.5,
      ROOM.wallHeight - 0.4,
      0.16,
    );
    this.tiles.forEach((tile, i) => {
      tile.position.set(0, 0, 0);
      tile.quaternion.identity();
      tile.visible = i < this.count && (!this.media?.pinned || sharing);
      if (i >= this.count) return;
      if (sharing) {
        const leftCount = Math.ceil(this.count / 2),
          left = i < leftCount;
        const row = left ? i : i - leftCount;
        const rows = left ? leftCount : this.count - leftCount;
        const size = Math.min(2.35, 7.2 / leftCount - 0.18);
        this.replaceGeometry(tile, new T.PlaneGeometry(size, size));
        tile.position.set(left ? -12.55 : 12.55, ROOM.wallHeight / 2, -7.5);
        tile.userData.rowOffset = ((rows - 1) / 2 - row) * (size + 0.18);
        tile.userData.side = left ? "left" : "right";
        if (this.camera) tile.quaternion.copy(this.camera.quaternion);
      } else {
        const r = rects[i];
        this.replaceGeometry(
          tile,
          screenSurface(
            {
              x: r.x - ROOM.wallWidth / 2 + 0.25,
              y: ROOM.wallHeight - 0.2 - r.y - r.height,
              width: r.width,
              height: r.height,
            },
            0.035,
            true,
          ),
        );
        tile.userData.side = null;
      }
    });
    if (this.camera) this.updateCamera(this.camera);
  }
  updateCamera(camera) {
    this.camera = camera;
    if (this.media?.share) {
      const up = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      this.tiles.forEach((tile) => {
        if (!tile.visible) return;
        tile.quaternion.copy(camera.quaternion);
        tile.position.set(
          tile.userData.side === "left" ? -12.55 : 12.55,
          ROOM.wallHeight / 2,
          -7.5,
        );
        tile.position.addScaledVector(up, tile.userData.rowOffset);
      });
    }
  }
  setCount(count) {
    this.count = Math.max(1, Math.min(this.players.length, count));
    this.layout();
  }
  setMedia({ cameras = new Map(), pinned = null, share = null } = {}, force = false) {
    const modeChanged =
      force || !!this.media?.share !== !!share || this.media?.pinned !== pinned;
    this.media = { cameras, pinned, share };
    if (modeChanged) this.layout();
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
      const aspect =
        texture?.image?.videoWidth / texture?.image?.videoHeight || 1;
      const width = Math.min(
        ROOM.wallWidth - 0.4,
        (ROOM.wallHeight - 0.3) * aspect,
      );
      const height = width / aspect;
      this.replaceGeometry(
        this.featured,
        screenSurface(
          { x: -width / 2, y: (ROOM.wallHeight - height) / 2, width, height },
          0.05,
        ),
      );
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
