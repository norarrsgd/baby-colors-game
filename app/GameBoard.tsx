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
  type DragState,
  type GameMode,
  type MatchPair,
  type ShapeMatchPair,
} from "./game-logic";

type MatchStyle = CSSProperties & {
  "--match-color": string;
  "--drag-x"?: string;
  "--drag-y"?: string;
};

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

function MatchingGame({ mode }: { mode: GameMode }) {
  const modeCopy = MODE_COPY[mode];
  const [level, setLevel] = useState(1);
  const [config, setConfig] = useState(() => generateLevel(mode, 1));
  const [placed, setPlaced] = useState<Set<string>>(() => new Set());
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const pairsById = useMemo(
    () => new Map(config.pairs.map((pair) => [pair.id, pair])),
    [config],
  );

  const pieces = config.pieceOrder.map((id) => pairsById.get(id)!);
  const targets = config.containerOrder.map((id) => pairsById.get(id)!);
  const isComplete = placed.size === config.pairs.length;

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
    }, 800);

    return () => window.clearTimeout(timer);
  }, [isComplete, level, mode]);

  function isPointInsideTarget(pairId: string, clientX: number, clientY: number) {
    const element = document.querySelector<HTMLElement>(
      `[data-target-id="${pairId}"]`,
    );

    if (!element) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const generousPadding = 18;
    return (
      clientX >= rect.left - generousPadding &&
      clientX <= rect.right + generousPadding &&
      clientY >= rect.top - generousPadding &&
      clientY <= rect.bottom + generousPadding
    );
  }

  function placePair(pairId: string, targetId: string) {
    if (isComplete || pairId !== targetId || placed.has(pairId)) {
      return false;
    }

    setPlaced((current) => {
      const next = new Set(current);
      next.add(pairId);
      return next;
    });
    setSelectedPairId(null);
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
    const nextDrag: DragState = {
      pairId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: 0,
      y: 0,
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
    dragRef.current = nextDrag;
    setDrag(nextDrag);
    setHoveredTargetId(
      isPointInsideTarget(current.pairId, event.clientX, event.clientY)
        ? current.pairId
        : null,
    );
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }

    if (!cancelled && isPointInsideTarget(current.pairId, event.clientX, event.clientY)) {
      placePair(current.pairId, current.pairId);
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
      </header>

      <section className="game-board" aria-label={`${modeCopy.label} matching play area`}>
        <div className="play-zone target-zone" aria-label="Matching targets">
          <div className="match-grid">
            {targets.map((pair) => {
              const isPlaced = placed.has(pair.id);
              const isHovered = hoveredTargetId === pair.id;
              return (
                <button
                  key={pair.id}
                  type="button"
                  className={`match-button target-button ${isPlaced ? "is-placed" : ""} ${isHovered ? "is-hovered" : ""}`}
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
                      placePair(selectedPairId, pair.id);
                    }
                  }}
                  onClick={() => {
                    if (selectedPairId) {
                      placePair(selectedPairId, pair.id);
                    }
                  }}
                >
                  <MatchVisual pair={pair} target />
                </button>
              );
            })}
          </div>
        </div>

        <div className="board-divider" aria-hidden="true">
          <span />
        </div>

        <div className="play-zone piece-zone" aria-label={`${modeCopy.label} to match`}>
          <div className="match-grid">
            {pieces.map((pair) => {
              const isPlaced = placed.has(pair.id);
              const isDragging = drag?.pairId === pair.id;
              const isSelected = selectedPairId === pair.id && !isDragging;
              const style: MatchStyle = {
                "--match-color": COLOR_VALUES[pair.color],
                "--drag-x": isDragging ? `${drag.x}px` : "0px",
                "--drag-y": isDragging ? `${drag.y}px` : "0px",
              };

              return (
                <button
                  key={pair.id}
                  type="button"
                  className={`match-button piece-button ${isPlaced ? "is-placed" : ""} ${isDragging ? "is-dragging" : ""} ${isSelected ? "is-selected" : ""}`}
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
        </div>

        <div
          className={`level-complete ${isComplete ? "is-visible" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">✓</span>
          <span className="visually-hidden">
            {isComplete ? `Level ${level} complete` : ""}
          </span>
        </div>
      </section>
    </main>
  );
}

export default function Game() {
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);

  return selectedMode ? (
    <MatchingGame mode={selectedMode} />
  ) : (
    <ModeSelector onSelect={setSelectedMode} />
  );
}
