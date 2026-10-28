// Team deathmatch for the paintball field. Pure, shared logic (no Three.js / DOM): the server drives
// it and the browser runs the same code offline. The server owns the match — teams, the countdown,
// rounds and the score — while each player's browser is the authority on its own health: it decides
// when it was hit and reports the damage and who dealt it, so hit detection stays lag-free.
//
// Flow: everyone presses R to ready up → a 10 s countdown → the server splits players evenly into
// red and blue and places them on opposite sides → a round runs until only one team has anyone left
// standing → a short break → the next round respawns everyone. TAB shows the score (kills, then
// points = damage dealt, then deaths). Friendly fire counts.

export const TEAMS = ["blue", "red"];
export const TEAM_COLOR = { blue: "#2f6fd8", red: "#d8432f" };
export const MAX_HP = 10;
export const COUNTDOWN_MS = 10000,
  ROUND_BREAK_MS = 5000;

export function createMatch() {
  return { phase: "idle", round: 0, until: null, ready: {}, teams: {}, alive: {}, stats: {}, winner: null, epoch: 0 };
}
export function matchEnabled(map) {
  return !!map?.teamplay;
}
const blankStat = () => ({ k: 0, d: 0, p: 0 });

// Splits the given peers as evenly as possible into the two teams, shuffled by a seeded RNG so it is
// deterministic for a given seed (the server passes a random one).
export function assignTeams(peerIds, rand = Math.random) {
  const ids = [...peerIds];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const teams = {};
  ids.forEach((id, i) => (teams[id] = TEAMS[i % 2]));
  return teams;
}

// Everyone on the left (blue) or right (red), spread along their base area; `a` faces the field.
export function spawnFor(team, index, count, map) {
  const areas = map?.spawn || [
    { x0: -12.8, x1: -11.2, z0: -1.5, z1: 5 },
    { x0: 11.2, x1: 12.8, z0: -1.5, z1: 5 },
  ];
  const area = team === "blue" ? areas[0] : areas[areas.length - 1];
  const t = count > 1 ? index / (count - 1) : 0.5;
  return {
    x: Math.round(((area.x0 + area.x1) / 2) * 100) / 100,
    z: Math.round((area.z0 + (area.z1 - area.z0) * t) * 100) / 100,
    a: team === "blue" ? Math.PI / 2 : -Math.PI / 2,
  };
}
function liveTeams(m) {
  const teams = new Set();
  for (const id of Object.keys(m.teams)) if (m.alive[id]) teams.add(m.teams[id]);
  return teams;
}
function roster(m, peerIds) {
  // Only count players still in the room.
  return peerIds.filter((id) => m.teams[id] != null);
}
export function teamSpawns(m, peerIds, map) {
  const byTeam = { blue: [], red: [] };
  for (const id of roster(m, peerIds)) byTeam[m.teams[id]]?.push(id);
  const spawns = {};
  for (const team of TEAMS) byTeam[team].forEach((id, i) => (spawns[id] = spawnFor(team, i, byTeam[team].length, map)));
  return spawns;
}

// ——— Operations (validated the same way on server and offline) ———
// Each returns null (no change) or a small patch the caller broadcasts; the caller advances time with
// stepMatch separately. `now` is server time in ms.

export function ready(m, peerId, now, peerIds) {
  if (m.phase !== "idle") return null;
  m.ready[peerId] = true;
  // Start the countdown once everyone present has readied up.
  const present = peerIds.filter((id) => id);
  if (present.length && present.every((id) => m.ready[id])) {
    m.phase = "countdown";
    m.until = now + COUNTDOWN_MS;
    return { phase: m.phase, until: m.until };
  }
  return { ready: Object.keys(m.ready).length };
}
export function unready(m, peerId) {
  if (m.phase === "idle") delete m.ready[peerId];
}
// A victim reports damage it took and who caused it; on death, who got the kill.
export function damage(m, victim, by, amount) {
  if (m.phase !== "live" || !m.teams[victim] || !m.alive[victim]) return null;
  if (by && m.stats[by]) m.stats[by].p += Math.max(0, Math.round(amount));
  return { stats: compactStats(m) };
}
export function died(m, victim, by) {
  if (m.phase !== "live" || !m.alive[victim]) return null;
  m.alive[victim] = false;
  m.stats[victim] = m.stats[victim] || blankStat();
  m.stats[victim].d++;
  if (by && by !== victim && m.stats[by]) m.stats[by].k++;
  return { alive: { ...m.alive }, stats: compactStats(m), died: victim, by: by || null };
}
export function compactStats(m) {
  return Object.fromEntries(Object.entries(m.stats).map(([id, s]) => [id, [s.k, s.d, s.p]]));
}

// Time-driven transitions. Returns an array of patches to broadcast (possibly empty). `rand` seeds
// team assignment; `map` positions spawns.
export function stepMatch(m, now, peerIds, map, rand = Math.random) {
  const out = [];
  if (m.phase === "countdown" && now >= m.until) {
    m.teams = assignTeams(peerIds.filter((id) => id), rand);
    m.stats = Object.fromEntries(Object.keys(m.teams).map((id) => [id, blankStat()]));
    m.alive = Object.fromEntries(Object.keys(m.teams).map((id) => [id, true]));
    m.round = 1;
    m.winner = null;
    m.phase = "live";
    m.epoch++;
    out.push(start(m, peerIds, map));
  } else if (m.phase === "live") {
    const live = liveTeams(m),
      haveTeams = new Set(Object.values(m.teams));
    // The round is over when at most one team still has anyone standing.
    if (live.size <= 1 && (haveTeams.size > 1 || live.size === 0)) {
      m.phase = "roundover";
      m.until = now + ROUND_BREAK_MS;
      m.winner = live.size === 1 ? [...live][0] : null;
      out.push({ phase: m.phase, until: m.until, winner: m.winner });
    }
  } else if (m.phase === "roundover" && now >= m.until) {
    // Anyone who has left is dropped; if fewer than two players remain, fall back to idle.
    for (const id of Object.keys(m.teams)) if (!peerIds.includes(id)) delete m.teams[id];
    if (Object.keys(m.teams).length === 0) {
      resetToIdle(m);
      out.push({ phase: "idle", teams: {}, stats: {}, alive: {} });
    } else {
      m.round++;
      m.alive = Object.fromEntries(Object.keys(m.teams).map((id) => [id, true]));
      m.phase = "live";
      m.epoch++;
      out.push(start(m, peerIds, map));
    }
  }
  return out;
}
function start(m, peerIds, map) {
  return { phase: "live", round: m.round, teams: { ...m.teams }, alive: { ...m.alive }, stats: compactStats(m), epoch: m.epoch, spawns: teamSpawns(m, peerIds, map) };
}
function resetToIdle(m) {
  Object.assign(m, { phase: "idle", round: 0, until: null, ready: {}, teams: {}, alive: {}, stats: {}, winner: null });
}
// When a player leaves mid-match.
export function removePlayer(m, peerId) {
  delete m.ready[peerId];
  delete m.alive[peerId];
}

// Serialization for newcomers and disk.
export function serializeMatch(m) {
  return { phase: m.phase, round: m.round, until: m.until, teams: m.teams, alive: m.alive, stats: compactStats(m), winner: m.winner, epoch: m.epoch };
}
export function loadMatch(data) {
  const m = createMatch();
  if (!data || typeof data !== "object") return m;
  m.phase = ["idle", "countdown", "live", "roundover"].includes(data.phase) ? data.phase : "idle";
  m.round = Number.isFinite(data.round) ? data.round : 0;
  m.until = Number.isFinite(data.until) ? data.until : null;
  m.winner = TEAMS.includes(data.winner) ? data.winner : null;
  m.epoch = Number.isFinite(data.epoch) ? data.epoch : 0;
  if (data.teams && typeof data.teams === "object") for (const [k, v] of Object.entries(data.teams)) if (TEAMS.includes(v)) m.teams[k] = v;
  if (data.alive && typeof data.alive === "object") for (const [k, v] of Object.entries(data.alive)) m.alive[k] = !!v;
  if (data.stats && typeof data.stats === "object")
    for (const [k, v] of Object.entries(data.stats)) if (Array.isArray(v) && v.length === 3) m.stats[k] = { k: v[0] | 0, d: v[1] | 0, p: v[2] | 0 };
  return m;
}
// Damage tiers by weapon (light = 2, so 5 hits; heavy = 5, so 2; instant = 10). Melee is half (5).
export const DMG = { light: 2, heavy: 5, instant: MAX_HP, melee: 5 };
export function projectileDamage(kindId) {
  if (["brick", "grenade", "fireball", "mine", "icicle"].includes(kindId)) return DMG.instant;
  if (kindId === "rock") return DMG.heavy;
  return DMG.light; // snow, tomato, tennis
}
// A blast falls off with distance: centre −10, half-way −5, 80% −2, edge 0.
export function blastDamage(dist, radius) {
  if (dist >= radius) return 0;
  const t = dist / radius;
  if (t <= 0.0) return 10;
  if (t <= 0.5) return 10 - (t / 0.5) * 5; // 10 → 5
  if (t <= 0.8) return 5 - ((t - 0.5) / 0.3) * 3; // 5 → 2
  return 2 - ((t - 0.8) / 0.2) * 2; // 2 → 0
}
