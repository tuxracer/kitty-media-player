/** Bytes per rgb24 pixel (per-module duplicate, see src/index.ts) */
export const RGB_CHANNELS = 3;

/**
 * Nominal frame rate for the static image. Ticks only drive the buffering
 * gate's retries and identical-frame pushes that kitty-motion diffs away,
 * so a low rate saves work while keeping seeks and resumes responsive.
 */
export const COVER_ART_FPS = 10;
