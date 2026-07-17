export type ShapeKind = "circle" | "square" | "triangle" | "star" | "hexagon";

export type ColorId = "coral" | "gold" | "blue" | "green" | "purple";

export type SizeBand = "small" | "medium" | "large";

export interface MatchPair {
  id: string;
  shape: ShapeKind;
  color: ColorId;
  size: SizeBand;
}

export interface LevelConfig {
  level: number;
  pairs: MatchPair[];
  pieceOrder: string[];
  containerOrder: string[];
}

export interface DragState {
  pairId: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

export interface Difficulty {
  pairCount: number;
  sizes: SizeBand[];
  repeatedAxis: "shape" | "color" | null;
  intensity: "gentle" | "steady" | "stretch";
}

export const SHAPES: readonly ShapeKind[] = [
  "circle",
  "square",
  "triangle",
  "star",
  "hexagon",
];

export const COLORS: readonly ColorId[] = [
  "coral",
  "gold",
  "blue",
  "green",
  "purple",
];

export const COLOR_VALUES: Record<ColorId, string> = {
  coral: "#e97868",
  gold: "#e4af3d",
  blue: "#5e9fca",
  green: "#6ead83",
  purple: "#967fc2",
};

export function getDifficulty(level: number): Difficulty {
  const safeLevel = Math.max(1, Math.floor(level));

  if (safeLevel <= 2) {
    return {
      pairCount: 1,
      sizes: ["large"],
      repeatedAxis: null,
      intensity: "gentle",
    };
  }

  if (safeLevel <= 5) {
    return {
      pairCount: 2,
      sizes: ["large"],
      repeatedAxis: null,
      intensity: "gentle",
    };
  }

  if (safeLevel <= 9) {
    return {
      pairCount: 3,
      sizes: ["medium", "large"],
      repeatedAxis: null,
      intensity: "steady",
    };
  }

  if (safeLevel <= 14) {
    return {
      pairCount: 4,
      sizes: ["small", "medium", "large"],
      repeatedAxis: safeLevel % 2 === 0 ? "color" : "shape",
      intensity: "stretch",
    };
  }

  const cycle = (safeLevel - 15) % 4;

  if (cycle === 0) {
    return {
      pairCount: 5,
      sizes: ["medium", "large"],
      repeatedAxis: null,
      intensity: "gentle",
    };
  }

  if (cycle === 2) {
    return {
      pairCount: 5,
      sizes: ["small", "medium", "large"],
      repeatedAxis: safeLevel % 2 === 0 ? "shape" : "color",
      intensity: "stretch",
    };
  }

  return {
    pairCount: 5,
    sizes: ["medium", "large"],
    repeatedAxis: safeLevel % 2 === 0 ? "color" : "shape",
    intensity: "steady",
  };
}

function createRandom(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

export function generateLevel(level: number): LevelConfig {
  const safeLevel = Math.max(1, Math.floor(level));
  const difficulty = getDifficulty(safeLevel);
  const random = createRandom(safeLevel * 2654435761);
  const shapes = shuffled(SHAPES, random).slice(0, difficulty.pairCount);
  const colors = shuffled(COLORS, random).slice(0, difficulty.pairCount);

  if (difficulty.repeatedAxis && difficulty.pairCount > 1) {
    const lastIndex = difficulty.pairCount - 1;
    if (difficulty.repeatedAxis === "shape") {
      shapes[lastIndex] = shapes[0];
    } else {
      colors[lastIndex] = colors[0];
    }
  }

  const pairs = shapes.map((shape, index): MatchPair => ({
    id: `pair-${safeLevel}-${index}`,
    shape,
    color: colors[index],
    size: difficulty.sizes[Math.floor(random() * difficulty.sizes.length)],
  }));

  const pairIds = pairs.map((pair) => pair.id);

  return {
    level: safeLevel,
    pairs,
    pieceOrder: shuffled(pairIds, random),
    containerOrder: shuffled(pairIds, random),
  };
}
