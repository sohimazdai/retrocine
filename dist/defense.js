// Защита крепости: из двери подземелья волнами выходят монстры и идут к крепости на другом краю
// поля; ближе 4 м к аватару — идут на него. Подойдя, бьют: аватара — на урон своего класса, крепость
// (100 HP) — тоже. Крепость пала — команда проиграла; выстояли все волны — победа.
//
// Чистая логика, без Three.js и DOM: её ведёт сервер (монстры, волны, крепость, награды), а без
// сервера — браузер тем же кодом. Как в командном бою, каждый браузер сам отвечает за здоровье своего
// аватара и за попадания своих снарядов: сервер говорит «монстр ударил вас на 2», браузер сообщает
// «мой снежок попал в монстра на 1».
//
// Ход игры: все нажали R → 5 с отсчёта → волна 1 → передышка с наградами → волна 2 → … Волн по
// умолчанию 5 (1–10 в настройках мини-игры): первая самая маленькая и короткая, последняя самая
// крупная, длинная и кончается боссом. Каждый следующий аватар в комнате прибавляет монстрам частоты.

import { clamp, inside, sloped, surfaceOf, LIMITS } from "./physics.js";
import { ROOM, floorBack } from "./layout.js";
import { zonesOf, inZone } from "./world.js";
import { blastDamage } from "./match.js";

export const DEFENSE = {
  fortHp: 100,
  avatarHp: 20,
  // Ближе этого монстр идёт на аватара, а не к крепости; бросает погоню, когда тот дальше leash
  // (запас, чтобы монстр не метался на самой границе).
  aggro: 4,
  leash: 5,
  countdown: 5000,
  intermission: 20000,
  // Все выбрали награду — следующая волна через 3 с, не дожидаясь конца передышки.
  afterPick: 3000,
  endPause: 9000,
  // Больше одновременно не выпускаем: и серверу, и браузерам хватит.
  maxAlive: 60,
  respawn: 6000,
  waves: { min: 1, max: 10, default: 5 },
};

// ——— Классы монстров ———
// hp — здоровье (снежок −1, камень −2, кирпич −4, взрыв в центре −10); speed — м/с; r — радиус тела;
// tall — рост (достаёт аватара, стоящего не выше ¾ роста над землёй); reach — дотягивается от края
// тела; hit / fort — урон аватару и крепости за удар; every — секунд между ударами.
export const MONSTERS = {
  goblin: { name: "Гоблин", group: "Мелочь", hp: 3, speed: 2.4, r: 0.3, tall: 1.05, reach: 0.5, hit: 1, fort: 1, every: 0.9 },
  bat: { name: "Нетопырь", group: "Мелочь", hp: 2, speed: 3.0, r: 0.3, tall: 0.5, reach: 0.5, hit: 1, fort: 1, every: 0.8, fly: 1.8 },
  zombie: { name: "Зомби", group: "Нежить", hp: 6, speed: 1.0, r: 0.34, tall: 1.8, reach: 0.6, hit: 2, fort: 2, every: 1.4 },
  skeleton: { name: "Скелет", group: "Нежить", hp: 4, speed: 1.7, r: 0.32, tall: 1.75, reach: 0.75, hit: 2, fort: 2, every: 1.1 },
  slime: { name: "Слизень", group: "Чудища", hp: 8, speed: 1.15, r: 0.5, tall: 0.85, reach: 0.4, hit: 2, fort: 4, every: 1.6 },
  ogre: { name: "Огр", group: "Чудища", hp: 22, speed: 0.85, r: 0.72, tall: 2.7, reach: 0.8, hit: 5, fort: 7, every: 2.0 },
  golem: { name: "Каменный голем", group: "Босс", hp: 70, speed: 0.6, r: 1.0, tall: 3.6, reach: 0.9, hit: 8, fort: 15, every: 2.6, boss: true },
};
// Вероятность появления: вес в первой волне и в последней (между ними — по прямой) и с какой доли игры
// класс вообще выходит (0 — с первой волны). Голем — не из общего списка: босс последней волны.
export const SPAWN = {
  goblin: { first: 60, last: 22, from: 0 },
  zombie: { first: 30, last: 20, from: 0 },
  skeleton: { first: 10, last: 20, from: 0 },
  slime: { first: 0, last: 12, from: 0.25 },
  bat: { first: 0, last: 14, from: 0.3 },
  ogre: { first: 0, last: 12, from: 0.45 },
};
// p — доля пройденной игры (0 — первая волна, 1 — последняя). Возвращает вероятности классов.
export function spawnOdds(p) {
  const w = Object.fromEntries(Object.entries(SPAWN).map(([c, s]) => [c, p + 1e-9 < s.from ? 0 : s.first + (s.last - s.first) * p]));
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(w).map(([c, v]) => [c, v / total]));
}
export function pickClass(p, rand = Math.random) {
  let x = rand();
  const odds = spawnOdds(p);
  for (const [c, v] of Object.entries(odds)) if ((x -= v) < 0) return c;
  return "goblin";
}
// Волна w из n: сколько секунд из двери идут монстры и сколько в секунду (на одного игрока). Первая —
// 25 с по 0,3 (около 8 монстров), последняя — 65 с по 0,65 (около 42) и босс.
export function waveInfo(w, n) {
  const p = n > 1 ? (w - 1) / (n - 1) : 1;
  return { p, duration: 25 + 40 * p, rate: 0.3 + 0.35 * p, bosses: w === n ? 1 : 0 };
}
// Каждый следующий аватар в комнате прибавляет половину частоты.
export const crowd = (players) => 1 + 0.5 * Math.max(0, players - 1);

// ——— Награды между волнами ———
// После каждой волны (кроме последней) каждому игроку выпадают три карточки, он берёт одну. Оружие:
// в начале защиты есть снежки, помидоры и камни, остальное открывают карточки. Умения — только свои.
// Крепость — для всех: ремонт, укрепления и самострелы на стенах.
export const BASE_WEAPONS = ["snow", "tomato", "rock"];
export const CARDS = {
  brick: { kind: "weapon", w: "brick", icon: "🧱", title: "Кирпичи", text: "Тяжёлые: −4 монстру, раз в секунду" },
  grenade: { kind: "weapon", w: "grenade", icon: "💣", title: "Гранаты", text: "Взрыв по толпе, раз в 10 с" },
  fireball: { kind: "weapon", w: "fireball", icon: "🔥", title: "Фаерболы", text: "Взрываются при касании, раз в 5 с" },
  icicle: { kind: "weapon", w: "icicle", icon: "🧊", title: "Сосульки", text: "Монстры вокруг на 3 с еле ползут" },
  mine: { kind: "weapon", w: "mine", icon: "🧨", title: "Мины", text: "Сколько угодно, срабатывают под монстрами" },
  bow: { kind: "weapon", w: "bow", icon: "🏹", title: "Лук", text: "Стрелы летят быстро и далеко: −3" },
  pistol: { kind: "weapon", w: "pistol", icon: "🔫", title: "Пистолет", text: "Выстрел почти мгновенный, через всё поле: −2" },
  power: { kind: "perk", max: 3, icon: "💪", title: "Сильный бросок", text: "Ваши снаряды бьют на 50% сильнее" },
  quick: { kind: "perk", max: 2, icon: "⚡", title: "Ловкие руки", text: "Перезарядка на 30% быстрее" },
  tough: { kind: "perk", max: 3, icon: "❤️", title: "Крепкое здоровье", text: "+10 к здоровью и полное лечение" },
  regen: { kind: "perk", max: 2, icon: "🌿", title: "Второе дыхание", text: "+1 здоровья каждые 2 с" },
  swift: { kind: "perk", max: 2, icon: "👟", title: "Быстрые ноги", text: "Бег на 15% быстрее" },
  vamp: { kind: "perk", max: 2, icon: "🍖", title: "Трофеи", text: "Каждый ваш убитый монстр лечит 2 здоровья" },
  repair: { kind: "team", icon: "🔨", title: "Ремонт стен", text: "Крепость +30 прочности" },
  fortify: { kind: "team", max: 3, icon: "🛡️", title: "Укрепления", text: "Прочность крепости +25, сразу и навсегда" },
  turret: { kind: "team", icon: "🏹", title: "Самострел", text: "На стене встаёт самострел: бьёт ближайшего монстра" },
};
// Самострел: раз в 1,5 с бьёт ближайшего монстра не дальше 18 м на 2.
export const TURRET = { every: 1.5, range: 18, dmg: 2 };
// Урон снарядов монстрам (до умения «Сильный бросок»); взрывы — отдельно, как в командном бою. Лук и
// пистолет открываются наградой, как кирпичи и гранаты.
export const WEAPON_DMG = { snow: 1, tomato: 1, rock: 2, brick: 4, icicle: 1, fireball: 2, grenade: 1, bow: 3, pistol: 2, melee: 1 };

const blankPerks = () => ({ w: [], power: 0, quick: 0, tough: 0, regen: 0, swift: 0, vamp: 0 });
export const perksOf = (d, id) => d?.perks?.[id] || blankPerks();
export const damageFactor = (d, id) => 1 + 0.5 * perksOf(d, id).power;
export const cooldownFactor = (d, id) => (defenseLive(d) ? 0.7 ** perksOf(d, id).quick : 1);
export const maxHp = (d, id) => DEFENSE.avatarHp + 10 * perksOf(d, id).tough;
export const defenseLive = (d) => !!d && d.phase !== "idle";
// Чем можно бросаться: пока идёт защита — снежки, помидоры, камни и открытое наградами.
export function weaponAllowed(d, id, weapon) {
  return !defenseLive(d) || BASE_WEAPONS.includes(weapon) || perksOf(d, id).w.includes(weapon);
}

// ——— Состояние ———
export function createDefense(waves = DEFENSE.waves.default) {
  return {
    phase: "idle",
    waves: clamp(Math.round(waves) || DEFENSE.waves.default, DEFENSE.waves.min, DEFENSE.waves.max),
    wave: 0,
    until: null,
    fort: DEFENSE.fortHp,
    fortMax: DEFENSE.fortHp,
    ready: {},
    monsters: [],
    perks: {},
    offers: {},
    picked: {},
    stats: {},
    turrets: 0,
    turretCd: [],
    fortify: 0,
    epoch: 0,
    // Внутреннее: счётчик id, накопленные «полмонстра» волны, когда кончается выпуск, вышел ли босс.
    next: 1,
    acc: 0,
    spawnUntil: 0,
    bossDone: false,
    pickedAt: null,
  };
}
export const monsterPublic = (m) => ({ id: m.id, c: m.c, v: m.v, x: m.x, z: m.z, a: m.a, hp: m.hp, max: m.max, st: m.st });
// Для новичков (и для браузера без сервера) — всё, что видно; на диск — только настройка: после
// перезапуска сервера игра начинается заново.
export function serializeDefense(d) {
  return {
    phase: d.phase,
    waves: d.waves,
    wave: d.wave,
    until: d.until,
    fort: Math.max(0, Math.round(d.fort * 10) / 10),
    fortMax: d.fortMax,
    ready: d.ready,
    monsters: d.monsters.map(monsterPublic),
    perks: d.perks,
    offers: d.offers,
    picked: d.picked,
    stats: d.stats,
    turrets: d.turrets,
    epoch: d.epoch,
  };
}
export function loadDefense(data) {
  return createDefense(data?.waves);
}

// ——— Местность: земля под монстром, болото, поле путей к крепости ———
const mapCache = new Map();
function mapData(map) {
  const key = map.id + ":" + ROOM.scale;
  let c = mapCache.get(key);
  if (c) return c;
  const statics = map.statics || [];
  c = {
    mounds: statics.filter((b) => b.shape === "mound"),
    // Что монстр обходит: всё твёрдое выше колена (холмы — нет, по ним идут; пандусы и мостки — да).
    solid: statics.filter((b) => b.shape !== "mound" && !b.rail && !(b.y > 1.2) && (sloped(b) || b.h > 0.35)),
    swamps: zonesOf(map).filter((z) => z.kind === "water" && z.slow),
    flow: null,
  };
  mapCache.set(key, c);
  return c;
}
export function terrainHeight(map, x, z) {
  let y = 0;
  for (const b of mapData(map).mounds) if (inside(x, z, b)) y = Math.max(y, surfaceOf(b, x, z));
  return y;
}
const swampAt = (map, x, z) => mapData(map).swamps.find((zone) => inZone(zone, x, z)) || null;
const hullDistance = (f, x, z) => Math.hypot(Math.max(f.x0 - x, 0, x - f.x1), Math.max(f.z0 - z, 0, z - f.z1));
const inHull = (f, x, z, pad = 0) => x > f.x0 - pad && x < f.x1 + pad && z > f.z0 - pad && z < f.z1 + pad;

// Поле путей: сетка 0,5 м, у каждой клетки — «время пути» до стен крепости в обход камней и руин
// (через болото — вдвое дольше, так что его обходят, если крюк не длиннее). Считается один раз на
// карту: монстр идёт в соседнюю клетку с меньшим временем.
const CELL = 0.5;
export function flowField(map) {
  const data = mapData(map);
  if (data.flow) return data.flow;
  const f = map.defense.fort,
    x0 = -ROOM.halfWidth,
    z0 = ROOM.back,
    nx = Math.ceil((2 * ROOM.halfWidth) / CELL),
    nz = Math.ceil((ROOM.front - ROOM.back) / CELL),
    blocked = new Uint8Array(nx * nz),
    cost = new Float32Array(nx * nz).fill(1),
    dist = new Float64Array(nx * nz).fill(Infinity);
  const cx = (i) => x0 + (i + 0.5) * CELL,
    cz = (j) => z0 + (j + 0.5) * CELL;
  const heap = [];
  const push = (k, d) => {
    heap.push([d, k]);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0],
      last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i,
        x = cx(i),
        z = cz(j);
      if (z < floorBack(x) + 0.3 || inHull(f, x, z) || data.solid.some((b) => inside(x, z, b, 0.35))) {
        blocked[k] = 1;
        continue;
      }
      const swamp = data.swamps.find((zone) => inZone(zone, x, z));
      if (swamp) cost[k] = 1 / swamp.slow;
      if (hullDistance(f, x, z) <= 0.8) {
        dist[k] = 0;
        push(k, 0);
      }
    }
  const STEPS = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  while (heap.length) {
    const [d, k] = pop();
    if (d > dist[k]) continue;
    const i = k % nx,
      j = (k - i) / nx;
    for (const [di, dj, len] of STEPS) {
      const a = i + di,
        b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const n = b * nx + a;
      if (blocked[n]) continue;
      // По диагонали — только если не срезаем угол препятствия.
      if (di && dj && (blocked[j * nx + a] || blocked[b * nx + i])) continue;
      const nd = d + len * CELL * (cost[k] + cost[n]) * 0.5;
      if (nd < dist[n]) {
        dist[n] = nd;
        push(n, nd);
      }
    }
  }
  data.flow = { x0, z0, nx, nz, dist, blocked, cell: CELL };
  return data.flow;
}
// Куда идти к крепости из (x, z): единичный вектор к соседней клетке с меньшим временем пути.
export function flowDirection(map, x, z) {
  const fl = flowField(map),
    i = clamp(Math.floor((x - fl.x0) / CELL), 0, fl.nx - 1),
    j = clamp(Math.floor((z - fl.z0) / CELL), 0, fl.nz - 1);
  let best = null,
    bestD = fl.dist[j * fl.nx + i];
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di,
        b = j + dj;
      if (a < 0 || b < 0 || a >= fl.nx || b >= fl.nz) continue;
      const d = fl.dist[b * fl.nx + a];
      if (d < bestD) {
        bestD = d;
        best = [a, b];
      }
    }
  // Без пути (зажали в угол): прямо к крепости.
  const f = map.defense.fort,
    tx = best ? fl.x0 + (best[0] + 0.5) * CELL : clamp(x, f.x0, f.x1),
    tz = best ? fl.z0 + (best[1] + 0.5) * CELL : clamp(z, f.z0, f.z1),
    dx = tx - x,
    dz = tz - z,
    l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l };
}

// ——— Ход игры ———
const present = (avatars) => avatars.map((a) => a.id);
export function ready(d, id, now, peers) {
  if (d.phase !== "idle") return false;
  d.ready[id] = true;
  if (peers.length && peers.every((p) => d.ready[p])) {
    d.phase = "countdown";
    d.until = now + DEFENSE.countdown;
  }
  return true;
}
export function unready(d, id) {
  if (d.phase !== "idle" || !d.ready[id]) return false;
  delete d.ready[id];
  return true;
}
export function configure(d, waves) {
  if (d.phase !== "idle" || !Number.isFinite(waves)) return false;
  d.waves = clamp(Math.round(waves), DEFENSE.waves.min, DEFENSE.waves.max);
  return true;
}
function startGame(d) {
  Object.assign(d, { wave: 0, fort: DEFENSE.fortHp, fortMax: DEFENSE.fortHp, monsters: [], perks: {}, offers: {}, picked: {}, stats: {}, turrets: 0, turretCd: [], fortify: 0, next: 1 });
  d.epoch++;
}
function startWave(d, now) {
  d.wave++;
  d.phase = "wave";
  d.until = null;
  d.acc = 0.6;
  d.spawnUntil = now + waveInfo(d.wave, d.waves).duration * 1000;
  d.bossDone = !waveInfo(d.wave, d.waves).bosses;
  d.offers = {};
  d.picked = {};
  d.pickedAt = null;
}
function endGame(d, now, phase) {
  d.phase = phase;
  d.until = now + DEFENSE.endPause;
  d.monsters = [];
}
function spawn(d, map, c, rand) {
  const cls = MONSTERS[c],
    door = map.defense.door,
    v = Math.floor(rand() * 1000);
  const m = {
    id: "m" + d.next++,
    c,
    v,
    x: door.x + (rand() - 0.5) * door.w,
    z: door.z + (rand() - 0.5) * door.d,
    a: -Math.PI / 2,
    hp: cls.hp,
    max: cls.hp,
    st: 0,
    // Внутри класса монстры чуть разные: и видом (v), и шагом.
    sp: 0.92 + ((v * 7) % 17) / 100,
    cd: 0,
    tgt: null,
    frozen: 0,
  };
  m.y = cls.fly ? cls.fly : terrainHeight(map, m.x, m.z);
  d.monsters.push(m);
  return { t: "mon", m: monsterPublic(m) };
}
// Карточки: три разных из доступных этому игроку; ремонт выпадает тем чаще, чем сильнее побита крепость.
function eligible(d, map, id) {
  const p = perksOf(d, id),
    slots = map.defense.turrets?.length || 0;
  return Object.entries(CARDS)
    .filter(([key, card]) => {
      if (card.kind === "weapon") return !p.w.includes(card.w);
      if (card.kind === "perk") return (p[key] || 0) < card.max;
      if (key === "fortify") return d.fortify < card.max;
      if (key === "turret") return d.turrets < slots;
      return true;
    })
    .map(([key, card]) => [key, card.kind === "weapon" ? 3 : card.kind === "perk" ? 2 : key === "repair" ? 1 + 4 * (1 - d.fort / d.fortMax) : 1.6]);
}
export function deal(d, map, id, rand = Math.random) {
  const pool = eligible(d, map, id),
    out = [];
  while (out.length < 3 && pool.length) {
    let x = rand() * pool.reduce((a, [, w]) => a + w, 0),
      i = 0;
    while (i < pool.length - 1 && (x -= pool[i][1]) >= 0) i++;
    out.push(pool[i][0]);
    pool.splice(i, 1);
  }
  return out;
}
export function pick(d, map, id, card, now) {
  if (d.phase !== "break" || d.picked[id] || !d.offers[id]?.includes(card)) return false;
  d.picked[id] = card;
  const def = CARDS[card],
    p = (d.perks[id] = d.perks[id] || blankPerks());
  if (def.kind === "weapon") p.w.push(def.w);
  else if (def.kind === "perk") p[card] = (p[card] || 0) + 1;
  else if (card === "repair") d.fort = Math.min(d.fortMax, d.fort + 30);
  else if (card === "fortify") {
    d.fortify++;
    d.fortMax += 25;
    d.fort += 25;
  } else if (card === "turret") d.turrets = Math.min(map.defense.turrets?.length || 0, d.turrets + 1);
  if (Object.keys(d.offers).every((k) => d.picked[k])) d.pickedAt = now;
  return true;
}
// Попадание снаряда или удар ногой (браузер бросившего говорит, на сколько). Возвращает сообщение или null.
export function hitMonster(d, id, amount, by, w, dir = null) {
  if (d.phase !== "wave") return null;
  const m = d.monsters.find((o) => o.id === id);
  if (!m || !(amount > 0)) return null;
  m.hp -= amount;
  const s = (d.stats[by] = d.stats[by] || { k: 0, dmg: 0 });
  s.dmg += amount;
  // Удар немного отбрасывает (тяжёлых — меньше).
  if (dir && Number.isFinite(dir.x) && Number.isFinite(dir.z)) {
    const push = Math.min(0.6, (amount * 0.12) / MONSTERS[m.c].r);
    m.x += dir.x * push;
    m.z += dir.z * push;
  }
  const out = { t: "mon.dmg", id, hp: Math.max(0, Math.round(m.hp * 10) / 10), by, w };
  if (m.hp <= 0) {
    s.k++;
    out.x = m.x;
    out.z = m.z;
    d.monsters = d.monsters.filter((o) => o !== m);
  }
  return out;
}
// Взрыв гранаты, фаербола или мины: урон как в командном бою (центр −10, половина радиуса −5, край 0)
// и отброс от центра.
export function blastMonsters(d, x, z, radius, by) {
  const out = [];
  if (d?.phase !== "wave") return out;
  for (const m of [...d.monsters]) {
    const dx = m.x - x,
      dz = m.z - z,
      dist = Math.hypot(dx, dz),
      dmg = blastDamage(Math.max(0, dist - MONSTERS[m.c].r), radius);
    if (dmg <= 0) continue;
    const e = hitMonster(d, m.id, dmg, by, "blast", dist > 1e-3 ? { x: (dx / dist) * 4, z: (dz / dist) * 4 } : null);
    if (e) out.push(e);
  }
  return out;
}
// Сосулька: монстры вокруг на несколько секунд еле ползут.
export function frostMonsters(d, x, z, radius, seconds) {
  if (d?.phase !== "wave") return 0;
  let n = 0;
  for (const m of d.monsters)
    if (Math.hypot(m.x - x, m.z - z) < radius + MONSTERS[m.c].r) {
      m.frozen = Math.max(m.frozen, seconds);
      n++;
    }
  return n;
}

// Кого монстр может ударить: живого, вне крепости, не выше ¾ его роста над землёй (нетопырь достаёт
// и до стен).
function reachable(map, m, cls, a) {
  if (a.down || inHull(map.defense.fort, a.x, a.z, 0.2)) return false;
  const up = a.y - terrainHeight(map, a.x, a.z);
  return cls.fly ? up < 3.5 : up <= cls.tall * 0.75;
}
// Монстров не пускает в твёрдое: выталкивает из камней и руин.
function pushOut(m, r, solid) {
  for (const b of solid) {
    if (sloped(b) || !inside(m.x, m.z, b, r)) continue;
    if (b.shape === "cylinder") {
      const dx = m.x - b.x,
        dz = m.z - b.z,
        d = Math.hypot(dx, dz) || 1e-6,
        k = (b.radius + r) / d;
      m.x = b.x + dx * k;
      m.z = b.z + dz * k;
    } else {
      const px = b.w / 2 + r - Math.abs(m.x - b.x),
        pz = b.d / 2 + r - Math.abs(m.z - b.z);
      if (px < pz) m.x += Math.sign(m.x - b.x || 1) * px;
      else m.z += Math.sign(m.z - b.z || 1) * pz;
    }
  }
}
const turn = (from, to, k) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;

// Один шаг (сервер — 30 раз в секунду). avatars: [{ id, x, y, z, down }] — кто в комнате и где.
// Возвращает сообщения для всех.
export function stepDefense(d, map, now, dt, avatars, rand = Math.random) {
  const out = [];
  if (!map.defense) return out;
  const ids = present(avatars);
  if (d.phase === "countdown" && now >= d.until) {
    startGame(d);
    startWave(d, now);
    out.push({ t: "def", def: serializeDefense(d) });
  } else if (d.phase === "break" && (now >= d.until || (d.pickedAt && now >= d.pickedAt + DEFENSE.afterPick))) {
    // Кто не выбрал награду — получает первую из своих карточек.
    for (const id of Object.keys(d.offers)) if (!d.picked[id]) pick(d, map, id, d.offers[id][0], now);
    startWave(d, now);
    out.push({ t: "def", def: serializeDefense(d) });
  } else if ((d.phase === "won" || d.phase === "lost") && now >= d.until) {
    const waves = d.waves,
      epoch = d.epoch;
    Object.assign(d, createDefense(waves), { epoch: epoch + 1 });
    out.push({ t: "def", def: serializeDefense(d) });
  }
  if (d.phase !== "wave") return out;

  // Выпуск: пока идёт волна, монстры выходят с частотой волны, умноженной на толпу в комнате.
  const info = waveInfo(d.wave, d.waves);
  if (now < d.spawnUntil) {
    d.acc += info.rate * crowd(ids.length) * dt;
    while (d.acc >= 1 && d.monsters.length < DEFENSE.maxAlive) {
      d.acc -= 1;
      out.push(spawn(d, map, pickClass(info.p, rand), rand));
    }
    d.acc = Math.min(d.acc, 3);
  } else if (!d.bossDone) {
    d.bossDone = true;
    for (let i = 0; i < info.bosses + Math.floor((ids.length - 1) / 3); i++) out.push(spawn(d, map, "golem", rand));
  }

  const data = mapData(map),
    f = map.defense.fort;
  for (const m of d.monsters) {
    const cls = MONSTERS[m.c];
    m.cd = Math.max(0, m.cd - dt);
    m.frozen = Math.max(0, m.frozen - dt);
    // Цель: аватар ближе 4 м (уже выбранный — пока ближе 5 м), иначе крепость.
    let target = null,
      best = Infinity;
    for (const a of avatars) {
      const dist = Math.hypot(a.x - m.x, a.z - m.z);
      if (dist < (a.id === m.tgt ? DEFENSE.leash : DEFENSE.aggro) && dist < best && reachable(map, m, cls, a)) {
        best = dist;
        target = a;
      }
    }
    m.tgt = target?.id || null;
    let dir = null,
      atk = null;
    if (target) {
      if (best <= cls.r + 0.3 + cls.reach) atk = target.id;
      else dir = { x: (target.x - m.x) / best, z: (target.z - m.z) / best };
    } else if (hullDistance(f, m.x, m.z) <= cls.r + cls.reach + 0.05) atk = "fort";
    else if (cls.fly) {
      // Нетопыри летят напрямую, над камнями и болотом.
      const tx = clamp(m.x, f.x0, f.x1),
        tz = clamp(m.z, f.z0, f.z1),
        l = Math.hypot(tx - m.x, tz - m.z) || 1;
      dir = { x: (tx - m.x) / l, z: (tz - m.z) / l };
    } else dir = flowDirection(map, m.x, m.z);
    m.st = atk ? (atk === "fort" ? 3 : 2) : target ? 1 : 0;
    if (atk) {
      const tx = atk === "fort" ? clamp(m.x, f.x0, f.x1) : target.x,
        tz = atk === "fort" ? clamp(m.z, f.z0, f.z1) : target.z;
      m.a = turn(m.a, Math.atan2(tx - m.x, tz - m.z), Math.min(1, dt * 8));
      // Замах перед первым ударом, потом — раз в every секунд.
      if (m.atk !== atk) {
        m.atk = atk;
        m.cd = Math.max(m.cd, cls.every * 0.4);
      } else if (m.cd <= 0 && !(m.frozen > 0 && rand() < 0.5)) {
        m.cd = cls.every;
        if (atk === "fort") {
          d.fort -= cls.fort;
          out.push({ t: "mon.atk", id: m.id, target: "fort", dmg: cls.fort, fort: Math.max(0, d.fort) });
        } else out.push({ t: "mon.atk", id: m.id, target: atk, dmg: cls.hit });
      }
      continue;
    }
    m.atk = null;
    const swamp = cls.fly ? null : swampAt(map, m.x, m.z),
      speed = cls.speed * m.sp * (swamp ? swamp.slow : 1) * (m.frozen > 0 ? 0.35 : 1);
    m.a = turn(m.a, Math.atan2(dir.x, dir.z), Math.min(1, dt * 6));
    // Идёт туда, куда смотрит: повороты плавные, а не рывками от клетки к клетке.
    m.x += Math.sin(m.a) * speed * dt;
    m.z += Math.cos(m.a) * speed * dt;
  }
  // Монстры не залезают друг в друга (крупный теснит мелкого); нетопыри летают над всеми.
  const walkers = d.monsters.filter((m) => !MONSTERS[m.c].fly);
  for (let i = 0; i < walkers.length; i++)
    for (let j = i + 1; j < walkers.length; j++) {
      const a = walkers[i],
        b = walkers[j],
        ra = MONSTERS[a.c].r,
        rb = MONSTERS[b.c].r,
        dx = b.x - a.x,
        dz = b.z - a.z,
        dist = Math.hypot(dx, dz),
        over = ra + rb - dist;
      if (over <= 0) continue;
      const nx = dist > 1e-6 ? dx / dist : 1,
        nz = dist > 1e-6 ? dz / dist : 0,
        wa = (rb * rb) / (ra * ra + rb * rb);
      a.x -= nx * over * wa;
      a.z -= nz * over * wa;
      b.x += nx * over * (1 - wa);
      b.z += nz * over * (1 - wa);
    }
  for (const m of d.monsters) {
    const cls = MONSTERS[m.c];
    if (!cls.fly) {
      pushOut(m, cls.r, data.solid);
      // В стены крепости тоже не входят.
      if (inHull(f, m.x, m.z, cls.r)) {
        const opts = [
          [f.x0 - cls.r - m.x, 0],
          [f.x1 + cls.r - m.x, 0],
          [0, f.z0 - cls.r - m.z],
          [0, f.z1 + cls.r - m.z],
        ].sort((p, q) => Math.hypot(...p) - Math.hypot(...q));
        m.x += opts[0][0];
        m.z += opts[0][1];
      }
    }
    m.x = clamp(m.x, -LIMITS.x, LIMITS.x);
    m.z = clamp(m.z, floorBack(m.x) + cls.r, LIMITS.z);
    m.y = cls.fly ? terrainHeight(map, m.x, m.z) + cls.fly : terrainHeight(map, m.x, m.z);
  }

  // Самострелы на стенах.
  const spots = map.defense.turrets || [];
  for (let i = 0; i < d.turrets && i < spots.length; i++) {
    d.turretCd[i] = Math.max(0, (d.turretCd[i] ?? 0) - dt);
    if (d.turretCd[i] > 0) continue;
    const t = spots[i];
    let aim = null,
      near = TURRET.range;
    for (const m of d.monsters) {
      const dist = Math.hypot(m.x - t.x, m.z - t.z);
      if (dist < near) {
        near = dist;
        aim = m;
      }
    }
    if (!aim) continue;
    d.turretCd[i] = TURRET.every;
    const e = hitMonster(d, aim.id, TURRET.dmg, "turret", "bolt");
    if (e) out.push({ ...e, tu: i, bx: aim.x, bz: aim.z });
  }

  // Крепость пала — поражение; волна выпущена и перебита — передышка с наградами или победа.
  if (d.fort <= 0) {
    endGame(d, now, "lost");
    out.push({ t: "def", def: serializeDefense(d) });
  } else if (now >= d.spawnUntil && d.bossDone && !d.monsters.length) {
    if (d.wave >= d.waves) endGame(d, now, "won");
    else {
      d.phase = "break";
      d.until = now + DEFENSE.intermission;
      d.offers = Object.fromEntries(ids.map((id) => [id, deal(d, map, id, rand)]));
      d.picked = {};
      d.pickedAt = null;
    }
    out.push({ t: "def", def: serializeDefense(d) });
  }
  return out;
}
// Позиции монстров для рассылки (~10 раз в секунду): [id, x, z, угол, что делает].
export const packMonsters = (d) => d.monsters.map((m) => [m.id, Math.round(m.x * 100) / 100, Math.round(m.z * 100) / 100, Math.round(m.a * 100) / 100, m.st]);
