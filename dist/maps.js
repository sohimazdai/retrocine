// Map catalogue shown in settings. Map geometry and rules live in world.js (shared with the server);
// this file only describes how each map is presented.
export const MAPS = [
  {
    id: "cinema",
    title: "Кинозал",
    description: "Пирамида, катушки, большой куб, мяч и ворота",
    color: "#8f7fb0",
  },
];
export const DEFAULT_MAP = "cinema";
export const mapInfo = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
