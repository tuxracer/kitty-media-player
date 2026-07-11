import { describe, expect, it } from 'vitest';
import { DEFAULT_DURATION_MS, DEFAULT_HEIGHT, DEFAULT_WIDTH, RGB_CHANNELS, createProceduralSource } from './index.ts';
import type { FrameSource } from '../frameSource/index.ts';

// The source reuses its buffer across calls, so snapshot a copy for comparison
const grabFrame = async (source: FrameSource, timeMs: number): Promise<Uint8Array> => {
  const frame = await source.getFrameAt(timeMs);
  if (frame === null) {
    throw new Error(`expected a frame at ${timeMs}ms, got null`);
  }
  return Uint8Array.from(frame);
};

describe('createProceduralSource', () => {
  it('reports rgb24 stream info with the default dimensions', async () => {
    const source = createProceduralSource();
    const info = await source.open();
    expect(info).toEqual({
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      colorSpace: 'rgb24',
      durationMs: DEFAULT_DURATION_MS,
      fps: 30,
    });
  });

  it('returns a buffer of width * height * 3 bytes', async () => {
    const source = createProceduralSource();
    const info = await source.open();
    const frame = await grabFrame(source, 0);
    expect(frame.length).toBe(info.width * info.height * RGB_CHANNELS);
  });

  it('is deterministic: the same timeMs renders byte-identical frames', async () => {
    const source = createProceduralSource();
    await source.open();
    const first = await grabFrame(source, 4_321);
    const second = await grabFrame(source, 4_321);
    expect(second).toEqual(first);
  });

  it('animates: frames at distant timestamps differ', async () => {
    const source = createProceduralSource();
    await source.open();
    const early = await grabFrame(source, 0);
    const late = await grabFrame(source, 5_000);
    expect(late).not.toEqual(early);
  });

  it('respects custom width, height, and durationMs', async () => {
    const width = 32;
    const height = 20;
    const durationMs = 4_000;
    const source = createProceduralSource({ width, height, durationMs });
    const info = await source.open();
    expect(info.width).toBe(width);
    expect(info.height).toBe(height);
    expect(info.durationMs).toBe(durationMs);
    const frame = await grabFrame(source, 0);
    expect(frame.length).toBe(width * height * RGB_CHANNELS);
  });

  it('wraps time modulo durationMs', async () => {
    const source = createProceduralSource();
    const { durationMs } = await source.open();
    const base = await grabFrame(source, 1_234);
    const wrapped = await grabFrame(source, 1_234 + durationMs);
    expect(wrapped).toEqual(base);
  });

  it('resolves null from getFrameAt after close, and close is idempotent', async () => {
    const source = createProceduralSource();
    await source.open();
    await source.seek(1_000);
    await source.close();
    await expect(source.getFrameAt(1_000)).resolves.toBeNull();
    await expect(source.close()).resolves.toBeUndefined();
    await expect(source.getFrameAt(0)).resolves.toBeNull();
  });
});
