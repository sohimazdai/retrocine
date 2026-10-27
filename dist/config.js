// Where the sync server lives and which room this page belongs to.
//   https://sohimazdai.ru/cine/?r=team-retro      — room "team-retro"
//   …/cine/?api=ws://localhost:8090               — local sync server
//   …/cine/?api=off                               — offline, everything stays in this browser
export const DEFAULT_API = "wss://api.sohimazdai.ru";
const ROOM = /^[a-z0-9][a-z0-9-]{2,31}$/;
const params = (loc) => new URLSearchParams(loc?.search || "");

export function apiUrl(loc = globalThis.location) {
  return params(loc).get("api") || DEFAULT_API;
}
export function newRoomId() {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}
// Reads ?r= from the address bar; creates a new room id and writes it there when there is none.
export function currentRoom(loc = globalThis.location, hist = globalThis.history) {
  const raw = (params(loc).get("r") || "").toLowerCase();
  if (ROOM.test(raw)) return raw;
  const id = newRoomId();
  try {
    const url = new URL(loc.href);
    url.searchParams.set("r", id);
    hist.replaceState(null, "", url.toString());
  } catch {}
  return id;
}
export function roomLink(id, loc = globalThis.location) {
  try {
    const url = new URL(loc.href);
    const api = params(loc).get("api");
    url.search = "";
    url.hash = "";
    url.searchParams.set("r", id);
    if (api && api !== "off") url.searchParams.set("api", api);
    return url.toString();
  } catch {
    return `https://sohimazdai.ru/cine/?r=${id}`;
  }
}
