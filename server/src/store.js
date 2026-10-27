// Room snapshots on disk: one JSON file per room, written atomically.
import fs from "node:fs/promises";
import path from "node:path";

export class FileStore {
  constructor(dir) {
    this.dir = dir;
  }
  file(id) {
    return path.join(this.dir, `${id}.json`);
  }
  async load(id) {
    try {
      return JSON.parse(await fs.readFile(this.file(id), "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") console.error(`room ${id}: cannot read`, e.message);
      return null;
    }
  }
  async save(id, data) {
    await fs.mkdir(this.dir, { recursive: true });
    const tmp = this.file(id) + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(data));
    await fs.rename(tmp, this.file(id));
  }
  // Rooms nobody has visited for maxAgeDays are removed.
  async sweep(maxAgeDays = 30) {
    let removed = 0;
    try {
      for (const name of await fs.readdir(this.dir)) {
        if (!name.endsWith(".json")) continue;
        const f = path.join(this.dir, name);
        const st = await fs.stat(f);
        if (Date.now() - st.mtimeMs > maxAgeDays * 864e5) {
          await fs.rm(f);
          removed++;
        }
      }
    } catch {}
    return removed;
  }
}

export class MemoryStore {
  constructor() {
    this.data = new Map();
  }
  async load(id) {
    return this.data.has(id) ? structuredClone(this.data.get(id)) : null;
  }
  async save(id, data) {
    this.data.set(id, structuredClone(data));
  }
  async sweep() {
    return 0;
  }
}
