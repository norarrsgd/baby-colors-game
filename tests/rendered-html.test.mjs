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

test("server-renders the Baby Colors game", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Baby Colors<\/title>/i);
  assert.match(html, /Baby Colors matching game/);
  assert.match(html, /Level/);
  assert.match(html, /Matching containers/);
  assert.match(html, /Shapes to match/);
  assert.match(html, /1 of 1|0 of 1/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps the game session-only and silent", async () => {
  const gameSource = await readFile(new URL("../app/GameBoard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(gameSource, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(gameSource, /new Audio|<audio|speechSynthesis/);
  assert.match(gameSource, /onPointerDown/);
  assert.match(gameSource, /onPointerCancel/);
  assert.match(gameSource, /onKeyDown/);
});
