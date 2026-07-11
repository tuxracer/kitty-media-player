import type { FrameSource, FrameSourceInfo } from '../frameSource/index.ts';
import {
  BACKGROUND_RGB,
  BALL_MARGIN,
  BALL_RADIUS,
  DEFAULT_DURATION_MS,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  HUE_SECTOR_COUNT,
  LISSAJOUS_A,
  LISSAJOUS_B,
  MS_PER_SECOND,
  PROCEDURAL_FPS,
  RGB_CHANNELS,
  RGB_MAX,
} from './consts.ts';
import type { ProceduralSourceOptions } from './types.ts';

export * from './consts.ts';
export * from './types.ts';

// Full-saturation, full-value hue (0-1) to 8-bit RGB, so the ball's color
// cycles once per loop. Pure function of time so seeking is deterministic.
const hueToRgb = (hue: number): readonly [number, number, number] => {
  const h = (((hue % 1) + 1) % 1) * HUE_SECTOR_COUNT;
  const x = 1 - Math.abs((h % 2) - 1);
  const sectors: readonly (readonly [number, number, number])[] = [
    [1, x, 0],
    [x, 1, 0],
    [0, 1, x],
    [0, x, 1],
    [x, 0, 1],
    [1, 0, x],
  ];
  const [r, g, b] = sectors[Math.floor(h) % HUE_SECTOR_COUNT];
  return [Math.round(r * RGB_MAX), Math.round(g * RGB_MAX), Math.round(b * RGB_MAX)];
};

/**
 * Creates a procedural FrameSource: a hue-cycling ball on a Lissajous path
 * over a dark background. Frames are a pure function of timeMs, and time
 * wraps modulo durationMs so any timeMs is valid. The returned buffer is
 * reused across calls, so it is only valid until the next getFrameAt.
 * After close(), getFrameAt resolves null (and close stays idempotent).
 */
export const createProceduralSource = (options: ProceduralSourceOptions = {}): FrameSource => {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
  let closed = false;

  // Reused across frames so playback does not allocate a framebuffer per tick
  const frameBuffer = new Uint8Array(width * height * RGB_CHANNELS);

  const renderFrame = (timeMs: number): Uint8Array => {
    const wrappedMs = ((timeMs % durationMs) + durationMs) % durationMs;
    const t = wrappedMs / MS_PER_SECOND;
    const centerX = width / 2;
    const centerY = height / 2;
    const ampX = width / 2 - BALL_RADIUS - BALL_MARGIN;
    const ampY = height / 2 - BALL_RADIUS - BALL_MARGIN;
    const ballX = centerX + ampX * Math.sin(t * LISSAJOUS_A);
    const ballY = centerY + ampY * Math.sin(t * LISSAJOUS_B);
    const [ballR, ballG, ballB] = hueToRgb(wrappedMs / durationMs);
    const radiusSquared = BALL_RADIUS * BALL_RADIUS;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const i = (py * width + px) * RGB_CHANNELS;
        const dx = px - ballX;
        const dy = py - ballY;
        const inside = dx * dx + dy * dy <= radiusSquared;
        frameBuffer[i] = inside ? ballR : BACKGROUND_RGB[0];
        frameBuffer[i + 1] = inside ? ballG : BACKGROUND_RGB[1];
        frameBuffer[i + 2] = inside ? ballB : BACKGROUND_RGB[2];
      }
    }
    return frameBuffer;
  };

  const info: FrameSourceInfo = {
    width,
    height,
    colorSpace: 'rgb24',
    durationMs,
    fps: PROCEDURAL_FPS,
  };

  return {
    open: () => Promise.resolve(info),
    getFrameAt: (timeMs: number) => Promise.resolve(closed ? null : renderFrame(timeMs)),
    seek: () => Promise.resolve(),
    close: () => {
      closed = true;
      return Promise.resolve();
    },
  };
};
