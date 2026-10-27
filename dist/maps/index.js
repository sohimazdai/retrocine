// All maps. A map is plain data shared by the browser and the server: props (movable, with
// colliders and weights), static colliders, balls, zones. How it looks is decided in the browser.
import cinema from "./cinema.js";

export const MAPS = [cinema];
export const DEFAULT_MAP = "cinema";
export const mapDef = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
export const mapInfo = mapDef;
