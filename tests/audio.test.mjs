import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  BACKGROUND_AUDIO_ASSET,
  MATCH_AUDIO_ASSETS,
} from "../app/audio-assets.ts";
import { generateAudioAssets } from "../scripts/generate-audio.mjs";

const MODES = ["letters", "numbers", "shapes"];

function publicAssetUrl(assetPath) {
  return new URL(`../public${assetPath}`, import.meta.url);
}

function inspectWav(buffer) {
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WAVE");
  assert.equal(buffer.toString("ascii", 12, 16), "fmt ");
  assert.equal(buffer.toString("ascii", 36, 40), "data");

  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataSize = buffer.readUInt32LE(40);
  const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);

  assert.equal(channels, 1);
  assert.equal(sampleRate, 32_000);
  assert.equal(bitsPerSample, 16);
  assert.equal(dataSize, buffer.length - 44);
  assert.ok(dataSize > 0);

  return {
    duration: dataSize / bytesPerSecond,
    firstSample: buffer.readInt16LE(44),
    lastSample: buffer.readInt16LE(buffer.length - 2),
  };
}

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

test("maps every game mode to committed correct and mismatch assets", async () => {
  const assetPaths = [BACKGROUND_AUDIO_ASSET];

  for (const mode of MODES) {
    assert.deepEqual(Object.keys(MATCH_AUDIO_ASSETS[mode]).sort(), [
      "correct",
      "mismatch",
    ]);
    assetPaths.push(
      MATCH_AUDIO_ASSETS[mode].correct,
      MATCH_AUDIO_ASSETS[mode].mismatch,
    );
  }

  assert.equal(new Set(assetPaths).size, 7);

  for (const assetPath of assetPaths) {
    const buffer = await readFile(publicAssetUrl(assetPath));
    inspectWav(buffer);
  }
});

test("keeps the background seamless and effects short", async () => {
  const background = inspectWav(
    await readFile(publicAssetUrl(BACKGROUND_AUDIO_ASSET)),
  );
  assert.ok(background.duration >= 23.99 && background.duration <= 24.01);
  assert.ok(Math.abs(background.firstSample - background.lastSample) <= 1);

  for (const mode of MODES) {
    const correct = inspectWav(
      await readFile(publicAssetUrl(MATCH_AUDIO_ASSETS[mode].correct)),
    );
    const mismatch = inspectWav(
      await readFile(publicAssetUrl(MATCH_AUDIO_ASSETS[mode].mismatch)),
    );

    assert.ok(correct.duration >= 0.7 && correct.duration < 0.9);
    assert.ok(mismatch.duration >= 0.45 && mismatch.duration < 0.6);
  }
});

test("reproduces every committed audio asset deterministically", async (context) => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "baby-colors-audio-"));
  context.after(() => rm(outputDirectory, { recursive: true, force: true }));

  const generated = await generateAudioAssets(outputDirectory);
  assert.equal(generated.length, 7);

  for (const fileName of generated) {
    const [generatedBuffer, committedBuffer] = await Promise.all([
      readFile(join(outputDirectory, fileName)),
      readFile(new URL(`../public/audio/${fileName}`, import.meta.url)),
    ]);

    assert.equal(hash(generatedBuffer), hash(committedBuffer));
  }
});
