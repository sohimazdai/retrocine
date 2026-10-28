import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, assignTeams, ready, damage, died, stepMatch, spawnFor, teamSpawns, projectileDamage, blastDamage, serializeMatch, loadMatch, removePlayer, COUNTDOWN_MS, ROUND_BREAK_MS, MAX_HP } from "../dist/match.js";
import { mapDef } from "../dist/maps/index.js";

const pb = mapDef("paintball");
const seq = (vals) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

test("teams are split as evenly as possible and are deterministic for a seed", () => {
  const t = assignTeams(["a", "b", "c", "d", "e"], seq([0.1, 0.2, 0.3, 0.4, 0.5]));
  const counts = { blue: 0, red: 0 };
  for (const v of Object.values(t)) counts[v]++;
  assert.equal(Object.keys(t).length, 5);
  assert(Math.abs(counts.blue - counts.red) <= 1, `even-ish: ${JSON.stringify(counts)}`);
  assert.deepEqual(t, assignTeams(["a", "b", "c", "d", "e"], seq([0.1, 0.2, 0.3, 0.4, 0.5])), "same seed, same split");
});

test("everyone readying up starts a 10-second countdown, then a live round with teams and spawns", () => {
  const m = createMatch();
  const peers = ["p1", "p2"];
  assert.equal(ready(m, "p1", 1000, peers).ready, 1, "one ready, no countdown yet");
  assert.equal(m.phase, "idle");
  const r = ready(m, "p2", 1200, peers);
  assert.equal(m.phase, "countdown");
  assert.equal(r.until, 1200 + COUNTDOWN_MS);
  // Nothing happens until the countdown elapses.
  assert.deepEqual(stepMatch(m, 1200 + COUNTDOWN_MS - 1, peers, pb), []);
  const [go] = stepMatch(m, 1200 + COUNTDOWN_MS, peers, pb, seq([0.3, 0.6]));
  assert.equal(m.phase, "live");
  assert.equal(m.round, 1);
  assert.equal(go.phase, "live");
  assert.equal(new Set(Object.values(go.teams)).size, 2, "one on each team");
  assert(go.spawns.p1 && go.spawns.p2, "both get a spawn");
  // Blue spawns on the left (−x), red on the right (+x).
  const blue = Object.keys(m.teams).find((id) => m.teams[id] === "blue");
  assert(go.spawns[blue].x < 0 && go.spawns[Object.keys(m.teams).find((id) => m.teams[id] === "red")].x > 0);
  assert(Object.values(m.alive).every((v) => v === true));
});

test("the round ends when one team is wiped, then the next round respawns everyone", () => {
  const m = createMatch();
  const peers = ["p1", "p2"];
  ready(m, "p1", 0, peers);
  ready(m, "p2", 0, peers);
  stepMatch(m, COUNTDOWN_MS, peers, pb, seq([0.3, 0.6]));
  const blue = Object.keys(m.teams).find((id) => m.teams[id] === "blue"),
    red = Object.keys(m.teams).find((id) => m.teams[id] === "red");
  // Red shoots blue a few times, then finishes them.
  damage(m, blue, red, 5);
  const d = died(m, blue, red);
  assert.equal(d.died, blue);
  assert.equal(m.stats[red].k, 1);
  assert.equal(m.stats[blue].d, 1);
  assert.equal(m.stats[red].p, 5, "points are the damage dealt");
  // With blue gone, the round is over and red wins.
  const [over] = stepMatch(m, 20000, peers, pb);
  assert.equal(m.phase, "roundover");
  assert.equal(over.winner, "red");
  // After the break, round 2 respawns both alive.
  assert.deepEqual(stepMatch(m, 20000 + ROUND_BREAK_MS - 1, peers, pb), []);
  const [next] = stepMatch(m, 20000 + ROUND_BREAK_MS, peers, pb);
  assert.equal(m.phase, "live");
  assert.equal(m.round, 2);
  assert(m.alive[blue] && m.alive[red], "everyone back up");
  assert.equal(m.stats[red].k, 1, "the score carries across rounds");
  assert(next.spawns[blue] && next.spawns[red]);
});

test("a player leaving empties their team and ends the round for the other", () => {
  const m = createMatch();
  const peers = ["p1", "p2"];
  ready(m, "p1", 0, peers);
  ready(m, "p2", 0, peers);
  stepMatch(m, COUNTDOWN_MS, peers, pb, seq([0.3, 0.6]));
  const red = Object.keys(m.teams).find((id) => m.teams[id] === "red");
  removePlayer(m, Object.keys(m.teams).find((id) => m.teams[id] === "blue"));
  const [over] = stepMatch(m, 20000, ["p1", "p2"].filter((id) => m.alive[id] !== undefined && id === red || m.teams[id] === "red"), pb);
  assert.equal(m.phase, "roundover");
});

test("damage tiers: 5 light, 2 heavy or 1 instant make a kill; a blast falls off with distance", () => {
  assert.equal(projectileDamage("snow"), 2);
  assert.equal(projectileDamage("tomato"), 2);
  assert.equal(projectileDamage("rock"), 5);
  assert.equal(projectileDamage("brick"), MAX_HP);
  assert.equal(projectileDamage("grenade"), MAX_HP);
  assert.equal(projectileDamage("fireball"), MAX_HP);
  assert.equal(5 * projectileDamage("snow"), MAX_HP);
  assert.equal(2 * projectileDamage("rock"), MAX_HP);
  // Centre −10, half-way −5, 80% −2, edge 0.
  const R = 4.6;
  assert.equal(blastDamage(0, R), 10);
  assert(Math.abs(blastDamage(R * 0.5, R) - 5) < 1e-6);
  assert(Math.abs(blastDamage(R * 0.8, R) - 2) < 1e-6);
  assert(Math.abs(blastDamage(R, R) - 0) < 1e-6);
  assert.equal(blastDamage(R + 1, R), 0);
  assert(blastDamage(R * 0.25, R) > 5 && blastDamage(R * 0.25, R) < 10);
});

test("a match serializes and reloads", () => {
  const m = createMatch();
  ready(m, "p1", 0, ["p1", "p2"]);
  ready(m, "p2", 0, ["p1", "p2"]);
  stepMatch(m, COUNTDOWN_MS, ["p1", "p2"], pb, seq([0.3, 0.6]));
  damage(m, "p1", "p2", 4);
  const back = loadMatch(serializeMatch(m));
  assert.equal(back.phase, "live");
  assert.deepEqual(back.teams, m.teams);
  assert.equal(back.stats.p2.p, m.stats.p2.p);
});
