/** Default source framebuffer width in pixels */
export const DEFAULT_WIDTH = 240;

/** Default source framebuffer height in pixels */
export const DEFAULT_HEIGHT = 140;

/** Native frame rate reported by open() */
export const PROCEDURAL_FPS = 30;

/** Default loop duration in ms (time wraps modulo this) */
export const DEFAULT_DURATION_MS = 20_000;

/** Ball radius in pixels */
export const BALL_RADIUS = 16;

/** Margin in pixels the ball keeps from the framebuffer edges */
export const BALL_MARGIN = 4;

/** Lissajous X angular frequency (differs from Y so the path traces a moving figure) */
export const LISSAJOUS_A = 1.1;

/** Lissajous Y angular frequency */
export const LISSAJOUS_B = 1.7;

const BACKGROUND_R = 8;
const BACKGROUND_G = 10;
const BACKGROUND_B = 24;

/** Dark background color the ball moves over */
export const BACKGROUND_RGB: readonly [number, number, number] = [
  BACKGROUND_R,
  BACKGROUND_G,
  BACKGROUND_B,
];

/** Bytes per pixel in an rgb24 framebuffer */
export const RGB_CHANNELS = 3;

/** Milliseconds per second, for converting timeMs to seconds */
export const MS_PER_SECOND = 1_000;

/** Number of hue sectors in the hue-to-RGB conversion */
export const HUE_SECTOR_COUNT = 6;

/** Maximum 8-bit channel value */
export const RGB_MAX = 255;
