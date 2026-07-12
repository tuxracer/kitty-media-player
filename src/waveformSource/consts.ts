/** Milliseconds per second, for timestamp math (per-module duplicate, see src/index.ts) */
export const MS_PER_SECOND = 1_000;

/** Bytes per rgb24 pixel (per-module duplicate, see src/index.ts) */
export const RGB_CHANNELS = 3;

/** Oscilloscope canvas width in pixels */
export const WAVEFORM_WIDTH = 640;

/** Oscilloscope canvas height in pixels */
export const WAVEFORM_HEIGHT = 360;

/** Frame rate of the rendered trace */
export const WAVEFORM_FPS = 30;

/** Mono PCM decode rate, plenty of temporal detail for a scope trace */
export const PCM_SAMPLE_RATE = 8_000;

/** How much PCM each frame draws */
export const WINDOW_MS = 100;

/** Decode margin past the playhead below which the source reports buffering */
export const BUFFER_MARGIN_MS = 2_000;

/** Bytes per s16le sample */
export const BYTES_PER_SAMPLE = 2;

/** s16 full scale, for normalizing sample amplitudes */
export const S16_MAX = 32_768;

/** Trace color red component */
const TRACE_RED = 64;

/** Trace color green component */
const TRACE_GREEN = 224;

/** Trace color blue component */
const TRACE_BLUE = 160;

/** Trace color drawn over the black background */
export const TRACE_RGB: readonly [number, number, number] = [TRACE_RED, TRACE_GREEN, TRACE_BLUE];

/** Vertical headroom so a full-scale sample never touches the canvas edge */
export const AMPLITUDE_SCALE = 2.0;
