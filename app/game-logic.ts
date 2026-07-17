export type GameMode = "letters" | "numbers" | "shapes";

export type ShapeKind =
  | "circle"
  | "square"
  | "triangle"
  | "star"
  | "hexagon"
  | "oval"
  | "rectangle"
  | "diamond"
  | "pentagon";

export type ColorId =
  | "coral"
  | "red"
  | "orange"
  | "gold"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink";

export type SizeBand = "small" | "medium" | "large";

export const LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
] as const;

export const NUMBERS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export type LetterGlyph = (typeof LETTERS)[number];
export type NumberGlyph = (typeof NUMBERS)[number];

interface MatchPairBase {
  id: string;
  color: ColorId;
  size: SizeBand;
}

export interface ShapeMatchPair extends MatchPairBase {
  mode: "shapes";
  shape: ShapeKind;
}

export interface LetterMatchPair extends MatchPairBase {
  mode: "letters";
  glyph: LetterGlyph;
}

export interface NumberMatchPair extends MatchPairBase {
  mode: "numbers";
  glyph: NumberGlyph;
}

export type MatchPair = ShapeMatchPair | LetterMatchPair | NumberMatchPair;

export interface LevelConfig {
  mode: GameMode;
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
  "oval",
  "rectangle",
  "diamond",
  "pentagon",
];

export const COLORS: readonly ColorId[] = [
  "coral",
  "red",
  "orange",
  "gold",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
];

export const COLOR_VALUES: Record<ColorId, string> = {
  coral: "#e97868",
  red: "#d96b67",
  orange: "#e59a55",
  gold: "#e4af3d",
  green: "#6ead83",
  teal: "#67a9a5",
  blue: "#5e9fca",
  purple: "#967fc2",
  pink: "#d88fac",
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

function generateShapeLevel(safeLevel: number, difficulty: Difficulty): LevelConfig {
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

  const pairs = shapes.map((shape, index): ShapeMatchPair => ({
    id: `pair-${safeLevel}-${index}`,
    mode: "shapes",
    shape,
    color: colors[index],
    size: difficulty.sizes[Math.floor(random() * difficulty.sizes.length)],
  }));

  return finishLevel("shapes", safeLevel, pairs, random);
}

function generateGlyphLevel(
  mode: "letters" | "numbers",
  safeLevel: number,
  difficulty: Difficulty,
): LevelConfig {
  const modeSalt = mode === "letters" ? 0x9e3779b9 : 0x85ebca6b;
  const random = createRandom(safeLevel * 2654435761 + modeSalt);
  const glyphs = shuffled(mode === "letters" ? LETTERS : NUMBERS, random).slice(
    0,
    difficulty.pairCount,
  );
  const colors = shuffled(COLORS, random).slice(0, difficulty.pairCount);

  if (difficulty.repeatedAxis && difficulty.pairCount > 1) {
    colors[difficulty.pairCount - 1] = colors[0];
  }

  const pairs: LetterMatchPair[] | NumberMatchPair[] = mode === "letters"
    ? (glyphs as LetterGlyph[]).map((glyph, index): LetterMatchPair => ({
        id: `${mode}-pair-${safeLevel}-${index}`,
        mode,
        glyph,
        color: colors[index],
        size: difficulty.sizes[Math.floor(random() * difficulty.sizes.length)],
      }))
    : (glyphs as NumberGlyph[]).map((glyph, index): NumberMatchPair => ({
        id: `${mode}-pair-${safeLevel}-${index}`,
        mode,
        glyph,
        color: colors[index],
        size: difficulty.sizes[Math.floor(random() * difficulty.sizes.length)],
      }));

  return finishLevel(mode, safeLevel, pairs, random);
}

function finishLevel(
  mode: GameMode,
  level: number,
  pairs: MatchPair[],
  random: () => number,
): LevelConfig {
  const pairIds = pairs.map((pair) => pair.id);

  return {
    mode,
    level,
    pairs,
    pieceOrder: shuffled(pairIds, random),
    containerOrder: shuffled(pairIds, random),
  };
}

export function generateLevel(mode: GameMode, level: number): LevelConfig {
  const safeLevel = Math.max(1, Math.floor(level));
  const difficulty = getDifficulty(safeLevel);

  return mode === "shapes"
    ? generateShapeLevel(safeLevel, difficulty)
    : generateGlyphLevel(mode, safeLevel, difficulty);
}
