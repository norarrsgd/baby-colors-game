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
  type MatchPair,
} from "./game-logic";

type GamePhase = "playing" | "celebrating";

type ShapeStyle = CSSProperties & {
  "--shape-color": string;
  "--drag-x"?: string;
  "--drag-y"?: string;
};

const DISPLAY_NAMES: Record<MatchPair["color"] | MatchPair["shape"], string> = {
  coral: "Coral",
  gold: "Gold",
  blue: "Blue",
  green: "Green",
  purple: "Purple",
  circle: "circle",
  square: "square",
  triangle: "triangle",
  star: "star",
  hexagon: "hexagon",
};

function pairLabel(pair: MatchPair) {
  return `${DISPLAY_NAMES[pair.color]} ${DISPLAY_NAMES[pair.shape]}`;
}

function ShapeVisual({ pair, container }: { pair: MatchPair; container?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`shape-visual shape-${pair.shape} size-${pair.size} ${container ? "shape-container" : "shape-piece"}`}
    >
      {container ? <span className="shape-container-inner" /> : null}
    </span>
  );
}

export default function Game() {
  const [level, setLevel] = useState(1);
  const [config, setConfig] = useState(() => generateLevel(1));
  const [placed, setPlaced] = useState<Set<string>>(() => new Set());
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [phase, setPhase] = useState<GamePhase>("playing");
  const dragRef = useRef<DragState | null>(null);

  const pairsById = useMemo(
    () => new Map(config.pairs.map((pair) => [pair.id, pair])),
    [config],
  );

  const pieces = config.pieceOrder.map((id) => pairsById.get(id)!);
  const containers = config.containerOrder.map((id) => pairsById.get(id)!);

  useEffect(() => {
    if (phase === "playing" && placed.size === config.pairs.length) {
      setPhase("celebrating");
      return;
    }

    if (phase !== "celebrating") {
      return;
    }

    const timer = window.setTimeout(() => {
      const nextLevel = level + 1;
      setLevel(nextLevel);
      setConfig(generateLevel(nextLevel));
      setPlaced(new Set());
      setSelectedPairId(null);
      setHoveredTargetId(null);
      setPhase("playing");
    }, 800);

    return () => window.clearTimeout(timer);
  }, [config.pairs.length, level, phase, placed.size]);

  function isPointInsideTarget(pairId: string, clientX: number, clientY: number) {
    const element = document.querySelector<HTMLElement>(
      `[data-container-id="${pairId}"]`,
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

  function placePair(pairId: string, containerId: string) {
    if (
      phase !== "playing" ||
      pairId !== containerId ||
      placed.has(pairId)
    ) {
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
    if (phase !== "playing" || placed.has(pairId)) {
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
    if (phase === "playing" && !placed.has(pairId)) {
      setSelectedPairId(pairId);
    }
  }

  return (
    <main className="game-shell">
      <h1 className="visually-hidden">Baby Colors matching game</h1>

      <header className="game-header" aria-label={`Level ${level}`}>
        <div className="level-badge">
          <span>Level</span>
          <strong>{level}</strong>
        </div>
        <div
          className="progress-dots"
          aria-label={`${placed.size} of ${config.pairs.length} shapes matched`}
        >
          {config.pairs.map((pair) => (
            <span
              key={pair.id}
              className={placed.has(pair.id) ? "progress-dot is-filled" : "progress-dot"}
            />
          ))}
        </div>
      </header>

      <section className="game-board" aria-label="Shape matching play area">
        <div className="play-zone target-zone" aria-label="Matching containers">
          <div className="shape-grid">
            {containers.map((pair) => {
              const isPlaced = placed.has(pair.id);
              const isHovered = hoveredTargetId === pair.id;
              return (
                <button
                  key={pair.id}
                  type="button"
                  className={`shape-button target-button ${isPlaced ? "is-placed" : ""} ${isHovered ? "is-hovered" : ""}`}
                  style={{ "--shape-color": COLOR_VALUES[pair.color] } as ShapeStyle}
                  data-container-id={pair.id}
                  aria-label={`${pairLabel(pair)} container${isPlaced ? ", matched" : ""}`}
                  disabled={isPlaced || phase !== "playing"}
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
                  <ShapeVisual pair={pair} container />
                </button>
              );
            })}
          </div>
        </div>

        <div className="board-divider" aria-hidden="true">
          <span />
        </div>

        <div className="play-zone piece-zone" aria-label="Shapes to match">
          <div className="shape-grid">
            {pieces.map((pair) => {
              const isPlaced = placed.has(pair.id);
              const isDragging = drag?.pairId === pair.id;
              const isSelected = selectedPairId === pair.id && !isDragging;
              const style: ShapeStyle = {
                "--shape-color": COLOR_VALUES[pair.color],
                "--drag-x": isDragging ? `${drag.x}px` : "0px",
                "--drag-y": isDragging ? `${drag.y}px` : "0px",
              };

              return (
                <button
                  key={pair.id}
                  type="button"
                  className={`shape-button piece-button ${isPlaced ? "is-placed" : ""} ${isDragging ? "is-dragging" : ""} ${isSelected ? "is-selected" : ""}`}
                  style={style}
                  aria-label={`${pairLabel(pair)}${isSelected ? ", selected" : ""}`}
                  aria-pressed={isSelected}
                  disabled={isPlaced || phase !== "playing"}
                  onKeyDown={(event) => selectWithKeyboard(event, pair.id)}
                  onPointerDown={(event) => beginDrag(event, pair.id)}
                  onPointerMove={moveDrag}
                  onPointerUp={(event) => finishDrag(event)}
                  onPointerCancel={(event) => finishDrag(event, true)}
                  onLostPointerCapture={(event) => finishDrag(event, true)}
                >
                  <ShapeVisual pair={pair} />
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={`level-complete ${phase === "celebrating" ? "is-visible" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">✓</span>
          <span className="visually-hidden">
            {phase === "celebrating" ? `Level ${level} complete` : ""}
          </span>
        </div>
      </section>
    </main>
  );
}
