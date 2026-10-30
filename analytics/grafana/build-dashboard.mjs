// Собирает дашборд Grafana «Аналитика приложений» (grafana/dashboards/apps.json) из запросов SQL к
// базе событий. Запуск: node analytics/grafana/build-dashboard.mjs. Источник — SQLite (frser-sqlite-
// datasource), uid "analytics". Дни считаются по московскому времени.
import { writeFileSync } from "node:fs";

const DS = { type: "frser-sqlite-datasource", uid: "analytics" };
const RANGE = "ts BETWEEN $__from AND $__to";
const DAY = "((ts + 10800000) / 86400000) * 86400 - 10800";
let id = 0,
  y = 0;
const panels = [];
const q = (sql, series = true) => ({ refId: "A", datasource: DS, queryType: series ? "time series" : "table", rawQueryText: sql, queryText: sql, timeColumns: series ? ["time"] : [] });
// Несколько линий из одного запроса (по урлу, по виду): плагин SQLite не умеет раскладывать пустой
// результат («can not convert to wide series, input fields have no rows»), поэтому запрос — таблица,
// а линии делит сама Grafana (partitionByValues); без данных панель просто пишет «No data».
const split = (sql, by) => ({ ...q(sql, false), timeColumns: ["time"], split: by });
function row(title) {
  panels.push({ id: ++id, type: "row", title, collapsed: false, gridPos: { h: 1, w: 24, x: 0, y: y++ }, panels: [] });
}
function panel(type, title, sql, { w = 12, h = 8, x = 0, series = true, unit, decimals, desc, options = {}, draw, by } = {}) {
  const target = by ? split(sql, by) : q(sql, series);
  delete target.split;
  panels.push({
    id: ++id,
    type,
    title,
    description: desc,
    datasource: DS,
    gridPos: { h, w, x, y },
    targets: [target],
    ...(by ? { transformations: [{ id: "partitionByValues", options: { fields: [by], keepFields: false, naming: { asLabels: true } } }] } : {}),
    fieldConfig: { defaults: { ...(unit ? { unit } : {}), ...(decimals != null ? { decimals } : {}), ...(draw ? { custom: draw } : {}), ...(by ? { displayName: "${__field.labels." + by + "}" } : {}) }, overrides: [] },
    options,
  });
  if (x + w >= 24) y += h;
}
const stat = (title, sql, x, opts = {}) => panel("stat", title, sql, { w: 6, h: 5, x, series: false, options: { reduceOptions: { calcs: ["lastNotNull"] }, graphMode: "none" }, ...opts });
const bars = { drawStyle: "bars", fillOpacity: 70, lineWidth: 1 };

row("Все приложения (выберите приложение вверху)");
panel("timeseries", "RPM по урлам (топ-10)", `SELECT ts / 1000 AS time, path, SUM(value) AS rpm FROM events WHERE app = '$app' AND name = 'http' AND ${RANGE} AND path IN (SELECT path FROM events WHERE app = '$app' AND name = 'http' AND ${RANGE} GROUP BY path ORDER BY SUM(value) DESC LIMIT 10) GROUP BY ts, path ORDER BY ts`, { by: "path", w: 16, unit: "reqpm", desc: "Запросы в минуту к каждому урлу по журналу Caddy (идентификаторы в путях заменены на :id)." });
panel("table", "Урлы за период", `SELECT path AS "Урл", SUM(value) AS "Запросов", ROUND(SUM(value) * 60000.0 / MAX(1, $__to - $__from), 2) AS "Средний RPM" FROM events WHERE app = '$app' AND name = 'http' AND ${RANGE} GROUP BY path ORDER BY 2 DESC LIMIT 50`, { w: 8, x: 16, series: false });
panel("timeseries", "Уникальные посетители в день", `SELECT ${DAY} AS time, COUNT(DISTINCT uid) AS "посетители" FROM events WHERE app = '$app' AND uid IS NOT NULL AND ${RANGE} GROUP BY 1 ORDER BY 1`, { w: 24, decimals: 0, draw: bars, desc: "Браузер = посетитель: обезличенный id в localStorage (planner) или по входу в комнату (retrocine)." });

row("retrocine");
stat("Сейчас онлайн", `SELECT value AS "онлайн" FROM gauges WHERE app = 'retrocine' AND name = 'online' ORDER BY ts DESC LIMIT 1`, 0);
stat("Открыто комнат за период", `SELECT COUNT(*) AS "комнат" FROM events WHERE app = 'retrocine' AND name = 'room.open' AND ${RANGE}`, 6, { desc: "Сколько раз комната поднималась на сервере (первый вход в неё после простоя)." });
stat("Запущено снарядов", `SELECT COUNT(*) AS "снарядов" FROM events WHERE app = 'retrocine' AND name = 'throw' AND ${RANGE}`, 12);
stat("Пробежали, км", `SELECT ROUND(COALESCE(SUM(value), 0) / 1000.0, 2) AS "км" FROM events WHERE app = 'retrocine' AND name = 'distance' AND json_extract(props, '$.mode') = 'foot' AND ${RANGE}`, 18);
panel("timeseries", "Онлайн и активные комнаты", `SELECT ts / 1000 AS time, name, value FROM gauges WHERE app = 'retrocine' AND name IN ('online', 'rooms') AND ${RANGE} ORDER BY ts`, { by: "name", w: 12, decimals: 0 });
panel("barchart", "Наезжено и накатано, км", `SELECT CASE json_extract(props, '$.mode') WHEN 'kart' THEN 'карт' WHEN 'bike' THEN 'BMX' WHEN 'skateboard' THEN 'скейт' WHEN 'scooter' THEN 'самокат' WHEN 'sled' THEN 'санки' WHEN 'zipline' THEN 'троллей' ELSE json_extract(props, '$.mode') END AS "на чём", ROUND(SUM(value) / 1000.0, 2) AS "км" FROM events WHERE app = 'retrocine' AND name = 'distance' AND json_extract(props, '$.mode') <> 'foot' AND ${RANGE} GROUP BY 1 ORDER BY 2 DESC`, { w: 12, x: 12, series: false, options: { orientation: "horizontal", xField: "на чём" } });
panel("timeseries", "Снаряды по видам, в час", `SELECT (ts / 3600000) * 3600 AS time, json_extract(props, '$.w') AS weapon, COUNT(*) AS n FROM events WHERE app = 'retrocine' AND name = 'throw' AND ${RANGE} GROUP BY 1, 2 ORDER BY 1`, { by: "weapon", w: 12, decimals: 0, draw: bars });
panel("timeseries", "Километры в день: пешком и на колёсах", `SELECT ${DAY} AS time, CASE json_extract(props, '$.mode') WHEN 'foot' THEN 'пешком' ELSE 'на колёсах' END AS mode, SUM(value) / 1000.0 AS km FROM events WHERE app = 'retrocine' AND name = 'distance' AND ${RANGE} GROUP BY 1, 2 ORDER BY 1`, { by: "mode", w: 12, x: 12, decimals: 2, draw: bars });

row("planner");
stat("Размечено планов", `SELECT COUNT(*) AS "планов" FROM events WHERE app = 'planner' AND name = 'plan.marked' AND ${RANGE}`, 0, { desc: "Загружено изображение планировки и распознаны стены и проёмы." });
stat("Взаимодействий с планом", `SELECT COUNT(*) AS "действий" FROM events WHERE app = 'planner' AND name = 'edit' AND ${RANGE}`, 6);
stat("Сменили застройщика", `SELECT COUNT(*) AS "раз" FROM events WHERE app = 'planner' AND name = 'edit' AND json_extract(props, '$.what') = 'developer' AND ${RANGE}`, 12);
stat("Отделка", `SELECT COUNT(*) AS "раз" FROM events WHERE app = 'planner' AND name = 'edit' AND json_extract(props, '$.what') = 'finish' AND ${RANGE}`, 18);
panel("barchart", "Взаимодействия по видам", `SELECT CASE json_extract(props, '$.what') WHEN 'furniture' THEN 'мебель' WHEN 'wall' THEN 'стены' WHEN 'window' THEN 'окна' WHEN 'door' THEN 'двери' WHEN 'opening' THEN 'проёмы' WHEN 'finish' THEN 'отделка' WHEN 'scale' THEN 'масштаб' WHEN 'developer' THEN 'застройщик' ELSE json_extract(props, '$.what') END AS "что", COUNT(*) AS "действий" FROM events WHERE app = 'planner' AND name = 'edit' AND ${RANGE} GROUP BY 1 ORDER BY 2 DESC`, { w: 12, series: false, options: { orientation: "horizontal", xField: "что" } });
panel("timeseries", "Размеченные планы в день", `SELECT ${DAY} AS time, COUNT(*) AS "планов" FROM events WHERE app = 'planner' AND name = 'plan.marked' AND ${RANGE} GROUP BY 1 ORDER BY 1`, { w: 12, x: 12, decimals: 0, draw: bars });
panel("timeseries", "Взаимодействия в день по видам", `SELECT ${DAY} AS time, json_extract(props, '$.what') AS what, COUNT(*) AS n FROM events WHERE app = 'planner' AND name = 'edit' AND ${RANGE} GROUP BY 1, 2 ORDER BY 1`, { by: "what", w: 12, decimals: 0, draw: bars });
panel("barchart", "Застройщик при разметке", `SELECT COALESCE(json_extract(props, '$.developer'), 'не задан') AS "застройщик", COUNT(*) AS "планов" FROM events WHERE app = 'planner' AND name = 'plan.marked' AND ${RANGE} GROUP BY 1 ORDER BY 2 DESC`, { w: 12, x: 12, series: false, options: { orientation: "horizontal", xField: "застройщик" } });

const dashboard = {
  uid: "apps",
  title: "Аналитика приложений",
  timezone: "browser",
  schemaVersion: 39,
  time: { from: "now-7d", to: "now" },
  refresh: "1m",
  templating: { list: [{ name: "app", label: "Приложение", type: "custom", query: "retrocine,planner", current: { text: "retrocine", value: "retrocine" }, options: [] }] },
  panels,
};
writeFileSync(new URL("./dashboards/apps.json", import.meta.url), JSON.stringify(dashboard, null, 2) + "\n");
console.log(`${panels.length} panels`);
