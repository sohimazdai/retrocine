// Building blocks for the strips along the left and right edges of the floor (x ≈ ±14.7), shared
// by the maps' data: fences, pull-up bars, monkey bars, climbing frames. Plain data, no Three.js;
// the common looks are in maps/sides.look.js.
export const EDGE = 14.62;
// A fence along one side (side = −1 left, +1 right) from z0 to z1.
export const fence = (side, z0, z1, h = 2.0, style = "chain") => ({ kind: "fence", style, x: side * EDGE, z: (z0 + z1) / 2, w: 0.06, d: z1 - z0, h });
// Pull-up bar between two posts; the bar runs along x (you face the camera hanging from it).
export function turnik(id, x, z, y, length = 1.2) {
  return {
    statics: [
      { kind: "turnik", x, z, w: length, d: 0.1, y, h: y + 0.06 },
      ...[-1, 1].map((s) => ({ kind: "bar-post", x: x + (s * length) / 2, z, w: 0.09, d: 0.09, h: y + 0.06 })),
    ],
    climbs: [{ id, kind: "bar", x, z, w: length, d: 0.06, y }],
  };
}
// Monkey bars along z between two landing platforms, with posts at the corners.
export function monkeyBars(id, x, z0, z1, y = 2.6, platform = 0.9) {
  const len = z1 - z0,
    mid = (z0 + z1) / 2;
  return {
    statics: [
      { kind: "monkeybars", x, z: mid, w: 0.8, d: len, y, h: y + 0.05 },
      ...[z0 - 0.4, z1 + 0.4].map((z) => ({ kind: "landing", x, z, w: 1.0, d: 0.8, h: platform })),
      ...[-1, 1].flatMap((s) => [z0, z1].map((z) => ({ kind: "bar-post", x: x + s * 0.42, z, w: 0.08, d: 0.08, h: y + 0.05 }))),
    ],
    climbs: [{ id, kind: "bar", x, z: mid, w: 0.06, d: len, y }],
  };
}
export const merge = (...parts) => ({ statics: parts.flatMap((p) => p.statics || []), climbs: parts.flatMap((p) => p.climbs || []) });
