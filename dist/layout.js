// The back wall is a cylinder around a viewer standing just in front of the floor: every column of
// the wall is equally distant from them, and its edges are vertical, so a tall wall never leans over
// the room. Its bottom edge is the far edge of the floor, from corner to corner.
// A map can be bigger than the standard room (map.scale): the floor, the wall and the camera grow
// together, so the picture keeps its proportions and people and things look smaller on a bigger
// field. ROOM is one shared object; whoever works on a room sets its scale first (setRoomScale) —
// the server does so for every room before touching it.
const BASE = { halfWidth: 14.7, front: 10.3, back: -12, radius: 26, eyeY: 1.6 };
export const ROOM = {
  scale: 1,
  halfWidth: BASE.halfWidth,
  front: BASE.front,
  back: BASE.back,
  radius: BASE.radius,
  eyeY: BASE.eyeY,
  eyeZ: BASE.back + Math.sqrt(BASE.radius ** 2 - BASE.eyeY ** 2),
  wallWidth: BASE.halfWidth * 2,
  // Height and side edges follow the camera (see fitWall in room.js) so the screen reaches the top
  // of the viewport and its sides look vertical; this is only the starting value.
  wallHeight: 10,
};
// Returns true when the size changed (the floor, wall and camera then need refitting).
export function setRoomScale(scale = 1) {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (s === ROOM.scale) return false;
  const k = s / ROOM.scale;
  Object.assign(ROOM, {
    scale: s,
    halfWidth: BASE.halfWidth * s,
    front: BASE.front * s,
    back: BASE.back * s,
    radius: BASE.radius * s,
    eyeY: BASE.eyeY * s,
    eyeZ: (BASE.back + Math.sqrt(BASE.radius ** 2 - BASE.eyeY ** 2)) * s,
    wallWidth: BASE.halfWidth * 2 * s,
    wallHeight: ROOM.wallHeight * k,
  });
  edges = edges?.map(([y, w]) => [y * k, w * k]) || null;
  return true;
}
// Half-width of the wall at each height, in the camera's current view: [[y, halfWidth], …].
let edges = null;
export function setWallShape(height, profile) {
  ROOM.wallHeight = height;
  edges = profile;
}
function halfWidthAt(y) {
  if (!edges || y <= 0) return ROOM.halfWidth;
  for (let i = 1; i < edges.length; i++) {
    const [y1, w1] = edges[i];
    if (y <= y1) {
      const [y0, w0] = edges[i - 1];
      return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0 || 1);
    }
  }
  return edges[edges.length - 1][1];
}
export function wallZ(x) {
  return ROOM.eyeZ - Math.sqrt(ROOM.radius ** 2 - x * x);
}
// Wall coordinates (x across the bottom edge, -wallWidth/2…wallWidth/2; y up) → a point in the room.
// inset moves the point toward the viewer, so tiles and pictures sit just in front of the wall.
export function screenPoint(x, y, inset = 0) {
  const wx = (x * halfWidthAt(y)) / ROOM.halfWidth,
    scale = (ROOM.radius - inset) / ROOM.radius;
  return {
    x: wx * scale,
    y,
    z: ROOM.eyeZ + (wallZ(wx) - ROOM.eyeZ) * scale,
  };
}
export function floorBack(x) {
  return wallZ(Math.max(-ROOM.halfWidth, Math.min(ROOM.halfWidth, x)));
}

export function participantGrid(count, width, height, gap = 10) {
  if (!count) return [];
  const columns = count <= 2 ? count : Math.ceil(Math.sqrt(count)),
    rows = Math.ceil(count / columns);
  const padding = Math.min(16, height * 0.035);
  const size = Math.max(
    1,
    Math.min(
      (width - padding * 2 - gap * (columns - 1)) / columns,
      (height - padding * 2 - gap * (rows - 1)) / rows,
    ),
  );
  const top = (height - (rows * size + gap * (rows - 1))) / 2;
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns),
      rowCount = Math.min(columns, count - row * columns);
    const left = (width - (rowCount * size + gap * (rowCount - 1))) / 2;
    return {
      x: left + (index % columns) * (size + gap),
      y: top + row * (size + gap),
      width: size,
      height: size,
    };
  });
}

export function coverCrop(sourceWidth, sourceHeight, targetAspect = 1) {
  const aspect =
    sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : 1;
  const repeatX = Math.min(1, targetAspect / aspect),
    repeatY = Math.min(1, aspect / targetAspect);
  return {
    repeatX,
    repeatY,
    offsetX: (1 - repeatX) / 2,
    offsetY: (1 - repeatY) / 2,
  };
}

export function wrapText(ctx, text, width) {
  const lines = [];
  for (const paragraph of String(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= width) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      for (const char of word) {
        if (line && ctx.measureText(line + char).width > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function fitNoteText(
  ctx,
  text,
  { width = 540, height = 590, maxSize = 112, minSize = 26 } = {},
) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    ctx.font = `650 ${size}px system-ui`;
    const lines = wrapText(ctx, text, width),
      lineHeight = size * 1.18;
    if (lines.length * lineHeight <= height || size === minSize)
      return { size, lines, lineHeight };
  }
}
