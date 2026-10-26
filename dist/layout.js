export function roomViewports(width, height) {
  const screenHeight = Math.round(height * 0.4);
  return {
    cinema: { x: 0, y: 0, width, height: screenHeight },
    floor: { x: 0, y: screenHeight, width, height: height - screenHeight },
  };
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
