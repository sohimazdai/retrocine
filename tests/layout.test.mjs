import test from "node:test";
import assert from "node:assert/strict";
import {
  roomViewports,
  participantGrid,
  coverCrop,
  fitNoteText,
} from "../dist/layout.js";

test("floor occupies bottom three fifths without gaps at different viewport sizes", () => {
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [390, 844],
  ]) {
    const v = roomViewports(width, height);
    assert.equal(v.cinema.height, Math.round(height * 0.4));
    assert.equal(v.floor.y, v.cinema.height);
    assert.equal(v.floor.height + v.cinema.height, height);
    assert.equal(v.floor.width, width);
  }
});
test("two participants use two equal squares; six form exactly three by two", () => {
  const two = participantGrid(2, 1440, 400);
  assert.equal(two[0].y, two[1].y);
  assert.equal(two[0].width, two[1].height);
  const six = participantGrid(6, 1440, 400);
  assert.equal(new Set(six.map((r) => r.y)).size, 2);
  assert.equal(new Set(six.map((r) => r.x)).size, 3);
  assert(six.every((r) => r.width === r.height && r.width === six[0].width));
});
test("participant squares stay inside the screen for one through twelve participants", () => {
  for (const [w, h] of [
    [1440, 400],
    [390, 338],
  ])
    for (let n = 1; n <= 12; n++) {
      const grid = participantGrid(n, w, h);
      assert.equal(grid.length, n);
      assert(
        grid.every(
          (r) =>
            r.x >= 0 &&
            r.y >= 0 &&
            r.x + r.width <= w + 0.001 &&
            r.y + r.height <= h + 0.001,
        ),
      );
    }
});
test("camera cover crops the long axis around center without stretching", () => {
  const wide = coverCrop(1920, 1080);
  assert.equal(wide.repeatX, 1080 / 1920);
  assert.equal(wide.repeatY, 1);
  assert.equal(wide.offsetX, (1 - wide.repeatX) / 2);
  const tall = coverCrop(1080, 1920);
  assert.equal(tall.repeatX, 1);
  assert.equal(tall.repeatY, 1080 / 1920);
});
test("short notes retain large text; overflowing text shrinks only until it fits", () => {
  const ctx = {
    font: "",
    measureText(text) {
      return {
        width: text.length * Number(this.font.match(/(\d+)px/)[1]) * 0.55,
      };
    },
  };
  const one = fitNoteText(ctx, "Привет!"),
    another = fitNoteText(ctx, "Спасибо!");
  assert.equal(one.size, 112);
  assert.equal(another.size, 112);
  const long = fitNoteText(
    ctx,
    "Мы обсуждаем результаты спринта и записываем конкретные решения. ".repeat(
      4,
    ),
  );
  assert(long.size < 112);
  assert(long.lines.length * long.lineHeight <= 590);
  assert(long.lines.join(" ").includes("решения."));
});
