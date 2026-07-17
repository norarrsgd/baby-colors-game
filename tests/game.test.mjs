import assert from "node:assert/strict";
import test from "node:test";
import { generateLevel, getDifficulty } from "../app/game-logic.ts";

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

test("generates exactly one unique container for every piece", () => {
  for (let level = 1; level <= 120; level += 1) {
    const config = generateLevel(level);
    const combinations = config.pairs.map((pair) => `${pair.shape}:${pair.color}`);
    const ids = config.pairs.map((pair) => pair.id);

    assert.equal(config.pairs.length, getDifficulty(level).pairCount);
    assert.equal(new Set(combinations).size, combinations.length);
    assert.deepEqual(new Set(config.pieceOrder), new Set(ids));
    assert.deepEqual(new Set(config.containerOrder), new Set(ids));
    assert.equal(config.pieceOrder.length, new Set(config.pieceOrder).size);
    assert.equal(config.containerOrder.length, new Set(config.containerOrder).size);
  }
});

test("keeps a generated level stable and cycles post-level-15 intensity", () => {
  assert.deepEqual(generateLevel(27), generateLevel(27));

  const intensities = [15, 16, 17, 18, 19].map(
    (level) => getDifficulty(level).intensity,
  );
  assert.deepEqual(intensities, ["gentle", "steady", "stretch", "steady", "gentle"]);
});
