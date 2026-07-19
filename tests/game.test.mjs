import assert from "node:assert/strict";
import test from "node:test";
import {
  COLORS,
  LETTERS,
  NUMBERS,
  SHAPES,
  generateLevel,
  getDifficulty,
  getRectOverlapRatio,
} from "../app/game-logic.ts";

const MODES = ["letters", "numbers", "shapes"];

test("measures how much of a dragged visual overlaps a target", () => {
  const source = { left: 0, right: 100, top: 0, bottom: 100 };

  assert.equal(
    getRectOverlapRatio(source, { left: 100, right: 200, top: 0, bottom: 100 }),
    0,
  );
  assert.equal(
    getRectOverlapRatio(source, { left: 50, right: 150, top: 50, bottom: 150 }),
    0.25,
  );
  assert.equal(
    getRectOverlapRatio(source, { left: 0, right: 100, top: 0, bottom: 100 }),
    1,
  );
  assert.equal(
    getRectOverlapRatio(source, { left: 25, right: 75, top: 25, bottom: 75 }),
    1,
  );
  assert.equal(
    getRectOverlapRatio(
      { left: 0, right: 0, top: 0, bottom: 100 },
      { left: 0, right: 100, top: 0, bottom: 100 },
    ),
    0,
  );
});

test("uses the planned pair-count tiers and never exceeds five pairs", () => {
  const expectations = new Map([
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [9, 3],
    [10, 4],
    [14, 4],
    [15, 5],
    [100, 5],
  ]);

  for (const [level, pairCount] of expectations) {
    assert.equal(getDifficulty(level).pairCount, pairCount);
  }
});

test("defines the expanded familiar-shape and muted rainbow palettes", () => {
  assert.deepEqual(SHAPES, [
    "circle",
    "square",
    "triangle",
    "star",
    "hexagon",
    "oval",
    "rectangle",
    "diamond",
    "pentagon",
  ]);
  assert.deepEqual(COLORS, [
    "coral",
    "red",
    "orange",
    "gold",
    "green",
    "teal",
    "blue",
    "purple",
    "pink",
  ]);
});

test("generates one unique target for every piece in every mode", () => {
  for (const mode of MODES) {
    for (let level = 1; level <= 120; level += 1) {
      const config = generateLevel(mode, level);
      const ids = config.pairs.map((pair) => pair.id);

      assert.equal(config.mode, mode);
      assert.equal(config.pairs.length, getDifficulty(level).pairCount);
      assert.deepEqual(new Set(config.pieceOrder), new Set(ids));
      assert.deepEqual(new Set(config.containerOrder), new Set(ids));
      assert.equal(config.pieceOrder.length, new Set(config.pieceOrder).size);
      assert.equal(config.containerOrder.length, new Set(config.containerOrder).size);

      if (mode === "shapes") {
        const combinations = config.pairs.map(
          (pair) => `${pair.shape}:${pair.color}`,
        );
        assert.equal(new Set(combinations).size, combinations.length);
        assert.ok(config.pairs.every((pair) => SHAPES.includes(pair.shape)));
      } else {
        const glyphs = config.pairs.map((pair) => pair.glyph);
        const allowedGlyphs = mode === "letters" ? LETTERS : NUMBERS;
        assert.equal(new Set(glyphs).size, glyphs.length);
        assert.ok(glyphs.every((glyph) => allowedGlyphs.includes(glyph)));
      }
    }
  }
});

test("keeps every mode deterministic and cycles post-level-15 intensity", () => {
  for (const mode of MODES) {
    assert.deepEqual(generateLevel(mode, 27), generateLevel(mode, 27));
  }

  const intensities = [15, 16, 17, 18, 19].map(
    (level) => getDifficulty(level).intensity,
  );
  assert.deepEqual(intensities, ["gentle", "steady", "stretch", "steady", "gentle"]);
});

test("repeats color rather than content in stretch glyph levels", () => {
  for (const mode of ["letters", "numbers"]) {
    const config = generateLevel(mode, 10);
    const glyphs = config.pairs.map((pair) => pair.glyph);
    const colors = config.pairs.map((pair) => pair.color);

    assert.equal(new Set(glyphs).size, glyphs.length);
    assert.ok(new Set(colors).size < colors.length);
  }
});

test("keeps representative Shapes levels stable with the expanded pools", () => {
  const fixtures = new Map([
    [
      1,
      {
        pairs: ["oval:pink:large"],
        pieces: ["pair-1-0"],
        targets: ["pair-1-0"],
      },
    ],
    [
      10,
      {
        pairs: [
          "circle:blue:small",
          "diamond:orange:large",
          "hexagon:green:medium",
          "pentagon:blue:small",
        ],
        pieces: ["pair-10-2", "pair-10-1", "pair-10-0", "pair-10-3"],
        targets: ["pair-10-3", "pair-10-1", "pair-10-0", "pair-10-2"],
      },
    ],
    [
      27,
      {
        pairs: [
          "square:red:large",
          "pentagon:pink:large",
          "circle:teal:medium",
          "diamond:green:medium",
          "triangle:orange:medium",
        ],
        pieces: ["pair-27-2", "pair-27-4", "pair-27-3", "pair-27-0", "pair-27-1"],
        targets: ["pair-27-3", "pair-27-2", "pair-27-1", "pair-27-4", "pair-27-0"],
      },
    ],
  ]);

  for (const [level, fixture] of fixtures) {
    const config = generateLevel("shapes", level);
    assert.deepEqual(
      config.pairs.map((pair) => `${pair.shape}:${pair.color}:${pair.size}`),
      fixture.pairs,
    );
    assert.deepEqual(config.pieceOrder, fixture.pieces);
    assert.deepEqual(config.containerOrder, fixture.targets);
  }
});
