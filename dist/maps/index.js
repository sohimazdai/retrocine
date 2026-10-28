// All maps. A map is plain data shared by the browser and the server: props (movable, with
// colliders and weights), static colliders, balls, zones. How it looks is decided in the browser.
import cinema from "./cinema.js";
import maze from "./maze.js";
import playground from "./playground.js";
import river from "./river.js";
import paintball from "./paintball.js";
import saloon from "./saloon.js";
import skatepark from "./skatepark.js";
import ropepark from "./ropepark.js";
import rink from "./rink.js";
import race from "./race.js";

export const MAPS = [cinema, maze, playground, river, paintball, saloon, skatepark, ropepark, rink, race];
export const DEFAULT_MAP = "cinema";
export const mapDef = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
export const mapInfo = mapDef;
