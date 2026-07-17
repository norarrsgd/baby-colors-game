import type { GameMode } from "./game-logic";

export type MatchResult = "correct" | "mismatch";

export const BACKGROUND_AUDIO_ASSET = "/audio/background-loop.wav";

export const MATCH_AUDIO_ASSETS: Record<
  GameMode,
  Record<MatchResult, string>
> = {
  letters: {
    correct: "/audio/letters-correct.wav",
    mismatch: "/audio/letters-mismatch.wav",
  },
  numbers: {
    correct: "/audio/numbers-correct.wav",
    mismatch: "/audio/numbers-mismatch.wav",
  },
  shapes: {
    correct: "/audio/shapes-correct.wav",
    mismatch: "/audio/shapes-mismatch.wav",
  },
};
