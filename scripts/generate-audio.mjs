import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 32_000;
const BACKGROUND_DURATION_SECONDS = 24;

const MODE_PITCHES = {
  letters: {
    correct: [69, 74],
    mismatch: [64, 62],
  },
  numbers: {
    correct: [72, 76],
    mismatch: [65, 64],
  },
  shapes: {
    correct: [67, 72],
    mismatch: [62, 60],
  },
};

function midiToFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function createSamples(durationSeconds) {
  return new Float64Array(Math.round(SAMPLE_RATE * durationSeconds));
}

function addMusicBoxNote(samples, startSeconds, durationSeconds, midiNote, gain) {
  const start = Math.round(startSeconds * SAMPLE_RATE);
  const sampleCount = Math.round(durationSeconds * SAMPLE_RATE);
  const frequency = midiToFrequency(midiNote);
  const releaseSeconds = Math.min(0.08, durationSeconds / 3);

  for (let offset = 0; offset < sampleCount && start + offset < samples.length; offset += 1) {
    const time = offset / SAMPLE_RATE;
    const remaining = durationSeconds - time;
    const attack = Math.min(1, time / 0.008);
    const release = Math.min(1, remaining / releaseSeconds);
    const decay = Math.exp((-4.2 * time) / durationSeconds);
    const phase = 2 * Math.PI * frequency * time;
    const tone =
      Math.sin(phase) +
      0.32 * Math.sin(phase * 2) +
      0.11 * Math.sin(phase * 3);

    samples[start + offset] += gain * attack * release * decay * tone;
  }
}

function addSoftPluck(samples, startSeconds, durationSeconds, midiNote, gain) {
  const start = Math.round(startSeconds * SAMPLE_RATE);
  const sampleCount = Math.round(durationSeconds * SAMPLE_RATE);
  const frequency = midiToFrequency(midiNote);
  const releaseSeconds = Math.min(0.055, durationSeconds / 3);

  for (let offset = 0; offset < sampleCount && start + offset < samples.length; offset += 1) {
    const time = offset / SAMPLE_RATE;
    const remaining = durationSeconds - time;
    const attack = Math.min(1, time / 0.006);
    const release = Math.min(1, remaining / releaseSeconds);
    const decay = Math.exp((-5.8 * time) / durationSeconds);
    const phase = 2 * Math.PI * frequency * time;
    const tone = Math.sin(phase) + 0.18 * Math.sin(phase * 2);

    samples[start + offset] += gain * attack * release * decay * tone;
  }
}

function normalize(samples, peakLevel) {
  let peak = 0;

  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }

  if (peak === 0) {
    return samples;
  }

  const scale = peakLevel / peak;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] *= scale;
  }

  return samples;
}

function encodeWav(samples) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    const value = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    buffer.writeInt16LE(Math.round(value), 44 + index * bytesPerSample);
  }

  return buffer;
}

function createBackgroundLoop() {
  const samples = createSamples(BACKGROUND_DURATION_SECONDS);
  const beatSeconds = 0.75;
  const melody = [
    72, 76, 79, 76, 74, 79, 81, 79,
    76, 72, 74, 76, 79, 76, 74, 72,
    69, 72, 76, 72, 71, 74, 79, 74,
    72, 76, 79, 81, 79, 76, 74, 72,
  ];
  const harmony = [60, 60, 62, 62, 57, 57, 55, 55];

  melody.forEach((note, index) => {
    addMusicBoxNote(samples, index * beatSeconds, 0.62, note, 0.24);
  });

  harmony.forEach((note, index) => {
    addMusicBoxNote(samples, index * beatSeconds * 4, 1.25, note, 0.09);
  });

  return normalize(samples, 0.58);
}

function createCorrectEffect(pitches) {
  const samples = createSamples(0.78);
  addMusicBoxNote(samples, 0, 0.48, pitches[0], 0.62);
  addMusicBoxNote(samples, 0.23, 0.5, pitches[1], 0.72);
  return normalize(samples, 0.76);
}

function createMismatchEffect(pitches) {
  const samples = createSamples(0.52);
  addSoftPluck(samples, 0, 0.3, pitches[0], 0.58);
  addSoftPluck(samples, 0.17, 0.3, pitches[1], 0.48);
  return normalize(samples, 0.68);
}

export async function generateAudioAssets(
  outputDirectory = fileURLToPath(new URL("../public/audio/", import.meta.url)),
) {
  await mkdir(outputDirectory, { recursive: true });

  const assets = [
    ["background-loop.wav", createBackgroundLoop()],
    ...Object.entries(MODE_PITCHES).flatMap(([mode, pitches]) => [
      [`${mode}-correct.wav`, createCorrectEffect(pitches.correct)],
      [`${mode}-mismatch.wav`, createMismatchEffect(pitches.mismatch)],
    ]),
  ];

  await Promise.all(
    assets.map(([fileName, samples]) =>
      writeFile(join(outputDirectory, fileName), encodeWav(samples)),
    ),
  );

  return assets.map(([fileName]) => fileName);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const generated = await generateAudioAssets();
  console.log(`Generated ${generated.length} audio assets in public/audio.`);
}
