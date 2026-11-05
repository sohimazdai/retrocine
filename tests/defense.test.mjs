// Защита крепости без браузера: волны, классы монстров, пути, удары, награды.
import test from "node:test";
import assert from "node:assert/strict";
import { createState, applyOp, runDefense, serializeState } from "../dist/state.js";
import { DEFENSE, MONSTERS, SPAWN, spawnOdds, waveInfo, crowd, flowField, flowDirection, terrainHeight, weaponAllowed, CARDS, createDefense, pick } from "../dist/defense.js";
import { mapDef } from "../dist/maps/index.js";
import { inside } from "../dist/physics.js";
import { setRoomScale } from "../dist/layout.js";

const map = mapDef("fortress");
let n = 0;
const newId = () => "id" + ++n;
const ctx = (peer, now = 0, peers = [peer]) => ({ uid: "u-" + peer, peer, name: peer, now, newId, peers });
// Детерминированный «случай» для повторяемых тестов.
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
function game(peers = ["a"]) {
  const s = createState({ map: "fortress" }, newId);
  for (const p of peers) applyOp(s, { t: "def.ready" }, ctx(p, 0, peers));
  return s;
}
// Прокрутить защиту: avatars — где стоят игроки (по умолчанию — во дворе крепости, их не достать).
function run(s, seconds, { avatars = [{ id: "a", x: -27, y: 0, z: -4 }], from = 0, rand = seeded() } = {}) {
  const events = [];
  let now = from;
  for (let i = 0; i < seconds * 30; i++) {
    now += 1000 / 30;
    for (const e of runDefense(s, now, 1 / 30, typeof avatars === "function" ? avatars() : avatars, rand)) events.push(e);
  }
  return { events, now };
}
const spawnOf = (s, c, x, z) => {
  const m = { id: "t" + ++n, c, v: 1, x, z, a: -Math.PI / 2, hp: MONSTERS[c].hp, max: MONSTERS[c].hp, st: 0, sp: 1, cd: 0, tgt: null, frozen: 0, y: 0 };
  s.defense.monsters.push(m);
  return m;
};
// Поставить идущую волну без выпуска новых (чтобы смотреть на одного монстра).
function quietWave(s) {
  Object.assign(s.defense, { phase: "wave", wave: 1, spawnUntil: -1, bossDone: true, acc: 0 });
}

test("monster classes: seven of them in four groups, stronger ones hit harder; odds change from the first wave to the last", () => {
  assert.deepEqual(Object.keys(MONSTERS), ["goblin", "bat", "zombie", "skeleton", "slime", "ogre", "golem"]);
  assert.deepEqual([...new Set(Object.values(MONSTERS).map((m) => m.group))], ["Мелочь", "Нежить", "Чудища", "Босс"]);
  assert(MONSTERS.ogre.hit > MONSTERS.zombie.hit && MONSTERS.zombie.hit > MONSTERS.goblin.hit);
  assert(MONSTERS.golem.fort > MONSTERS.ogre.fort && MONSTERS.golem.hp > MONSTERS.ogre.hp);
  const first = spawnOdds(waveInfo(1, 5).p),
    last = spawnOdds(waveInfo(5, 5).p);
  for (const odds of [first, last]) assert(Math.abs(Object.values(odds).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.deepEqual(Object.keys(first).filter((c) => first[c] > 0), ["goblin", "zombie", "skeleton"], "the first wave: small fry and the undead");
  assert.deepEqual(Object.keys(last).filter((c) => last[c] > 0).sort(), Object.keys(SPAWN).sort(), "the last: everyone");
  assert(first.goblin > last.goblin && first.ogre === 0 && last.ogre > 0.1);
  assert.equal(first.golem, undefined, "the golem is only the last wave's boss");
  // Волны: первая — самая короткая и маленькая, последняя — самая длинная, крупная и с боссом.
  const sizes = [1, 2, 3, 4, 5].map((w) => waveInfo(w, 5).duration * waveInfo(w, 5).rate);
  assert(sizes.every((v, i) => !i || v > sizes[i - 1]), `growing: ${sizes.map(Math.round)}`);
  assert.equal(waveInfo(5, 5).bosses, 1);
  assert.equal(waveInfo(4, 5).bosses, 0);
  assert.equal(crowd(1), 1);
  assert.equal(crowd(3), 2);
});

test("the game starts when everyone present is ready; the number of waves is set before it, 1 to 10, default 5", () => {
  const s = createState({ map: "fortress" }, newId);
  assert.equal(s.defense.waves, 5);
  applyOp(s, { t: "def.config", waves: 7 }, ctx("a"));
  assert.equal(s.defense.waves, 7);
  applyOp(s, { t: "def.config", waves: 40 }, ctx("a"));
  assert.equal(s.defense.waves, 10);
  applyOp(s, { t: "def.config", waves: 0 }, ctx("a"));
  assert.equal(s.defense.waves, 1);
  applyOp(s, { t: "def.config", waves: 5 }, ctx("a"));
  applyOp(s, { t: "def.ready" }, ctx("a", 0, ["a", "b"]));
  assert.equal(s.defense.phase, "idle", "b is not ready yet");
  applyOp(s, { t: "def.ready" }, ctx("b", 0, ["a", "b"]));
  assert.equal(s.defense.phase, "countdown");
  assert.equal(applyOp(s, { t: "def.config", waves: 3 }, ctx("a")), null, "no changes once it is on");
  run(s, DEFENSE.countdown / 1000 + 0.1, { avatars: [{ id: "a", x: -27, y: 0, z: -4 }, { id: "b", x: -27, y: 0, z: 5 }] });
  assert.equal(s.defense.phase, "wave");
  assert.equal(s.defense.wave, 1);
  // Сохраняется только настройка: после перезапуска — заново.
  const again = createState(JSON.parse(JSON.stringify(serializeState(s))), newId);
  assert.equal(again.defense.phase, "idle");
  assert.equal(again.defense.waves, 5);
  assert.equal(createState({ map: "cinema" }, newId).defense, null, "only on its map");
});

test("monsters come out of the dungeon door, more of them the more avatars are in the room", () => {
  const count = (k) => {
    const peers = Array.from({ length: k }, (_, i) => "p" + i);
    const s = game(peers);
    const { events } = run(s, DEFENSE.countdown / 1000 + 20, { avatars: peers.map((id, i) => ({ id, x: -27, y: 0, z: -5 + i })) });
    return events.filter((e) => e.t === "mon");
  };
  const one = count(1),
    four = count(4);
  const door = map.defense.door;
  for (const e of one) assert(Math.abs(e.m.x - door.x) < 1 && Math.abs(e.m.z - door.z) < 2, "at the door");
  assert(one.length >= 4 && one.length <= 8, `one player, 20 s of wave 1: ${one.length}`);
  assert(four.length >= one.length * 2, `four players: ${four.length} vs ${one.length}`);
});

test("they walk to the fortress around rocks and ruins and hit its walls; at 0 the team has lost", () => {
  setRoomScale(2);
  const fl = flowField(map),
    door = map.defense.door,
    f = map.defense.fort;
  const cell = (x, z) => Math.floor((z - fl.z0) / fl.cell) * fl.nx + Math.floor((x - fl.x0) / fl.cell);
  assert(Number.isFinite(fl.dist[cell(door.x, door.z)]), "a way from the door");
  // Путь по полю: ни разу не внутри камня или руины.
  const solid = map.statics.filter((b) => b.shape !== "mound" && b.h > 0.35 && !(b.y > 1.2));
  let x = door.x,
    z = door.z,
    steps = 0;
  while (x > f.x1 + 1 && steps++ < 400) {
    const d = flowDirection(map, x, z);
    x += d.x * 0.25;
    z += d.z * 0.25;
    assert(!solid.some((b) => inside(x, z, b)), `not through ${solid.find((b) => inside(x, z, b))?.kind} at ${x.toFixed(1)}, ${z.toFixed(1)}`);
  }
  assert(x <= f.x1 + 1, "reached the walls");
  const s = game();
  run(s, DEFENSE.countdown / 1000 + 0.1);
  quietWave(s);
  const zombie = spawnOf(s, "zombie", door.x, door.z);
  const { events } = run(s, 80);
  assert(zombie.x < f.x1 + 1.2, `at the walls: ${zombie.x}`);
  const hits = events.filter((e) => e.t === "mon.atk" && e.target === "fort");
  assert(hits.length > 0, "hits the fortress");
  assert.equal(hits[0].dmg, MONSTERS.zombie.fort);
  assert.equal(s.defense.fort, DEFENSE.fortHp - hits.length * MONSTERS.zombie.fort);
  // Крепость пала.
  s.defense.fort = 1;
  const end = run(s, 3);
  assert.equal(s.defense.phase, "lost");
  assert.equal(s.defense.monsters.length, 0);
  run(s, DEFENSE.endPause / 1000 + 1, { from: end.now });
  assert.equal(s.defense.phase, "idle", "and then a new game can start");
});

test("an avatar closer than 4 m draws a monster, which hits it for its class; farther away, or up on the wall, it keeps to the fortress", () => {
  const s = game();
  run(s, DEFENSE.countdown / 1000 + 0.1);
  quietWave(s);
  const ogre = spawnOf(s, "ogre", 6, 1);
  // 6 м — не замечает.
  let me = { id: "a", x: 0, y: 0, z: 1 };
  run(s, 0.2, { avatars: [me] });
  assert.equal(ogre.st, 0);
  me = { id: "a", x: ogre.x - 3.5, y: 0, z: ogre.z };
  const before = Math.hypot(ogre.x - me.x, ogre.z - me.z);
  const { events } = run(s, 6, { avatars: [me] });
  assert(Math.hypot(ogre.x - me.x, ogre.z - me.z) < before, "comes at you");
  const hits = events.filter((e) => e.t === "mon.atk" && e.target === "a");
  assert(hits.length >= 2, `${hits.length} hits`);
  assert.equal(hits[0].dmg, MONSTERS.ogre.hit);
  // Выбыл (dn) — не трогают.
  const down = run(s, 3, { avatars: [{ ...me, down: true }] });
  assert.equal(down.events.filter((e) => e.target === "a").length, 0);
  // На стене крепости — не достать.
  const g = spawnOf(s, "goblin", -20.5, -2);
  const wall = run(s, 4, { avatars: [{ id: "a", x: -23, y: 2.6, z: -2 }] });
  assert.equal(wall.events.filter((e) => e.target === "a").length, 0);
  assert.notEqual(g.tgt, "a");
});

test("the pond and the bog slow them down", () => {
  const s = game();
  run(s, DEFENSE.countdown / 1000 + 0.1);
  quietWave(s);
  const pond = map.zones.find((z) => z.id === "pond");
  const speedAt = (x, z) => {
    s.defense.monsters = [];
    const m = spawnOf(s, "goblin", x, z);
    m.a = Math.PI / 2;
    // Гоблин идёт на аватара прямо по курсу (4 м вперёд по x).
    const x0 = m.x;
    run(s, 0.5, { avatars: [{ id: "a", x: x + 3.9, y: 0, z }] });
    return (m.x - x0) / 0.5;
  };
  const dry = speedAt(-14, -10),
    wet = speedAt(pond.x - 3, pond.z);
  assert(wet < dry * 0.65, `${wet.toFixed(2)} in the pond vs ${dry.toFixed(2)} on dry land`);
  assert(terrainHeight(map, 3.5, -12.5) > 1.8, "the hill");
  assert.equal(terrainHeight(map, pond.x, pond.z), 0, "the pond lies low");
});

test("your shots hit monsters for the weapon's damage (no more); kills count; blasts hurt everyone around", () => {
  const s = game();
  run(s, DEFENSE.countdown / 1000 + 0.1);
  quietWave(s);
  const zombie = spawnOf(s, "zombie", 0, 0);
  assert.equal(applyOp(s, { t: "def.hit", id: zombie.id, w: "snow", dmg: 5 }, ctx("a")), null, "a snowball does not hit for 5");
  assert.equal(applyOp(s, { t: "def.hit", id: zombie.id, w: "brick", dmg: 4 }, ctx("a")), null, "bricks come with a reward");
  applyOp(s, { t: "def.hit", id: zombie.id, w: "rock", dmg: 2, dx: 1, dz: 0 }, ctx("a"));
  assert.equal(zombie.hp, MONSTERS.zombie.hp - 2);
  const r = applyOp(s, { t: "def.hit", id: zombie.id, w: "rock", dmg: 2 }, ctx("a")),
    last = applyOp(s, { t: "def.hit", id: zombie.id, w: "rock", dmg: 2 }, ctx("a"));
  assert(r && last.out[0].msg.hp === 0, "dead");
  assert.equal(s.defense.monsters.length, 0);
  assert.deepEqual(s.defense.stats.a, { k: 1, dmg: 6 });
  // Граната: монстры в радиусе получают по расстоянию.
  const near = spawnOf(s, "ogre", 2, 2),
    far = spawnOf(s, "ogre", 12, 2);
  s.defense.perks.a = { w: ["grenade"], power: 0, quick: 0, tough: 0, regen: 0, swift: 0, vamp: 0 };
  applyOp(s, { t: "boom", kind: "grenade", x: 2.5, y: 0.3, z: 2 }, ctx("a"));
  assert(near.hp < MONSTERS.ogre.hp - 5, `near: ${near.hp}`);
  assert.equal(far.hp, MONSTERS.ogre.hp);
});

test("a wave beaten: everyone picks one of three rewards; weapons, perks and help for the fortress; the last wave won is a victory", () => {
  const s = game(["a", "b"]);
  const avatars = [
    { id: "a", x: -27, y: 0, z: -4 },
    { id: "b", x: -27, y: 0, z: 5 },
  ];
  let t = run(s, DEFENSE.countdown / 1000 + 0.1, { avatars }).now;
  // Волна выпущена и перебита.
  Object.assign(s.defense, { spawnUntil: t, monsters: [], fort: 70 });
  t = run(s, 0.1, { avatars, from: t }).now;
  assert.equal(s.defense.phase, "break");
  for (const id of ["a", "b"]) {
    const offers = s.defense.offers[id];
    assert.equal(offers.length, 3);
    assert.equal(new Set(offers).size, 3, "three different cards");
    for (const c of offers) assert(CARDS[c]);
  }
  // a берёт что-нибудь; b не выбирает — получает первую.
  const pickA = s.defense.offers.a[0];
  assert(applyOp(s, { t: "def.pick", card: pickA }, ctx("a")));
  assert.equal(applyOp(s, { t: "def.pick", card: s.defense.offers.a[1] }, ctx("a")), null, "one card only");
  t = run(s, DEFENSE.intermission / 1000 + 0.2, { avatars, from: t }).now;
  assert.equal(s.defense.phase, "wave");
  assert.equal(s.defense.wave, 2);
  assert.equal(s.defense.picked.b, undefined, "picks are cleared for the new wave");
  // Карточки действуют.
  const d = createDefense();
  Object.assign(d, { phase: "break", offers: { a: ["brick", "repair", "turret"] }, fort: 50 });
  assert.equal(weaponAllowed({ ...d, phase: "wave" }, "a", "brick"), false);
  pick(d, map, "a", "brick", 0);
  assert.equal(weaponAllowed({ ...d, phase: "wave" }, "a", "brick"), true, "bricks unlocked");
  Object.assign(d, { picked: {}, offers: { a: ["repair"] } });
  pick(d, map, "a", "repair", 0);
  assert.equal(d.fort, 80);
  Object.assign(d, { picked: {}, offers: { a: ["turret"] } });
  pick(d, map, "a", "turret", 0);
  assert.equal(d.turrets, 1);
  // Последняя волна отбита — победа.
  Object.assign(s.defense, { wave: s.defense.waves, spawnUntil: t, bossDone: true, monsters: [] });
  run(s, 0.1, { avatars, from: t });
  assert.equal(s.defense.phase, "won");
});

test("a turret on the wall shoots the nearest monster in range; a monster stepping on an armed mine sets it off", () => {
  const s = game();
  let t = run(s, DEFENSE.countdown / 1000 + 0.1).now;
  quietWave(s);
  s.defense.turrets = 1;
  const spot = map.defense.turrets[0];
  const g = spawnOf(s, "goblin", spot.x + 8, spot.z);
  spawnOf(s, "goblin", spot.x + 25, spot.z);
  const { events, now } = run(s, 0.2, { from: t });
  const shot = events.find((e) => e.t === "mon.dmg" && e.tu === 0);
  assert(shot && shot.id === g.id, "the nearer goblin");
  s.mines = [{ id: "mine1", x: 5, z: 5, by: "a", armAt: 0, triggerAt: null }];
  spawnOf(s, "zombie", 5.2, 5);
  const m = run(s, 0.1, { from: now });
  assert(s.mines[0].triggerAt != null, "triggered");
  assert(m.events.some((e) => e.t === "mines"));
});

test("the fortress gate opens for someone close to it, for a short while, and closes by itself; monsters still cannot get in", () => {
  const s = createState({ map: "fortress" }, newId),
    gate = map.gates[0];
  assert.equal(applyOp(s, { t: "gate.open", id: gate.id }, { ...ctx("a", 1000), pose: { x: gate.x + 9, y: 0, z: gate.z } }), null, "too far away");
  const r = applyOp(s, { t: "gate.open", id: gate.id }, { ...ctx("a", 1000), pose: { x: gate.x + 2, y: 0, z: gate.z } });
  assert.deepEqual(r.out[0].msg, { t: "gate", id: gate.id, until: 1000 + 2500 });
  assert.equal(applyOp(s, { t: "gate.open", id: gate.id }, { ...ctx("b", 1200), pose: { x: gate.x - 1, y: 0, z: gate.z } }), null, "already open long enough: nothing to send");
  assert(applyOp(s, { t: "gate.open", id: gate.id }, { ...ctx("b", 2600), pose: { x: gate.x - 1, y: 0, z: gate.z } }), "kept open while someone is there");
  assert.equal(s.gates[gate.id], 2600 + 2500);
  // Монстров ворота не пускают: для них проём — тоже крепость.
  const f = map.defense.fort;
  assert(gate.z > f.z0 && gate.z < f.z1 && gate.x <= f.x1);
});
