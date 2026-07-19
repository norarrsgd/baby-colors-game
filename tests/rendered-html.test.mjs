import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the launch-only mode selector", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Baby Colors<\/title>/i);
  assert.match(html, />Baby Colors</);
  assert.match(html, />Choose a mode</);

  const lettersIndex = html.indexOf("Play Letters mode");
  const numbersIndex = html.indexOf("Play Numbers mode");
  const shapesIndex = html.indexOf("Play Shapes mode");
  assert.ok(lettersIndex >= 0);
  assert.ok(numbersIndex > lettersIndex);
  assert.ok(shapesIndex > numbersIndex);
  assert.doesNotMatch(html, /matching play area|Matching targets|Level 1/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps every game mode session-only, audio-enabled, and accessible", async () => {
  const gameSource = await readFile(new URL("../app/GameBoard.tsx", import.meta.url), "utf8");
  const stylesSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const audioSource = await readFile(
    new URL("../app/use-game-audio.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(gameSource, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(audioSource, /localStorage|sessionStorage|document\.cookie|speechSynthesis/);
  assert.match(audioSource, /new Audio/);
  assert.match(audioSource, /document\.hidden/);
  assert.match(gameSource, /aria-label=\{soundEnabled \? "Mute sound" : "Turn sound on"\}/);
  assert.match(gameSource, /aria-pressed=\{soundEnabled\}/);
  assert.match(gameSource, /attemptMatch/);
  assert.match(gameSource, /getTargetForDrag/);
  assert.match(gameSource, /onPointerDown/);
  assert.match(gameSource, /onPointerCancel/);
  assert.match(gameSource, /onKeyDown/);
  assert.match(gameSource, /const modes: GameMode\[\] = \["letters", "numbers", "shapes"\]/);
  assert.match(gameSource, /aria-label=\{`Play \$\{MODE_COPY\[mode\]\.label\} mode`\}/);
  assert.match(gameSource, /glyph-visual/);
  assert.match(gameSource, /data-target-id/);
  assert.match(gameSource, /BOARD_SLOT_COUNT = 10/);
  assert.match(gameSource, /className="board-canvas"/);
  assert.doesNotMatch(gameSource, /board-divider|target-zone|piece-zone/);
  const moveDragSource = gameSource.slice(
    gameSource.indexOf("function moveDrag"),
    gameSource.indexOf("function finishDrag"),
  );
  assert.match(moveDragSource, /getTargetForDrag\(nextDrag\)/);
  assert.doesNotMatch(moveDragSource, /attemptMatch/);
  const finishDragSource = gameSource.slice(
    gameSource.indexOf("function finishDrag"),
    gameSource.indexOf("function selectWithKeyboard"),
  );
  assert.match(finishDragSource, /getTargetForBounds\(draggedVisual\.getBoundingClientRect\(\)\)/);
  assert.match(finishDragSource, /attemptMatch\(current\.pairId, targetId\)/);
  assert.match(gameSource, /MIN_MATCH_OVERLAP_RATIO = 0\.7/);
  assert.doesNotMatch(gameSource, /generousPadding|getTargetAtPoint/);
  assert.match(gameSource, /className="match-celebration"/);
  assert.match(stylesSource, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(stylesSource, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(stylesSource, /--shape-size: clamp\(108px, 27vw, 171px\)/);
  assert.match(stylesSource, /@keyframes answer-zoom/);
});
