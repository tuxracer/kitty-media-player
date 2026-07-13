import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudioPlayer } from '../audioPlayer/index.ts';
import {
  KEY_ARROW_LEFT,
  KEY_ARROW_RIGHT,
  runFallbackAudioPlayer,
} from './index.ts';

const TICK_MS = 50;
const DURATION_MS = 20_000;

const screenConstructor = vi.hoisted(() => vi.fn());
vi.mock('kitty-motion', () => ({ Screen: screenConstructor }));

interface AudioHarness {
  audio: AudioPlayer;
  playFroms: number[];
  pauseCalls: number;
  mutedValues: boolean[];
  closeCalls: number;
  starting: boolean;
  positionMs: number | null;
}

const createAudioHarness = (): AudioHarness => {
  const harness: AudioHarness = {
    playFroms: [],
    pauseCalls: 0,
    mutedValues: [],
    closeCalls: 0,
    starting: false,
    positionMs: null,
    audio: {
      open: () => Promise.resolve({ hasAudio: true }),
      playFrom: (timeMs) => {
        harness.playFroms.push(timeMs);
      },
      pause: () => {
        harness.pauseCalls += 1;
      },
      setMuted: (muted) => {
        harness.mutedValues.push(muted);
      },
      isStarting: () => harness.starting,
      getPositionMs: () => harness.positionMs,
      close: () => {
        harness.closeCalls += 1;
        return Promise.resolve();
      },
    },
  };
  return harness;
};

interface StreamHarness {
  input: PassThrough & {
    setRawMode(mode: boolean): void;
  };
  output: PassThrough;
  rawModeCalls: boolean[];
  outputWrites: string[];
}

const createStreams = (): StreamHarness => {
  const rawModeCalls: boolean[] = [];
  const outputWrites: string[] = [];
  const input = Object.assign(new PassThrough(), {
    setRawMode: (mode: boolean) => {
      rawModeCalls.push(mode);
    },
  });
  const output = new PassThrough();
  output.on('data', (chunk: Buffer) => {
    outputWrites.push(chunk.toString('utf8'));
  });
  return { input, output, rawModeCalls, outputWrites };
};

interface RunningHarness {
  audio: AudioHarness;
  streams: StreamHarness;
  running: Promise<void>;
}

const start = (options: { durationMs?: number; muted?: boolean; label?: string } = {}): RunningHarness => {
  const audio = createAudioHarness();
  const streams = createStreams();
  const running = runFallbackAudioPlayer({
    audio: audio.audio,
    durationMs: options.durationMs ?? DURATION_MS,
    input: streams.input,
    output: streams.output,
    muted: options.muted,
    label: options.label,
  });
  return { audio, streams, running };
};

const quit = async (state: RunningHarness, key = 'q'): Promise<void> => {
  state.streams.input.write(Buffer.from(key));
  await vi.advanceTimersByTimeAsync(0);
  await state.running;
};

describe('runFallbackAudioPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('autoplays at zero and holds the clock until audio finishes starting', async () => {
    const state = start();
    state.audio.starting = true;
    expect(state.audio.playFroms).toEqual([0]);

    await vi.advanceTimersByTimeAsync(TICK_MS * 10);
    expect(state.audio.playFroms).toEqual([0]);

    state.audio.starting = false;
    await vi.advanceTimersByTimeAsync(TICK_MS);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(state.audio.playFroms).toEqual([0]);
    await quit(state);
  });

  it('pauses and resumes audio from the current playhead', async () => {
    const state = start();
    await vi.advanceTimersByTimeAsync(TICK_MS + 700);
    state.streams.input.write(' ');
    expect(state.audio.pauseCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(500);
    state.streams.input.write(' ');
    expect(state.audio.playFroms.at(-1)).toBe(700);
    await quit(state);
  });

  it('clamps arrow seeks to zero and duration', async () => {
    const state = start({ durationMs: 6_000 });
    await vi.advanceTimersByTimeAsync(TICK_MS);
    state.streams.input.write(KEY_ARROW_LEFT);
    state.streams.input.write(KEY_ARROW_RIGHT);
    state.streams.input.write(KEY_ARROW_RIGHT);
    expect(state.audio.playFroms.slice(-3)).toEqual([0, 5_000, 6_000]);
    await quit(state);
  });

  it('loops and restarts audio at the wrapped playhead', async () => {
    const state = start({ durationMs: 1_000 });
    await vi.advanceTimersByTimeAsync(TICK_MS + 1_100);
    expect(state.audio.playFroms.at(-1)).toBe(0);
    await quit(state);
  });

  it('restarts audio when drift exceeds 250 ms', async () => {
    const state = start();
    await vi.advanceTimersByTimeAsync(TICK_MS);
    state.audio.positionMs = 5_000;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(state.audio.playFroms.at(-1)).toBe(1_000);
    await quit(state);
  });

  it('applies initial mute and toggles mute with m', async () => {
    const state = start({ muted: true });
    state.streams.input.write('m');
    expect(state.audio.mutedValues).toEqual([true, false]);
    await quit(state);
  });

  it('handles batched key chunks in order', async () => {
    const state = start();
    await vi.advanceTimersByTimeAsync(TICK_MS);
    state.streams.input.write(Buffer.from(`${KEY_ARROW_RIGHT}${KEY_ARROW_RIGHT} m`));
    expect(state.audio.playFroms.slice(-2)).toEqual([5_000, 10_000]);
    expect(state.audio.mutedValues).toEqual([false, true]);
    expect(state.audio.pauseCalls).toBe(1);
    await quit(state);
  });

  it.each(['q', '\u0003'])('cleans up once and restores raw mode for %j', async (key) => {
    const state = start();
    await quit(state, key);
    state.streams.input.write('q');
    await vi.advanceTimersByTimeAsync(0);
    expect(state.audio.closeCalls).toBe(1);
    expect(state.streams.rawModeCalls).toEqual([true, false]);
  });

  it('writes the optional placeholder label once without constructing a Screen', async () => {
    const state = start({ label: 'Song title' });
    expect(state.streams.outputWrites).toEqual(['Song title\n']);
    expect(screenConstructor).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(state.streams.outputWrites).toEqual(['Song title\n']);
    await quit(state);
  });

  it('continues silently when audio is null', async () => {
    const streams = createStreams();
    const running = runFallbackAudioPlayer({
      audio: null,
      durationMs: DURATION_MS,
      input: streams.input,
      output: streams.output,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    streams.input.write('q');
    await vi.advanceTimersByTimeAsync(0);
    await expect(running).resolves.toBeUndefined();
    expect(streams.rawModeCalls).toEqual([true, false]);
  });

  it('resolves silently when audio cleanup fails', async () => {
    const state = start();
    state.audio.audio.close = () => {
      state.audio.closeCalls += 1;
      return Promise.reject(new Error('close failed'));
    };
    state.streams.input.write('q');
    await vi.advanceTimersByTimeAsync(0);
    await expect(state.running).resolves.toBeUndefined();
    expect(state.audio.closeCalls).toBe(1);
  });
});
