import * as T from "three";
import { roomViewports, participantGrid, coverCrop } from "./layout.js";

// A separate perspective view of the curved screen reserves exactly the top 2/5.
// Tiles are bent meshes, prewarped to keep their projected outlines square.
export class CinemaScreen {
  constructor(players, portraits) {
    this.players = players;
    this.portraits = portraits;
    this.count = players.length;
    this.scene = new T.Scene();
    this.scene.background = new T.Color("#14131d");
    this.camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.z = 30;
    this.scene.add(new T.HemisphereLight("#ebe2ff", "#413b52", 2.5));
    const light = new T.DirectionalLight("#e2cbff", 2);
    light.position.set(-10, 10, 15);
    this.scene.add(light);
    this.group = new T.Group();
    this.group.userData.kind = "screen";
    this.scene.add(this.group);
    this.tiles = [];
    this.frame = new T.Mesh(
      new T.BufferGeometry(),
      new T.MeshStandardMaterial({
        color: "#61586f",
        metalness: 0.35,
        roughness: 0.45,
      }),
    );
    this.group.add(this.frame);
    this.panel = new T.Mesh(
      new T.BufferGeometry(),
      new T.MeshBasicMaterial({ color: "#11111b" }),
    );
    this.group.add(this.panel);
    for (const player of players) {
      const tile = new T.Mesh(
        new T.BufferGeometry(),
        new T.MeshBasicMaterial({
          map: portraits.get(player.profile.id).target.texture,
          toneMapped: false,
        }),
      );
      tile.userData = { kind: "tile", id: player.profile.id };
      this.group.add(tile);
      this.tiles.push(tile);
    }
    this.featured = new T.Mesh(
      new T.BufferGeometry(),
      new T.MeshBasicMaterial({ toneMapped: false }),
    );
    this.featured.visible = false;
    this.group.add(this.featured);
  }
  surface(rect, offset = 0, rounded = false) {
    const { width, height } = this.viewport;
    const worldHeight = Math.tan(T.MathUtils.degToRad(15)) * 60,
      worldWidth = (worldHeight * width) / height;
    const geometry = new T.PlaneGeometry(1, 1, 64, 8),
      positions = geometry.attributes.position,
      uv = geometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      const u = uv.getX(i),
        v = uv.getY(i);
      let pixelX = rect.x + u * rect.width,
        pixelY = rect.y + (1 - v) * rect.height;
      if (rounded) {
        const radius = Math.min(18, rect.height * 0.06),
          edgeDistance = Math.min(
            pixelY - rect.y,
            rect.y + rect.height - pixelY,
          );
        if (edgeDistance < radius) {
          const inset =
            radius -
            Math.sqrt(
              Math.max(0, radius * radius - (radius - edgeDistance) ** 2),
            );
          pixelX = Math.max(
            rect.x + inset,
            Math.min(rect.x + rect.width - inset, pixelX),
          );
        }
      }
      const nx = (pixelX / width) * 2 - 1,
        ny = 1 - (pixelY / height) * 2;
      const z = 0.95 * nx * nx + offset,
        compensation = (30 - z) / 30;
      positions.setXYZ(
        i,
        ((nx * worldWidth) / 2) * compensation,
        ((ny * worldHeight) / 2) * compensation,
        z,
      );
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.userData.rect = { ...rect };
    return geometry;
  }
  replaceGeometry(mesh, rect, offset = 0, rounded = false) {
    mesh.geometry.dispose();
    mesh.geometry = this.surface(rect, offset, rounded);
  }
  resize(width, height) {
    this.viewport = roomViewports(width, height).cinema;
    this.camera.aspect = this.viewport.width / this.viewport.height;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.replaceGeometry(
      this.frame,
      { x: 0, y: 0, width, height: this.viewport.height },
      -0.1,
      true,
    );
    this.replaceGeometry(
      this.panel,
      { x: 4, y: 3, width: width - 8, height: this.viewport.height - 6 },
      0,
      true,
    );
    this.layout();
  }
  layout() {
    if (!this.viewport) return;
    const rects = participantGrid(
      this.count,
      this.viewport.width - 16,
      this.viewport.height - 10,
    );
    this.tiles.forEach((tile, i) => {
      tile.visible = i < this.count;
      if (rects[i])
        this.replaceGeometry(
          tile,
          { ...rects[i], x: rects[i].x + 8, y: rects[i].y + 5 },
          0.06,
          true,
        );
    });
  }
  setCount(count) {
    this.count = Math.max(1, Math.min(this.players.length, count));
    this.layout();
    if (this.media) this.setMedia(this.media);
  }
  setMedia({ cameras = new Map(), pinned = null, share = null } = {}) {
    this.media = { cameras, pinned, share };
    this.tiles.forEach((tile, i) => {
      tile.visible = i < this.count && !share && !pinned;
      const original =
        cameras.get(tile.userData.id) ||
        this.portraits.get(tile.userData.id).target.texture;
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
    this.featured.visible = !!share || !!pinned;
    if (this.featured.visible && this.viewport) {
      const texture =
        share ||
        cameras.get(pinned) ||
        this.portraits.get(pinned)?.target.texture;
      this.featured.material.map = texture;
      this.featured.material.needsUpdate = true;
      const { width, height } = this.viewport;
      const aspect =
        texture?.image?.videoWidth / texture?.image?.videoHeight || 1;
      const area = { x: 6, y: 4, width: width - 12, height: height - 8 };
      const fittedWidth = Math.min(area.width, area.height * aspect),
        fittedHeight = Math.min(area.height, area.width / aspect);
      this.replaceGeometry(
        this.featured,
        {
          x: (width - fittedWidth) / 2,
          y: (height - fittedHeight) / 2,
          width: fittedWidth,
          height: fittedHeight,
        },
        0.08,
      );
    }
  }
  pick(event, raycaster) {
    raycaster.setFromCamera(
      new T.Vector2(
        (event.clientX / this.viewport.width) * 2 - 1,
        1 - (event.clientY / this.viewport.height) * 2,
      ),
      this.camera,
    );
    this.scene.updateMatrixWorld(true);
    return raycaster
      .intersectObject(this.group, true)
      .find((hit) => hit.object.visible);
  }
  render(renderer, windowHeight) {
    renderer.setViewport(
      0,
      windowHeight - this.viewport.height,
      this.viewport.width,
      this.viewport.height,
    );
    renderer.setScissor(
      0,
      windowHeight - this.viewport.height,
      this.viewport.width,
      this.viewport.height,
    );
    renderer.render(this.scene, this.camera);
  }
}
