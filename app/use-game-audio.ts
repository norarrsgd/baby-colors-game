"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BACKGROUND_AUDIO_ASSET,
  MATCH_AUDIO_ASSETS,
  type MatchResult,
} from "./audio-assets";
import type { GameMode } from "./game-logic";

const MUSIC_VOLUME = 0.12;
const EFFECT_VOLUME = 0.4;

function playSafely(audio: HTMLAudioElement) {
  try {
    void audio.play().catch(() => {
      // Playback can be blocked or unavailable. The game remains usable silently.
    });
  } catch {
    // Some browsers can throw synchronously when media playback is unavailable.
  }
}

export function useGameAudio() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const currentModeRef = useRef<GameMode | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const effectsRef = useRef(new Map<string, HTMLAudioElement>());

  const getMusic = useCallback(() => {
    if (typeof Audio === "undefined") {
      return null;
    }

    if (!musicRef.current) {
      const music = new Audio(BACKGROUND_AUDIO_ASSET);
      music.loop = true;
      music.preload = "auto";
      music.volume = MUSIC_VOLUME;
      musicRef.current = music;
    }

    return musicRef.current;
  }, []);

  const getEffect = useCallback((mode: GameMode, result: MatchResult) => {
    if (typeof Audio === "undefined") {
      return null;
    }

    const key = `${mode}:${result}`;
    const cached = effectsRef.current.get(key);
    if (cached) {
      return cached;
    }

    const effect = new Audio(MATCH_AUDIO_ASSETS[mode][result]);
    effect.preload = "auto";
    effect.volume = EFFECT_VOLUME;
    effectsRef.current.set(key, effect);
    return effect;
  }, []);

  const pauseEffects = useCallback(() => {
    for (const effect of effectsRef.current.values()) {
      effect.pause();
      effect.currentTime = 0;
    }
  }, []);

  const startMode = useCallback(
    (mode: GameMode) => {
      currentModeRef.current = mode;
      getEffect(mode, "correct");
      getEffect(mode, "mismatch");

      if (!soundEnabledRef.current) {
        return;
      }

      const music = getMusic();
      if (music) {
        playSafely(music);
      }
    },
    [getEffect, getMusic],
  );

  const playMatchResult = useCallback(
    (mode: GameMode, result: MatchResult) => {
      if (!soundEnabledRef.current) {
        return;
      }

      const effect = getEffect(mode, result);
      if (!effect) {
        return;
      }

      pauseEffects();
      effect.currentTime = 0;
      playSafely(effect);
    },
    [getEffect, pauseEffects],
  );

  const toggleSound = useCallback(() => {
    const nextEnabled = !soundEnabledRef.current;
    soundEnabledRef.current = nextEnabled;
    setSoundEnabled(nextEnabled);

    if (!nextEnabled) {
      musicRef.current?.pause();
      pauseEffects();
      return;
    }

    if (currentModeRef.current) {
      const music = getMusic();
      if (music) {
        playSafely(music);
      }
    }
  }, [getMusic, pauseEffects]);

  useEffect(() => {
    const effects = effectsRef.current;

    function handleVisibilityChange() {
      const music = musicRef.current;
      if (!music) {
        return;
      }

      if (document.hidden) {
        music.pause();
        pauseEffects();
      } else if (soundEnabledRef.current && currentModeRef.current) {
        playSafely(music);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      musicRef.current?.pause();
      for (const effect of effects.values()) {
        effect.pause();
        effect.currentTime = 0;
      }
      musicRef.current = null;
      effects.clear();
    };
  }, [pauseEffects]);

  return {
    soundEnabled,
    startMode,
    playMatchResult,
    toggleSound,
  };
}
