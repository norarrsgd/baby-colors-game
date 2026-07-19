"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  COLOR_VALUES,
  generateLevel,
  getRectOverlapRatio,
  type DragState,
  type GameMode,
  type MatchPair,
  type RectBounds,
  type ShapeMatchPair,
} from "./game-logic";
import type { MatchResult } from "./audio-assets";
import { useGameAudio } from "./use-game-audio";

type MatchStyle = CSSProperties & {
  "--match-color": string;
  "--drag-x"?: string;
  "--drag-y"?: string;
};

const BOARD_SLOT_COUNT = 10;
const MIN_MATCH_OVERLAP_RATIO = 0.7;
const MATCH_VISUAL_SELECTOR = ".shape-visual, .glyph-visual";

function createBoardSlotMap(
  targetIds: readonly string[],
  pieceIds: readonly string[],
) {
  const slots = Array.from({ length: BOARD_SLOT_COUNT }, (_, index) => index);

  for (let index = slots.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [slots[index], slots[swapIndex]] = [slots[swapIndex], slots[index]];
  }

  const itemKeys = [
    ...targetIds.map((id) => `target:${id}`),
    ...pieceIds.map((id) => `piece:${id}`),
  ];

  return new Map(itemKeys.map((key, index) => [key, slots[index]]));
}

const COLOR_NAMES: Record<MatchPair["color"], string> = {
  coral: "Coral",
  red: "Red",
  orange: "Orange",
  gold: "Gold",
  green: "Green",
  teal: "Teal",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
};

const SHAPE_NAMES: Record<ShapeMatchPair["shape"], string> = {
  circle: "circle",
  square: "square",
  triangle: "triangle",
  star: "star",
  hexagon: "hexagon",
  oval: "oval",
  rectangle: "rectangle",
  diamond: "diamond",
  pentagon: "pentagon",
};

const MODE_COPY: Record<
  GameMode,
  { label: string; singular: string; plural: string }
> = {
  letters: { label: "Letters", singular: "letter", plural: "letters" },
  numbers: { label: "Numbers", singular: "number", plural: "numbers" },
  shapes: { label: "Shapes", singular: "shape", plural: "shapes" },
};

function pairLabel(pair: MatchPair) {
  const color = COLOR_NAMES[pair.color];

  if (pair.mode === "shapes") {
    return `${color} ${SHAPE_NAMES[pair.shape]}`;
  }

  return `${color} ${MODE_COPY[pair.mode].singular} ${pair.glyph}`;
}

function ShapeVisual({ pair, target }: { pair: ShapeMatchPair; target?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`shape-visual shape-${pair.shape} size-${pair.size} ${target ? "shape-target" : "shape-piece"}`}
    >
      {target ? <span className="shape-target-inner" /> : null}
    </span>
  );
}

function MatchVisual({ pair, target }: { pair: MatchPair; target?: boolean }) {
  if (pair.mode === "shapes") {
    return <ShapeVisual pair={pair} target={target} />;
  }

  return (
    <span
      aria-hidden="true"
      className={`glyph-visual size-${pair.size} ${target ? "glyph-target" : "glyph-piece"}`}
    >
      {pair.glyph}
    </span>
  );
}

function ModePreview({ mode }: { mode: GameMode }) {
  if (mode === "shapes") {
    return (
      <span className="mode-preview mode-preview-shapes" aria-hidden="true">
        <span className="preview-shape preview-circle" />
        <span className="preview-shape preview-triangle" />
        <span className="preview-shape preview-star" />
      </span>
    );
  }

  const glyphs = mode === "letters" ? ["A", "B", "C"] : ["0", "1", "2"];
  return (
    <span className="mode-preview mode-preview-glyphs" aria-hidden="true">
      {glyphs.map((glyph) => (
        <span key={glyph}>{glyph}</span>
      ))}
    </span>
  );
}

function ModeSelector({ onSelect }: { onSelect: (mode: GameMode) => void }) {
  const modes: GameMode[] = ["letters", "numbers", "shapes"];

  return (
    <main className="mode-shell">
      <header className="mode-heading">
        <h1>Baby Colors</h1>
        <p>Choose a mode</p>
      </header>

      <div className="mode-grid" role="group" aria-label="Game modes">
        {modes.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`mode-card mode-${mode}`}
            aria-label={`Play ${MODE_COPY[mode].label} mode`}
            onClick={() => onSelect(mode)}
          >
            <ModePreview mode={mode} />
            <strong>{MODE_COPY[mode].label}</strong>
          </button>
        ))}
      </div>
    </main>
  );
}

interface MatchingGameProps {
  mode: GameMode;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onMatchResult: (mode: GameMode, result: MatchResult) => void;
}

function MatchingGame({
  mode,
  soundEnabled,
  onToggleSound,
  onMatchResult,
}: MatchingGameProps) {
  const modeCopy = MODE_COPY[mode];
  const [level, setLevel] = useState(1);
  const [config, setConfig] = useState(() => generateLevel(mode, 1));
  const [placed, setPlaced] = useState<Set<string>>(() => new Set());
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [celebration, setCelebration] = useState<{
    pair: MatchPair;
    sequence: number;
  } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const celebrationSequenceRef = useRef(0);

  const pairsById = useMemo(
    () => new Map(config.pairs.map((pair) => [pair.id, pair])),
    [config],
  );

  const pieces = config.pieceOrder.map((id) => pairsById.get(id)!);
  const targets = config.containerOrder.map((id) => pairsById.get(id)!);
  const boardSlots = useMemo(
    () => createBoardSlotMap(config.containerOrder, config.pieceOrder),
    [config],
  );
  const isComplete = placed.size === config.pairs.length;

  useEffect(() => {
    if (!celebration) {
      return;
    }

    const timer = window.setTimeout(() => setCelebration(null), 720);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  useEffect(() => {
    if (!isComplete) {
      return;
    }

    const timer = window.setTimeout(() => {
      const nextLevel = level + 1;
      setLevel(nextLevel);
      setConfig(generateLevel(mode, nextLevel));
      setPlaced(new Set());
      setSelectedPairId(null);
      setHoveredTargetId(null);
    }, 950);

    return () => window.clearTimeout(timer);
  }, [isComplete, level, mode]);

  function getTargetForBounds(draggedBounds: RectBounds) {
    const elements = document.querySelectorAll<HTMLElement>("[data-target-id]");
    let nearestTargetId: string | null = null;
    let greatestOverlap = 0;

    for (const element of elements) {
      const targetId = element.dataset.targetId;
      if (!targetId || element.matches(":disabled")) {
        continue;
      }

      const targetVisual = element.querySelector<HTMLElement>(MATCH_VISUAL_SELECTOR);
      if (!targetVisual) {
        continue;
      }

      const overlap = getRectOverlapRatio(
        draggedBounds,
        targetVisual.getBoundingClientRect(),
      );
      if (overlap >= MIN_MATCH_OVERLAP_RATIO && overlap > greatestOverlap) {
        greatestOverlap = overlap;
        nearestTargetId = targetId;
      }
    }

    return nearestTargetId;
  }

  function getTargetForDrag(current: DragState) {
    return getTargetForBounds({
      left: current.visualBounds.left + current.x,
      right: current.visualBounds.right + current.x,
      top: current.visualBounds.top + current.y,
      bottom: current.visualBounds.bottom + current.y,
    });
  }

  function attemptMatch(pairId: string, targetId: string) {
    if (isComplete || placed.has(pairId)) {
      return false;
    }

    if (pairId !== targetId) {
      onMatchResult(mode, "mismatch");
      return false;
    }

    setPlaced((current) => {
      const next = new Set(current);
      next.add(pairId);
      return next;
    });
    setSelectedPairId(null);
    const matchedPair = pairsById.get(pairId);
    if (matchedPair) {
      celebrationSequenceRef.current += 1;
      setCelebration({
        pair: matchedPair,
        sequence: celebrationSequenceRef.current,
      });
    }
    onMatchResult(mode, "correct");
    return true;
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>, pairId: string) {
    if (isComplete || placed.has(pairId)) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const draggedVisual =
      event.currentTarget.querySelector<HTMLElement>(MATCH_VISUAL_SELECTOR) ??
      event.currentTarget;
    const visualRect = draggedVisual.getBoundingClientRect();
    const nextDrag: DragState = {
      pairId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: 0,
      y: 0,
      visualBounds: {
        left: visualRect.left,
        right: visualRect.right,
        top: visualRect.top,
        bottom: visualRect.bottom,
      },
    };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
    setSelectedPairId(pairId);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }

    const nextDrag = {
      ...current,
      x: event.clientX - current.startX,
      y: event.clientY - current.startY,
    };
    const targetId = getTargetForDrag(nextDrag);
    dragRef.current = nextDrag;
    setDrag(nextDrag);
    setHoveredTargetId(targetId);
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }

    if (!cancelled) {
      const draggedVisual =
        event.currentTarget.querySelector<HTMLElement>(MATCH_VISUAL_SELECTOR) ??
        event.currentTarget;
      const targetId = getTargetForBounds(draggedVisual.getBoundingClientRect());
      if (targetId) {
        attemptMatch(current.pairId, targetId);
      }
    }

    dragRef.current = null;
    setDrag(null);
    setSelectedPairId(null);
    setHoveredTargetId(null);
  }

  function selectWithKeyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    pairId: string,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    if (!isComplete && !placed.has(pairId)) {
      setSelectedPairId(pairId);
    }
  }

  return (
    <main className="game-shell">
      <h1 className="visually-hidden">
        Baby Colors {modeCopy.label} matching game
      </h1>

      <header
        className="game-header"
        aria-label={`${modeCopy.label} mode, level ${level}`}
      >
        <div className="level-badge">
          <span>Level</span>
          <strong>{level}</strong>
        </div>
        <div
          className="progress-dots"
          aria-label={`${placed.size} of ${config.pairs.length} ${modeCopy.plural} matched`}
        >
          {config.pairs.map((pair) => (
            <span
              key={pair.id}
              className={placed.has(pair.id) ? "progress-dot is-filled" : "progress-dot"}
            />
          ))}
        </div>
        <button
          type="button"
          className="sound-toggle"
          aria-label={soundEnabled ? "Mute sound" : "Turn sound on"}
          aria-pressed={soundEnabled}
          onClick={onToggleSound}
        >
          <span aria-hidden="true">{soundEnabled ? "🔊" : "🔇"}</span>
        </button>
      </header>

      <section className="game-board" aria-label={`${modeCopy.label} matching play area`}>
        <div className="board-canvas">
          {targets.map((pair) => {
            const isPlaced = placed.has(pair.id);
            const isHovered = hoveredTargetId === pair.id;
            const slot = boardSlots.get(`target:${pair.id}`) ?? 0;
            return (
              <button
                key={`target-${pair.id}`}
                type="button"
                className={`board-item slot-${slot} match-button target-button ${isPlaced ? "is-placed" : ""} ${isHovered ? "is-hovered" : ""}`}
                style={{ "--match-color": COLOR_VALUES[pair.color] } as MatchStyle}
                data-target-id={pair.id}
                aria-label={`${pairLabel(pair)} target${isPlaced ? ", matched" : ""}`}
                disabled={isPlaced || isComplete}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") {
                    return;
                  }
                  event.preventDefault();
                  if (selectedPairId) {
                    attemptMatch(selectedPairId, pair.id);
                  }
                }}
                onClick={() => {
                  if (selectedPairId) {
                    attemptMatch(selectedPairId, pair.id);
                  }
                }}
              >
                <MatchVisual pair={pair} target />
              </button>
            );
          })}

          {pieces.map((pair) => {
            const isPlaced = placed.has(pair.id);
            const isDragging = drag?.pairId === pair.id;
            const isSelected = selectedPairId === pair.id && !isDragging;
            const slot = boardSlots.get(`piece:${pair.id}`) ?? 0;
            const style: MatchStyle = {
              "--match-color": COLOR_VALUES[pair.color],
              "--drag-x": isDragging ? `${drag.x}px` : "0px",
              "--drag-y": isDragging ? `${drag.y}px` : "0px",
            };

            return (
              <button
                key={`piece-${pair.id}`}
                type="button"
                className={`board-item slot-${slot} match-button piece-button ${isPlaced ? "is-placed" : ""} ${isDragging ? "is-dragging" : ""} ${isSelected ? "is-selected" : ""}`}
                style={style}
                aria-label={`${pairLabel(pair)}${isSelected ? ", selected" : ""}`}
                aria-pressed={isSelected}
                disabled={isPlaced || isComplete}
                onKeyDown={(event) => selectWithKeyboard(event, pair.id)}
                onPointerDown={(event) => beginDrag(event, pair.id)}
                onPointerMove={moveDrag}
                onPointerUp={(event) => finishDrag(event)}
                onPointerCancel={(event) => finishDrag(event, true)}
                onLostPointerCapture={(event) => finishDrag(event, true)}
              >
                <MatchVisual pair={pair} />
              </button>
            );
          })}
        </div>

        {celebration ? (
          <div
            key={`${celebration.pair.id}-${celebration.sequence}`}
            className="match-celebration"
            aria-hidden="true"
          >
            <span
              className="match-celebration-visual"
              style={{ "--match-color": COLOR_VALUES[celebration.pair.color] } as MatchStyle}
            >
              <MatchVisual pair={celebration.pair} />
            </span>
          </div>
        ) : null}

        <div className="visually-hidden" role="status" aria-live="polite">
          {isComplete ? `Level ${level} complete` : ""}
        </div>
      </section>
    </main>
  );
}

export default function Game() {
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const {
    soundEnabled,
    startMode,
    playMatchResult,
    toggleSound,
  } = useGameAudio();

  return selectedMode ? (
    <MatchingGame
      mode={selectedMode}
      soundEnabled={soundEnabled}
      onToggleSound={toggleSound}
      onMatchResult={playMatchResult}
    />
  ) : (
    <ModeSelector
      onSelect={(mode) => {
        startMode(mode);
        setSelectedMode(mode);
      }}
    />
  );
}
