// Хранилище событий аналитики: один файл SQLite (встроенный в Node 22 node:sqlite, без зависимостей).
// events — то, что случилось (просмотр страницы, бросок, размеченный план; value — «сколько»: метры,
// число запросов); gauges — снимки текущих значений (онлайн, открытые комнаты). Grafana читает этот
// же файл через SQLite-источник.
import { DatabaseSync } from "node:sqlite";

export const KEEP_DAYS = 400;
export class Store {
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS events (ts INTEGER NOT NULL, app TEXT NOT NULL, name TEXT NOT NULL, uid TEXT, path TEXT, value REAL NOT NULL DEFAULT 1, props TEXT);
      CREATE INDEX IF NOT EXISTS events_app_name_ts ON events (app, name, ts);
      CREATE INDEX IF NOT EXISTS events_app_ts ON events (app, ts);
      CREATE TABLE IF NOT EXISTS gauges (ts INTEGER NOT NULL, app TEXT NOT NULL, name TEXT NOT NULL, value REAL NOT NULL);
      CREATE INDEX IF NOT EXISTS gauges_app_name_ts ON gauges (app, name, ts);
    `);
    this.addEvent = this.db.prepare("INSERT INTO events (ts, app, name, uid, path, value, props) VALUES (?, ?, ?, ?, ?, ?, ?)");
    this.addGauge = this.db.prepare("INSERT INTO gauges (ts, app, name, value) VALUES (?, ?, ?, ?)");
  }
  // rows: [{ ts, app, name, uid?, path?, value?, props? }] — одной транзакцией.
  events(rows) {
    this.db.exec("BEGIN");
    try {
      for (const r of rows) this.addEvent.run(r.ts, r.app, r.name, r.uid ?? null, r.path ?? null, r.value ?? 1, r.props ? JSON.stringify(r.props) : null);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  gauges(rows) {
    this.db.exec("BEGIN");
    try {
      for (const r of rows) this.addGauge.run(r.ts, r.app, r.name, r.value);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  // Старше KEEP_DAYS — удаляется (раз в сутки).
  prune(now = Date.now()) {
    const cut = now - KEEP_DAYS * 86400000;
    this.db.prepare("DELETE FROM events WHERE ts < ?").run(cut);
    this.db.prepare("DELETE FROM gauges WHERE ts < ?").run(cut);
  }
  query(sql, ...args) {
    return this.db.prepare(sql).all(...args);
  }
  close() {
    this.db.close();
  }
}
